import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppProfile } from '@/api/types'

interface RiskRankListProps {
  apps: AppProfile[]
}

export default function RiskRankList({ apps }: RiskRankListProps) {
  // Sort by risk descending (risk = 10 - trust_score, so lowest trust first)
  const sorted = [...apps].sort((a, b) => a.trust_score - b.trust_score)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Apps by Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.map((app) => {
          const riskScore = 10 - app.trust_score
          const pct = Math.round(riskScore * 10)
          const barColor =
            riskScore >= 7 ? 'bg-destructive' : riskScore >= 4 ? 'bg-amber-500' : 'bg-primary'
          const textColor =
            riskScore >= 7
              ? 'text-destructive'
              : riskScore >= 4
                ? 'text-amber-600'
                : 'text-primary'

          return (
            <div key={app.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{app.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
                </div>
                <span className={cn('text-sm font-semibold tabular-nums font-mono', textColor)}>
                  {riskScore.toFixed(1)}
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
