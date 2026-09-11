// Is the pan an arithmetic offset on the recorded crown height?
//
//   npx tsx scripts/avatar/evidence/pan-shift-0911.ts
//
// Written to settle a diagnosis, not to guard anything. The first reading of
// why three families' pans would not converge was that springsim projects the
// crown through a panned camera while panRange subtracts an unpanned edge, and
// that the fix was to record the crown unpanned and add the pan back
// arithmetically. This measures both halves of that claim against the camera
// springsim actually builds (springsim.ts, FrameCamera, read on 2026-09-11),
// reproduced here rather than imported because the class is not exported and
// the point is the geometry rather than the call.
//
// It says: the pan is an exact translation of the rig, so the reading under a
// pan is the UNPANNED reading of a point moved down by the pan, plus the pan --
// which is not recoverable from a recorded height alone. And the shift in the
// projected crown per unit of pan is small and negative, never the 1:1 that a
// reference-frame error would produce. The output is in pan-shift-0911.md.
import * as THREE from 'three'
import { AVATAR_FOV, AVATAR_CAMERA_TILT, AVATAR_FRAMING_COLUMN } from '../../../src/components/chat/avatarMode'

function mk(lookAtY: number, distance: number, forwardZ: number) {
  const cam = new THREE.PerspectiveCamera(AVATAR_FOV, 1, 0.1, 30)
  cam.position.set(0, lookAtY + AVATAR_CAMERA_TILT, forwardZ * distance)
  cam.lookAt(0, lookAtY, 0)
  cam.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(cam.matrixWorld).invert()
  return (x: number, y: number, z: number): number => {
    const v = new THREE.Vector3(x, y, z).applyMatrix4(inv)
    return lookAtY + (distance * v.y) / -v.z
  }
}

const F = AVATAR_FRAMING_COLUMN
const L = F.lookAtY
const D = F.distance
console.log(`column: lookAtY ${L}, distance ${D}, fov ${AVATAR_FOV}, tilt ${AVATAR_CAMERA_TILT}`)
console.log('crown at (x, y, z); p = pan. screen_p - screen_0 should be p if the pan were arithmetic.\n')
console.log('  y      z       p     screen_0   screen_p   screen_p-screen_0   d/dp')
for (const z of [0, 0.06, 0.12]) {
  for (const y of [1.55, 1.70, 1.85]) {
    const s0 = mk(L, D, 1)(0, y, z)
    for (const p of [0.10, 0.30]) {
      const sp = mk(L + p, D, 1)(0, y, z)
      console.log(
        `  ${y.toFixed(2)}  ${z.toFixed(2)}   ${p.toFixed(2)}   ${s0.toFixed(5)}   ${sp.toFixed(5)}   ` +
        `${(sp - s0).toFixed(5)}          ${((sp - s0) / p).toFixed(4)}`,
      )
    }
  }
}
// And the identity: screen_p(x,y,z) === screen_0(x, y-p, z) + p ?
console.log('\nidentity screen_p(P) == screen_0(P - p) + p:')
let worst = 0
for (const z of [-0.1, 0, 0.05, 0.2]) for (const y of [1.4, 1.7, 2.0]) for (const p of [0.05, 0.17, 0.34]) {
  const a = mk(L + p, D, 1)(0.03, y, z)
  const b = mk(L, D, 1)(0.03, y - p, z) + p
  worst = Math.max(worst, Math.abs(a - b))
}
console.log(`  worst absolute difference over 36 samples: ${worst.toExponential(3)}`)
