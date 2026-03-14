import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FraudDecision, AppProfile } from '@/api/types'

interface DecisionDrawerProps {
  decision: FraudDecision | null
  apps: AppProfile[]
  open: boolean
  onClose: () => void
}

const verdictConfig: Record<string, string> = {
  APPROVE: 'bg-primary/10 text-primary border-primary/20',
  ALLOW: 'bg-primary/10 text-primary border-primary/20',
  FLAG: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  BLOCK: 'bg-destructive/10 text-destructive border-destructive/20',
}

export default function DecisionDrawer({ decision, apps, open, onClose }: DecisionDrawerProps) {
  const d = decision as any
  const app = apps.find((a) => (a as any).id === d?.app_id) as any

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {d && (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-base">Decision Detail</SheetTitle>
            </SheetHeader>
            <div className="space-y-5 text-sm">
              {/* Verdict */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'px-2.5 py-1 rounded-full border text-xs font-bold tracking-wider',
                    verdictConfig[d.verdict] ?? verdictConfig.BLOCK,
                  )}
                >
                  {d.verdict}
                </span>
                <span className="text-muted-foreground text-xs font-mono">
                  {Math.round(d.confidence * 100)}% confidence
                </span>
                {d.memory_context_used && (
                  <Badge variant="secondary" className="text-xs">memory hit</Badge>
                )}
              </div>

              {/* App */}
              {app && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                    App
                  </p>
                  <p className="font-medium">{app.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
                </div>
              )}

              {/* Explanation */}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Explanation
                </p>
                <p className="text-sm leading-relaxed text-foreground/80">{d.explanation}</p>
              </div>

              {/* Recommended action */}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Recommended Action
                </p>
                <p className="text-sm">{d.recommended_action}</p>
              </div>

              {/* Timestamp */}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Timestamp
                </p>
                <p className="text-sm font-mono">
                  {new Date(d.timestamp ?? d.decided_at).toLocaleString()}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
