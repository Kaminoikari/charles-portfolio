import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import Nav from './Nav'
import { inlineNavTakesOver } from './navBreakpoint'
import { LocaleProvider } from '../i18n'
import { HeroIntroProvider } from './hero/HeroIntroProvider'
import { useHeroIntro } from './hero/hero-intro-context'

// stands in for FaceHero: the only writer of the intro state in the real app
function IntroDriver() {
  const { setIntroRunning } = useHeroIntro()
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => setIntroRunning(true)}>start-intro</button>
      <button onClick={() => setIntroRunning(false)}>end-intro</button>
      {/* a second hash arrival, the way the app produces one */}
      <button onClick={() => navigate('/#projects')}>goto-projects</button>
    </>
  )
}

function renderNav(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocaleProvider locale="en">
        <HeroIntroProvider>
          <Nav />
          <IntroDriver />
        </HeroIntroProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )
}

// queried by element, not by role: a hidden nav is deliberately absent from the
// accessibility tree, which is itself asserted below
const nav = () => document.querySelector('nav[aria-label]') as HTMLElement
const startIntro = () => fireEvent.click(screen.getByText('start-intro'))
const endIntro = () => fireEvent.click(screen.getByText('end-intro'))

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

beforeEach(() => {
  setViewportWidth(1440)
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})
afterEach(() => { vi.restoreAllMocks() })

describe('Nav intro gating', () => {
  it('is visible and interactive by default (routes without a hero)', () => {
    renderNav()
    expect(nav()).toHaveStyle({ opacity: '1' })
    expect(nav()).not.toHaveAttribute('inert')
  })

  it('hides itself and leaves the tab order while the hero intro owns the screen', () => {
    renderNav()
    expect(screen.queryByRole('navigation')).toBeInTheDocument()
    act(() => { startIntro() })
    expect(nav()).toHaveStyle({ opacity: '0' })
    // slid out as well, so a transition that never runs cannot leave it hovering
    expect(nav()).toHaveStyle({ transform: 'translateY(-100%)' })
    expect(nav()).toHaveAttribute('inert')
    expect(nav()).toHaveAttribute('aria-hidden', 'true')
    // out of the accessibility tree too, so screen readers don't announce a bar
    // the visitor cannot see or reach
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('comes back when the intro hands the screen over', () => {
    renderNav()
    act(() => { startIntro() })
    act(() => { endIntro() })
    expect(nav()).toHaveStyle({ opacity: '1' })
    expect(nav()).not.toHaveAttribute('inert')
  })
})

describe('Nav responsive menu', () => {
  // jsdom evaluates no media queries, so the breakpoint itself cannot be tested
  // here (it is verified in a real browser at 375/768/1279/1280). What IS testable
  // is the mechanism: the handler must take its cue from the CSS decision applied
  // to the hamburger, never from a width restated in JS.
  it('reads the handover from the hamburger the CSS actually hides', () => {
    const el = document.createElement('button')
    document.body.appendChild(el)
    expect(inlineNavTakesOver(el)).toBe(false)
    el.style.display = 'none'
    expect(inlineNavTakesOver(el)).toBe(true)
    expect(inlineNavTakesOver(null)).toBe(false)
    el.remove()
  })

  it('keeps the menu open while the hamburger is still the nav', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument()
    act(() => { window.dispatchEvent(new Event('resize')) })
    expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument()
  })

  it('closes the menu once the inline row has taken the hamburger away', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const panel = document.getElementById('mobile-menu') as HTMLElement
    expect(panel).not.toHaveAttribute('inert')       // open
    const hamburger = screen.getByRole('button', { name: /close menu/i })
    act(() => {
      hamburger.style.display = 'none'   // what `xl:hidden` does at >= 80rem
      window.dispatchEvent(new Event('resize'))
    })
    // asserted on the panel, not the hamburger: a display:none hamburger has left
    // the accessibility tree, so its own label can no longer be queried
    expect(panel).toHaveAttribute('inert')           // closed
  })

  // The breakpoint lives in exactly one place — the `xl:` classes. Pinned so a
  // later edit cannot move one surface (row, hamburger, panel, locale pills)
  // without the others.
  it('switches every nav surface on the same `xl` breakpoint', () => {
    renderNav()
    const panel = document.getElementById('mobile-menu') as HTMLElement
    const inlineRow = screen.getByRole('button', { name: /scroll to experience section/i }).parentElement
    expect(inlineRow?.className).toContain('xl:flex')
    expect(screen.getByRole('button', { name: /open menu/i }).className).toContain('xl:hidden')
    expect(panel.className).toContain('xl:hidden')
    // two locale groups exist (inline row + collapsed panel); the inline one is
    // the one outside the panel
    const inlineLocales = screen.getAllByRole('group', { name: /language/i }).find((g) => !panel.contains(g))
    expect(inlineLocales?.className).toContain('xl:flex')
  })
})

describe('Nav deep-link scroll', () => {
  // 'instant', not 'auto': index.css sets `html { scroll-behavior: smooth }` and
  // per CSSOM-View 'auto' defers to that computed value, so 'auto' would animate
  // the arrival — measured in Chrome, a /#experience landing crawled through 24
  // intermediate positions over more than 1.4s.
  it('jumps instantly on every hash arrival, however often it happens', () => {
    vi.useFakeTimers()
    try {
      const section = document.createElement('section')
      section.id = 'experience'
      document.body.appendChild(section)
      const scrollTo = vi.fn()
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo

      const projects = document.createElement('section')
      projects.id = 'projects'
      document.body.appendChild(projects)

      renderNav('/#experience')
      act(() => { vi.advanceTimersByTime(200) })
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }))

      // A second arrival in the same session — Nav never unmounts, so anything
      // keyed on "first time" would silently switch to a smooth multi-thousand
      // pixel scroll here. Driven through a real navigation, not a re-render.
      scrollTo.mockClear()
      act(() => { fireEvent.click(screen.getByText('goto-projects')) })
      act(() => { vi.advanceTimersByTime(200) })
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'instant' }))
      section.remove()
      projects.remove()
    } finally {
      vi.useRealTimers()
    }
  })

  // in-page section clicks are a different code path and keep their glide
  it('keeps the smooth glide for in-page section clicks', () => {
    const section = document.createElement('section')
    section.id = 'experience'
    document.body.appendChild(section)
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /scroll to experience section/i }))
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
    section.remove()
  })
})
