import { useEffect, useState } from 'react'
import { getApps, getDecisions } from '@/api/client'
import type { AppProfile, APICallLog, FraudDecision } from '@/api/types'
import RiskRankList from './RiskRankList'
import CallFeed from './CallFeed'
import DecisionDrawer from './DecisionDrawer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const MOCK_APPS: AppProfile[] = [
  {
    id: '1',
    name: 'BudgetBuddy',
    category: 'budgeting',
    permissions_requested: ['read:accounts', 'read:transactions'],
    registration_date: '2024-06-15',
    trust_score: 0.85,
    status: 'active',
  },
  {
    id: '2',
    name: 'QuickPay',
    category: 'payments',
    permissions_requested: ['read:accounts', 'write:payments', 'read:transactions'],
    registration_date: '2024-11-02',
    trust_score: 0.40,
    status: 'flagged',
  },
  {
    id: '3',
    name: 'TaxEasy',
    category: 'tax',
    permissions_requested: ['read:accounts', 'read:transactions', 'read:balances', 'write:consent'],
    registration_date: '2026-03-12',
    trust_score: 0.10,
    status: 'active',
  },
] as unknown as AppProfile[]

const MOCK_CALLS: APICallLog[] = [
  {
    id: 'c1', app_id: '1', user_id: 'u1', endpoint: '/open-banking/transactions',
    timestamp: new Date(Date.now() - 60000).toISOString(), time_of_day_hour: 3,
    data_volume_kb: 48, permission_scope_used: 'write:payments', allowed: false,
    scenario_tag: 'rogue_app',
  },
  {
    id: 'c2', app_id: '2', user_id: 'u1', endpoint: '/open-banking/payments',
    timestamp: new Date(Date.now() - 120000).toISOString(), time_of_day_hour: 3,
    data_volume_kb: 12, permission_scope_used: 'write:payments', allowed: false,
    scenario_tag: 'transaction_anomaly',
  },
  {
    id: 'c3', app_id: '3', user_id: 'u2', endpoint: '/open-banking/accounts',
    timestamp: new Date(Date.now() - 180000).toISOString(), time_of_day_hour: 14,
    data_volume_kb: 200, permission_scope_used: 'read:accounts', allowed: true,
    scenario_tag: null,
  },
  {
    id: 'c4', app_id: '1', user_id: 'u1', endpoint: '/open-banking/accounts',
    timestamp: new Date(Date.now() - 240000).toISOString(), time_of_day_hour: 14,
    data_volume_kb: 8, permission_scope_used: 'read:accounts', allowed: true,
    scenario_tag: null,
  },
] as unknown as APICallLog[]

const MOCK_DECISIONS: FraudDecision[] = [
  {
    id: 'd1', app_id: '1', verdict: 'BLOCK', confidence: 0.94,
    explanation: 'BudgetBuddy attempted to initiate a payment — outside its declared budgeting scope. Overnight access at 3am combined with scope mismatch triggers an automatic block.',
    recommended_action: 'Revoke payment permission and notify user.',
    timestamp: new Date(Date.now() - 60000).toISOString(), memory_context_used: true,
  },
  {
    id: 'd2', app_id: '3', verdict: 'BLOCK', confidence: 0.97,
    explanation: 'TaxEasy was registered 2 days ago and is requesting permissions far exceeding what a tax app requires. Benford deviation score of 0.78 suggests synthetic data patterns.',
    recommended_action: 'Block all requests and flag for manual review.',
    timestamp: new Date(Date.now() - 120000).toISOString(), memory_context_used: true,
  },
  {
    id: 'd3', app_id: '2', verdict: 'FLAG', confidence: 0.76,
    explanation: 'QuickPay is initiating a high-value payment for a user with no prior payment history through this app. Pattern matches known social-engineering vectors.',
    recommended_action: 'Request explicit user confirmation before processing.',
    timestamp: new Date(Date.now() - 300000).toISOString(), memory_context_used: false,
  },
] as unknown as FraudDecision[]

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
  const [calls] = useState<APICallLog[]>(MOCK_CALLS)
  const [decisions, setDecisions] = useState<FraudDecision[]>(MOCK_DECISIONS)
  const [selected, setSelected] = useState<FraudDecision | null>(null)

  useEffect(() => {
    Promise.all([getApps(), getDecisions()])
      .then(([appsData, decisionsData]) => {
        setApps(appsData)
        setDecisions(decisionsData)
      })
      .catch(() => {})
  }, [])

  const blocked      = (decisions as any[]).filter((d) => d.verdict === 'BLOCK').length
  const flagged      = (decisions as any[]).filter((d) => d.verdict === 'FLAG').length
  const blockedCalls = (calls as any[]).filter((c) => !(c.allowed ?? !c.flagged)).length
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
          {/* Blocked decisions */}
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
                    <line x1="9" y1="9" x2="15" y2="15" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Requests fully blocked</p>
            </CardContent>
          </Card>

          {/* Flagged decisions */}
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

          {/* Blocked calls */}
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
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
                {decisions.map((decision) => {
                  const d = decision as any
                  const app = apps.find((a) => (a as any).id === d.app_id) as any
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => setSelected(decision)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{app?.name ?? d.app_id}</p>
                        {d.memory_context_used && (
                          <span className="text-xs text-muted-foreground">memory hit</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full border text-xs font-bold tracking-wide',
                            verdictConfig[d.verdict] ?? verdictConfig.BLOCK,
                          )}
                        >
                          {d.verdict}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                d.verdict === 'BLOCK' ? 'bg-destructive' : d.verdict === 'FLAG' ? 'bg-amber-500' : 'bg-primary',
                              )}
                              style={{ width: `${Math.round(d.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {Math.round(d.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                        {timeAgo(d.timestamp ?? d.decided_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        View details →
                      </td>
                    </tr>
                  )
                })}
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
