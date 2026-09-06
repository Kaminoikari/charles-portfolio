import { readFileSync } from 'node:fs'
import path from 'node:path'

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
    expect(MIKA_MILFY_MODEL_URL).toBe('/avatar/mika-milfy-12.vrm')
  })

  it('tells the engine which rig the previewed build came off', () => {
    // This tool's whole point is to try the clips on a build BEFORE it is
    // declared in AVATAR_VARIANTS — point the URL above at a fresh
    // mika-milfy-13.vrm and familyOfUrl returns null, so the engine refuses the
    // load. Passing the family is what keeps that working. Drop the argument
    // and the page still comes up with its full control panel; what you get is
    // an error line in #preview-status, no character, and every motion button
    // permanently disabled — a failure that looks like a missing file and is
    // the last thing anyone would trace back to this line.
    const source = readFileSync(path.join(process.cwd(), 'scripts', 'avatar', 'live-preview.ts'), 'utf8')
    expect(source, 'live-preview must hand the family to initAvatarGuide').toMatch(
      /\n {2}MIKA_MILFY_FAMILY,\n\)/,
    )
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
