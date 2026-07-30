import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

const startIntro = vi.fn()
const setActive = vi.fn()
const dispose = vi.fn()
const unmute = vi.fn()
const unlock = vi.fn()
let lastOpts: import('./faceHero').FaceHeroOptions | null = null

vi.mock('./faceHero', () => ({
  initFaceHero: (_canvas: HTMLCanvasElement, opts: import('./faceHero').FaceHeroOptions) => {
    lastOpts = opts
    return { startIntro, setActive, dispose }
  },
}))

vi.mock('../audio/audio-context', () => ({
  useAmbientAudio: () => ({ muted: true, toggle: vi.fn(), unmute, unlock }),
}))

import FaceHero from './FaceHero.tsx'
import { HeroIntroProvider } from './HeroIntroProvider'
import { useHeroIntro } from './hero-intro-context'
import { INTRO_FAILSAFE_MS } from './introTiming'

// reads the real context the nav reads, so these assertions cover the actual
// wiring rather than a mocked seam
function ChromeProbe() {
  const { introRunning } = useHeroIntro()
  return <span data-testid="chrome">{introRunning ? 'hidden' : 'visible'}</span>
}
const chromeState = () => screen.getByTestId('chrome').textContent

beforeEach(() => {
  startIntro.mockClear(); setActive.mockClear(); dispose.mockClear(); unmute.mockClear(); unlock.mockClear(); lastOpts = null
  sessionStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', function IntersectionObserverStub() {
    return { observe: vi.fn(), disconnect: vi.fn() }
  })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

// The engine is now loaded via a dynamic import('./faceHero') inside the mount
// effect, so initFaceHero (the mock) runs on a microtask rather than during the
// synchronous render. Flush that microtask so lastOpts and the engine handle are
// wired before assertions run.
async function renderHero() {
  const utils = render(
    <HeroIntroProvider>
      <FaceHero />
      <ChromeProbe />
    </HeroIntroProvider>,
  )
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
  return utils
}

// the gate holds a minimum-duration progress sweep, so "ready" needs both the
// engine callback and enough fake time for the bar to reach full
const MIN_GATE_MS = 2000
function fireReadyAndFinishSweep() {
  act(() => { lastOpts?.onReady?.() })
  act(() => { vi.advanceTimersByTime(MIN_GATE_MS + 100) })
}

describe('FaceHero shell', () => {
  it('always renders the hero heading in the DOM', async () => {
    await renderHero()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Senior Product Manager/)
  })

  it('shows loading first, then the enter control once ready and the sweep completes', async () => {
    await renderHero()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    fireReadyAndFinishSweep()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('calls startIntro exactly once when enter is clicked', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(startIntro).toHaveBeenCalledTimes(1)
  })

  it('unlocks audio on enter but holds the music until the intro finishes', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(unlock).toHaveBeenCalledTimes(1)
    expect(unmute).not.toHaveBeenCalled()
    act(() => { lastOpts?.onIntroComplete?.() })
    expect(unmute).toHaveBeenCalledTimes(1)
  })

  it('does not start the music on a same-session skip (no enter click)', async () => {
    sessionStorage.setItem('faceHeroSeen', '1')
    await renderHero()
    act(() => { lastOpts?.onReady?.() })
    act(() => { lastOpts?.onIntroComplete?.() })
    expect(unmute).not.toHaveBeenCalled()
    expect(unlock).not.toHaveBeenCalled()
  })

  it('disposes the engine on unmount', async () => {
    const { unmount } = await renderHero()
    unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('pauses the engine when the hero scrolls off-screen', async () => {
    let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    const observe = vi.fn(); const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { ioCallback = cb }
      observe = observe
      disconnect = disconnect
    })
    await renderHero()
    act(() => { ioCallback?.([{ isIntersecting: false }]) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    act(() => { ioCallback?.([{ isIntersecting: true }]) })
    expect(setActive).toHaveBeenLastCalledWith(true)
  })

  it('does not resume the engine on tab focus while the hero is off-screen', async () => {
    let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { ioCallback = cb }
      observe = vi.fn()
      disconnect = vi.fn()
    })
    await renderHero()
    act(() => { ioCallback?.([{ isIntersecting: false }]) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).not.toHaveBeenLastCalledWith(true)
  })

  it('pauses the engine when the tab is hidden', async () => {
    await renderHero()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).toHaveBeenLastCalledWith(true)
  })

  it('passes reducedMotion to the engine when the user prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }))
    await renderHero()
    expect(lastOpts?.reducedMotion).toBe(true)
  })

  it('shows the static fallback image when the engine reports an error', async () => {
    await renderHero()
    act(() => { lastOpts?.onError?.(new Error('WebGL unavailable')) })
    const img = document.querySelector('img[src="/hero/charles-face.png"]')
    expect(img).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  })

  it('skips the enter gate and starts the intro pre-settled when already seen this session', async () => {
    sessionStorage.setItem('faceHeroSeen', '1')
    await renderHero()
    act(() => { lastOpts?.onReady?.() })
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
    expect(startIntro).toHaveBeenCalledWith(true)
  })

  it('marks the session as seen when enter is clicked', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(sessionStorage.getItem('faceHeroSeen')).toBe('1')
  })
})

