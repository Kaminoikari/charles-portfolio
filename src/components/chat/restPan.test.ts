// Where the camera rests on a body taller than Mika's. The column is composed
// 25mm over her resting hair, so on 2026-09-25, the day twelve more bodies
// were offered, three of them stood with their crowns through the top edge of
// the fullscreen frame at rest: Cat ears 1.668, Dark Shibu 1.650, Shibu 1.616.
import { describe, expect, it } from 'vitest'

import { avatarViewSpan } from './avatarMode'
import { REST_AIR, restPan } from './avatarMotions'
import { AVATAR_FAMILIES, OFFERED_VARIANTS, type AvatarFamilyId } from './avatarVariants'
import type { MotionFrame } from './avatarMotions'

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

  it('never lowers the camera for a shorter body', () => {
    expect(restPan('column', 'vroid-vivi')).toBe(0)
    expect(restPan('waistUp', 'vroid-vivi')).toBe(0)
  })
})
