import { afterEach, describe, expect, it, vi } from 'vitest'
import { VOICE_LINES, VOICE_LINES_EN, pickVoiceLine, playVoiceCue, voiceLinesFor } from './avatarVoice'

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

describe('voiceLinesFor', () => {
  it('serves the katakana-English set to the en locale and Japanese to the rest', () => {
    expect(voiceLinesFor('en')).toBe(VOICE_LINES_EN)
    expect(voiceLinesFor('ja')).toBe(VOICE_LINES)
    expect(voiceLinesFor('zh-TW')).toBe(VOICE_LINES)
  })

  it('keeps the two catalogues in lockstep: same cues, same clip counts', () => {
    expect(Object.keys(VOICE_LINES_EN).sort()).toEqual(Object.keys(VOICE_LINES).sort())
    for (const cue of Object.keys(VOICE_LINES) as Array<keyof typeof VOICE_LINES>) {
      expect(VOICE_LINES_EN[cue].length).toBe(VOICE_LINES[cue].length)
    }
  })

  it('every English clip is a distinct -en file so caches never collide', () => {
    for (const clips of Object.values(VOICE_LINES_EN)) {
      for (const clip of clips) expect(clip.endsWith('-en.m4a')).toBe(true)
    }
  })
})

describe('pickVoiceLine', () => {
  it('picks deterministically from the locale catalogue via the injected rng', () => {
    expect(pickVoiceLine('greet', 'ja', () => 0)).toBe(VOICE_LINES.greet[0])
    expect(pickVoiceLine('greet', 'en', () => 0)).toBe(VOICE_LINES_EN.greet[0])
    expect(pickVoiceLine('bye', 'zh-TW', () => 0.99)).toBe(VOICE_LINES.bye[VOICE_LINES.bye.length - 1])
  })

  it('covers all seven interaction cues, each with at least one clip', () => {
    const cues = ['greet', 'ack', 'fullscreen', 'suggest', 'bye', 'done', 'error'] as const
    expect(Object.keys(VOICE_LINES).sort()).toEqual([...cues].sort())
    for (const cue of cues) expect(VOICE_LINES[cue].length).toBeGreaterThan(0)
  })

  it('every catalogued clip lives under the immutable-cached /avatar/ path', () => {
    for (const table of [VOICE_LINES, VOICE_LINES_EN]) {
      for (const clips of Object.values(table)) {
        for (const clip of clips) expect(clip.startsWith('/avatar/voice/')).toBe(true)
      }
    }
  })
})

describe('playVoiceCue', () => {
  it('constructs the locale-picked clip and starts playback', () => {
    vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
    const el = playVoiceCue('greet', 'en', () => 0) as unknown as FakeAudio
    expect(el.src).toBe(VOICE_LINES_EN.greet[0])
    expect(el.play).toHaveBeenCalledTimes(1)
  })

  it("tolerates play() returning undefined (jsdom's stub does)", () => {
    class NoPromiseAudio extends FakeAudio {
      play = vi.fn(() => undefined as unknown as Promise<void>)
    }
    vi.stubGlobal('Audio', NoPromiseAudio as unknown as typeof Audio)
    expect(() => playVoiceCue('ack', 'ja', () => 0)).not.toThrow()
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
    playVoiceCue('done', 'en', () => 0, onBlocked)
    await Promise.resolve()
    await Promise.resolve()
    expect(onBlocked).toHaveBeenCalledTimes(1)
  })
})
