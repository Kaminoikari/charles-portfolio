// Per-frame crown, hips and head height of the dance through springsim's own
// loop, to put beside the browser's per-frame reading (clearance-0906.md).
//     npx tsx scripts/avatar/evidence/clearance-0906-probe-crown.ts
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { VRMSpringBoneLoaderPlugin, type VRMSpringBoneManager } from '@pixiv/three-vrm'
import { applyMotion, buildMotion, buildRigFrom, resetRig } from '../../../src/components/chat/rigProbe'
import { parseGlb, readAccessorRows, readHumanoid, type GltfJson } from '../../../src/components/chat/vrmHumanoid'

type Gltf = GltfJson & { meshes: { name?: string; primitives: { attributes: Record<string, number> }[] }[]; skins: { joints: number[]; inverseBindMatrices: number }[] }
const model = path.resolve('public/avatar/mika-milfy-12.vrm')
const { json, bin } = parseGlb<Gltf>(readFileSync(model))
if (!bin) throw new Error('no bin')
const manifest = JSON.parse(readFileSync(model.replace(/\.vrm$/, '.parts.json'), 'utf8')) as { parts: Record<string, { mesh: string; primitives: number[] }> }
const rig = buildRigFrom({ json, bin })
const parser = { json, getDependencies: async () => rig.raw, getDependency: async (_t: string, i: number) => rig.raw[i] }
const gltf = { parser, scene: rig.scene, userData: {} as { vrmSpringBoneManager?: VRMSpringBoneManager | null } }
await new VRMSpringBoneLoaderPlugin(parser as never).afterRoot(gltf as never)
const manager = gltf.userData.vrmSpringBoneManager as VRMSpringBoneManager
const motion = buildMotion(new Uint8Array(readFileSync('public/avatar/animations/dance.vrma')))
const bones = readHumanoid(json).bones

// every vertex of every part, skinned on demand
const sets = Object.values(manifest.parts).filter((p) => p.primitives.length).map((p) => {
  const mesh = json.meshes.find((m) => m.name === p.mesh)!
  const node = json.nodes.find((n) => n.mesh === json.meshes.indexOf(mesh))!
  const skin = json.skins[node.skin as number]
  const ibm = readAccessorRows({ json, bin }, skin.inverseBindMatrices).data
  const prims = p.primitives.map((i) => ({
    pos: readAccessorRows({ json, bin }, mesh.primitives[i].attributes.POSITION).data,
    jo: readAccessorRows({ json, bin }, mesh.primitives[i].attributes.JOINTS_0).data,
    we: readAccessorRows({ json, bin }, mesh.primitives[i].attributes.WEIGHTS_0).data,
  }))
  return { label: p.mesh, skin, ibm, prims }
})
const m = new THREE.Matrix4(), b = new THREE.Matrix4(), v = new THREE.Vector3(), acc = new THREE.Vector3()
function top(): { y: number; part: string } {
  let best = { y: -Infinity, part: '' }
  for (const s of sets) {
    const mats = s.skin.joints.map((node, j) => m.clone().multiplyMatrices(rig.raw[node].matrixWorld, b.fromArray(s.ibm, j * 16)))
    for (const p of s.prims) {
      for (let i = 0; i < p.pos.length / 3; i++) {
        acc.set(0, 0, 0)
        for (let k = 0; k < 4; k++) {
          const w = p.we[i * 4 + k]
          if (!w) continue
          v.set(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]).applyMatrix4(mats[p.jo[i * 4 + k]])
          acc.addScaledVector(v, w)
        }
        if (acc.y > best.y) best = { y: acc.y, part: s.label }
      }
    }
  }
  return best
}
resetRig(rig)
console.log('rest crown', top().y.toFixed(4))
const dt = 1 / 60
const p = new THREE.Vector3()
let next = 10
for (let f = 0; f <= Math.round((2 + motion.duration + 1) * 60); f++) {
  const wall = f * dt
  const t = Math.min(motion.duration, Math.max(0, wall - 2))
  applyMotion(rig, motion, t)
  manager.update(dt)
  rig.scene.updateMatrixWorld(true)
  if (wall >= 2 && t >= next && t <= 13.5) {
    const hips = rig.raw[bones.hips].getWorldPosition(p).y
    const head = rig.raw[bones.head as number].getWorldPosition(new THREE.Vector3()).y
    const c = top()
    console.log(`t=${t.toFixed(2)} hips ${hips.toFixed(4)} head ${head.toFixed(4)} crown ${c.y.toFixed(4)} (${c.part})`)
    next += 0.25
  }
}