// The nav reads introRunning: it must be hidden for exactly as long as the intro
// owns the screen, and every way the intro can end has to hand the chrome back.
describe('FaceHero chrome gating', () => {
  it('holds the chrome hidden through the gate and the intro, releasing it with the music', async () => {
    await renderHero()
    expect(chromeState()).toBe('hidden')
    fireReadyAndFinishSweep()
    expect(chromeState()).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(chromeState()).toBe('hidden')
    expect(unmute).not.toHaveBeenCalled()
    act(() => { lastOpts?.onIntroComplete?.() })
    expect(chromeState()).toBe('visible')
    expect(unmute).toHaveBeenCalledTimes(1)
  })

  it('never hides the chrome on a same-session skip', async () => {
    sessionStorage.setItem('faceHeroSeen', '1')
    await renderHero()
    expect(chromeState()).toBe('visible')
    act(() => { lastOpts?.onReady?.() })
    expect(chromeState()).toBe('visible')
  })

  it('releases the chrome when the engine errors', async () => {
    await renderHero()
    expect(chromeState()).toBe('hidden')
    act(() => { lastOpts?.onError?.(new Error('WebGL unavailable')) })
    expect(chromeState()).toBe('visible')
  })

  // An engine error unmounts the gate WITHOUT moving `phase` — only `failed` flips, and
  // the progress ramp stops — so anything keyed on the phase alone stays engaged for the
  // life of the document. With the whole page visible and reachable, that would leave
  // Tab swallowed forever.
  it('releases keyboard containment when an engine error removes the gate', async () => {
    await renderHero()
    const whileGated = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(whileGated)
    expect(whileGated.defaultPrevented).toBe(true)

    act(() => { lastOpts?.onError?.(new Error('WebGL context lost')) })
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()   // gate gone
    const afterError = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(afterError)
    expect(afterError.defaultPrevented).toBe(false)
  })

  it('releases the chrome when the visitor scrolls the hero out of view mid-intro', async () => {
    let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { ioCallback = cb }
      observe = vi.fn()
      disconnect = vi.fn()
    })
    await renderHero()
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(chromeState()).toBe('hidden')
    // off-screen pauses the engine, so onIntroComplete would never arrive
    act(() => { ioCallback?.([{ isIntersecting: false }]) })
    expect(chromeState()).toBe('visible')
  })

  it('releases the chrome and starts the music if the intro never reports completion', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    act(() => { vi.advanceTimersByTime(INTRO_FAILSAFE_MS - 1) })
    expect(chromeState()).toBe('hidden')
    act(() => { vi.advanceTimersByTime(2) })
    expect(chromeState()).toBe('visible')
    expect(unmute).toHaveBeenCalledTimes(1)
  })

  // Hiding the nav makes it inert, which blurs any focus inside it. Reachable
  // mid-session: tab to the wordmark on /about, activate it, land on the home
  // route, and the intro starts with focus inside the bar that just went inert.
  // The gate has to catch that focus instead of dropping it on the body.
  // Focus is parked on the overlay, not on ENTER: a programmatic focus() on the button
  // makes Chrome match :focus-visible, which paints the site's cyan focus ring around it
  // for a visitor who arrived with a mouse and never asked for one. The overlay carries
  // outline-none, so parking there is invisible.
  it('parks focus on the gate itself at takeover, forcing no focus ring on arrival', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    const gate = document.querySelector('[data-hero-gate]') as HTMLElement
    expect(document.activeElement).toBe(gate)
    expect(screen.getByRole('button', { name: /enter/i })).not.toHaveFocus()
    // asserted as an inline style on purpose: index.css's `*:focus-visible` outline is an
    // UNLAYERED rule, so it outranks Tailwind's `outline-none` utility (layered) and only
    // an inline declaration suppresses the ring on the focused overlay
    expect(gate.style.outline).toBe('none')
  })

  it('moves focus to the enter control on the first Tab, where a ring is earned', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: /enter/i })).toHaveFocus()
  })


  // While the gate is still loading it holds no control at all, so without
  // containment a Tab walks into the page content behind the opaque overlay:
  // invisible focus, invisible focus ring. (jsdom performs no real tab traversal;
  // what is asserted here is that focus is parked on the gate and that Tab is
  // swallowed while it owns the screen — and released again afterwards.)
  it('contains keyboard focus while the gate owns the screen, and releases it after', async () => {
    await renderHero()
    expect(document.activeElement).toBe(document.querySelector('[data-hero-gate]'))
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)

    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    const afterEnter = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(afterEnter)
    expect(afterEnter.defaultPrevented).toBe(false)
  })

  // With reduced motion (verified in a real browser with the media feature
  // emulated) the engine settles inside startIntro() and reports completion
  // synchronously, still inside the Enter click — reproduced here by making the
  // engine double stand in for that. Enter must not then drag the phase back to
  // 'running': the intro is already over.
  it('keeps the chrome visible when the engine settles synchronously inside the click', async () => {
    await renderHero()
    startIntro.mockImplementation(() => { lastOpts?.onIntroComplete?.() })
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(unmute).toHaveBeenCalledTimes(1)
    expect(chromeState()).toBe('visible')
    expect(screen.getByRole('heading', { level: 1 }).parentElement).toHaveStyle({ opacity: '1' })
  })

  it('releases the chrome when the hero unmounts mid-intro', async () => {
    const Harness = ({ hero }: { hero: boolean }) => (
      <HeroIntroProvider>
        {hero ? <FaceHero /> : null}
        <ChromeProbe />
      </HeroIntroProvider>
    )
    const { rerender } = render(<Harness hero />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(chromeState()).toBe('hidden')
    rerender(<Harness hero={false} />)
    expect(chromeState()).toBe('visible')
  })
})

