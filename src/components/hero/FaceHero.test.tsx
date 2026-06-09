import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
  vi.stubGlobal('IntersectionObserver', function IntersectionObserverStub() {
    return { observe: vi.fn(), disconnect: vi.fn() }
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('FaceHero shell', () => {
  it('always renders the hero heading in the DOM', () => {
    render(<FaceHero />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Senior Product Manager/)
  })

  it('shows loading first, then the enter control once onReady fires', () => {
    render(<FaceHero />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    act(() => { lastOpts?.onReady?.() })
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('calls startIntro exactly once when enter is clicked', async () => {
    const user = userEvent.setup()
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    await user.click(screen.getByRole('button', { name: /enter/i }))
    expect(startIntro).toHaveBeenCalledTimes(1)
  })

  it('unlocks audio on enter but holds the music until the intro finishes', async () => {
    const user = userEvent.setup()
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    await user.click(screen.getByRole('button', { name: /enter/i }))
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

  it('marks the session as seen when enter is clicked', async () => {
    const user = userEvent.setup()
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    await user.click(screen.getByRole('button', { name: /enter/i }))
    expect(sessionStorage.getItem('faceHeroSeen')).toBe('1')
  })
})
