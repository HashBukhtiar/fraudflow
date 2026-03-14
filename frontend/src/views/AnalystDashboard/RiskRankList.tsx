import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TrustBadge from '@/views/ConsumerDashboard/TrustBadge'
import type { AppProfile } from '@/api/types'

interface RiskRankListProps {
  apps: AppProfile[]
}

export default function RiskRankList({ apps }: RiskRankListProps) {
  const sorted = [...apps].sort((a, b) => a.trust_score - b.trust_score)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Apps by Risk</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((app) => (
          <div
            key={app.id}
            className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0"
          >
            <div>
              <p className="text-sm font-medium">{app.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
            </div>
            <TrustBadge score={app.trust_score} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
