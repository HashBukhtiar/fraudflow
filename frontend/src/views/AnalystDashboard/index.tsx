import { useEffect, useState } from 'react'
import { getApps, getDecisions } from '@/api/client'
import api from '@/api/client'
import type { AppProfile, APICallLog, FraudDecision } from '@/api/types'
import RiskRankList from './RiskRankList'
import CallFeed from './CallFeed'
import DecisionDrawer from './DecisionDrawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const MOCK_APPS: AppProfile[] = [
  {
    id: 1,
    app_id: 'budgetbuddy',
    name: 'BudgetBuddy',
    category: 'budgeting',
    description: 'Personal budget tracking app',
    registered_at: '2024-06-15T00:00:00Z',
    trust_score: 8.5,
    trust_level: 'HIGH',
    permissions: 'read:accounts,read:transactions',
    is_active: true,
  },
  {
    id: 2,
    app_id: 'quickpay',
    name: 'QuickPay',
    category: 'payments',
    description: 'Fast payment processing',
    registered_at: '2024-11-02T00:00:00Z',
    trust_score: 4.0,
    trust_level: 'MEDIUM',
    permissions: 'read:accounts,write:payments,read:transactions',
    is_active: true,
  },
  {
    id: 3,
    app_id: 'taxeasy',
    name: 'TaxEasy',
    category: 'tax',
    description: 'Tax filing assistant',
    registered_at: '2026-03-12T00:00:00Z',
    trust_score: 1.0,
    trust_level: 'NEW',
    permissions: 'read:accounts,read:transactions,read:balances,write:consent',
    is_active: true,
  },
]

const MOCK_CALLS: APICallLog[] = [
  {
    id: 1, app_id: 'budgetbuddy', user_id: null,
    endpoint: '/open-banking/transactions', http_method: 'GET',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    status_code: 403, response_time_ms: 12, amount: null,
    ip_address: null, flagged: true, time_of_day_hour: 3,
    data_volume_kb: 0, permission_scope_used: 'write:payments', scenario_tag: 'rogue_budgeting_app',
  },
  {
    id: 2, app_id: 'quickpay', user_id: null,
    endpoint: '/open-banking/payments', http_method: 'POST',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    status_code: 403, response_time_ms: 10, amount: 9800,
    ip_address: null, flagged: true, time_of_day_hour: 2,
    data_volume_kb: 0, permission_scope_used: 'write:payments', scenario_tag: 'payment_anomaly',
  },
  {
    id: 3, app_id: 'taxeasy', user_id: null,
    endpoint: '/open-banking/accounts', http_method: 'GET',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    status_code: 200, response_time_ms: 80, amount: null,
    ip_address: null, flagged: false, time_of_day_hour: 14,
    data_volume_kb: 12, permission_scope_used: 'read:accounts', scenario_tag: null,
  },
]

const MOCK_DECISIONS: FraudDecision[] = [
  {
    id: 1, app_id: 'budgetbuddy', risk_signals_id: 1,
    decided_at: new Date(Date.now() - 60000).toISOString(),
    verdict: 'BLOCK', confidence: 0.94,
    explanation: 'BudgetBuddy attempted to initiate a payment — outside its declared budgeting scope. Overnight access at 3am combined with scope mismatch triggers an automatic block.',
    recommended_action: 'revoke_token',
  },
  {
    id: 2, app_id: 'taxeasy', risk_signals_id: 2,
    decided_at: new Date(Date.now() - 120000).toISOString(),
    verdict: 'BLOCK', confidence: 0.97,
    explanation: 'TaxEasy was registered 2 days ago and is requesting permissions far exceeding what a tax app requires. Benford deviation score suggests synthetic data patterns.',
    recommended_action: 'revoke_token',
  },
  {
    id: 3, app_id: 'quickpay', risk_signals_id: 3,
    decided_at: new Date(Date.now() - 300000).toISOString(),
    verdict: 'FLAG', confidence: 0.76,
    explanation: 'QuickPay is initiating high-value payments in rapid succession — a structuring pattern. Request flagged for manual review.',
    recommended_action: 'flag_for_review',
  },
]

const verdictColor: Record<FraudDecision['verdict'], string> = {
  ALLOW: 'bg-green-100 text-green-800',
  FLAG:  'bg-yellow-100 text-yellow-800',
  BLOCK: 'bg-red-100 text-red-800',
}

export default function AnalystDashboard() {
  const [apps, setApps] = useState<AppProfile[]>(MOCK_APPS)
  const [calls, setCalls] = useState<APICallLog[]>(MOCK_CALLS)
  const [decisions, setDecisions] = useState<FraudDecision[]>(MOCK_DECISIONS)
  const [selected, setSelected] = useState<FraudDecision | null>(null)

  useEffect(() => {
    Promise.all([
      getApps(),
      getDecisions(),
      api.get<APICallLog[]>('/api/calls', { params: { limit: 50 } }).then((r) => r.data),
    ])
      .then(([appsData, decisionsData, callsData]) => {
        setApps(appsData)
        setDecisions(decisionsData)
        setCalls(callsData)
      })
      .catch(() => {
        // backend not running — fall back to mock data
      })
  }, [])

  const blocked = decisions.filter((d) => d.verdict === 'BLOCK').length
  const flagged = decisions.filter((d) => d.verdict === 'FLAG').length
  const blockedCalls = calls.filter((c) => c.flagged).length

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analyst Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time view of third-party app activity and fraud decisions.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Blocked', value: blocked, color: 'text-red-600' },
          { label: 'Flagged', value: flagged, color: 'text-yellow-600' },
          { label: 'Blocked Calls', value: blockedCalls, color: 'text-red-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: call feed */}
        <div className="lg:col-span-2">
          <CallFeed calls={calls} apps={apps} />
        </div>

        {/* Right: risk rank */}
        <div>
          <RiskRankList apps={apps} />
        </div>
      </div>

      {/* Decisions table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Decisions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">App</th>
                <th className="text-left px-4 py-2 font-medium">Verdict</th>
                <th className="text-left px-4 py-2 font-medium">Confidence</th>
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => {
                const app = apps.find((a) => a.app_id === d.app_id)
                return (
                  <tr
                    key={d.id}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => setSelected(d)}
                  >
                    <td className="px-4 py-2 font-medium">{app?.name ?? d.app_id}</td>
                    <td className="px-4 py-2">
                      <span className={cn('px-1.5 py-0.5 rounded text-xs font-bold', verdictColor[d.verdict])}>
                        {d.verdict}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {Math.round(d.confidence * 100)}%
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(d.decided_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-primary">Details →</td>
                  </tr>
                )
              })}
              {decisions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                    No decisions yet. Run a demo scenario to generate one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <DecisionDrawer
        decision={selected}
        apps={apps}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
