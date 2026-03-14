import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { FraudDecision, AppProfile } from '@/api/types'

interface DecisionDrawerProps {
  decision: FraudDecision | null
  apps: AppProfile[]
  open: boolean
  onClose: () => void
}

const verdictStyles: Record<FraudDecision['verdict'], string> = {
  ALLOW: 'bg-green-100 text-green-800 border-green-200',
  FLAG:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  BLOCK: 'bg-red-100 text-red-800 border-red-200',
}

export default function DecisionDrawer({ decision, apps, open, onClose }: DecisionDrawerProps) {
  const app = apps.find((a) => a.app_id === decision?.app_id)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        {decision && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle>Decision Detail</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full border text-xs font-bold tracking-wide',
                    verdictStyles[decision.verdict],
                  )}
                >
                  {decision.verdict}
                </span>
                <span className="text-muted-foreground">
                  {Math.round(decision.confidence * 100)}% confidence
                </span>
              </div>

              {app && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">App</p>
                  <p className="font-medium">{app.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{app.category}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Explanation</p>
                <p className="leading-relaxed">{decision.explanation}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Recommended Action</p>
                <p>{decision.recommended_action}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Timestamp</p>
                <p>{new Date(decision.decided_at).toLocaleString()}</p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
