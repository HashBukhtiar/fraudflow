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

_HIGH_FREQ_THRESHOLD = 10   # calls per 5-minute window
_NEW_APP_AGE_HOURS    = 72  # less than this → new_app_risk
_MAX_PERMISSIONS      = 3   # more than this → excessive_permissions


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


def _call_rate_per_minute(calls: list[APICallLog], window_minutes: int = 5) -> float:
    """Count calls in the last `window_minutes` and return calls-per-minute."""
    if not calls:
        return 0.0

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=window_minutes)

    recent = []
    for c in calls:
        ts = c.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts >= cutoff:
            recent.append(c)

    return round(len(recent) / window_minutes, 2)


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

    # trust_score is 0–1 in seed data; invert so high trust = low risk
    low_trust = 1.0 - min(max(trust_score, 0.0), 1.0)

    weights = {
        "unusual_endpoint": 2.5,
        "off_hours":        1.5,
        "high_frequency":   2.0,
        "benford":          1.0,
        "new_app":          1.0,
        "excessive_perms":  1.0,
        "low_trust":        1.0,
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
    rate        = _call_rate_per_minute(recent_calls)
    off_hours   = _off_hours_ratio(recent_calls)
    unusual     = _unusual_endpoint_ratio(app, recent_calls)
    age_hours   = _app_age_hours(app)
    perm_count  = _permission_scope_count(app)
    excessive   = perm_count > _MAX_PERMISSIONS

    composite = _composite_risk_score(
        benford_score=benford_score,
        call_rate_per_minute=rate,
        off_hours_ratio=off_hours,
        unusual_endpoint_ratio=unusual,
        app_age_hours=age_hours,
        excessive_permissions=excessive,
        trust_score=app.trust_score,
    )

    return RiskSignals(
        app_id=app.app_id,
        benford_score=benford_score,
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
    from datetime import timezone

    now = datetime.now(timezone.utc)

    # --- Seed apps (values match CLAUDE.md) ---------------------------------

    budget_buddy = AppProfile(
        app_id="budgetbuddy",
        name="BudgetBuddy",
        category=AppCategory.BUDGETING,
        permissions="read:accounts,read:transactions",          # 2 scopes — normal
        registered_at=now - timedelta(days=180),
        trust_score=0.85,
        is_active=True,
    )

    quick_pay = AppProfile(
        app_id="quickpay",
        name="QuickPay",
        category=AppCategory.PAYMENTS,
        permissions="read:accounts,write:payments,read:transactions,read:balance,admin",  # 5 scopes
        registered_at=now - timedelta(days=30),
        trust_score=0.40,
        is_active=True,
    )

    tax_easy = AppProfile(
        app_id="taxeasy",
        name="TaxEasy",
        category=AppCategory.TAX,
        permissions="read:accounts,read:transactions,write:payments",  # 3 scopes + payment mismatch
        registered_at=now - timedelta(days=2),   # new_app_risk = True
        trust_score=0.10,
        is_active=True,
    )

    # --- Mock call logs ------------------------------------------------------

    def _call(
        app_id: str,
        endpoint: str,
        hour: int = 14,
        amount: float | None = None,
        minutes_ago: int = 1,
    ) -> APICallLog:
        ts = now.replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(
            minutes=minutes_ago
        )
        return APICallLog(
            app_id=app_id,
            timestamp=ts,
            endpoint=endpoint,
            http_method="GET",
            status_code=200,
            response_time_ms=120.0,
            amount=amount,
        )

    # Scenario 1 — BudgetBuddy: normal daytime reads, no payment calls
    budget_calls = [
        _call("budgetbuddy", "/open-banking/accounts", hour=10, minutes_ago=i)
        for i in range(1, 6)
    ] + [
        _call("budgetbuddy", "/open-banking/transactions", hour=11, amount=float(i * 31))
        for i in range(1, 6)
    ]

    # Scenario 2 — QuickPay: high-frequency burst (12 calls in <5 min) + overnight
    quick_calls = [
        _call("quickpay", "/open-banking/payments", hour=2, amount=999.99 * i, minutes_ago=i)
        for i in range(1, 13)   # 12 calls → high_frequency
    ]

    # Scenario 3 — TaxEasy: new app, low trust, calls payments endpoint (scope mismatch)
    tax_calls = [
        _call("taxeasy", "/open-banking/payments", hour=3, amount=float(i * 100), minutes_ago=i)
        for i in range(1, 5)
    ] + [
        _call("taxeasy", "/open-banking/transactions", hour=14, amount=float(i * 57))
        for i in range(1, 5)
    ]

    # --- Evaluate and print results ------------------------------------------

    scenarios = [
        ("BudgetBuddy (expect: low risk)",   budget_buddy, budget_calls),
        ("QuickPay    (expect: high risk)",  quick_pay,    quick_calls),
        ("TaxEasy     (expect: high risk)",  tax_easy,     tax_calls),
    ]

    for label, app, calls in scenarios:
        signals = generate_risk_signals(app, calls)
        print(f"\n{'=' * 60}")
        print(f"  {label}")
        print(f"{'=' * 60}")
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
