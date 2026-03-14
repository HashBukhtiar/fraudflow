# FraudFlow — CLAUDE.md

## Overview
FraudFlow is an AI fraud detection middleware for Canada’s Open Banking future.

It sits between a simulated bank Open Banking API and third-party fintech apps. It detects suspicious app behavior such as:
- wrong permission usage
- abnormal overnight access
- unusual request frequency
- risky payment initiation
- behavior inconsistent with app category

## MVP Goal
End-to-end demo flow:
1. Third-party app calls mock Open Banking API
2. FraudFlow logs the call
3. Profiler generates risk signals
4. Memory layer checks past patterns
5. AI decision engine returns APPROVE / FLAG / BLOCK
6. Consumer and analyst dashboards update

## Stack
- Backend: Python 3.11 + FastAPI
- Frontend: React + Vite + Tailwind + shadcn/ui
- Data: SQLite + SQLModel
- Memory: Moorcheh
- AI: Use claude-haiku-4-5-20251001 via the Anthropic SDK. API key is in .env as ANTHROPIC_API_KEY.

## Project Structure
fraudflow/
- CLAUDE.md
- backend/
  - main.py
  - app/
    - gateway/
    - profiler/
    - memory/
    - agent/
    - models.py
- frontend/
  - src/
    - api/
    - views/
      - ConsumerDashboard/
      - AnalystDashboard/

## Core Features
1. App Registry
- Seed third-party apps with category, permissions, registration date, trust score, status

2. Simulated Open Banking Gateway
- Mock routes for accounts, transactions, payments
- Every call must pass through FraudFlow

3. API Call Logging
- Log app_id, user_id, endpoint, timestamp, data volume, permission scope, allowed/blocked

4. Rule-Based Profiler
- Generate risk signals from:
  - scope mismatch
  - overnight access
  - high frequency access
  - endpoint-category mismatch
  - new app risk

5. Memory Lookup
- Check if similar suspicious behavior has been seen before
- Return short context for the decision engine

6. AI Decision Engine
- Input: app profile + risk signals + memory context
- Output: verdict, confidence, explanation, recommended action

7. Action Layer
- Support allow, flag, block

8. Consumer Dashboard
- Show connected apps, trust scores, permissions, recent alerts

9. Analyst Dashboard
- Show recent API activity, suspicious apps, decisions, event drill-down

10. Demo Scenarios
- Scenario 1: rogue budgeting app
- Scenario 2: suspicious payment request
- Scenario 3: social-engineering tax app

## Shared Models
Use `backend/app/models.py` as the single source of truth.

Core models:
- AppProfile
- APICallLog
- RiskSignals
- FraudDecision
- AlertEvent

Do not change model shapes without team agreement.

## Seed Apps (data/seeds/apps.json)
Three apps minimum:
- BudgetBuddy (category: budgeting, trust_score: 0.85, status: active)
- QuickPay (category: payments, trust_score: 0.40, status: flagged)  
- TaxEasy (category: tax, trust_score: 0.10, status: active, 
    registered 2 days ago)
These are the three demo scenario apps. Do not rename them.

## Model Field Specs

AppProfile: id, name, category, permissions_requested (list), 
  registration_date, trust_score (float 0-1), status (active/suspended)

APICallLog: id, app_id, user_id, endpoint, timestamp, time_of_day_hour,
  data_volume_kb, permission_scope_used, allowed (bool), scenario_tag

RiskSignals: app_id, scope_mismatch (bool), overnight_access (bool),
  high_frequency (bool), endpoint_category_mismatch (bool), new_app_risk (bool),
  benford_deviation_score (float), overall_risk_score (float)

FraudDecision: id, app_id, verdict (APPROVE/FLAG/BLOCK), confidence (float),
  explanation (str), recommended_action (str), timestamp, memory_context_used (bool)

AlertEvent: id, app_id, decision_id, severity (low/medium/high), 
  message (str), timestamp, seen (bool)

## Module Ownership
- backend/app/gateway/ → Person A only
- backend/app/profiler/ → Person B only
- backend/app/memory/ → Person B only
- backend/app/agent/ → Person B only
- frontend/src/ → Person C only
- backend/app/models.py → all three must agree before changing

## API Contracts
Frontend depends on:
- GET /api/apps
- GET /api/apps/{app_id}/calls
- GET /api/alerts
- GET /api/decisions
- POST /api/demo/trigger/{scenario}

Mock Open Banking routes:
- GET /open-banking/accounts
- GET /open-banking/transactions
- POST /open-banking/payments

## Out of Scope
Do not build first:
- LangGraph
- heavy ML pipelines
- Isolation Forest as the core engine
- full auth
- real bank integrations
- advanced production infra

## Code Rules
- Use type hints
- Use shared models from models.py
- Keep backend modules separate
- Frontend should fetch through one API client
- No silent contract changes

## Done Looks Like
- Gateway logs every request
- Profiler returns RiskSignals
- Memory returns context
- Agent returns FraudDecision
- Dashboards render real backend data
- All 3 demo scenarios work cleanly

## Build Order
1. models.py
2. seed data
3. gateway routes
4. logging
5. profiler
6. memory
7. agent
8. action layer
9. consumer dashboard
10. analyst dashboard
11. scenario triggers
12. polish

## Running Locally
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
# runs on port 5173

# Seed data
python backend/data/seed.py