import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { APICallLog, AppProfile } from '@/api/types'

interface CallFeedProps {
  calls: APICallLog[]
  apps: AppProfile[]
}

export default function CallFeed({ calls, apps }: CallFeedProps) {
  const appMap = Object.fromEntries(apps.map((a) => [(a as any).id, a]))

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Live API Call Feed</CardTitle>
          <span className="text-xs text-muted-foreground">{calls.length} calls</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[380px]">
          <table className="w-full text-sm">
            <thead className="border-b border-border sticky top-0 bg-card z-10">
              <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">App</th>
                <th className="text-left px-4 py-2.5 font-medium">Endpoint</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Hour</th>
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
                    <td className="px-4 py-2.5 font-medium text-sm">{app?.name ?? c.app_id}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {c.endpoint}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                      {c.time_of_day_hour}:00
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium border',
                          allowed
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20',
                        )}
                      >
                        {allowed ? 'allowed' : 'blocked'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">
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
