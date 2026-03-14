"""
Decision Engine — calls Claude to produce a FraudDecision from risk signals.

Pipeline per call:
  1. Save RiskSignals to DB
  2. Build prompt (app profile + signals + memory context)
  3. Call claude-haiku-4-5-20251001 via the Anthropic SDK
  4. Parse JSON response into a FraudDecision
  5. Link FraudDecision.risk_signals_id to saved RiskSignals
  6. Save FraudDecision to DB
  7. If FLAG or BLOCK, create and save an AlertEvent
  8. Return the FraudDecision
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

import anthropic
from dotenv import load_dotenv
from sqlmodel import Session

from ..models import (
    AlertEvent,
    AlertSeverity,
    AppProfile,
    FraudDecision,
    RiskSignals,
    Verdict,
)

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL      = "claude-haiku-4-5-20251001"
_MAX_TOKENS = 512

_SYSTEM_PROMPT = (
    "You are a bank fraud analyst reviewing third-party fintech app behavior in "
    "Canada's Open Banking ecosystem. Be concise and precise. "
    "Respond only in JSON with no preamble or markdown."
)

# Fallback values used when the API call or JSON parse fails
_FALLBACK_VERDICT      = Verdict.FLAG
_FALLBACK_CONFIDENCE   = 0.5
_FALLBACK_EXPLANATION  = "Decision engine parse error — manual review required."
_FALLBACK_ACTION       = "flag_for_review"

# LLM may say "APPROVE"; map it to the model's ALLOW value
_VERDICT_MAP: dict[str, Verdict] = {
    "APPROVE": Verdict.ALLOW,
    "ALLOW":   Verdict.ALLOW,
    "FLAG":    Verdict.FLAG,
    "BLOCK":   Verdict.BLOCK,
}

_SEVERITY_MAP: dict[Verdict, AlertSeverity | None] = {
    Verdict.ALLOW: None,                    # no alert for approved calls
    Verdict.FLAG:  AlertSeverity.WARNING,
    Verdict.BLOCK: AlertSeverity.CRITICAL,
}

_VALID_ACTIONS = {"allow", "log", "flag_for_review", "throttle", "revoke_token"}


# ---------------------------------------------------------------------------
# Anthropic client — lazy singleton
# ---------------------------------------------------------------------------

_anthropic_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    return _anthropic_client


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def _signals_summary(signals: RiskSignals) -> str:
    new_flag      = " ← NEW APP"   if signals.app_age_hours < 72    else ""
    perm_flag     = " ← EXCESSIVE" if signals.excessive_permissions   else ""
    benford_flag  = " ← ANOMALOUS" if signals.benford_score > 0.5    else ""

    lines = [
        f"  call_rate_per_minute   : {signals.call_rate_per_minute} calls/min",
        f"  off_hours_ratio        : {signals.off_hours_ratio:.1%}  (calls between 00:00–05:59)",
        f"  unusual_endpoint_ratio : {signals.unusual_endpoint_ratio:.1%}  (category–endpoint mismatch)",
        f"  app_age_hours          : {signals.app_age_hours:.1f} h{new_flag}",
        f"  permission_scope_count : {signals.permission_scope_count}{perm_flag}",
        f"  benford_score          : {signals.benford_score:.3f}{benford_flag}",
        f"  composite_risk_score   : {signals.composite_risk_score:.2f} / 10",
    ]
    return "\n".join(lines)


def _build_user_prompt(
    app: AppProfile,
    signals: RiskSignals,
    memory_context: str,
) -> str:
    return f"""App under review:
  Name          : {app.name}
  Category      : {app.category.value}
  Trust score   : {app.trust_score}
  App age       : {signals.app_age_hours:.1f} hours
  Permissions   : {app.permissions or "(none listed)"}

Risk signals:
{_signals_summary(signals)}

Memory context (similar past incidents):
  {memory_context}

