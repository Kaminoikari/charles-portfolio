// Run: npx tsx scripts/avatar/evidence/family2-0907-space.ts
//
// Does rigProbe's coordinate space hold on the second family?
//
// When this was written rigProbe's header fixed the probe space at "-Z =
// FORWARD, toward the viewer" and cited one body's eyes and toes as the
// measurement behind it. Two of its probes depended on that, and a third on the
// hand's rest frame:
//
//   CAMERA_DIR (0,0,-1)   palmToViewer dotted against it
//   screenX(x) = -x       the sideways edges were read through it
//   PALM_REST (0,-1,0)    the palm normal in the HAND BONE's own frame,
//                         which is only the palm normal if that bone rests
//                         unrotated
//
// The first two are what this run disproved: they are now `cameraDir(rig)` and
// `screenX(rig, x)`, both deriving the sign from the body's VRM version.
//
// This prints, per declared body, the same measurements the header cites, plus
// the hand rest rotation and a palm normal derived from the hand's own geometry
// (the plane through wrist, index and little knuckles) so the constant can be
// checked against something that does not assume a convention.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import * as THREE from 'three'

import { buildRig, type Rig } from '/Users/charles/portfolio/src/components/chat/rigProbe.ts'
import { AVATAR_VARIANTS } from '/Users/charles/portfolio/src/components/chat/avatarVariants.ts'

function world(rig: Rig, bone: string): THREE.Vector3 | null {
  if (!(bone in rig.bones)) return null
  return new THREE.Vector3().setFromMatrixPosition(rig.bones[bone].matrixWorld)
}

const fmt = (v: THREE.Vector3 | null): string =>
  v ? `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})` : '(absent)'

for (const variant of AVATAR_VARIANTS) {
  const bytes = new Uint8Array(
    readFileSync(path.join('/Users/charles/portfolio/public', variant.url.replace(/^\//, ''))),
  )
  const rig = buildRig(bytes)
  console.log(`\n=== ${variant.id}  family ${variant.family}  VRM ${rig.version}  ${variant.url}`)

  // The header's own evidence: which way does the body face in its own space?
  const head = world(rig, 'head')
  const eye = world(rig, 'leftEye') ?? world(rig, 'rightEye')
  const toes = world(rig, 'leftToes') ?? world(rig, 'leftFoot')
  console.log(`  head ${fmt(head)}   eye ${fmt(eye)}   toes ${fmt(toes)}`)
  if (head && eye) {
    const dz = eye.z - head.z
    console.log(`  eye is ${dz > 0 ? '+Z' : '-Z'} of the head bone (${(dz * 1000).toFixed(1)}mm) -> faces ${dz > 0 ? '+Z' : '-Z'}`)
  }
  if (head && toes) {
    const dz = toes.z - head.z
    console.log(`  toes are ${dz > 0 ? '+Z' : '-Z'} of the head bone (${(dz * 1000).toFixed(1)}mm)`)
  }

  // Does the hand bone rest unrotated? PALM_REST is a vector in this frame.
  for (const side of ['left', 'right'] as const) {
    const hand = rig.bones[`${side}Hand`]
    if (!hand) continue
    const q = hand.quaternion
    const rest = new THREE.Quaternion()
    const angle = THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(q.dot(rest)))))
    // The palm normal from the hand's own geometry: the plane through the
    // wrist and two knuckles. Cross order is fixed per side so both hands
    // give a normal on the same side of the palm.
    const wrist = world(rig, `${side}Hand`)
    const index = world(rig, `${side}IndexProximal`)
    const little = world(rig, `${side}LittleProximal`)
    let derived = 'no knuckles'
    if (wrist && index && little) {
      const a = new THREE.Vector3().subVectors(index, wrist)
      const b = new THREE.Vector3().subVectors(little, wrist)
      const n = new THREE.Vector3().crossVectors(a, b).normalize()
      if (side === 'right') n.negate()
      derived = fmt(n)
    }
    // What PALM_REST claims, taken through the same bone.
    const claimed = new THREE.Vector3(0, -1, 0).applyQuaternion(
      new THREE.Quaternion().setFromRotationMatrix(hand.matrixWorld),
    )
    console.log(
      `  ${side}Hand rest rotation ${angle.toFixed(1)}deg   PALM_REST says ${fmt(claimed)}   geometry says ${derived}`,
    )
  }
}
