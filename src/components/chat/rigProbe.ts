// Where a pose actually puts her hands — answered without a browser.
//
// The gesture library used to be verified by one number: the widest sideways
// reach an arm pose asks for, checked against the canvas width. That check is
// blind to everything that actually went wrong (a fingertip inside her skull, a
// hand that never left her hip, a peace sign whose palm faces away), so every
// fix had to be eyeballed on a screenshot and none of them stayed fixed.
//
// This module builds three-vrm's own VRMHumanoid on the .vrm's glTF node tree
// and runs forward kinematics on it in plain Node. No WebGL, no GLTFLoader, no
// texture decode: the JSON chunk carries the bone hierarchy and rest
// transforms, which is all a pose needs. A full probe of every bundled motion
// runs in well under a second, so the assertions can live in the unit suite
// rather than in a screenshot review.
//
// COORDINATE SPACE. Everything here is in the VRM's own (pre-rotateVRM0) space,
// which is what the engine's bone writes and the VRMA tracks both land in:
//
//   +Y = up
//   ±Z = FORWARD, toward the viewer — and the sign belongs to the VERSION
//   ∓X = her right           ±X = her left — which follows the Z, being its cross
//
// A 0.x file faces -Z, and the engine turns it round with `VRMUtils.rotateVRM0()`,
// which only sets `vrm.scene.rotation.y = π`. A 1.0 file faces +Z already, and
// that same call is a no-op on it: three-vrm gates it on `meta.metaVersion`.
// Either way she ends up facing the camera and every bone-local number below is
// left untouched, so "toward the viewer" here is read off `rig.version` (the
// local `forwardZ`) rather than written as a literal -1. `Humanoid.forwardZ` in
// vrmHumanoid.ts is the same fact for code holding a parsed glTF; `rig.humanoid`
// is three-vrm's VRMHumanoid and has no such field.
//
// Measured on both families rather than assumed, eyes and toes against the head
// bone, and her LEFT eye against the centreline
// (scripts/avatar/evidence/family2-0907-space.ts):
//
//   VRoid 0.x   eyes -29.7mm, toes -87.9mm   -> faces -Z, left eye at x -0.018
//   twist 1.0   eyes +21.4mm, toes +103.0mm  -> faces +Z, left eye at x +0.017
//
// So the sideways axis turns with the forward one and "her right" is not a fixed
// sign either. Nothing here reads it as one: `screenX` derives the mirror from
// the same `forwardZ`, and every joint helper names a side through the humanoid
// map rather than through x.
import * as THREE from 'three'
import { VRMHumanBoneParentMap, VRMHumanoid, type VRMHumanBoneName, type VRMHumanBones } from '@pixiv/three-vrm'

import {
  buildNodes,
  parseGlb,
  readAccessor,
  readAccessorRows,
  readAnimationBones,
  readHumanoid,
  expressionMeshes,
  type Glb,
  type GltfNode,
} from './vrmHumanoid'

const IDENTITY_QUAT = new THREE.Quaternion()

/**
 * The rate the guards walk a clip at, on top of its own keyframes. 60 is the
 * rate the engine's render loop drives the mixer at on a normal display; a
 * clip keyed at 30 draws two frames per key, and the guards have to see both.
 */
export const SAMPLE_HZ = 60

// ---- the rig ---------------------------------------------------------------

// VRM 0.x spells the thumb joints Proximal/Intermediate/Distal; VRM 1.0, every
// .vrma and three-vrm's own bone list spell the same three
// Metacarpal/Proximal/Distal. VRMHumanoidLoaderPlugin renames a 0.x file's on
// import (its thumbBoneNameMap); the rig is built under the 1.0 names the same
// way, so a track never needs renaming and "Proximal" means one joint here.
const THUMB_VRM0_TO_VRM1: Record<string, string> = {
  ThumbProximal: 'ThumbMetacarpal',
  ThumbIntermediate: 'ThumbProximal',
}

function vrm1BoneName(bone: string): string {
  for (const [vrm0, vrm1] of Object.entries(THUMB_VRM0_TO_VRM1)) {
    if (bone.endsWith(vrm0)) return bone.slice(0, bone.length - vrm0.length) + vrm1
  }
  return bone
}

export interface FaceBox {
  min: THREE.Vector3
  max: THREE.Vector3
}

export interface Rig {
  /**
   * three-vrm's normalized bones, keyed by VRM 1.0 name, plus one synthetic
   * `…Tip` per finger. A rotation written here means what the same rotation
   * written on `getNormalizedBoneNode()` means at runtime.
   */
  bones: Record<string, THREE.Object3D>
  /** The normalized rig's root. */
  root: THREE.Object3D
  /** Rest-pose world positions, for reference geometry (face box, framing). */
  restPosition: Record<string, THREE.Vector3>
  /** three-vrm's humanoid; `update()` writes the normalized pose onto the raw nodes. */
  humanoid: VRMHumanoid
  /** Which VRM the file is. Decides whether a .vrma is flipped onto it. */
  version: '0' | '1'
  /** One object per glTF node, at its index: the skeleton the mesh is skinned to. */
  raw: THREE.Object3D[]
  /** The raw scene roots and the normalized root, under one group. */
  scene: THREE.Group
  /** The rest bounding box of the meshes the expressions move, in the file's own space. See deriveFaceBox. */
  faceBox: FaceBox
}

