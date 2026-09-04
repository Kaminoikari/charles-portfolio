import { describe, expect, it } from 'vitest'

import { GESTURE_NAMES } from '../../src/components/chat/avatarGuideEngine'
import { AVATAR_MOTIONS } from '../../src/components/chat/avatarMotions'
import {
  MIKA_MILFY_MODEL_URL,
  PREVIEW_EMOTIONS,
  PREVIEW_GESTURES,
  PREVIEW_MOTIONS,
} from './live-preview-config'

describe('Mika Milfy live preview config', () => {
  it('loads the local-only Mika Milfy model', () => {
    expect(MIKA_MILFY_MODEL_URL).toBe('/avatar/mika-milfy-10.vrm')
  })

  it('offers every motion supported by the avatar engine', () => {
    expect(new Set(PREVIEW_MOTIONS.map(({ name }) => name))).toEqual(
      new Set(Object.keys(AVATAR_MOTIONS)),
    )
  })

  it('offers every procedural gesture exposed by the avatar handle', () => {
    expect(new Set(PREVIEW_GESTURES.map(({ name }) => name))).toEqual(new Set(GESTURE_NAMES))
  })

  it('gives every preview control a unique label', () => {
    const labels = [...PREVIEW_MOTIONS, ...PREVIEW_GESTURES, ...PREVIEW_EMOTIONS].map(
      ({ label }) => label,
    )
    expect(new Set(labels).size).toBe(labels.length)
  })
})
