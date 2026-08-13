import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AudioProvider } from './AudioProvider'
import { MusicToggle } from './MusicToggle'

// The FAB is now the ONLY route to audible music, on every route of the site
// (the hero's Enter click no longer touches the ambient track). That makes the
// iOS unlock order load-bearing here: the <audio> element must start playing
// MUTED inside the tap gesture itself, and only then be unmuted — iOS blocks a
// fresh play() fired outside a gesture, but honours unmuting an element that is
// already playing (see the audio rules in the project CLAUDE.md).

type PlayCall = { mutedAtCall: boolean }

let playCalls: PlayCall[]
let rafQueue: FrameRequestCallback[]

// Advance the fade by hand with a timestamp on performance.now()'s own timebase.
// jsdom's automatic rAF timestamps use a different epoch, which drives fadeTo()'s
// t negative and makes the volume setter throw IndexSizeError; manual pumping
// keeps the fade observable AND deterministic. (Environment-boundary stub; real
// browsers share one timebase between rAF and performance.now().)
function pumpFrame(atMsFromNow: number) {
  const cbs = rafQueue.splice(0)
  const ts = performance.now() + atMsFromNow
  cbs.forEach((cb) => cb(ts))
}

beforeEach(() => {
  playCalls = []
  rafQueue = []
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => rafQueue.push(cb)),
  )
  // jsdom has no HTMLMediaElement.play; record the element's muted flag at the
  // moment of each call so the unlock-before-unmute order is observable.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: vi.fn(function (this: HTMLMediaElement) {
      playCalls.push({ mutedAtCall: this.muted })
      return Promise.resolve()
    }),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderToggle() {
  return render(
    <AudioProvider>
      <MusicToggle />
    </AudioProvider>,
  )
}

describe('MusicToggle', () => {
  it('starts muted with the FAB reading "play"', () => {
    renderToggle()
    const btn = screen.getByRole('button', { name: /play ambient music/i })
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    expect(playCalls.length).toBe(0) // no silent stream before the visitor asks
  })

  it('unmuting performs the iOS unlock inside the tap: first play() runs while still muted, then the element is unmuted and audibly fades up', async () => {
    const user = userEvent.setup()
    renderToggle()
    await user.click(screen.getByRole('button', { name: /play ambient music/i }))

    // Exactly two plays: the in-gesture unlock (muted), then the [muted]
    // effect's passive flush (unmuted). A third would mean a fresh play() path
    // that iOS could block.
    expect(playCalls.length).toBe(2)
    expect(playCalls[0].mutedAtCall).toBe(true) // the in-gesture unlock
    expect(playCalls[1].mutedAtCall).toBe(false)
    const audio = document.querySelector('audio')!
    expect(audio.muted).toBe(false) // the unmute effect then clears the flag

    // "Playing" must also mean audible: half-way through the 1800ms fade the
    // volume has actually left zero. Guards the .then(fadeTo) wiring — unmuted
    // but volume-pinned-at-0 is silence with a lying icon.
    pumpFrame(900)
    expect(audio.volume).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /mute ambient music/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('muting again does not re-run the unlock play', async () => {
    const user = userEvent.setup()
    renderToggle()
    await user.click(screen.getByRole('button', { name: /play ambient music/i }))
    pumpFrame(900)
    await user.click(screen.getByRole('button', { name: /mute ambient music/i }))
    expect(playCalls.length).toBe(2) // unlock + unmute flush from the first tap, nothing new
    expect(screen.getByRole('button', { name: /play ambient music/i }).getAttribute('aria-pressed')).toBe('false')
  })
})
