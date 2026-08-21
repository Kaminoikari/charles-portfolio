import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import Nav from './Nav'
import { inlineNavTakesOver } from './navBreakpoint'
import { LocaleProvider } from '../i18n'
import { NAV_Z_CLASS } from './Nav'

function NavDriver() {
  const navigate = useNavigate()
  {/* a second hash arrival, the way the app produces one */}
  return <button onClick={() => navigate('/#projects')}>goto-projects</button>
}

function renderNav(initialEntry = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocaleProvider locale="en">
        <Nav />
        <NavDriver />
      </LocaleProvider>
    </MemoryRouter>,
  )
}

// queried by element, not by role, so the assertions can reach it however it is
// exposed to the accessibility tree
const nav = () => document.querySelector('nav[aria-label]') as HTMLElement

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

beforeEach(() => {
  setViewportWidth(1440)
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})
afterEach(() => { vi.restoreAllMocks() })

describe('Nav presence', () => {

  // The nav's layer is exported so the docked chat avatar can be held below it:
  // her canvas reaches the top of a short window now and `stretch` puts a hand
  // inside this bar. ChatWidget's test compares the two CONSTANTS, so without
  // this the nav could be dropped to a lower class here and that comparison
  // would still pass while the hand went back on top of the links.
  it('renders at the layer it exports', () => {
    renderNav()
    const nav = document.querySelector('nav') as HTMLElement
    expect(nav.className.split(' ')).toContain(NAV_Z_CLASS)
  })
  // The bar used to hide itself while the hero intro owned the screen. That
  // hero and its intro state were removed on 2026-08-14, so the only thing left
  // to pin is that nothing hides the bar on arrival.
  it('is visible, interactive and in the accessibility tree on arrival', () => {
    renderNav()
    expect(nav()).not.toHaveAttribute('inert')
    expect(nav()).not.toHaveAttribute('aria-hidden')
    expect(screen.queryByRole('navigation')).toBeInTheDocument()
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

  // A smooth scroll must never be handed to document.startViewTransition: the
  // transition freezes rendering to capture snapshots while the smooth scroll
  // needs rendering frames to advance, so they deadlock until Chrome's 4s
  // DOM-update timeout aborts the transition — measured 4082ms of frozen screen
  // per nav click before the scroll finally ran. The stub below never invokes
  // its callback, standing in for that stall.
  it('starts the scroll directly, never through a view transition', () => {
    const section = document.createElement('section')
    section.id = 'experience'
    document.body.appendChild(section)
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo
    // jsdom has no startViewTransition, so the stub is an own property we can
    // delete again; the loose cast keeps lib.dom's non-optional declaration out
    // of the way
    const doc = document as unknown as { startViewTransition?: (cb: () => void) => void }
    const startViewTransition = vi.fn()
    doc.startViewTransition = startViewTransition
    try {
      renderNav()
      fireEvent.click(screen.getByRole('button', { name: /scroll to experience section/i }))
      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }))
      expect(startViewTransition).not.toHaveBeenCalled()
    } finally {
      delete doc.startViewTransition
      section.remove()
    }
  })
})
