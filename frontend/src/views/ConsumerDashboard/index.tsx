import { useEffect, useState } from 'react'
import { getApps, getAlerts } from '@/api/client'
import type { AppProfile, AlertEvent } from '@/api/types'
import AppCard from './AppCard'
import AlertsFeed from './AlertsFeed'

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

const MOCK_ALERTS: AlertEvent[] = [
  {
    id: 'a1',
    app_id: '1',
    decision_id: 'd1',
    severity: 'high',
    message: 'BudgetBuddy attempted to initiate a payment outside its declared scope at 3:12am.',
    timestamp: new Date().toISOString(),
    seen: false,
  },
  {
    id: 'a2',
    app_id: '3',
    decision_id: 'd2',
    severity: 'high',
    message: 'TaxEasy (registered 2 days ago) requested excessive permissions. Request blocked.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    seen: false,
  },
  {
    id: 'a3',
    app_id: '2',
    decision_id: 'd3',
    severity: 'medium',
    message: 'QuickPay made 47 API calls in the last 5 minutes — abnormal frequency detected.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    seen: true,
  },
] as unknown as AlertEvent[]

export default function ConsumerDashboard() {
  const [apps, setApps] = useState<AppProfile[]>(MOCK_APPS)
  const [alerts, setAlerts] = useState<AlertEvent[]>(MOCK_ALERTS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([getApps(), getAlerts()])
      .then(([appsData, alertsData]) => {
        setApps(appsData)
        setAlerts(alertsData)
      })
      .catch(() => {
        // backend not running — fall back to mock data
      })
      .finally(() => setLoading(false))
  }, [])

  const unseenCount = (alerts as any[]).filter((a) => !a.seen).length

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Open Banking
        </p>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Connected Apps</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Third-party apps connected to your bank account.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm shrink-0">
            <div className="text-right">
              <p className="font-semibold tabular-nums">{apps.length}</p>
              <p className="text-xs text-muted-foreground">connected</p>
            </div>
            {unseenCount > 0 && (
              <div className="text-right">
                <p className="font-semibold tabular-nums text-destructive">{unseenCount}</p>
                <p className="text-xs text-muted-foreground">
                  new alert{unseenCount !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {/* App grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <AppCard key={(app as any).id} app={app} />
        ))}
      </div>

      {/* Alerts */}
      <AlertsFeed alerts={alerts} />
    </div>
  )
}
