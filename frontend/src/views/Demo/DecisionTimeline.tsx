import TimelineStep from './TimelineStep'
import type { TimelineStepData } from './TimelineStep'

const verdictColors: Record<string, string> = {
  BLOCK: 'border-destructive/40 bg-destructive/10',
  FLAG: 'border-amber-500/40 bg-amber-500/10',
  APPROVE: 'border-primary/40 bg-primary/10',
  ALLOW: 'border-primary/40 bg-primary/10',
}

interface Props {
  steps: TimelineStepData[]
  verdict?: string
}

export default function DecisionTimeline({ steps, verdict }: Props) {
  return (
    <div className="py-2">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const isDecisionStep = isLast && step.status === 'done' && verdict
        return (
          <TimelineStep
            key={step.id}
            step={step}
            isLast={isLast}
            verdictColor={isDecisionStep ? verdictColors[verdict] : undefined}
          />
        )
      })}
    </div>
  )
}
