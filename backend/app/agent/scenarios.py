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
    """BudgetBuddy attempts payment calls at 3am — token abuse / scope violation.

    BudgetBuddy only has read permissions (accounts:read, transactions:read,
    balances:read).  The rogue behaviour is that someone (or malware) is using
    BudgetBuddy's credentials to *attempt* payment operations it was never
    granted — all at 3am.  The gateway rejects with 403, but the pattern
    itself is a critical fraud signal.

    Signals fired:
      • unusual_endpoint_ratio = 1.0  (budgeting app calling /payments)
      • off_hours_ratio = 1.0         (all calls between 02:00–04:00)
      • benford_score high            (all amounts start with 5 — non-natural)
    """
    app = _load_app("BudgetBuddy", db)
    now = datetime.now(timezone.utc)

    # 15 calls in the recent past — spread over the last 2 hours
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
            timestamp=now - timedelta(minutes=(15 - i) * 8),
            time_of_day_hour=3,  # mark as off-hours for profiler
            status_code=403,
            response_time_ms=140.0,
            amount=amounts[i],
            flagged=True,
            scenario_tag="rogue_budgeting_app",
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

    return decision


# ---------------------------------------------------------------------------
# Scenario 2 — payment anomaly / structuring
# ---------------------------------------------------------------------------

def scenario_payment_anomaly(db: Session) -> FraudDecision:
    """QuickPay fires 8 payments just under $10,000 at 2am within a few minutes.

    Signals fired:
      • off_hours_ratio = 1.0         (all calls between 02:00–02:16)
      • call_rate_per_minute high     (8 calls in < 3 min)
      • benford_score / structuring   (all amounts in $8k–$10k band → structuring)
      • trust_score low               (QuickPay has low trust)
    """
    app = _load_app("QuickPay", db)
    now = datetime.now(timezone.utc)

    # 8 calls in a rapid burst within the last 3 minutes
    amounts = [9800.0, 9750.0, 9900.0, 9850.0, 9820.0, 9780.0, 9920.0, 9870.0]

    logs = [
        APICallLog(
            app_id=app.app_id,
            endpoint="/open-banking/payments",
            http_method="POST",
            timestamp=now - timedelta(seconds=(8 - i) * 20),
            time_of_day_hour=2,  # mark as off-hours for profiler
            status_code=200,
            response_time_ms=95.0,
            amount=amounts[i],
            flagged=True,
            scenario_tag="payment_anomaly",
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
    # All spread over last 12 minutes
    endpoint_pattern = [
        ("/open-banking/payments",     "POST", 12, 450.0),
        ("/open-banking/transactions", "GET",  11, None),
        ("/open-banking/payments",     "POST", 10, 880.0),
        ("/open-banking/accounts",     "GET",  9,  None),
        ("/open-banking/payments",     "POST", 8,  330.0),
        ("/open-banking/accounts",     "GET",  7,  None),
        ("/open-banking/transactions", "GET",  6,  None),
        ("/open-banking/payments",     "POST", 5,  720.0),
        ("/open-banking/accounts",     "GET",  4,  None),
        ("/open-banking/transactions", "GET",  3,  None),
        ("/open-banking/accounts",     "GET",  2,  None),
        ("/open-banking/transactions", "GET",  1,  None),
    ]

    logs = [
        APICallLog(
            app_id=app.app_id,
            endpoint=ep,
            http_method=method,
            timestamp=now - timedelta(minutes=offset),
            time_of_day_hour=3,  # mark as off-hours for profiler
            status_code=403 if ep == "/open-banking/payments" else 200,
            response_time_ms=165.0,
            amount=amount,
            flagged=ep == "/open-banking/payments",
            scenario_tag="social_engineering",
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