function localMatrix(node: GltfNode): THREE.Matrix4 {
  const m = new THREE.Matrix4()
  if (node.matrix) return m.fromArray(node.matrix)
  return m.compose(
    new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]),
  )
}

/** Rest-pose world matrix per node, memoised up the parent chain. */
function worldMatrices(nodes: GltfNode[]): (index: number) => THREE.Matrix4 {
  const parentOf = new Array<number>(nodes.length).fill(-1)
  nodes.forEach((node, i) => (node.children ?? []).forEach((c) => (parentOf[c] = i)))
  const cache = new Array<THREE.Matrix4 | undefined>(nodes.length)
  const resolve = (i: number): THREE.Matrix4 => {
    const cached = cache[i]
    if (cached) return cached
    const local = localMatrix(nodes[i])
    const world =
      parentOf[i] >= 0 ? new THREE.Matrix4().multiplyMatrices(resolve(parentOf[i]), local) : local
    cache[i] = world
    return world
  }
  return resolve
}

/** Parent index per node, for walking a glTF hierarchy upward. */
function parentIndices(nodes: GltfNode[]): number[] {
  const parentOf = new Array<number>(nodes.length).fill(-1)
  nodes.forEach((node, i) => (node.children ?? []).forEach((c) => (parentOf[c] = i)))
  return parentOf
}

/**
 * three-vrm's own humanoid, built on the file's node tree.
 *
 * `VRMHumanoid` builds its normalized rig from the raw bones exactly as the
 * browser does: one node per humanoid bone, resting at identity rotation with
 * its axes aligned to the world's, parented to the nearest humanoid ancestor,
 * local position the rest-pose world offset. Until 2026-09-06 this file
 * reconstructed that rig by hand and never wrote it back to the raw nodes;
 * springsim.ts and motion.py each carried a third copy. Now the humanoid is
 * the one retarget, and `humanoid.update()` is what puts the pose on the
 * skeleton the mesh is skinned to.
 */
export function buildRigFrom(glb: Glb): Rig {
  const json = glb.json
  const source = readHumanoid(json)
  const { nodes: raw, scene } = buildNodes(json)

  // The loader renames the thumbs for every 0.x file and for a 1.0 file that
  // still carries the old spelling (its `existsPreviousThumbName`).
  const legacyThumbs = Object.keys(source.bones).some((bone) => bone.endsWith('ThumbIntermediate'))
  const humanBones: Record<string, { node: THREE.Object3D }> = {}
  for (const [bone, node] of Object.entries(source.bones)) {
    const name = source.version === '0' || legacyThumbs ? vrm1BoneName(bone) : bone
    // The loader keeps the first entry for a name and warns about the rest.
    if (name in humanBones) continue
    humanBones[name] = { node: raw[node] }
  }
  // VRMHumanBones types the fifteen required bones as present. The loader
  // enforces that before constructing; this probe does not, so that a synthetic
  // partial rig (a test's three-bone body) can still be measured. A body the
  // browser would refuse is caught by the pipeline's own gate, not here.
  const humanoid = new VRMHumanoid(humanBones as unknown as VRMHumanBones)
  const root = humanoid.normalizedHumanBonesRoot
  scene.add(root)

  const bones: Record<string, THREE.Object3D> = {}
  const restPosition: Record<string, THREE.Vector3> = {}
  for (const name of Object.keys(humanBones)) {
    const normalized = humanoid.getNormalizedBoneNode(name as VRMHumanBoneName)
    // A name outside three-vrm's bone list gets no normalized node, as at runtime.
    if (!normalized) continue
    bones[name] = normalized
    restPosition[name] = humanBones[name].node.getWorldPosition(new THREE.Vector3())
  }

  // Fingertips. A distal finger bone is NOT where the finger ends: the mesh is
  // skinned out to an `_end` leaf past it, 20.4mm on this model's right index
  // and 21.0mm on its middle, almost entirely along the finger's own axis. Every
  // wide pose in the pool peaks at a distal joint, so measuring there reads
  // ~20mm narrower than what is drawn — enough to pass a clip that is visibly
  // clipped. These carry no humanoid bone name, so they hang off the normalized
  // distal by the same rule as everything else: local position is the rest-pose
  // world offset from the parent, rest rotation identity.
  for (const name of Object.keys(bones)) {
    if (!name.endsWith('Distal')) continue
    const child = humanBones[name].node.children[0]
    if (!child) continue
    const at = child.getWorldPosition(new THREE.Vector3())
    const tip = new THREE.Object3D()
    tip.position.copy(at).sub(restPosition[name])
    bones[name].add(tip)
    const tipName = `${name.slice(0, -'Distal'.length)}Tip`
    bones[tipName] = tip
    restPosition[tipName] = at
  }
  root.updateMatrixWorld(true)

  const headNode = source.bones.head
  if (headNode === undefined) throw new Error('the humanoid map has no head')
  const faceBox = deriveFaceBox(glb, raw, headNode)

  return { bones, root, restPosition, humanoid, version: source.version, raw, scene, faceBox }
}

