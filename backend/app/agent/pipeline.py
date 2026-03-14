"""
Fraud pipeline stub — placeholder for Feature 8 (AI Decision Engine).

run_fraud_pipeline(app_id, session) is called as a FastAPI BackgroundTask
after every logged gateway request. It will:
  1. Run the profiler (scope + Benford + rate signals)
  2. Query Moorcheh memory for past patterns
  3. Call the LLM agent for a verdict
  4. Persist FraudDecision + AlertEvent

For now it runs the scope profiler only so the pipeline is live end-to-end
and the agent integration (Feature 8) can be dropped in without touching the
middleware or call sites.
"""

import logging

from sqlmodel import Session

from app.profiler.scope_rules import evaluate_scope_signals
from app.models import AppProfile, APICallLog, RiskSignals
from sqlmodel import select

logger = logging.getLogger("fraudflow.pipeline")


def run_fraud_pipeline(app_id: str, session: Session) -> None:
    """
    Entry point called as a background task after every gateway request.

    Current behaviour (stub):
      - Fetches the AppProfile and last 50 calls
      - Runs scope/permission profiler
      - Persists a RiskSignals row
      - Logs the composite_risk_score

    TODO (Feature 8): add Moorcheh memory lookup + LLM verdict + AlertEvent.
    """
    try:
        app = session.exec(
            select(AppProfile).where(AppProfile.app_id == app_id)
        ).first()

        if not app:
            logger.warning("pipeline: app '%s' not found — skipping", app_id)
            return

        recent_calls: list[APICallLog] = list(
            session.exec(
                select(APICallLog)
                .where(APICallLog.app_id == app_id)
                .order_by(APICallLog.timestamp.desc())  # type: ignore[arg-type]
                .limit(50)
            ).all()
        )

        signals = evaluate_scope_signals(app, recent_calls)

        risk = RiskSignals(
            app_id=app_id,
            excessive_permissions=signals["excessive_permissions"],
            permission_scope_count=signals["permission_scope_count"],
            unusual_endpoint_ratio=signals["unusual_endpoint_ratio"],
            app_age_hours=signals["app_age_hours"],
            benford_score=signals["benford_score"],
            benford_deviation=signals["benford_deviation"],
            call_rate_per_minute=signals["call_rate_per_minute"],
            off_hours_ratio=signals["off_hours_ratio"],
            composite_risk_score=signals["composite_risk_score"],
        )
        session.add(risk)
        session.commit()

        logger.info(
            "pipeline: app=%s risk_score=%.2f excessive_permissions=%s unusual_endpoint_ratio=%.2f",
            app_id,
            signals["composite_risk_score"],
            signals["excessive_permissions"],
            signals["unusual_endpoint_ratio"],
        )

    except Exception:
        logger.exception("pipeline: unhandled error for app '%s'", app_id)