Return a JSON object with exactly these keys:
{{
  "verdict": "APPROVE" | "FLAG" | "BLOCK",
  "confidence": <float 0.0–1.0>,
  "explanation": "<1-2 sentences written like a fraud analyst>",
  "recommended_action": "allow" | "log" | "flag_for_review" | "throttle" | "revoke_token"
}}"""


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

def _parse_response(raw: str) -> tuple[Verdict, float, str, str]:
    """Parse Claude's JSON. Returns (verdict, confidence, explanation, action).

    Strips accidental markdown fences before parsing.
    """
    text = raw.strip()
    if text.startswith("```"):
        # strip opening fence and optional language tag
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    data = json.loads(text)

    verdict_raw = str(data.get("verdict", "FLAG")).upper()
    verdict     = _VERDICT_MAP.get(verdict_raw, Verdict.FLAG)

    confidence = float(data.get("confidence", _FALLBACK_CONFIDENCE))
    confidence = max(0.0, min(1.0, confidence))

    explanation = str(data.get("explanation", _FALLBACK_EXPLANATION))

    action = str(data.get("recommended_action", _FALLBACK_ACTION))
    if action not in _VALID_ACTIONS:
        action = _FALLBACK_ACTION

    return verdict, confidence, explanation, action


# ---------------------------------------------------------------------------
# Alert factory
# ---------------------------------------------------------------------------

def _make_alert(decision: FraudDecision, app: AppProfile) -> AlertEvent | None:
    severity = _SEVERITY_MAP.get(decision.verdict)
    if severity is None:
        return None

    return AlertEvent(
        app_id=app.app_id,
        fraud_decision_id=decision.id,
        title=f"{decision.verdict.value}: {app.name} ({app.category.value})",
        description=(
            f"{decision.explanation} "
            f"Recommended action: {decision.recommended_action}."
        ),
        severity=severity,
        verdict=decision.verdict,
        resolved=False,
        triggered_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def make_decision(
    app: AppProfile,
    signals: RiskSignals,
    memory_context: str,
    db: Session,
) -> FraudDecision:
    """Run the full fraud-decision pipeline for one app evaluation.

    The *signals* object must NOT already be persisted — this function saves it
    and captures its assigned id before linking it to the decision.

    Returns the saved FraudDecision.
    """
    # 1. Persist RiskSignals → get DB-assigned id
    db.add(signals)
    db.commit()
    db.refresh(signals)

    # 2. Build prompt
    user_prompt = _build_user_prompt(app, signals, memory_context)

    # 3 + 4. Call Claude and parse response
    verdict     = _FALLBACK_VERDICT
    confidence  = _FALLBACK_CONFIDENCE
    explanation = _FALLBACK_EXPLANATION
    action      = _FALLBACK_ACTION

    try:
        response = _get_client().messages.create(
            model=_MODEL,
            max_tokens=_MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = next(
            (block.text for block in response.content if block.type == "text"),
            "",
        )
        verdict, confidence, explanation, action = _parse_response(raw)
        logger.debug("Claude raw response: %s", raw)

    except json.JSONDecodeError as exc:
        logger.warning("JSON parse error from Claude: %s", exc)
    except anthropic.APIError as exc:
        logger.error("Anthropic API error: %s", exc)
    except Exception as exc:
        # Catches auth errors (missing API key), network issues, etc.
        logger.error("Decision engine error (%s): %s", type(exc).__name__, exc)

    # 5 + 6. Build and save FraudDecision linked to the saved RiskSignals
    decision = FraudDecision(
        app_id=app.app_id,
        risk_signals_id=signals.id,
        verdict=verdict,
        confidence=confidence,
        explanation=explanation,
        recommended_action=action,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)

    # 7. Create AlertEvent for FLAG or BLOCK
    alert = _make_alert(decision, app)
    if alert is not None:
        db.add(alert)
        db.commit()

    # 8. Return
    return decision


# ---------------------------------------------------------------------------
# Smoke-test — python -m backend.app.agent.decision_engine
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from datetime import timedelta

    from sqlmodel import SQLModel, create_engine

    from ..models import APICallLog, AppCategory, AppProfile
    from ..profiler.profiler import generate_risk_signals
    from ..memory.memory_store import query_similar_behavior, store_incident

    logging.basicConfig(level=logging.WARNING, stream=sys.stdout)

    # --- In-memory SQLite DB ------------------------------------------------
    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)

    now = datetime.now(timezone.utc)

    # --- Seed apps ----------------------------------------------------------

    apps = [
        AppProfile(
            app_id="budgetbuddy",
            name="BudgetBuddy",
            category=AppCategory.BUDGETING,
            permissions="read:accounts,read:transactions",
            registered_at=now - timedelta(days=180),
            trust_score=0.85,
            is_active=True,
        ),
        AppProfile(
            app_id="quickpay",
            name="QuickPay",
            category=AppCategory.PAYMENTS,
            permissions="read:accounts,write:payments,read:transactions,read:balance,admin",
            registered_at=now - timedelta(days=30),
            trust_score=0.40,
            is_active=True,
        ),
        AppProfile(
            app_id="taxeasy",
            name="TaxEasy",
            category=AppCategory.TAX,
            permissions="read:accounts,read:transactions,write:payments",
            registered_at=now - timedelta(days=2),
            trust_score=0.10,
            is_active=True,
        ),
    ]

    # --- Mock call logs per scenario ----------------------------------------

    def _call(
        app_id: str,
        endpoint: str,
        hour: int = 14,
        amount: float | None = None,
        minutes_ago: int = 1,
    ) -> APICallLog:
        ts = now.replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(
            minutes=minutes_ago
        )
        return APICallLog(
            app_id=app_id,
            timestamp=ts,
            endpoint=endpoint,
            http_method="GET",
            status_code=200,
            response_time_ms=110.0,
            amount=amount,
        )

    scenario_calls = {
        "budgetbuddy": (
            [_call("budgetbuddy", "/open-banking/accounts",     hour=10, minutes_ago=i) for i in range(1, 6)]
            + [_call("budgetbuddy", "/open-banking/transactions", hour=11, amount=float(i * 31)) for i in range(1, 6)]
        ),
        "quickpay": (
            # high frequency overnight burst
            [_call("quickpay", "/open-banking/payments", hour=2, amount=999.99 * i, minutes_ago=i) for i in range(1, 13)]
        ),
        "taxeasy": (
            # new app + scope mismatch + overnight
            [_call("taxeasy", "/open-banking/payments",     hour=3, amount=float(i * 100), minutes_ago=i) for i in range(1, 5)]
            + [_call("taxeasy", "/open-banking/transactions", hour=14, amount=float(i * 57)) for i in range(1, 5)]
        ),
    }

    # --- Persist AppProfiles so FK constraints are satisfied ----------------
    # expire_on_commit=False keeps the in-memory objects usable after commit
    with Session(engine, expire_on_commit=False) as db:
        for app in apps:
            db.add(app)
        db.commit()

    # --- Run full pipeline for each app -------------------------------------

    print(f"\n{'=' * 65}")
    print("  FraudFlow Decision Engine — full pipeline smoke-test")
    print(f"{'=' * 65}")

    for app in apps:
        calls   = scenario_calls[app.app_id]
        signals = generate_risk_signals(app, calls)

        memory_context = query_similar_behavior(app, signals)

        with Session(engine, expire_on_commit=False) as db:
            # Re-attach app to this session so FK lookups work
            db.merge(app)
            db.commit()
            decision = make_decision(app, signals, memory_context, db)

        # Store incident so subsequent apps can query it
        store_incident(decision, app)

        risk_label = (
            "LOW"    if signals.composite_risk_score < 3 else
            "MEDIUM" if signals.composite_risk_score < 6 else
            "HIGH"
        )

        print(f"\n  App               : {app.name} ({app.category.value})")
        print(f"  Composite risk    : {signals.composite_risk_score:.2f} / 10  [{risk_label}]")
        print(f"  Memory context    : {memory_context[:80]}{'...' if len(memory_context) > 80 else ''}")
        print(f"  ── Decision ──────────────────────────────────────────")
        print(f"  Verdict           : {decision.verdict.value}")
        print(f"  Confidence        : {decision.confidence:.0%}")
        print(f"  Explanation       : {decision.explanation}")
        print(f"  Recommended action: {decision.recommended_action}")
        print(f"  risk_signals_id   : {decision.risk_signals_id}")
        print(f"  decision id       : {decision.id}")
