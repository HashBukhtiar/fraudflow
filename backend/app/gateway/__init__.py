from app.gateway.openbanking import router as openbanking_router
from app.gateway.registry import router as registry_router
from app.gateway.telemetry import router as telemetry_router

__all__ = ["registry_router", "openbanking_router", "telemetry_router"]