export function buildRig(vrmData: Uint8Array): Rig {
  return buildRigFrom(parseGlb(vrmData))
}

/** Every normalized bone back at identity, hips at their rest position. */
function restNormalized(rig: Rig): void {
  for (const bone of Object.values(rig.bones)) {
    bone.quaternion.identity()
    bone.rotation.set(0, 0, 0)
  }
  const hips = rig.bones.hips
  if (hips) hips.position.copy(rig.restPosition.hips)
}

/** Normalized pose → raw nodes → world matrices, in the order three-vrm does it. */
function sync(rig: Rig): void {
  rig.root.updateMatrixWorld(true)
  rig.humanoid.update()
  rig.scene.updateMatrixWorld(true)
}

export function resetRig(rig: Rig): void {
  restNormalized(rig)
  sync(rig)
}

// ---- the mesh around the bones ------------------------------------------------

interface SkinnedVertex {
  /** Rest position in the file's own space. */
  p: THREE.Vector3
  /** The glTF node the vertex is mostly skinned to. */
  node: number
}

const _skinned = new THREE.Vector3()

/**
 * Vertices of the skinned meshes the caller accepts, each with its dominant
 * joint, at their rest-pose position.
 *
 * By mesh INDEX, never by mesh name. Until 2026-09-07 the three callers here
 * passed `/^Face/`, `/^Body/` and `/./`, and the first two are facts about a
 * VRoid export: the Seed-san fixture draws `hair`, `hair_tail`, `head`,
 * `robo_arm` and `wear`, so both selected nothing and the face box could not be
 * derived at all. What each caller actually wants is derivable — the face is
 * what the expressions move, and hand skin is what a finger bone drives — so
 * the selection is theirs to make and this generator only asks.
 *
 * Skinned the way the mesh is drawn: each vertex is the weighted sum of
 * `jointWorld · inverseBind · v` over its joints, and the mesh node's own
 * transform is ignored (glTF 2.0 §5.28: a node with a skin MUST ignore it).
 * On the shipped bodies that comes out as `v` itself, since every mesh node
 * is a scene root at identity and the inverse binds are the inverses of the
 * rest globals; on a body whose joints are turned or scaled it comes out
 * turned or scaled with them. springsim's `Skinner` does the same sum per
 * frame. Primitives that share one vertex buffer are decoded once.
 */
function* skinnedVertices(
  glb: Glb,
  raw: THREE.Object3D[],
  accept: (meshIndex: number) => boolean,
): Generator<SkinnedVertex> {
  const json = glb.json
  for (const node of json.nodes) {
    if (node.mesh === undefined || node.skin === undefined) continue
    if (!accept(node.mesh)) continue
    const mesh = json.meshes?.[node.mesh]
    if (!mesh) continue
    const skin = json.skins?.[node.skin]
    if (!skin) continue
    const ibm = skin.inverseBindMatrices === undefined ? null : readAccessorRows(glb, skin.inverseBindMatrices).data
    const jointMatrix = skin.joints.map((joint, k) => {
      const m = raw[joint].matrixWorld.clone()
      // No inverse bind matrices means identity ones (glTF 2.0 §5.28).
      if (ibm) m.multiply(new THREE.Matrix4().fromArray(ibm, k * 16))
      return m
    })
    const seen = new Set<string>()
    for (const prim of mesh.primitives) {
      const { POSITION, JOINTS_0, WEIGHTS_0 } = prim.attributes
      if (POSITION === undefined || JOINTS_0 === undefined || WEIGHTS_0 === undefined) continue
      const key = `${POSITION}/${JOINTS_0}/${WEIGHTS_0}`
      if (seen.has(key)) continue
      seen.add(key)
      const pos = readAccessorRows(glb, POSITION)
      const jo = readAccessorRows(glb, JOINTS_0)
      const we = readAccessorRows(glb, WEIGHTS_0)
      const count = pos.data.length / pos.ncomp
      for (let v = 0; v < count; v++) {
        const rest = new THREE.Vector3(pos.data[v * pos.ncomp], pos.data[v * pos.ncomp + 1], pos.data[v * pos.ncomp + 2])
        const p = new THREE.Vector3()
        let best = 0
        for (let k = 0; k < we.ncomp; k++) {
          const w = we.data[v * we.ncomp + k]
          if (w <= 0) continue
          if (w > we.data[v * we.ncomp + best]) best = k
          p.addScaledVector(_skinned.copy(rest).applyMatrix4(jointMatrix[jo.data[v * jo.ncomp + k]]), w)
        }
        yield { p, node: skin.joints[jo.data[v * jo.ncomp + best]] }
      }
    }
  }
}

