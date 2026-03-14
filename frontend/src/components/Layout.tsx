import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Moon, Sun, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/consumer', label: 'Consumer' },
  { to: '/analyst', label: 'Analyst' },
  { to: '/demo', label: 'Demo' },
]

export default function Layout() {
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header
        className={cn(
          'fixed z-50 top-0 left-0 right-0 transition-all duration-500',
          scrolled ? 'px-4 pt-3' : '',
        )}
      >
        <nav
          className={cn(
            'mx-auto max-w-[1400px] transition-all duration-500',
            scrolled
              ? 'bg-background/90 backdrop-blur-md border border-border shadow-lg rounded-2xl'
              : 'bg-transparent',
          )}
        >
          <div
            className={cn(
              'flex items-center justify-between transition-all duration-500 px-6 lg:px-8',
              scrolled ? 'h-14' : 'h-20',
            )}
          >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-1.5 group">
              <span className="font-semibold tracking-tight transition-all duration-500 text-xl">
                Fraud<span className="text-primary">Flow</span>
              </span>
              <span className="text-muted-foreground font-mono text-[10px] mt-1 transition-all duration-500">
                AI
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-10">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative group text-sm transition-colors duration-300',
                      isActive ? 'text-foreground' : 'text-foreground/60 hover:text-foreground',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      <span
                        className={cn(
                          'absolute -bottom-0.5 left-0 h-px bg-foreground transition-all duration-300',
                          isActive ? 'w-full' : 'w-0 group-hover:w-full',
                        )}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Desktop right */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={toggle}
                aria-label="Toggle theme"
                className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors duration-300"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <Link
                to="/consumer"
                className="bg-foreground text-background text-sm font-medium rounded-full px-5 py-1.5 hover:bg-foreground/90 transition-all duration-500"
              >
                Get started
              </Link>
            </div>

            {/* Mobile toggle */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggle}
                aria-label="Toggle theme"
                className="p-2 rounded-full text-foreground/60 hover:text-foreground transition-colors duration-300"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                className="p-2"
                aria-label="Toggle menu"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Mobile menu overlay ── */}
      <div
        className={cn(
          'md:hidden fixed inset-0 bg-background z-40 transition-all duration-500',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navItems.map((item, i) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'text-5xl font-semibold text-foreground hover:text-muted-foreground transition-all duration-500',
                  mobileOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                )}
                style={{ transitionDelay: mobileOpen ? `${i * 60}ms` : '0ms' }}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          <div
            className={cn(
              'flex gap-4 pt-8 border-t border-foreground/10 transition-all duration-500',
              mobileOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
            )}
            style={{ transitionDelay: mobileOpen ? `${navItems.length * 60}ms` : '0ms' }}
          >
            <Link
              to="/consumer"
              onClick={() => setMobileOpen(false)}
              className="flex-1 bg-foreground text-background font-medium rounded-full h-14 flex items-center justify-center text-base hover:bg-foreground/90 transition-all duration-500"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>

      {/* ── Page content — push down by header height ── */}
      <main className="flex-1 pt-20">
        <Outlet />
      </main>
    </div>
  )
}
