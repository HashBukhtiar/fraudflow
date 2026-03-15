"""
In-memory incident store for the FraudFlow memory layer.

Stores plain-English summaries of past fraud decisions and queries them
using keyword overlap — fast, zero-dependency, good enough for demo scale.

Pre-seeded with 4 representative incidents so every scenario run immediately
receives meaningful memory context, even on a fresh server start.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..models import AppProfile, FraudDecision, RiskSignals
from ..constants import (
    MEMORY_MATCH_THRESHOLD,
    MEMORY_TOP_K,
    MEMORY_OFF_HOURS_QUERY_THRESHOLD,
    MEMORY_HIGH_FREQ_QUERY_THRESHOLD,
    MEMORY_BENFORD_QUERY_THRESHOLD,
    NEW_APP_AGE_HOURS,
)

logger = logging.getLogger(__name__)

# Minimum fraction of query keywords that must appear in a stored record
_MATCH_THRESHOLD = MEMORY_MATCH_THRESHOLD


@dataclass
class _IncidentRecord:
    text: str
    app_id: str
    verdict: str
    category: str


# ---------------------------------------------------------------------------
# Pre-seeded incidents — always present from the first server start
# ---------------------------------------------------------------------------

_PRESEED: list[_IncidentRecord] = [
    _IncidentRecord(
        text=(
            "Budgeting app accessed /open-banking/payments 15 times at 3 AM. "
            "All amounts in the $500s range. Endpoint inconsistent with declared "
            "category. Verdict: BLOCKED."
        ),
        app_id="budgetbuddy",
        verdict="BLOCK",
        category="budgeting",
    ),
    _IncidentRecord(
        text=(
            "Payment app initiated 8 transactions all between $9,750 and $9,920 "
            "at 2 AM — amounts clustered just below the $10,000 mandatory reporting "
            "threshold. Structuring behaviour confirmed. Verdict: FLAGGED."
        ),
        app_id="quickpay",
        verdict="FLAG",
        category="payments",
    ),
    _IncidentRecord(
        text=(
            "Tax app registered 48 hours prior requested 6 permission scopes "
            "including payments:write and consent:write. Attempted payment endpoint "
            "access inconsistent with tax-filing purpose. Verdict: BLOCKED."
        ),
        app_id="taxeasy",
        verdict="BLOCK",
        category="tax",
    ),
    _IncidentRecord(
        text=(
            "Unclassified third-party app made 42 requests between midnight and "
            "4 AM across accounts and transactions endpoints. 2.8 calls/min "
            "sustained for 15 minutes. Consistent with automated data harvesting. "
            "Throttled."
        ),
        app_id="unknown",
        verdict="FLAG",
        category="other",
    ),
]

_store: list[_IncidentRecord] = list(_PRESEED)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def store_incident(decision: FraudDecision, app: AppProfile) -> None:
    """Save a fraud decision as a searchable plain-English record."""
    text = (
        f"{app.name} ({app.category.value}) was {decision.verdict.value} — "
        f"{decision.explanation}"
    )
    record = _IncidentRecord(
        text=text,
        app_id=app.app_id,
        verdict=decision.verdict.value,
        category=app.category.value,
    )
    _store.append(record)
    logger.debug("memory store_incident [%d records]: %s", len(_store), text)


def query_similar_behavior(app: AppProfile, signals: RiskSignals) -> str:
    """Return a plain-English summary of past incidents similar to these signals.

    Builds a natural-language query from the active risk signals, scores every
    stored record by keyword overlap, and returns the top matches.

    Returns "No similar patterns found." when nothing scores above the threshold.
    """
    if not _store:
        return "No similar patterns found."

    query = _build_query(app, signals)
    logger.debug("memory query: %s", query)

    keywords = set(query.lower().split())
    scored: list[tuple[float, str]] = []

    for record in _store:
        text_words = set(record.text.lower().split())
        hits = len(keywords & text_words)
        score = hits / max(len(keywords), 1)
        if score >= _MATCH_THRESHOLD:
            scored.append((score, record.text))

    if not scored:
        return "No similar patterns found."

    scored.sort(key=lambda x: x[0], reverse=True)
    summaries = [text for _, text in scored[:MEMORY_TOP_K]]
    return "Similar past incidents: " + " | ".join(summaries)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_query(app: AppProfile, signals: RiskSignals) -> str:
    """Describe the active risk signals as a natural-language phrase."""
    parts: list[str] = [f"{app.category.value} app"]

    if signals.unusual_endpoint_ratio > 0:
        parts.append("accessing payment endpoints")
    if signals.off_hours_ratio > MEMORY_OFF_HOURS_QUERY_THRESHOLD:
        parts.append("overnight")
    if signals.call_rate_per_minute > MEMORY_HIGH_FREQ_QUERY_THRESHOLD:
        parts.append("with high frequency")
    if signals.app_age_hours < NEW_APP_AGE_HOURS:
        parts.append("newly registered")
    if signals.excessive_permissions:
        parts.append("requesting excessive permissions")
    if signals.benford_score > MEMORY_BENFORD_QUERY_THRESHOLD:
        parts.append("with anomalous transaction amounts")

    # Fall back to a trust-score phrase so we always have a non-trivial query
    if len(parts) == 1:
        parts.append(f"trust score {app.trust_score:.2f}")

    return " ".join(parts)
