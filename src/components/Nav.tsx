import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { inlineNavTakesOver } from './navBreakpoint'
import {
  LOCALES,
  LOCALE_LABELS,
  useLocale,
  useLocalePath,
  useT,
  type Locale,
  type StringKey,
} from '../i18n'

// The nav is site chrome and sits above the page at this layer. It is exported
// because the docked avatar has to stay BELOW it: her canvas grew past the top
// of the screen on 2026-08-21 so that her figure could match the chat panel's
// height, and `stretch` puts a hand 43px below the canvas top — inside this bar
// on any window under ~800px tall. Equal z-indexes are decided by DOM order and
// the widget mounts after the nav, so without the two being held apart a raised
// hand is painted over the nav links. See AVATAR_DOCKED_Z_CLASS.
export const NAV_Z_CLASS = 'z-50'

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
  const menuRef = useRef<HTMLDivElement>(null)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuHeight, setMenuHeight] = useState(0)
  const logoClickTimesRef = useRef<number[]>([])
  const hamburgerRef = useRef<HTMLButtonElement>(null)
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

  // An open panel has to close once the inline nav takes over, or it hangs below
  // it. inlineNavTakesOver reads that decision off the CSS instead of restating
  // the breakpoint here; see navBreakpoint.ts for why.
  useEffect(() => {
    if (!menuOpen) return
    const onResize = () => {
      if (inlineNavTakesOver(hamburgerRef.current)) setMenuOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [menuOpen])

  // Measure the panel on the way open instead of predicting its height from an
  // item count: the collapsed panel is clipped, not unmounted, so its content
  // height is readable at any time and stays right when items, padding, locale,
  // or fonts change.
  const toggleMenu = () => {
    if (!menuOpen) setMenuHeight(menuRef.current?.scrollHeight ?? 0)
    setMenuOpen(!menuOpen)
  }

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
          // Every route into this effect is an ARRIVAL at the home route with a
          // section hash — a shared deep link, a section link followed from
          // another page, or the skip link — and all of them start at the top of
          // a freshly mounted page. Jump: animating thousands of pixels is
          // disorienting, and in-page section clicks never come through here
          // (they call scrollTo() below, which keeps its smooth glide).
          // 'instant', not 'auto': index.css sets `html { scroll-behavior: smooth }`
          // and 'auto' defers to that computed value, so it would animate too.
          window.scrollTo({ top: y, behavior: 'instant' })
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
    // Straight to scrollTo — never through document.startViewTransition. The
    // transition freezes rendering to capture its snapshots while a smooth
    // scroll needs rendering frames to advance, so the two deadlock until
    // Chrome's 4s DOM-update timeout aborts the transition; every nav click
    // froze the page for ~4s before the scroll ran. A transition adds nothing
    // here anyway: both snapshots show the pre-scroll viewport.
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  return (
    <nav
      ref={navRef}
      aria-label={t('nav.mainAriaLabel')}
      className={`fixed top-0 left-0 right-0 ${NAV_Z_CLASS} border-b backdrop-blur-md`}
      style={{
        transition: 'background-color 300ms ease, border-color 300ms ease',
        borderColor: scrolledPastHero || menuOpen ? 'var(--color-border)' : 'transparent',
        background: menuOpen
          ? 'var(--color-bg-primary)'
          : scrolledPastHero
            ? 'color-mix(in srgb, var(--color-bg-primary) 92%, transparent)'
            : 'transparent',
      }}
    >
      <div ref={headerRef} className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 md:px-12 md:py-4">
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

        {/* Inline nav — only from `xl`, the narrowest breakpoint the full row fits in;
            see navBreakpoint.ts */}
        <div className="hidden gap-8 xl:flex">
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
          <button
            onClick={() => navigate(localePath('/changelog'))}
            className="group relative min-h-[44px] cursor-pointer border-none bg-transparent text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
          >
            {t('nav.changelog')}
            <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:w-full" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Language switcher — desktop */}
          <div
            role="group"
            aria-label={t('nav.languageGroupLabel')}
            className="hidden items-center gap-1 rounded-full border border-btn-border px-1 py-0.5 xl:flex"
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

          {/* Hamburger — rightmost, wherever the inline nav doesn't fit */}
          <button
            ref={hamburgerRef}
            onClick={toggleMenu}
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-none bg-transparent xl:hidden"
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

      {/* Collapsed nav menu — everything the inline row can't show at this width */}
      <div
        id="mobile-menu"
        // inert when collapsed so its buttons leave the keyboard tab order and
        // the a11y tree (maxHeight:0 alone still left them focusable/announced).
        inert={!menuOpen}
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] xl:hidden"
        style={{
          maxHeight: menuOpen ? `${menuHeight}px` : '0',
          opacity: menuOpen ? 1 : 0,
        }}
      >
        {/* padding matches the header row so the items line up under the wordmark */}
        <div ref={menuRef} className="flex flex-col border-t border-white/10 px-4 py-2 md:px-12">
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
          <button
            onClick={() => {
              navigate(localePath('/changelog'))
              setMenuOpen(false)
            }}
            className="min-h-[44px] cursor-pointer border-none bg-transparent text-left text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors duration-200 hover:text-white"
          >
            {t('nav.changelog')}
          </button>

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
                className={`min-h-[44px] cursor-pointer rounded-full border bg-transparent px-3 py-1 font-mono text-[11px] tracking-[1px] transition-colors duration-200 ${
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
