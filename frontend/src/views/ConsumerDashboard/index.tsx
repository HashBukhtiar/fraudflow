import { useEffect, useState } from 'react'
import { getApps, getAlerts } from '@/api/client'
import type { AppProfile, AlertEvent } from '@/api/types'
import AppCard from './AppCard'
import AlertsFeed from './AlertsFeed'

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

const MOCK_ALERTS: AlertEvent[] = [
  {
    id: 1,
    app_id: 'budgetbuddy',
    fraud_decision_id: 1,
    triggered_at: new Date().toISOString(),
    title: 'BLOCK: BudgetBuddy (budgeting)',
    description: 'BudgetBuddy attempted to initiate a payment outside its declared scope at 3:12am.',
    severity: 'critical',
    verdict: 'BLOCK',
    resolved: false,
  },
  {
    id: 2,
    app_id: 'taxeasy',
    fraud_decision_id: 2,
    triggered_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    title: 'BLOCK: TaxEasy (tax)',
    description: 'TaxEasy (registered 2 days ago) requested excessive permissions. Request blocked.',
    severity: 'critical',
    verdict: 'BLOCK',
    resolved: false,
  },
  {
    id: 3,
    app_id: 'quickpay',
    fraud_decision_id: 3,
    triggered_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    title: 'FLAG: QuickPay (payments)',
    description: 'QuickPay made 47 API calls in the last 5 minutes — abnormal frequency detected.',
    severity: 'warning',
    verdict: 'FLAG',
    resolved: true,
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

  const unseenCount = alerts.filter((a) => !a.resolved).length

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
          <AppCard key={app.app_id} app={app} />
        ))}
      </div>

      <AlertsFeed alerts={alerts} />
    </div>
  )
}
