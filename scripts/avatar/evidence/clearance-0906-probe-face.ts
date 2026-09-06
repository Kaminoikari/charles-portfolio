// Does sampling a clip's keyframes only miss a deeper frame than the engine draws?
//
//     npx tsx scripts/avatar/evidence/clearance-0906-probe-face.ts
//
// Phase 6a left this open: rigProbe.test.ts asserted the dance's hand is 0.266
// into the head ellipsoid at an interpolated frame while measure-motions
// reported 0.300 for the same clip. measure-motions sampled
// motion.sampleTimes, which until 2026-09-06 was the union of every bone's
// keyframe times. If that union is coarser than the rate the engine draws at,
// the guard's worst case is not the clip's worst case and the waiver derived
// from it is too loose.
//
// The keyframe union is rebuilt here from the tracks rather than read off
// motion.sampleTimes, because sampleTimes now carries the 60 Hz walk this
// probe is the evidence for; reading it would compare the fix with itself.
//
// Prints per clip: the worst ratio over the keyframe times alone, the worst
// over a 60 Hz walk, the largest gap between consecutive keys, and how far
// inside her head the worst point is.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import * as THREE from 'three'

import { AVATAR_MOTIONS, type AvatarMotionName } from '../../../src/components/chat/avatarMotions'
import {
  applyMotion,
  buildMotion,
  buildRigFrom,
  handJoints,
  headPenetration,
  headVolume,
  type Motion,
  type Rig,
} from '../../../src/components/chat/rigProbe'
import { parseGlb } from '../../../src/components/chat/vrmHumanoid'

const asset = (...p: string[]): Uint8Array =>
  new Uint8Array(readFileSync(path.resolve('public/avatar', ...p)))

/** Every keyframe time in the clip, the union across bones. */
function keyTimes(motion: Motion): number[] {
  const set = new Set<number>()
  for (const track of Object.values(motion.rotation)) for (const t of track.times) set.add(t)
  if (motion.hipsTranslation) for (const t of motion.hipsTranslation.times) set.add(t)
  return [...set].sort((a, b) => a - b)
}

function worst(rig: Rig, motion: Motion, times: number[]) {
  const volume = headVolume(rig)
  const inverse = new THREE.Matrix4()
  const local = new THREE.Vector3()
  let best = Infinity
  let at = 0
  let frames = 0
  let deepMm = 0
  for (const t of times) {
    applyMotion(rig, motion, t)
    let inThisFrame = false
    for (const side of ['left', 'right'] as const) {
      for (const joint of handJoints(rig, side)) {
        const r = headPenetration(rig, volume, joint)
        if (r < 1) inThisFrame = true
        if (r < best) {
          best = r
          at = t
          // The ellipsoid surface along the same ray from the centre sits at
          // 1/sqrt(r) times this point's offset, so the radial depth is
          // (1/sqrt(r) - 1) times it. That is the conversion behind the 4.9mm
          // and 38.9mm in docs/plans/avatar-motion-capture.md. The offset is
          // taken in head-local space, where headPenetration puts the point
          // and where volume.centre lives.
          inverse.copy(rig.bones.head.matrixWorld).invert()
          local.copy(joint).applyMatrix4(inverse).sub(volume.centre)
          deepMm = local.length() * (1 / Math.sqrt(r) - 1) * 1000
        }
      }
    }
    if (inThisFrame) frames++
  }
  return { best, at, frames, deepMm }
}

const rig = buildRigFrom(parseGlb(asset('mika-pink.vrm')))

console.log('clip          keys   worst@keys         worst@60Hz         key gap   how far in')
for (const name of Object.keys(AVATAR_MOTIONS) as AvatarMotionName[]) {
  const motion = buildMotion(asset('animations', `${name}.vrma`))
  const keys = keyTimes(motion)
  const dense: number[] = []
  for (let k = 0; k / 60 <= motion.duration; k++) dense.push(k / 60)
  const a = worst(rig, motion, keys)
  const b = worst(rig, motion, dense)
  let gap = 0
  for (let i = 1; i < keys.length; i++) gap = Math.max(gap, keys[i] - keys[i - 1])
  console.log(
    `${name.padEnd(13)} ${String(keys.length).padStart(4)}   ` +
      `${a.best.toFixed(4).padStart(8)} @${a.at.toFixed(3)}s   ` +
      `${b.best.toFixed(4).padStart(8)} @${b.at.toFixed(3)}s   ` +
      `${(gap * 1000).toFixed(1).padStart(5)}ms   ` +
      `${b.best < 1 ? `${b.deepMm.toFixed(1)}mm in, ${b.frames} of ${dense.length} drawn frames` : 'clear'}`,
  )
}
