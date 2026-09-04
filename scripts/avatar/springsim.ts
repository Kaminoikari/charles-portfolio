// Play a motion clip through three-vrm's OWN spring-bone solver in plain Node,
// and measure where the twintails actually go.
//
//     npx tsx scripts/avatar/springsim.ts [model.vrm] [--clip=dance|all]
//                                         [--colliders=asis|vroid|vroid-noarms]
//                                         [--hit=0.035] [--gravity=0.5] [--stride=2]
//
// WHY THIS EXISTS. The rest-pose gates in this directory (pierce, motion) skin
// the hair to the posed humanoid bones and leave the tail bones at bind. In the
// browser the tails are spring bones: they lag, swing, sag under gravity and
// are pushed by colliders, so where the hair is during `dance` is a property
// of the solver, not of the file. Every previous number about the tails in
// motion ("27° single-frame jumps", "smooth without colliders") was an
// eyeballed browser impression that nobody could reproduce. This runs the real
// VRMSpringBoneManager (imported through its VRM0 path, on a node tree built
// from the file's own glTF nodes) at a fixed 60 Hz, so a claim about the tails
// in motion is a number that can be re-run.
//
// What it reports, per clip:
//   coat   deepest point any twintail vertex reaches INSIDE the cardigan's outer
//          shell (signed by the shell's normal), and how much of the tail is in
//          there at the worst frame
//   body   the same against the skin and the face
//   jump   the largest angle any tail bone turns between two consecutive frames
//
// NO BROWSER, NO GPU, for the same reason as rigProbe: this machine's headless
// browser runs software WebGL at ~1 fps with dt clamped to 50 ms, which is a
// different simulation from the one visitors see.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import * as THREE from 'three'
import { VRMSpringBoneLoaderPlugin, type VRMSpringBoneManager } from '@pixiv/three-vrm'

import { buildMotion, type Motion } from '../../src/components/chat/rigProbe'

// ---- glTF ------------------------------------------------------------------

interface GltfNode {
  name?: string
  children?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
  matrix?: number[]
  mesh?: number
  skin?: number
}
interface GltfAccessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  normalized?: boolean
}
interface GltfBufferView {
  byteOffset?: number
  byteLength: number
  byteStride?: number
}
interface GltfPrimitive {
  attributes: Record<string, number>
  material: number
}
interface ColliderGroup {
  node: number
  colliders: { offset: { x: number; y: number; z: number }; radius: number }[]
}
interface BoneGroup {
  comment?: string
  bones?: number[]
  colliderGroups?: number[]
  hitRadius?: number
  gravityPower?: number
  stiffiness?: number
  dragForce?: number
  center?: number
}
interface Gltf {
  extensionsUsed?: string[]
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: GltfNode[]
  meshes: { name: string; primitives: GltfPrimitive[] }[]
  materials: { name: string }[]
  skins: { joints: number[]; inverseBindMatrices: number }[]
  accessors: GltfAccessor[]
  bufferViews: GltfBufferView[]
  extensions: {
    VRM: {
      humanoid: { humanBones: { bone: string; node: number }[] }
      secondaryAnimation: { boneGroups: BoneGroup[]; colliderGroups: ColliderGroup[] }
    }
  }
}

function parseGlb(buf: Buffer): { json: Gltf; bin: Buffer } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB')
  const total = dv.getUint32(8, true)
  let off = 12
  let json: Gltf | null = null
  let bin: Buffer | null = null
  while (off < total) {
    const len = dv.getUint32(off, true)
    const type = dv.getUint32(off + 4, true)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8')) as Gltf
    else if (type === 0x004e4942) bin = data
    off += 8 + len
  }
  if (!json || !bin) throw new Error('GLB without JSON or BIN chunk')
  return { json, bin }
}

const NCOMP: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

/** Accessor as plain numbers, de-strided, de-normalized. */
function readAccessor(json: Gltf, bin: Buffer, index: number): { data: Float64Array; ncomp: number } {
  const acc = json.accessors[index]
  const view = json.bufferViews[acc.bufferView]
  const ncomp = NCOMP[acc.type]
  const start = bin.byteOffset + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const out = new Float64Array(acc.count * ncomp)
  const ctor = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array,
  }[acc.componentType]
  if (!ctor) throw new Error(`componentType ${acc.componentType}`)
  const size = ctor.BYTES_PER_ELEMENT
  const stride = view.byteStride ?? ncomp * size
  const norm = acc.normalized
    ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[acc.componentType] ?? 1
    : 1
  for (let i = 0; i < acc.count; i++) {
    const row = new ctor(bin.buffer, start + i * stride, ncomp)
    for (let c = 0; c < ncomp; c++) out[i * ncomp + c] = row[c] / norm
  }
  return { data: out, ncomp }
}

// ---- node tree + springs -----------------------------------------------------

