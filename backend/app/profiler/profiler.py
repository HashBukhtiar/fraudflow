"""
Profiler — generates RiskSignals from an AppProfile and its recent API calls.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from ..models import APICallLog, AppCategory, AppProfile, RiskSignals

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_PAYMENT_ENDPOINT = "/open-banking/payments"

# Categories that should never call the payments endpoint
_NON_PAYMENT_CATEGORIES = {
    AppCategory.BUDGETING,
    AppCategory.TAX,
    AppCategory.INVESTING,
}

# Benford's Law expected first-digit distribution
_BENFORD_EXPECTED: dict[int, float] = {
    d: math.log10(1 + 1 / d) for d in range(1, 10)
}

_HIGH_FREQ_THRESHOLD = 3    # calls per 5-minute window before high-frequency flag
_NEW_APP_AGE_HOURS    = 72  # less than this → new_app_risk
_MAX_PERMISSIONS      = 3   # more than this → excessive_permissions

# Payment structuring: amounts clustered just below round thresholds (e.g. $10k)
_STRUCTURING_BAND_LOW  = 8_000.0   # lower bound of suspicious band
_STRUCTURING_BAND_HIGH = 9_999.0   # upper bound (just under $10k reporting limit)
_STRUCTURING_MIN_COUNT = 3         # minimum payments in band to flag


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _benford_analysis(amounts: list[float]) -> tuple[float, float]:
    """Return (benford_score, benford_deviation).

    benford_score    — normalised 0-1 deviation (0 = perfect Benford match)
    benford_deviation — raw mean absolute deviation across 9 buckets
    """
    valid_amounts = [a for a in amounts if a is not None and a > 0]
    if len(valid_amounts) < 5:
        return 0.0, 0.0

    counts: dict[int, int] = {d: 0 for d in range(1, 10)}
    for amt in valid_amounts:
        # Take first significant digit
        first = int(str(abs(amt)).lstrip("0").replace(".", "")[0])
        if 1 <= first <= 9:
            counts[first] += 1

    total = sum(counts.values())
    if total < 5:
        return 0.0, 0.0

    observed = {d: counts[d] / total for d in range(1, 10)}
    deviation = sum(abs(observed[d] - _BENFORD_EXPECTED[d]) for d in range(1, 10)) / 9
    # Max possible mean deviation is ~0.3; clamp normalised score to [0, 1]
    benford_score = min(deviation / 0.3, 1.0)
    return round(benford_score, 4), round(deviation, 4)


def _payment_structuring_score(amounts: list[float]) -> float:
    """Detect payment-structuring pattern: multiple amounts clustered just below
    a round reporting threshold (e.g. $8,000–$9,999 mimicking sub-$10k structuring).

    Returns a normalised 0–1 score:
      0.0  — fewer than _STRUCTURING_MIN_COUNT payments in the suspicious band
      0.5  — minimum threshold met
      1.0  — all payments fall in the suspicious band
    """
    if not amounts:
        return 0.0

    in_band = [a for a in amounts if _STRUCTURING_BAND_LOW <= a <= _STRUCTURING_BAND_HIGH]
    if len(in_band) < _STRUCTURING_MIN_COUNT:
        return 0.0

    # Score scales with the fraction of payments in the band
    fraction = len(in_band) / len(amounts)
    # Clamp: minimum 0.5 once threshold is met, maximum 1.0
    return round(min(0.5 + 0.5 * fraction, 1.0), 4)


def _call_rate_per_minute(calls: list[APICallLog], window_minutes: int = 5) -> float:
    """Return the peak call rate (calls per minute) observed within the calls.

    Rather than anchoring to wall-clock *now* (which makes historical/seeded
    calls invisible), we find the densest `window_minutes`-wide slice within
    the calls themselves.  This correctly detects bursts in both live and
    replayed/demo traffic.
    """
    if not calls:
        return 0.0

    # Normalise timestamps to UTC-aware
    def _utc(ts: datetime) -> datetime:
        return ts if ts.tzinfo is not None else ts.replace(tzinfo=timezone.utc)

    timestamps = sorted(_utc(c.timestamp) for c in calls)

    if len(timestamps) == 1:
        return round(1 / window_minutes, 2)

    window = timedelta(minutes=window_minutes)
    max_count = 0
    j = 0
    for i, t_start in enumerate(timestamps):
        while j < len(timestamps) and timestamps[j] - t_start <= window:
            j += 1
        max_count = max(max_count, j - i)

    return round(max_count / window_minutes, 2)


def _off_hours_ratio(calls: list[APICallLog]) -> float:
    """Fraction of calls where the local hour is between 00:00 and 05:59."""
    if not calls:
        return 0.0
    off = sum(1 for c in calls if 0 <= c.timestamp.hour <= 5)
    return round(off / len(calls), 4)


def _unusual_endpoint_ratio(app: AppProfile, calls: list[APICallLog]) -> float:
    """Fraction of calls that represent a category–endpoint scope mismatch.

    Rule: budgeting / tax / investing apps must not call /open-banking/payments.
    """
    if not calls or app.category not in _NON_PAYMENT_CATEGORIES:
        return 0.0
    mismatched = sum(1 for c in calls if _PAYMENT_ENDPOINT in c.endpoint)
    return round(mismatched / len(calls), 4)


def _permission_scope_count(app: AppProfile) -> int:
    if not app.permissions or not app.permissions.strip():
        return 0
    return len([p for p in app.permissions.split(",") if p.strip()])


def _app_age_hours(app: AppProfile) -> float:
    now = datetime.now(timezone.utc)
    registered = app.registered_at
    if registered.tzinfo is None:
        registered = registered.replace(tzinfo=timezone.utc)
    return (now - registered).total_seconds() / 3600


def _composite_risk_score(
    *,
    benford_score: float,
    call_rate_per_minute: float,
    off_hours_ratio: float,
    unusual_endpoint_ratio: float,
    app_age_hours: float,
    excessive_permissions: bool,
    trust_score: float,
) -> float:
    """Weighted sum of normalised signals, scaled to 0–10."""

    # Normalise call rate: saturates at _HIGH_FREQ_THRESHOLD calls/min
    call_rate_norm = min(call_rate_per_minute / _HIGH_FREQ_THRESHOLD, 1.0)

    new_app = 1.0 if app_age_hours < _NEW_APP_AGE_HOURS else 0.0

    # trust_score is 0–10 (per AppProfile field constraint le=10.0); normalise
    # to 0–1 before inverting so high trust → low risk contribution
    low_trust = 1.0 - min(max(trust_score / 10.0, 0.0), 1.0)

    weights = {
        "unusual_endpoint": 6.0,   # hardest signal: non-payment app calling payments
        "off_hours":        4.0,   # sustained overnight access is strongly suspicious
        "high_frequency":   2.0,   # burst rate (threshold = 3 calls/min)
        "benford":          2.0,   # numeric anomaly / structuring pattern
        "new_app":          2.0,
        "excessive_perms":  1.5,
        "low_trust":        2.0,
    }

    raw = (
        weights["unusual_endpoint"] * unusual_endpoint_ratio
        + weights["off_hours"]      * off_hours_ratio
        + weights["high_frequency"] * call_rate_norm
        + weights["benford"]        * benford_score
        + weights["new_app"]        * new_app
        + weights["excessive_perms"] * (1.0 if excessive_permissions else 0.0)
        + weights["low_trust"]      * low_trust
    )

    max_raw = sum(weights.values())
    return round((raw / max_raw) * 10.0, 2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_risk_signals(
    app: AppProfile,
    recent_calls: list[APICallLog],
) -> RiskSignals:
    """Evaluate fraud risk for *app* given its *recent_calls*.

    Returns an unsaved RiskSignals instance — the caller is responsible for
    persisting it to the database.
    """
    amounts = [c.amount for c in recent_calls if c.amount is not None]

    benford_score, benford_deviation = _benford_analysis(amounts)
    # Combine Benford anomaly with structuring pattern — both measure numeric
    # financial irregularity.  Take the maximum so either signal can elevate risk.
    structuring_score = _payment_structuring_score(amounts)
    effective_benford = max(benford_score, structuring_score)

    rate        = _call_rate_per_minute(recent_calls)
    off_hours   = _off_hours_ratio(recent_calls)
    unusual     = _unusual_endpoint_ratio(app, recent_calls)
    age_hours   = _app_age_hours(app)
    perm_count  = _permission_scope_count(app)
    excessive   = perm_count > _MAX_PERMISSIONS

    composite = _composite_risk_score(
        benford_score=effective_benford,
        call_rate_per_minute=rate,
        off_hours_ratio=off_hours,
        unusual_endpoint_ratio=unusual,
        app_age_hours=age_hours,
        excessive_permissions=excessive,
        trust_score=app.trust_score,
    )

    return RiskSignals(
        app_id=app.app_id,
        benford_score=effective_benford,
        benford_deviation=benford_deviation,
        call_rate_per_minute=rate,
        off_hours_ratio=off_hours,
        unusual_endpoint_ratio=unusual,
        app_age_hours=round(age_hours, 2),
        permission_scope_count=perm_count,
        excessive_permissions=excessive,
        composite_risk_score=composite,
    )


# ---------------------------------------------------------------------------
# Quick smoke-test — python -m backend.app.profiler.profiler
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    """
    Smoke-test using call patterns that mirror scenarios.py exactly.

    Expected outcomes (matched to Claude system-prompt verdict thresholds):
      BudgetBuddy → composite >= 6.0  → BLOCK
      QuickPay    → composite 3.5–5.9 → FLAG
      TaxEasy     → composite >= 5.0 + new_app + mismatch → BLOCK
    """
    now = datetime.now(timezone.utc)
    today_2am = now.replace(hour=2, minute=0, second=0, microsecond=0)

    # --- Seed apps (matching seed.py values) --------------------------------

    budget_buddy = AppProfile(
        app_id="budgetbuddy",
        name="BudgetBuddy",
        category=AppCategory.BUDGETING,
        permissions="accounts:read,transactions:read,balances:read",  # 3 scopes
        registered_at=now - timedelta(days=180),
        trust_score=8.5,
        is_active=True,
    )

    quick_pay = AppProfile(
        app_id="quickpay",
        name="QuickPay",
        category=AppCategory.PAYMENTS,
        permissions="payments:write,balances:read,accounts:read",  # 3 scopes
        registered_at=now - timedelta(days=180),
        trust_score=5.0,
        is_active=True,
    )

    tax_easy = AppProfile(
        app_id="taxeasy",
        name="TaxEasy",
        category=AppCategory.TAX,
        permissions=(
            "accounts:read,transactions:read,balances:read,"
            "payments:write,consent:write,personal_info:read"
        ),  # 6 scopes → excessive
        registered_at=now - timedelta(hours=48),   # new_app_risk = True
        trust_score=1.5,
        is_active=True,
    )

    # --- Call logs matching scenarios.py seed patterns ----------------------

    # Scenario 1 — BudgetBuddy: 15 overnight payments (scope mismatch + benford)
    s1_amounts = [
        540.0, 521.0, 567.0, 589.0, 512.0,
        534.0, 578.0, 523.0, 556.0, 591.0,
        543.0, 507.0, 568.0, 519.0, 545.0,
    ]
    budget_calls = [
        APICallLog(
            app_id="budgetbuddy",
            endpoint="/open-banking/payments",
            http_method="POST",
            timestamp=today_2am + timedelta(minutes=i * 8),
            status_code=200,
            response_time_ms=140.0,
            amount=s1_amounts[i],
        )
        for i in range(15)
    ]

    # Scenario 2 — QuickPay: 8 structuring payments at 2am within 3 min
    s2_amounts = [9800.0, 9750.0, 9900.0, 9850.0, 9820.0, 9780.0, 9920.0, 9870.0]
    quick_calls = [
        APICallLog(
            app_id="quickpay",
            endpoint="/open-banking/payments",
            http_method="POST",
            timestamp=today_2am + timedelta(seconds=i * 20),
            status_code=200,
            response_time_ms=95.0,
            amount=s2_amounts[i],
        )
        for i in range(8)
    ]

    # Scenario 3 — TaxEasy: new app mixing payments + accounts + transactions
    s3_pattern = [
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
    tax_calls = [
        APICallLog(
            app_id="taxeasy",
            endpoint=ep,
            http_method=method,
            timestamp=(
                now.replace(hour=3, minute=offset, second=0, microsecond=0)
                if offset < 5
                else now - timedelta(minutes=offset)
            ),
            status_code=200,
            response_time_ms=165.0,
            amount=amount,
        )
        for ep, method, offset, amount in s3_pattern
    ]

    # --- Evaluate and print results ------------------------------------------

    scenarios = [
        ("BudgetBuddy (expect: BLOCK ≥6.0)",  budget_buddy, budget_calls),
        ("QuickPay    (expect: FLAG  3.5–5.9)", quick_pay,   quick_calls),
        ("TaxEasy     (expect: BLOCK new+mismatch)", tax_easy, tax_calls),
    ]

    for label, app, calls in scenarios:
        signals = generate_risk_signals(app, calls)
        print(f"\n{'=' * 62}")
        print(f"  {label}")
        print(f"{'=' * 62}")
        print(f"  composite_risk_score   : {signals.composite_risk_score} / 10")
        print(f"  call_rate_per_minute   : {signals.call_rate_per_minute}")
        print(f"  off_hours_ratio        : {signals.off_hours_ratio}")
        print(f"  unusual_endpoint_ratio : {signals.unusual_endpoint_ratio}")
        print(f"  app_age_hours          : {signals.app_age_hours:.1f}h  "
              f"(new_app={'YES' if signals.app_age_hours < _NEW_APP_AGE_HOURS else 'no'})")
        print(f"  permission_scope_count : {signals.permission_scope_count}  "
              f"(excessive={'YES' if signals.excessive_permissions else 'no'})")
        print(f"  benford_score          : {signals.benford_score}")
        print(f"  benford_deviation      : {signals.benford_deviation}")