// A shared deep link (/#experience) asks for a section, not the splash. It must
// land on the content with the chrome up, and it must not silently swallow the
// intro for a plain visit to the home route.
describe('FaceHero section deep link', () => {
  it('skips the gate and settles the portrait when the url targets a section', async () => {
    window.history.replaceState({}, '', '/#experience')
    await renderHero()
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()
    act(() => { lastOpts?.onReady?.() })
    expect(startIntro).toHaveBeenCalledWith(true)
    expect(chromeState()).toBe('visible')
  })

  it('leaves the music off on a deep-link skip', async () => {
    window.history.replaceState({}, '', '/#experience')
    await renderHero()
    act(() => { lastOpts?.onReady?.(); lastOpts?.onIntroComplete?.() })
    expect(unmute).not.toHaveBeenCalled()
    expect(unlock).not.toHaveBeenCalled()
  })

  // Landing on /changelog or /about and then clicking the wordmark is an in-site
  // navigation, not an arrival: a 2s loader plus a splash gate plus 4.5s of animation
  // (with the nav gone for all of it) in the middle of a session is an ambush.
  it('skips the gate when the visitor navigated here from another page in the session', async () => {
    window.history.replaceState({}, '', '/changelog')   // the path this document landed on
    vi.resetModules()
    const { default: FreshHero } = await import('./FaceHero.tsx')
    window.history.replaceState({}, '', '/')            // now on the home route
    render(
      <HeroIntroProvider>
        <FreshHero />
        <ChromeProbe />
      </HeroIntroProvider>,
    )
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
    expect(chromeState()).toBe('visible')
    act(() => { lastOpts?.onReady?.() })
    expect(startIntro).toHaveBeenCalledWith(true)   // settled portrait, no replay
  })

  // guards the other direction: the skip must not swallow the intro for someone
  // who simply opened the home page
  it('still plays the gate for a plain home visit', async () => {
    window.history.replaceState({}, '', '/')
    await renderHero()
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    expect(chromeState()).toBe('hidden')
    fireReadyAndFinishSweep()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })
})

describe('FaceHero loading gate', () => {
  it('shows the mobius mark and the progress hairline while loading', async () => {
    await renderHero()
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('plays a full minimum-duration sweep even when assets are ready instantly', async () => {
    await renderHero()
    act(() => { lastOpts?.onReady?.() })
    act(() => { vi.advanceTimersByTime(MIN_GATE_MS / 2) })
    // halfway through the sweep the bar is half full and the gate still loads
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(MIN_GATE_MS / 2 + 100) })
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('caps the bar at the real asset progress when loading is slow', async () => {
    await renderHero()
    act(() => { lastOpts?.onProgress?.(0.42) })
    act(() => { vi.advanceTimersByTime(MIN_GATE_MS * 2) })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
  })

  it('cycles to the next loading message after the hold and fade delays', async () => {
    await renderHero()
    expect(screen.getByText(/Loading the experience/i)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000 + 400) })
    expect(screen.getByText(/Waking the particles/i)).toBeInTheDocument()
  })

  it('overlaps the handoff: enter mounts while the copy and bar are still fading', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText(/Loading the experience/i)).toBeInTheDocument()
  })

  it('drops the faded copy and bar once the handoff finishes, keeping the mobius mark', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Loading the experience/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('fades the gate out and unmounts it after enter', async () => {
    await renderHero()
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    // still mounted mid-fade, but inert
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(700) })
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()
  })

  it('drops the gate when the engine errors so the fallback is reachable', async () => {
    await renderHero()
    act(() => { lastOpts?.onError?.(new Error('WebGL unavailable')) })
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()
  })
})
