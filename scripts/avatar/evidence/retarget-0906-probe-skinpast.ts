// The plan's own derivation of SKIN_ABOVE_JOINT: for each side, the largest
// distance any Body vertex mostly skinned to a distal or hand bone reaches
// PAST the synthetic fingertip along the finger's axis, at bind pose. The
// receipt says this reads 0.7mm, not the 12mm the screenshot gave; this is
// the log for that number.
//
//     npx tsx scripts/avatar/evidence/retarget-0906-probe-skinpast.ts
import { readFileSync } from 'node:fs'

import * as THREE from 'three'

import { buildRigFrom, deriveFingerSkinRadius } from '../../../src/components/chat/rigProbe'
import { parseGlb, readAccessorRows } from '../../../src/components/chat/vrmHumanoid'

const glb = parseGlb(new Uint8Array(readFileSync('public/avatar/AvatarSample_B_webp.vrm')))
const rig = buildRigFrom(glb)
const json = glb.json

const boneOfNode = new Map<number, string>()
for (const name of Object.keys(rig.bones)) {
  if (name.endsWith('Tip')) continue
  const node = rig.humanoid.getRawBoneNode(name as never)
  if (node) boneOfNode.set(rig.raw.indexOf(node), name)
}

let worst = { past: -Infinity, bone: '' }
for (const [index, node] of json.nodes.entries()) {
  if (node.mesh === undefined || node.skin === undefined) continue
  const mesh = json.meshes![node.mesh]
  if (!/^Body/.test(mesh.name ?? '')) continue
  const joints = json.skins![node.skin].joints
  const toWorld = rig.raw[index].matrixWorld
  for (const prim of mesh.primitives) {
    const pos = readAccessorRows(glb, prim.attributes.POSITION)
    const jo = readAccessorRows(glb, prim.attributes.JOINTS_0)
    const we = readAccessorRows(glb, prim.attributes.WEIGHTS_0)
    const count = pos.data.length / 3
    for (let v = 0; v < count; v++) {
      let best = 0
      for (let k = 1; k < 4; k++) if (we.data[v * 4 + k] > we.data[v * 4 + best]) best = k
      const bone = boneOfNode.get(joints[jo.data[v * 4 + best]])
      if (!bone || !/Distal$/.test(bone)) continue
      const tipName = `${bone.slice(0, -'Distal'.length)}Tip`
      const distal = rig.restPosition[bone]
      const tip = rig.restPosition[tipName]
      if (!tip) continue
      const axis = new THREE.Vector3().subVectors(tip, distal).normalize()
      const p = new THREE.Vector3(pos.data[v * 3], pos.data[v * 3 + 1], pos.data[v * 3 + 2]).applyMatrix4(toWorld)
      const past = new THREE.Vector3().subVectors(p, tip).dot(axis)
      if (past > worst.past) worst = { past, bone }
    }
  }
}
console.log(`skin past the fingertip along the finger axis (distal-dominant Body vertices): ${(worst.past * 1000).toFixed(2)}mm (${worst.bone})`)
console.log(`finger skin radius (outer phalanges, deriveFingerSkinRadius): ${(deriveFingerSkinRadius(glb, rig) * 1000).toFixed(2)}mm`)
