// The twintails in motion, on the SHIPPED Milfy body, through three-vrm's own
// spring solver at 60 Hz (see springsim.ts for what is simulated and why the
// rest-pose gates cannot see this).
//
// What it holds: the tails do not go INSIDE the cardigan while the two clips
// that turn her round play, they do not sink into her body, and no tail bone
// snaps more than a quarter turn in one frame. The numbers are the 2026-09-04
// build's own readings with room: dance 38mm / spin 32mm of one strand tip
// inside the coat's silhouette at the worst frame (0% of the tail 5mm or more
// in), body 50mm (an arm crossing the tail; the bundle is 70mm thick and the
// joint's hitRadius 35mm), jump 21.7° in the dance. The file this replaced
// read 271mm / 26% on the dance, 165mm on the spin, 16.7° — the tails hung
// inside the coat at rest and swung through it.
//
// Two clips, not ten: these are the two that turn her back to the camera,
// which is where the owner saw the hair go through the coat; the other eight
// read 0mm on the same build and each costs ~3s here.
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AVATAR_VARIANTS } from '../../src/components/chat/avatarVariants'
import { parseArgs, runClip } from './springsim'

const milfy = AVATAR_VARIANTS.find((v) => v.id === 'milfy')
if (!milfy) throw new Error('no milfy variant declared')
// SPRINGSIM_TEST_MODEL points the guard at another file; that is how its
// mutation is run (the 2026-09-03 file, which must fail it).
const MODEL = process.env.SPRINGSIM_TEST_MODEL ?? path.resolve('public', milfy.url.replace(/^\//, ''))
const CLIPS = ['dance', 'spin'] as const

const COAT_MAX_MM = 60
const COAT_SHARE_MAX = 0.02
const BODY_MAX_MM = 60
const JUMP_MAX_DEG = 25
const REST_COAT_MAX_MM = 5

// The instrument's own identity. These are the 2026-09-06 readings of the
// shipped body (evidence/retarget-0906-springsim-before-stride3.log), held to
// within 2mm, 0.1s and 3°. They are not a clothing gate: they exist so that a
// change to how the simulator POSES the body (Phase 6a moved it onto
// three-vrm's VRMHumanoid) has to reproduce what the old poser measured.
// When the body itself changes, re-read them from the log of the new build.
const READINGS = {
  dance: { coatDepthMm: 37, coatWorstT: 17.23, coatWorstYaw: -107 },
  spin: { coatDepthMm: 42, coatWorstT: 2.07, coatWorstYaw: -90 },
} as const

describe('Milfy twintails through the spring solver', () => {
  for (const clip of CLIPS) {
    it(`${clip}: the tails stay outside the cardigan and out of her body`, async () => {
      const args = parseArgs([MODEL, `--clip=${clip}`, '--stride=3'])
      const r = await runClip(args, path.resolve('public/avatar/animations', `${clip}.vrma`))
      expect(r.restCoatDepthMm, 'at rest, inside the coat').toBeLessThanOrEqual(REST_COAT_MAX_MM)
      expect(r.coatDepthMm, `deepest into the coat @${r.coatWorstT.toFixed(2)}s`).toBeLessThanOrEqual(COAT_MAX_MM)
      expect(r.coatAtWorst, 'share of the tail ≥5mm inside at the worst frame').toBeLessThanOrEqual(COAT_SHARE_MAX)
      expect(r.bodyDepthMm, `deepest into the body @${r.bodyWorstT.toFixed(2)}s`).toBeLessThanOrEqual(BODY_MAX_MM)
      expect(r.jumpDeg, `largest one-frame turn (${r.jumpBone} @${r.jumpT.toFixed(2)}s)`).toBeLessThanOrEqual(JUMP_MAX_DEG)
      if (!process.env.SPRINGSIM_TEST_MODEL) {
        const pin = READINGS[clip]
        expect(Math.abs(r.coatDepthMm - pin.coatDepthMm), 'coat depth vs the recorded reading').toBeLessThanOrEqual(2)
        expect(Math.abs(r.coatWorstT - pin.coatWorstT), 'worst frame vs the recorded reading').toBeLessThanOrEqual(0.1)
        expect(Math.abs(r.coatWorstYaw - pin.coatWorstYaw), 'yaw at the worst frame vs the recorded reading').toBeLessThanOrEqual(3)
      }
    }, 60_000)
  }
})
