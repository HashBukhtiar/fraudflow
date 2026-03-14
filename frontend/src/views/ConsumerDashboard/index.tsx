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
    <div className="min-h-screen bg-background">
      {/* Bank portal header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* TD-style logo mark */}
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-sm tracking-tight">TD</span>
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">TD Bank</p>
              <p className="text-xs text-muted-foreground">Open Banking</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative">
              <button
                className="w-9 h-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Notifications"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
              </button>
              {unseenCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-xs font-bold flex items-center justify-center leading-none">
                  {unseenCount}
                </span>
              )}
            </div>

            {/* User avatar */}
            <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground">AJ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Good morning, Alex.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You have <span className="font-medium text-foreground">{apps.length} apps</span> connected to your bank account
            {unseenCount > 0 && (
              <> and <span className="font-medium text-destructive">{unseenCount} new security alert{unseenCount !== 1 ? 's' : ''}</span></>
            )}.
          </p>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {/* Connected apps */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Connected Apps
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard key={(app as any).id} app={app} />
            ))}
          </div>
        </div>

        {/* Security notifications */}
        <div>
          <AlertsFeed alerts={alerts} />
        </div>

      </div>
    </div>
  )
}
