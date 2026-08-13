import { afterEach, describe, expect, it, vi } from 'vitest'
import { VOICE_LINES, pickVoiceLine, playVoiceCue } from './avatarVoice'

// Minimal Audio stand-in: jsdom's play() is unimplemented, and these tests
// only care about WHICH clip was constructed and whether play() was invoked.
class FakeAudio {
  static created: FakeAudio[] = []
  src: string
  preload = ''
  play = vi.fn(() => Promise.resolve())
  pause = vi.fn()
  addEventListener = vi.fn()
  constructor(src: string) {
    this.src = src
    FakeAudio.created.push(this)
  }
}

afterEach(() => {
  FakeAudio.created = []
  vi.unstubAllGlobals()
})

describe('pickVoiceLine', () => {
  it('picks deterministically from the cue catalogue via the injected rng', () => {
    expect(pickVoiceLine('greet', () => 0)).toBe(VOICE_LINES.greet[0])
    expect(pickVoiceLine('greet', () => 0.99)).toBe(VOICE_LINES.greet[VOICE_LINES.greet.length - 1])
    expect(pickVoiceLine('ack', () => 0)).toBe(VOICE_LINES.ack[0])
    expect(pickVoiceLine('fullscreen', () => 0)).toBe(VOICE_LINES.fullscreen[0])
    expect(pickVoiceLine('bye', () => 0.99)).toBe(VOICE_LINES.bye[VOICE_LINES.bye.length - 1])
  })

  it('covers all seven interaction cues, each with at least one clip', () => {
    const cues = ['greet', 'ack', 'fullscreen', 'suggest', 'bye', 'done', 'error'] as const
    expect(Object.keys(VOICE_LINES).sort()).toEqual([...cues].sort())
    for (const cue of cues) expect(VOICE_LINES[cue].length).toBeGreaterThan(0)
  })

  it('every catalogued clip lives under the immutable-cached /avatar/ path', () => {
    for (const clips of Object.values(VOICE_LINES)) {
      for (const clip of clips) expect(clip.startsWith('/avatar/voice/')).toBe(true)
    }
  })
})

describe('playVoiceCue', () => {
  it('constructs the picked clip and starts playback', () => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
    const el = playVoiceCue('greet', () => 0) as unknown as FakeAudio
    expect(el.src).toBe(VOICE_LINES.greet[0])
    expect(el.play).toHaveBeenCalledTimes(1)
  })

  it("tolerates play() returning undefined (jsdom's stub does)", () => {
    class NoPromiseAudio extends FakeAudio {
      play = vi.fn(() => undefined as unknown as Promise<void>)
    }
    vi.stubGlobal('Audio', NoPromiseAudio as unknown as typeof Audio)
    expect(() => playVoiceCue('ack', () => 0)).not.toThrow()
  })

  it('reports a refused play() through onBlocked so callers can reset state', async () => {
    // iOS refuses off-gesture play() by rejecting the promise WITHOUT firing
    // 'ended' or 'error' DOM events — without this callback the speaking face
    // would stay stuck on after every done/error cue there.
    class RefusingAudio extends FakeAudio {
      play = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
    }
    vi.stubGlobal('Audio', RefusingAudio as unknown as typeof Audio)
    const onBlocked = vi.fn()
    playVoiceCue('done', () => 0, onBlocked)
    await Promise.resolve()
    await Promise.resolve()
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })
})