/**
 * The face's rest bounding box: the vertices of the meshes the expressions
 * move that are mostly skinned to the head, in the file's own space.
 *
 * The face, not the hair: the hair is skinned to the head too and reaches 0.1m
 * higher, and a box that took it in would let a hand hover above her crown and
 * call it a hit. Head-dominant only: the neck rows at the bottom of the mesh
 * are skinned to the neck and are not her face.
 *
 * `expressionMeshes` rather than a mesh named `Face…`, since 2026-09-07. A
 * blink moves eyelids and an `aa` moves a jaw; neither is ever bound to a hair
 * strand, so the meshes the expressions bind to ARE the face on any file that
 * has expressions, whatever its author called them. The name test was true of
 * a VRoid export and of nothing else — the Seed-san fixture calls its face
 * `head` and could not be measured at all. On the shipped body the two select
 * the same single mesh (`Face.baked`), which is why this changed no number.
 *
 * Measured 2026-08-19 by hand on the shipped body as x ±0.092, y 1.287–1.503,
 * z -0.113–0.033 against a head bone at (0, 1.320, 0.005); rigProbe.test.ts
 * holds the derivation to those numbers within 2mm.
 */
export function deriveFaceBox(glb: Glb, raw: THREE.Object3D[], headNode: number): FaceBox {
  const faces = expressionMeshes(glb.json)
  const box = new THREE.Box3()
  let count = 0
  for (const { p, node } of skinnedVertices(glb, raw, (m) => faces.has(m))) {
    if (node !== headNode) continue
    box.expandByPoint(p)
    count += 1
  }
  if (count === 0) {
    throw new Error(
      faces.size === 0
        ? 'this file declares no expression morph target binds, so the face mesh cannot be identified and the face box cannot be derived'
        : 'no vertex of the expression-driven meshes is skinned to the head: the face box cannot be derived',
    )
  }
  return { min: box.min, max: box.max }
}

const OUTER_PHALANX = /(Index|Middle|Ring|Little)(Intermediate|Distal)$|Thumb(Proximal|Distal)$/

/** The joint a finger segment runs to, in three-vrm's spelling; the Tip past a distal. */
function nextFingerJoint(bone: string): string | null {
  if (bone.endsWith('Distal')) return `${bone.slice(0, -'Distal'.length)}Tip`
  if (bone.endsWith('Intermediate')) return `${bone.slice(0, -'Intermediate'.length)}Distal`
  if (bone.endsWith('ThumbProximal')) return `${bone.slice(0, -'Proximal'.length)}Distal`
  if (bone.endsWith('ThumbMetacarpal')) return `${bone.slice(0, -'Metacarpal'.length)}Proximal`
  if (bone.endsWith('Proximal')) return `${bone.slice(0, -'Proximal'.length)}Intermediate`
  return null
}

/**
 * How far the skin of the two outer finger joints sits from their bone, in
 * metres: the largest distance from any Body vertex mostly skinned to an
 * outer phalanx to that phalanx's own segment (joint to next joint, or to the
 * fingertip). This is what `SKIN_ABOVE_JOINT` was read off a screenshot for;
 * the mesh gives it directly. The base joints and the thumb's metacarpal are
 * left out on purpose: the vertices they own reach into the palm.
 */
export function deriveFingerSkinRadius(glb: Glb, rig: Rig): number {
  const boneOfNode = new Map<number, string>()
  for (const name of Object.keys(rig.bones)) {
    if (name.endsWith('Tip')) continue
    const node = rig.humanoid.getRawBoneNode(name as VRMHumanBoneName)
    if (node) boneOfNode.set(rig.raw.indexOf(node), name)
  }
  const segment = new THREE.Line3()
  const closest = new THREE.Vector3()
  let worst = 0
  // Every mesh: the OUTER_PHALANX test below already says what hand skin is,
  // and no body skins a hair strand to a finger's distal joint. The old /^Body/
  // narrowing was a VRoid mesh name, and on this body it selects the same
  // vertices (verified: the derived radius is unchanged to the micrometre).
  for (const { p, node } of skinnedVertices(glb, rig.raw, () => true)) {
    const bone = boneOfNode.get(node)
    if (!bone || !OUTER_PHALANX.test(bone)) continue
    const next = nextFingerJoint(bone)
    const to = next === null ? undefined : rig.restPosition[next]
    if (!to) continue
    segment.set(rig.restPosition[bone], to)
    // A zero-length segment would make closestPointToPoint divide 0 by 0 and
    // poison the maximum with NaN.
    if (segment.distanceSq() === 0) continue
    segment.closestPointToPoint(p, true, closest)
    worst = Math.max(worst, closest.distanceTo(p))
  }
  return worst
}

/**
 * The topmost vertex of anything this body draws, in bind pose: hair,
 * ornaments, face, whichever is highest. The base a clip's crown throw is
 * measured from (clearance.ts crownOn): the spring solver reads the same
 * quantity on the simulated body (springsim.ts restCrownY), and what carries
 * over to a sibling body is the throw above it.
 *
 * Every skinned mesh, not the hair by name: a tiara in the hair mesh or an
 * ahoge in its own is the crown when it is highest, and the browser counts
 * whatever is drawn.
 */
