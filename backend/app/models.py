from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


# --- Enums ---

class Verdict(str, Enum):
    ALLOW = "ALLOW"
    FLAG = "FLAG"
    BLOCK = "BLOCK"


class TrustLevel(str, Enum):
    NEW = "NEW"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class AppCategory(str, Enum):
    BUDGETING = "budgeting"
    PAYMENTS = "payments"
    TAX = "tax"
    LENDING = "lending"
    INVESTING = "investing"
    OTHER = "other"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


# --- AppProfile ---

class AppProfile(SQLModel, table=True):
    """Registered third-party fintech app with trust metadata."""

    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: str = Field(index=True, unique=True)
    name: str
    category: AppCategory = Field(default=AppCategory.OTHER)
    description: str = ""
    registered_at: datetime = Field(default_factory=datetime.utcnow)
    trust_score: float = Field(default=1.0, ge=0.0, le=10.0)
    trust_level: TrustLevel = Field(default=TrustLevel.NEW)
    permissions: str = Field(default="")  # comma-separated permission scopes
    is_active: bool = Field(default=True)

    call_logs: list["APICallLog"] = Relationship(back_populates="app")
    fraud_decisions: list["FraudDecision"] = Relationship(back_populates="app")


# --- APICallLog ---

class APICallLog(SQLModel, table=True):
    """Record of every API call a third-party app makes to the gateway."""

    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: str = Field(foreign_key="appprofile.app_id", index=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    endpoint: str
    http_method: str = Field(default="GET")
    status_code: int
    response_time_ms: float
    amount: Optional[float] = Field(default=None)       # dollar amount if relevant
    user_id: Optional[str] = Field(default=None)        # end-user being acted on
    ip_address: Optional[str] = Field(default=None)
    flagged: bool = Field(default=False)

    # Telemetry enrichment fields (Feature 3)
    time_of_day_hour: int = Field(default=0)            # 0–23, derived from timestamp
    permission_scope_used: str = Field(default="")      # scope checked on this call
    data_volume_kb: float = Field(default=0.0)          # response size stub (populated later)
    scenario_tag: Optional[str] = Field(default=None)   # set by demo orchestrator

    app: Optional[AppProfile] = Relationship(back_populates="call_logs")


# --- RiskSignals ---

class RiskSignals(SQLModel, table=True):
    """Output of the profiler for a given app at a point in time."""

    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: str = Field(foreign_key="appprofile.app_id", index=True)
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

    # Benford's Law analysis
    benford_score: float = Field(default=0.0, ge=0.0, le=1.0)
    benford_deviation: float = Field(default=0.0, ge=0.0)

    # Rate / volume flags
    call_rate_per_minute: float = Field(default=0.0)
    off_hours_ratio: float = Field(default=0.0, ge=0.0, le=1.0)
    unusual_endpoint_ratio: float = Field(default=0.0, ge=0.0, le=1.0)

    # App age / permission signals
    app_age_hours: float = Field(default=0.0)
    permission_scope_count: int = Field(default=0)
    excessive_permissions: bool = Field(default=False)

    # Overall heuristic risk score (0–10)
    composite_risk_score: float = Field(default=0.0, ge=0.0, le=10.0)

    fraud_decision: Optional["FraudDecision"] = Relationship(
        back_populates="risk_signals"
    )


# --- FraudDecision ---

class FraudDecision(SQLModel, table=True):
    """LLM agent verdict on a specific risk evaluation."""

    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: str = Field(foreign_key="appprofile.app_id", index=True)
    risk_signals_id: Optional[int] = Field(
        default=None, foreign_key="risksignals.id"
    )
    decided_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    verdict: Verdict
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    recommended_action: str = ""
    memory_context_used: Optional[bool] = Field(default=None)

    app: Optional[AppProfile] = Relationship(back_populates="fraud_decisions")
    risk_signals: Optional[RiskSignals] = Relationship(
        back_populates="fraud_decision"
    )


# --- AlertEvent ---

class AlertEvent(SQLModel, table=True):
    """Audit record of a significant fraud detection event."""

    id: Optional[int] = Field(default=None, primary_key=True)
    app_id: str = Field(foreign_key="appprofile.app_id", index=True)
    fraud_decision_id: Optional[int] = Field(
        default=None, foreign_key="frauddecision.id"
    )
    triggered_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    title: str                                        # short headline
    description: str = ""                            # full human-readable detail
    severity: AlertSeverity = Field(default=AlertSeverity.INFO)
    verdict: Verdict                                 # mirrors the decision verdict
    resolved: bool = Field(default=False)
