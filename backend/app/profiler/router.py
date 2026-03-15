"""
Profiler API routes — Feature 4: Permission Scope Mismatch Detection.

Routes:
  POST /api/profile/{app_id}         → run a fresh profiler evaluation, persist RiskSignals
  GET  /api/profile/{app_id}/latest  → return the most recent RiskSignals for an app
  GET  /api/profile/{app_id}/history → return all RiskSignals records for an app (newest first)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.database import get_session
from app.models import APICallLog, AppProfile, RiskSignals
from app.profiler.profiler import generate_risk_signals
from app.constants import PROFILER_ROUTE_CALL_WINDOW, PIPELINE_RECENT_CALLS_LIMIT

router = APIRouter(prefix="/api/profile", tags=["Profiler"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_app_or_404(app_id: str, session: Session) -> AppProfile:
    app = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")
    return app


def _get_recent_calls(app_id: str, session: Session) -> list[APICallLog]:
    return list(
        session.exec(
            select(APICallLog)
            .where(APICallLog.app_id == app_id)
            .order_by(APICallLog.timestamp.desc())  # type: ignore[arg-type]
            .limit(PROFILER_ROUTE_CALL_WINDOW)
        ).all()
    )


# ---------------------------------------------------------------------------
# POST /api/profile/{app_id}  — run and persist a fresh evaluation
# ---------------------------------------------------------------------------

@router.post("/{app_id}", response_model=RiskSignals, status_code=201)
def run_profile(
    app_id: str,
    session: Session = Depends(get_session),
) -> RiskSignals:
    """
    Run the full profiler for an app and persist the result.

    Uses the same generate_risk_signals() function as the demo pipeline,
    so composite_risk_score values are consistent across both paths.

    Returns the persisted RiskSignals record.
    """
    app = _get_app_or_404(app_id, session)
    recent_calls = _get_recent_calls(app_id, session)

    risk = generate_risk_signals(app, recent_calls)

    session.add(risk)
    session.commit()
    session.refresh(risk)
    return risk


# ---------------------------------------------------------------------------
# GET /api/profile/{app_id}/latest  — most recent evaluation
# ---------------------------------------------------------------------------

@router.get("/{app_id}/latest", response_model=RiskSignals)
def get_latest_profile(
    app_id: str,
    session: Session = Depends(get_session),
) -> RiskSignals:
    """
    Return the most recently computed RiskSignals for an app.
    404 if the app has never been profiled.
    """
    _get_app_or_404(app_id, session)  # validate app exists

    result = session.exec(
        select(RiskSignals)
        .where(RiskSignals.app_id == app_id)
        .order_by(RiskSignals.evaluated_at.desc())  # type: ignore[arg-type]
        .limit(1)
    ).first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No profile found for app '{app_id}'. Run POST /api/profile/{app_id} first.",
        )
    return result


# ---------------------------------------------------------------------------
# GET /api/profile/{app_id}/history  — full evaluation history
# ---------------------------------------------------------------------------

@router.get("/{app_id}/history", response_model=list[RiskSignals])
def get_profile_history(
    app_id: str,
    limit: int = PIPELINE_RECENT_CALLS_LIMIT,
    session: Session = Depends(get_session),
) -> list[RiskSignals]:
    """
    Return all RiskSignals records for an app, newest first.
    Useful for the analyst dashboard to show risk score trends over time.
    """
    _get_app_or_404(app_id, session)

    return list(
        session.exec(
            select(RiskSignals)
            .where(RiskSignals.app_id == app_id)
            .order_by(RiskSignals.evaluated_at.desc())  # type: ignore[arg-type]
            .limit(limit)
        ).all()
    )
