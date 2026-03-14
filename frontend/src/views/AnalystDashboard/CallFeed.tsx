import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { APICallLog, AppProfile } from '@/api/types'

interface CallFeedProps {
  calls: APICallLog[]
  apps: AppProfile[]
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const scenarioLabels: Record<string, string> = {
  rogue_app: 'Rogue app',
  transaction_anomaly: 'Anomaly',
  social_engineering: 'Social eng.',
}

export default function CallFeed({ calls, apps }: CallFeedProps) {
  const appMap = Object.fromEntries(apps.map((a) => [(a as any).id, a]))

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">API Call Feed</CardTitle>
            {/* Live pulse */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{calls.length} calls</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[360px]">
          <table className="w-full text-sm">
            <thead className="border-b border-border sticky top-0 bg-card z-10">
              <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">App</th>
                <th className="text-left px-4 py-2.5 font-medium">Endpoint</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">When</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const c = call as any
                const app = appMap[c.app_id] as any
                const allowed = c.allowed ?? !c.flagged
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      !allowed && 'bg-destructive/5',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm leading-tight">{app?.name ?? c.app_id}</p>
                      {c.scenario_tag && (
                        <span className="text-xs text-amber-600 font-medium">
                          {scenarioLabels[c.scenario_tag] ?? c.scenario_tag}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {c.endpoint}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {timeAgo(c.timestamp ?? c.triggered_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium border',
                          allowed
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20',
                        )}
                      >
                        {allowed ? 'Allowed' : 'Blocked'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-xs">
                    No API calls logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