function buildNodes(json: Gltf): { objs: THREE.Object3D[]; scene: THREE.Group } {
  const objs = json.nodes.map((n, i) => {
    const o = new THREE.Bone()
    o.name = n.name ?? `node${i}`
    if (n.matrix) {
      new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale)
    } else {
      if (n.translation) o.position.fromArray(n.translation)
      if (n.rotation) o.quaternion.fromArray(n.rotation)
      if (n.scale) o.scale.fromArray(n.scale)
    }
    return o
  })
  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => objs[i].add(objs[c])))
  const scene = new THREE.Group()
  for (const i of json.scenes[json.scene ?? 0].nodes) scene.add(objs[i])
  scene.updateMatrixWorld(true)
  return { objs, scene }
}

/**
 * Import the springs exactly as the browser does: through the plugin's VRM0
 * path, fed a stand-in for the GLTFLoader result. Private method, reached on
 * purpose — re-implementing the import here would be one more place for the
 * VRM0 sign conventions (collider z is negated, gravity is not) to drift.
 */
async function importSprings(json: Gltf, objs: THREE.Object3D[], scene: THREE.Group): Promise<VRMSpringBoneManager> {
  const parser = {
    json,
    getDependencies: async (type: string) => {
      if (type !== 'node') throw new Error(`unexpected dependency ${type}`)
      return objs
    },
  }
  const plugin = new VRMSpringBoneLoaderPlugin(parser as never)
  const manager = await (plugin as unknown as {
    _v0Import(gltf: unknown): Promise<VRMSpringBoneManager | null>
  })._v0Import({ parser, scene })
  if (!manager) throw new Error('no VRM0 secondaryAnimation in this file')
  return manager
}

// ---- collider presets ----------------------------------------------------------

const BASELINE = path.join(path.dirname(new URL(import.meta.url).pathname), 'baseline.vrm')
const HAIR_TARGETS = [
  'J_Bip_C_Head', 'J_Bip_C_Neck', 'J_Bip_C_UpperChest', 'J_Bip_C_Spine',
  'J_Bip_L_UpperArm', 'J_Bip_L_LowerArm', 'J_Bip_L_Hand',
  'J_Bip_R_UpperArm', 'J_Bip_R_LowerArm', 'J_Bip_R_Hand',
]
const ARM_TARGETS = new Set(HAIR_TARGETS.filter((n) => /Arm|Hand/.test(n)))

function tailGroup(json: Gltf): BoneGroup {
  const g = json.extensions.VRM.secondaryAnimation.boneGroups.find((group) =>
    (group.bones ?? []).some((b) => (json.nodes[b].name ?? '').startsWith('HairTail')),
  )
  if (!g) throw new Error('no HairTail spring group')
  return g
}

/** Give the twintails the base model's hair collider set, looked up by node name. */
function restoreVroidColliders(json: Gltf, includeArms: boolean): void {
  const base = parseGlb(readFileSync(BASELINE)).json
  const nameToNode = new Map(json.nodes.map((n, i) => [n.name ?? '', i]))
  const sec = json.extensions.VRM.secondaryAnimation
  const indexOfNode = new Map(sec.colliderGroups.map((g, i) => [g.node, i]))
  const refs: number[] = []
  for (const group of base.extensions.VRM.secondaryAnimation.colliderGroups) {
    const name = base.nodes[group.node].name ?? ''
    if (!HAIR_TARGETS.includes(name)) continue
    if (!includeArms && ARM_TARGETS.has(name)) continue
    const node = nameToNode.get(name)
    if (node === undefined) throw new Error(`model has no node ${name}`)
    let idx = indexOfNode.get(node)
    if (idx === undefined) {
      idx = sec.colliderGroups.length
      sec.colliderGroups.push({ node, colliders: group.colliders })
      indexOfNode.set(node, idx)
    }
    refs.push(idx)
  }
  tailGroup(json).colliderGroups = refs
}

// ---- skinning ------------------------------------------------------------------

interface SkinSet {
  label: string
  n: number
  pos: Float64Array
  nrm: Float64Array
  joints: Float64Array
  weights: Float64Array
  skin: number
  keep: Int32Array // vertex indices that take part (outer shell / stride)
  outPos: Float64Array
  outNrm: Float64Array
}

function meshNode(json: Gltf, meshName: string): GltfNode {
  const mi = json.meshes.findIndex((m) => m.name === meshName)
  const node = json.nodes.find((n) => n.mesh === mi)
  if (!node || node.skin === undefined) throw new Error(`no skinned node for mesh ${meshName}`)
  return node
}

function gather(json: Gltf, bin: Buffer, label: string, meshName: string, prims: number[], stride = 1): SkinSet {
  const mesh = json.meshes.find((m) => m.name === meshName)
  if (!mesh) throw new Error(`no mesh ${meshName}`)
  const node = meshNode(json, meshName)
  const parts = prims.map((pi) => {
    const p = mesh.primitives[pi]
    return {
      pos: readAccessor(json, bin, p.attributes.POSITION).data,
      nrm: readAccessor(json, bin, p.attributes.NORMAL).data,
      joints: readAccessor(json, bin, p.attributes.JOINTS_0).data,
      weights: readAccessor(json, bin, p.attributes.WEIGHTS_0).data,
    }
  })
  const n = parts.reduce((s, p) => s + p.pos.length / 3, 0)
  const set: SkinSet = {
    label, n, skin: node.skin as number,
    pos: new Float64Array(n * 3), nrm: new Float64Array(n * 3),
    joints: new Float64Array(n * 4), weights: new Float64Array(n * 4),
    keep: new Int32Array(0), outPos: new Float64Array(n * 3), outNrm: new Float64Array(n * 3),
  }
  let at = 0
  for (const p of parts) {
    const k = p.pos.length / 3
    set.pos.set(p.pos, at * 3)
    set.nrm.set(p.nrm, at * 3)
    set.joints.set(p.joints, at * 4)
    set.weights.set(p.weights, at * 4)
    at += k
  }
  const keep: number[] = []
  for (let i = 0; i < n; i += stride) keep.push(i)
  set.keep = Int32Array.from(keep)
  return set
}

