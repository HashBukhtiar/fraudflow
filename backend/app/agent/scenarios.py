"""
Demo scenario builders — seed suspicious API call patterns then run the pipeline.

Each function:
  1. Loads the target AppProfile from DB (raises if not found)
  2. Seeds crafted APICallLog records that trigger specific fraud signals
  3. Calls run_fraud_pipeline to generate a FraudDecision
  4. Deletes the seeded rows (keeps decisions + alerts in DB)
  5. Returns the FraudDecision
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from ..models import APICallLog, AppProfile, FraudDecision
from .pipeline import run_fraud_pipeline

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _load_app(name: str, db: Session) -> AppProfile:
    app = db.exec(select(AppProfile).where(AppProfile.name == name)).first()
    if app is None:
        raise ValueError(
            f"AppProfile '{name}' not found. "
            "Ensure seed data is loaded before running demo scenarios."
        )
    return app


def _seed_calls(logs: list[APICallLog], db: Session) -> list[int]:
    """Insert logs, commit, and return their assigned DB ids."""
    for log in logs:
        db.add(log)
    db.commit()
    for log in logs:
        db.refresh(log)
    return [log.id for log in logs if log.id is not None]


def _delete_seeded(ids: list[int], db: Session) -> None:
    for log_id in ids:
        log = db.get(APICallLog, log_id)
        if log:
            db.delete(log)
    db.commit()


# ---------------------------------------------------------------------------
# Scenario 1 — rogue budgeting app
# ---------------------------------------------------------------------------

def scenario_rogue_budgeting_app(db: Session) -> FraudDecision:
    """BudgetBuddy repeatedly calls /open-banking/payments overnight.

    Signals fired:
      • unusual_endpoint_ratio = 1.0  (budgeting app on payments endpoint)
      • off_hours_ratio = 1.0         (all calls between 02:00–04:00)
      • benford_score high            (all amounts start with 5 — non-natural)
    """
    app = _load_app("BudgetBuddy", db)
    now = datetime.now(timezone.utc)

    # 15 calls between 02:00 and 04:00 today — spread evenly over 2-hour window
    today_2am = now.replace(hour=2, minute=0, second=0, microsecond=0)

    # Amounts all starting with 5 → stark Benford deviation
    amounts = [
        540.0, 521.0, 567.0, 589.0, 512.0,
        534.0, 578.0, 523.0, 556.0, 591.0,
        543.0, 507.0, 568.0, 519.0, 545.0,
    ]

    logs = [
        APICallLog(
            app_id=app.app_id,
            endpoint="/open-banking/payments",
            http_method="POST",
            timestamp=today_2am + timedelta(minutes=i * 8),
            status_code=200,
            response_time_ms=140.0,
            amount=amounts[i],
        )
        for i in range(15)
    ]

    seeded_ids = _seed_calls(logs, db)
    logger.debug("scenario_rogue_budgeting_app: seeded %d calls", len(seeded_ids))

    try:
        decision = run_fraud_pipeline(app.app_id, db)
    except Exception:
        logger.exception("scenario_rogue_budgeting_app: pipeline failed; seeded calls preserved for debugging")
        raise

    _delete_seeded(seeded_ids, db)
    return decision


# ---------------------------------------------------------------------------
# Scenario 2 — payment anomaly / structuring
# ---------------------------------------------------------------------------

def scenario_payment_anomaly(db: Session) -> FraudDecision:
    """QuickPay fires 8 payments just under $10,000 within 3 minutes.

    Signals fired:
      • call_rate_per_minute high     (8 calls in < 3 min)
      • benford_score high            (all amounts start with 9 — structuring pattern)
      • trust_score low               (QuickPay has low trust)
    """
    app = _load_app("QuickPay", db)
    now = datetime.now(timezone.utc)

    # All 8 calls within the last 3 minutes so call_rate fires
    amounts = [9800.0, 9750.0, 9900.0, 9850.0, 9820.0, 9780.0, 9920.0, 9870.0]

    logs = [
        APICallLog(
            app_id=app.app_id,
            endpoint="/open-banking/payments",
            http_method="POST",
            timestamp=now - timedelta(seconds=i * 20),
            status_code=200,
            response_time_ms=95.0,
            amount=amounts[i],
        )
        for i in range(8)
    ]

    seeded_ids = _seed_calls(logs, db)
    logger.debug("scenario_payment_anomaly: seeded %d calls", len(seeded_ids))

    try:
        decision = run_fraud_pipeline(app.app_id, db)
    except Exception:
        logger.exception("scenario_payment_anomaly: pipeline failed; seeded calls preserved for debugging")
        raise

    _delete_seeded(seeded_ids, db)
    return decision


# ---------------------------------------------------------------------------
# Scenario 3 — social-engineering tax app
# ---------------------------------------------------------------------------

def scenario_social_engineering(db: Session) -> FraudDecision:
    """TaxEasy (36h-old app) hits accounts, transactions, AND payments in 10 min.

    Signals fired:
      • new_app_risk = True           (registered < 72 hours ago)
      • unusual_endpoint_ratio high   (tax app calling /payments)
      • excessive_permissions = True  (6 permission scopes)
      • trust_score very low          (TaxEasy has trust_score 0.10)
      • off_hours_ratio moderate      (some overnight calls)
    """
    app = _load_app("TaxEasy", db)
    now = datetime.now(timezone.utc)

    # Mix of endpoints — 4 payments (scope mismatch), 4 transactions, 4 accounts
    # Spread over last 10 minutes; some early-morning for off_hours signal
    endpoint_pattern = [
        ("/open-banking/payments",     "POST", 3,  450.0),
        ("/open-banking/transactions", "GET",  2,  None),
        ("/open-banking/payments",     "POST", 1,  880.0),
        ("/open-banking/accounts",     "GET",  0,  None),
        ("/open-banking/payments",     "POST", 4,  330.0),
        ("/open-banking/accounts",     "GET",  5,  None),
        ("/open-banking/transactions", "GET",  6,  None),
        ("/open-banking/payments",     "POST", 7,  720.0),
        ("/open-banking/accounts",     "GET",  8,  None),
        ("/open-banking/transactions", "GET",  9,  None),
        ("/open-banking/accounts",     "GET",  10, None),
        ("/open-banking/transactions", "GET",  10, None),
    ]

    logs = [
        APICallLog(
            app_id=app.app_id,
            endpoint=ep,
            http_method=method,
            # Interleave: some calls at 3am (off_hours), rest within last 10 min
            timestamp=(
                now.replace(hour=3, minute=offset, second=0, microsecond=0)
                if offset < 5
                else now - timedelta(minutes=offset)
            ),
            status_code=200,
            response_time_ms=165.0,
            amount=amount,
        )
        for ep, method, offset, amount in endpoint_pattern
    ]

    seeded_ids = _seed_calls(logs, db)
    logger.debug("scenario_social_engineering: seeded %d calls", len(seeded_ids))

    try:
        decision = run_fraud_pipeline(app.app_id, db)
    except Exception:
        logger.exception("scenario_social_engineering: pipeline failed; seeded calls preserved for debugging")
        raise

    _delete_seeded(seeded_ids, db)
    return decision


# ---------------------------------------------------------------------------
# Smoke test — python -m backend.app.agent.scenarios
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    from datetime import timedelta

    from sqlmodel import SQLModel, create_engine

    from ..models import AppCategory, TrustLevel

    logging.basicConfig(level=logging.WARNING, stream=sys.stdout)

    # --- In-memory DB -------------------------------------------------------
    engine = create_engine("sqlite:///:memory:", echo=False)
    SQLModel.metadata.create_all(engine)

    now = datetime.now(timezone.utc)

    # Seed the three demo apps (names exactly as scenarios expect)
    seed_apps = [
        AppProfile(
            app_id="budgetbuddy",
            name="BudgetBuddy",
            category=AppCategory.BUDGETING,
            permissions="read:accounts,read:transactions",
            registered_at=now - timedelta(days=180),
            trust_score=0.85,
            trust_level=TrustLevel.HIGH,
            is_active=True,
        ),
        AppProfile(
            app_id="quickpay",
            name="QuickPay",
            category=AppCategory.PAYMENTS,
            permissions="read:accounts,write:payments,read:transactions,read:balance,admin",
            registered_at=now - timedelta(days=30),
            trust_score=0.40,
            trust_level=TrustLevel.MEDIUM,
            is_active=True,
        ),
        AppProfile(
            app_id="taxeasy",
            name="TaxEasy",
            category=AppCategory.TAX,
            # 6 scopes → excessive_permissions = True
            permissions=(
                "read:accounts,read:transactions,write:payments,"
                "read:personal_info,write:consent,read:balances"
            ),
            registered_at=now - timedelta(hours=36),  # new_app_risk
            trust_score=0.10,
            trust_level=TrustLevel.NEW,
            is_active=True,
        ),
    ]

    with Session(engine, expire_on_commit=False) as db:
        for app in seed_apps:
            db.add(app)
        db.commit()

    # --- Run all three scenarios -------------------------------------------

    scenario_fns = [
        ("Scenario 1 — Rogue Budgeting App",    scenario_rogue_budgeting_app),
        ("Scenario 2 — Payment Anomaly",        scenario_payment_anomaly),
        ("Scenario 3 — Social Engineering",     scenario_social_engineering),
    ]

    print(f"\n{'=' * 65}")
    print("  FraudFlow — Demo Scenario Smoke Test")
    print(f"{'=' * 65}")

    for label, fn in scenario_fns:
        print(f"\n  {label}")
        print(f"  {'-' * 60}")
        with Session(engine, expire_on_commit=False) as db:
            try:
                decision = fn(db)
                print(f"  app_id            : {decision.app_id}")
                print(f"  verdict           : {decision.verdict.value}")
                print(f"  confidence        : {decision.confidence:.0%}")
                print(f"  explanation       : {decision.explanation}")
                print(f"  recommended_action: {decision.recommended_action}")
                print(f"  risk_signals_id   : {decision.risk_signals_id}")
                print(f"  decision id       : {decision.id}")
            except Exception as exc:
                print(f"  ERROR: {exc}")
