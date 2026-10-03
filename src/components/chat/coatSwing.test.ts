import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AVATAR_VARIANTS } from './avatarVariants'
import { AVATAR_MOTIONS } from './avatarMotions'
import {
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_COLUMN_ASPECT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  avatarViewHalfWidth,
} from './avatarMode'
import { COAT_HAND_DEPTH, COAT_SWING_STEP, COAT_SWINGS, coatSwingAt, coatSwingCurve, swingArmsOut } from './coatSwing'
import { applyMotion, buildMotion, buildRigFrom, deriveSilhouetteSkin, garmentTriangles, handInGarment, posedMesh, resetRig, silhouetteReach, syncRig } from './rigProbe'
import { parseGlb } from './vrmHumanoid'

// rigProbe.test.ts holds every clip inside the canvas on each family's own
// measured body, which wears no coat and so never turns its arms out.
const HALF_WIDTH = {
  waistUp: avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
  column: avatarViewHalfWidth(AVATAR_FRAMING_COLUMN, { w: AVATAR_COLUMN_ASPECT, h: 1 }),
}

const asset = (...p: string[]) => new Uint8Array(readFileSync(path.join(process.cwd(), 'public', ...p)))

describe('coatSwingAt', () => {
  it('runs straight between keys and holds the last one past the end', () => {
    const curve = [0, 10, 30]
    expect(coatSwingAt(curve, 0)).toBe(0)
    expect(coatSwingAt(curve, COAT_SWING_STEP / 2)).toBeCloseTo(5)
    expect(coatSwingAt(curve, COAT_SWING_STEP * 1.5)).toBeCloseTo(20)
    expect(coatSwingAt(curve, 99)).toBe(30)
    expect(coatSwingAt([], 1)).toBe(0)
  })
})

describe('a coat that would swallow her hands', () => {
  it('names bodies a visitor can be shown, and has a curve for every clip it lists', () => {
    for (const coat of COAT_SWINGS) {
      expect(AVATAR_VARIANTS.map((v) => v.url)).toContain(coat.url)
      for (const clip of coat.clips) {
        const motion = buildMotion(asset('avatar/animations', `${clip}.vrma`))
        expect(coatSwingCurve(coat.url, clip)?.length, `${coat.url} ${clip}`).toBe(Math.floor(motion.duration / COAT_SWING_STEP) + 1)
      }
    }
  })

  for (const coat of COAT_SWINGS) {
    const glb = parseGlb(asset(coat.url))
    const rig = buildRigFrom(glb)
    for (const clip of coat.clips) {
      const motion = buildMotion(asset('avatar/animations', `${clip}.vrma`))
      let garment: number[] | null = null
      // Between the keys as well as on them, and not at the moments the curve
      // was derived from (tenths of a key): the engine runs straight from one
      // key to the next, and a walking hand passes the coat's edge in less.
      const deepest = (curve: readonly number[] | null, step: number): { depth: number; at: number } => {
        let worst = { depth: 0, at: 0 }
        for (let t = 0; t <= motion.duration; t += step) {
          applyMotion(rig, motion, t)
          swingArmsOut((name) => rig.bones[name], rig.version, curve ? coatSwingAt(curve, t) : 0)
          syncRig(rig)
          const mesh = posedMesh(glb, rig)
          garment ??= garmentTriangles(glb, mesh, coat.material)
          const depth = handInGarment(rig, mesh, garment)
          if (depth > worst.depth) worst = { depth, at: t }
        }
        return worst
      }

      it(`keeps her hands out of the coat through ${clip} on ${coat.url}`, () => {
        const { depth, at } = deepest(coatSwingCurve(coat.url, clip), COAT_SWING_STEP / 8)
        expect(depth, `${(depth * 1000).toFixed(0)}mm into the coat at ${at}s`).toBeLessThanOrEqual(COAT_HAND_DEPTH)
      }, 120_000)

      it(`keeps the turned-out arms inside the canvas through ${clip} on ${coat.url}`, () => {
        const curve = coatSwingCurve(coat.url, clip)
        // Measured at rest: the test above leaves her in its last pose.
        resetRig(rig)
        const skin = deriveSilhouetteSkin(glb, rig)
        let widest = 0
        for (let t = 0; t <= motion.duration; t += COAT_SWING_STEP / 2) {
          applyMotion(rig, motion, t)
          swingArmsOut((name) => rig.bones[name], rig.version, curve ? coatSwingAt(curve, t) : 0)
          syncRig(rig)
          const reach = silhouetteReach(rig, skin)
          widest = Math.max(widest, reach.left, reach.right)
        }
        for (const placement of AVATAR_MOTIONS[clip].placements) expect(widest, placement).toBeLessThan(HALF_WIDTH[placement])
      })

      it(`needs the turn: ${clip} alone puts her hands in the coat on ${coat.url}`, () => {
        const { depth } = deepest(null, COAT_SWING_STEP)
        expect(depth).toBeGreaterThan(0.1)
      }, 120_000)
    }
  }
})
