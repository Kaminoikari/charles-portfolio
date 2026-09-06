// How much does crownOn's world-height transfer differ from a projected one?
//
//     npx tsx scripts/avatar/evidence/clearance-0906-probe-transfer.ts
//
// crownOn carries a clip's throw between bodies of one family as
//   crownScreen[frame] - file.restCrownY + thisBody.restCrownY + crownFringe
// The throw is a PROJECTED height and the two resting crowns are WORLD
// heights, so the offset between two bodies is added without being projected.
// Perspective magnifies a height difference by the ratio of the subject
// plane's distance to the point's own depth, so the two are not the same
// number. This prints how far apart they are over the spread this family
// actually has (the simulated body rests at 1.5757, the measured one at
// 1.582, and rigProbe derives 1.582 on the shipped base body).
import * as THREE from 'three'

import {
  AVATAR_CAMERA_TILT,
  AVATAR_FOV,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  type AvatarFraming,
} from '../../../src/components/chat/avatarMode'

/** springsim's FrameCamera, reproduced: the height on the subject plane a world point shares a row with. */
function plane(framing: AvatarFraming, lookAtY: number, p: THREE.Vector3): number {
  const cam = new THREE.PerspectiveCamera(AVATAR_FOV, 1, 0.1, 30)
  cam.position.set(0, lookAtY + AVATAR_CAMERA_TILT, -framing.distance)
  cam.lookAt(0, lookAtY, 0)
  cam.updateMatrixWorld(true)
  const v = p.clone().applyMatrix4(new THREE.Matrix4().copy(cam.matrixWorld).invert())
  return lookAtY + (framing.distance * v.y) / -v.z
}

// The crown vertex the simulator found on the dance's worst frame is a hair
// tip near the head: off the axis by a few centimetres in x and z. Its exact
// place matters, so sweep the plausible box rather than assume one point.
const FRAMES: Array<[string, AvatarFraming, number]> = [
  ['column', AVATAR_FRAMING_COLUMN, AVATAR_FRAMING_COLUMN.lookAtY + 0.13],
  ['waistUp', AVATAR_FRAMING_DEFAULT, AVATAR_FRAMING_DEFAULT.lookAtY - 0.08],
]
const OFFSET = 0.0063 // the spread between this family's resting crowns, 6.3mm

console.log('frame     x       z      world y   projected   +6.3mm world   +6.3mm projected   difference')
for (const [name, framing, lookAtY] of FRAMES) {
  for (const x of [0, 0.06]) {
    for (const z of [-0.08, 0, 0.08]) {
      for (const y of [1.5757, 1.6647]) {
        const a = plane(framing, lookAtY, new THREE.Vector3(x, y, z))
        const b = plane(framing, lookAtY, new THREE.Vector3(x, y + OFFSET, z))
        const world = a + OFFSET
        console.log(
          `${name.padEnd(8)} ${x.toFixed(2)}  ${z.toFixed(2).padStart(5)}   ${y.toFixed(4)}   ` +
            `${a.toFixed(4)}      ${world.toFixed(4)}         ${b.toFixed(4)}          ` +
            `${((b - world) * 1000).toFixed(2)}mm`,
        )
      }
    }
  }
}
