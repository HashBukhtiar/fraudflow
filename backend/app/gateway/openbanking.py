"""
Simulated Open Banking API Gateway.

Represents what a Canadian bank would expose to third-party fintech apps
under Open Banking regulations. Every route is protected by the FraudFlow
interceptor — calls are authenticated, scope-checked, and logged before
mock data is returned.

Routes:
  GET  /open-banking/accounts       requires: accounts:read
  GET  /open-banking/transactions   requires: transactions:read
  POST /open-banking/payments       requires: payments:write
  GET  /open-banking/balances       requires: balances:read
  POST /open-banking/consent        requires: consent:write
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.gateway.middleware import require_scope
from app.models import AppProfile

router = APIRouter(prefix="/open-banking", tags=["Open Banking Gateway"])


# ---------------------------------------------------------------------------
# Mock data — deterministic so demo scenarios are always predictable
# ---------------------------------------------------------------------------

MOCK_ACCOUNTS = [
    {
        "account_id": "acc_001",
        "owner": "Jane Doe",
        "type": "chequing",
        "institution": "TD Canada Trust",
        "currency": "CAD",
        "masked_number": "****4821",
    },
    {
        "account_id": "acc_002",
        "owner": "Jane Doe",
        "type": "savings",
        "institution": "TD Canada Trust",
        "currency": "CAD",
        "masked_number": "****9134",
    },
]

MOCK_BALANCES = [
    {"account_id": "acc_001", "available": 3_412.50, "current": 3_412.50, "currency": "CAD"},
    {"account_id": "acc_002", "available": 14_870.00, "current": 14_870.00, "currency": "CAD"},
]

# Amounts chosen to follow Benford's Law naturally — first digits skew toward 1-3
MOCK_TRANSACTIONS = [
    {"txn_id": "txn_001", "account_id": "acc_001", "date": "2025-03-01", "description": "Tim Hortons",           "amount": -4.75,    "type": "debit"},
    {"txn_id": "txn_002", "account_id": "acc_001", "date": "2025-03-02", "description": "Salary Deposit",        "amount": 2_850.00, "type": "credit"},
    {"txn_id": "txn_003", "account_id": "acc_001", "date": "2025-03-03", "description": "Loblaws",               "amount": -134.22,  "type": "debit"},
    {"txn_id": "txn_004", "account_id": "acc_001", "date": "2025-03-04", "description": "Netflix",               "amount": -17.99,   "type": "debit"},
    {"txn_id": "txn_005", "account_id": "acc_001", "date": "2025-03-05", "description": "E-Transfer Received",   "amount": 250.00,   "type": "credit"},
    {"txn_id": "txn_006", "account_id": "acc_001", "date": "2025-03-06", "description": "Hydro Ottawa",          "amount": -112.40,  "type": "debit"},
    {"txn_id": "txn_007", "account_id": "acc_001", "date": "2025-03-07", "description": "Amazon.ca",             "amount": -63.18,   "type": "debit"},
    {"txn_id": "txn_008", "account_id": "acc_001", "date": "2025-03-08", "description": "LCBO",                  "amount": -38.45,   "type": "debit"},
    {"txn_id": "txn_009", "account_id": "acc_001", "date": "2025-03-09", "description": "Shopify Payout",        "amount": 1_204.00, "type": "credit"},
    {"txn_id": "txn_010", "account_id": "acc_002", "date": "2025-03-10", "description": "Savings Transfer In",   "amount": 500.00,   "type": "credit"},
]


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class PaymentRequest(BaseModel):
    to_account: str
    amount: float
    description: str = ""


class ConsentRequest(BaseModel):
    scopes: list[str]
    duration_days: int = 90


# ---------------------------------------------------------------------------
# Routes — each uses require_scope() as a dependency
# ---------------------------------------------------------------------------

@router.get("/accounts")
def get_accounts(
    app: AppProfile = Depends(require_scope("accounts:read")),
) -> dict:
    """Return mock bank accounts for the authenticated user."""
    return {
        "app_id": app.app_id,
        "accounts": MOCK_ACCOUNTS,
        "total": len(MOCK_ACCOUNTS),
    }


@router.get("/transactions")
def get_transactions(
    app: AppProfile = Depends(require_scope("transactions:read")),
) -> dict:
    """Return mock transaction history."""
    return {
        "app_id": app.app_id,
        "transactions": MOCK_TRANSACTIONS,
        "total": len(MOCK_TRANSACTIONS),
    }


@router.post("/payments")
def initiate_payment(
    payload: PaymentRequest,
    app: AppProfile = Depends(require_scope("payments:write")),
) -> dict:
    """Simulate a payment initiation. Returns a mock confirmation."""
    return {
        "app_id": app.app_id,
        "payment_id": "pay_mock_001",
        "status": "PENDING",
        "to_account": payload.to_account,
        "amount": payload.amount,
        "currency": "CAD",
        "description": payload.description,
        "message": "Payment submitted for processing (simulated)",
    }


@router.get("/balances")
def get_balances(
    app: AppProfile = Depends(require_scope("balances:read")),
) -> dict:
    """Return mock account balances."""
    return {
        "app_id": app.app_id,
        "balances": MOCK_BALANCES,
    }


@router.post("/consent")
def grant_consent(
    payload: ConsentRequest,
    app: AppProfile = Depends(require_scope("consent:write")),
) -> dict:
    """Simulate a consent grant. Returns a mock consent token."""
    return {
        "app_id": app.app_id,
        "consent_id": "consent_mock_001",
        "status": "ACTIVE",
        "scopes_granted": payload.scopes,
        "duration_days": payload.duration_days,
        "token": "mock_consent_token_abc123",
        "message": "Consent granted (simulated)",
    }
