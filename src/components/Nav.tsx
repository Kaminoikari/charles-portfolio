import { useEffect, useRef, useState } from 'react'

const RAPID_CLICK_COUNT = 5
const RAPID_CLICK_WINDOW_MS = 2000
const NAV_SECTIONS = ['about', 'skills', 'experience', 'projects', 'blog'] as const

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const logoClickTimesRef = useRef<number[]>([])

  useEffect(() => {
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const navHeight = navRef.current?.offsetHeight ?? 72
    let y: number
    if (id === 'skills') {
      // Center the Universe section vertically in viewport
      const sectionHeight = el.offsetHeight
      const viewportHeight = window.innerHeight
      const offset = Math.max(0, (sectionHeight - viewportHeight) / 2)
      y = el.getBoundingClientRect().top + window.scrollY - navHeight + offset
    } else {
      y = el.getBoundingClientRect().top + window.scrollY - navHeight
    }
    const doScroll = () => window.scrollTo({ top: y, behavior: 'smooth' })
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(doScroll)
    } else {
      doScroll()
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label="Main navigation"
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md transition-all duration-500"
      style={{
        borderColor: scrolledPastHero ? 'var(--color-border)' : 'transparent',
        background: scrolledPastHero
          ? 'rgba(10,10,10,0.92)'
          : 'transparent',
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-12 md:py-4">
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' })
            const now = Date.now()
            const clicks = logoClickTimesRef.current
            clicks.push(now)
            while (clicks.length > 0 && now - clicks[0] > RAPID_CLICK_WINDOW_MS) {
              clicks.shift()
            }
            if (clicks.length >= RAPID_CLICK_COUNT) {
              clicks.length = 0
              window.dispatchEvent(new Event('easter-egg'))
            }
          }}
          aria-label="Charles Chen — scroll to top"
          className="cursor-pointer border-none bg-transparent text-lg font-bold tracking-widest text-white md:text-xl"
        >
          CHARLES CHEN
        </button>

        {/* Desktop nav */}
        <div className="hidden gap-8 md:flex">
          {NAV_SECTIONS.map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              aria-label={`Scroll to ${id} section`}
              className="group relative min-h-[44px] cursor-pointer border-none bg-transparent text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
            >
              {id}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:w-full" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-none bg-transparent md:hidden"
          >
            <div className="relative h-4 w-5">
              <span
                className="absolute left-0 block h-px w-full bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{
                  top: menuOpen ? '50%' : '0',
                  transform: menuOpen ? 'rotate(45deg)' : 'none',
                }}
              />
              <span
                className="absolute left-0 top-1/2 block h-px w-full bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{ opacity: menuOpen ? 0 : 1 }}
              />
              <span
                className="absolute left-0 block h-px w-full bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{
                  bottom: menuOpen ? 'auto' : '0',
                  top: menuOpen ? '50%' : 'auto',
                  transform: menuOpen ? 'rotate(-45deg)' : 'none',
                }}
              />
            </div>
          </button>

          <button
            onClick={() => {
              scrollTo('contact')
              setMenuOpen(false)
            }}
            aria-label="Scroll to contact section"
            className="min-h-[44px] cursor-pointer rounded-full border border-btn-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] uppercase tracking-[1.5px] text-white transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-btn-hover-bg hover:scale-105"
          >
            CONTACT ↗
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] md:hidden"
        style={{
          maxHeight: menuOpen ? `${NAV_SECTIONS.length * 52}px` : '0',
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <div className="flex flex-col border-t border-white/10 px-4 py-2">
          {NAV_SECTIONS.map((id) => (
            <button
              key={id}
              onClick={() => {
                scrollTo(id)
                setMenuOpen(false)
              }}
              className="min-h-[44px] cursor-pointer border-none bg-transparent text-left text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
            >
              {id}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
