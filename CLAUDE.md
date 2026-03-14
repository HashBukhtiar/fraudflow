# FraudFlow — CLAUDE.md

## Project Overview
FraudFlow is an AI-powered fraud detection middleware layer for Canada's 
Open Banking ecosystem. It sits between a simulated TD Open Banking API 
gateway and third-party fintech apps, detecting anomalous app behavior 
using heuristics, Benford's Law analysis, Moorcheh memory, and LLM reasoning.

## Architecture
- **Backend**: Python 3 (latest version) + FastAPI (port 8000)
- **Frontend**: React (latest version) + Tailwind CSS + shadcn/ui (port 5173)
- **Memory**: Moorcheh Python SDK
- **AI**: Anthropic Claude API (claude-haiku-4-5-20251001)
- **Data**: SQLite via SQLModel for dev simplicity

## Module Ownership (DO NOT modify other modules without coordinating)
- `backend/app/gateway/` — Open Banking API simulation (Person A)
- `backend/app/profiler/` — Behavior profiling + Benford's Law (Person B)
- `backend/app/memory/` — Moorcheh integration (Person B)
- `backend/app/agent/` — LLM decision engine (Person B)
- `frontend/src/` — React dashboard (Person C)

## Shared Contracts (DO NOT change these without telling everyone)
All inter-module communication uses the models defined in 
`backend/app/models.py`. These are the source of truth.

Key models:
- `APICallLog` — every call a third-party app makes to the gateway
- `RiskSignals` — output of the profiler (Benford score, rate flags, etc.)
- `FraudDecision` — output of the agent (verdict, confidence, explanation)
- `AppProfile` — registered third-party app with trust score

## API Contracts (backend → frontend)
The frontend consumes these endpoints. Backend must implement exactly these:
- `GET /api/apps` — list all connected apps with trust scores
- `GET /api/apps/{app_id}/calls` — API call history for an app
- `GET /api/alerts` — recent FraudDecision events (FLAG or BLOCK)
- `POST /api/demo/trigger/{scenario}` — trigger demo scenario 1, 2, or 3
- `GET /api/apps/{app_id}/benford` — Benford deviation data for charting

## Demo Scenarios (seed data lives in data/seeds/)
- Scenario 1: `rogue_app` — budgeting app making calls at 3am, 
  wrong endpoints
- Scenario 2: `transaction_anomaly` — payment initiation with 
  mismatched user profile
- Scenario 3: `social_engineering` — app registered 48hrs ago, 
  excessive permissions, Benford deviation detected

## Environment Variables (see .env.example)
- `ANTHROPIC_API_KEY`
- `MOORCHEH_API_KEY`
- `DATABASE_URL` (defaults to sqlite:///./fraudflow.db)

## Code Conventions
- All backend functions must have type hints
- API responses always use the models from models.py, never raw dicts
- Frontend fetches always go through `src/api/client.ts` (single axios instance)
- No hardcoded strings — use constants files

## Running Locally
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload

# Frontend  
cd frontend && npm install && npm run dev
```

## What "Done" Looks Like Per Module
- Gateway: all 5 endpoints respond, every call writes an APICallLog to DB
- Profiler: given a list of APICallLogs, returns a RiskSignals object
- Agent: given RiskSignals + app context, returns a FraudDecision
- Frontend: consumer + analyst views render with mock data from /api endpoints