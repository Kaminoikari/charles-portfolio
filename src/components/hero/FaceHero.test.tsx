import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const startIntro = vi.fn()
const setActive = vi.fn()
const dispose = vi.fn()
const unmute = vi.fn()
let lastOpts: import('./faceHero').FaceHeroOptions | null = null

vi.mock('./faceHero', () => ({
  initFaceHero: (_canvas: HTMLCanvasElement, opts: import('./faceHero').FaceHeroOptions) => {
    lastOpts = opts
    return { startIntro, setActive, dispose }
  },
}))

vi.mock('../audio/audio-context', () => ({
  useAmbientAudio: () => ({ muted: true, toggle: vi.fn(), unmute }),
}))

import FaceHero from './FaceHero.tsx'

beforeEach(() => {
  startIntro.mockClear(); setActive.mockClear(); dispose.mockClear(); unmute.mockClear(); lastOpts = null
})
afterEach(() => { vi.restoreAllMocks() })

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

  it('unmutes the ambient music when enter is clicked', async () => {
    const user = userEvent.setup()
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    await user.click(screen.getByRole('button', { name: /enter/i }))
    expect(unmute).toHaveBeenCalledTimes(1)
  })

  it('disposes the engine on unmount', () => {
    const { unmount } = render(<FaceHero />)
    unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
