// Where a pose actually puts her hands — answered without a browser.
//
// The gesture library used to be verified by one number: the widest sideways
// reach an arm pose asks for, checked against the canvas width. That check is
// blind to everything that actually went wrong (a fingertip inside her skull, a
// hand that never left her hip, a peace sign whose palm faces away), so every
// fix had to be eyeballed on a screenshot and none of them stayed fixed.
//
// This module rebuilds three-vrm's NORMALIZED humanoid rig straight out of the
// shipped .vrm's glTF JSON chunk and runs forward kinematics on it in plain
// Node. No WebGL, no GLTFLoader, no texture decode: the JSON chunk carries the
// bone hierarchy and rest transforms, which is all a pose needs. A full probe
// of every bundled motion runs in well under a second, so the assertions can
// live in the unit suite rather than in a screenshot review.
//
// COORDINATE SPACE. Everything here is in the VRM's own (pre-rotateVRM0) space,
// which is what the engine's bone writes and the VRMA tracks both land in:
//
//   +X = her right          -X = her left
//   +Y = up
//   -Z = FORWARD, toward the viewer
//
// The engine calls `VRMUtils.rotateVRM0()`, which only sets `vrm.scene.rotation.y
// = π`. That turns the whole rig to face the camera at render time and leaves
// every bone-local number below untouched, so "palm toward the viewer" is a palm
// normal pointing at -Z here. (Measured, not assumed: this model's eyes sit at
// z=-0.0246 and its toes at z=-0.0828, both in front of the head bone at
// z=+0.005.)
import * as THREE from 'three'
import { VRMHumanBoneParentMap, type VRMHumanBoneName } from '@pixiv/three-vrm'

const IDENTITY_QUAT = new THREE.Quaternion()

// ---- glTF container --------------------------------------------------------

interface GltfNode {
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}

interface GltfAccessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
}

interface GltfBufferView {
  byteOffset?: number
  byteLength: number
}

interface GltfAnimationSampler {
  input: number
  output: number
  interpolation?: string
}

interface GltfAnimation {
  channels: { sampler: number; target: { node: number; path: string } }[]
  samplers: GltfAnimationSampler[]
}

interface GltfJson {
  nodes: GltfNode[]
  accessors?: GltfAccessor[]
  bufferViews?: GltfBufferView[]
  animations?: GltfAnimation[]
  extensions?: {
    // VRM 0.x: the humanoid map is a list of {bone, node} pairs.
    VRM?: { humanoid: { humanBones: { bone: string; node: number }[] } }
    // VRM Animation (VRM 1.0 lineage): a record keyed by bone name.
    VRMC_vrm_animation?: { humanoid: { humanBones: Record<string, { node: number }> } }
  }
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

interface Glb {
  json: GltfJson
  bin: Uint8Array | null
}

function parseGlb(data: Uint8Array): Glb {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB container')
  let offset = 12
  let json: GltfJson | null = null
  let bin: Uint8Array | null = null
  while (offset + 8 <= data.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const body = data.subarray(offset + 8, offset + 8 + length)
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(body)) as GltfJson
    if (type === CHUNK_BIN) bin = body
    // Chunks are 4-byte aligned; the padding is not counted in `length`.
    offset += 8 + length + ((4 - (length % 4)) % 4)
  }
  if (!json) throw new Error('GLB has no JSON chunk')
  return { json, bin }
}

const COMPONENT_ARRAY = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
} as const

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
}

function readAccessor(glb: Glb, index: number): Float32Array {
  const accessor = glb.json.accessors?.[index]
  const bufferView = accessor && glb.json.bufferViews?.[accessor.bufferView]
  if (!accessor || !bufferView || !glb.bin) throw new Error(`accessor ${index} is unreadable`)
  const Ctor = COMPONENT_ARRAY[accessor.componentType as keyof typeof COMPONENT_ARRAY]
  if (!Ctor) throw new Error(`accessor ${index} has an unsupported component type`)
  const start =
    glb.bin.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const count = accessor.count * TYPE_COMPONENTS[accessor.type]
  const buffer = glb.bin.buffer as ArrayBuffer
  const raw = new Ctor(buffer, start, count)
  return raw instanceof Float32Array ? raw : Float32Array.from(raw)
}

