import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { AVATAR_FOV, AVATAR_FRAMING_DEFAULT } from './avatarMode'
import { buildMotion, buildRig, type Rig } from './rigProbe'
import {
  motionExtremes,
  solveFraming,
  viewSpan,
  type NamedMotion,
} from './framingSolver'

const asset = (...parts: string[]) =>
  new Uint8Array(readFileSync(path.join(process.cwd(), 'public', 'avatar', ...parts)))

const rig = (): Rig => buildRig(asset('AvatarSample_B_webp.vrm'))
const clip = (name: string): NamedMotion => ({
  name,
  motion: buildMotion(asset('animations', `${name}.vrma`)),
})

/**
 * The clips AVATAR_FRAMING_DEFAULT is composed for.
 *
 * `dance` and `squat` are excluded for the reasons the constant's own derivation
 * gives: `dance` moves the camera rather than this framing, and `squat` plays
 * only in the fullscreen column. Including either would bound this number with a
 * pose it never has to hold.
 */
const COMPOSED = ['akimbo', 'idleLoop', 'modelPose', 'peaceSign', 'playFingers',
  'scratchHead', 'spin', 'stretch']

describe('the solver reproduces the framing that was derived by hand', () => {
  const extremes = motionExtremes(rig(), COMPOSED.map(clip))

  it('finds the same two bounds the constant was derived from', () => {
    // 1.8091 stretch's raised hand as skin, 0.8225 peaceSign's hips.
    expect(extremes.topSkin).toBeCloseTo(1.8091, 3)
    expect(extremes.bottomHips).toBeCloseTo(0.8225, 3)
    expect(extremes.topClip).toBe('stretch')
    expect(extremes.bottomClip).toBe('peaceSign')
  })

  it('reproduces the shipped lookAtY from those bounds', () => {
    const solved = solveFraming(extremes, {
      distance: AVATAR_FRAMING_DEFAULT.distance,
      fov: AVATAR_FOV,
    })
    expect(solved.window.min).toBeCloseTo(1.2569, 3)
    expect(solved.window.max).toBeCloseTo(1.3747, 3)
    expect(solved.lookAtY).toBeCloseTo(AVATAR_FRAMING_DEFAULT.lookAtY, 4)
  })

  it('reports the clearances the derivation claims', () => {
    const solved = solveFraming(extremes, {
      distance: AVATAR_FRAMING_DEFAULT.distance,
      fov: AVATAR_FOV,
    })
    // "63mm of clearance above her hand, 55mm below her hips".
    expect(solved.clearance.top).toBeCloseTo(0.063, 3)
    expect(solved.clearance.bottom).toBeCloseTo(0.055, 3)
  })
})

describe('the solver generalises rather than memorising this body', () => {
  it('scales exactly with the body when the camera scales with it', () => {
    // The invariant that makes templates possible: scale the body and the camera
    // distance by the same factor and the framing follows, so a new body needs
    // one distance-per-height ratio rather than its own hand-derived lookAtY.
    const base = { topSkin: 1.8091, bottomHips: 0.8225, topClip: 'a', bottomClip: 'b' }
    for (const k of [0.7, 1.2, 1.6]) {
      const scaled = { ...base, topSkin: base.topSkin * k, bottomHips: base.bottomHips * k }
      const a = solveFraming(base, { distance: 2.3, fov: 27, round: 0.0001 })
      const b = solveFraming(scaled, { distance: 2.3 * k, fov: 27, round: 0.0001 })
      expect(b.lookAtY).toBeCloseTo(a.lookAtY * k, 4)
      expect(b.clearance.top).toBeCloseTo(a.clearance.top * k, 4)
    }
  })

  it('refuses a taller body at the distance composed for a shorter one', () => {
    // Not a rounding matter: a body 20% taller spans 1.1839m and the frame at
    // 2.3m covers 1.1044m, so there is no lookAtY that holds both bounds. The
    // caller has to move the camera, and saying so beats cropping her head.
    const base = { topSkin: 1.8091, bottomHips: 0.8225, topClip: 'stretch', bottomClip: 'peaceSign' }
    const taller = { ...base, topSkin: base.topSkin * 1.2, bottomHips: base.bottomHips * 1.2 }
    expect(() => solveFraming(taller, { distance: 2.3, fov: 27 })).toThrow(/no framing holds/)
    expect(solveFraming(taller, { distance: 2.3 * 1.2, fov: 27 }).lookAtY).toBeGreaterThan(0)
  })

  it('refuses a distance that cannot hold both bounds instead of cropping', () => {
    const tall = { topSkin: 2.4, bottomHips: 0.5, topClip: 'stretch', bottomClip: 'squat' }
    expect(() => solveFraming(tall, { distance: 2.3, fov: 27 })).toThrow(/no framing holds/)
    // The message has to say which clips did it, or the caller cannot act on it.
    expect(() => solveFraming(tall, { distance: 2.3, fov: 27 })).toThrow(/stretch/)
    expect(() => solveFraming(tall, { distance: 2.3, fov: 27 })).toThrow(/squat/)
  })

  it('opens the window by moving the camera back, as the geometry says', () => {
    const tall = { topSkin: 2.4, bottomHips: 0.5, topClip: 'a', bottomClip: 'b' }
    const solved = solveFraming(tall, { distance: 4.2, fov: 27 })
    expect(solved.span).toBeCloseTo(viewSpan(4.2, 27), 6)
    expect(solved.clearance.top).toBeGreaterThan(0)
    expect(solved.clearance.bottom).toBeGreaterThan(0)
  })

  it('centres the slack rather than hugging an edge', () => {
    const e = { topSkin: 1.5, bottomHips: 1.0, topClip: 'a', bottomClip: 'b' }
    const solved = solveFraming(e, { distance: 2.3, fov: 27, round: 0.0001 })
    expect(solved.clearance.top).toBeCloseTo(solved.clearance.bottom, 4)
  })

  it('rejects an empty clip list rather than inventing extremes', () => {
    expect(() => motionExtremes(rig(), [])).toThrow(/no clips/)
  })
})
