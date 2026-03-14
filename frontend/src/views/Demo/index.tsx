import { useState } from 'react'
import { triggerScenario } from '@/api/client'
import type { FraudDecision } from '@/api/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Scenario {
  id: string
  num: string
  name: string
  description: string
  app: string
  expectedVerdict: 'BLOCK' | 'FLAG'
}

const SCENARIOS: Scenario[] = [
  {
    id: 'rogue_budgeting_app',
    num: '01',
    name: 'Rogue Budgeting App',
    description:
      'BudgetBuddy starts making API calls at 3am, hitting payment endpoints outside its declared budgeting scope.',
    app: 'BudgetBuddy',
    expectedVerdict: 'BLOCK',
  },
  {
    id: 'payment_anomaly',
    num: '02',
    name: 'Payment Anomaly',
    description:
      'QuickPay fires 8 payments just under $10,000 within 3 minutes — a classic structuring pattern.',
    app: 'QuickPay',
    expectedVerdict: 'FLAG',
  },
  {
    id: 'social_engineering',
    num: '03',
    name: 'Social Engineering Tax App',
    description:
      'TaxEasy, registered 48 hours ago, requests excessive permissions and shows Benford deviation patterns consistent with data harvesting.',
    app: 'TaxEasy',
    expectedVerdict: 'BLOCK',
  },
]

type RunState = 'idle' | 'running' | 'done' | 'error'

type ScenarioResult = Pick<FraudDecision, 'verdict' | 'explanation' | 'confidence' | 'recommended_action'>

const verdictConfig: Record<string, string> = {
  APPROVE: 'bg-primary/10 text-primary border-primary/20',
  ALLOW: 'bg-primary/10 text-primary border-primary/20',
  FLAG: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  BLOCK: 'bg-destructive/10 text-destructive border-destructive/20',
}

const expectedConfig: Record<'BLOCK' | 'FLAG', string> = {
  BLOCK: 'bg-destructive/10 text-destructive border-destructive/20',
  FLAG: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

export default function DemoScenarios() {
  const [states, setStates] = useState<Record<string, RunState>>({})
  const [results, setResults] = useState<Record<string, ScenarioResult>>({})

  const run = async (id: string) => {
    setStates((s) => ({ ...s, [id]: 'running' }))
    setResults((r) => ({ ...r, [id]: {} as ScenarioResult }))
    try {
      const data = await triggerScenario(id)
      setResults((r) => ({ ...r, [id]: data as ScenarioResult }))
      setStates((s) => ({ ...s, [id]: 'done' }))
    } catch {
      setStates((s) => ({ ...s, [id]: 'error' }))
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Scenarios
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Demo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trigger scripted fraud scenarios and watch FraudFlow respond in real time.
        </p>
      </div>

      {/* Scenario list */}
      <div className="space-y-4">
        {SCENARIOS.map((scenario) => {
          const state = states[scenario.id] ?? 'idle'
          const result = results[scenario.id] as any

          return (
            <Card key={scenario.id}>
              <CardContent className="pt-6 pb-5">
                <div className="flex gap-5">
                  {/* Number */}
                  <span className="text-3xl font-bold tabular-nums text-muted-foreground/30 leading-none mt-0.5 shrink-0 select-none">
                    {scenario.num}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{scenario.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          App:{' '}
                          <span className="font-medium text-foreground font-mono">
                            {scenario.app}
                          </span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 rounded-full border text-xs font-bold',
                          expectedConfig[scenario.expectedVerdict],
                        )}
                      >
                        {scenario.expectedVerdict}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {scenario.description}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
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
                          Failed — is the backend running?
                        </p>
                      )}
                    </div>

                    {/* Result */}
                    {state === 'done' && result && (
                      <div className="border border-border rounded-md bg-muted/30 px-4 py-3 space-y-2.5 mt-1">
                        {result.verdict && (
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'px-2.5 py-0.5 rounded-full border text-xs font-bold tracking-wide',
                                verdictConfig[result.verdict] ?? verdictConfig.BLOCK,
                              )}
                            >
                              {result.verdict}
                            </span>
                            {result.confidence !== undefined && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {Math.round(result.confidence * 100)}% confidence
                              </span>
                            )}
                          </div>
                        )}
                        {result.explanation && (
                          <p className="text-sm text-foreground/80 leading-relaxed">
                            {result.explanation}
                          </p>
                        )}
                        {result.recommended_action && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground uppercase tracking-wider">
                              Action
                            </span>{' '}
                            — {result.recommended_action}
                          </p>
                        )}
                        {!result.verdict && (
                          <p className="text-xs text-muted-foreground">
                            Scenario triggered successfully.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
