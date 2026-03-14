import { cn } from '@/lib/utils'
import type { AlertEvent } from '@/api/types'

interface AlertsFeedProps {
  alerts: AlertEvent[]
}

const severityConfig: Record<string, { border: string; dot: string; label: string }> = {
  low: { border: 'border-l-primary', dot: 'bg-primary', label: 'text-primary' },
  medium: { border: 'border-l-amber-500', dot: 'bg-amber-500', label: 'text-amber-600' },
  high: { border: 'border-l-destructive', dot: 'bg-destructive', label: 'text-destructive' },
  info: { border: 'border-l-primary', dot: 'bg-primary', label: 'text-primary' },
  warning: { border: 'border-l-amber-500', dot: 'bg-amber-500', label: 'text-amber-600' },
  critical: { border: 'border-l-destructive', dot: 'bg-destructive', label: 'text-destructive' },
}

export default function AlertsFeed({ alerts }: AlertsFeedProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recent Alerts
        </p>
        {alerts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
            No alerts.
          </p>
        )}
        {alerts.map((alert) => {
          const a = alert as any
          const cfg = severityConfig[a.severity] ?? severityConfig.info
          return (
            <div
              key={a.id}
              className={cn(
                'border border-border border-l-2 rounded-md px-3 py-2.5',
                cfg.border,
                !a.seen && 'bg-muted/30',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                  <span className={cn('text-xs font-semibold capitalize', cfg.label)}>
                    {a.severity}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(a.timestamp ?? a.triggered_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-foreground/80 pl-3">{a.message ?? a.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
