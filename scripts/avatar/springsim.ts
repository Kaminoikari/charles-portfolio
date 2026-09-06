// Play a motion clip through three-vrm's OWN spring-bone solver in plain Node,
// and measure where the hair, the coat and the skirt actually go.
//
//     npx tsx scripts/avatar/springsim.ts [model.vrm] [--clip=dance|all]
//                                         [--colliders=asis|vroid|vroid-noarms --vroid-colliders=base.vrm]
//                                         [--hit=0.035] [--gravity=0.5] [--stride=2]
//                                         [--clearance=src/components/chat/clearance/<family>.simulated.gen.ts --family=<family>]
//
// WHY THIS EXISTS. The rest-pose gates in this directory (pierce, motion) skin
// the hair to the posed humanoid bones and leave the spring bones at bind. In
// the browser the tails are spring bones: they lag, swing, sag under gravity
// and are pushed by colliders, so where the hair is during `dance` is a
// property of the solver, not of the file. Every previous number about the
// tails in motion ("27° single-frame jumps", "smooth without colliders") was
// an eyeballed browser impression that nobody could reproduce; so was the
// crown, the highest point the dance throws her hair to, which the frame's pan
// is derived from and which lived as a hand-typed constant until 2026-09-06.
// This runs the real VRMSpringBoneManager (imported through the loader
// plugin's own afterRoot, on a node tree built from the file's glTF nodes and
// posed through the same VRMHumanoid rigProbe.ts measures with) at a fixed
// 60 Hz, so a claim about the hair in motion is a number that can be re-run.
//
// What it reports, per clip:
//   crown  the topmost vertex of anything she draws at any frame, springs
//          included, against the same vertex in bind pose; and the same
//          crown as each frame's camera sees it (perspective lifts whatever
//          comes toward the camera), which is what the frame's top edge is
//          really measured against
//   coat   deepest point any hair vertex reaches INSIDE the cardigan's outer
//          shell (signed by the shell's normal), and how much of the hair is
//          in there at the worst frame
//   body   the same against the skin and the face
//   skirt  deepest any skirt vertex sits inside the LEGS' skin
//   jump   the largest angle any hair spring bone turns between two frames
//
// WHAT IT READS. Every mesh comes from the body's manifest (`<model>.parts.json`,
// written by build.py): the hair is every `Hair_*` part, the coat
// `Outfit_Cardigan`, the skin `Body_Skin`, the face `Face`, the skirt
// `Outfit_Bottom`; the coat's hem band is the manifest's waist landmark. A body
// this pipeline did not build has no such file, and since 2026-09-07
// `deriveManifest` reads what it can off the body itself instead: the hair that
// moves, the face the expressions deform, everything else as `Body_Skin`. There
// is then no coat and no skirt to measure against, so those four columns print
// 0 and main() says so before the table. Every
// bone comes from the humanoid map (vrmHumanoid.readHumanoid), so a 1.0 file
// with the same manifest simulates the same as its 0.x twin
// (springsim.test.ts holds that). Nothing here names a J_Bip_* node or a
// material.
//
// NO BROWSER, NO GPU, for the same reason as rigProbe: this machine's headless
// browser runs software WebGL at ~1 fps with dt clamped to 50 ms, which is a
// different simulation from the one visitors see.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import * as THREE from 'three'
import {
  VRMSpringBoneColliderShapeSphere,
  VRMSpringBoneLoaderPlugin,
  type VRMSpringBoneJoint,
  type VRMSpringBoneManager,
} from '@pixiv/three-vrm'

import {
  AVATAR_CAMERA_TILT,
  AVATAR_FOV,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  type AvatarFraming,
} from '../../src/components/chat/avatarMode'
import { AVATAR_MOTIONS, motionPan, type AvatarMotionName, type MotionFrame } from '../../src/components/chat/avatarMotions'
import type { ClearanceFramings, ClearanceSimulated, ClipSimulated } from '../../src/components/chat/clearance'
import { applyMotion, buildMotion, buildRigFrom, resetRig, type Rig } from '../../src/components/chat/rigProbe'
import {
  parseGlb,
  readAccessorRows,
  readHumanoid,
  buildNodes,
  expressionMeshes,
  readSprings,
  type GltfAccessor,
  type GltfBufferView,
  type GltfJson,
  type GltfNode,
} from '../../src/components/chat/vrmHumanoid'
import { producedAt, rigSha, servedPath, writeGenerated } from './clearance'

// ---- glTF ------------------------------------------------------------------
//
// The container reader, the humanoid map and the spring block come from
// vrmHumanoid.ts, the one place that knows both VRM versions, and the rig
// comes from rigProbe.ts. What stays here is the narrowing this simulator
// relies on: a body it can simulate has meshes, skins and accessors.

interface GltfPrimitive {
  attributes: Record<string, number>
  material?: number
}
interface Gltf extends GltfJson {
  scenes: { nodes: number[] }[]
  meshes: { name?: string; primitives: GltfPrimitive[] }[]
  skins: { joints: number[]; inverseBindMatrices: number }[]
  accessors: GltfAccessor[]
  bufferViews: GltfBufferView[]
}

/** The build's sidecar: which primitives are which part, and where the body's landmarks are. */
interface Manifest {
  parts: Record<string, { mesh: string; primitives: number[] }>
  landmarks: { waist: number }
  /** True when no build wrote one and it was read off the file. See deriveManifest. */
  derived?: boolean
}

/**
 * How much of a primitive has to be driven by a spring bone before it counts as
 * moving hair, when no manifest says which primitive is what.
 *
 * Measured on mika-milfy-12, whose manifest IS the truth: of its 65 `Hair_*`
 * primitives the spring-driven ones run 83.8–88.1% spring-dominated, and of the
 * 40 primitives that are anything else the highest is 17.3% (a skirt panel).
 * 0.4 sits between them with roughly a factor of two either way.
 *
 * The two groups do NOT separate completely, and that is a property of hair
 * rather than of the threshold: plenty of `Hair_*` primitives read 0%, because
 * the bangs and the scalp cap are skinned to the head bone and have no springs
 * at all. What this finds is the hair that MOVES, which is exactly what the
 * solver needs a set for. Everything else still gets listed (as Body_Skin), so
 * the crown — the topmost vertex of anything listed — still sees a scalp.
 */
const SPRING_DOMINATED = 0.4

