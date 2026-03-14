"""
Moorcheh memory client — stores fraud incidents and queries for similar past behavior.

The Moorcheh SDK is distributed via the hackathon workshop kit and is not on PyPI.
Both functions degrade gracefully to stubs when the SDK is unavailable, so the
rest of the pipeline can run end-to-end without it.

When the SDK arrives:
  pip install moorcheh   (or install from the workshop wheel)
  Set MOORCHEH_API_KEY in .env
"""

from __future__ import annotations

import os
import logging

from dotenv import load_dotenv

from ..models import AppProfile, FraudDecision, RiskSignals

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SDK bootstrap — swap the stub flag to False once the real SDK is installed
# ---------------------------------------------------------------------------

_MOORCHEH_AVAILABLE = False
_moorcheh_client = None

try:
    # TODO: replace this import with the real Moorcheh SDK import once installed.
    # Expected usage pattern (adjust to actual SDK API):
    #   import moorcheh
    #   _moorcheh_client = moorcheh.Client(api_key=os.getenv("MOORCHEH_API_KEY"))
    #   _MOORCHEH_AVAILABLE = True
    raise ImportError("Moorcheh SDK not yet installed")  # remove this line when SDK arrives
except ImportError:
    logger.warning(
        "Moorcheh SDK not found — memory layer running in stub mode. "
        "Install the SDK from the hackathon workshop kit to enable real semantic memory."
    )

_COLLECTION = "fraudflow-incidents"

# Minimum similarity score to treat a Moorcheh result as relevant
_SIMILARITY_THRESHOLD = 0.70

# ---------------------------------------------------------------------------
# Stub storage (in-process only; cleared on restart)
# ---------------------------------------------------------------------------

_stub_store: list[dict] = []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def store_incident(decision: FraudDecision, app: AppProfile) -> None:
    """Persist a fraud decision as a searchable memory record.

    The text content is a plain-English summary so the vector embedding
    captures semantic meaning rather than raw JSON.

    Args:
        decision: The FraudDecision produced by the agent.
        app:      The AppProfile the decision was made about.
    """
    content = (
        f"{app.name} ({app.category.value}) was {decision.verdict.value} — "
        f"{decision.explanation}"
    )
    metadata = {
        "app_id":  app.app_id,
        "verdict": decision.verdict.value,
        "category": app.category.value,
    }

    if _MOORCHEH_AVAILABLE and _moorcheh_client is not None:
        # TODO: call the real Moorcheh SDK to store the record.
        # Expected pattern (adjust to actual SDK API):
        #   _moorcheh_client.add(
        #       collection=_COLLECTION,
        #       text=content,
        #       metadata=metadata,
        #   )
        pass
    else:
        # --- STUB ---
        _stub_store.append({"text": content, "metadata": metadata})
        logger.debug("stub store_incident: %s", content)


def query_similar_behavior(app: AppProfile, signals: RiskSignals) -> str:
    """Semantically search memory for past incidents similar to the current signals.

    Builds a natural-language query from the active risk signals, queries
    Moorcheh, and returns a plain-English summary of the most relevant past
    incidents.

    Returns:
        A short summary string, or "No similar patterns found." when nothing
        relevant is in memory.
    """
    query = _build_query(app, signals)
    logger.debug("memory query: %s", query)

    if _MOORCHEH_AVAILABLE and _moorcheh_client is not None:
        # TODO: call the real Moorcheh SDK for semantic search.
        # Expected pattern (adjust to actual SDK API):
        #   results = _moorcheh_client.query(
        #       collection=_COLLECTION,
        #       text=query,
        #       top_k=3,
        #   )
        #   relevant = [r for r in results if r.score >= _SIMILARITY_THRESHOLD]
        #   if not relevant:
        #       return "No similar patterns found."
        #   summaries = [r.text for r in relevant]
        #   return "Similar past incidents: " + " | ".join(summaries)
        return "No similar patterns found."  # remove once SDK wired up
    else:
        # --- STUB ---
        return _stub_query(query)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_query(app: AppProfile, signals: RiskSignals) -> str:
    """Compose a descriptive natural-language query from the active risk signals."""
    parts: list[str] = [f"{app.category.value} app"]

    if signals.unusual_endpoint_ratio > 0:
        parts.append("accessing payment endpoints")

    if signals.off_hours_ratio > 0.3:
        parts.append("overnight")

    if signals.call_rate_per_minute > 2.0:
        parts.append("with high frequency")

    if signals.app_age_hours < 72:
        parts.append("newly registered")

    if signals.excessive_permissions:
        parts.append("requesting excessive permissions")

    if signals.benford_score > 0.5:
        parts.append("with anomalous transaction amounts")

    if len(parts) == 1:
        # No specific signals — fall back to a generic trust-score query
        parts.append(f"with trust score {app.trust_score:.2f}")

    return " ".join(parts)