export function deriveRestCrown(glb: Glb, rig: Rig): number {
  resetRig(rig)
  let top = -Infinity
  for (const { p } of skinnedVertices(glb, rig.raw, () => true)) top = Math.max(top, p.y)
  if (!Number.isFinite(top)) throw new Error('no skinned mesh: the resting crown cannot be derived')
  return top
}

// ---- VRM Animation ---------------------------------------------------------

interface Track {
  times: Float32Array
  values: Float32Array
}

export interface Motion {
  /**
   * Humanoid bone name to its animated channels. VRM 1.0 spelling, which is
   * the clip's own and the one VRMHumanoid keys every rig by.
   */
  rotation: Record<string, Track>
  hipsTranslation: Track | null
  duration: number
  /** The animation rig's own hips height, for scaling the hips translation. */
  restHipsY: number
  /**
   * When the guards sample the clip: every keyframe time, plus a 60 Hz walk,
   * deduplicated and sorted. Not a fixed count — at 60fps a clip carries
   * 450–700 keys and a fixed 120 samples steps over 5 frames at a time, long
   * enough to miss a fingertip passing through her face.
   *
   * The 60 Hz walk is there because the keys alone are NOT dense enough
   * everywhere: half the pack is keyed at 30fps (34ms gaps, idleLoop 42ms),
   * and the engine draws the frames in between. Measured 2026-09-06
   * (evidence/clearance-0906-probe-face.ts): on the keys alone the dance's
   * deepest fingertip reads 0.3004 at t=8.233s, and one drawn frame earlier,
   * at 8.217s, it is 0.1975. Nine of the ten clips are unchanged to four
   * decimals; the dance is the one that moves, and it is the one with a
   * waiver. Sampling the keys only left that waiver declaring a third less
   * penetration than the clip actually reaches.
   */
  sampleTimes: number[]
}

/**
 * Read a .vrma into per-bone tracks.
 *
 * The tracks are REBASED into the animation rig's rest frame on the way in,
 * exactly as `VRMAnimationLoaderPlugin._parseAnimation` does:
 *
 *   q_out = q_parentRestWorld · q_raw · (q_boneRestWorld)⁻¹
 *
 * That reduces to `q_raw` only when every humanoid node in the .vrma rests at
 * an identity world rotation, which is true of some exporters and false of
 * others. `modelPose.vrma` has 35 of its 52 humanoid bones resting on a
 * non-identity rotation (its hips alone are a ~120° axis permutation), and
 * skipping this step posed her folded in half with her feet above her head —
 * a pose that sailed through all five guards because it happened to be narrow.
 * Reading the raw values and calling it "what the runtime plays" was the single
 * most dangerous thing this file could get wrong, since every assertion built
 * on it would still be green.
 *
 * The hips translation gets the same treatment through the hips' parent world
 * matrix. `applyMotion` then does the VRM0 axis flip, which is the later stage
 * (`createVRMAnimationClip`) and has to stay after this one.
 */
