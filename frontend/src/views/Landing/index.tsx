import { Link } from 'react-router-dom'
import { Shield, Zap, Brain, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CyclingWord from './CyclingWord'
import { lazy, Suspense } from 'react'
const TDLogo3D = lazy(() => import('@/components/TDLogo3D'))

const features = [
  {
    icon: Shield,
    title: 'Behavior-Based Detection',
    description:
      'Monitors how third-party apps behave — not just how users transact — catching anomalies before damage occurs.',
  },
  {
    icon: Zap,
    title: 'Real-Time Decisions',
    description:
      'Every API call is inspected and scored instantly. APPROVE, FLAG, or BLOCK in milliseconds.',
  },
  {
    icon: Brain,
    title: 'AI-Powered Verdicts',
    description:
      'Claude analyzes risk signals and memory context to produce human-readable fraud explanations.',
  },
  {
    icon: Lock,
    title: 'Open Banking Ready',
    description:
      "Built for Canada's 2026 Open Banking launch — the fraud layer the ecosystem needs from day one.",
  },
]

export default function Landing() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* 3D logo — right half background */}
        <div className="absolute right-0 top-0 w-2/3 h-full select-none" style={{ zIndex: 0 }}>
          <Suspense fallback={null}>
            <TDLogo3D />
          </Suspense>
        </div>

        {/* subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            zIndex: 1,
          }}
        />

        {/* Left-aligned text content — pointer-events-none so canvas underneath gets drag events */}
        <div className="relative z-10 max-w-6xl mx-auto px-8 lg:px-16 py-24 w-full pointer-events-none">
          <div
            className="inline-flex items-center gap-3 text-sm text-muted-foreground mb-8"
            style={{ animation: 'var(--animate-fade-in)', animationDelay: '0.1s' }}
          >
            <span className="w-8 h-px bg-muted-foreground/50" />
            Built for Canada's Open Banking future
          </div>

          <h1
            className="text-6xl sm:text-8xl font-normal tracking-tight leading-[1.05] mb-6 max-w-2xl"
            style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.15s' }}
          >
            The AI built to{' '}
            <CyclingWord />
          </h1>

          <p
            className="max-w-lg text-muted-foreground text-xl leading-relaxed"
            style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.45s' }}
          >
            FraudFlow sits between your bank and third-party fintech apps,
            watching how apps behave. When an app acts outside its declared
            purpose, we catch it before your money moves.
          </p>

          <div
            className="flex items-center gap-3 mt-10 pointer-events-auto"
            style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.6s' }}
          >
            <Button asChild size="lg">
              <Link to="/consumer">View My Apps</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/analyst">Analyst View</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20 w-full">
        <h2
          className="text-2xl font-semibold text-center mb-12 tracking-tight"
          style={{ animation: 'var(--animate-fade-up)' }}
        >
          How FraudFlow works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 space-y-3"
              style={{
                animation: 'var(--animate-fade-up)',
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <f.icon size={18} className="text-primary" />
              </div>
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-border py-16 text-center px-6">
        <h2 className="text-2xl font-semibold mb-3 tracking-tight">See it in action</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
          Run one of the three scripted fraud scenarios and watch FraudFlow detect and block in real time.
        </p>
        <Button asChild size="lg">
          <Link to="/demo">Run a Demo Scenario</Link>
        </Button>
      </section>
    </div>
  )
}
