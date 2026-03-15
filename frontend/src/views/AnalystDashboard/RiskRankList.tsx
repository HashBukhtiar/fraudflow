import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppProfile } from '@/api/types'

interface RiskRankListProps {
  apps: AppProfile[]
}

export default function RiskRankList({ apps }: RiskRankListProps) {
  // trust_score is 0–10; lower score = higher risk, so sort ascending
  const sorted = [...apps].sort((a, b) => a.trust_score - b.trust_score)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Apps by Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.map((app) => {
          // trust_score is 0–10; convert to percentage for display
          const pct = Math.round(app.trust_score * 10)
          const barColor =
            app.trust_score >= 7 ? 'bg-primary' : app.trust_score >= 4 ? 'bg-amber-500' : 'bg-destructive'
          const textColor =
            app.trust_score >= 7
              ? 'text-primary'
              : app.trust_score >= 4
                ? 'text-amber-600'
                : 'text-destructive'

          return (
            <div key={app.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{app.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
                </div>
                <span className={cn('text-sm font-semibold tabular-nums font-mono', textColor)}>
                  {app.trust_score.toFixed(1)}
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
