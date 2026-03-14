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

export default api