/** Node indices of every spring joint, and everything under them. */
function springDrivenNodes(json: Gltf): Set<number> {
  const source = readSprings(json)
  const out = new Set<number>()
  const walk = (i: number): void => {
    if (out.has(i)) return
    out.add(i)
    for (const c of json.nodes[i].children ?? []) walk(c)
  }
  if (source.kind === 'vrm0') {
    for (const g of source.secondaryAnimation.boneGroups ?? []) for (const b of g.bones ?? []) walk(b)
  } else {
    for (const spring of source.springBone.springs ?? []) for (const j of spring.joints ?? []) walk(j.node)
  }
  return out
}

/**
 * A manifest read off the file itself, for a body build.py never built.
 *
 * The real manifest is written by the build and says which primitive is a
 * shoe; nothing can recover that from an arbitrary VRM, and this does not try.
 * What it recovers is the three things this simulator actually needs a set for:
 * the hair that moves (spring-dominated, see SPRING_DOMINATED), the face (the
 * meshes the expressions deform, `expressionMeshes`), and everything else,
 * which goes under Body_Skin.
 *
 * That last name is a promise the derivation cannot keep, and the caller is
 * told so: on a real build Body_Skin is bare skin, here it is skin AND clothes,
 * so the `body` column stops meaning "hair inside her skin" and starts meaning
 * "inside her skin or her clothes". main() prints that before the table.
 *
 * A manifest addresses a mesh BY NAME (gather() and meshNode() both look it up
 * that way), so a body whose skinned meshes are unnamed or share a name is
 * refused rather than described: keying two meshes under one name would read
 * one mesh's primitive indices off the other, and inventing `mesh3` for an
 * unnamed one would produce a manifest that resolves to nothing.
 */
export function deriveManifest(glb: { json: Gltf; bin: Uint8Array }): Manifest {
  const { json } = glb
  const skinned = json.nodes.filter((n) => n.mesh !== undefined && n.skin !== undefined)
  const names = skinned.map((n) => json.meshes[n.mesh as number].name)
  const unnamed = names.filter((n) => !n).length
  const repeated = [...new Set(names.filter((n, i) => n && names.indexOf(n) !== i))]
  if (unnamed || repeated.length) {
    throw new Error(
      '這個檔的帶皮 mesh 名字不能當部件名：' +
      (unnamed ? `${unnamed} 個沒有名字` : '') +
      (unnamed && repeated.length ? '，' : '') +
      (repeated.length ? `${repeated.join('、')} 各出現不只一次` : '') +
      '。manifest 用 mesh 名找 mesh，重名會把一個 mesh 的 primitive 編號套到另一個上。')
  }
  const spring = springDrivenNodes(json)
  const faces = expressionMeshes(json)
  // A manifest part belongs to exactly one mesh (gather() looks its mesh up by
  // name), so the roles are collected per mesh first and the biggest mesh in
  // each role then takes the canonical name runClip asks for. The rest stay
  // listed under their own names: they are not in the body grid, but they are
  // skinned every frame, so the crown still sees them. On a one-mesh-per-role
  // body — every VRoid export — this renaming is the identity.
  const byRole = new Map<string, Map<string, number[]>>()
  const add = (role: string, mesh: string, pi: number): void => {
    const meshes = byRole.get(role) ?? new Map<string, number[]>()
    byRole.set(role, meshes)
    meshes.set(mesh, [...(meshes.get(mesh) ?? []), pi])
  }
  for (const node of json.nodes) {
    if (node.mesh === undefined || node.skin === undefined) continue
    const mesh = json.meshes[node.mesh]
    const skin = json.skins[node.skin]
    const name = mesh.name as string   // checked above
    mesh.primitives.forEach((prim, pi) => {
      const { JOINTS_0, WEIGHTS_0 } = prim.attributes
      if (JOINTS_0 === undefined || WEIGHTS_0 === undefined) return
      const jo = readAccessorRows(glb, JOINTS_0)
      const we = readAccessorRows(glb, WEIGHTS_0)
      const n = jo.data.length / jo.ncomp
      if (n === 0) return
      let driven = 0
      for (let v = 0; v < n; v++) {
        let best = 0
        for (let k = 1; k < we.ncomp; k++) {
          if (we.data[v * we.ncomp + k] > we.data[v * we.ncomp + best]) best = k
        }
        if (spring.has(skin.joints[jo.data[v * jo.ncomp + best]])) driven += 1
      }
      if (driven / n >= SPRING_DOMINATED) add('Hair', name, pi)
      else if (faces.has(node.mesh)) add('Face', name, pi)
      else add('Body_Skin', name, pi)
    })
  }
  const parts: Manifest['parts'] = {}
  for (const [role, meshes] of byRole) {
    const ordered = [...meshes].sort((a, b) => b[1].length - a[1].length)
    ordered.forEach(([mesh, primitives], rank) => {
      // Hair is a set of parts by design (runClip gathers every Hair_* it
      // finds), so every hair mesh keeps its own name. Face and Body_Skin are
      // single parts, so the biggest takes the name and the others trail it.
      const name =
        role === 'Hair' ? `Hair_${mesh}` : rank === 0 ? role : `${role}_${mesh}`
      parts[name] = { mesh, primitives }
    })
  }
  const bones = readHumanoid(json).bones
  // The build measures the waist where the torso is narrowest; that needs the
  // torso's own silhouette. Here it is the hips joint, which is the landmark
  // the narrow point sits closest to, and the only consumer is the coat's hem
  // band (waist − 4cm).
  const hips = bones.hips
  if (hips === undefined) throw new Error('no hips bone: the waist landmark cannot be derived')
  const world = new THREE.Matrix4()
  const nodes = buildNodes(json).nodes
  nodes[hips].updateWorldMatrix(true, false)
  world.copy(nodes[hips].matrixWorld)
  return { parts, landmarks: { waist: world.elements[13] }, derived: true }
}

// Deriving one walks every skinned vertex of the file, and both main() (for the
// banner) and every runClip ask for the same body's: --clip=all on a
// manifest-less body derived it eleven times.
const manifestCache = new Map<string, Manifest>()

function readManifest(model: string, glb: { json: Gltf; bin: Uint8Array }): Manifest {
  const cached = manifestCache.get(model)
  if (cached) return cached
  const built = buildManifest(model, glb)
  manifestCache.set(model, built)
  return built
}

