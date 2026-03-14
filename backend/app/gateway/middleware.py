"""
FraudFlow interceptor — runs before every Open Banking route.

Responsibilities:
  1. Read X-App-ID header to identify the calling app
  2. Look up the AppProfile and verify it is active
  3. Check the required permission scope is granted to the app
  4. Write an APICallLog record (flagged=True on scope mismatch)
  5. Raise HTTP 401/403 to block the request when checks fail

Usage (in route definitions):
    from app.gateway.middleware import require_scope

    @router.get("/accounts")
    def get_accounts(app: AppProfile = Depends(require_scope("accounts:read"))):
        ...
"""

import time
from datetime import datetime, timezone
from typing import Annotated, Callable

from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from app.database import get_session
from app.models import APICallLog, AppProfile

# ---------------------------------------------------------------------------
# Permission scope map — which scope each endpoint path requires
# ---------------------------------------------------------------------------

ENDPOINT_SCOPE_MAP: dict[str, str] = {
    "/open-banking/accounts":     "accounts:read",
    "/open-banking/transactions": "transactions:read",
    "/open-banking/payments":     "payments:write",
    "/open-banking/balances":     "balances:read",
    "/open-banking/consent":      "consent:write",
}


# ---------------------------------------------------------------------------
# Core interceptor logic
# ---------------------------------------------------------------------------

def _resolve_app(
    app_id: str,
    session: Session,
) -> AppProfile:
    """Look up and validate an app by app_id. Raises 401/403 on failure."""
    app = session.exec(
        select(AppProfile).where(AppProfile.app_id == app_id)
    ).first()

    if not app:
        raise HTTPException(status_code=401, detail=f"App '{app_id}' is not registered")

    if not app.is_active:
        raise HTTPException(status_code=403, detail=f"App '{app_id}' is suspended")

    return app


def _log_call(
    *,
    session: Session,
    app_id: str,
    endpoint: str,
    http_method: str,
    status_code: int,
    response_time_ms: float,
    flagged: bool,
    permission_scope_used: str = "",
    user_id: str | None = None,
    ip_address: str | None = None,
    amount: float | None = None,
    data_volume_kb: float = 0.0,
    scenario_tag: str | None = None,
) -> APICallLog:
    """Persist an APICallLog record and return it."""
    now = datetime.now(timezone.utc)
    log = APICallLog(
        app_id=app_id,
        endpoint=endpoint,
        http_method=http_method,
        status_code=status_code,
        response_time_ms=response_time_ms,
        flagged=flagged,
        time_of_day_hour=now.hour,
        permission_scope_used=permission_scope_used,
        data_volume_kb=data_volume_kb,
        scenario_tag=scenario_tag,
        user_id=user_id,
        ip_address=ip_address,
        amount=amount,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


# ---------------------------------------------------------------------------
# Dependency factory — call require_scope("accounts:read") in route definitions
# ---------------------------------------------------------------------------

def require_scope(required_scope: str) -> Callable:
    """
    Returns a FastAPI dependency that:
      - Authenticates the app via X-App-ID header
      - Checks it holds the required permission scope
      - Logs the attempt (flagged on scope mismatch)
      - Returns the resolved AppProfile on success
    """

    def dependency(
        request: Request,
        x_app_id: Annotated[str | None, Header()] = None,
        session: Session = Depends(get_session),
    ) -> AppProfile:
        start = time.monotonic()

        endpoint = request.url.path
        method = request.method
        ip = request.client.host if request.client else None

        # --- 1. Auth: X-App-ID header required ---
        if not x_app_id:
            raise HTTPException(
                status_code=401,
                detail="Missing X-App-ID header",
            )

        # --- 2. Resolve app (raises 401/403 if unknown or suspended) ---
        app = _resolve_app(x_app_id, session)

        elapsed_ms = (time.monotonic() - start) * 1000
        granted_scopes = [s.strip() for s in app.permissions.split(",") if s.strip()]

        # --- 3. Scope check ---
        if required_scope not in granted_scopes:
            _log_call(
                session=session,
                app_id=app.app_id,
                endpoint=endpoint,
                http_method=method,
                status_code=403,
                response_time_ms=elapsed_ms,
                flagged=True,
                permission_scope_used=required_scope,
                ip_address=ip,
            )
            raise HTTPException(
                status_code=403,
                detail=(
                    f"App '{app.app_id}' does not have required scope '{required_scope}'. "
                    f"Granted: {granted_scopes}"
                ),
            )

        # --- 4. All checks passed — log as allowed ---
        _log_call(
            session=session,
            app_id=app.app_id,
            endpoint=endpoint,
            http_method=method,
            status_code=200,
            response_time_ms=elapsed_ms,
            flagged=False,
            permission_scope_used=required_scope,
            ip_address=ip,
        )

        return app

    return dependency
