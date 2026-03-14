import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AppProfile } from '@/api/types'

interface AppCardProps {
  app: AppProfile
}

const permissionLabels: Record<string, string> = {
  'read:accounts': 'View your accounts',
  'read:transactions': 'View transaction history',
  'write:payments': 'Make payments',
  'read:balances': 'View account balances',
  'write:consent': 'Manage consent settings',
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-primary/10 text-primary border-primary/20' },
  flagged: { label: 'Needs attention', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  suspended: { label: 'Suspended', className: 'bg-destructive/10 text-destructive border-destructive/20' },
}

const categoryLabel: Record<string, string> = {
  budgeting: 'Budgeting',
  payments: 'Payments',
  tax: 'Tax & Filing',
  lending: 'Lending',
  investing: 'Investing',
  other: 'Other',
}

// Stable color per app name
const avatarPalette = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
  'bg-rose-100 text-rose-700',
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return avatarPalette[h % avatarPalette.length]
}

function trustLabel(score: number) {
  if (score >= 0.7) return { label: 'Trusted', dot: 'bg-primary', text: 'text-primary' }
  if (score >= 0.4) return { label: 'Use with caution', dot: 'bg-amber-500', text: 'text-amber-600' }
  return { label: 'High risk', dot: 'bg-destructive', text: 'text-destructive' }
}

export default function AppCard({ app }: AppCardProps) {
  const a = app as any
  const status = statusConfig[a.status] ?? statusConfig.active
  const trust = trustLabel(a.trust_score)
  const initials = a.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const permissions: string[] = a.permissions_requested ?? (a.permissions ? a.permissions.split(',').map((s: string) => s.trim()) : [])

  return (
    <Card className="flex flex-col">
      <CardContent className="pt-5 pb-4 flex flex-col gap-4">
        {/* App header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
              avatarColor(a.name),
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm leading-tight">{a.name}</p>
              <span
                className={cn(
                  'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium',
                  status.className,
                )}
              >
                {status.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{categoryLabel[a.category] ?? a.category}</p>
          </div>
        </div>

        {/* Security level */}
        <div className="flex items-center gap-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', trust.dot)} />
          <span className={cn('text-xs font-medium', trust.text)}>{trust.label}</span>
        </div>

        {/* Permissions */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">This app can:</p>
          <ul className="space-y-1">
            {permissions.map((p: string) => (
              <li key={p} className="flex items-start gap-1.5 text-xs text-foreground/70">
                <span className="mt-0.5 w-3 h-3 rounded-full border border-border bg-muted shrink-0" />
                {permissionLabels[p] ?? p}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border mt-auto">
          <p className="text-xs text-muted-foreground">
            Connected {new Date(a.registration_date ?? a.registered_at).toLocaleDateString()}
          </p>
          <button className="text-xs text-muted-foreground hover:text-destructive transition-colors">
            Revoke
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
