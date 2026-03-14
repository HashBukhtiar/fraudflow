import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import CyclingWord from './CyclingWord'
import { lazy, Suspense } from 'react'
const TDLogo3D = lazy(() => import('@/components/TDLogo3D'))

const features = [
  {
    num: '01',
    title: 'Behavior-Based Detection',
    description:
      'Monitors how third-party apps behave — not just how users transact — catching anomalies before damage occurs.',
    illustration: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-primary/60">
        <polyline points="10,60 30,60 40,20 50,50 60,35 70,55 80,30 90,45 110,45" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="80" cy="30" r="4" fill="currentColor" className="text-primary/80" stroke="none" />
        <line x1="80" y1="18" x2="80" y2="10" strokeDasharray="2 2" />
        <circle cx="80" cy="8" r="2.5" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Real-Time Decisions',
    description:
      'Every API call is inspected and scored instantly. APPROVE, FLAG, or BLOCK in milliseconds.',
    illustration: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-primary/60">
        <rect x="10" y="28" width="28" height="24" rx="3" />
        <text x="24" y="44" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" className="text-primary/80">API</text>
        <line x1="38" y1="40" x2="52" y2="40" strokeDasharray="3 2" />
        <circle cx="60" cy="40" r="10" />
        <line x1="70" y1="34" x2="84" y2="22" />
        <line x1="70" y1="40" x2="84" y2="40" />
        <line x1="70" y1="46" x2="84" y2="58" />
        <rect x="84" y="16" width="26" height="12" rx="2" />
        <rect x="84" y="34" width="26" height="12" rx="2" />
        <rect x="84" y="52" width="26" height="12" rx="2" />
        <text x="97" y="25" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none">OK</text>
        <text x="97" y="43" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none">FLAG</text>
        <text x="97" y="61" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none">BLOCK</text>
      </svg>
    ),
  },
  {
    num: '03',
    title: 'AI-Powered Verdicts',
    description:
      'Claude analyzes risk signals and memory context to produce human-readable fraud explanations.',
    illustration: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-primary/60">
        <circle cx="60" cy="40" r="10" fill="currentColor" className="text-primary" stroke="none" />
        <circle cx="60" cy="40" r="10" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
          const rad = (deg * Math.PI) / 180
          const x1 = 60 + 10 * Math.cos(rad)
          const y1 = 40 + 10 * Math.sin(rad)
          const x2 = 60 + 26 * Math.cos(rad)
          const y2 = 40 + 26 * Math.sin(rad)
          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} />
              <circle cx={x2} cy={y2} r="3" />
            </g>
          )
        })}
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Open Banking Ready',
    description:
      "Built for Canada's 2026 Open Banking launch — the fraud layer the ecosystem needs from day one.",
    illustration: (
      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-primary/60">
        <path d="M60 8 L90 22 L90 46 C90 62 60 72 60 72 C60 72 30 62 30 46 L30 22 Z" />
        <path d="M60 18 L80 28 L80 46 C80 57 60 64 60 64 C60 64 40 57 40 46 L40 28 Z" fill="currentColor" className="text-primary/20" />
        <rect x="52" y="36" width="16" height="14" rx="2" />
        <path d="M55 36 L55 32 C55 28.7 65 28.7 65 32 L65 36" />
        <circle cx="60" cy="43" r="2" fill="currentColor" stroke="none" className="text-primary" />
      </svg>
    ),
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
      <section className="max-w-5xl mx-auto px-8 lg:px-16 pt-24 pb-8 w-full">
        {/* Section label */}
        <div
          className="inline-flex items-center gap-3 text-sm text-muted-foreground mb-10"
          style={{ animation: 'var(--animate-fade-in)', animationDelay: '0.05s' }}
        >
          <span className="w-8 h-px bg-muted-foreground/50" />
          Capabilities
        </div>

        {/* Section title */}
        <h2
          className="text-5xl sm:text-6xl font-normal tracking-tight leading-[1.1] mb-20"
          style={{ animation: 'var(--animate-fade-up)', animationDelay: '0.15s' }}
        >
          Everything you need.<br />
          <span className="text-muted-foreground">Nothing you don't.</span>
        </h2>

        {/* Feature rows */}
        <div>
          {features.map((f, i) => (
            <div
              key={f.title}
              className="border-t border-border py-16 flex items-start justify-between gap-12"
              style={{ animation: 'var(--animate-fade-up)', animationDelay: `${0.25 + i * 0.12}s` }}
            >
              {/* Left: number */}
              <span className="text-xs text-muted-foreground/40 font-mono mt-2 w-6 shrink-0 tabular-nums">{f.num}</span>

              {/* Center: text */}
              <div className="flex-1">
                <h3 className="text-3xl font-normal tracking-tight mb-4 text-foreground">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed max-w-md">{f.description}</p>
              </div>

              {/* Right: illustration */}
              <div className="shrink-0 flex items-center justify-center w-32 h-20">
                {f.illustration}
              </div>
            </div>
          ))}
          <div className="border-t border-border" />
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
