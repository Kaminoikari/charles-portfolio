import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LOCALES,
  LOCALE_LABELS,
  useLocale,
  useLocalePath,
  useT,
  type Locale,
  type StringKey,
} from '../i18n'

const RAPID_CLICK_COUNT = 5
const RAPID_CLICK_WINDOW_MS = 2000
const NAV_SECTIONS = ['about', 'skills', 'experience', 'projects', 'blog'] as const
const NAV_SECTION_KEY: Record<(typeof NAV_SECTIONS)[number], StringKey> = {
  about: 'nav.about',
  skills: 'nav.skills',
  experience: 'nav.experience',
  projects: 'nav.projects',
  blog: 'nav.blog',
}

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const logoClickTimesRef = useRef<number[]>([])
  const location = useLocation()
  const navigate = useNavigate()
  const localePath = useLocalePath()
  const t = useT()
  const { locale, setLocale } = useLocale()
  // Home is locale-aware: `/`, `/zh-TW`, `/zh-TW/`, `/ja`, `/ja/` all count.
  const homeUrl = localePath('/')
  const isHome = location.pathname === homeUrl || location.pathname === homeUrl + '/'

  useEffect(() => {
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Handle hash-based scroll after navigating back to home
  useEffect(() => {
    if (isHome && location.hash) {
      const id = location.hash.slice(1)
      // Small delay to let the page render before scrolling
      const timer = setTimeout(() => {
        const el = document.getElementById(id)
        if (el) {
          const navHeight = headerRef.current?.offsetHeight ?? 72
          const y = el.getBoundingClientRect().top + window.scrollY - navHeight
          window.scrollTo({ top: y, behavior: 'smooth' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isHome, location.hash])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const navHeight = headerRef.current?.offsetHeight ?? 72
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
      aria-label={t('nav.mainAriaLabel')}
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-md transition-all duration-500"
      style={{
        borderColor: scrolledPastHero ? 'var(--color-border)' : 'transparent',
        background: scrolledPastHero
          ? 'rgba(10,10,10,0.92)'
          : 'transparent',
      }}
    >
      <div ref={headerRef} className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-12 md:py-4">
        <button
          onClick={() => {
            if (!isHome) {
              navigate(homeUrl)
              window.scrollTo({ top: 0, behavior: 'smooth' })
              return
            }
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
          aria-label={t('brand.homeAriaLabel')}
          className="cursor-pointer border-none bg-transparent text-lg font-bold tracking-widest text-white md:text-xl"
        >
          {t('brand.name')}
        </button>

        {/* Desktop nav */}
        <div className="hidden gap-8 md:flex">
          {NAV_SECTIONS.map((id) => (
            <button
              key={id}
              onClick={() => {
                if (isHome) {
                  scrollTo(id)
                } else {
                  navigate(localePath(`/#${id}`))
                }
              }}
              aria-label={t('nav.sectionAriaLabel', { section: t(NAV_SECTION_KEY[id]) })}
              className="group relative min-h-[44px] cursor-pointer border-none bg-transparent text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
            >
              {t(NAV_SECTION_KEY[id])}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:w-full" />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Language switcher — desktop */}
          <div
            role="group"
            aria-label={t('nav.languageGroupLabel')}
            className="hidden items-center gap-1 rounded-full border border-btn-border px-1 py-0.5 md:flex"
          >
            {LOCALES.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                aria-pressed={locale === loc}
                className={`min-h-[28px] cursor-pointer rounded-full border-none bg-transparent px-2.5 py-1 font-mono text-[11px] tracking-[1px] transition-colors duration-200 ${
                  locale === loc ? 'text-white' : 'text-text-muted hover:text-white'
                }`}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (isHome) {
                scrollTo('contact')
              } else {
                navigate(localePath('/#contact'))
              }
              setMenuOpen(false)
            }}
            aria-label={t('nav.contactAriaLabel')}
            className="min-h-[44px] cursor-pointer rounded-full border border-btn-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] uppercase tracking-[1.5px] text-white transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-btn-hover-bg hover:scale-105"
          >
            {t('nav.contact')}
          </button>

          {/* Hamburger — mobile only, rightmost */}
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
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
        </div>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] md:hidden"
        style={{
          maxHeight: menuOpen ? `${NAV_SECTIONS.length * 52 + 64}px` : '0',
          opacity: menuOpen ? 1 : 0,
        }}
      >
        <div className="flex flex-col border-t border-white/10 px-4 py-2">
          {NAV_SECTIONS.map((id) => (
            <button
              key={id}
              onClick={() => {
                if (isHome) {
                  scrollTo(id)
                } else {
                  navigate(localePath(`/#${id}`))
                }
                setMenuOpen(false)
              }}
              className="min-h-[44px] cursor-pointer border-none bg-transparent text-left text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
            >
              {t(NAV_SECTION_KEY[id])}
            </button>
          ))}

          {/* Language switcher — mobile */}
          <div
            role="group"
            aria-label={t('nav.languageGroupLabel')}
            className="mt-2 flex gap-1 border-t border-white/10 pt-3 pb-1"
          >
            {LOCALES.map((loc: Locale) => (
              <button
                key={loc}
                onClick={() => {
                  setLocale(loc)
                  setMenuOpen(false)
                }}
                aria-pressed={locale === loc}
                className={`min-h-[36px] cursor-pointer rounded-full border bg-transparent px-3 py-1 font-mono text-[11px] tracking-[1px] transition-colors duration-200 ${
                  locale === loc
                    ? 'border-white/40 text-white'
                    : 'border-white/15 text-text-muted hover:text-white'
                }`}
              >
                {LOCALE_LABELS[loc]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
