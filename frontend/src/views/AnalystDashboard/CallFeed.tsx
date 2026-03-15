import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { APICallLog, AppProfile, FraudDecision } from '@/api/types'

interface CallFeedProps {
  calls: APICallLog[]
  apps: AppProfile[]
  decisions: FraudDecision[]
}

function timeAgo(iso: string) {
  // Backend returns naive-UTC timestamps (no Z suffix) — force UTC interpretation
  const utcIso = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  const diff = Math.floor((Date.now() - new Date(utcIso).getTime()) / 1000)
  if (diff < 0) return 'Just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const scenarioLabels: Record<string, string> = {
  rogue_budgeting_app:   'Off-hours access',
  payment_anomaly:       'Structuring',
  social_engineering:    'New app risk',
}

export default function CallFeed({ calls, apps, decisions }: CallFeedProps) {
  // Key by app_id (string) — the FK used in APICallLog
  const appMap = Object.fromEntries(apps.map((a) => [a.app_id, a]))

  // Decisions sorted oldest-first per app — used to find the active verdict at call time
  const decisionsByApp: Record<string, FraudDecision[]> = {}
  for (const d of decisions) {
    if (!decisionsByApp[d.app_id]) decisionsByApp[d.app_id] = []
    decisionsByApp[d.app_id].push(d)
  }
  // decisions arrive newest-first from backend — reverse to get oldest-first
  for (const key of Object.keys(decisionsByApp)) {
    decisionsByApp[key].reverse()
  }

  // Return the verdict that was active at the time a call was made.
  // i.e. the most recent decision whose decided_at <= call.timestamp + 10s buffer
  const verdictAtTime = (appId: string, callTimestamp: string): string => {
    const appDecisions = decisionsByApp[appId]
    if (!appDecisions?.length) return 'ALLOW'
    const callMs = new Date(callTimestamp.endsWith('Z') ? callTimestamp : callTimestamp + 'Z').getTime()
    let active = 'ALLOW'
    for (const d of appDecisions) {
      const decidedMs = new Date(d.decided_at.endsWith('Z') ? d.decided_at : d.decided_at + 'Z').getTime()
      // Pipeline runs slightly after the calls that triggered it — allow 15s window
      if (decidedMs <= callMs + 15_000) active = d.verdict
      else break
    }
    return active
  }

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
                const app = appMap[call.app_id]
                const verdict = verdictAtTime(call.app_id, call.timestamp)
                const rowHighlight =
                  verdict === 'BLOCK' ? 'bg-destructive/5' :
                  verdict === 'FLAG'  ? 'bg-amber-500/5' : ''
                const badgeClass =
                  verdict === 'BLOCK' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                  verdict === 'FLAG'  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                       'bg-primary/10 text-primary border-primary/20'
                const badgeLabel =
                  verdict === 'BLOCK' ? 'Blocked' :
                  verdict === 'FLAG'  ? 'Flagged' : 'Allowed'
                return (
                  <tr
                    key={call.id}
                    className={cn('border-b border-border last:border-0', rowHighlight)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm leading-tight">{app?.name ?? call.app_id}</p>
                      {call.scenario_tag && (
                        <span className="text-xs text-amber-600 font-medium">
                          {scenarioLabels[call.scenario_tag] ?? call.scenario_tag}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {call.endpoint}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {timeAgo(call.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', badgeClass)}>
                        {badgeLabel}
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
