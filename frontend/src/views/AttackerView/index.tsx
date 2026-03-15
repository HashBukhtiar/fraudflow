import { useState, useEffect, useCallback, useRef } from 'react'
import { getAppStatus, resetApp, callOpenBanking } from '@/api/client'
import type { AppStatus } from '@/api/client'

/* ─── Types ─── */

type ActionStatus = 'idle' | 'loading' | 'ALLOW' | 'FLAG' | 'BLOCK' | 'error'

interface ActionDef {
  id: string
  label: string
  subtitle: string
  icon: string
  fire: () => Promise<unknown>
}

/* ─── Helpers ─── */

const APP_ID = 'taxeasy'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ─── Component ─── */

export default function AttackerView() {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [actionStates, setActionStates] = useState<Record<string, ActionStatus>>({})
  const [blockOverlay, setBlockOverlay] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll app status every 1.5s
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await getAppStatus(APP_ID)
        setStatus(s)
      } catch {
        // backend not reachable
      }
    }
    poll()
    pollRef.current = setInterval(poll, 1500)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // Derive visual status from polled data
  const visualStatus: 'SAFE' | 'FLAGGED' | 'BLOCKED' = (() => {
    if (!status) return 'SAFE'
    if (status.is_blocked) return 'BLOCKED'
    if (status.last_verdict === 'FLAG') return 'FLAGGED'
    return 'SAFE'
  })()

  // Action definitions
  const actions: ActionDef[] = [
    {
      id: 'balance',
      label: 'View My Balance',
      subtitle: 'Check your account balance',
      icon: '\uD83D\uDCB0',
      fire: () => callOpenBanking('/open-banking/accounts', { appId: APP_ID }),
    },
    {
      id: 'transactions',
      label: 'Download Transactions',
      subtitle: 'Export recent activity',
      icon: '\uD83D\uDCC4',
      fire: () => callOpenBanking('/open-banking/transactions', { appId: APP_ID }),
    },
    {
      id: 'autofile',
      label: 'Auto-file Tax Return',
      subtitle: 'Submit your return automatically',
      icon: '\uD83D\uDCE8',
      fire: () =>
        callOpenBanking('/open-banking/payments', {
          method: 'POST',
          body: { amount: 150, app_id: APP_ID },
          appId: APP_ID,
        }),
    },
    {
      id: 'export',
      label: 'Export Full History',
      subtitle: 'Download all financial data',
      icon: '\uD83D\uDDC2\uFE0F',
      fire: async () => {
        await callOpenBanking('/open-banking/transactions', { appId: APP_ID })
        await sleep(200)
        return callOpenBanking('/open-banking/accounts', { appId: APP_ID })
      },
    },
    {
      id: 'refund',
      label: 'Process Refund',
      subtitle: 'Request a tax refund deposit',
      icon: '\uD83D\uDCB3',
      fire: () =>
        callOpenBanking('/open-banking/payments', {
          method: 'POST',
          body: { amount: 9800, app_id: APP_ID },
          appId: APP_ID,
        }),
    },
    {
      id: 'bulksync',
      label: 'Bulk Data Sync',
      subtitle: 'Sync all records at once',
      icon: '\uD83D\uDD04',
      fire: async () => {
        for (let i = 0; i < 10; i++) {
          await callOpenBanking('/open-banking/transactions', { appId: APP_ID })
          if (i < 9) await sleep(100)
        }
      },
    },
  ]

  const runAction = useCallback(
    async (action: ActionDef) => {
      setActionStates((s) => ({ ...s, [action.id]: 'loading' }))
      try {
        await action.fire()
        // Re-poll status immediately after action
        const s = await getAppStatus(APP_ID)
        setStatus(s)
        const verdict = s.last_verdict ?? 'ALLOW'
        setActionStates((prev) => ({
          ...prev,
          [action.id]: verdict as ActionStatus,
        }))
        if (s.is_blocked && s.block_reason) {
          setBlockOverlay(s.block_reason)
        }
      } catch (err: unknown) {
        // 403 from scope check also means blocked/flagged — re-poll
        try {
          const s = await getAppStatus(APP_ID)
          setStatus(s)
          if (s.is_blocked) {
            setActionStates((prev) => ({ ...prev, [action.id]: 'BLOCK' }))
            if (s.block_reason) setBlockOverlay(s.block_reason)
            return
          }
          if (s.last_verdict === 'FLAG') {
            setActionStates((prev) => ({ ...prev, [action.id]: 'FLAG' }))
            return
          }
        } catch {
          // ignore
        }
        setActionStates((prev) => ({ ...prev, [action.id]: 'error' }))
      }
    },
    [],
  )

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetApp(APP_ID)
      setActionStates({})
      setBlockOverlay(null)
      const s = await getAppStatus(APP_ID)
      setStatus(s)
    } catch {
      // ignore
    }
    setResetting(false)
  }

  const resultBadge = (state: ActionStatus) => {
    switch (state) {
      case 'ALLOW':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            &#10003; Allowed
          </span>
        )
      case 'FLAG':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            &#9888; Flagged
          </span>
        )
      case 'BLOCK':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            &#10007; Blocked
          </span>
        )
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            &#10007; Error
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      {/* Status bar */}
      <div
        className={`w-full px-4 py-2.5 text-center text-sm font-medium transition-colors duration-300 ${
          visualStatus === 'SAFE'
            ? 'bg-emerald-500 text-white'
            : visualStatus === 'FLAGGED'
              ? 'bg-amber-400 text-amber-950'
              : 'bg-red-600 text-white'
        }`}
      >
        {visualStatus === 'SAFE' && 'TaxEasy is connected and trusted'}
        {visualStatus === 'FLAGGED' && 'Your activity has been flagged for review'}
        {visualStatus === 'BLOCKED' && 'Access blocked by FraudFlow'}
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-[400px] px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white shadow-lg">
            {'\uD83C\uDF3F'}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            TaxEasy{' '}
            <span className="text-emerald-600">&mdash; Smart Tax Filing</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">Connected to your TD account</p>

          {/* Trust score */}
          {status && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs shadow-sm">
              <span className="text-gray-500">Trust Score</span>
              <span
                className={`font-bold ${
                  status.trust_score >= 7
                    ? 'text-emerald-600'
                    : status.trust_score >= 4
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}
              >
                {status.trust_score.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {actions.map((action) => {
            const state = actionStates[action.id] ?? 'idle'
            const isLoading = state === 'loading'

            return (
              <button
                key={action.id}
                onClick={() => runAction(action)}
                disabled={isLoading}
                className="group relative flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-lg">
                  {action.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                  <p className="text-xs text-gray-500">{action.subtitle}</p>
                </div>
                <div className="shrink-0">
                  {isLoading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                  ) : (
                    resultBadge(state)
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Reset button */}
        <div className="mt-8 text-center">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-50"
          >
            {resetting ? 'Resetting...' : 'Reset Demo Session'}
          </button>
        </div>

        {/* Subtle footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          TaxEasy v2.1.0 &middot; Secured by Open Banking
        </p>
      </div>

      {/* Block overlay */}
      {blockOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-600/95 p-6">
          <div className="max-w-sm text-center text-white">
            <p className="text-6xl">{'\uD83D\uDEAB'}</p>
            <h2 className="mt-4 text-2xl font-bold">Access Blocked</h2>
            <p className="mt-3 text-sm leading-relaxed text-red-100">
              {blockOverlay}
            </p>
            <p className="mt-4 text-xs text-red-200">
              FraudFlow detected suspicious behavior and blocked this request
            </p>
            <button
              onClick={() => setBlockOverlay(null)}
              className="mt-6 rounded-lg bg-white/20 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/30 active:scale-95"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
