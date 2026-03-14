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

const verdictConfig: Record<string, string> = {
  APPROVE: 'bg-primary/10 text-primary border-primary/20',
  ALLOW:   'bg-primary/10 text-primary border-primary/20',
  FLAG:    'bg-amber-500/10 text-amber-600 border-amber-500/20',
  BLOCK:   'bg-destructive/10 text-destructive border-destructive/20',
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
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

  const blocked      = decisions.filter((d) => d.verdict === 'BLOCK').length
  const flagged      = decisions.filter((d) => d.verdict === 'FLAG').length
  const blockedCalls = calls.filter((c) => c.flagged).length
  const totalCalls   = calls.length

  return (
    <div className="min-h-screen bg-background">
      {/* Internal tool header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* FraudFlow logo mark */}
            <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">FraudFlow</p>
              <p className="text-xs text-muted-foreground">Security Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live status */}
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-xs text-muted-foreground">Live</span>
            </div>

            {/* Analyst avatar */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center">
                <span className="text-xs font-semibold text-muted-foreground">SR</span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-tight">Sarah R.</p>
                <p className="text-xs text-muted-foreground">Fraud Analyst</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Page heading */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoring <span className="font-medium text-foreground">{apps.length} registered apps</span> across{' '}
            <span className="font-medium text-foreground">{totalCalls} API calls</span> today.
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn('text-3xl font-bold tabular-nums', blocked > 0 ? 'text-destructive' : 'text-foreground')}>
                    {blocked}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Blocked</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Requests fully blocked</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn('text-3xl font-bold tabular-nums', flagged > 0 ? 'text-amber-600' : 'text-foreground')}>
                    {flagged}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Flagged</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className={cn('text-3xl font-bold tabular-nums', blockedCalls > 0 ? 'text-destructive' : 'text-foreground')}>
                    {blockedCalls}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Blocked Calls</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {totalCalls > 0 ? `${Math.round((blockedCalls / totalCalls) * 100)}% of total traffic` : 'No traffic yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Feed + Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <CallFeed calls={calls} apps={apps} />
          </div>
          <div>
            <RiskRankList apps={apps} />
          </div>
        </div>

        {/* Decisions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Decisions</CardTitle>
              <span className="text-xs text-muted-foreground">{decisions.length} total</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">App</th>
                  <th className="text-left px-4 py-2.5 font-medium">Verdict</th>
                  <th className="text-left px-4 py-2.5 font-medium">Confidence</th>
                  <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">When</th>
                  <th className="text-left px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => {
                  const app = apps.find((a) => a.app_id === d.app_id)
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => setSelected(d)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{app?.name ?? d.app_id}</p>
                        {(d as any).memory_context_used && (
                          <span className="text-xs text-muted-foreground">memory hit</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full border text-xs font-bold tracking-wide', verdictConfig[d.verdict] ?? verdictConfig.BLOCK)}>
                          {d.verdict}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                            <div
                              className={cn('h-full rounded-full', d.verdict === 'BLOCK' ? 'bg-destructive' : d.verdict === 'FLAG' ? 'bg-amber-500' : 'bg-primary')}
                              style={{ width: `${Math.round(d.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {Math.round(d.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {timeAgo(d.decided_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        View details →
                      </td>
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

      </div>

      <DecisionDrawer
        decision={selected}
        apps={apps}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
