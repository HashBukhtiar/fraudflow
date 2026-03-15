"""
Read-only routes for the frontend dashboards.

GET /api/alerts     → last 20 AlertEvents   (newest first)
GET /api/decisions  → last 20 FraudDecisions (newest first)

Person A: register this router in main.py:
    from app.gateway.read_routes import router as read_router
    app.include_router(read_router)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.constants import API_DEFAULT_LIST_LIMIT, API_DEFAULT_CALLS_LIMIT
from app.database import get_session
from app.models import AlertEvent, APICallLog, AppProfile, FraudDecision, RiskSignals

router = APIRouter(prefix="/api", tags=["Dashboard"])

SessionDep = Annotated[Session, Depends(get_session)]

# Original seeded trust scores — used by the reset endpoint
_SEED_TRUST_SCORES: dict[str, float] = {
    "budgetbuddy": 8.5,
    "quickpay": 5.0,
    "taxeasy": 1.5,
}


@router.get("/calls", response_model=list[APICallLog])
def get_calls(db: SessionDep, limit: int = API_DEFAULT_CALLS_LIMIT) -> list[APICallLog]:
    """Return the most recent API call logs, newest first."""
    return list(
        db.exec(
            select(APICallLog)
            .order_by(APICallLog.timestamp.desc())  # type: ignore[arg-type]
            .limit(limit)
        ).all()
    )


@router.get("/alerts", response_model=list[AlertEvent])
def get_alerts(db: SessionDep) -> list[AlertEvent]:
    """Return the most recent alert events, newest first."""
    return list(
        db.exec(
            select(AlertEvent)
            .order_by(AlertEvent.triggered_at.desc())  # type: ignore[arg-type]
            .limit(API_DEFAULT_LIST_LIMIT)
        ).all()
    )


@router.get("/decisions", response_model=list[FraudDecision])
def get_decisions(db: SessionDep) -> list[FraudDecision]:
    """Return the most recent fraud decisions, newest first."""
    return list(
        db.exec(
            select(FraudDecision)
            .order_by(FraudDecision.decided_at.desc())  # type: ignore[arg-type]
            .limit(API_DEFAULT_LIST_LIMIT)
        ).all()
    )


# ---------------------------------------------------------------------------
# Attacker view endpoints
# ---------------------------------------------------------------------------


@router.get("/apps/{app_id}/status")
def get_app_status(app_id: str, db: SessionDep) -> dict:
    """Return current app status for the attacker view to poll."""
    app = db.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")

    last_decision = db.exec(
        select(FraudDecision)
        .where(FraudDecision.app_id == app_id)
        .order_by(FraudDecision.decided_at.desc())  # type: ignore[arg-type]
        .limit(1)
    ).first()

    last_verdict = last_decision.verdict.value if last_decision else None
    is_blocked = last_verdict == "BLOCK"
    block_reason = last_decision.explanation if (last_decision and is_blocked) else None

    return {
        "app_id": app.app_id,
        "trust_score": app.trust_score,
        "last_verdict": last_verdict,
        "is_blocked": is_blocked,
        "block_reason": block_reason,
    }


@router.delete("/apps/{app_id}/reset")
def reset_app(app_id: str, db: SessionDep) -> dict:
    """Clear all demo state for an app so the attacker demo can restart."""
    app = db.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")

    # Delete call logs
    logs = db.exec(select(APICallLog).where(APICallLog.app_id == app_id)).all()
    for log in logs:
        db.delete(log)

    # Delete alert events
    alerts = db.exec(select(AlertEvent).where(AlertEvent.app_id == app_id)).all()
    for alert in alerts:
        db.delete(alert)

    # Delete fraud decisions (and their linked risk signals)
    decisions = db.exec(
        select(FraudDecision).where(FraudDecision.app_id == app_id)
    ).all()
    signal_ids = [d.risk_signals_id for d in decisions if d.risk_signals_id]
    for decision in decisions:
        db.delete(decision)

    # Delete orphaned risk signals
    if signal_ids:
        signals = db.exec(
            select(RiskSignals).where(RiskSignals.app_id == app_id)
        ).all()
        for signal in signals:
            db.delete(signal)

    # Reset trust score to seed value
    app.trust_score = _SEED_TRUST_SCORES.get(app_id, 1.0)
    db.add(app)

    db.commit()

    # Clear in-memory incident store for this app
    try:
        from app.memory.memory_store import _store
        _store[:] = [r for r in _store if r.app_id != app_id]
    except Exception:
        pass  # non-critical

    return {"reset": True, "app_id": app_id}
