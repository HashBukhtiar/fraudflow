import { cn } from '@/lib/utils'
import type { AlertEvent } from '@/api/types'

interface AlertsFeedProps {
  alerts: AlertEvent[]
}

const severityConfig: Record<string, { border: string; dot: string; label: string; bg: string }> = {
  info:     { border: 'border-l-primary',     dot: 'bg-primary',     label: 'text-primary',     bg: '' },
  warning:  { border: 'border-l-amber-500',   dot: 'bg-amber-500',   label: 'text-amber-600',   bg: '' },
  critical: { border: 'border-l-destructive', dot: 'bg-destructive', label: 'text-destructive',  bg: 'bg-destructive/5' },
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export default function AlertsFeed({ alerts }: AlertsFeedProps) {
  const unseen = alerts.filter((a) => !a.resolved).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm">Security Notifications</p>
          {unseen > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {unseen}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{alerts.length} total</p>
      </div>

      {alerts.length === 0 && (
        <div className="py-10 text-center border border-dashed border-border rounded-xl">
          <p className="text-sm font-medium text-muted-foreground">All clear</p>
          <p className="text-xs text-muted-foreground mt-1">No security alerts on your account.</p>
        </div>
      )}

      <div className="space-y-2">
        {alerts.map((alert) => {
          const cfg = severityConfig[alert.severity] ?? severityConfig.info
          return (
            <div
              key={alert.id}
              className={cn(
                'flex gap-3 border border-border border-l-2 rounded-lg px-4 py-3',
                cfg.border,
                cfg.bg,
                !alert.resolved && 'bg-muted/20',
              )}
            >
              <div className="mt-0.5 shrink-0">
                <span className={cn('block w-2 h-2 rounded-full mt-1', cfg.dot)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground/85 leading-snug">{alert.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{timeAgo(alert.triggered_at)}</p>
              </div>
              {!alert.resolved && (
                <span className="shrink-0 text-xs font-medium text-muted-foreground mt-0.5">New</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
