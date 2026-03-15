"""
Read-only routes for the frontend dashboards.

GET /api/alerts     → last 20 AlertEvents   (newest first)
GET /api/decisions  → last 20 FraudDecisions (newest first)

Person A: register this router in main.py:
    from app.gateway.read_routes import router as read_router
    app.include_router(read_router)
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import AlertEvent, FraudDecision
from app.constants import API_DEFAULT_LIST_LIMIT

router = APIRouter(prefix="/api", tags=["Dashboard"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/alerts", response_model=list[AlertEvent])
def get_alerts(db: SessionDep) -> list[AlertEvent]:
    """Return the 20 most recent alert events, newest first."""
    return list(
        db.exec(
            select(AlertEvent)
            .order_by(AlertEvent.triggered_at.desc())  # type: ignore[arg-type]
            .limit(API_DEFAULT_LIST_LIMIT)
        ).all()
    )


@router.get("/decisions", response_model=list[FraudDecision])
def get_decisions(db: SessionDep) -> list[FraudDecision]:
    """Return the 20 most recent fraud decisions, newest first."""
    return list(
        db.exec(
            select(FraudDecision)
            .order_by(FraudDecision.decided_at.desc())  # type: ignore[arg-type]
            .limit(API_DEFAULT_LIST_LIMIT)
        ).all()
    )
