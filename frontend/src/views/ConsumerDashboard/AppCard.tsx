import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TrustBadge from './TrustBadge'
import type { AppProfile } from '@/api/types'

interface AppCardProps {
  app: AppProfile
}

export default function AppCard({ app }: AppCardProps) {
  const permissions = app.permissions
    ? app.permissions.split(',').map((p) => p.trim()).filter(Boolean)
    : []

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{app.name}</CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <TrustBadge score={app.trust_score} />
            <Badge
              variant={app.is_active ? 'default' : 'destructive'}
              className="capitalize text-xs"
            >
              {app.is_active ? 'active' : 'suspended'}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
      </CardHeader>
      <CardContent>
        <p className="text-xs font-medium text-muted-foreground mb-1">Permissions</p>
        <div className="flex flex-wrap gap-1">
          {permissions.length > 0 ? permissions.map((p) => (
            <span
              key={p}
              className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-xs"
            >
              {p}
            </span>
          )) : (
            <span className="text-xs text-muted-foreground">None declared</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Registered {new Date(app.registered_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  )
}
