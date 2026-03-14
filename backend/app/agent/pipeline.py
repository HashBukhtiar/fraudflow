"""
run_fraud_pipeline — wires profiler → memory → decision engine for one app.

Called by Person A's gateway as a background task after logging each APICallLog.
"""

from __future__ import annotations

import logging

from sqlmodel import Session, select

from ..models import APICallLog, AppProfile, FraudDecision
from ..profiler.profiler import generate_risk_signals
from ..memory.memory_store import query_similar_behavior, store_incident
from .decision_engine import make_decision

logger = logging.getLogger(__name__)


def run_fraud_pipeline(app_id: str, db: Session) -> FraudDecision:
    """Evaluate fraud risk for *app_id* using its 20 most recent API calls.

    Steps:
      1. Load AppProfile from DB
      2. Load last 20 APICallLog records (newest first)
      3. generate_risk_signals  → RiskSignals
      4. query_similar_behavior → memory context string
      5. make_decision          → saves RiskSignals + FraudDecision + AlertEvent
      6. store_incident         → update in-memory store for future queries
      7. Return FraudDecision

    Raises:
        ValueError: if app_id does not exist in the database.
    """
    # 1. Load app
    app = db.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()
    if app is None:
        raise ValueError(f"App '{app_id}' not found in database")

    # 2. Load recent calls
    recent_calls = list(
        db.exec(
            select(APICallLog)
            .where(APICallLog.app_id == app_id)
            .order_by(APICallLog.timestamp.desc())  # type: ignore[arg-type]
            .limit(20)
        ).all()
    )
    logger.debug("pipeline [%s]: %d recent calls loaded", app_id, len(recent_calls))

    # 3. Profiler
    signals = generate_risk_signals(app, recent_calls)
    logger.debug(
        "pipeline [%s]: composite_risk_score=%.2f", app_id, signals.composite_risk_score
    )

    # 4. Memory
    memory_context = query_similar_behavior(app, signals)

    # 5. Decision (persists signals + decision + alert to DB)
    decision = make_decision(app, signals, memory_context, db)
    logger.info(
        "pipeline [%s]: verdict=%s confidence=%.0f%%",
        app_id, decision.verdict.value, decision.confidence * 100,
    )

    # 6. Feed result back into memory for future queries
    store_incident(decision, app)

    return decision
