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
]

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
]

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

  const unseenCount = alerts.filter((a) => !a.seen).length

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Connected Apps</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Apps connected to your bank account via Open Banking.
          {unseenCount > 0 && (
            <span className="ml-2 font-medium text-destructive">
              {unseenCount} new alert{unseenCount > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>

      <AlertsFeed alerts={alerts} />
    </div>
  )
}
