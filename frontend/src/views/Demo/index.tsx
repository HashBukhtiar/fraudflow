import { useState, useCallback, useRef } from 'react'
import { triggerScenario } from '@/api/client'
import type { FraudDecision } from '@/api/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import DecisionTimeline from './DecisionTimeline'
import type { StepStatus, TimelineStepData } from './TimelineStep'

/* ─── Scenario definitions ─── */

interface Scenario {
  id: string
  num: string
  name: string
  description: string
  app: string
  endpoint: string
  httpMethod: string
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
    endpoint: '/open-banking/transactions',
    httpMethod: 'GET',
    expectedVerdict: 'BLOCK',
  },
  {
    id: 'payment_anomaly',
    num: '02',
    name: 'Payment Anomaly',
    description:
      'QuickPay fires 8 payments just under $10,000 within 3 minutes — a classic structuring pattern.',
    app: 'QuickPay',
    endpoint: '/open-banking/payments',
    httpMethod: 'POST',
    expectedVerdict: 'FLAG',
  },
  {
    id: 'social_engineering',
    num: '03',
    name: 'Social Engineering Tax App',
    description:
      'TaxEasy, registered 48 hours ago, requests excessive permissions and shows Benford deviation patterns consistent with data harvesting.',
    app: 'TaxEasy',
    endpoint: '/open-banking/accounts',
    httpMethod: 'GET',
    expectedVerdict: 'BLOCK',
  },
]

/* ─── Hardcoded profiler signal details per scenario ─── */

const PROFILER_DETAILS: Record<string, React.ReactNode> = {
  rogue_budgeting_app: (
    <>
      <p>Off-hours access: <span className="font-mono text-foreground">100%</span></p>
      <p>Unusual endpoint ratio: <span className="font-mono text-foreground">100%</span></p>
      <p>Composite risk score: <span className="font-mono text-foreground">6.05 / 10</span></p>
    </>
  ),
  payment_anomaly: (
    <>
      <p>Off-hours access: <span className="font-mono text-foreground">100%</span></p>
      <p>Benford deviation: <span className="font-mono text-foreground">1.000</span> (structuring)</p>
      <p>Composite risk score: <span className="font-mono text-foreground">4.14 / 10</span></p>
    </>
  ),
  social_engineering: (
    <>
      <p>New app: <span className="font-mono text-foreground">true</span> (48 h old)</p>
      <p>Excessive permissions: <span className="font-mono text-foreground">6 scopes</span></p>
      <p>Unusual endpoint ratio: <span className="font-mono text-foreground">33%</span></p>
      <p>Composite risk score: <span className="font-mono text-foreground">5.03 / 10</span></p>
    </>
  ),
}

const MEMORY_DETAILS: Record<string, React.ReactNode> = {
  rogue_budgeting_app: (
    <>
      <p>Similar pattern found in historical records</p>
      <p>Matched <span className="font-mono text-foreground">3</span> suspicious fintech apps with overnight data-harvesting behaviour</p>
    </>
  ),
  payment_anomaly: (
    <>
      <p>Structuring pattern previously observed</p>
      <p>Matched <span className="font-mono text-foreground">2</span> flagged payment apps with sub-threshold bursts</p>
    </>
  ),
  social_engineering: (
    <>
      <p>New-app risk pattern detected</p>
      <p>Matched <span className="font-mono text-foreground">4</span> recently registered apps with excessive permission requests</p>
    </>
  ),
}

/* ─── Step builder ─── */

const STEP_DELAY = 600

function buildSteps(): TimelineStepData[] {
  return [
    { id: 'request', label: `Fintech App Request`, status: 'pending' as StepStatus },
    { id: 'gateway', label: `Gateway Intercept`, status: 'pending' as StepStatus },
    { id: 'profiler', label: `Behaviour Profiler`, status: 'pending' as StepStatus },
    { id: 'memory', label: `Memory Lookup`, status: 'pending' as StepStatus },
    { id: 'ai', label: `AI Reasoning`, status: 'pending' as StepStatus },
    { id: 'decision', label: `Final Decision`, status: 'pending' as StepStatus },
  ]
}

/* ─── Expected-verdict badge colours ─── */