function primsByMaterial(json: Gltf, meshName: string, material: string): number[] {
  const mesh = json.meshes.find((m) => m.name === meshName)
  if (!mesh) throw new Error(`no mesh ${meshName}`)
  return mesh.primitives.map((p, i) => (json.materials[p.material].name === material ? i : -1)).filter((i) => i >= 0)
}

/**
 * Keep only the cardigan's OUTER shell: 13% of its vertices are the lining,
 * whose normals face the body, and a signed distance taken against a lining
 * vertex calls hair that is inside the coat "outside". Same test outfit.standoff
 * uses: the normal points away from the garment's own XZ centroid.
 */
function outerShellOnly(set: SkinSet): void {
  let cx = 0
  let cz = 0
  for (let i = 0; i < set.n; i++) {
    cx += set.pos[i * 3]
    cz += set.pos[i * 3 + 2]
  }
  cx /= set.n
  cz /= set.n
  const keep: number[] = []
  for (const i of set.keep) {
    const rx = set.pos[i * 3] - cx
    const rz = set.pos[i * 3 + 2] - cz
    if (set.nrm[i * 3] * rx + set.nrm[i * 3 + 2] * rz > 0) keep.push(i)
  }
  set.keep = Int32Array.from(keep)
}

class Skinner {
  private readonly ibm: Float64Array
  private readonly boneMats: Float64Array
  constructor(
    private readonly json: Gltf,
    bin: Buffer,
    private readonly objs: THREE.Object3D[],
    private readonly skinIndex: number,
  ) {
    const skin = json.skins[skinIndex]
    this.ibm = readAccessor(json, bin, skin.inverseBindMatrices).data
    this.boneMats = new Float64Array(skin.joints.length * 16)
  }
  /** World-space bone matrices for this frame. Call once per frame. */
  refresh(): void {
    const skin = this.json.skins[this.skinIndex]
    const m = new THREE.Matrix4()
    const ibm = new THREE.Matrix4()
    skin.joints.forEach((node, j) => {
      ibm.fromArray(this.ibm, j * 16)
      m.multiplyMatrices(this.objs[node].matrixWorld, ibm)
      this.boneMats.set(m.elements, j * 16)
    })
  }
  apply(set: SkinSet): void {
    const B = this.boneMats
    for (const i of set.keep) {
      const px = set.pos[i * 3]
      const py = set.pos[i * 3 + 1]
      const pz = set.pos[i * 3 + 2]
      const nx = set.nrm[i * 3]
      const ny = set.nrm[i * 3 + 1]
      const nz = set.nrm[i * 3 + 2]
      let ox = 0, oy = 0, oz = 0, qx = 0, qy = 0, qz = 0
      for (let k = 0; k < 4; k++) {
        const w = set.weights[i * 4 + k]
        if (w === 0) continue
        const b = set.joints[i * 4 + k] * 16
        // column-major: x' = m0 x + m4 y + m8 z + m12
        ox += w * (B[b] * px + B[b + 4] * py + B[b + 8] * pz + B[b + 12])
        oy += w * (B[b + 1] * px + B[b + 5] * py + B[b + 9] * pz + B[b + 13])
        oz += w * (B[b + 2] * px + B[b + 6] * py + B[b + 10] * pz + B[b + 14])
        qx += w * (B[b] * nx + B[b + 4] * ny + B[b + 8] * nz)
        qy += w * (B[b + 1] * nx + B[b + 5] * ny + B[b + 9] * nz)
        qz += w * (B[b + 2] * nx + B[b + 6] * ny + B[b + 10] * nz)
      }
      set.outPos[i * 3] = ox
      set.outPos[i * 3 + 1] = oy
      set.outPos[i * 3 + 2] = oz
      const l = Math.hypot(qx, qy, qz) || 1
      set.outNrm[i * 3] = qx / l
      set.outNrm[i * 3 + 1] = qy / l
      set.outNrm[i * 3 + 2] = qz / l
    }
  }
}

// ---- signed distance, hair against a shell ----------------------------------------

const CELL = 0.05
// A vertex normal only says inside/outside for points close to it: 5cm out,
// the "plane" of a collar vertex classifies hair above the coat as inside.
const REACH = 0.05

