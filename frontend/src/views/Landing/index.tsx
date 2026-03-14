import { Link } from 'react-router-dom'
import { Shield, Zap, Brain, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CyclingWord from './CyclingWord'

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
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-16 overflow-hidden">
        {/* subtle grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground mb-8"
          style={{ animation: 'var(--animate-fade-in)', animationDelay: '0.1s' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Built for Canada's Open Banking future
        </div>

        <h1
          className="text-5xl sm:text-7xl font-semibold tracking-tight leading-[1.1] mb-4"
          style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.15s' }}
        >
          The AI built to{' '}
          <CyclingWord />
        </h1>

        <p
          className="max-w-xl text-muted-foreground text-lg mt-4 leading-relaxed"
          style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.55s' }}
        >
          FraudFlow sits between your bank and third-party fintech apps, watching
          how apps behave. When an app acts outside its declared purpose,
          we catch it before your money moves.
        </p>

        <div
          className="flex items-center gap-3 mt-8"
          style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.7s' }}
        >
          <Button asChild size="lg">
            <Link to="/consumer">View My Apps</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/analyst">Analyst View</Link>
          </Button>
        </div>

        {/* 3D logo placeholder */}
        <div
          className="mt-16 w-full max-w-lg mx-auto h-72 rounded-2xl border border-border bg-muted/30 flex items-center justify-center"
          style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.85s' }}
        >
          <p className="text-sm text-muted-foreground">[ 3D TD Bank logo goes here ]</p>
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
