"""
App Registry routes — CRUD endpoints for third-party app profiles.

Exposes:
  GET  /api/apps                     list all registered apps
  GET  /api/apps/{app_id}            get a single app profile
  GET  /api/apps/{app_id}/calls      get API call history for an app
  POST /api/apps                     register a new app (internal / admin)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import get_session
from app.models import AlertEvent, APICallLog, AppCategory, AppProfile, FraudDecision, RiskSignals, TrustLevel

router = APIRouter(prefix="/api/apps", tags=["App Registry"])

SessionDep = Annotated[Session, Depends(get_session)]


# ---------------------------------------------------------------------------
# Request schema for creating an app (plain Pydantic — no SQLModel table issues)
# ---------------------------------------------------------------------------

class AppCreateRequest(BaseModel):
    """Payload for registering a new third-party app."""
    app_id: str
    name: str
    category: AppCategory = AppCategory.OTHER
    description: str = ""
    trust_score: float = 1.0
    trust_level: TrustLevel = TrustLevel.NEW
    permissions: str = ""
    is_active: bool = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_model=list[AppProfile])
def list_apps(session: SessionDep) -> list[AppProfile]:
    """Return all registered third-party apps ordered by trust score descending."""
    apps = session.exec(
        select(AppProfile).order_by(AppProfile.trust_score.desc())  # type: ignore[arg-type]
    ).all()
    return list(apps)


@router.get("/{app_id}", response_model=AppProfile)
def get_app(app_id: str, session: SessionDep) -> AppProfile:
    """Return a single app profile by app_id."""
    app = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")

    return app


@router.get("/{app_id}/calls", response_model=list[APICallLog])
def get_app_calls(
    app_id: str,
    session: SessionDep,
    limit: int = 100,
) -> list[APICallLog]:
    """Return recent API call logs for an app, newest first."""
    # Verify the app exists first
    app = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")

    calls = session.exec(
        select(APICallLog)
        .where(APICallLog.app_id == app_id)
        .order_by(APICallLog.timestamp.desc())  # type: ignore[arg-type]
        .limit(limit)
    ).all()

    return list(calls)


@router.post("/{app_id}/revoke", response_model=AppProfile)
def revoke_app(app_id: str, session: SessionDep) -> AppProfile:
    """Deactivate an app — consumer revokes access."""
    app = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")

    app.is_active = False
    session.add(app)
    session.commit()
    session.refresh(app)
    return app


@router.post("/{app_id}/connect", response_model=AppProfile)
def connect_app(app_id: str, session: SessionDep) -> AppProfile:
    """Activate an inactive app and wipe its fraud history for a clean demo start."""
    app = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail=f"App '{app_id}' not found")

    # Wipe stale fraud history so the attacker view starts fresh
    for log in session.exec(select(APICallLog).where(APICallLog.app_id == app_id)).all():
        session.delete(log)
    for alert in session.exec(select(AlertEvent).where(AlertEvent.app_id == app_id)).all():
        session.delete(alert)
    for decision in session.exec(select(FraudDecision).where(FraudDecision.app_id == app_id)).all():
        session.delete(decision)
    for signal in session.exec(select(RiskSignals).where(RiskSignals.app_id == app_id)).all():
        session.delete(signal)

    # Clear in-memory incident store
    try:
        from app.memory.memory_store import _store
        _store[:] = [r for r in _store if r.app_id != app_id]
    except Exception:
        pass

    app.is_active = True
    session.add(app)
    session.commit()
    session.refresh(app)

    # Reset pipeline cooldown so the first attacker action triggers a fresh run
    try:
        from app.agent.pipeline import reset_pipeline_cooldown
        reset_pipeline_cooldown(app_id)
    except Exception:
        pass

    return app


@router.post("", response_model=AppProfile, status_code=201)
def register_app(app_data: AppCreateRequest, session: SessionDep) -> AppProfile:
    """Register a new third-party app. app_id must be unique."""
    existing = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_data.app_id)
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"App '{app_data.app_id}' is already registered",
        )

    app = AppProfile(**app_data.model_dump())
    session.add(app)
    session.commit()
    session.refresh(app)
    return app
