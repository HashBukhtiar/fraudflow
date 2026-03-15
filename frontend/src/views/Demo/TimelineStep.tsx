import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle2, Circle } from 'lucide-react'
import type { ReactNode } from 'react'

export type StepStatus = 'pending' | 'active' | 'done'

export interface TimelineStepData {
  id: string
  label: string
  status: StepStatus
  detail?: ReactNode
}

const statusIcon: Record<StepStatus, ReactNode> = {
  pending: <Circle className="w-5 h-5 text-muted-foreground/40" />,
  active: <Loader2 className="w-5 h-5 text-primary animate-spin" />,
  done: <CheckCircle2 className="w-5 h-5 text-primary" />,
}

interface Props {
  step: TimelineStepData
  isLast?: boolean
  verdictColor?: string
}

export default function TimelineStep({ step, isLast, verdictColor }: Props) {
  const isDone = step.status === 'done'
  const isActive = step.status === 'active'

  return (
    <div className="flex gap-4">
      {/* Vertical line + icon */}
      <div className="flex flex-col items-center">
        <div className="shrink-0">{statusIcon[step.status]}</div>
        {!isLast && (
          <div
            className={cn(
              'w-px flex-1 min-h-6 my-1',
              isDone ? 'bg-primary/40' : 'bg-border',
            )}
          />
        )}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: isDone || isActive ? 1 : 0.4,
          y: 0,
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={cn(
          'flex-1 rounded-lg border px-4 py-3 mb-3 transition-colors',
          isActive && 'border-primary/40 bg-primary/5',
          isDone && !verdictColor && 'border-border bg-muted/30',
          isDone && verdictColor,
          !isDone && !isActive && 'border-border/50 bg-card',
        )}
      >
        <p
          className={cn(
            'text-sm font-medium',
            isDone || isActive ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {step.label}
        </p>

        {isDone && step.detail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
            className="mt-2 text-sm text-muted-foreground space-y-1 overflow-hidden"
          >
            {step.detail}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
