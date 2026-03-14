// Mirrors backend/app/models.py — do not change field names without team agreement.

export type AppCategory = 'budgeting' | 'payments' | 'tax' | 'lending' | 'investing' | 'other'
export type TrustLevel = 'NEW' | 'LOW' | 'MEDIUM' | 'HIGH'
export type Verdict = 'ALLOW' | 'FLAG' | 'BLOCK'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AppProfile {
  id: number
  app_id: string
  name: string
  category: AppCategory
  description: string
  registered_at: string          // ISO datetime
  trust_score: number            // 0–10
  trust_level: TrustLevel
  permissions: string            // comma-separated scopes
  is_active: boolean
}

export interface APICallLog {
  id: number
  app_id: string
  timestamp: string              // ISO datetime
  endpoint: string
  http_method: string
  status_code: number
  response_time_ms: number
  amount: number | null
  user_id: string | null
  ip_address: string | null
  flagged: boolean
  time_of_day_hour: number       // 0–23
  permission_scope_used: string
  data_volume_kb: number
  scenario_tag: string | null
}

export interface RiskSignals {
  id: number
  app_id: string
  evaluated_at: string           // ISO datetime
  benford_score: number          // 0–1
  benford_deviation: number
  call_rate_per_minute: number
  off_hours_ratio: number        // 0–1
  unusual_endpoint_ratio: number // 0–1
  app_age_hours: number
  permission_scope_count: number
  excessive_permissions: boolean
  composite_risk_score: number   // 0–10
}

export interface FraudDecision {
  id: number
  app_id: string
  risk_signals_id: number | null
  decided_at: string             // ISO datetime
  verdict: Verdict
  confidence: number             // 0–1
  explanation: string
  recommended_action: string
}

export interface AlertEvent {
  id: number
  app_id: string
  fraud_decision_id: number | null
  triggered_at: string           // ISO datetime
  title: string
  description: string
  severity: AlertSeverity
  verdict: Verdict
  resolved: boolean
}
