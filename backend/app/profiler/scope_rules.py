"""
Scope-based risk rule engine — Feature 4: Permission Scope Mismatch Detection.

Checks two dimensions of suspicious permission behaviour:

  STATIC  — what permissions the app has registered vs what its category allows
  DYNAMIC — what endpoints the app has actually called vs what its category allows

Rules:
  1. scope_mismatch          — registered permissions contain out-of-category scopes
  2. excessive_permissions   — registered permission count exceeds category baseline
  3. unusual_endpoint_ratio  — ratio of actual calls to out-of-category endpoints
  4. new_app_risk             — app registered less than NEW_APP_AGE_HOURS ago
  5. permission_scope_count   — raw count of requested permissions (used in scoring)

Public API:
  evaluate_scope_signals(app, recent_calls) -> dict
      Returns a dict whose keys match RiskSignals fields (scope/permission subset only).
      Benford and call-rate fields are left at 0.0 — filled in by the full profiler.
"""

from datetime import datetime, timezone
from typing import Any

from app.models import APICallLog, AppCategory, AppProfile
from app.constants import NEW_APP_AGE_HOURS, EXCESSIVE_PERMISSIONS_BUFFER

# ---------------------------------------------------------------------------
# Category → set of scopes that are NORMAL for that app type
# ---------------------------------------------------------------------------

CATEGORY_ALLOWED_SCOPES: dict[AppCategory, set[str]] = {
    AppCategory.BUDGETING: {"accounts:read", "transactions:read", "balances:read"},
    AppCategory.PAYMENTS:  {"payments:write", "balances:read", "accounts:read"},
    AppCategory.TAX:       {"accounts:read", "transactions:read", "balances:read"},
    AppCategory.LENDING:   {"accounts:read", "balances:read", "transactions:read"},
    AppCategory.INVESTING: {"accounts:read", "balances:read", "transactions:read"},
    AppCategory.OTHER:     {"accounts:read"},
}

# Scope → endpoint path (for dynamic call analysis)
SCOPE_TO_ENDPOINT: dict[str, str] = {
    "accounts:read":     "/open-banking/accounts",
    "transactions:read": "/open-banking/transactions",
    "payments:write":    "/open-banking/payments",
    "balances:read":     "/open-banking/balances",
    "consent:write":     "/open-banking/consent",
}

# Endpoint path → scope (reverse map)
ENDPOINT_TO_SCOPE: dict[str, str] = {v: k for k, v in SCOPE_TO_ENDPOINT.items()}


# ---------------------------------------------------------------------------
# Rule 1 — Static scope mismatch
# ---------------------------------------------------------------------------

def check_scope_mismatch(app: AppProfile) -> tuple[bool, list[str]]:
    """
    Check whether any of the app's registered permissions fall outside
    what is expected for its declared category.

    Returns (mismatch_detected, list_of_unexpected_scopes).
    """
    allowed = CATEGORY_ALLOWED_SCOPES.get(app.category, set())
    granted = {s.strip() for s in app.permissions.split(",") if s.strip()}
    unexpected = granted - allowed
    return bool(unexpected), sorted(unexpected)


# ---------------------------------------------------------------------------
# Rule 2 — Excessive permissions (static)
# ---------------------------------------------------------------------------

def check_excessive_permissions(app: AppProfile) -> tuple[bool, int]:
    """
    Flag apps that registered significantly more scopes than their category needs.

    Returns (excessive_detected, permission_count).
    """
    allowed = CATEGORY_ALLOWED_SCOPES.get(app.category, set())
    granted = {s.strip() for s in app.permissions.split(",") if s.strip()}
    count = len(granted)
    excessive = count > len(allowed) + EXCESSIVE_PERMISSIONS_BUFFER
    return excessive, count


# ---------------------------------------------------------------------------
# Rule 3 — Unusual endpoint ratio (dynamic)
# ---------------------------------------------------------------------------

def check_unusual_endpoint_ratio(
    app: AppProfile,
    recent_calls: list[APICallLog],
) -> tuple[float, int, int]:
    """
    Analyse actual call history to find how often the app hit endpoints that
    are outside its category's allowed scope set.

    Returns (ratio, out_of_category_count, total_count).
    Ratio is 0.0 if there are no calls yet.
    """
    if not recent_calls:
        return 0.0, 0, 0

    allowed = CATEGORY_ALLOWED_SCOPES.get(app.category, set())
    allowed_endpoints = {SCOPE_TO_ENDPOINT[s] for s in allowed if s in SCOPE_TO_ENDPOINT}

    out_of_category = sum(
        1 for c in recent_calls
        if c.endpoint in ENDPOINT_TO_SCOPE and c.endpoint not in allowed_endpoints
    )
    total = len(recent_calls)
    ratio = round(out_of_category / total, 4) if total else 0.0
    return ratio, out_of_category, total


# ---------------------------------------------------------------------------
# Rule 4 — New app risk (static)
# ---------------------------------------------------------------------------

def check_new_app_risk(app: AppProfile) -> tuple[bool, float]:
    """
    Flag apps that registered very recently (within NEW_APP_AGE_HOURS).

    Returns (is_new, age_hours).
    """
    registered = app.registered_at
    # Normalise to offset-aware UTC
    if registered.tzinfo is None:
        registered = registered.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    age_hours = (now - registered).total_seconds() / 3600.0
    return age_hours < NEW_APP_AGE_HOURS, round(age_hours, 2)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def evaluate_scope_signals(
    app: AppProfile,
    recent_calls: list[APICallLog],
) -> dict[str, Any]:
    """
    Run all scope/permission rules against an app and its recent call history.

    Returns a dict whose keys align with RiskSignals model fields
    (scope/permission subset). Benford and rate fields are not touched here.

    Example output:
      {
        "app_id":                   "app_taxease",
        "scope_mismatch":           True,
        "unexpected_scopes":        ["consent:write", "payments:write"],
        "excessive_permissions":    True,
        "permission_scope_count":   6,
        "unusual_endpoint_ratio":   0.5,
        "new_app_risk":             True,
        "app_age_hours":            38.5,
      }
    """
    mismatch, unexpected_scopes = check_scope_mismatch(app)
    excessive, perm_count = check_excessive_permissions(app)
    ue_ratio, _, _ = check_unusual_endpoint_ratio(app, recent_calls)
    is_new, age_hours = check_new_app_risk(app)

    return {
        "app_id":                  app.app_id,
        # static signals
        "scope_mismatch":          mismatch,
        "unexpected_scopes":       unexpected_scopes,   # extra detail, not in RiskSignals model
        "excessive_permissions":   excessive,
        "permission_scope_count":  perm_count,
        # dynamic signals
        "unusual_endpoint_ratio":  ue_ratio,
        # age signal
        "new_app_risk":            is_new,
        "app_age_hours":           age_hours,
        # Benford / rate fields left at model defaults (filled by full profiler)
        "benford_score":           0.0,
        "benford_deviation":       0.0,
        "call_rate_per_minute":    0.0,
        "off_hours_ratio":         0.0,
    }
