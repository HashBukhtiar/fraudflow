"""
run_fraud_pipeline — wires profiler → memory → decision engine for one app.

Called by Person A's gateway as a background task after logging each APICallLog.
"""

from __future__ import annotations

import logging
import time

from sqlmodel import Session, select

from ..constants import (
    PIPELINE_RECENT_CALLS_LIMIT,
    TRUST_SCORE_PENALTY_BLOCK,
    TRUST_SCORE_PENALTY_FLAG,
)
from ..database import engine
from ..models import APICallLog, AppProfile, FraudDecision, Verdict
from ..profiler.profiler import generate_risk_signals
from ..memory.memory_store import query_similar_behavior, store_incident
from .decision_engine import make_decision

logger = logging.getLogger(__name__)

# Per-app cooldown — prevents duplicate pipeline runs from rapid bursts of calls
_COOLDOWN_S = 5.0
_last_run_ts: dict[str, float] = {}

# Minimum calls before the pipeline evaluates — lets innocent calls pass through
_MIN_CALLS_FOR_EVAL = 5

# Override trust penalties for smoother demo escalation
_FLAG_PENALTY = 0.5   # gentle — takes multiple FLAGs to erode trust
_BLOCK_PENALTY = TRUST_SCORE_PENALTY_BLOCK


def reset_pipeline_cooldown(app_id: str) -> None:
    """Clear the cooldown for an app so the next gateway call triggers a fresh run."""
    _last_run_ts.pop(app_id, None)


def run_fraud_pipeline(app_id: str, _db: Session | None = None, *, force: bool = False) -> FraudDecision | None:
    """Evaluate fraud risk for *app_id* using its most recent API calls.

    Always opens its own DB session so it is safe to call as a FastAPI
    BackgroundTask (the request-scoped session will already be closed by the
    time this runs).  The legacy *_db* parameter is accepted but ignored.

    Steps:
      1. Load AppProfile from DB
      2. Load last PIPELINE_RECENT_CALLS_LIMIT APICallLog records (newest first)
      3. generate_risk_signals  → RiskSignals
      4. query_similar_behavior → memory context string
      5. make_decision          → saves RiskSignals + FraudDecision + AlertEvent
      6. store_incident         → update in-memory store for future queries
      7. Return FraudDecision

    Raises:
        ValueError: if app_id does not exist in the database.
    """
    # Cooldown check — skip if a run already happened recently for this app
    if not force:
        now = time.monotonic()
        if now - _last_run_ts.get(app_id, 0.0) < _COOLDOWN_S:
            logger.debug("pipeline [%s]: skipped (cooldown)", app_id)
            return None
        _last_run_ts[app_id] = now

    with Session(engine) as db:
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
                .limit(PIPELINE_RECENT_CALLS_LIMIT)
            ).all()
        )
        logger.debug("pipeline [%s]: %d recent calls loaded", app_id, len(recent_calls))

        # 2b. Skip evaluation until enough calls have accumulated
        if len(recent_calls) < _MIN_CALLS_FOR_EVAL:
            logger.debug(
                "pipeline [%s]: only %d calls (need %d) — skipping evaluation",
                app_id, len(recent_calls), _MIN_CALLS_FOR_EVAL,
            )
            return None

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

        # 6. Update app trust score based on verdict
        if decision.verdict == Verdict.BLOCK:
            app.trust_score = max(0.0, app.trust_score - TRUST_SCORE_PENALTY_BLOCK)
            app.is_active = False
            db.add(app)
            db.commit()
            db.refresh(app)
        elif decision.verdict == Verdict.FLAG:
            app.trust_score = max(0.0, app.trust_score - _FLAG_PENALTY)
            db.add(app)
            db.commit()
            db.refresh(app)

        # 7. Feed result back into memory for future queries
        store_incident(decision, app)

        return decision