class Grid {
  private readonly cells = new Map<number, number[]>()
  constructor(private readonly set: SkinSet) {
    for (const i of set.keep) {
      const key = this.key(set.outPos[i * 3], set.outPos[i * 3 + 1], set.outPos[i * 3 + 2])
      const cell = this.cells.get(key)
      if (cell) cell.push(i)
      else this.cells.set(key, [i])
    }
  }
  private key(x: number, y: number, z: number): number {
    return (Math.floor(x / CELL) + 2048) * 4194304 + (Math.floor(y / CELL) + 2048) * 2048 + (Math.floor(z / CELL) + 1024)
  }
  /** Signed distance to the nearest shell vertex: negative = behind its normal (inside). */
  signed(x: number, y: number, z: number): number {
    const r = Math.ceil(REACH / CELL)
    const cx = Math.floor(x / CELL)
    const cy = Math.floor(y / CELL)
    const cz = Math.floor(z / CELL)
    let best = Infinity
    let bestI = -1
    const P = this.set.outPos
    for (let ix = -r; ix <= r; ix++)
      for (let iy = -r; iy <= r; iy++)
        for (let iz = -r; iz <= r; iz++) {
          const cell = this.cells.get(
            (cx + ix + 2048) * 4194304 + (cy + iy + 2048) * 2048 + (cz + iz + 1024),
          )
          if (!cell) continue
          for (const i of cell) {
            const dx = P[i * 3] - x
            const dy = P[i * 3 + 1] - y
            const dz = P[i * 3 + 2] - z
            const d = dx * dx + dy * dy + dz * dz
            if (d < best) {
              best = d
              bestI = i
            }
          }
        }
    if (bestI < 0 || best > REACH * REACH) return REACH
    const N = this.set.outNrm
    const dot =
      (x - P[bestI * 3]) * N[bestI * 3] + (y - P[bestI * 3 + 1]) * N[bestI * 3 + 1] + (z - P[bestI * 3 + 2]) * N[bestI * 3 + 2]
    return Math.sign(dot || 1) * Math.sqrt(best)
  }
}

// ---- "inside the cardigan": a cross-section test ----------------------------------
//
// The cardigan is an open shell, and a signed distance to its nearest vertex
// misreads two things that matter here: hair deep inside it (the nearest outer
// vertex is far, so its normal means nothing) and hair above its collar. What
// a viewer calls "inside the coat" is the hair being inside the coat's
// silhouette around the torso, so that is what is measured: in the spine
// bone's frame, bin the coat's outer shell by height and azimuth, take the
// outermost radius per bin, and a hair vertex is inside by however much its own
// radius falls short of that. Sleeves are dropped from the shell (their
// dominant weight is on an arm bone) because a sleeve sweeping past a tail
// would otherwise swallow it.

const BAND = 0.02
const SECTOR = (10 * Math.PI) / 180
const FRONT_LIMIT = (-10 * Math.PI) / 180 // azimuth from straight-out-to-the-side, +z is her back

class RadialShell {
  private readonly bins = new Map<number, number>()
  private readonly counts = new Map<number, number>()
  readonly argmax = new Map<number, number>()
  private readonly inv = new THREE.Matrix4()
  private readonly v = new THREE.Vector3()
  constructor(set: SkinSet, private readonly frame: THREE.Object3D) {
    this.inv.copy(frame.matrixWorld).invert()
    for (const i of set.keep) {
      const { key, radius } = this.locate(set.outPos[i * 3], set.outPos[i * 3 + 1], set.outPos[i * 3 + 2])
      this.counts.set(key, (this.counts.get(key) ?? 0) + 1)
      if (radius > (this.bins.get(key) ?? -Infinity)) {
        this.bins.set(key, radius)
        this.argmax.set(key, i)
      }
    }
  }
  private locate(x: number, y: number, z: number): { key: number; radius: number } {
    this.v.set(x, y, z).applyMatrix4(this.inv)
    const band = Math.floor(this.v.y / BAND)
    const sector = Math.floor(Math.atan2(this.v.z, this.v.x) / SECTOR)
    return { key: (band + 512) * 1024 + (sector + 512), radius: Math.hypot(this.v.x, this.v.z) }
  }
  /**
   * Metres by which the point sits inside the shell's outermost radius; ≤ 0 is
   * outside. Only behind and beside her: the cardigan is open at the front, so
   * "inside its silhouette" between the two front panels is hair lying on the
   * dress in plain view, not hair under cloth.
   */
  depth(x: number, y: number, z: number): number {
    const { key, radius } = this.locate(x, y, z)
    if ((this.counts.get(key) ?? 0) < 3) return 0
    if (Math.atan2(this.v.z, Math.abs(this.v.x)) < FRONT_LIMIT) return 0
    return (this.bins.get(key) as number) - radius
  }
  keyOf(x: number, y: number, z: number): number {
    return this.locate(x, y, z).key
  }
  /** Spine-frame reading of a world point, for diagnostics. */
  describe(x: number, y: number, z: number): string {
    this.v.set(x, y, z).applyMatrix4(this.inv)
    const phi = (Math.atan2(this.v.z, Math.abs(this.v.x)) * 180) / Math.PI
    return `local y ${this.v.y.toFixed(3)} r ${Math.hypot(this.v.x, this.v.z).toFixed(3)} φ ${phi.toFixed(0)}°`
  }
}

