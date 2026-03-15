import axios from 'axios'
import type { AppProfile, APICallLog, AlertEvent, FraudDecision, RiskSignals } from './types'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

export const getApps = () =>
  api.get<AppProfile[]>('/api/apps').then((r) => r.data)

export const getAppCalls = (appId: string) =>
  api.get<APICallLog[]>(`/api/apps/${appId}/calls`).then((r) => r.data)

export const getAlerts = () =>
  api.get<AlertEvent[]>('/api/alerts').then((r) => r.data)

export const getDecisions = () =>
  api.get<FraudDecision[]>('/api/decisions').then((r) => r.data)

export const getProfile = (appId: string) =>
  api.get<RiskSignals>(`/api/profile/${appId}`).then((r) => r.data)

export const triggerScenario = (scenario: string) =>
  api.post<FraudDecision>(`/api/demo/trigger/${scenario}`).then((r) => r.data)

// Attacker view helpers

export interface AppStatus {
  app_id: string
  trust_score: number
  last_verdict: string | null
  is_blocked: boolean
  block_reason: string | null
}

export const getAppStatus = (appId: string) =>
  api.get<AppStatus>(`/api/apps/${appId}/status`).then((r) => r.data)

export const resetApp = (appId: string) =>
  api.delete<{ reset: boolean; app_id: string }>(`/api/apps/${appId}/reset`).then((r) => r.data)

export const callOpenBanking = (path: string, opts?: { method?: string; body?: unknown; appId?: string }) => {
  const headers: Record<string, string> = {}
  if (opts?.appId) headers['X-App-ID'] = opts.appId
  if (opts?.method === 'POST') {
    return api.post(path, opts?.body ?? {}, { headers })
  }
  return api.get(path, { headers })
}

export default api