// ---- the rig ---------------------------------------------------------------

// VRM 0.x names the thumb joints Proximal/Intermediate/Distal; VRM 1.0 (and so
// every .vrma) names the same three Metacarpal/Proximal/Distal. Mapping the
// animation's names onto the model's is what three-vrm's humanoid does
// internally; the probe has to do it too or a thumb track lands on nothing.
const THUMB_VRM1_TO_VRM0: Record<string, string> = {
  ThumbMetacarpal: 'ThumbProximal',
  ThumbProximal: 'ThumbIntermediate',
  ThumbDistal: 'ThumbDistal',
}

function toModelBoneName(name: string): string {
  for (const [vrm1, vrm0] of Object.entries(THUMB_VRM1_TO_VRM0)) {
    if (name.endsWith(vrm1)) return name.slice(0, name.length - vrm1.length) + vrm0
  }
  return name
}

export interface Rig {
  /** One Object3D per humanoid bone, parented as three-vrm's normalized rig is. */
  bones: Record<string, THREE.Object3D>
  root: THREE.Object3D
  /** Rest-pose world positions, for reference geometry (head sphere, framing). */
  restPosition: Record<string, THREE.Vector3>
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
 * Rebuild the normalized humanoid rig of a .vrm.
 *
 * three-vrm's normalized rig is a parallel skeleton whose bones rest at identity
 * rotation with their axes aligned to the world's, one node per humanoid bone,
 * parented to the nearest humanoid ancestor. That makes each normalized bone's
 * local position the rest-pose world offset from its humanoid parent, which is
 * exactly what this reconstructs — so a rotation written here means what the
 * same rotation written on `getNormalizedBoneNode()` means at runtime.
 */
export function buildRig(vrmData: Uint8Array): Rig {
  const glb = parseGlb(vrmData)
  const humanBones = glb.json.extensions?.VRM?.humanoid.humanBones
  if (!humanBones) throw new Error('not a VRM 0.x model: no VRM.humanoid extension')

  const nodes = glb.json.nodes
  const parentOf = parentIndices(nodes)
  const worldMatrix = worldMatrices(nodes)

  const nodeOfBone: Record<string, number> = {}
  for (const { bone, node } of humanBones) nodeOfBone[bone] = node

  const restPosition: Record<string, THREE.Vector3> = {}
  for (const [bone, node] of Object.entries(nodeOfBone)) {
    restPosition[bone] = new THREE.Vector3().setFromMatrixPosition(worldMatrix(node))
  }

  const boneOfNode = new Map<number, string>()
  for (const [bone, node] of Object.entries(nodeOfBone)) boneOfNode.set(node, bone)
  const humanoidParent: Record<string, string | null> = {}
  for (const [bone, node] of Object.entries(nodeOfBone)) {
    let walk = parentOf[node]
    let found: string | null = null
    while (walk >= 0) {
      const hit = boneOfNode.get(walk)
      if (hit) {
        found = hit
        break
      }
      walk = parentOf[walk]
    }
    humanoidParent[bone] = found
  }

  const bones: Record<string, THREE.Object3D> = {}
  for (const bone of Object.keys(nodeOfBone)) bones[bone] = new THREE.Object3D()
  const root = new THREE.Object3D()
  for (const bone of Object.keys(nodeOfBone)) {
    const parent = humanoidParent[bone]
    const base = parent ? restPosition[parent] : new THREE.Vector3()
    bones[bone].position.copy(restPosition[bone]).sub(base)
    ;(parent ? bones[parent] : root).add(bones[bone])
  }

  return { bones, root, restPosition }
}

export function resetRig(rig: Rig): void {
  for (const bone of Object.values(rig.bones)) {
    bone.quaternion.identity()
    bone.rotation.set(0, 0, 0)
  }
  const hips = rig.bones.hips
  if (hips) hips.position.copy(rig.restPosition.hips)
  rig.root.updateMatrixWorld(true)
}

// ---- VRM Animation ---------------------------------------------------------

interface Track {
  times: Float32Array
  values: Float32Array
}

export interface Motion {
  /** Humanoid bone name (in THIS model's naming) to its animated channels. */
  rotation: Record<string, Track>
  hipsTranslation: Track | null
  duration: number
  /** The animation rig's own hips height, for scaling the hips translation. */
  restHipsY: number
  /**
   * Every keyframe time in the clip, deduplicated and sorted. Guards sample
   * these rather than a fixed count: at 60fps a clip carries 450–700 keys, and
   * a fixed 120 samples steps over 5 frames at a time — long enough to miss a
   * fingertip passing through her face.
   */
  sampleTimes: number[]
}

/**
 * Read a .vrma into per-bone tracks, already renamed onto this model's bones.
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
  const humanBones = glb.json.extensions?.VRMC_vrm_animation?.humanoid.humanBones
  const animation = glb.json.animations?.[0]
  if (!humanBones || !animation) throw new Error('not a VRM Animation file')

  const nodes = glb.json.nodes
  const parentOf = parentIndices(nodes)
  const worldMatrix = worldMatrices(nodes)

  // Rest world rotation per humanoid bone, plus the hips' parent, keyed by the
  // animation's own (VRM 1.0) bone names — the same map the plugin builds.
  const restWorld = new Map<string, THREE.Quaternion>()
  const scratchV = new THREE.Vector3()
  const hipsParentMatrix = new THREE.Matrix4()
  for (const [bone, entry] of Object.entries(humanBones)) {
    const q = new THREE.Quaternion()
    worldMatrix(entry.node).decompose(scratchV, q, new THREE.Vector3())
    restWorld.set(bone, q)
    if (bone === 'hips') {
      const parent = parentOf[entry.node]
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
  for (const [bone, { node }] of Object.entries(humanBones)) boneOfNode.set(node, bone)

  for (const channel of animation.channels) {
    const sourceBone = boneOfNode.get(channel.target.node)
    if (!sourceBone) continue
    const bone = toModelBoneName(sourceBone)
    const sampler = animation.samplers[channel.sampler]
    const times = readAccessor(glb, sampler.input)
    const values = readAccessor(glb, sampler.output)
    duration = Math.max(duration, times[times.length - 1] ?? 0)
    if (channel.target.path === 'rotation') {
      const boneInverse = (restWorld.get(sourceBone) ?? IDENTITY_QUAT).clone().invert()
      const parentRest = restParentOf(sourceBone)
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
  const hipsNode = humanBones.hips?.node
  const restHipsY =
    hipsNode === undefined
      ? 0
      : new THREE.Vector3().setFromMatrixPosition(worldMatrices(glb.json.nodes)(hipsNode)).y

  const timeSet = new Set<number>()
  for (const track of Object.values(rotation)) for (const t of track.times) timeSet.add(t)
  if (hipsTranslation) for (const t of hipsTranslation.times) timeSet.add(t)
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
 * Pose the rig from a motion at `time`.
 *
 * The VRM0 conversion mirrors what `@pixiv/three-vrm-animation` does when it
 * builds a clip for a metaVersion "0" model: negate x and z of every rotation
 * quaternion and of the hips translation. Without it a VRM1-authored motion
 * plays back mirrored front-to-back on a VRM0 model, which is the single most
 * expensive mistake available here — it looks almost right.
 */
export function applyMotion(rig: Rig, motion: Motion, time: number): void {
  resetRig(rig)
  for (const [bone, track] of Object.entries(motion.rotation)) {
    const target = rig.bones[bone]
    if (!target) continue
    const { i, j, f } = sampleIndex(track.times, time)
    _qa.set(track.values[i * 4], track.values[i * 4 + 1], track.values[i * 4 + 2], track.values[i * 4 + 3])
    _qb.set(track.values[j * 4], track.values[j * 4 + 1], track.values[j * 4 + 2], track.values[j * 4 + 3])
    _qa.slerp(_qb, f)
    target.quaternion.set(-_qa.x, _qa.y, -_qa.z, _qa.w)
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
    hips.position.set(-lerp(0) * scale, lerp(1) * scale, -lerp(2) * scale)
  }
  rig.root.updateMatrixWorld(true)
}

// ---- measurements ----------------------------------------------------------

/** Toward the viewer, in the space described at the top of this file. */
export const CAMERA_DIR = new THREE.Vector3(0, 0, -1)

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
 * `rotateVRM0` turns her to face the camera, which mirrors her sideways axis:
 * facing you, her right hand is on your left. So a point at probe x = +0.5 (half
 * a metre to HER right) renders half a metre to the viewer's LEFT. Anything that
 * reasons about a screen EDGE has to go through this, because the two edges are
 * cropped differently: the column canvas overhangs the viewport on the viewer's
 * right, which is her left, which is negative x here.
 */
export function screenX(probeX: number): number {
  return -probeX
}

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'] as const
const SEGMENTS = ['Proximal', 'Intermediate', 'Distal'] as const

/**
 * Every joint of one hand: the wrist and all fifteen finger joints.
 *
 * Sampling the wrist and the index fingertip alone is not enough, and that is
 * measured rather than assumed. `shoot` passes an index-only face check at 1.19
 * and fails a whole-hand one at 0.90: its THUMB is what crosses her cheek. The
 * same widening moves modelPose's rightward reach from 0.269 to 0.286, because
 * its little finger is outside its index.
 */
export function handJoints(rig: Rig, side: 'left' | 'right'): THREE.Vector3[] {
  const out = [worldPosition(rig, `${side}Hand`)]
  for (const finger of FINGERS) {
    for (const segment of SEGMENTS) {
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
  const fingertip = worldPosition(rig, `${side}IndexDistal`)

  const toShoulder = new THREE.Vector3().subVectors(shoulder, elbow).normalize()
  const toWrist = new THREE.Vector3().subVectors(wrist, elbow).normalize()
  const elbowFlex =
    180 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(toShoulder.dot(toWrist), -1, 1)))

  _q.setFromRotationMatrix(rig.bones[`${side}Hand`].matrixWorld)
  const palm = PALM_REST.clone().applyQuaternion(_q)

  return { wrist, fingertip, palmToViewer: palm.dot(CAMERA_DIR), elbowFlex }
}

// ---- her head, as a solid ---------------------------------------------------
//
// The check that matters most is a fingertip ending up inside her face, so the
// volume it tests against has to be the real one. This is the Face mesh's own
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

// Face.baked bounding box, measured 2026-08-19: x ±0.092, y 1.287–1.503,
// z -0.113–0.033, against a head bone resting at (0, 1.320, 0.005). An
// ellipsoid inscribed in that box is smaller than the box everywhere off the
// three axes, so a fingertip inside it is inside her face, never merely near it.
const FACE_BOX = {
  min: new THREE.Vector3(-0.092, 1.287, -0.113),
  max: new THREE.Vector3(0.092, 1.503, 0.033),
}

export function headVolume(rig: Rig): HeadVolume {
  const head = rig.restPosition.head
  const centre = new THREE.Vector3()
    .addVectors(FACE_BOX.min, FACE_BOX.max)
    .multiplyScalar(0.5)
    .sub(head)
  const radii = new THREE.Vector3().subVectors(FACE_BOX.max, FACE_BOX.min).multiplyScalar(0.5)
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
