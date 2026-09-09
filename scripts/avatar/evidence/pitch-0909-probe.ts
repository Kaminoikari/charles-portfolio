// Where does the engine's procedural pitch actually carry her?
//
// avatarGuideEngine writes head/spine/hips rotations straight from
// GestureOffsets with no version term, and a normalized bone's local axes
// follow the MODEL's. The two VRM versions face opposite ways along Z, so the
// same rotation should mirror. This applies `bow`'s own offsets (spine +0.32,
// head +0.18) to each registered body and reports where her head ends up
// relative to the direction her eyes point.
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { buildRig, resetRig, type Rig } from '../../../src/components/chat/rigProbe'

const BODIES: [string, string][] = [
  ['vroid-sample-b', 'AvatarSample_B_webp.vrm'],
  ['vrm1-twist-sample', 'vrm1-twist-sample.vrm'],
  ['vroid-studio-dressup', 'vroid-studio-dressup.vrm'],
]
const at = (rig: Rig, bone: string): THREE.Vector3 =>
  new THREE.Vector3().setFromMatrixPosition(rig.bones[bone].matrixWorld)

for (const [family, file] of BODIES) {
  const rig: Rig = buildRig(readFileSync(`public/avatar/${file}`))
  resetRig(rig)
  const head0 = at(rig, 'head')
  const eye0 = at(rig, 'leftEye')
  // Which way she looks, in this file's own space.
  const faceZ = Math.sign(eye0.z - head0.z)
  rig.bones.spine.rotation.x = 0.32
  rig.bones.head.rotation.x = 0.18
  rig.root.updateMatrixWorld(true)
  const head1 = at(rig, 'head')
  const towardFace = (head1.z - head0.z) * faceZ
  console.log(
    `${family.padEnd(21)} VRM ${rig.version}  eyes ${(eye0.z - head0.z >= 0 ? '+' : '')}` +
      `${((eye0.z - head0.z) * 1000).toFixed(1)}mm so she faces ${faceZ > 0 ? '+Z' : '-Z'}  ` +
      `| bow moves her head ${(towardFace * 1000).toFixed(1).padStart(7)}mm ` +
      `${towardFace > 0 ? 'FORWARD (a bow)' : 'BACKWARD (a lean away)'} ` +
      `and ${((head1.y - head0.y) * 1000).toFixed(1)}mm in Y`,
  )
}
