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
      ? 'bg-green-100 text-green-800 border-green-200'
      : normalised >= 0.4
        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
        : 'bg-red-100 text-red-800 border-red-200'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold',
        color,
        className,
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          normalised >= 0.7
            ? 'bg-green-500'
            : normalised >= 0.4
              ? 'bg-yellow-500'
              : 'bg-red-500',
        )}
      />
      {pct}% trust
    </span>
  )
}
