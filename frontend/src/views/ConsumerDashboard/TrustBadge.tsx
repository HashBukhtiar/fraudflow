import { cn } from '@/lib/utils'

interface TrustBadgeProps {
  score: number
  className?: string
}

export default function TrustBadge({ score, className }: TrustBadgeProps) {
  const pct = Math.round(score * 100)

  const color =
    score >= 0.7
      ? 'bg-green-100 text-green-800 border-green-200'
      : score >= 0.4
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
          score >= 0.7
            ? 'bg-green-500'
            : score >= 0.4
              ? 'bg-yellow-500'
              : 'bg-red-500',
        )}
      />
      {pct}% trust
    </span>
  )
}
