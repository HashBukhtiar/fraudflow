"""
Seed data for FraudFlow demo scenarios.

Three apps are seeded — each maps to one of the three demo scenarios:
  - BudgetWise  → Scenario 1: rogue budgeting app
  - PaySwift    → Scenario 2: suspicious payment request
  - TaxEase     → Scenario 3: social-engineering tax app / data harvester
"""

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.database import engine
from app.models import AppCategory, AppProfile, TrustLevel


SEED_APPS: list[dict] = [
    {
        "app_id": "app_budgetwise",
        "name": "BudgetWise",
        "category": AppCategory.BUDGETING,
        "description": (
            "A personal budgeting app that connects to your bank to help you "
            "track spending and set savings goals."
        ),
        "registered_at": datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
        "trust_score": 8.5,
        "trust_level": TrustLevel.HIGH,
        # Legitimate budgeting scope — read-only account and transaction data
        "permissions": "accounts:read,transactions:read,balances:read",
        "is_active": True,
    },
    {
        "app_id": "app_payswift",
        "name": "PaySwift",
        "category": AppCategory.PAYMENTS,
        "description": (
            "A peer-to-peer payment app for splitting bills and sending money "
            "to friends and family."
        ),
        "registered_at": datetime(2024, 9, 15, 9, 30, 0, tzinfo=timezone.utc),
        "trust_score": 5.0,
        "trust_level": TrustLevel.MEDIUM,
        # Payments scope — initiation + balance check, no full transaction history
        "permissions": "payments:write,balances:read,accounts:read",
        "is_active": True,
    },
    {
        "app_id": "app_taxease",
        "name": "TaxEase",
        "category": AppCategory.TAX,
        "description": (
            "An AI-powered tax filing assistant that imports your financial data "
            "to auto-fill your return."
        ),
        # Registered only ~48 hours before demo — triggers new-app risk signal
        "registered_at": datetime(2025, 3, 12, 8, 0, 0, tzinfo=timezone.utc),
        "trust_score": 1.5,
        "trust_level": TrustLevel.NEW,
        # Excessive permissions: requesting payment initiation + full data
        # for a tax app — core red flag for Scenario 3
        "permissions": (
            "accounts:read,transactions:read,balances:read,"
            "payments:write,consent:write,personal_info:read"
        ),
        "is_active": True,
    },
]


def seed_apps(session: Session) -> None:
    """Insert seed apps if they do not already exist (idempotent)."""
    for app_data in SEED_APPS:
        existing = session.exec(
            select(AppProfile).where(AppProfile.app_id == app_data["app_id"])
        ).first()

        if existing:
            continue  # already seeded — skip

        app = AppProfile(**app_data)
        session.add(app)

    session.commit()


def run_seed() -> None:
    """Entry point called from FastAPI startup."""
    with Session(engine) as session:
        seed_apps(session)
