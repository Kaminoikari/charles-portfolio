// The hair and the skirt in motion, on the SHIPPED Milfy body, through
// three-vrm's own spring solver at 60 Hz (see springsim.ts for what is
// simulated and why the rest-pose gates cannot see this).
//
// What it holds: the tails do not go INSIDE the cardigan while the two clips
// that turn her round play, they do not enter her body beyond what the dance
// already does, no tail bone snaps more than a quarter turn in one frame, the
// legs do not come out through the skirt, and the dance's hop really does
// throw her hair well above where it hangs at rest (the number the frame's
// pan was derived from, and until Phase 5 a browser reading nobody could
// reproduce). The clothing numbers are the shipped build's own readings with
// room: dance 37mm / spin 42mm of one strand tip inside the coat's silhouette
// at the worst frame (0% of the tail 5mm or more in), jump 21.7° in the dance.
// The file this replaced read 271mm / 26% on the dance, 165mm on the spin,
// 16.7° — the tails hung inside the coat at rest and swung through it.
//
// Two clips, not ten: these are the two that turn her back to the camera,
// which is where the owner saw the hair go through the coat; the other eight
// read 0mm on the same build and each costs ~3s here. The full sweep is the
// clearance producer (springsim.ts --clearance), not this gate.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { AVATAR_VARIANTS } from '../../src/components/chat/avatarVariants'
import { parseArgs, runClip, type Report } from './springsim'

