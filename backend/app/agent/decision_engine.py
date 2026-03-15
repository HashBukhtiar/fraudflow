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
from sqlmodel import Session

from ..models import (
    AlertEvent,
    AlertSeverity,
    AppProfile,
    FraudDecision,
    RiskSignals,
    Verdict,
)
from ..constants import (
    AI_MODEL,
    AI_MAX_TOKENS,
    FALLBACK_CONFIDENCE,
    NEW_APP_AGE_HOURS,
    MEMORY_BENFORD_QUERY_THRESHOLD,
    SCORE_BLOCK_THRESHOLD,
    SCORE_FLAG_MIN,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_MODEL      = AI_MODEL
_MAX_TOKENS = AI_MAX_TOKENS

_SYSTEM_PROMPT = (
    "You are a bank fraud analyst reviewing third-party fintech app behavior in "
    "Canada's Open Banking ecosystem. Be concise and precise. "
    "Respond only in JSON with no preamble or markdown.\n\n"
    "Verdict decision rules (apply in order — first match wins):\n"
    f"  1. BLOCK  — composite_risk_score >= {SCORE_BLOCK_THRESHOLD}\n"
    f"  2. FLAG   — composite_risk_score >= {SCORE_FLAG_MIN} and < {SCORE_BLOCK_THRESHOLD}\n"
    f"  3. ALLOW  — composite_risk_score < {SCORE_FLAG_MIN}\n\n"
    "Use your judgment as a fraud analyst. Consider the full context — risk signals, "
    "memory of past incidents, app category, and permission scope — not just the score."
)

# Fallback values used when the API call or JSON parse fails
_FALLBACK_VERDICT      = Verdict.FLAG
_FALLBACK_CONFIDENCE   = FALLBACK_CONFIDENCE
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
    new_flag      = " ← NEW APP"   if signals.app_age_hours < NEW_APP_AGE_HOURS              else ""
    perm_flag     = " ← EXCESSIVE" if signals.excessive_permissions                           else ""
    benford_flag  = " ← ANOMALOUS" if signals.benford_score > MEMORY_BENFORD_QUERY_THRESHOLD  else ""

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
  "verdict": "ALLOW" | "FLAG" | "BLOCK",
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
    # strip trailing fence if present
    if text.endswith("```"):
        text = text[:-3]
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

    # 2. Build prompt and call Claude — all verdicts flow through the model
    user_prompt = _build_user_prompt(app, signals, memory_context)

    verdict     = _FALLBACK_VERDICT
    confidence  = _FALLBACK_CONFIDENCE
    explanation = _FALLBACK_EXPLANATION
    action: str = _FALLBACK_ACTION

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

    # 3. Build and save FraudDecision linked to the saved RiskSignals
    decision = FraudDecision(
        app_id=app.app_id,
        risk_signals_id=signals.id,
        verdict=verdict,
        confidence=confidence,
        explanation=explanation,
        recommended_action=action,
        memory_context_used=bool(memory_context and memory_context.strip()),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)

    # 4. Create AlertEvent for FLAG or BLOCK
    alert = _make_alert(decision, app)
    if alert is not None:
        db.add(alert)
        db.commit()

    logger.info(
        "pipeline [%s]: verdict=%s confidence=%.0f%%",
        app.app_id, decision.verdict.value, decision.confidence * 100,
    )

    return decision
