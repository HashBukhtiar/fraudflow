"""
Telemetry read endpoints — Feature 3: API Call Telemetry + Event Logging.

Routes:
  GET /api/calls                  → paginated call history, filterable by app_id / flagged
  GET /api/calls/stats            → aggregate counts (total, blocked, per-app, per-endpoint, hourly)
  GET /api/calls/live             → calls newer than ?since=<ISO-timestamp> for dashboard polling
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, func, select

from app.constants import API_DEFAULT_LIST_LIMIT
from app.database import get_session
from app.models import APICallLog

router = APIRouter(prefix="/api/calls", tags=["Telemetry"])


# ---------------------------------------------------------------------------
# Response shapes (plain dicts keep things simple for the dashboard layer)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# GET /api/calls
# ---------------------------------------------------------------------------

@router.get("", response_model=list[APICallLog])
def list_calls(
    app_id: Optional[str] = Query(default=None, description="Filter by app_id"),
    flagged: Optional[bool] = Query(default=None, description="Filter by flagged status"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
) -> list[APICallLog]:
    """
    Return recent API call logs, newest first.

    Supports optional filtering by `app_id` and `flagged`.
    Paginate using `limit` and `offset`.
    """
    query = select(APICallLog).order_by(APICallLog.timestamp.desc())  # type: ignore[arg-type]

    if app_id is not None:
        query = query.where(APICallLog.app_id == app_id)
    if flagged is not None:
        query = query.where(APICallLog.flagged == flagged)

    query = query.offset(offset).limit(limit)
    return list(session.exec(query).all())


# ---------------------------------------------------------------------------
# GET /api/calls/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
def call_stats(
    app_id: Optional[str] = Query(default=None, description="Scope stats to a single app"),
    session: Session = Depends(get_session),
) -> dict:
    """
    Aggregated telemetry statistics for the analyst dashboard.

    Returns:
      - total_calls / total_blocked / block_rate
      - per_app: {app_id: {total, blocked}}
      - per_endpoint: {endpoint: {total, blocked}}
      - hourly: {0..23: count}  — distribution of calls by UTC hour
    """
    base_query = select(APICallLog)
    if app_id:
        base_query = base_query.where(APICallLog.app_id == app_id)

    all_logs: list[APICallLog] = list(session.exec(base_query).all())

    total_calls = len(all_logs)
    total_blocked = sum(1 for l in all_logs if l.flagged)
    block_rate = round(total_blocked / total_calls, 4) if total_calls else 0.0

    # Per-app breakdown
    per_app: dict[str, dict] = {}
    for log in all_logs:
        bucket = per_app.setdefault(log.app_id, {"total": 0, "blocked": 0})
        bucket["total"] += 1
        if log.flagged:
            bucket["blocked"] += 1

    # Per-endpoint breakdown
    per_endpoint: dict[str, dict] = {}
    for log in all_logs:
        bucket = per_endpoint.setdefault(log.endpoint, {"total": 0, "blocked": 0})
        bucket["total"] += 1
        if log.flagged:
            bucket["blocked"] += 1

    # Hourly distribution (0–23 UTC)
    hourly: dict[int, int] = {h: 0 for h in range(24)}
    for log in all_logs:
        hourly[log.time_of_day_hour] += 1

    # Scope usage breakdown
    per_scope: dict[str, int] = {}
    for log in all_logs:
        if log.permission_scope_used:
            per_scope[log.permission_scope_used] = (
                per_scope.get(log.permission_scope_used, 0) + 1
            )

    return {
        "total_calls": total_calls,
        "total_blocked": total_blocked,
        "block_rate": block_rate,
        "per_app": per_app,
        "per_endpoint": per_endpoint,
        "hourly": hourly,
        "per_scope": per_scope,
    }


# ---------------------------------------------------------------------------
# GET /api/calls/live
# ---------------------------------------------------------------------------

@router.get("/live", response_model=list[APICallLog])
def live_calls(
    since: Optional[str] = Query(
        default=None,
        description=(
            "ISO-8601 UTC timestamp. Returns only calls newer than this value. "
            "If omitted, returns the most recent calls (bootstrap)."
        ),
    ),
    app_id: Optional[str] = Query(default=None, description="Filter by app_id"),
    session: Session = Depends(get_session),
) -> list[APICallLog]:
    """
    Polling endpoint for real-time dashboard updates.

    Frontend should:
      1. On load — call with no `since` to get the last 20 calls.
      2. Store the `timestamp` of the newest returned call.
      3. Poll every 2–3 s with `?since=<that timestamp>` to receive only deltas.

    Returns results oldest-first so the UI can append in order.
    """
    query = select(APICallLog)

    if since is not None:
        # Accept both offset-aware and naive ISO strings
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            since_dt = datetime.fromisoformat(since)
        # Normalise to naive UTC for comparison with DB values
        if since_dt.tzinfo is not None:
            since_dt = since_dt.replace(tzinfo=None)
        query = query.where(APICallLog.timestamp > since_dt)
    
    if app_id is not None:
        query = query.where(APICallLog.app_id == app_id)

    if since is None:
        # Bootstrap: return the most recent calls, oldest-first
        query = query.order_by(APICallLog.timestamp.desc()).limit(API_DEFAULT_LIST_LIMIT)  # type: ignore[arg-type]
        results = list(session.exec(query).all())
        results.reverse()
        return results

    query = query.order_by(APICallLog.timestamp.asc())  # type: ignore[arg-type]
    return list(session.exec(query).all())
