import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TrustBadge from './TrustBadge'
import type { AppProfile } from '@/api/types'

interface AppCardProps {
  app: AppProfile
}

const statusVariant: Record<AppProfile['status'], 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  flagged: 'secondary',
  suspended: 'destructive',
}

export default function AppCard({ app }: AppCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{app.name}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <TrustBadge score={app.trust_score} />
            <Badge variant={statusVariant[app.status]} className="capitalize text-xs">
              {app.status}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground mb-1">Permissions</p>
        <div className="flex flex-wrap gap-1">
          {app.permissions_requested.map((p) => (
            <span
              key={p}
              className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs"
            >
              {p}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Registered {new Date(app.registration_date).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  )
}
