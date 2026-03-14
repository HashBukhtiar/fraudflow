import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import CyclingWord from './CyclingWord'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
const TDLogo3D = lazy(() => import('@/components/TDLogo3D'))

const features = [
  {
    num: '01',
    title: 'Behavior-Based Detection',
    description: 'Monitors how third-party apps behave — not just how users transact — catching anomalies before damage occurs.',
    visual: 'detect',
  },
  {
    num: '02',
    title: 'Real-Time Decisions',
    description: 'Every API call is inspected and scored instantly. APPROVE, FLAG, or BLOCK in milliseconds.',
    visual: 'decisions',
  },
  {
    num: '03',
    title: 'AI-Powered Verdicts',
    description: 'Claude analyzes risk signals and memory context to produce human-readable fraud explanations.',
    visual: 'ai',
  },
  {
    num: '04',
    title: 'Open Banking Ready',
    description: "Built for Canada's 2026 Open Banking launch — the fraud layer the ecosystem needs from day one.",
    visual: 'banking',
  },
]

function DetectVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-primary">
      <defs>
        <clipPath id="detectClip">
          <rect x="20" y="20" width="160" height="120" rx="4" />
        </clipPath>
      </defs>
      <rect x="20" y="20" width="160" height="120" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <g clipPath="url(#detectClip)">
        {[0,1,2,3,4,5].map((i) => (
          <rect key={i} x="30" y={35 + i * 16} width="140" height="10" rx="2" fill="currentColor" opacity="0.15">
            <animate attributeName="opacity" values="0.15;0.7;0.15" dur="2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
            <animate attributeName="width" values="30;140;30" dur="2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>
      <circle cx="100" cy="155" r="3" fill="currentColor" opacity="0.4">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function DecisionsVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="15" y="60" width="36" height="28" rx="3" opacity="0.5" />
      <text x="33" y="78" textAnchor="middle" fontSize="9" fill="currentColor" stroke="none" opacity="0.8">API</text>
      <line x1="51" y1="74" x2="68" y2="74" strokeDasharray="3 2">
        <animate attributeName="stroke-dashoffset" values="0;-10" dur="0.6s" repeatCount="indefinite" />
      </line>
      <circle cx="80" cy="74" r="13" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <line x1="93" y1="66" x2="108" y2="48" />
      <line x1="93" y1="74" x2="108" y2="74" />
      <line x1="93" y1="82" x2="108" y2="100" />
      {[['OK', 42], ['FLAG', 68], ['BLOCK', 94]].map(([label, y]) => (
        <g key={label as string}>
          <rect x="108" y={(y as number) - 10} width="42" height="18" rx="3" opacity="0.3">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" begin={`${(y as number) * 0.01}s`} repeatCount="indefinite" />
          </rect>
          <text x="129" y={(y as number) + 4} textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" opacity="0.9">{label}</text>
        </g>
      ))}
    </svg>
  )
}

function AIVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-primary" fill="none" stroke="currentColor">
      <circle cx="100" cy="80" r="13" fill="currentColor" opacity="0.8">
        <animate attributeName="r" values="13;16;13" dur="2s" repeatCount="indefinite" />
      </circle>
      {[0,1,2,3,4,5].map((i) => {
        const angle = (i * 60) * (Math.PI / 180)
        const r = 48
        return (
          <g key={i}>
            <line x1="100" y1="80" x2={100 + Math.cos(angle) * r} y2={80 + Math.sin(angle) * r} strokeWidth="1" opacity="0.3">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2s" begin={`${i * 0.33}s`} repeatCount="indefinite" />
            </line>
            <circle cx={100 + Math.cos(angle) * r} cy={80 + Math.sin(angle) * r} r="6" strokeWidth="1.5">
              <animate attributeName="r" values="6;9;6" dur="2s" begin={`${i * 0.33}s`} repeatCount="indefinite" />
            </circle>
          </g>
        )
      })}
      <circle cx="100" cy="80" r="28" fill="none" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="20;65" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function BankingVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M100 18 L152 40 L152 92 Q152 134 100 148 Q48 134 48 92 L48 40 Z" opacity="0.4" />
      <path d="M100 34 L136 52 L136 88 Q136 118 100 130 Q64 118 64 88 L64 52 Z" fill="currentColor" opacity="0.1">
        <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2s" repeatCount="indefinite" />
      </path>
      <rect x="84" y="72" width="32" height="28" rx="3" fill="currentColor" opacity="0.8" />
      <path d="M90 72 L90 62 Q90 52 100 52 Q110 52 110 62 L110 72" strokeLinecap="round" />
      <circle cx="100" cy="85" r="4" fill="white" stroke="none" />
      <rect x="98" y="87" width="4" height="8" fill="white" stroke="none" />
      <line x1="58" y1="70" x2="142" y2="70" opacity="0">
        <animate attributeName="y1" values="38;128;38" dur="3s" repeatCount="indefinite" />
        <animate attributeName="y2" values="38;128;38" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite" />
      </line>
    </svg>
  )
}

function FeatureVisual({ type }: { type: string }) {
  switch (type) {
    case 'detect': return <DetectVisual />
    case 'decisions': return <DecisionsVisual />
    case 'ai': return <AIVisual />
    case 'banking': return <BankingVisual />
    default: return null
  }
}

function FeatureRow({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`group border-t border-foreground/10 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-20">
        <div className="shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{feature.num}</span>
        </div>
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-3xl lg:text-4xl font-normal tracking-tight mb-4 group-hover:translate-x-2 transition-transform duration-500">
              {feature.title}
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">{feature.description}</p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <div className="w-48 h-40">
              <FeatureVisual type={feature.visual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CapabilitiesSection() {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-8 lg:px-16" ref={ref}>
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Capabilities
          </span>
          <h2
            className={`text-5xl lg:text-6xl font-normal tracking-tight leading-[1.1] transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Everything you need.
            <br />
            <span className="text-muted-foreground">Nothing you don't.</span>
          </h2>
        </div>
        <div>
          {features.map((f, i) => (
            <FeatureRow key={f.num} feature={f} index={i} />
          ))}
          <div className="border-t border-foreground/10" />
        </div>
      </div>
    </section>
  )
}

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
      <CapabilitiesSection />

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
