import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppProfile } from '@/api/types'

interface RiskRankListProps {
  apps: AppProfile[]
}

export default function RiskRankList({ apps }: RiskRankListProps) {
  const sorted = [...apps].sort((a, b) => (a as any).trust_score - (b as any).trust_score)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Apps by Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.map((app) => {
          const a = app as any
          const pct = Math.round(a.trust_score * 100)
          const barColor =
            a.trust_score >= 0.7 ? 'bg-primary' : a.trust_score >= 0.4 ? 'bg-amber-500' : 'bg-destructive'
          const textColor =
            a.trust_score >= 0.7
              ? 'text-primary'
              : a.trust_score >= 0.4
                ? 'text-amber-600'
                : 'text-destructive'

          return (
            <div key={a.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.category}</p>
                </div>
                <span className={cn('text-sm font-semibold tabular-nums font-mono', textColor)}>
                  {pct}%
                </span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
