import { useEffect, useState } from 'react'
import { getApps, getAlerts, connectApp, revokeApp } from '@/api/client'
import api from '@/api/client'
import type { AppProfile, AlertEvent, AppCategory } from '@/api/types'
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
    description: 'AI-powered tax filing assistant that imports your financial data to auto-fill your return.',
    registered_at: '2026-03-12T00:00:00Z',
    trust_score: 1.5,
    trust_level: 'NEW',
    permissions: 'accounts:read,transactions:read,balances:read,payments:write,consent:write,personal_info:read',
    is_active: false,
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
  const [connecting, setConnecting] = useState<string | null>(null)
  const [revoking, setRevoking]     = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', category: 'other' as AppCategory, permissions: [] as string[] })
  const [adding, setAdding] = useState(false)

  const refresh = () =>
    Promise.all([getApps(), getAlerts()])
      .then(([appsData, alertsData]) => {
        setApps(appsData)
        setAlerts(alertsData)
      })
      .catch(() => {})

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [])

  const handleConnect = async (appId: string) => {
    setConnecting(appId)
    try {
      await connectApp(appId)
      await refresh()
    } catch {
      // ignore
    }
    setConnecting(null)
  }

  const handleRevoke = async (appId: string) => {
    setRevoking(appId)
    try {
      await revokeApp(appId)
      await refresh()
    } catch {
      // ignore
    }
    setRevoking(null)
  }

  const handleAddApp = async () => {
    if (!addForm.name.trim()) return
    setAdding(true)
    try {
      const appId = addForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      await api.post('/api/apps', {
        app_id: appId,
        name: addForm.name.trim(),
        category: addForm.category,
        description: '',
        trust_score: 1.0,
        trust_level: 'NEW',
        permissions: addForm.permissions.join(','),
        is_active: true,
      })
      await refresh()
      setShowAddModal(false)
      setAddForm({ name: '', category: 'other', permissions: [] })
    } catch {
      // ignore (e.g. duplicate app_id)
    }
    setAdding(false)
  }

  const togglePermission = (p: string) =>
    setAddForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p],
    }))

  const connectedApps  = apps.filter((a) => a.is_active)
  const availableApps  = apps.filter((a) => !a.is_active)
  const unseenCount    = alerts.filter((a) => !a.resolved).length

  return (
    <div className="min-h-screen bg-background">
      {/* Bank portal header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* TD-style logo mark — literal color so it never flashes on load */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'oklch(0.532 0.157 131.589)' }}
            >
              <span className="font-bold text-sm tracking-tight" style={{ color: 'oklch(0.986 0.031 120.757)' }}>TD</span>
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
            You have <span className="font-medium text-foreground">{connectedApps.length} apps</span> connected to your bank account
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
          {connectedApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No apps connected yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedApps.map((app) => (
                <AppCard
                  key={app.app_id}
                  app={app}
                  onRevoke={revoking === app.app_id ? undefined : () => handleRevoke(app.app_id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Available to connect */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Available to Connect
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableApps.map((app) => {
              const permissions = (app.permissions ?? '').split(',').map((s) => s.trim()).filter(Boolean)
              const permissionLabels: Record<string, string> = {
                'accounts:read':      'View your accounts',
                'transactions:read':  'View transaction history',
                'payments:write':     'Make payments',
                'balances:read':      'View account balances',
                'consent:write':      'Manage consent settings',
                'personal_info:read': 'Access personal information',
              }
              const isConnecting = connecting === app.app_id
              return (
                <div key={app.app_id} className="rounded-xl border border-dashed border-border bg-muted/20 p-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-sm text-muted-foreground shrink-0">
                      {app.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{app.name}</p>
                      <p className="text-xs text-muted-foreground">{app.description}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">This app will be able to:</p>
                    <ul className="space-y-1">
                      {permissions.map((p) => (
                        <li key={p} className="flex items-start gap-1.5 text-xs text-foreground/70">
                          <span className="mt-0.5 w-3 h-3 rounded-full border border-border bg-muted shrink-0" />
                          {permissionLabels[p] ?? p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => handleConnect(app.app_id)}
                    disabled={isConnecting}
                    className="mt-auto w-full rounded-lg bg-primary text-primary-foreground text-xs font-semibold py-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting…' : 'Connect'}
                  </button>
                </div>
              )
            })}

            {/* Add new app tile */}
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-xl border-2 border-dashed border-border bg-transparent hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-2 min-h-[160px] text-muted-foreground hover:text-foreground"
            >
              <span className="w-10 h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center text-xl font-light">+</span>
              <span className="text-xs font-medium">Add New App</span>
            </button>
          </div>
        </div>

        {/* Add app modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-background border border-border shadow-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">Connect a New App</h2>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
              </div>

              {/* App name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">App Name</label>
                <input
                  type="text"
                  placeholder="e.g. MyBudgetApp"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value as AppCategory }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="budgeting">Budgeting</option>
                  <option value="payments">Payments</option>
                  <option value="tax">Tax & Filing</option>
                  <option value="lending">Lending</option>
                  <option value="investing">Investing</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Permissions */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Permissions</label>
                <div className="space-y-2">
                  {([
                    ['accounts:read',      'View your accounts'],
                    ['transactions:read',  'View transaction history'],
                    ['balances:read',      'View account balances'],
                    ['payments:write',     'Make payments'],
                    ['consent:write',      'Manage consent settings'],
                    ['personal_info:read', 'Access personal information'],
                  ] as const).map(([scope, label]) => (
                    <label key={scope} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addForm.permissions.includes(scope)}
                        onChange={() => togglePermission(scope)}
                        className="rounded border-border accent-primary"
                      />
                      <span className="text-xs text-foreground/80">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddApp}
                  disabled={adding || !addForm.name.trim()}
                  className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {adding ? 'Connecting…' : 'Connect App'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security notifications */}
        <AlertsFeed alerts={alerts} />

      </div>
    </div>
  )
}
