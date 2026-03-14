"""
Demo trigger routes — fire pre-built fraud scenarios for the live demo.

POST /api/demo/trigger/{scenario}

Person A: register this router in main.py:
    from app.gateway.demo_routes import router as demo_router
    app.include_router(demo_router)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Annotated

from app.database import get_session
from app.models import FraudDecision
from app.agent.scenarios import (
    scenario_rogue_budgeting_app,
    scenario_payment_anomaly,
    scenario_social_engineering,
)

router = APIRouter(prefix="/api/demo", tags=["Demo"])

SessionDep = Annotated[Session, Depends(get_session)]

_SCENARIOS = {
    "rogue_budgeting_app":  scenario_rogue_budgeting_app,
    "payment_anomaly":      scenario_payment_anomaly,
    "social_engineering":   scenario_social_engineering,
}


@router.post("/trigger/{scenario}", response_model=FraudDecision)
def trigger_scenario(scenario: str, db: SessionDep) -> FraudDecision:
    """Run a named demo scenario and return the resulting FraudDecision.

    Valid scenario names: rogue_budgeting_app, payment_anomaly, social_engineering
    """
    fn = _SCENARIOS.get(scenario)
    if fn is None:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown scenario '{scenario}'. "
                f"Valid options: {', '.join(_SCENARIOS)}"
            ),
        )

    try:
        return fn(db)
    except ValueError as exc:
        # AppProfile not found — seed data missing
        raise HTTPException(status_code=500, detail=str(exc)) from exc