function dropSleeves(json: Gltf, set: SkinSet): void {
  const skin = json.skins[set.skin]
  const keep: number[] = []
  for (const i of set.keep) {
    let best = -1
    let bestW = -1
    for (let k = 0; k < 4; k++) {
      if (set.weights[i * 4 + k] > bestW) {
        bestW = set.weights[i * 4 + k]
        best = set.joints[i * 4 + k]
      }
    }
    const name = json.nodes[skin.joints[best]].name ?? ''
    // The vendor's sleeve weights are coarse (upper-sleeve vertices ride on the
    // chest bone), so the T-pose geometry decides too: torso panels end at
    // |x| ≈ 0.30 (see outfit.standoff), sleeves live beyond it.
    if (!/Arm|Hand|Shoulder/.test(name) && Math.abs(set.pos[i * 3]) <= 0.3) keep.push(i)
  }
  set.keep = Int32Array.from(keep)
}

// ---- motion ------------------------------------------------------------------------

function sampleQuat(track: { times: Float32Array; values: Float32Array }, t: number, out: THREE.Quaternion): void {
  const times = track.times
  if (t <= times[0]) {
    out.fromArray(track.values, 0)
    return
  }
  const last = times.length - 1
  if (t >= times[last]) {
    out.fromArray(track.values, last * 4)
    return
  }
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (times[mid] <= t) lo = mid
    else hi = mid
  }
  const f = (t - times[lo]) / (times[hi] - times[lo])
  out.fromArray(track.values, lo * 4)
  _qb.fromArray(track.values, hi * 4)
  out.slerp(_qb, f)
}
const _qb = new THREE.Quaternion()

class Poser {
  private readonly human = new Map<string, THREE.Object3D>()
  private readonly hipsRest = new THREE.Vector3()
  constructor(json: Gltf, private readonly objs: THREE.Object3D[]) {
    for (const { bone, node } of json.extensions.VRM.humanoid.humanBones) this.human.set(bone, objs[node])
    const hips = this.human.get('hips')
    if (!hips) throw new Error('no hips')
    this.hipsRest.copy(hips.position)
  }
  /** Bind pose: every humanoid bone at identity, hips at its rest translation. */
  rest(): void {
    for (const o of this.human.values()) o.quaternion.identity()
    ;(this.human.get('hips') as THREE.Object3D).position.copy(this.hipsRest)
  }
  /** Same retarget as rigProbe.applyMotion, written onto the raw nodes (which rest at identity here). */
  pose(motion: Motion, t: number): void {
    this.rest()
    const hips = this.human.get('hips') as THREE.Object3D
    const q = new THREE.Quaternion()
    for (const [bone, track] of Object.entries(motion.rotation)) {
      const o = this.human.get(bone)
      if (!o) continue
      sampleQuat(track, t, q)
      o.quaternion.set(-q.x, q.y, -q.z, q.w)
    }
    if (motion.hipsTranslation) {
      const tr = motion.hipsTranslation
      const times = tr.times
      let lo = 0
      while (lo < times.length - 2 && times[lo + 1] <= t) lo++
      const hi = Math.min(lo + 1, times.length - 1)
      const f = times[hi] > times[lo] ? Math.min(1, Math.max(0, (t - times[lo]) / (times[hi] - times[lo]))) : 0
      const at = (k: number): number => tr.values[lo * 3 + k] + (tr.values[hi * 3 + k] - tr.values[lo * 3 + k]) * f
      const scale = motion.restHipsY > 0 ? this.hipsRest.y / motion.restHipsY : 1
      hips.position.set(-at(0) * scale, at(1) * scale, -at(2) * scale)
    }
  }
  yawDeg(): number {
    const hips = this.human.get('hips') as THREE.Object3D
    const f = new THREE.Vector3(0, 0, -1).transformDirection(hips.matrixWorld)
    return (Math.atan2(f.x, -f.z) * 180) / Math.PI
  }
}

// ---- the run -------------------------------------------------------------------------

export interface Report {
  clip: string
  coatDepthMm: number
  coatAtWorst: number // share of tail vertices ≥5mm inside at the worst frame
  coatWorstT: number
  coatWorstYaw: number
  coatWorstWhere: string
  /** Same, counting only hair above the coat's hem band (world y ≥ 0.92). */
  coatUpperDepthMm: number
  bodyDepthMm: number
  bodyWorstT: number
  jumpDeg: number
  jumpT: number
  jumpBone: string
  restCoatDepthMm: number
}

export interface Args {
  model: string
  clip: string
  colliders: 'asis' | 'vroid' | 'vroid-noarms'
  hit: number | null
  gravity: number | null
  stride: number
  /** Drop the arm/hand collider groups from the tails' list (what-if). */
  noArms: boolean
  /** Drop the coat bead groups from the tails' list (what-if). */
  noCoat: boolean
  /** Clip time at which to print every tail joint against its colliders. */
  dumpAt: number | null
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    model: path.resolve('public/avatar/mika-milfy-3.vrm'),
    clip: 'dance',
    colliders: 'asis',
    hit: null,
    gravity: null,
    stride: 2,
    noArms: false,
    noCoat: false,
    dumpAt: null,
  }
  for (const a of argv) {
    if (a.startsWith('--clip=')) args.clip = a.slice(7)
    else if (a.startsWith('--colliders=')) args.colliders = a.slice(12) as Args['colliders']
    else if (a.startsWith('--hit=')) args.hit = Number(a.slice(6))
    else if (a.startsWith('--gravity=')) args.gravity = Number(a.slice(10))
    else if (a.startsWith('--stride=')) args.stride = Number(a.slice(9))
    else if (a === '--no-arms') args.noArms = true
    else if (a === '--no-coat') args.noCoat = true
    else if (a.startsWith('--dump-at=')) args.dumpAt = Number(a.slice(10))
    else if (!a.startsWith('--')) args.model = path.resolve(a)
  }
  return args
}

