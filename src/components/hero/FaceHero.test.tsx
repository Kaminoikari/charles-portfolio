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

beforeEach(() => {
  startIntro.mockClear(); setActive.mockClear(); dispose.mockClear(); unmute.mockClear(); unlock.mockClear(); lastOpts = null
  sessionStorage.clear()
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', function IntersectionObserverStub() {
    return { observe: vi.fn(), disconnect: vi.fn() }
  })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

// the gate holds a minimum-duration progress sweep, so "ready" needs both the
// engine callback and enough fake time for the bar to reach full
const MIN_GATE_MS = 2000
function fireReadyAndFinishSweep() {
  act(() => { lastOpts?.onReady?.() })
  act(() => { vi.advanceTimersByTime(MIN_GATE_MS + 100) })
}

describe('FaceHero shell', () => {
  it('always renders the hero heading in the DOM', () => {
    render(<FaceHero />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Senior Product Manager/)
  })

  it('shows loading first, then the enter control once ready and the sweep completes', () => {
    render(<FaceHero />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    fireReadyAndFinishSweep()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('calls startIntro exactly once when enter is clicked', () => {
    render(<FaceHero />)
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(startIntro).toHaveBeenCalledTimes(1)
  })

  it('unlocks audio on enter but holds the music until the intro finishes', () => {
    render(<FaceHero />)
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(unlock).toHaveBeenCalledTimes(1)
    expect(unmute).not.toHaveBeenCalled()
    act(() => { lastOpts?.onIntroComplete?.() })
    expect(unmute).toHaveBeenCalledTimes(1)
  })

  it('does not start the music on a same-session skip (no enter click)', () => {
    sessionStorage.setItem('faceHeroSeen', '1')
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    act(() => { lastOpts?.onIntroComplete?.() })
    expect(unmute).not.toHaveBeenCalled()
    expect(unlock).not.toHaveBeenCalled()
  })

  it('disposes the engine on unmount', () => {
    const { unmount } = render(<FaceHero />)
    unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('pauses the engine when the hero scrolls off-screen', () => {
    let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    const observe = vi.fn(); const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { ioCallback = cb }
      observe = observe
      disconnect = disconnect
    })
    render(<FaceHero />)
    act(() => { ioCallback?.([{ isIntersecting: false }]) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    act(() => { ioCallback?.([{ isIntersecting: true }]) })
    expect(setActive).toHaveBeenLastCalledWith(true)
  })

  it('does not resume the engine on tab focus while the hero is off-screen', () => {
    let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { ioCallback = cb }
      observe = vi.fn()
      disconnect = vi.fn()
    })
    render(<FaceHero />)
    act(() => { ioCallback?.([{ isIntersecting: false }]) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).not.toHaveBeenLastCalledWith(true)
  })

  it('pauses the engine when the tab is hidden', () => {
    render(<FaceHero />)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).toHaveBeenLastCalledWith(true)
  })

  it('passes reducedMotion to the engine when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }))
    render(<FaceHero />)
    expect(lastOpts?.reducedMotion).toBe(true)
  })

  it('shows the static fallback image when the engine reports an error', () => {
    render(<FaceHero />)
    act(() => { lastOpts?.onError?.(new Error('WebGL unavailable')) })
    const img = document.querySelector('img[src="/hero/charles-face.png"]')
    expect(img).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  })

  it('skips the enter gate and starts the intro pre-settled when already seen this session', () => {
    sessionStorage.setItem('faceHeroSeen', '1')
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
    expect(startIntro).toHaveBeenCalledWith(true)
  })

  it('marks the session as seen when enter is clicked', () => {
    render(<FaceHero />)
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    expect(sessionStorage.getItem('faceHeroSeen')).toBe('1')
  })
})

describe('FaceHero loading gate (sidewave-style loader)', () => {
  it('shows the mobius mark and the progress hairline while loading', () => {
    render(<FaceHero />)
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('plays a full minimum-duration sweep even when assets are ready instantly', () => {
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    act(() => { vi.advanceTimersByTime(MIN_GATE_MS / 2) })
    // halfway through the sweep the bar is half full and the gate still loads
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(MIN_GATE_MS / 2 + 100) })
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('caps the bar at the real asset progress when loading is slow', () => {
    render(<FaceHero />)
    act(() => { lastOpts?.onProgress?.(0.42) })
    act(() => { vi.advanceTimersByTime(MIN_GATE_MS * 2) })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(screen.queryByRole('button', { name: /enter/i })).not.toBeInTheDocument()
  })

  it('cycles to the next loading message after the hold and fade delays', () => {
    render(<FaceHero />)
    expect(screen.getByText(/Loading the experience/i)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000 + 400) })
    expect(screen.getByText(/Waking the particles/i)).toBeInTheDocument()
  })

  it('overlaps the handoff: enter mounts while the copy and bar are still fading', () => {
    render(<FaceHero />)
    fireReadyAndFinishSweep()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText(/Loading the experience/i)).toBeInTheDocument()
  })

  it('drops the faded copy and bar once the handoff finishes, keeping the mobius mark', () => {
    render(<FaceHero />)
    fireReadyAndFinishSweep()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Loading the experience/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('fades the gate out and unmounts it after enter', () => {
    render(<FaceHero />)
    fireReadyAndFinishSweep()
    fireEvent.click(screen.getByRole('button', { name: /enter/i }))
    // still mounted mid-fade, but inert
    expect(screen.getByTestId('mobius-loader')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(700) })
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()
  })

  it('drops the gate when the engine errors so the fallback is reachable', () => {
    render(<FaceHero />)
    act(() => { lastOpts?.onError?.(new Error('WebGL unavailable')) })
    expect(screen.queryByTestId('mobius-loader')).not.toBeInTheDocument()
  })
})
