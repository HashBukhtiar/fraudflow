"""
Profiler — generates RiskSignals from an AppProfile and its recent API calls.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from ..models import APICallLog, AppCategory, AppProfile, RiskSignals
from ..constants import (
    NEW_APP_AGE_HOURS,
    HIGH_FREQ_CALLS_PER_MIN,
    MAX_PERMISSIONS_BEFORE_FLAG,
    STRUCTURING_BAND_LOW,
    STRUCTURING_BAND_HIGH,
    STRUCTURING_MIN_COUNT,
    BENFORD_NORMALISATION_DIVISOR,
    BENFORD_MIN_SAMPLE_SIZE,
    OFF_HOURS_START,
    OFF_HOURS_END,
    WEIGHT_UNUSUAL_ENDPOINT,
    WEIGHT_OFF_HOURS,
    WEIGHT_HIGH_FREQUENCY,
    WEIGHT_BENFORD,
    WEIGHT_NEW_APP,
    WEIGHT_EXCESSIVE_PERMS,
    WEIGHT_LOW_TRUST,
    COMPOSITE_SCORE_SCALE,
)

# ---------------------------------------------------------------------------
# Module-level domain constants (not tunable — pure domain knowledge)
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


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _benford_analysis(amounts: list[float]) -> tuple[float, float]:
    """Return (benford_score, benford_deviation).

    benford_score    — normalised 0-1 deviation (0 = perfect Benford match)
    benford_deviation — raw mean absolute deviation across 9 buckets
    """
    valid_amounts = [a for a in amounts if a is not None and a > 0]
    if len(valid_amounts) < BENFORD_MIN_SAMPLE_SIZE:
        return 0.0, 0.0

    counts: dict[int, int] = {d: 0 for d in range(1, 10)}
    for amt in valid_amounts:
        # Take first significant digit
        first = int(str(abs(amt)).lstrip("0").replace(".", "")[0])
        if 1 <= first <= 9:
            counts[first] += 1

    total = sum(counts.values())
    if total < BENFORD_MIN_SAMPLE_SIZE:
        return 0.0, 0.0

    observed = {d: counts[d] / total for d in range(1, 10)}
    deviation = sum(abs(observed[d] - _BENFORD_EXPECTED[d]) for d in range(1, 10)) / 9
    # Clamp normalised score to [0, 1] using the theoretical max deviation
    benford_score = min(deviation / BENFORD_NORMALISATION_DIVISOR, 1.0)
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

    in_band = [a for a in amounts if STRUCTURING_BAND_LOW <= a <= STRUCTURING_BAND_HIGH]
    if len(in_band) < STRUCTURING_MIN_COUNT:
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
    """Fraction of calls where the local hour is between OFF_HOURS_START and OFF_HOURS_END."""
    if not calls:
        return 0.0
    off = sum(1 for c in calls if OFF_HOURS_START <= c.timestamp.hour <= OFF_HOURS_END)
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

    # Normalise call rate: saturates at HIGH_FREQ_CALLS_PER_MIN calls/min
    call_rate_norm = min(call_rate_per_minute / HIGH_FREQ_CALLS_PER_MIN, 1.0)

    new_app = 1.0 if app_age_hours < NEW_APP_AGE_HOURS else 0.0

    # trust_score is 0–10 (per AppProfile field constraint le=10.0); normalise
    # to 0–1 before inverting so high trust → low risk contribution
    low_trust = 1.0 - min(max(trust_score / 10.0, 0.0), 1.0)

    weights = {
        "unusual_endpoint": WEIGHT_UNUSUAL_ENDPOINT,
        "off_hours":        WEIGHT_OFF_HOURS,
        "high_frequency":   WEIGHT_HIGH_FREQUENCY,
        "benford":          WEIGHT_BENFORD,
        "new_app":          WEIGHT_NEW_APP,
        "excessive_perms":  WEIGHT_EXCESSIVE_PERMS,
        "low_trust":        WEIGHT_LOW_TRUST,
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
    return round((raw / max_raw) * COMPOSITE_SCORE_SCALE, 2)


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
    excessive   = perm_count > MAX_PERMISSIONS_BEFORE_FLAG

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