export function buildMotion(vrmaData: Uint8Array): Motion {
  const glb = parseGlb(vrmaData)
  const animation = glb.json.animations?.[0]
  if (!animation) throw new Error('not a VRM Animation file')
  const humanBones = readAnimationBones(glb.json)

  const nodes = glb.json.nodes
  const parentOf = parentIndices(nodes)
  const worldMatrix = worldMatrices(nodes)

  // Rest world rotation per humanoid bone, plus the hips' parent, keyed by the
  // animation's own (VRM 1.0) bone names — the same map the plugin builds.
  const restWorld = new Map<string, THREE.Quaternion>()
  const scratchV = new THREE.Vector3()
  const hipsParentMatrix = new THREE.Matrix4()
  for (const [bone, node] of Object.entries(humanBones)) {
    const q = new THREE.Quaternion()
    worldMatrix(node).decompose(scratchV, q, new THREE.Vector3())
    restWorld.set(bone, q)
    if (bone === 'hips') {
      const parent = parentOf[node]
      if (parent >= 0) hipsParentMatrix.copy(worldMatrix(parent))
      const pq = new THREE.Quaternion()
      hipsParentMatrix.decompose(scratchV, pq, new THREE.Vector3())
      restWorld.set('hipsParent', pq)
    }
  }
  // Walk up VRMHumanBoneParentMap until a bone this animation actually carries
  // is found, exactly as the plugin does; falling back to the hips' parent.
  const restParentOf = (bone: string): THREE.Quaternion => {
    let parent = VRMHumanBoneParentMap[bone as VRMHumanBoneName] as string | null
    while (parent != null && !restWorld.has(parent)) {
      parent = VRMHumanBoneParentMap[parent as VRMHumanBoneName] as string | null
    }
    return restWorld.get(parent ?? 'hipsParent') ?? IDENTITY_QUAT
  }

  const rotation: Record<string, Track> = {}
  let hipsTranslation: Track | null = null
  let duration = 0
  const boneOfNode = new Map<number, string>()
  for (const [bone, node] of Object.entries(humanBones)) boneOfNode.set(node, bone)

  for (const channel of animation.channels) {
    const bone = boneOfNode.get(channel.target.node)
    if (!bone) continue
    const sampler = animation.samplers[channel.sampler]
    const times = readAccessor(glb, sampler.input)
    const values = readAccessor(glb, sampler.output)
    duration = Math.max(duration, times[times.length - 1] ?? 0)
    if (channel.target.path === 'rotation') {
      const boneInverse = (restWorld.get(bone) ?? IDENTITY_QUAT).clone().invert()
      const parentRest = restParentOf(bone)
      const rebased = new Float32Array(values.length)
      const q = new THREE.Quaternion()
      for (let i = 0; i < values.length; i += 4) {
        q.set(values[i], values[i + 1], values[i + 2], values[i + 3])
          .premultiply(parentRest)
          .multiply(boneInverse)
        rebased[i] = q.x
        rebased[i + 1] = q.y
        rebased[i + 2] = q.z
        rebased[i + 3] = q.w
      }
      rotation[bone] = { times, values: rebased }
    }
    if (channel.target.path === 'translation' && bone === 'hips') {
      const rebased = new Float32Array(values.length)
      const v = new THREE.Vector3()
      for (let i = 0; i < values.length; i += 3) {
        v.set(values[i], values[i + 1], values[i + 2]).applyMatrix4(hipsParentMatrix)
        rebased[i] = v.x
        rebased[i + 1] = v.y
        rebased[i + 2] = v.z
      }
      hipsTranslation = { times, values: rebased }
    }
  }

  // The animation rig's rest hips height. It has to be the hips node's full
  // WORLD position, the same thing VRMAnimationLoaderPlugin reads, because the
  // hips translation track is an absolute position in that rig's space: the
  // ratio between the two rest heights is what rescales a tall dancer's motion
  // onto a shorter model. An earlier draft summed the local translations up the
  // parent chain instead, which ignores every ancestor rotation, understated
  // this rig's height, and blew the motion up until her head travelled half a
  // metre forward.
  const hipsNode: number | undefined = humanBones.hips
  const restHipsY =
    hipsNode === undefined
      ? 0
      : new THREE.Vector3().setFromMatrixPosition(worldMatrices(glb.json.nodes)(hipsNode)).y

  const timeSet = new Set<number>()
  for (const track of Object.values(rotation)) for (const t of track.times) timeSet.add(t)
  if (hipsTranslation) for (const t of hipsTranslation.times) timeSet.add(t)
  // Rounded, so a 60 Hz step that lands on a key does not become a second
  // sample a float apart from it.
  for (let k = 0; k / SAMPLE_HZ <= duration; k++) timeSet.add(Math.round((k / SAMPLE_HZ) * 1e6) / 1e6)
  const sampleTimes = [...timeSet].sort((a, b) => a - b)

  return { rotation, hipsTranslation, duration, restHipsY, sampleTimes }
}

function sampleIndex(times: Float32Array, time: number): { i: number; j: number; f: number } {
  let i = 0
  while (i < times.length - 1 && times[i + 1] < time) i++
  const j = Math.min(i + 1, times.length - 1)
  const span = times[j] - times[i]
  const f = span > 0 ? Math.min(1, Math.max(0, (time - times[i]) / span)) : 0
  return { i, j, f }
}

const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()

/**
 * Pose the rig from a motion at `time`, normalized bones and raw nodes both.
 *
 * The VRM0 conversion mirrors what `@pixiv/three-vrm-animation` does when it
 * builds a clip for a metaVersion "0" model: negate x and z of every rotation
 * quaternion and of the hips translation. Without it a VRM1-authored motion
 * plays back mirrored front-to-back on a VRM0 model, which is the single most
 * expensive mistake available here — it looks almost right. A 1.0 body already
 * faces the clip's way and is left alone, as the runtime leaves it; until
 * 2026-09-06 the flip here was unconditional.
 */
export function applyMotion(rig: Rig, motion: Motion, time: number): void {
  restNormalized(rig)
  const flip = rig.version === '0' ? -1 : 1
  for (const [bone, track] of Object.entries(motion.rotation)) {
    const target = rig.bones[bone]
    if (!target) continue
    const { i, j, f } = sampleIndex(track.times, time)
    _qa.set(track.values[i * 4], track.values[i * 4 + 1], track.values[i * 4 + 2], track.values[i * 4 + 3])
    _qb.set(track.values[j * 4], track.values[j * 4 + 1], track.values[j * 4 + 2], track.values[j * 4 + 3])
    _qa.slerp(_qb, f)
    target.quaternion.set(flip * _qa.x, _qa.y, flip * _qa.z, _qa.w)
  }
  const hips = rig.bones.hips
  if (motion.hipsTranslation && hips) {
    const track = motion.hipsTranslation
    const { i, j, f } = sampleIndex(track.times, time)
    const lerp = (k: number): number =>
      track.values[i * 3 + k] + (track.values[j * 3 + k] - track.values[i * 3 + k]) * f
    // Scale by the hips-height ratio so a tall rig's motion does not lift a
    // short model off the floor. Same normalisation three-vrm-animation applies.
    const scale = motion.restHipsY > 0 ? rig.restPosition.hips.y / motion.restHipsY : 1
    hips.position.set(flip * lerp(0) * scale, lerp(1) * scale, flip * lerp(2) * scale)
  }
  sync(rig)
}

