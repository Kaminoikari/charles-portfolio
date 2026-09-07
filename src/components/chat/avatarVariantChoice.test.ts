// Which body a visitor lands on, from three sources that must rank in a fixed
// order and must never throw: a stale id in a link or in storage is the
// visitor's state, and the page has to load the default body through it.
import { describe, expect, it, vi } from 'vitest'

import {
  initialVariantId,
  rememberVariant,
  VARIANT_QUERY_PARAM,
  VARIANT_STORAGE_KEY,
} from './avatarVariantChoice'
import { ACTIVE_VARIANT, AVATAR_VARIANTS, OFFERED_VARIANTS } from './avatarVariants'

// An OFFERED body that is not the default, whatever the default is.
const OTHER = OFFERED_VARIANTS.find((v) => v.id !== ACTIVE_VARIANT)!.id
// And one the registry declares without offering it, if there is one.
const HELD_BACK = AVATAR_VARIANTS.find((v) => !v.offered)?.id

function memory(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: vi.fn((k: string) => map.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      map.set(k, v)
    }),
  }
}

describe('initialVariantId', () => {
  it('defaults to ACTIVE_VARIANT with nothing to go on', () => {
    expect(initialVariantId('', memory())).toBe(ACTIVE_VARIANT)
    expect(initialVariantId('', null)).toBe(ACTIVE_VARIANT)
  })

  it('prefers the URL over the remembered choice', () => {
    const storage = memory({ [VARIANT_STORAGE_KEY]: ACTIVE_VARIANT })
    expect(initialVariantId(`?${VARIANT_QUERY_PARAM}=${OTHER}`, storage)).toBe(OTHER)
  })

  it('falls back to the remembered choice', () => {
    expect(initialVariantId('', memory({ [VARIANT_STORAGE_KEY]: OTHER }))).toBe(OTHER)
  })

  it('ignores an id it does not know from either source, rather than throwing', () => {
    // A link to a look that was renamed, and a memory from before a rename,
    // are both the visitor's state: the default body loads through them.
    const storage = memory({ [VARIANT_STORAGE_KEY]: 'outfit-that-was-removed' })
    expect(initialVariantId(`?${VARIANT_QUERY_PARAM}=never-declared`, storage)).toBe(ACTIVE_VARIANT)
  })

  it('refuses a body the registry declares but does not offer', () => {
    // Not a typo and not a stale link: a real, loadable, measured body that a
    // visitor is not allowed to ask for. The test above cannot stand in for
    // this one, because `never-declared` is refused whether the gate reads the
    // whole registry or only the offered half of it — which is the difference
    // this is here to pin. Both entry points are checked: since 2026-09-07 an
    // unoffered id could otherwise arrive from a hand-written link OR from
    // storage written before the id stopped being offered.
    expect(
      HELD_BACK,
      'the registry now offers every body it declares, so this guard measures nothing',
    ).toBeDefined()
    const storage = memory({ [VARIANT_STORAGE_KEY]: HELD_BACK! })
    expect(initialVariantId(`?${VARIANT_QUERY_PARAM}=${HELD_BACK}`, storage)).toBe(ACTIVE_VARIANT)
    expect(initialVariantId('', storage)).toBe(ACTIVE_VARIANT)
  })

  it('never writes storage on the way in', () => {
    // A shared link shows a look; it does not change what the visitor sees on
    // their next visit. Only a pick that loaded is remembered, by the widget.
    const storage = memory()
    initialVariantId(`?${VARIANT_QUERY_PARAM}=${OTHER}`, storage)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('reads through a storage that throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {},
    }
    expect(initialVariantId('', storage)).toBe(ACTIVE_VARIANT)
  })
})

describe('rememberVariant', () => {
  it('writes the id under the one key initialVariantId reads', () => {
    const storage = memory()
    rememberVariant(OTHER, storage)
    expect(initialVariantId('', storage)).toBe(OTHER)
  })

  it('survives a storage that throws', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => rememberVariant(OTHER, storage)).not.toThrow()
  })
})
