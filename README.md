# FraudFlow

AI-powered fraud detection middleware for Canada's Open Banking ecosystem. FraudFlow sits between Open Banking APIs and third-party fintech apps, analyzing every request in real time and returning an APPROVE / FLAG / BLOCK verdict.

Built for the **GenAI Genesis Hackathon**.

---

## What It Does

When a fintech app makes an API call, FraudFlow intercepts it and runs it through a multi-stage pipeline:

1. **Gateway** — Intercepts and logs every request from registered third-party apps
2. **Behaviour Profiler** — Generates risk signals (overnight access, scope mismatch, Benford's Law deviation, unusual endpoint usage, new-app risk)
3. **Memory Lookup** — Checks if similar suspicious patterns have been seen before
4. **AI Decision Engine** — Claude claude-haiku-4-5-20251001 reasons over the signals and returns a structured verdict
5. **Action Layer** — Enforces APPROVE / FLAG / BLOCK and fires alert events
6. **Dashboards** — Consumer and Analyst views surface the results in real time

---

## Project Structure

```
fraudflow/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   └── app/
│       ├── models.py            # Shared SQLModel data models (source of truth)
│       ├── database.py          # SQLite database setup
│       ├── seed.py              # Registers the initial app profiles
│       ├── constants.py         # Shared constants
│       ├── gateway/             # Open Banking routes + request interceptor
│       ├── profiler/            # Rule-based risk signal generator
│       ├── memory/              # Pattern memory
│       └── agent/               # Claude AI decision engine
├── frontend/
│   └── src/
│       ├── api/                 # Typed API client
│       ├── views/
│       │   ├── Landing/         # Home / entry page
│       │   ├── Demo/            # Live decision pipeline visualizer
│       │   ├── ConsumerDashboard/  # Connected apps, permissions, alerts
│       │   └── AnalystDashboard/   # API activity, suspicious apps, decisions
│       └── components/          # Shared UI components
└── CLAUDE.md                    # Architecture & contribution guide
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI, SQLModel, SQLite |
| AI | Anthropic Claude claude-haiku-4-5-20251001 via `anthropic` SDK |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ (or Bun)
- An Anthropic API key

### 1. Clone the repo

```bash
git clone <repo-url>
cd fraudflow
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Initialize app profiles

```bash
python app/seed.py
```

This registers the initial set of third-party apps: **BudgetBuddy** and **QuickPay**

### 5. Start the frontend

```bash
cd frontend
bun install
bun run dev
```

Frontend runs at `http://localhost:5173`. Backend API at `http://localhost:8000`.

---

## Scenarios

The **pipeline visualizer** lets you run pre-built fraud scenarios end-to-end. Each scenario simulates a realistic attack vector and animates the full decision pipeline in real time — gateway intercept, profiler signals, memory context, AI reasoning, and final verdict.

| Scenario | App | Signal Pattern | Outcome |
|---|---|---|---|
| Rogue Budgeting App | BudgetBuddy | 100% off-hours access, wrong endpoint category | **BLOCK** |
| Suspicious Payment Request | QuickPay | Benford's Law structuring detected, overnight payments | **BLOCK** |

---

## API Reference

### Scenario Execution

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/demo/trigger/{scenario}` | Run a scenario through the full pipeline |

### Apps

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/apps` | List all registered apps |
| `GET` | `/api/apps/{app_id}/calls` | Get call logs for an app |
| `GET` | `/api/profile/{app_id}` | Get latest RiskSignals for an app |

### Alerts & Decisions

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/alerts` | List all alert events |
| `GET` | `/api/decisions` | List all fraud decisions |

### Open Banking Gateway

| Method | Route | Description |
|---|---|---|
| `GET` | `/open-banking/accounts` | Accounts endpoint |
| `GET` | `/open-banking/transactions` | Transactions endpoint |
| `POST` | `/open-banking/payments` | Payment initiation endpoint |

---

## Data Models

All models live in `backend/app/models.py` and are the single source of truth.

| Model | Purpose |
|---|---|
| `AppProfile` | Registered third-party app with trust score and permissions |
| `APICallLog` | Record of every intercepted API call |
| `RiskSignals` | Profiler output: Benford score, off-hours ratio, composite risk score (0–10) |
| `FraudDecision` | AI verdict: `APPROVE` / `FLAG` / `BLOCK`, confidence, explanation |
| `AlertEvent` | Audit record of a significant detection event |

---