function buildManifest(model: string, glb: { json: Gltf; bin: Uint8Array }): Manifest {
  const file = model.replace(/\.vrm$/, '.parts.json')
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    // No build wrote one, so read what the file itself says. Until 2026-09-07
    // this threw, which meant the simulator could only ever run on a body this
    // pipeline had built: not the Seed-san fixture, and not mika-pink or the
    // base body either, whose crowns therefore had to come from a browser scan.
    return deriveManifest(glb)
  }
  const m = JSON.parse(text) as Partial<Manifest>
  if (!m.parts || typeof m.landmarks?.waist !== 'number') throw new Error(`${file}: no parts or no waist landmark`)
  return m as Manifest
}

// ---- humanoid ----------------------------------------------------------------

/** Node indices of every bone under (and including) the given nodes. */
function subtreeNodes(json: Gltf, roots: (number | undefined)[]): Set<number> {
  const out = new Set<number>()
  const walk = (i: number): void => {
    if (out.has(i)) return
    out.add(i)
    for (const c of json.nodes[i].children ?? []) walk(c)
  }
  for (const r of roots) if (r !== undefined) walk(r)
  return out
}

/** Everything hanging off the shoulders (or the upper arms, on a body without shoulder bones). */
function armNodes(json: Gltf): Set<number> {
  const b = readHumanoid(json).bones
  return subtreeNodes(json, [b.leftShoulder ?? b.leftUpperArm, b.rightShoulder ?? b.rightUpperArm])
}

/** Everything hanging off the upper legs. */
function legNodes(json: Gltf): Set<number> {
  const b = readHumanoid(json).bones
  return subtreeNodes(json, [b.leftUpperLeg, b.rightUpperLeg])
}

// ---- springs -------------------------------------------------------------------

/**
 * Import the springs exactly as the browser does: through the loader plugin's
 * public `afterRoot`, fed a stand-in for the GLTFLoader result (the JSON, the
 * rig's raw nodes as the node dependencies). The plugin picks the 1.0 or the
 * 0.x branch from `extensionsUsed` itself. Re-implementing the import here
 * would be one more place for the VRM0 sign conventions (collider z is
 * negated, gravity is not) to drift.
 */
async function importSprings(json: Gltf, rig: Rig): Promise<VRMSpringBoneManager> {
  const parser = {
    json,
    getDependencies: async (type: string) => {
      if (type !== 'node') throw new Error(`unexpected dependency ${type}`)
      return rig.raw
    },
    getDependency: async (type: string, index: number) => {
      if (type !== 'node') throw new Error(`unexpected dependency ${type}`)
      return rig.raw[index]
    },
  }
  const plugin = new VRMSpringBoneLoaderPlugin(parser as never)
  const gltf = { parser, scene: rig.scene, userData: {} as { vrmSpringBoneManager?: VRMSpringBoneManager | null } }
  await plugin.afterRoot(gltf as never)
  const manager = gltf.userData.vrmSpringBoneManager
  if (!manager) throw new Error('no spring bones in this file (neither VRMC_springBone nor VRM.secondaryAnimation)')
  return manager
}

/**
 * The spring joints that move the hair: every joint whose bone the `Hair_*`
 * parts are skinned to. Read off the imported manager rather than the file's
 * spring block, which the two versions lay out differently.
 */
function hairJoints(manager: VRMSpringBoneManager, rig: Rig, hairBones: Set<number>): VRMSpringBoneJoint[] {
  const index = new Map(rig.raw.map((o, i) => [o, i]))
  return [...manager.joints].filter((j) => hairBones.has(index.get(j.bone) ?? -1))
}

/**
 * The hips' heading, degrees from facing the camera. The sign follows the
 * file's own X axis: on a 0.x body (her left is -X) a turn to her left reads
 * negative, on a 1.0 body positive. Same number the old poser reported.
 */
function yawDeg(rig: Rig): number {
  const forwardZ = rig.version === '0' ? -1 : 1
  const f = new THREE.Vector3(0, 0, forwardZ).transformDirection(rig.bones.hips.matrixWorld)
  return (Math.atan2(f.x, forwardZ * f.z) * 180) / Math.PI
}

// ---- collider presets ----------------------------------------------------------

/** The bones the VRoid hair collider set hangs off, by humanoid name. */
const HAIR_TARGET_BONES = [
  'head', 'neck', 'upperChest', 'spine',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
] as const
const ARM_TARGET_BONES = new Set<string>(HAIR_TARGET_BONES.filter((n) => /Arm|Hand/.test(n)))

/**
 * Give the hair springs another body's hair collider set (what-if): every
 * collider group the base file hangs on one of HAIR_TARGET_BONES is copied
 * onto the same humanoid bone here. Both files are read by humanoid name, so
 * the base can be any VRoid export with the same bones. 0.x files only: the
 * copy is a JSON edit of the block the importer reads.
 */
function restoreVroidColliders(json: Gltf, baseFile: string, includeArms: boolean, hairBones: Set<number>): void {
  const base = parseGlb<Gltf>(readFileSync(baseFile)).json
  const ours = readSprings(json)
  const theirs = readSprings(base)
  if (ours.kind !== 'vrm0' || theirs.kind !== 'vrm0') throw new Error('--colliders=vroid rewrites the 0.x spring block; both files must be VRM 0.x')
  const baseBones = readHumanoid(base).bones
  const ourBones = readHumanoid(json).bones
  const baseBoneOfNode = new Map(Object.entries(baseBones).map(([b, n]) => [n, b]))
  const sec = ours.secondaryAnimation
  const indexOfNode = new Map(sec.colliderGroups.map((g, i) => [g.node, i]))
  const refs: number[] = []
  for (const group of theirs.secondaryAnimation.colliderGroups) {
    const bone = baseBoneOfNode.get(group.node)
    if (!bone || !(HAIR_TARGET_BONES as readonly string[]).includes(bone)) continue
    if (!includeArms && ARM_TARGET_BONES.has(bone)) continue
    const node = ourBones[bone]
    if (node === undefined) throw new Error(`model has no ${bone} bone`)
    let idx = indexOfNode.get(node)
    if (idx === undefined) {
      idx = sec.colliderGroups.length
      sec.colliderGroups.push({ node, colliders: group.colliders })
      indexOfNode.set(node, idx)
    }
    refs.push(idx)
  }
  for (const g of sec.boneGroups) {
    if ((g.bones ?? []).some((b) => hairBones.has(b))) g.colliderGroups = refs
  }
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
  /** Vertex indices the penetration queries use (outer shell / stride); every vertex is skinned. */
  keep: Int32Array
  outPos: Float64Array
  outNrm: Float64Array
}

