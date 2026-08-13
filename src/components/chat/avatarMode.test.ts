import { describe, expect, it } from 'vitest'
import { deriveAvatarMode, avatarGuideEnabled, avatarPlacement } from './avatarMode'

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

describe('avatarPlacement', () => {
  it('stands above the launcher whenever the panel is stowed, any viewport', () => {
    expect(avatarPlacement('minimised', true, true)).toBe('launcher')
    expect(avatarPlacement('minimised', false, false)).toBe('launcher')
  })

  it('stands beside the docked panel only when the viewport has room for both', () => {
    expect(avatarPlacement('docked', true, true)).toBe('beside-panel')
    // Width decides the docked case; a short-but-wide window still has the
    // side column free, so height does not demote it.
    expect(avatarPlacement('docked', true, false)).toBe('beside-panel')
  })

  it('hides while the docked panel covers a narrow (phone) viewport', () => {
    expect(avatarPlacement('docked', false, true)).toBe('hidden')
  })

  it('stands in the pipeline rail during a wide and tall fullscreen takeover', () => {
    expect(avatarPlacement('fullscreen', true, true)).toBe('rail')
  })

  it('hides under a narrow fullscreen takeover (no rail exists there)', () => {
    expect(avatarPlacement('fullscreen', false, true)).toBe('hidden')
  })

  it('hides in a short fullscreen window, where she would collide with the pipeline', () => {
    expect(avatarPlacement('fullscreen', true, false)).toBe('hidden')
  })
})

function fakeMatchMedia(matches: Record<string, boolean>) {
  return (q: string) => ({ matches: matches[q] ?? false })
}

describe('avatarGuideEnabled', () => {
  const on = {
    matchMedia: fakeMatchMedia({ '(prefers-reduced-motion: reduce)': false }),
    webgl: () => true,
  }

  it('turns on for any visitor with motion allowed and WebGL2 — mobile included', () => {
    expect(avatarGuideEnabled(on)).toBe(true)
  })

  it('stays off under prefers-reduced-motion', () => {
    expect(
      avatarGuideEnabled({
        ...on,
        matchMedia: fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }),
      }),
    ).toBe(false)
  })

  it('stays off without WebGL2', () => {
    expect(avatarGuideEnabled({ ...on, webgl: () => false })).toBe(false)
  })

  it('never probes WebGL unless the cheaper reduced-motion gate already passed', () => {
    // The probe creates a real GL context, so reduced-motion visitors (who will
    // never see the avatar) must not pay that cost.
    let probed = 0
    const webgl = () => {
      probed++
      return true
    }
    avatarGuideEnabled({
      ...on,
      matchMedia: fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }),
      webgl,
    })
    expect(probed).toBe(0)
    avatarGuideEnabled({ ...on, webgl })
    expect(probed).toBe(1)
  })
})