const expectedConfig: Record<'BLOCK' | 'FLAG', string> = {
  BLOCK: 'bg-destructive/10 text-destructive border-destructive/20',
  FLAG: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

const verdictLabel: Record<string, string> = {
  BLOCK: 'BLOCKED',
  FLAG: 'FLAGGED',
  APPROVE: 'APPROVED',
  ALLOW: 'ALLOWED',
}

/* ─── Component ─── */

type RunState = 'idle' | 'running' | 'done' | 'error'

export default function DemoScenarios() {
  const [states, setStates] = useState<Record<string, RunState>>({})
  const [steps, setSteps] = useState<Record<string, TimelineStepData[]>>({})
  const [results, setResults] = useState<Record<string, FraudDecision>>({})
  const timersRef = useRef<number[]>([])

  const advanceStep = useCallback(
    (scenarioId: string, stepIndex: number, status: StepStatus, detail?: React.ReactNode) => {
      setSteps((prev) => {
        const list = [...(prev[scenarioId] ?? [])]
        list[stepIndex] = { ...list[stepIndex], status, detail: detail ?? list[stepIndex].detail }
        return { ...prev, [scenarioId]: list }
      })
    },
    [],
  )

  const run = useCallback(
    async (scenario: Scenario) => {
      const id = scenario.id

      // Clear old timers
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []

      // Reset state
      setStates((s) => ({ ...s, [id]: 'running' }))
      setSteps((s) => ({ ...s, [id]: buildSteps() }))
      setResults((r) => {
        const next = { ...r }
        delete next[id]
        return next
      })

      // Kick off API call immediately
      const apiPromise = triggerScenario(id)

      // Animate steps 0–3 with delays (these don't need API data)
      const delay = (ms: number) =>
        new Promise<void>((resolve) => {
          const t = window.setTimeout(resolve, ms)
          timersRef.current.push(t)
        })

      // Step 0: Request
      advanceStep(id, 0, 'active')
      await delay(STEP_DELAY)
      advanceStep(id, 0, 'done', (
        <>
          <p><span className="font-mono text-foreground">{scenario.app}</span> → <span className="font-mono text-foreground">{scenario.httpMethod} {scenario.endpoint}</span></p>
        </>
      ))

      // Step 1: Gateway
      advanceStep(id, 1, 'active')
      await delay(STEP_DELAY)
      advanceStep(id, 1, 'done', (
        <>
          <p>Gateway intercepted request</p>
          <p>Method: <span className="font-mono text-foreground">{scenario.httpMethod}</span></p>
        </>
      ))

      // Step 2: Profiler
      advanceStep(id, 2, 'active')
      await delay(STEP_DELAY)
      advanceStep(id, 2, 'done', PROFILER_DETAILS[id])

      // Step 3: Memory
      advanceStep(id, 3, 'active')
      await delay(STEP_DELAY)
      advanceStep(id, 3, 'done', MEMORY_DETAILS[id])

      // Step 4: AI — wait for actual API result
      advanceStep(id, 4, 'active')
      try {
        const data = await apiPromise

        await delay(STEP_DELAY)
        advanceStep(id, 4, 'done', (
          <p className="leading-relaxed">{data.explanation}</p>
        ))

        // Step 5: Final decision
        advanceStep(id, 5, 'active')
        await delay(STEP_DELAY)
        advanceStep(id, 5, 'done', (
          <>
            <p className="text-base font-bold text-foreground">
              {verdictLabel[data.verdict] ?? data.verdict}
            </p>
            <p>Confidence: <span className="font-mono text-foreground">{Math.round(data.confidence * 100)}%</span></p>
            <p>Action: <span className="text-foreground">{data.recommended_action}</span></p>
          </>
        ))

        setResults((r) => ({ ...r, [id]: data }))
        setStates((s) => ({ ...s, [id]: 'done' }))
      } catch {
        setStates((s) => ({ ...s, [id]: 'error' }))
      }
    },
    [advanceStep],
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
          Scenarios
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Demo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trigger scripted fraud scenarios and watch FraudFlow's decision pipeline unfold in real time.
        </p>
      </div>

      {/* Scenario list */}
      <div className="space-y-6">
        {SCENARIOS.map((scenario) => {
          const state = states[scenario.id] ?? 'idle'
          const scenarioSteps = steps[scenario.id]
          const result = results[scenario.id]

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
                        onClick={() => run(scenario)}
                      >
                        {state === 'idle' && 'Run Scenario'}
                        {state === 'running' && 'Running\u2026'}
                        {state === 'done' && 'Run Again'}
                        {state === 'error' && 'Retry'}
                      </Button>

                      {state === 'error' && (
                        <p className="text-xs text-destructive">
                          Failed — is the backend running?
                        </p>
                      )}
                    </div>

                    {/* Decision Timeline */}
                    {scenarioSteps && (state === 'running' || state === 'done') && (
                      <div className="mt-2">
                        <DecisionTimeline
                          steps={scenarioSteps}
                          verdict={result?.verdict}
                        />
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
