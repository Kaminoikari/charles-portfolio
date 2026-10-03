// The stage's moving backdrop: the scene on show keeps playing, and a scene
// left behind gives its decoded video back. The owner, 2026-10-03: "I need
// the background to keep playing, but not take extra memory."
import { act, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SCENE_FADE_MS, SceneClip } from './SceneClip'

// jsdom has no media pipeline: play() and pause() are the browser's, so they
// are the boundary stubbed here. `refuse` is how a browser that will not
// autoplay answers (iOS in Low Power Mode, a tab still in the background).
let refuse = false
const played: HTMLMediaElement[] = []

beforeEach(() => {
  refuse = false
  played.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    if (refuse) return Promise.reject(new DOMException('not allowed', 'NotAllowedError'))
    played.push(this)
    Object.defineProperty(this, 'paused', { configurable: true, value: false })
    return Promise.resolve()
  })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { configurable: true, value: true })
  })
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const clip = (on: boolean) => <SceneClip poster="/p.webp" video="/v.mp4" focusX={50} on={on} />

describe('SceneClip', () => {
  it('plays the scene on show', async () => {
    render(clip(true))
    await act(async () => {})
    expect(played).toHaveLength(1)
  })

  it('keeps its source through a remount, as StrictMode does on every mount in development', async () => {
    // Letting the video go empties its source on unmount. A source set once
    // by the markup and emptied by that cleanup never came back, and the dev
    // server's stage showed only posters.
    const { container } = render(<StrictMode>{clip(true)}</StrictMode>)
    await act(async () => {})
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/v.mp4')
    expect(played.length).toBeGreaterThan(0)
  })

  it('starts a refused clip on the next completed tap', async () => {
    refuse = true
    const { container } = render(clip(true))
    await act(async () => {})
    expect(played).toHaveLength(0)
    refuse = false
    await act(async () => {
      window.dispatchEvent(new Event('pointerup'))
    })
    expect(played).toEqual([container.querySelector('video')])
  })

  it('starts it again when the page comes back to the front', async () => {
    const { container } = render(clip(true))
    await act(async () => {})
    const video = container.querySelector('video')
    // The browser paused it while the page was hidden (iOS does on leaving the app).
    video?.pause()
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(played).toHaveLength(2)
  })

  it('keeps a scene it left until the fade ends, then lets its video go', async () => {
    const { container, rerender } = render(clip(true))
    await act(async () => {})
    const video = container.querySelector('video')
    rerender(clip(false))
    await act(async () => {
      vi.advanceTimersByTime(SCENE_FADE_MS - 1)
    })
    expect(container.querySelector('video'), 'still fading').toBe(video)
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(container.querySelector('video'), 'gone after the fade').toBeNull()
    // Detached is not enough to free its buffers at once; an emptied source is.
    expect(video?.getAttribute('src')).toBeNull()
    // The poster stays, so coming back still crossfades from a picture.
    expect(container.innerHTML).toContain('/p.webp')
  })

  it('does not pick up a tap or a return for a scene that is not on show', async () => {
    render(clip(false))
    await act(async () => {
      window.dispatchEvent(new Event('pointerup'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(played).toHaveLength(0)
  })
})
