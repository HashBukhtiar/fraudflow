import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AlertEvent } from '@/api/types'

interface AlertsFeedProps {
  alerts: AlertEvent[]
}

const severityStyles: Record<AlertEvent['severity'], string> = {
  low: 'bg-blue-50 border-blue-200 text-blue-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  high: 'bg-red-50 border-red-200 text-red-800',
}

export default function AlertsFeed({ alerts }: AlertsFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground">No alerts yet.</p>
        )}
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              severityStyles[alert.severity],
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium capitalize">{alert.severity}</span>
              <span className="text-xs opacity-70">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-0.5 text-xs">{alert.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
