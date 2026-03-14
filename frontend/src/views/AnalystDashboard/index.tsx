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
  ALLOW: 'bg-primary/10 text-primary border-primary/20',
  FLAG: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  BLOCK: 'bg-destructive/10 text-destructive border-destructive/20',
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
      .catch(() => {
        // fall back to mock data
      })
  }, [])

  const blocked = (decisions as any[]).filter((d) => d.verdict === 'BLOCK').length
  const flagged = (decisions as any[]).filter((d) => d.verdict === 'FLAG').length
  const blockedCalls = (calls as any[]).filter((c) => !(c.allowed ?? !c.flagged)).length

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Analyst View
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time view of third-party app activity and fraud decisions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Blocked', value: blocked, colorClass: 'text-destructive' },
          { label: 'Flagged', value: flagged, colorClass: 'text-amber-600' },
          { label: 'Blocked Calls', value: blockedCalls, colorClass: 'text-destructive' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 pb-4">
              <p className={cn('text-3xl font-bold tabular-nums', stat.colorClass)}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
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

      {/* Decisions table */}
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
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Time</th>
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
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelected(decision)}
                  >
                    <td className="px-4 py-3 font-medium">{app?.name ?? d.app_id}</td>
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
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {Math.round(d.confidence * 100)}%
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                      {new Date(d.timestamp ?? d.decided_at).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-primary">Details →</td>
                  </tr>
                )
              })}
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
