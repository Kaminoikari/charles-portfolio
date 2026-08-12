import { describe, expect, it } from 'vitest'
import { deriveAvatarMode, avatarGuideEnabled } from './avatarMode'

describe('deriveAvatarMode', () => {
  it('is idle with empty input and no stream', () => {
    expect(deriveAvatarMode('', 'idle')).toBe('idle')
    expect(deriveAvatarMode('', 'error')).toBe('idle')
  })

  it('is listening while the visitor has typed anything', () => {
    expect(deriveAvatarMode('R', 'idle')).toBe('listening')
    expect(deriveAvatarMode('RAG 怎麼設計', 'idle')).toBe('listening')
  })

  it('treats whitespace-only input as typing too (IME composition often is)', () => {
    expect(deriveAvatarMode(' ', 'idle')).toBe('listening')
  })

  it('is speaking for the whole streaming window, regardless of input', () => {
    expect(deriveAvatarMode('', 'streaming')).toBe('speaking')
    expect(deriveAvatarMode('下一題打到一半', 'streaming')).toBe('speaking')
  })
})

function fakeMatchMedia(matches: Record<string, boolean>) {
  return (q: string) => ({ matches: matches[q] ?? false })
}

const DESKTOP = {
  '(min-width: 880px)': true,
  '(pointer: fine)': true,
  '(prefers-reduced-motion: reduce)': false,
}

describe('avatarGuideEnabled', () => {
  const on = {
    search: '?avatar=1',
    stored: null,
    matchMedia: fakeMatchMedia(DESKTOP),
    webgl: () => true,
  }

  it('turns on with the query flag on a capable desktop', () => {
    expect(avatarGuideEnabled(on)).toBe(true)
  })

  it('turns on via the localStorage flag without the query param', () => {
    expect(avatarGuideEnabled({ ...on, search: '', stored: '1' })).toBe(true)
  })

  it('stays off with no flag at all — production default', () => {
    expect(avatarGuideEnabled({ ...on, search: '', stored: null })).toBe(false)
  })

  it('stays off on narrow / coarse-pointer screens', () => {
    expect(
      avatarGuideEnabled({
        ...on,
        matchMedia: fakeMatchMedia({ ...DESKTOP, '(min-width: 880px)': false }),
      }),
    ).toBe(false)
    expect(
      avatarGuideEnabled({
        ...on,
        matchMedia: fakeMatchMedia({ ...DESKTOP, '(pointer: fine)': false }),
      }),
    ).toBe(false)
  })

  it('stays off under prefers-reduced-motion', () => {
    expect(
      avatarGuideEnabled({
        ...on,
        matchMedia: fakeMatchMedia({ ...DESKTOP, '(prefers-reduced-motion: reduce)': true }),
      }),
    ).toBe(false)
  })

  it('stays off without WebGL', () => {
    expect(avatarGuideEnabled({ ...on, webgl: () => false })).toBe(false)
  })

  it('never probes WebGL unless every cheaper gate already passed', () => {
    // The probe creates a real GL context in the browser, so the flag-off
    // production path must not reach it.
    let probed = 0
    const webgl = () => {
      probed++
      return true
    }
    avatarGuideEnabled({ ...on, search: '', stored: null, webgl })
    expect(probed).toBe(0)
    avatarGuideEnabled({ ...on, webgl })
    expect(probed).toBe(1)
  })
})
