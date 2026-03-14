import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  score: number
  className?: string
}

export default function TrustBadge({ score, className }: TrustBadgeProps) {
  // Backend stores trust_score on a 0–10 scale; normalise to 0–1 for display
  const normalised = score / 10
  const pct = Math.round(normalised * 100)

  const color =
    normalised >= 0.7
      ? 'bg-primary/10 text-primary border-primary/20'
      : normalised >= 0.4
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        : 'bg-destructive/10 text-destructive border-destructive/20'

  const dotColor =
    normalised >= 0.7 ? 'bg-primary' : normalised >= 0.4 ? 'bg-amber-500' : 'bg-destructive'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium',
        color,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColor)} />
      {pct}%
    </span>
  )
}
