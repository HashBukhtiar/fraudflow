export interface AppProfile {
  id: string
  name: string
  category: string
  permissions_requested: string[]
  registration_date: string
  trust_score: number
  status: 'active' | 'suspended' | 'flagged'
}

export interface APICallLog {
  id: string
  app_id: string
  user_id: string
  endpoint: string
  timestamp: string
  time_of_day_hour: number
  data_volume_kb: number
  permission_scope_used: string
  allowed: boolean
  scenario_tag: string | null
}

export interface RiskSignals {
  app_id: string
  scope_mismatch: boolean
  overnight_access: boolean
  high_frequency: boolean
  endpoint_category_mismatch: boolean
  new_app_risk: boolean
  benford_deviation_score: number
  overall_risk_score: number
}

export interface FraudDecision {
  id: string
  app_id: string
  verdict: 'APPROVE' | 'FLAG' | 'BLOCK'
  confidence: number
  explanation: string
  recommended_action: string
  timestamp: string
  memory_context_used: boolean
}

export interface AlertEvent {
  id: string
  app_id: string
  decision_id: string
  severity: 'low' | 'medium' | 'high'
  message: string
  timestamp: string
  seen: boolean
}
