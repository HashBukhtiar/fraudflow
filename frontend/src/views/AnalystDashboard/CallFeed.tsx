import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { APICallLog, AppProfile } from '@/api/types'

interface CallFeedProps {
  calls: APICallLog[]
  apps: AppProfile[]
}

export default function CallFeed({ calls, apps }: CallFeedProps) {
  const appMap = Object.fromEntries(apps.map((a) => [a.id, a]))

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Live API Call Feed</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          <table className="w-full text-sm">
            <thead className="border-b border-border sticky top-0 bg-card z-10">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">App</th>
                <th className="text-left px-4 py-2 font-medium">Endpoint</th>
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => {
                const app = appMap[call.app_id]
                return (
                  <tr
                    key={call.id}
                    className={cn(
                      'border-b border-border last:border-0',
                      !call.allowed && 'bg-red-50/50',
                    )}
                  >
                    <td className="px-4 py-2 font-medium">{app?.name ?? call.app_id}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {call.endpoint}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-medium',
                          call.allowed
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700',
                        )}
                      >
                        {call.allowed ? 'allowed' : 'blocked'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">
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
