import { useState } from 'react'
import { triggerScenario } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Scenario {
  id: string
  name: string
  description: string
  app: string
  expectedVerdict: 'BLOCK' | 'FLAG'
}

const SCENARIOS: Scenario[] = [
  {
    id: 'rogue_app',
    name: 'Scenario 1 — Rogue Budgeting App',
    description:
      'BudgetBuddy starts making API calls at 3am, hitting payment endpoints outside its declared budgeting scope.',
    app: 'BudgetBuddy',
    expectedVerdict: 'BLOCK',
  },
  {
    id: 'transaction_anomaly',
    name: 'Scenario 2 — Payment Anomaly',
    description:
      'QuickPay initiates a high-value payment for a user with no prior payment history through this app.',
    app: 'QuickPay',
    expectedVerdict: 'FLAG',
  },
  {
    id: 'social_engineering',
    name: 'Scenario 3 — Social Engineering Tax App',
    description:
      'TaxEasy, registered 48 hours ago, requests excessive permissions and shows Benford deviation patterns consistent with data harvesting.',
    app: 'TaxEasy',
    expectedVerdict: 'BLOCK',
  },
]

type RunState = 'idle' | 'running' | 'done' | 'error'

interface ScenarioResult {
  verdict?: string
  explanation?: string
  raw?: unknown
}

export default function DemoScenarios() {
  const [states, setStates] = useState<Record<string, RunState>>({})
  const [results, setResults] = useState<Record<string, ScenarioResult>>({})

  const run = async (id: string) => {
    setStates((s) => ({ ...s, [id]: 'running' }))
    setResults((r) => ({ ...r, [id]: {} }))
    try {
      const data = await triggerScenario(id)
      setResults((r) => ({ ...r, [id]: data as ScenarioResult }))
      setStates((s) => ({ ...s, [id]: 'done' }))
    } catch {
      setStates((s) => ({ ...s, [id]: 'error' }))
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Demo Scenarios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Trigger scripted fraud scenarios and watch FraudFlow respond in real time.
        </p>
      </div>

      <div className="space-y-4">
        {SCENARIOS.map((scenario) => {
          const state = states[scenario.id] ?? 'idle'
          const result = results[scenario.id]

          return (
            <Card key={scenario.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{scenario.name}</CardTitle>
                  <span
                    className={cn(
                      'shrink-0 px-2 py-0.5 rounded text-xs font-bold',
                      scenario.expectedVerdict === 'BLOCK'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700',
                    )}
                  >
                    Expected: {scenario.expectedVerdict}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{scenario.description}</p>
                <p className="text-xs text-muted-foreground">
                  App: <span className="font-medium text-foreground">{scenario.app}</span>
                </p>
              </CardHeader>

              <CardContent className="space-y-3">
                <Button
                  size="sm"
                  variant={state === 'done' ? 'secondary' : 'default'}
                  disabled={state === 'running'}
                  onClick={() => run(scenario.id)}
                >
                  {state === 'idle' && 'Run Scenario'}
                  {state === 'running' && 'Running…'}
                  {state === 'done' && 'Run Again'}
                  {state === 'error' && 'Retry'}
                </Button>

                {state === 'error' && (
                  <p className="text-xs text-destructive">
                    Failed to trigger — is the backend running?
                  </p>
                )}

                {state === 'done' && result && (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1">
                    {result.verdict && (
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-xs font-bold',
                            result.verdict === 'BLOCK'
                              ? 'bg-red-100 text-red-700'
                              : result.verdict === 'FLAG'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700',
                          )}
                        >
                          {result.verdict}
                        </span>
                        <span className="text-xs text-muted-foreground">verdict returned</span>
                      </div>
                    )}
                    {result.explanation && (
                      <p className="text-xs">{result.explanation}</p>
                    )}
                    {!result.verdict && (
                      <p className="text-xs text-muted-foreground">Scenario triggered successfully.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