function meshNode(json: Gltf, meshName: string): GltfNode {
  const mi = json.meshes.findIndex((m) => m.name === meshName)
  const node = json.nodes.find((n) => n.mesh === mi)
  if (!node || node.skin === undefined) throw new Error(`no skinned node for mesh ${meshName}`)
  return node
}

function gather(json: Gltf, bin: Uint8Array, manifest: Manifest, part: string, stride = 1): SkinSet {
  const p = manifest.parts[part]
  if (!p) throw new Error(`manifest has no part ${part}`)
  const mesh = json.meshes.find((m) => m.name === p.mesh)
  if (!mesh) throw new Error(`no mesh ${p.mesh} (manifest part ${part})`)
  const node = meshNode(json, p.mesh)
  const parts = p.primitives.map((pi) => {
    const prim = mesh.primitives[pi]
    return {
      pos: readAccessorRows({ json, bin }, prim.attributes.POSITION).data,
      nrm: readAccessorRows({ json, bin }, prim.attributes.NORMAL).data,
      joints: readAccessorRows({ json, bin }, prim.attributes.JOINTS_0).data,
      weights: readAccessorRows({ json, bin }, prim.attributes.WEIGHTS_0).data,
    }
  })
  const n = parts.reduce((s, q) => s + q.pos.length / 3, 0)
  const set: SkinSet = {
    label: part, n, skin: node.skin as number,
    pos: new Float64Array(n * 3), nrm: new Float64Array(n * 3),
    joints: new Float64Array(n * 4), weights: new Float64Array(n * 4),
    keep: new Int32Array(0), outPos: new Float64Array(n * 3), outNrm: new Float64Array(n * 3),
  }
  let at = 0
  for (const q of parts) {
    const k = q.pos.length / 3
    set.pos.set(q.pos, at * 3)
    set.nrm.set(q.nrm, at * 3)
    set.joints.set(q.joints, at * 4)
    set.weights.set(q.weights, at * 4)
    at += k
  }
  const keep: number[] = []
  for (let i = 0; i < n; i += stride) keep.push(i)
  set.keep = Int32Array.from(keep)
  return set
}

/** The skin joint (glTF node index) with the largest weight on a vertex. */
function dominantNode(json: Gltf, set: SkinSet, i: number): number {
  let best = -1
  let bestW = -1
  for (let k = 0; k < 4; k++) {
    if (set.weights[i * 4 + k] > bestW) {
      bestW = set.weights[i * 4 + k]
      best = set.joints[i * 4 + k]
    }
  }
  return json.skins[set.skin].joints[best]
}

/** Every skin joint any vertex of the set carries weight on, as glTF node indices. */
function weightedNodes(json: Gltf, set: SkinSet): Set<number> {
  const joints = json.skins[set.skin].joints
  const out = new Set<number>()
  for (let i = 0; i < set.n; i++) {
    for (let k = 0; k < 4; k++) if (set.weights[i * 4 + k] > 0) out.add(joints[set.joints[i * 4 + k]])
  }
  return out
}

