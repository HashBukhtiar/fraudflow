import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  score: number
  className?: string
}

export default function TrustBadge({ score, className }: TrustBadgeProps) {
  const pct = Math.round(score * 100)

  const color =
    score >= 0.7
      ? 'bg-primary/10 text-primary border-primary/20'
      : score >= 0.4
        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        : 'bg-destructive/10 text-destructive border-destructive/20'

  const dotColor =
    score >= 0.7 ? 'bg-primary' : score >= 0.4 ? 'bg-amber-500' : 'bg-destructive'

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
