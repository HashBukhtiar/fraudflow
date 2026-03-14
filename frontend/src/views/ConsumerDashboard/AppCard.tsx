import { Card, CardContent, CardHeader } from '@/components/ui/card'
import TrustBadge from './TrustBadge'
import { cn } from '@/lib/utils'
import type { AppProfile } from '@/api/types'

interface AppCardProps {
  app: AppProfile
}

const statusConfig: Record<string, string> = {
  active: 'bg-primary/10 text-primary border-primary/20',
  flagged: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  suspended: 'bg-destructive/10 text-destructive border-destructive/20',
}

export default function AppCard({ app }: AppCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm leading-tight">{app.name}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{app.category}</p>
          </div>
          <span
            className={cn(
              'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium',
              statusConfig[app.status],
            )}
          >
            {app.status}
          </span>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Trust score</span>
            <TrustBadge score={app.trust_score} />
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                app.trust_score >= 0.7
                  ? 'bg-primary'
                  : app.trust_score >= 0.4
                    ? 'bg-amber-500'
                    : 'bg-destructive',
              )}
              style={{ width: `${Math.round(app.trust_score * 100)}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-1.5">Permissions</p>
        <div className="flex flex-wrap gap-1">
          {app.permissions_requested.map((p) => (
            <span
              key={p}
              className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground font-mono text-xs"
            >
              {p}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-2.5 border-t border-border">
          Registered {new Date(app.registration_date).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  )
}
