// Where the camera rests on a body taller than Mika's. The column is composed
// 25mm over her resting hair, so on 2026-09-25, the day ten more bodies
// were offered, three of them stood with their crowns through the top edge of
// the fullscreen frame at rest: Cat ears 1.668, Dark Shibu 1.650, Shibu 1.616.
import { describe, expect, it } from 'vitest'

import { avatarViewSpan } from './avatarMode'
import { AVATAR_MOTIONS, cameraPan, REST_AIR, restPan, type AvatarMotionName } from './avatarMotions'
import { AVATAR_FAMILIES, OFFERED_VARIANTS, type AvatarFamilyId } from './avatarVariants'
import type { MotionFrame } from './avatarMotions'
import { panRange } from './clearance'

const FRAMES: readonly MotionFrame[] = ['waistUp', 'column']
const OFFERED = [...new Set(OFFERED_VARIANTS.map((v) => v.family))]

function headroom(family: AvatarFamilyId, frame: MotionFrame, pan: number): number {
  const f = AVATAR_FAMILIES[family]
  return avatarViewSpan(f.framings.frames[frame], f.framings.fov).top + pan - (f.restCrownY + f.crownFringe)
}

describe('restPan', () => {
  it("leaves Mika's family where it was composed", () => {
    for (const frame of FRAMES) expect(restPan(frame, 'vroid-sample-b')).toBe(0)
  })

  it("is the air Mika has over her hair in the column, read off her family", () => {
    expect(REST_AIR).toBeCloseTo(headroom('vroid-sample-b', 'column', 0), 10)
    expect(REST_AIR).toBeGreaterThan(0.02)
  })

  it('keeps every offered crown under the top edge with that air, in both frames', () => {
    for (const family of OFFERED)
      for (const frame of FRAMES)
        expect(headroom(family, frame, restPan(frame, family)), `${family} ${frame}`).toBeGreaterThanOrEqual(REST_AIR - 1e-9)
  })

  it('moves no further than the centimetre that takes', () => {
    for (const family of OFFERED)
      for (const frame of FRAMES) {
        const pan = restPan(frame, family)
        if (pan > 0) expect(headroom(family, frame, pan - 0.01), `${family} ${frame}`).toBeLessThan(REST_AIR)
      }
  })

  it('lifts the three that stood through the column edge', () => {
    for (const family of ['vroid-hair-female', 'vroid-darkness-shibu', 'vroid-sendagaya-shibu'] as const)
      expect(restPan('column', family), family).toBeGreaterThan(0)
  })

  // Sample A is the shortest offered body (crown 1.5582). Vivi held this role
  // until 2026-09-26, when she was scaled to Mika's height.
  it('never lowers the camera for a shorter body', () => {
    expect(restPan('column', 'vroid-sample-a')).toBe(0)
    expect(restPan('waistUp', 'vroid-sample-a')).toBe(0)
  })
})

// A clip's pan is derived with no air over its crown, so on a tall body it sat
// below restPan: when the clip ended and she stood back up, the camera was
// still easing toward the rest pan and her crown crossed the top edge for a
// few frames (2026-09-25, the column's peaceSign on Shino, Dark Shibu and
// Vita, 86 to 122 pixels in the canvas's top two rows).
describe('cameraPan', () => {
  it('rests where restPan says when nothing plays', () => {
    for (const family of OFFERED) for (const frame of FRAMES)
      expect(cameraPan(null, frame, family)).toBe(restPan(frame, family))
  })

  it('keeps a clip at or above the rest pan on a body that needs one', () => {
    expect(cameraPan('peaceSign', 'column', 'vroid-sendagaya-shino')).toBe(restPan('column', 'vroid-sendagaya-shino'))
    expect(restPan('column', 'vroid-sendagaya-shino')).toBeGreaterThan(0)
  })

  it("leaves a clip's own lowering alone where the body needs no rest pan", () => {
    // Mika's dance drops the waist-up frame 70mm to keep her hips in it.
    expect(cameraPan('dance', 'waistUp', 'vroid-sample-b')).toBe(-0.07)
  })

  it("never lifts a clip's lowest hips out of the frame", () => {
    for (const family of OFFERED) {
      const f = AVATAR_FAMILIES[family]
      for (const [name, def] of Object.entries(AVATAR_MOTIONS))
        for (const frame of def.placements) {
          if (name in f.excluded) continue
          const pan = cameraPan(name as AvatarMotionName, frame, family)
          if (pan === 0) continue
          const { most } = panRange(f, name, frame, f.restCrownY, def.placements)
          expect(pan, `${family} ${name} ${frame}`).toBeLessThanOrEqual(most + 5e-5)
        }
    }
  })
})
