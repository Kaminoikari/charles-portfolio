// Why measure-motions' dance face ratio moved from 0.29x to 0.300 in Phase 6a:
// the derived face box, or the thumb tracks now landing on the thumb? Same rig,
// two boxes.
//
//     npx tsx scripts/avatar/evidence/retarget-0906-probe-faceratio.ts
import { readFileSync } from 'node:fs'

import * as THREE from 'three'

import { applyMotion, buildRig, buildMotion, handJoints, headPenetration, headVolume, type Rig } from '../../../src/components/chat/rigProbe'

const rig = buildRig(new Uint8Array(readFileSync('public/avatar/AvatarSample_B_webp.vrm')))
const dance = buildMotion(new Uint8Array(readFileSync('public/avatar/animations/dance.vrma')))

function worst(r: Rig, box: { min: THREE.Vector3; max: THREE.Vector3 }): { ratio: number; at: number } {
  const saved = r.faceBox
  r.faceBox = box
  const volume = headVolume(r)
  r.faceBox = saved
  let best = { ratio: Infinity, at: -1 }
  for (const t of dance.sampleTimes) {
    applyMotion(r, dance, t)
    for (const side of ['left', 'right'] as const) {
      for (const joint of handJoints(r, side)) {
        const ratio = headPenetration(r, volume, joint)
        if (ratio < best.ratio) best = { ratio, at: t }
      }
    }
  }
  return best
}

const derived = rig.faceBox
const constants = { min: new THREE.Vector3(-0.092, 1.287, -0.113), max: new THREE.Vector3(0.092, 1.503, 0.033) }
const f = (v: THREE.Vector3) => v.toArray().map((x) => x.toFixed(4)).join(', ')
console.log(`derived box   min (${f(derived.min)}) max (${f(derived.max)})`)
console.log(`2026-08-19    min (${f(constants.min)}) max (${f(constants.max)})`)
const a = worst(rig, derived)
const b = worst(rig, constants)
console.log(`dance face ratio  derived box ${a.ratio.toFixed(4)} @${a.at.toFixed(2)}s   2026-08-19 box ${b.ratio.toFixed(4)} @${b.at.toFixed(2)}s`)