/** Narrow a set's queries to the vertices whose dominant joint is in `nodes` (or is not, with `invert`). */
function keepDominatedBy(json: Gltf, set: SkinSet, nodes: Set<number>, invert = false): void {
  const keep: number[] = []
  for (const i of set.keep) {
    if (nodes.has(dominantNode(json, set, i)) !== invert) keep.push(i)
  }
  set.keep = Int32Array.from(keep)
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
    bin: Uint8Array,
    private readonly objs: THREE.Object3D[],
    private readonly skinIndex: number,
  ) {
    const skin = json.skins[skinIndex]
    this.ibm = readAccessorRows({ json, bin }, skin.inverseBindMatrices).data
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
  /** Every vertex of the set: the crown wants the topmost one wherever it is. */
  apply(set: SkinSet): void {
    const B = this.boneMats
    for (let i = 0; i < set.n; i++) {
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

/** The highest skinned vertex across the sets. */
function topOf(sets: SkinSet[]): number {
  let top = -Infinity
  for (const s of sets) {
    for (let i = 0; i < s.n; i++) if (s.outPos[i * 3 + 1] > top) top = s.outPos[i * 3 + 1]
  }
  return top
}

// ---- the frame's camera ------------------------------------------------------------
//
// The engine's camera (avatarGuideEngine aimCamera): at (0, lookAtY + tilt,
// distance) on the side she faces, looking at (0, lookAtY, 0). A vertex
// nearer the camera than that point projects higher than its world height,
// so the crown a frame has to clear is the projected one. The number kept is
// the height on the subject plane that lands on the same row: the frame's
// top edge is lookAtY + distance·tan(fov/2) in those units
// (avatarMode.avatarViewSpan), and that is what the browser's row-to-height
// conversion and every guard compare against.

const FRAMES: Record<MotionFrame, AvatarFraming> = { waistUp: AVATAR_FRAMING_DEFAULT, column: AVATAR_FRAMING_COLUMN }

class FrameCamera {
  private readonly inv = new THREE.Matrix4()
  private readonly v = new THREE.Vector3()
  /** How far below the world crown a vertex can sit and still project highest, at these distances. */
  private static readonly REACH_BELOW = 0.35
  constructor(private readonly framing: AvatarFraming, private readonly lookAtY: number, forwardZ: number) {
    const cam = new THREE.PerspectiveCamera(AVATAR_FOV, 1, 0.1, 30)
    cam.position.set(0, lookAtY + AVATAR_CAMERA_TILT, forwardZ * framing.distance)
    cam.lookAt(0, lookAtY, 0)
    cam.updateMatrixWorld(true)
    this.inv.copy(cam.matrixWorld).invert()
  }
  /** Height on the subject plane that shares a row with the world point. */
  screen(x: number, y: number, z: number): number {
    this.v.set(x, y, z).applyMatrix4(this.inv)
    return this.lookAtY + (this.framing.distance * this.v.y) / -this.v.z
  }
  /** The highest projected vertex across the sets. */
  top(sets: SkinSet[], worldTop: number): number {
    let best = -Infinity
    const floor = worldTop - FrameCamera.REACH_BELOW
    for (const s of sets) {
      for (let i = 0; i < s.n; i++) {
        const y = s.outPos[i * 3 + 1]
        if (y < floor) continue
        const h = this.screen(s.outPos[i * 3], y, s.outPos[i * 3 + 2])
        if (h > best) best = h
      }
    }
    return best
  }
}

/** The engine's composition as this run saw it, for the clearance file. */
export function framingsNow(): ClearanceFramings {
  const pans: ClearanceFramings['pans'] = {}
  for (const name of Object.keys(AVATAR_MOTIONS) as AvatarMotionName[]) {
    const pan = AVATAR_MOTIONS[name].pan
    if (pan) pans[name] = pan
  }
  return { fov: AVATAR_FOV, tilt: AVATAR_CAMERA_TILT, frames: FRAMES, pans }
}

// ---- signed distance, hair against a shell ----------------------------------------

const CELL = 0.05
// How far from the nearest shell vertex a point can be and still be judged by
// that vertex's normal: 5cm out, the "plane" of a collar vertex classifies
// hair above the coat as inside, and at 15cm a skirt vertex by the waist was
// judged by a thigh vertex's normal and read 150mm "inside" the legs on the
// shipped body. The signed distance therefore SATURATES at 5cm: a point deeper
// inside reads exactly 50mm, and a reading of 50 means "at least 50". A budget
// on this measure is only a gate if it sits BELOW 50; where a clip already
// reads the cap there is no budget to be had, and springsim.test.ts pins the
// cap instead of pretending otherwise.
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
// dominant joint hangs off a shoulder) because a sleeve sweeping past a tail
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

/**
 * Drop the sleeves: a coat vertex whose dominant joint hangs off a shoulder.
 * The 2026-09-04 rule added a T-pose cut at |x| > 0.3 because the vendor's
 * sleeve weights were coarse; since Phase 4 the cardigan is re-skinned from
 * the body's own skin (binding.py nearest, 16 diffusion passes) and the joint
 * rule alone drops every vertex the cut did (52 cuff vertices on the finger
 * bones, which the old name test missed and the cut caught).
 */
function dropSleeves(json: Gltf, set: SkinSet): void {
  keepDominatedBy(json, set, armNodes(json), true)
}

// ---- the run -------------------------------------------------------------------------

export interface Report {
  clip: string
  coatDepthMm: number
  coatAtWorst: number // share of hair vertices ≥5mm inside at the worst frame
  coatWorstT: number
  coatWorstYaw: number
  coatWorstWhere: string
  /** Same, counting only hair above the coat's hem band (world y ≥ waist − 0.04). */
  coatUpperDepthMm: number
  bodyDepthMm: number
  bodyWorstT: number
  /** Deepest any skirt vertex sits inside the legs' skin, and when; at rest too. */
  skirtDepthMm: number
  skirtWorstT: number
  restSkirtDepthMm: number
  jumpDeg: number
  jumpT: number
  jumpBone: string
  restCoatDepthMm: number
  /** Topmost drawn vertex in bind pose, and the highest any frame lifts one. */
  restCrownY: number
  crownY: number
  crownT: number
  /** The same two through each frame's camera (the clip's pan applied to the moving one). */
  restCrownScreen: Record<MotionFrame, number>
  crownScreen: Record<MotionFrame, number>
}

export interface Args {
  model: string
  clip: string
  colliders: 'asis' | 'vroid' | 'vroid-noarms'
  /** The VRoid export whose hair colliders --colliders=vroid copies. */
  vroidColliders: string | null
  hit: number | null
  gravity: number | null
  stride: number
  /** Drop the arm/hand collider groups from the hair's list (what-if). */
  noArms: boolean
  /** Drop the coat bead groups from the hair's list (what-if). */
  noCoat: boolean
  /** Clip time at which to print every hair joint against its colliders. */
  dumpAt: number | null
  /** Write the simulated clearance module here (implies --clip=all). */
  clearance: string | null
  family: string
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    model: path.resolve('public/avatar/mika-milfy-12.vrm'),
    clip: 'dance',
    colliders: 'asis',
    vroidColliders: null,
    hit: null,
    gravity: null,
    stride: 2,
    noArms: false,
    noCoat: false,
    dumpAt: null,
    clearance: null,
    family: 'vroid-sample-b',
  }
  for (const a of argv) {
    if (a.startsWith('--clip=')) args.clip = a.slice(7)
    else if (a.startsWith('--colliders=')) args.colliders = a.slice(12) as Args['colliders']
    else if (a.startsWith('--vroid-colliders=')) args.vroidColliders = path.resolve(a.slice(18))
    else if (a.startsWith('--hit=')) args.hit = Number(a.slice(6))
    else if (a.startsWith('--gravity=')) args.gravity = Number(a.slice(10))
    else if (a.startsWith('--stride=')) args.stride = Number(a.slice(9))
    else if (a === '--no-arms') args.noArms = true
    else if (a === '--no-coat') args.noCoat = true
    else if (a.startsWith('--dump-at=')) args.dumpAt = Number(a.slice(10))
    else if (a.startsWith('--clearance=')) {
      args.clearance = path.resolve(a.slice(12))
      args.clip = 'all'
    } else if (a.startsWith('--family=')) args.family = a.slice(9)
    else if (!a.startsWith('--')) args.model = path.resolve(a)
  }
  if (args.colliders !== 'asis' && !args.vroidColliders) {
    throw new Error(`--colliders=${args.colliders} needs --vroid-colliders=<the VRoid export to copy hair colliders from>`)
  }
  return args
}

const FPS = 60
const PREROLL_S = 2
const HOLD_S = 1
const INSIDE_MM = 5

export async function runClip(args: Args, clipPath: string): Promise<Report> {
  const raw = readFileSync(args.model)
  const { json, bin } = parseGlb<Gltf>(raw)
  if (!bin) throw new Error('GLB without a BIN chunk')
  const manifest = readManifest(args.model, { json, bin })
  const bones = readHumanoid(json).bones

  // Every part the manifest lists is skinned every frame (the crown is the
  // topmost vertex of any of them); the ones with a role are also queried.
  const sets = new Map<string, SkinSet>()
  for (const part of Object.keys(manifest.parts)) {
    if (manifest.parts[part].primitives.length === 0) continue
    sets.set(part, gather(json, bin, manifest, part, part.startsWith('Hair_') || part === 'Outfit_Bottom' ? args.stride : 1))
  }
  const hair = [...sets.entries()].filter(([part]) => part.startsWith('Hair_')).map(([, s]) => s)
  if (hair.length === 0) throw new Error('manifest has no Hair_* part')
  const body = sets.get('Body_Skin')
  const face = sets.get('Face')
  if (!body || !face) throw new Error('manifest has no Body_Skin or no Face part')
  const coat = sets.get('Outfit_Cardigan') ?? null
  const skirt = sets.get('Outfit_Bottom') ?? null
  if (coat) {
    outerShellOnly(coat)
    dropSleeves(json, coat)
  }
  // The legs' skin, for the skirt: a skirt hugs the hips by design, and a
  // waistband a few millimetres into the torso is not a leg coming through.
  const legs = gather(json, bin, manifest, 'Body_Skin')
  keepDominatedBy(json, legs, legNodes(json))
  const hairBones = new Set<number>()
  for (const h of hair) for (const n of weightedNodes(json, h)) hairBones.add(n)

  // Fresh tree per clip: the solver keeps state on the nodes.
  if (args.colliders !== 'asis') {
    restoreVroidColliders(json, args.vroidColliders as string, args.colliders === 'vroid', hairBones)
  }
  const rig = buildRigFrom({ json, bin })
  const { raw: objs, scene } = rig
  const manager = await importSprings(json, rig)
  const joints = hairJoints(manager, rig, hairBones)
  if (joints.length === 0) throw new Error('no spring joint moves a Hair_* part')
  if (args.hit !== null) for (const j of joints) j.settings.hitRadius = args.hit
  if (args.gravity !== null) for (const j of joints) j.settings.gravityPower = args.gravity
  if (args.noArms || args.noCoat) {
    const arms = armNodes(json)
    const torso = new Set([bones.hips, bones.spine, bones.chest, bones.upperChest].filter((n): n is number => n !== undefined))
    const nodeOf = (o: THREE.Object3D): number => objs.indexOf(o)
    for (const j of joints) {
      j.colliderGroups = j.colliderGroups.filter((g) => {
        const on = nodeOf(g.colliders[0]?.parent as THREE.Object3D)
        if (args.noArms && arms.has(on)) return false
        // Beads: many spheres on a torso bone. The VRoid spine group has one.
        if (args.noCoat && torso.has(on) && g.colliders.length > 1) return false
        return true
      })
    }
  }
  if (process.env.SPRINGSIM_DEBUG) {
    const groups = new Set(joints.flatMap((j) => j.colliderGroups))
    console.log(`  hair colliders: ${[...groups].map((g) => `${g.colliders[0]?.parent?.name}×${g.colliders.length}`).join(' ')}`)
  }
  const motion = buildMotion(new Uint8Array(readFileSync(clipPath)))

  const spineIndex = bones.spine
  if (spineIndex === undefined) throw new Error('no spine')
  const spine = objs[spineIndex]
  const allSets = [...sets.values()]
  const skinners = new Map<number, Skinner>()
  for (const s of [...allSets, legs]) if (!skinners.has(s.skin)) skinners.set(s.skin, new Skinner(json, bin, objs, s.skin))
  const skinAll = (): void => {
    for (const s of skinners.values()) s.refresh()
    for (const s of allSets) skinners.get(s.skin)?.apply(s)
    skinners.get(legs.skin)?.apply(legs)
  }

  const tailBones = joints.map((j) => j.bone).filter((b) => b.children.length > 0)
  const prevDir = tailBones.map(() => new THREE.Vector3())
  const dir = new THREE.Vector3()
  const childPos = new THREE.Vector3()
  const bonePos = new THREE.Vector3()

  const report: Report = {
    clip: path.basename(clipPath, '.vrma'),
    coatDepthMm: -Infinity, coatAtWorst: 0, coatWorstT: 0, coatWorstYaw: 0, coatWorstWhere: '', coatUpperDepthMm: -Infinity,
    bodyDepthMm: -Infinity, bodyWorstT: 0,
    skirtDepthMm: -Infinity, skirtWorstT: 0, restSkirtDepthMm: -Infinity,
    jumpDeg: 0, jumpT: 0, jumpBone: '',
    restCoatDepthMm: -Infinity,
    restCrownY: -Infinity, crownY: -Infinity, crownT: 0,
    restCrownScreen: { waistUp: -Infinity, column: -Infinity },
    crownScreen: { waistUp: -Infinity, column: -Infinity },
  }
  const forwardZ = rig.version === '0' ? -1 : 1
  const frameNames = Object.keys(FRAMES) as MotionFrame[]
  const clipName = report.clip as AvatarMotionName
  const pan = (f: MotionFrame): number => (clipName in AVATAR_MOTIONS ? motionPan(clipName, f) : 0)
  const restCams = frameNames.map((f) => [f, new FrameCamera(FRAMES[f], FRAMES[f].lookAtY, forwardZ)] as const)
  const clipCams = frameNames.map((f) => [f, new FrameCamera(FRAMES[f], FRAMES[f].lookAtY + pan(f), forwardZ)] as const)

  // Bind pose: the resting crown, and (debug) skinning at rest must reproduce
  // POSITION exactly.
  resetRig(rig)
  skinAll()
  report.restCrownY = topOf(allSets)
  for (const [f, cam] of restCams) report.restCrownScreen[f] = cam.top(allSets, report.restCrownY)
  // Hair vertices already inside the skin at rest are the roots under the
  // scalp and the strands modelled into the head, not a clipping; the body
  // gate is about hair that ENTERS the body during the clip, so those are
  // left out of it. Until 2026-09-06 they were counted, and every clip read
  // the saturated 50mm at rest and in motion alike, which no threshold could
  // tell from a tail through an arm.
  const rooted = new Map<SkinSet, Set<number>>()
  {
    const bodyGrid = new Grid(body)
    const faceGrid = new Grid(face)
    for (const h of hair) {
      const set = new Set<number>()
      for (const i of h.keep) {
        const x = h.outPos[i * 3], y = h.outPos[i * 3 + 1], z = h.outPos[i * 3 + 2]
        if (Math.max(-bodyGrid.signed(x, y, z), -faceGrid.signed(x, y, z)) * 1000 >= INSIDE_MM) set.add(i)
      }
      rooted.set(h, set)
    }
  }
  if (process.env.SPRINGSIM_DEBUG) {
    for (const s of allSets) {
      let worst = 0
      for (let i = 0; i < s.n; i++) {
        const d = Math.hypot(s.outPos[i * 3] - s.pos[i * 3], s.outPos[i * 3 + 1] - s.pos[i * 3 + 1], s.outPos[i * 3 + 2] - s.pos[i * 3 + 2])
        if (d > worst) worst = d
      }
      console.log(`  bind check ${s.label}: skin ${s.skin}, ${s.n} verts, max |skinned - rest| ${(worst * 1000).toFixed(2)}mm`)
    }
    console.log(`  rest crown ${report.restCrownY.toFixed(4)}`)
  }

  const hemBand = manifest.landmarks.waist - 0.04
  const dt = 1 / FPS
  const total = Math.round((PREROLL_S + motion.duration + HOLD_S) * FPS)
  for (let frame = 0; frame <= total; frame++) {
    const wall = frame * dt
    const t = Math.min(motion.duration, Math.max(0, wall - PREROLL_S))
    applyMotion(rig, motion, t) // normalized → raw → world matrices
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
      // Where every hair joint is, and how far it sits from the nearest collider
      // it is asked to avoid (negative = inside the keep-out). Read off the
      // imported manager, so the same reading comes off a 0.x or a 1.0 file.
      const c = new THREE.Vector3()
      console.log(`  dump at t=${t.toFixed(2)}s (yaw ${yawDeg(rig).toFixed(0)}°):`)
      const shell = coat ? new RadialShell(coat, spine) : null // coat was skinned on the last even frame; close enough for a reading
      for (const j of joints) {
        j.bone.getWorldPosition(bonePos)
        let best = { gap: Infinity, name: '' }
        for (const g of j.colliderGroups) {
          for (const col of g.colliders) {
            const shape = col.shape
            if (!(shape instanceof VRMSpringBoneColliderShapeSphere)) continue
            c.copy(shape.offset).applyMatrix4(col.matrixWorld)
            const gap = bonePos.distanceTo(c) - (shape.radius + j.settings.hitRadius)
            if (gap < best.gap) best = { gap, name: col.parent?.name ?? '' }
          }
        }
        const where = shell ? ` [${shell.describe(bonePos.x, bonePos.y, bonePos.z)}]` : ''
        console.log(`    ${j.bone.name.padEnd(11)}${where} nearest keep-out ${(best.gap * 1000).toFixed(0).padStart(5)}mm (${best.name})`)
      }
    }

    // penetration, every other frame (skinning is the cost)
    if (frame % 2 !== 0) continue
    skinAll()
    const crown = topOf(allSets)
    const coatShell = coat ? new RadialShell(coat, spine) : null
    const bodyGrid = new Grid(body)
    const faceGrid = new Grid(face)
    const legGrid = new Grid(legs)
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
        counted++
        if (coat && coatShell) {
          const c = coatShell.depth(x, y, z) * 1000
          if (y >= hemBand && c > coatUpper) coatUpper = c
          if (c > coatDepth) {
            coatDepth = c
            const ci = coatShell.argmax.get(coatShell.keyOf(x, y, z))
            where = `${h.label} (${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}) [${coatShell.describe(x, y, z)}]` +
              (ci === undefined ? '' : ` coat (${coat.outPos[ci * 3].toFixed(2)},${coat.outPos[ci * 3 + 1].toFixed(2)},${coat.outPos[ci * 3 + 2].toFixed(2)}) [${coatShell.describe(coat.outPos[ci * 3], coat.outPos[ci * 3 + 1], coat.outPos[ci * 3 + 2])}] rest (${coat.pos[ci * 3].toFixed(2)},${coat.pos[ci * 3 + 1].toFixed(2)},${coat.pos[ci * 3 + 2].toFixed(2)})`)
          }
          if (c >= INSIDE_MM) inside++
        }
        if (rooted.get(h)?.has(i)) continue
        const b = Math.max(-bodyGrid.signed(x, y, z), -faceGrid.signed(x, y, z)) * 1000
        if (b > bodyDepth) bodyDepth = b
      }
    }
    if (!coat) coatDepth = coatUpper = 0
    let skirtDepth = skirt ? -Infinity : 0
    if (skirt) {
      for (const i of skirt.keep) {
        const d = -legGrid.signed(skirt.outPos[i * 3], skirt.outPos[i * 3 + 1], skirt.outPos[i * 3 + 2]) * 1000
        if (d > skirtDepth) skirtDepth = d
      }
    }
    if (wall < PREROLL_S) {
      if (Math.abs(wall - (PREROLL_S - dt * 2)) < dt) {
        report.restCoatDepthMm = coatDepth
        report.restSkirtDepthMm = skirtDepth
        if (process.env.SPRINGSIM_DEBUG) {
          const p = new THREE.Vector3()
          console.log(`  pre-roll end: hips yaw ${yawDeg(rig).toFixed(0)}°`)
          for (const o of [objs[bones.head as number], objs[bones.hips], ...tailBones]) {
            o.getWorldPosition(p)
            console.log(`    ${o.name.padEnd(14)} (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)})`)
          }
          if (coat && coatShell) {
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
              const ci = coatShell.argmax.get(coatShell.keyOf(hx, hy, hz))
              console.log(`  rest ${h.label}: worst hair vertex (${hx.toFixed(3)}, ${hy.toFixed(3)}, ${hz.toFixed(3)}) depth ${(worst * 1000).toFixed(0)}mm` +
                (ci === undefined ? '' : ` vs coat vertex (${coat.outPos[ci * 3].toFixed(3)}, ${coat.outPos[ci * 3 + 1].toFixed(3)}, ${coat.outPos[ci * 3 + 2].toFixed(3)})`))
            }
          }
        }
      }
      continue
    }
    if (crown > report.crownY) {
      report.crownY = crown
      report.crownT = t
    }
    for (const [f, cam] of clipCams) {
      const h = cam.top(allSets, crown)
      if (h > report.crownScreen[f]) report.crownScreen[f] = h
    }
    if (coatDepth > report.coatDepthMm) {
      report.coatDepthMm = coatDepth
      report.coatAtWorst = inside / counted
      report.coatWorstT = t
      report.coatWorstYaw = yawDeg(rig)
      report.coatWorstWhere = where
    }
    if (coatUpper > report.coatUpperDepthMm) report.coatUpperDepthMm = coatUpper
    if (bodyDepth > report.bodyDepthMm) {
      report.bodyDepthMm = bodyDepth
      report.bodyWorstT = t
    }
    if (skirtDepth > report.skirtDepthMm) {
      report.skirtDepthMm = skirtDepth
      report.skirtWorstT = t
    }
  }
  return report
}