def _stub_query(query: str) -> str:
    """Search the in-process stub store using simple substring keyword matching."""
    if not _stub_store:
        return "No similar patterns found."

    keywords = set(query.lower().split())
    scored: list[tuple[float, str]] = []

    for record in _stub_store:
        text = record["text"].lower()
        hits = sum(1 for kw in keywords if kw in text)
        score = hits / max(len(keywords), 1)
        if score > 0:
            scored.append((score, record["text"]))

    # Require at least 30 % keyword overlap to count as a match
    scored = [(s, t) for s, t in scored if s >= 0.30]

    if not scored:
        return "No similar patterns found."

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:3]
    summaries = [text for _, text in top]
    return "Similar past incidents: " + " | ".join(summaries)


# ---------------------------------------------------------------------------
# Smoke-test — python -m backend.app.memory.moorcheh_client
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from datetime import datetime, timezone, timedelta
    from ..models import AppCategory, AppProfile, FraudDecision, RiskSignals, Verdict

    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)

    # --- Build fake TaxEasy BLOCK decision ----------------------------------

    now = datetime.now(timezone.utc)

    tax_easy = AppProfile(
        app_id="taxeasy",
        name="TaxEasy",
        category=AppCategory.TAX,
        permissions="read:accounts,read:transactions,write:payments",
        registered_at=now - timedelta(days=2),
        trust_score=0.10,
        is_active=True,
    )

    block_decision = FraudDecision(
        app_id="taxeasy",
        verdict=Verdict.BLOCK,
        confidence=0.94,
        explanation=(
            "Newly registered tax app called /open-banking/payments repeatedly "
            "between 02:00 and 04:00. Scope mismatch and overnight access pattern "
            "strongly indicate credential harvesting or social-engineering attack."
        ),
        recommended_action="Suspend app and notify account holders immediately.",
        decided_at=now,
    )

    tax_signals = RiskSignals(
        app_id="taxeasy",
        benford_score=0.16,
        benford_deviation=0.05,
        call_rate_per_minute=2.4,
        off_hours_ratio=1.0,
        unusual_endpoint_ratio=0.5,
        app_age_hours=48.0,
        permission_scope_count=3,
        excessive_permissions=False,
        composite_risk_score=4.06,
    )

    # --- Step 1: store the incident -----------------------------------------

    print("\n[1] Storing TaxEasy BLOCK incident...")
    store_incident(block_decision, tax_easy)
    print(f"    Stub store now has {len(_stub_store)} record(s).")

    # --- Step 2: query for similar behavior ---------------------------------

    print("\n[2] Querying for similar behavior...")
    query = _build_query(tax_easy, tax_signals)
    print(f"    Generated query : \"{query}\"")

    result = query_similar_behavior(tax_easy, tax_signals)
    print(f"    Memory response : {result}")

    # --- Step 3: query with no match ----------------------------------------

    budget_buddy = AppProfile(
        app_id="budgetbuddy",
        name="BudgetBuddy",
        category=AppCategory.BUDGETING,
        permissions="read:accounts,read:transactions",
        registered_at=now - timedelta(days=180),
        trust_score=0.85,
        is_active=True,
    )

    low_signals = RiskSignals(
        app_id="budgetbuddy",
        benford_score=0.34,
        benford_deviation=0.10,
        call_rate_per_minute=0.0,
        off_hours_ratio=0.0,
        unusual_endpoint_ratio=0.0,
        app_age_hours=4320.0,
        permission_scope_count=2,
        excessive_permissions=False,
        composite_risk_score=0.49,
    )

    print("\n[3] Querying with low-risk BudgetBuddy signals (expect: no match)...")
    result2 = query_similar_behavior(budget_buddy, low_signals)
    print(f"    Memory response : {result2}")