const FPS = 60
const PREROLL_S = 2
const HOLD_S = 1
const INSIDE_MM = 5

export async function runClip(args: Args, clipPath: string): Promise<Report> {
  const raw = readFileSync(args.model)
  const { json, bin } = parseGlb(raw)
  // Fresh tree per clip: the solver keeps state on the nodes.
  if (args.colliders !== 'asis') restoreVroidColliders(json, args.colliders === 'vroid')
  const group = tailGroup(json)
  if (args.hit !== null) group.hitRadius = args.hit
  if (args.gravity !== null) group.gravityPower = args.gravity
  if (args.noArms || args.noCoat) {
    const groups = json.extensions.VRM.secondaryAnimation.colliderGroups
    group.colliderGroups = (group.colliderGroups ?? []).filter((gi) => {
      const name = json.nodes[groups[gi].node].name ?? ''
      if (args.noArms && /Arm|Hand/.test(name)) return false
      // Beads: many spheres on a torso bone. The VRoid spine group has one.
      if (args.noCoat && /C_(Chest|Spine|Hips)$/.test(name) && groups[gi].colliders.length > 1) return false
      return true
    })
  }

  if (process.env.SPRINGSIM_DEBUG) {
    const groups = json.extensions.VRM.secondaryAnimation.colliderGroups
    console.log(`  tail colliders: ${(group.colliderGroups ?? []).map((gi) => `${json.nodes[groups[gi].node].name}×${groups[gi].colliders.length}`).join(' ')}`)
  }
  const { objs, scene } = buildNodes(json)
  const manager = await importSprings(json, objs, scene)
  const poser = new Poser(json, objs)
  const motion = buildMotion(new Uint8Array(readFileSync(clipPath)))

  const manifest = JSON.parse(readFileSync(args.model.replace(/\.vrm$/, '.parts.json'), 'utf8')) as {
    parts: Record<string, { mesh: string; primitives: number[] }>
  }
  const hair = (['Hair_Twintail_L', 'Hair_Twintail_R'] as const).map((part) => {
    const p = manifest.parts[part]
    return gather(json, bin, part, p.mesh, p.primitives, args.stride)
  })
  const coat = gather(json, bin, 'coat', 'Body.baked', primsByMaterial(json, 'Body.baked', 'Mellow_Outer'))
  outerShellOnly(coat)
  dropSleeves(json, coat)
  const spineNode = json.extensions.VRM.humanoid.humanBones.find((b) => b.bone === 'spine')
  if (!spineNode) throw new Error('no spine')
  const spine = objs[spineNode.node]
  const body = gather(json, bin, 'body', 'Body.baked', primsByMaterial(json, 'Body.baked', 'F00_000_00_Body_00_SKIN'))
  const face = gather(json, bin, 'face', 'Face.baked', primsByMaterial(json, 'Face.baked', 'F00_000_00_Face_00_SKIN'))
  const sets = [...hair, coat, body, face]
  const skinners = new Map<number, Skinner>()
  for (const s of sets) if (!skinners.has(s.skin)) skinners.set(s.skin, new Skinner(json, bin, objs, s.skin))

  const tailBones = objs.filter((o) => /^HairTail[LR]_\d$/.test(o.name) && o.children.length > 0)
  const prevDir = tailBones.map(() => new THREE.Vector3())
  const dir = new THREE.Vector3()
  const childPos = new THREE.Vector3()
  const bonePos = new THREE.Vector3()

  const report: Report = {
    clip: path.basename(clipPath, '.vrma'),
    coatDepthMm: -Infinity, coatAtWorst: 0, coatWorstT: 0, coatWorstYaw: 0, coatWorstWhere: '', coatUpperDepthMm: -Infinity,
    bodyDepthMm: -Infinity, bodyWorstT: 0,
    jumpDeg: 0, jumpT: 0, jumpBone: '',
    restCoatDepthMm: -Infinity,
  }

  if (process.env.SPRINGSIM_DEBUG) {
    // Bind-pose identity: skinning at rest must reproduce POSITION exactly.
    poser.rest()
    scene.updateMatrixWorld(true)
    for (const s of skinners.values()) s.refresh()
    for (const s of sets) {
      skinners.get(s.skin)?.apply(s)
      let worst = 0
      for (const i of s.keep) {
        const d = Math.hypot(s.outPos[i * 3] - s.pos[i * 3], s.outPos[i * 3 + 1] - s.pos[i * 3 + 1], s.outPos[i * 3 + 2] - s.pos[i * 3 + 2])
        if (d > worst) worst = d
      }
      console.log(`  bind check ${s.label}: skin ${s.skin}, ${s.keep.length} verts, max |skinned - rest| ${(worst * 1000).toFixed(2)}mm`)
    }
  }

  const dt = 1 / FPS
  const total = Math.round((PREROLL_S + motion.duration + HOLD_S) * FPS)
  for (let frame = 0; frame <= total; frame++) {
    const wall = frame * dt
    const t = Math.min(motion.duration, Math.max(0, wall - PREROLL_S))
    poser.pose(motion, t)
    scene.updateMatrixWorld(true)
    manager.update(dt)
    scene.updateMatrixWorld(true)

    // joint jumps, every frame, after the pre-roll has settled
    tailBones.forEach((b, i) => {
      b.getWorldPosition(bonePos)
      b.children[0].getWorldPosition(childPos)
      dir.subVectors(childPos, bonePos).normalize()
      if (frame > 0 && wall > PREROLL_S * 0.5) {
        const deg = (Math.acos(Math.min(1, Math.max(-1, dir.dot(prevDir[i])))) * 180) / Math.PI
        if (deg > report.jumpDeg) {
          report.jumpDeg = deg
          report.jumpT = wall - PREROLL_S
          report.jumpBone = b.name
        }
      }
      prevDir[i].copy(dir)
    })

    if (args.dumpAt !== null && wall >= PREROLL_S && Math.abs(t - args.dumpAt) < dt * 0.5) {
      // Where every tail joint is, and how far it sits from the nearest collider
      // it is asked to avoid (negative = inside the keep-out).
      const groups = json.extensions.VRM.secondaryAnimation.colliderGroups
      const spheres: { name: string; c: THREE.Vector3; r: number }[] = []
      for (const gi of group.colliderGroups ?? []) {
        const g = groups[gi]
        for (const col of g.colliders) {
          const c = new THREE.Vector3(col.offset.x, col.offset.y, -col.offset.z).applyMatrix4(objs[g.node].matrixWorld)
          spheres.push({ name: json.nodes[g.node].name ?? '', c, r: col.radius })
        }
      }
      const shell = new RadialShell(coat, spine) // coat was skinned on the last even frame; close enough for a reading
      console.log(`  dump at t=${t.toFixed(2)}s (yaw ${poser.yawDeg().toFixed(0)}°):`)
      for (const b of objs.filter((o) => /^HairTail[LR]_\d$/.test(o.name))) {
        b.getWorldPosition(bonePos)
        let best = { gap: Infinity, name: '' }
        for (const sp of spheres) {
          const gap = bonePos.distanceTo(sp.c) - (sp.r + (group.hitRadius ?? 0))
          if (gap < best.gap) best = { gap, name: sp.name }
        }
        console.log(`    ${b.name.padEnd(11)} [${shell.describe(bonePos.x, bonePos.y, bonePos.z)}] nearest keep-out ${(best.gap * 1000).toFixed(0).padStart(5)}mm (${best.name})`)
      }
      // The innermost hair vertex near the spine's height, and what it is skinned to.
      const inv = new THREE.Matrix4().copy(spine.matrixWorld).invert()
      const skinJoints = json.skins[hair[0].skin].joints
      for (const h of hair) {
        let worst = { r: Infinity, i: -1 }
        const v = new THREE.Vector3()
        for (const i of h.keep) {
          v.set(h.outPos[i * 3], h.outPos[i * 3 + 1], h.outPos[i * 3 + 2]).applyMatrix4(inv)
          if (Math.abs(v.y) > 0.03) continue
          const r = Math.hypot(v.x, v.z)
          if (r < worst.r) worst = { r, i }
        }
        if (worst.i < 0) continue
        const i = worst.i
        const bound = [0, 1, 2, 3]
          .filter((k) => h.weights[i * 4 + k] > 0)
          .map((k) => `${json.nodes[skinJoints[h.joints[i * 4 + k]]].name}:${h.weights[i * 4 + k].toFixed(2)}`)
        console.log(`    ${h.label} innermost vertex within ±3cm of spine height: r ${worst.r.toFixed(3)} rest (${h.pos[i * 3].toFixed(3)}, ${h.pos[i * 3 + 1].toFixed(3)}, ${h.pos[i * 3 + 2].toFixed(3)}) bound to ${bound.join(' ')}`)
      }
    }

    // penetration, every other frame (skinning is the cost)
    if (frame % 2 !== 0) continue
    for (const s of skinners.values()) s.refresh()
    for (const s of sets) skinners.get(s.skin)?.apply(s)
    const coatShell = new RadialShell(coat, spine)
    const bodyGrid = new Grid(body)
    const faceGrid = new Grid(face)
    let coatDepth = -Infinity
    let coatUpper = -Infinity
    let bodyDepth = -Infinity
    let inside = 0
    let counted = 0
    let where = ''
    for (const h of hair) {
      for (const i of h.keep) {
        const x = h.outPos[i * 3]
        const y = h.outPos[i * 3 + 1]
        const z = h.outPos[i * 3 + 2]
        const c = coatShell.depth(x, y, z) * 1000
        counted++
        if (y >= 0.92 && c > coatUpper) coatUpper = c
        if (c > coatDepth) {
          coatDepth = c
          const ci = coatShell.argmax.get(coatShell.keyOf(x, y, z))
          where = `${h.label.slice(-1)} hair (${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}) [${coatShell.describe(x, y, z)}]` +
            (ci === undefined ? '' : ` coat (${coat.outPos[ci * 3].toFixed(2)},${coat.outPos[ci * 3 + 1].toFixed(2)},${coat.outPos[ci * 3 + 2].toFixed(2)}) [${coatShell.describe(coat.outPos[ci * 3], coat.outPos[ci * 3 + 1], coat.outPos[ci * 3 + 2])}] rest (${coat.pos[ci * 3].toFixed(2)},${coat.pos[ci * 3 + 1].toFixed(2)},${coat.pos[ci * 3 + 2].toFixed(2)})`)
        }
        if (c >= INSIDE_MM) inside++
        const b = Math.max(-bodyGrid.signed(x, y, z), -faceGrid.signed(x, y, z)) * 1000
        if (b > bodyDepth) bodyDepth = b
      }
    }
    if (wall < PREROLL_S) {
      if (Math.abs(wall - (PREROLL_S - dt * 2)) < dt) {
        report.restCoatDepthMm = coatDepth
        if (process.env.SPRINGSIM_DEBUG) {
          const p = new THREE.Vector3()
          console.log(`  pre-roll end: hips yaw ${poser.yawDeg().toFixed(0)}°`)
          for (const o of objs) {
            if (!/^(HairTailR_\d|J_Bip_C_Head|J_Bip_C_Hips)$/.test(o.name)) continue
            o.getWorldPosition(p)
            console.log(`    ${o.name.padEnd(14)} (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`)
          }
          for (const h of hair) {
            let worst = -Infinity
            let wi = -1
            for (const i of h.keep) {
              const d = coatShell.depth(h.outPos[i * 3], h.outPos[i * 3 + 1], h.outPos[i * 3 + 2])
              if (d > worst) {
                worst = d
                wi = i
              }
            }
            const hx = h.outPos[wi * 3], hy = h.outPos[wi * 3 + 1], hz = h.outPos[wi * 3 + 2]
            const key = coatShell.keyOf(hx, hy, hz)
            const ci = coatShell.argmax.get(key)
            console.log(`  rest ${h.label}: worst hair vertex (${hx.toFixed(3)}, ${hy.toFixed(3)}, ${hz.toFixed(3)}) depth ${(worst * 1000).toFixed(0)}mm` +
              (ci === undefined ? '' : ` vs coat vertex (${coat.outPos[ci * 3].toFixed(3)}, ${coat.outPos[ci * 3 + 1].toFixed(3)}, ${coat.outPos[ci * 3 + 2].toFixed(3)})`))
          }
        }
      }
      continue
    }
    if (coatDepth > report.coatDepthMm) {
      report.coatDepthMm = coatDepth
      report.coatAtWorst = inside / counted
      report.coatWorstT = t
      report.coatWorstYaw = poser.yawDeg()
      report.coatWorstWhere = where
    }
    if (coatUpper > report.coatUpperDepthMm) report.coatUpperDepthMm = coatUpper
    if (bodyDepth > report.bodyDepthMm) {
      report.bodyDepthMm = bodyDepth
      report.bodyWorstT = t
    }
  }
  return report
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const dir = path.resolve('public/avatar/animations')
  const clips =
    args.clip === 'all'
      ? readdirSync(dir).filter((f) => f.endsWith('.vrma')).map((f) => path.join(dir, f))
      : [path.join(dir, `${args.clip}.vrma`)]
  console.log(`model ${path.relative(process.cwd(), args.model)}  colliders=${args.colliders}` +
    (args.hit !== null ? ` hit=${args.hit}` : '') + (args.gravity !== null ? ` gravity=${args.gravity}` : '') +
    `  ${FPS} Hz, pre-roll ${PREROLL_S}s, hair stride ${args.stride}`)
  console.log('clip          rest→coat  coat max  above-hem  share≥5mm   @t     yaw    body max  @t     jump    @t    bone')
  for (const clip of clips) {
    const r = await runClip(args, clip)
    console.log(
      `${r.clip.padEnd(12)}  ${r.restCoatDepthMm.toFixed(0).padStart(6)}mm ` +
      `${r.coatDepthMm.toFixed(0).padStart(7)}mm ${r.coatUpperDepthMm.toFixed(0).padStart(7)}mm  ${(r.coatAtWorst * 100).toFixed(0).padStart(7)}%  ` +
      `${r.coatWorstT.toFixed(2).padStart(5)}s ${r.coatWorstYaw.toFixed(0).padStart(5)}°  ` +
      `${r.bodyDepthMm.toFixed(0).padStart(6)}mm  ${r.bodyWorstT.toFixed(2).padStart(5)}s  ` +
      `${r.jumpDeg.toFixed(1).padStart(5)}°  ${r.jumpT.toFixed(2).padStart(5)}s  ${r.jumpBone}`,
    )
    if (process.env.SPRINGSIM_DEBUG) console.log(`    worst coat frame: ${r.coatWorstWhere}`)
  }
}

// CLI only when run directly (npx tsx …/springsim.ts); importable from the test.
if (/springsim\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
