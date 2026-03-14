"""
In-memory incident store for the FraudFlow memory layer.

Stores plain-English summaries of past fraud decisions and queries them
using keyword overlap — fast, zero-dependency, good enough for demo scale.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from ..models import AppProfile, FraudDecision, RiskSignals

logger = logging.getLogger(__name__)

# Minimum fraction of query keywords that must appear in a stored record
_MATCH_THRESHOLD = 0.30


@dataclass
class _IncidentRecord:
    text: str
    app_id: str
    verdict: str
    category: str


_store: list[_IncidentRecord] = []


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
    summaries = [text for _, text in scored[:3]]
    return "Similar past incidents: " + " | ".join(summaries)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_query(app: AppProfile, signals: RiskSignals) -> str:
    """Describe the active risk signals as a natural-language phrase."""
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

    # Fall back to a trust-score phrase so we always have a non-trivial query
    if len(parts) == 1:
        parts.append(f"trust score {app.trust_score:.2f}")

    return " ".join(parts)
