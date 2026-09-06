// Phase 6a design probe: can three-vrm's VRMHumanoid be built in plain Node on
// a THREE.Bone tree read straight out of the glTF JSON, and does writing a
// normalized rotation + humanoid.update() land the raw node at the same world
// transform? Three bodies: the shipped VRM0, its VRM1 twin (root turned π),
// and a VRM0 whose left upper arm rests on a 15° roll (non-identity rest).
//
//     npx tsx scripts/avatar/evidence/retarget-0906-probe-humanoid.ts
import { readFileSync } from 'node:fs'

import * as THREE from 'three'
import { VRMHumanoid, type VRMHumanBones } from '@pixiv/three-vrm'

import { parseGlb, readHumanoid, type GltfJson } from '../../../src/components/chat/vrmHumanoid'

const THUMB: Record<string, string> = {
  ThumbProximal: 'ThumbMetacarpal',
  ThumbIntermediate: 'ThumbProximal',
}
const vrm1Name = (bone: string): string => {
  for (const [v0, v1] of Object.entries(THUMB)) if (bone.endsWith(v0)) return bone.slice(0, -v0.length) + v1
  return bone
}

function build(json: GltfJson): { raw: THREE.Object3D[]; scene: THREE.Group; humanoid: VRMHumanoid } {
  const raw = json.nodes.map((n, i) => {
    const o = new THREE.Bone()
    o.name = n.name ?? `node${i}`
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale)
    else {
      if (n.translation) o.position.fromArray(n.translation)
      if (n.rotation) o.quaternion.fromArray(n.rotation)
      if (n.scale) o.scale.fromArray(n.scale)
    }
    return o
  })
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => raw[i].add(raw[c])))
  const scene = new THREE.Group()
  for (const i of (json.scenes ?? [{ nodes: [] }])[json.scene ?? 0].nodes) scene.add(raw[i])
  scene.updateMatrixWorld(true)
  const h = readHumanoid(json)
  const humanBones: Record<string, { node: THREE.Object3D }> = {}
  for (const [bone, node] of Object.entries(h.bones)) humanBones[h.version === '0' ? vrm1Name(bone) : bone] = { node: raw[node] }
  const humanoid = new VRMHumanoid(humanBones as unknown as VRMHumanBones)
  scene.add(humanoid.normalizedHumanBonesRoot)
  return { raw, scene, humanoid }
}

function compare(label: string, json: GltfJson): void {
  const { scene, humanoid } = build(json)
  // A pose that bends most of the chain: spine, both arms, head, a finger.
  const set = (bone: string, axis: THREE.Vector3, deg: number) => {
    const n = humanoid.getNormalizedBoneNode(bone as never)
    if (!n) throw new Error(`no ${bone}`)
    n.quaternion.setFromAxisAngle(axis, (deg * Math.PI) / 180)
  }
  set('spine', new THREE.Vector3(1, 0, 0), 20)
  set('leftUpperArm', new THREE.Vector3(0, 0, 1), 60)
  set('leftLowerArm', new THREE.Vector3(0, 1, 0), -70)
  set('rightUpperArm', new THREE.Vector3(0, 0, 1), -40)
  set('head', new THREE.Vector3(0, 1, 0), 35)
  set('leftIndexProximal', new THREE.Vector3(0, 0, 1), 50)
  set('leftThumbMetacarpal', new THREE.Vector3(0, 1, 0), 30)
  humanoid.getNormalizedBoneNode('hips')!.position.y += 0.05
  humanoid.normalizedHumanBonesRoot.updateMatrixWorld(true)
  humanoid.update()
  scene.updateMatrixWorld(true)
  let worstPos = 0
  let worstDeg = 0
  let worstBone = ''
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion()
  for (const bone of Object.keys(humanoid.humanBones)) {
    const rawNode = humanoid.getRawBoneNode(bone as never)!
    const normNode = humanoid.getNormalizedBoneNode(bone as never)!
    rawNode.getWorldPosition(pa)
    normNode.getWorldPosition(pb)
    const d = pa.distanceTo(pb)
    if (d > worstPos) worstPos = d
    // world rotations differ by the raw rest world rotation: delta = raw_world · rest_world⁻¹ must equal normalized world.
    rawNode.getWorldQuaternion(qa)
    normNode.getWorldQuaternion(qb)
    const restWorld = restWorldQuat.get(bone)!
    qa.multiply(restWorld.clone().invert())
    const deg = (2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb)))) * 180) / Math.PI
    if (deg > worstDeg) {
      worstDeg = deg
      worstBone = bone
    }
  }
  console.log(`${label.padEnd(22)} bones ${Object.keys(humanoid.humanBones).length}  max |raw - normalized| world position ${(worstPos * 1000).toFixed(4)}mm, world rotation delta ${worstDeg.toFixed(5)}° (${worstBone})`)
}

const restWorldQuat = new Map<string, THREE.Quaternion>()
function withRest(json: GltfJson, fn: () => void): void {
  const { humanoid } = build(json)
  restWorldQuat.clear()
  for (const bone of Object.keys(humanoid.humanBones)) {
    restWorldQuat.set(bone, humanoid.getRawBoneNode(bone as never)!.getWorldQuaternion(new THREE.Quaternion()))
  }
  fn()
}

const file = process.argv[2] ?? 'public/avatar/AvatarSample_B_webp.vrm'
const base = parseGlb(new Uint8Array(readFileSync(file))).json
const clone = (): GltfJson => JSON.parse(JSON.stringify(base)) as GltfJson

withRest(base, () => compare('shipped VRM0', clone()))

const twin = clone()
twin.nodes.push({ name: 'vrm1-root', rotation: [0, 1, 0, 0], children: [...twin.scenes![0].nodes] })
twin.scenes![0].nodes = [twin.nodes.length - 1]
withRest(twin, () => compare('VRM1 twin (root π)', twin))

const tilted = clone()
const h = readHumanoid(tilted)
const arm = tilted.nodes[h.bones.leftUpperArm]
arm.rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (15 * Math.PI) / 180).toArray() as [number, number, number, number]
withRest(tilted, () => compare('VRM0, arm rest 15°', tilted))
