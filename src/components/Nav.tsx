import { useEffect, useRef, useState } from 'react'

const RAPID_CLICK_COUNT = 5
const RAPID_CLICK_WINDOW_MS = 2000

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)
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
    if ('startViewTransition' in document) {
      (document as any).startViewTransition(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label="Main navigation"
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl transition-all duration-500"
      style={{
        borderColor: scrolledPastHero ? '#1f2228' : 'transparent',
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
            // Keep only clicks within the time window
            while (clicks.length > 0 && now - clicks[0] > RAPID_CLICK_WINDOW_MS) {
              clicks.shift()
            }
            if (clicks.length >= RAPID_CLICK_COUNT) {
              clicks.length = 0
              window.dispatchEvent(new Event('easter-egg'))
            }
          }}
          className="cursor-pointer border-none bg-transparent text-lg font-bold tracking-widest text-white md:text-xl"
        >
          CHARLES CHEN
        </button>
        <div className="hidden gap-8 md:flex">
          {['about', 'skills', 'experience', 'projects', 'blog'].map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              aria-label={`Scroll to ${id} section`}
              className="group relative cursor-pointer border-none bg-transparent text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
            >
              {id}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:w-full" />
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollTo('contact')}
          aria-label="Scroll to contact section"
          className="cursor-pointer rounded-full border border-btn-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] uppercase tracking-[1.5px] text-white transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-btn-hover-bg hover:scale-105"
        >
          CONTACT ↗
        </button>
      </div>
    </nav>
  )
}
