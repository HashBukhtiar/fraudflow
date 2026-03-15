from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()                          # .env
load_dotenv(".env.local", override=True)  # .env.local wins if both exist

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import create_db_and_tables
from app.gateway import openbanking_router, registry_router, telemetry_router
from app.gateway.demo_routes import router as demo_router
from app.gateway.read_routes import router as read_router
from app.profiler.router import router as profiler_router
from app.seed import run_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB tables and seed data on startup."""
    create_db_and_tables()
    run_seed()
    yield


app = FastAPI(
    title="FraudFlow",
    description=(
        "AI fraud detection middleware for Canada's Open Banking future. "
        "Detects suspicious third-party app behaviour before damage happens."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the React dev server and any future production origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",  # Vite alternate port
        "http://localhost:3000",  # fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(registry_router)
app.include_router(openbanking_router)
app.include_router(telemetry_router)
app.include_router(profiler_router)
app.include_router(demo_router)
app.include_router(read_router)


@app.get("/health", tags=["Meta"])
def health_check() -> dict:
    """Simple liveness probe."""
    return {"status": "ok", "service": "fraudflow"}