/** The clearance module's share of a report. */
function simulated(r: Report): ClipSimulated {
  const tenth = (v: number): number => Math.round(v * 10) / 10
  return {
    crownY: Math.round(r.crownY * 1e4) / 1e4,
    crownT: Math.round(r.crownT * 100) / 100,
    crownScreen: {
      waistUp: Math.round(r.crownScreen.waistUp * 1e4) / 1e4,
      column: Math.round(r.crownScreen.column * 1e4) / 1e4,
    },
    coatDepthMm: tenth(r.coatDepthMm),
    bodyDepthMm: tenth(r.bodyDepthMm),
    jumpDeg: tenth(r.jumpDeg),
    skirtDepthMm: tenth(r.skirtDepthMm),
  }
}

export function writeClearance(args: Args, reports: Report[]): void {
  if (!args.clearance) return
  const { json } = parseGlb<Gltf>(readFileSync(args.model))
  const clips: Record<string, ClipSimulated> = {}
  for (const r of [...reports].sort((a, b) => a.clip.localeCompare(b.clip))) clips[r.clip] = simulated(r)
  const value: ClearanceSimulated = {
    family: args.family,
    rigSha: rigSha(json),
    simulatedOn: servedPath(args.model),
    producedBy: producedAt(),
    restCrownY: Math.round(reports[0].restCrownY * 1e4) / 1e4,
    restCrownScreen: {
      waistUp: Math.round(reports[0].restCrownScreen.waistUp * 1e4) / 1e4,
      column: Math.round(reports[0].restCrownScreen.column * 1e4) / 1e4,
    },
    framings: framingsNow(),
    clips,
  }
  writeGenerated(
    args.clearance,
    {
      exportName: 'SIMULATED',
      typeName: 'ClearanceSimulated',
      typeFrom: '../clearance',
      producer: 'scripts/avatar/springsim.ts --clearance',
      note: [
        `Body ${servedPath(args.model)} through three-vrm's spring solver at ${FPS} Hz, every clip in`,
        'public/avatar/animations. crownY is the topmost drawn vertex at any frame, restCrownY the',
        "same in bind pose, crownScreen/restCrownScreen those two through each frame's camera",
        '(framings, recorded here as they were); depths are the worst frame. Regenerate:',
        `  npx tsx scripts/avatar/springsim.ts ${path.relative(process.cwd(), args.model)} --clearance=${path.relative(process.cwd(), args.clearance)}`,
      ],
    },
    value,
  )
  console.log(`wrote ${path.relative(process.cwd(), args.clearance)}`)
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
  // Said before the table, not after, because the table's own columns change
  // meaning when the parts were derived rather than built.
  if (!existsSync(args.model.replace(/\.vrm$/, '.parts.json'))) {
    const derived = readManifest(args.model, parseGlb<Gltf>(readFileSync(args.model)) as { json: Gltf; bin: Uint8Array })
    console.log(
      `  沒有 ${path.basename(args.model.replace(/\.vrm$/, '.parts.json'))}，部件改由檔案本身推導：` +
      `${Object.keys(derived.parts).filter((k) => k.startsWith('Hair_')).length} 個會動的髮部件` +
      `（彈簧驅動 ≥${SPRING_DOMINATED * 100}%），臉取表情驅動的 mesh，其餘全歸 Body_Skin。`)
    console.log(
      '  因此 body 那欄量的是「頭髮進到身體**或衣服**多深」，不再是進到皮膚多深；' +
      'coat 與 skirt 四欄沒有東西可以量（推導出來的部件裡沒有 Outfit_Cardigan／Outfit_Bottom），' +
      '一律印 0，那是「沒量」不是「沒問題」；crown 與 jump 照舊（髮頂本來就取所有部件的最高點）。')
  }
  console.log('clip          rest→coat  coat max  above-hem  share≥5mm   @t     yaw    body max  @t     skirt   @t    crown   @t    (column) (waistUp)   jump    @t    bone')
  const reports: Report[] = []
  for (const clip of clips) {
    const r = await runClip(args, clip)
    reports.push(r)
    console.log(
      `${r.clip.padEnd(12)}  ${r.restCoatDepthMm.toFixed(0).padStart(6)}mm ` +
      `${r.coatDepthMm.toFixed(0).padStart(7)}mm ${r.coatUpperDepthMm.toFixed(0).padStart(7)}mm  ${(r.coatAtWorst * 100).toFixed(0).padStart(7)}%  ` +
      `${r.coatWorstT.toFixed(2).padStart(5)}s ${r.coatWorstYaw.toFixed(0).padStart(5)}°  ` +
      `${r.bodyDepthMm.toFixed(0).padStart(6)}mm  ${r.bodyWorstT.toFixed(2).padStart(5)}s  ` +
      `${r.skirtDepthMm.toFixed(0).padStart(5)}mm ${r.skirtWorstT.toFixed(2).padStart(5)}s  ` +
      `${r.crownY.toFixed(4)} ${r.crownT.toFixed(2).padStart(5)}s  ${r.crownScreen.column.toFixed(4)}  ${r.crownScreen.waistUp.toFixed(4)}  ` +
      `${r.jumpDeg.toFixed(1).padStart(5)}°  ${r.jumpT.toFixed(2).padStart(5)}s  ${r.jumpBone}`,
    )
    if (process.env.SPRINGSIM_DEBUG) console.log(`    worst coat frame: ${r.coatWorstWhere}`)
  }
  const rest = reports[0]
  console.log(`rest crown ${rest.restCrownY.toFixed(4)} (bind pose, topmost vertex of any part); through the column camera ${rest.restCrownScreen.column.toFixed(4)}, waist-up ${rest.restCrownScreen.waistUp.toFixed(4)}`)
  writeClearance(args, reports)
}

// CLI only when run directly (npx tsx …/springsim.ts); importable from the test.
if (/springsim\.ts$/.test(process.argv[1] ?? '')) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