// ---- measurements ----------------------------------------------------------

/**
 * The sign of her forward axis, which belongs to the version and not to this
 * module: see COORDINATE SPACE at the top of the file. `rig.humanoid` is
 * three-vrm's VRMHumanoid and carries no such field — reading one off it gives
 * `undefined`, which THREE.Vector3's default parameter turns into a silent zero.
 */
function forwardZ(rig: Rig): -1 | 1 {
  return rig.version === '0' ? -1 : 1
}

/** Toward the viewer, in the space described at the top of this file. */
function cameraDir(rig: Rig): THREE.Vector3 {
  return new THREE.Vector3(0, 0, forwardZ(rig))
}

export interface HandProbe {
  wrist: THREE.Vector3
  fingertip: THREE.Vector3
  /** 1 = palm square to the viewer, -1 = back of the hand to the viewer. */
  palmToViewer: number
  /** Degrees, 0 = arm straight. A human elbow flexes to roughly 150°. */
  elbowFlex: number
}

const _q = new THREE.Quaternion()
// A VRM's rest pose is a T-pose with the palms down, so the palm normal is -Y
// and the fingers run along ∓X in each hand's own frame.
const PALM_REST = new THREE.Vector3(0, -1, 0)

function worldPosition(rig: Rig, bone: string): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixPosition(rig.bones[bone].matrixWorld)
}

/**
 * Where a probe-space x lands on screen.
 *
 * `rotateVRM0` turns a 0.x body to face the camera, which mirrors her sideways
 * axis: facing you, her right hand is on your left. So a point at probe x = +0.5
 * (half a metre to HER right) renders half a metre to the viewer's LEFT. A 1.0
 * body faces the camera unrotated, so its x is already the viewer's x. Anything
 * that reasons about a screen EDGE has to go through this, because the two edges
 * are cropped differently: the column canvas overhangs the viewport on the
 * viewer's right, which on a 0.x body is negative x here.
 *
 * Until 2026-09-07 this had no guard at all: every caller read both edges
 * against the same budget, so the mirror cancelled and reversing the sign
 * reddened nothing. It is load-bearing now, because the frame guard compares
 * the two edges it measures against the left and right the producer wrote into
 * the clearance file, and those are not interchangeable. Mutation F7 reverses
 * it and turns 20 tests red -- both branches swap, so both families mirror,
 * and every clip of each disagrees with its own file. Counted rather than
 * guessed: evidence/family2-0907-reach-counts.log.
 */
export function screenX(rig: Rig, probeX: number): number {
  return forwardZ(rig) === -1 ? -probeX : probeX
}

// Joints per finger, in three-vrm's (VRM 1.0) spelling: the thumb's base is
// its metacarpal and it has no intermediate joint.
const FINGER_JOINTS: Record<string, readonly string[]> = {
  Thumb: ['Metacarpal', 'Proximal', 'Distal'],
  Index: ['Proximal', 'Intermediate', 'Distal'],
  Middle: ['Proximal', 'Intermediate', 'Distal'],
  Ring: ['Proximal', 'Intermediate', 'Distal'],
  Little: ['Proximal', 'Intermediate', 'Distal'],
}

/**
 * How far her SKIN reaches past the last bone, in metres.
 *
 * Every number this module returns is a joint position, and a joint is not an
 * edge: the hand is drawn around its bones, so the rendered silhouette clears
 * the outermost joint by a margin no amount of forward kinematics can see. The
 * frame has to reserve that margin, and it is measured rather than guessed.
 *
 * Measured on 2026-08-20 against the launcher canvas (280px tall, 253.5 px/m)
 * with `stretch` held at its peak, where the highest joint in the pose is a
 * thumb tip at 1.7971 and the topmost rendered pixel of her hand sits 12mm
 * above it. That 12mm is why raising the frame to clear 1.7971 alone still
 * rendered a cut hand.
 *
 * Re-measure it if the model is replaced. Skin thickness is a property of THIS
 * mesh over THIS skeleton and does not travel with the animation library.
 * `deriveFingerSkinRadius` reads the mesh's own number (18mm on this body,
 * the radius of the outer phalanges' skin) and measure-motions prints the two
 * side by side; the frame keeps reserving this constant until a per-clip skin
 * top replaces it.
 */
export const SKIN_ABOVE_JOINT = 0.012

