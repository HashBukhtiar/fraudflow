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
from sqlmodel import Session, select

from app.database import get_session
from app.models import APICallLog, AppProfile

router = APIRouter(prefix="/api/apps", tags=["App Registry"])

SessionDep = Annotated[Session, Depends(get_session)]


# ---------------------------------------------------------------------------
# Response schemas (simple Pydantic-style dicts via SQLModel)
# ---------------------------------------------------------------------------

class AppProfileCreate(AppProfile, table=False):
    """Schema for registering a new app — excludes auto-generated fields."""
    pass


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


@router.post("", response_model=AppProfile, status_code=201)
def register_app(app_data: AppProfile, session: SessionDep) -> AppProfile:
    """Register a new third-party app. app_id must be unique."""
    existing = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_data.app_id)
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"App '{app_data.app_id}' is already registered",
        )

    session.add(app_data)
    session.commit()
    session.refresh(app_data)
    return app_data
