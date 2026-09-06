// R1 was GREEN: the twin test only checks that the two bodies agree up to the
// half turn, which a flip applied to the WRONG version also satisfies. This
// finds an absolute fact of the shipped 0.x body under `dance` that the
// unflipped clip contradicts, for a test to pin.
//
//     npx tsx scripts/avatar/evidence/retarget-0906-probe-flip.ts
import { readFileSync } from 'node:fs'

import * as THREE from 'three'

import { applyMotion, buildRig, buildMotion, handJoints, headPenetration, headVolume } from '../../../src/components/chat/rigProbe'

const rig = buildRig(new Uint8Array(readFileSync('public/avatar/AvatarSample_B_webp.vrm')))
const dance = buildMotion(new Uint8Array(readFileSync('public/avatar/animations/dance.vrma')))
const volume = headVolume(rig)
const world = (o: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)
for (const version of ['0', '1'] as const) {
  rig.version = version // '1' on the 0.x body = the clip played unflipped
  for (const t of [3.89, 8.23, 10.0, 17.23]) {
    applyMotion(rig, dance, t)
    let best = Infinity
    for (const side of ['left', 'right'] as const) for (const j of handJoints(rig, side)) best = Math.min(best, headPenetration(rig, volume, j))
    const head = world(rig.bones.head), l = world(rig.bones.leftHand), r = world(rig.bones.rightHand)
    console.log(`flip=${version === '0' ? 'yes' : 'no '} t=${t.toFixed(2)} face ratio ${best.toFixed(3)}  leftHand z-head ${(l.z - head.z).toFixed(3)}  rightHand z-head ${(r.z - head.z).toFixed(3)}`)
  }
}