/**
 * Every joint of one hand: the wrist and all fifteen finger joints.
 *
 * Sampling the wrist and the index fingertip alone is not enough, and that is
 * measured rather than assumed. `shoot` passes an index-only face check at 1.19
 * and fails a whole-hand one at 0.90: its THUMB is what crosses her cheek. The
 * same widening moves modelPose's rightward reach from 0.269 to 0.286, because
 * its little finger is outside its index.
 *
 * Each finger contributes four points, not three: the skinned tip past the
 * distal joint is included, because that is where the finger is drawn to.
 */
export function handJoints(rig: Rig, side: 'left' | 'right'): THREE.Vector3[] {
  const out = [worldPosition(rig, `${side}Hand`)]
  for (const [finger, joints] of Object.entries(FINGER_JOINTS)) {
    // `Tip` is the skinned end of the finger, past the distal joint. See buildRigFrom.
    for (const segment of [...joints, 'Tip']) {
      const bone = `${side}${finger}${segment}`
      if (bone in rig.bones) out.push(worldPosition(rig, bone))
    }
  }
  return out
}

/**
 * Every joint that can define her horizontal silhouette. The arm chain is here
 * because a raised elbow or a shoulder can be the outermost point in a pose
 * where the hands are held in, and the legs because a wide stance can be.
 */
export function silhouetteJoints(rig: Rig): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (const side of ['left', 'right'] as const) {
    for (const bone of [
      `${side}Shoulder`,
      `${side}UpperArm`,
      `${side}LowerArm`,
      `${side}UpperLeg`,
      `${side}LowerLeg`,
    ]) {
      if (bone in rig.bones) out.push(worldPosition(rig, bone))
    }
    out.push(...handJoints(rig, side))
  }
  out.push(worldPosition(rig, 'head'))
  return out
}

export function probeHand(rig: Rig, side: 'left' | 'right'): HandProbe {
  const shoulder = worldPosition(rig, `${side}UpperArm`)
  const elbow = worldPosition(rig, `${side}LowerArm`)
  const wrist = worldPosition(rig, `${side}Hand`)
  // The skinned end of the index finger when the model has one, which every
  // VRoid export does; the distal joint is 20mm short of it.
  const fingertip = worldPosition(
    rig,
    `${side}IndexTip` in rig.bones ? `${side}IndexTip` : `${side}IndexDistal`,
  )

  const toShoulder = new THREE.Vector3().subVectors(shoulder, elbow).normalize()
  const toWrist = new THREE.Vector3().subVectors(wrist, elbow).normalize()
  const elbowFlex =
    180 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(toShoulder.dot(toWrist), -1, 1)))

  _q.setFromRotationMatrix(rig.bones[`${side}Hand`].matrixWorld)
  const palm = PALM_REST.clone().applyQuaternion(_q)

  return { wrist, fingertip, palmToViewer: palm.dot(cameraDir(rig)), elbowFlex }
}

// ---- her head, as a solid ---------------------------------------------------
//
// The check that matters most is a fingertip ending up inside her face, so the
// volume it tests against has to be the real one. This is the face mesh's own
// bind-pose bounding box, read out of the .vrm rather than estimated: an early
// draft guessed a 0.115m sphere and rejected the `shoot` clip over 1.4mm.
//
// It lives in the HEAD BONE's local frame, not in world space. A motion that
// tips her head forward moves her face out from under a world-space volume and
// would let a hand pass straight through it with the test still green.
export interface HeadVolume {
  /** Ellipsoid centre, in head-bone local coordinates. */
  centre: THREE.Vector3
  /** Semi-axes, in head-bone local coordinates. */
  radii: THREE.Vector3
}

// The box is the rig's own `faceBox`, derived from the expression-driven meshes by
// deriveFaceBox (on the shipped body: x ±0.092, y 1.287–1.503, z -0.113–0.033
// against a head bone resting at (0, 1.320, 0.005)). An ellipsoid inscribed in
// that box is smaller than the box everywhere off the three axes, so a
// fingertip inside it is inside her face, never merely near it.
export function headVolume(rig: Rig): HeadVolume {
  const head = rig.restPosition.head
  const centre = new THREE.Vector3()
    .addVectors(rig.faceBox.min, rig.faceBox.max)
    .multiplyScalar(0.5)
    .sub(head)
  const radii = new THREE.Vector3().subVectors(rig.faceBox.max, rig.faceBox.min).multiplyScalar(0.5)
  return { centre, radii }
}

const _local = new THREE.Vector3()
const _inverse = new THREE.Matrix4()

/**
 * How deep a world-space point sits inside her face.
 *
 * Returns the ellipsoid equation's value: below 1 is inside, 1 is on the
 * surface, above 1 is clear. Scale-free, so one threshold reads the same for
 * every model.
 */
export function headPenetration(rig: Rig, volume: HeadVolume, point: THREE.Vector3): number {
  _inverse.copy(rig.bones.head.matrixWorld).invert()
  _local.copy(point).applyMatrix4(_inverse).sub(volume.centre)
  return (
    (_local.x / volume.radii.x) ** 2 +
    (_local.y / volume.radii.y) ** 2 +
    (_local.z / volume.radii.z) ** 2
  )
}
