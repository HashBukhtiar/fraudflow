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

from app.constants import API_DEFAULT_LIST_LIMIT, API_DEFAULT_CALLS_LIMIT
from app.database import get_session
from app.models import AlertEvent, APICallLog, FraudDecision

router = APIRouter(prefix="/api", tags=["Dashboard"])

SessionDep = Annotated[Session, Depends(get_session)]


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