const milfy = AVATAR_VARIANTS.find((v) => v.id === 'milfy')
if (!milfy) throw new Error('no milfy variant declared')
// SPRINGSIM_TEST_MODEL points the guard at another file; that is how its
// mutations are run: evidence/clearance-0906-models.py writes a copy whose
// twintails have no colliders (must fail the coat gate, as the 2026-09-03
// file did) and one whose skirt is skinned wholly to the hips (must fail the
// skirt gate). See evidence/mutations-0906-clearance.md.
const MODEL = process.env.SPRINGSIM_TEST_MODEL ?? path.resolve('public', milfy.url.replace(/^\//, ''))
const CLIPS = ['dance', 'spin'] as const

const COAT_MAX_MM = 60
const COAT_SHARE_MAX = 0.02
const JUMP_MAX_DEG = 25
const REST_COAT_MAX_MM = 5
// The signed distance against the skin SATURATES at 50mm (springsim.ts REACH),
// so a budget is only a gate while it sits BELOW that. Hair already inside the
// skin at rest (the roots under the scalp) is left out since 2026-09-06;
// before that every clip read the cap and a single 60mm line could not fail.
//
//   spin   4.8mm on 2026-09-06, so 20mm is a real budget: it has room for the
//          reading to grow and still fails before the cap. C4's mutation (put
//          the roots back) sends it to 49.8 and reddens this.
//   dance  the tail passes through an arm and reads the cap. There is no
//          budget to set: 50 is the largest value the measure can return, so
//          "<= 50" would be true whatever the hair did. What it gets instead
//          is the cap PINNED, which stays honest about the known clipping and
//          still goes red if the measure starts under-reporting or stops
//          reporting (C18).
const BODY_MM: Record<(typeof CLIPS)[number], { max: number } | { atCap: number }> = {
  dance: { atCap: 50 },
  spin: { max: 20 },
}
// The legs against the skirt, the same saturating distance. The skirt is
// skinned by drape (Phase 4), not by the file's dormant J_Sec_*_Skirt springs,
// so what this measures is the skinning: a knee lifted to the side in the
// dance against cloth weighted to the hips. 18mm on the shipped body; a copy
// with the skirt skinned wholly to the hips reads 49mm, the cap.
const SKIRT_MAX_MM = 40
// The dance's hop throws the hair up: 89mm on this body's twintails
// (2026-09-06, evidence/clearance-0906-springsim.log), 146mm on the VRoid
// body's long hair in the 2026-08-20 browser sweep. A simulator that did not
// track the crown at all would read the rest value, or nothing, and fail this.
const CROWN_THROW_MIN = 0.05

// The instrument's own identity. These are the 2026-09-06 readings of the
// shipped body (evidence/retarget-0906-springsim-before-stride3.log), held to
// within 2mm, 0.1s and 3°. They are not a clothing gate: they exist so that a
// change to how the simulator POSES the body (Phase 6a moved it onto
// three-vrm's VRMHumanoid; Phase 5 moved every mesh and bone it reads onto the
// manifest and the humanoid map) has to reproduce what the old code measured.
// When the body itself changes, re-read them from the log of the new build.
const READINGS = {
  dance: { coatDepthMm: 37, coatWorstT: 17.23, coatWorstYaw: -107 },
  spin: { coatDepthMm: 42, coatWorstT: 2.07, coatWorstYaw: -90 },
} as const

const clipFile = (clip: string): string => path.resolve('public/avatar/animations', `${clip}.vrma`)

describe('Milfy through the spring solver', () => {
  const reports = {} as Record<(typeof CLIPS)[number], Report>

  beforeAll(async () => {
    for (const clip of CLIPS) {
      reports[clip] = await runClip(parseArgs([MODEL, `--clip=${clip}`, '--stride=3']), clipFile(clip))
    }
  }, 120_000)

  for (const clip of CLIPS) {
    it(`${clip}: the tails stay outside the cardigan and out of her body`, () => {
      const r = reports[clip]
      expect(r.restCoatDepthMm, 'at rest, inside the coat').toBeLessThanOrEqual(REST_COAT_MAX_MM)
      expect(r.coatDepthMm, `deepest into the coat @${r.coatWorstT.toFixed(2)}s`).toBeLessThanOrEqual(COAT_MAX_MM)
      expect(r.coatAtWorst, 'share of the tail ≥5mm inside at the worst frame').toBeLessThanOrEqual(COAT_SHARE_MAX)
      const body = BODY_MM[clip]
      if ('max' in body) {
        expect(r.bodyDepthMm, `deepest into the body @${r.bodyWorstT.toFixed(2)}s`).toBeLessThanOrEqual(body.max)
      } else {
        expect(r.bodyDepthMm, `body depth should still be pinned at the measure's cap`).toBeCloseTo(body.atCap, 1)
      }
      expect(r.jumpDeg, `largest one-frame turn (${r.jumpBone} @${r.jumpT.toFixed(2)}s)`).toBeLessThanOrEqual(JUMP_MAX_DEG)
      if (!process.env.SPRINGSIM_TEST_MODEL) {
        const pin = READINGS[clip]
        expect(Math.abs(r.coatDepthMm - pin.coatDepthMm), 'coat depth vs the recorded reading').toBeLessThanOrEqual(2)
        expect(Math.abs(r.coatWorstT - pin.coatWorstT), 'worst frame vs the recorded reading').toBeLessThanOrEqual(0.1)
        expect(Math.abs(r.coatWorstYaw - pin.coatWorstYaw), 'yaw at the worst frame vs the recorded reading').toBeLessThanOrEqual(3)
      }
    })

    it(`${clip}: the legs stay under the skirt`, () => {
      const r = reports[clip]
      expect(r.skirtDepthMm, `deepest leg through the skirt @${r.skirtWorstT.toFixed(2)}s`).toBeLessThanOrEqual(SKIRT_MAX_MM)
    })
  }

  it('dance: the hop throws her hair well above its resting crown', () => {
    const r = reports.dance
    // restCrownY is the bind pose's topmost vertex of anything she draws, and
    // crownY the topmost vertex at any frame of the clip, springs included.
    expect(r.restCrownY, 'rest crown').toBeGreaterThan(1.5)
    expect(r.crownY - r.restCrownY, `crown @${r.crownT.toFixed(2)}s over rest`).toBeGreaterThanOrEqual(CROWN_THROW_MIN)
    // And as the column's camera sees it: the hop comes toward the camera, so
    // the projected crown clears the projected rest by more still (2026-09-06:
    // 1.7099 against 1.5881, and the browser drew 1.7112).
    expect(r.crownScreen.column - r.restCrownScreen.column, 'projected crown over projected rest').toBeGreaterThanOrEqual(CROWN_THROW_MIN)
    expect(r.crownScreen.column, 'perspective lifts the hop').toBeGreaterThan(r.crownY)
  })

  it('a 1.0 export of the same body simulates the same', async () => {
    // The file's VRM 0.x block is what the simulator used to read by hand for
    // its spring group, its colliders and every mesh name. The 1.0 twin
    // (vrm1to0_test.twin: humanoid record, VRMC_springBone built from
    // secondaryAnimation with the collider z sign dropped, body turned round)
    // has none of that, so it can only be simulated through the humanoid map,
    // the manifest and three-vrm's own importer.
    const dir = mkdtempSync(path.join(tmpdir(), 'springsim-twin-'))
    const twin = path.join(dir, 'twin.vrm')
    execFileSync('python3', [
      '-c',
      'import sys; sys.path.insert(0, sys.argv[1]); import vrm1to0_test; vrm1to0_test.write_twin(sys.argv[2], sys.argv[3])',
      path.resolve('scripts/avatar'),
      MODEL,
      twin,
    ])
    copyFileSync(MODEL.replace(/\.vrm$/, '.parts.json'), twin.replace(/\.vrm$/, '.parts.json'))
    const r = await runClip(parseArgs([twin, '--clip=dance', '--stride=3']), clipFile('dance'))
    const v0 = reports.dance
    expect(Math.abs(r.coatDepthMm - v0.coatDepthMm), 'coat depth, 1.0 twin vs 0.x').toBeLessThanOrEqual(2)
    expect(Math.abs(r.crownY - v0.crownY), 'crown, 1.0 twin vs 0.x').toBeLessThanOrEqual(0.002)
    // The camera stands on the side she faces, which the twin has turned round.
    expect(Math.abs(r.crownScreen.column - v0.crownScreen.column), 'projected crown, 1.0 twin vs 0.x').toBeLessThanOrEqual(0.002)
    expect(Math.abs(r.skirtDepthMm - v0.skirtDepthMm), 'skirt depth, 1.0 twin vs 0.x').toBeLessThanOrEqual(2)
  }, 60_000)
})
