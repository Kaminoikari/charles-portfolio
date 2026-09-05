// The one place TypeScript reads a VRM's humanoid map, version and springs.
//
// Until 2026-09-05 rigProbe.ts, springsim.ts and avatarVariants.test.ts each
// reached into `extensions.VRM.humanoid.humanBones` on their own, so a base
// body exported as VRM 1.0 (where the map lives under `VRMC_vrm` as a record
// keyed by bone name, and the body faces +Z instead of -Z) threw "not a VRM
// 0.x model" in whichever file ran first. Every reader now comes through here
// and returns a discriminated result, so a caller that depends on the version
// -- the axis flip in a retarget, the sign of a collider offset -- has to say
// which branch it is on. vrmHumanoid.test.ts greps the rest of the code for
// the inline form.
//
// The GLB container reader lives here too, once instead of twice: rigProbe's
// copy handled chunk padding but not strides or normalized integers, and
// springsim's copy handled strides but not padding.

// ---- glTF container --------------------------------------------------------

export interface GltfNode {
  name?: string
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
  mesh?: number
  skin?: number
}

export interface GltfAccessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  normalized?: boolean
}

export interface GltfBufferView {
  byteOffset?: number
  byteLength: number
  byteStride?: number
}

export interface GltfAnimationSampler {
  input: number
  output: number
  interpolation?: string
}

export interface GltfAnimation {
  channels: { sampler: number; target: { node: number; path: string } }[]
  samplers: GltfAnimationSampler[]
}

// ---- VRM 0.x extension shapes ----------------------------------------------

export interface Vrm0HumanBone {
  bone: string
  node: number
}

export interface Vrm0Collider {
  offset: { x: number; y: number; z: number }
  radius: number
}

export interface Vrm0ColliderGroup {
  node: number
  colliders: Vrm0Collider[]
}

export interface Vrm0BoneGroup {
  comment?: string
  bones?: number[]
  colliderGroups?: number[]
  hitRadius?: number
  gravityPower?: number
  /** The 0.x spec spells it this way. */
  stiffiness?: number
  dragForce?: number
  center?: number
}

export interface Vrm0SecondaryAnimation {
  boneGroups: Vrm0BoneGroup[]
  colliderGroups: Vrm0ColliderGroup[]
}

export interface Vrm0Extension {
  humanoid?: { humanBones?: Vrm0HumanBone[] }
  secondaryAnimation?: Vrm0SecondaryAnimation
  blendShapeMaster?: { blendShapeGroups: { name: string }[] }
}

// ---- VRM 1.0 extension shapes ----------------------------------------------

export interface Vrm1Extension {
  specVersion?: string
  humanoid?: { humanBones?: Record<string, { node: number }> }
  expressions?: {
    preset?: Record<string, unknown>
    custom?: Record<string, unknown>
  }
}

export interface Vrm1Collider {
  node: number
  shape:
    | { sphere: { offset?: number[]; radius?: number } }
    | { capsule: { offset?: number[]; radius?: number; tail?: number[] } }
}

export interface Vrm1SpringJoint {
  node: number
  hitRadius?: number
  stiffness?: number
  gravityPower?: number
  gravityDir?: number[]
  dragForce?: number
}

export interface Vrm1Spring {
  name?: string
  joints: Vrm1SpringJoint[]
  colliderGroups?: number[]
  center?: number
}

export interface Vrm1SpringBone {
  specVersion?: string
  colliders?: Vrm1Collider[]
  colliderGroups?: { name?: string; colliders: number[] }[]
  springs?: Vrm1Spring[]
}

export interface GltfJson {
  extensionsUsed?: string[]
  scene?: number
  scenes?: { nodes: number[] }[]
  nodes: GltfNode[]
  meshes?: { name?: string; primitives: { attributes: Record<string, number>; material?: number }[] }[]
  materials?: { name?: string }[]
  skins?: { joints: number[]; inverseBindMatrices?: number }[]
  accessors?: GltfAccessor[]
  bufferViews?: GltfBufferView[]
  animations?: GltfAnimation[]
  extensions?: {
    VRM?: Vrm0Extension
    VRMC_vrm?: Vrm1Extension
    VRMC_springBone?: Vrm1SpringBone
    /** VRM Animation (.vrma): a record keyed by bone name, like VRM 1.0. */
    VRMC_vrm_animation?: { humanoid: { humanBones: Record<string, { node: number }> } }
  }
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

export interface Glb<T extends GltfJson = GltfJson> {
  json: T
  bin: Uint8Array | null
}

/**
 * Split a GLB into its JSON document and binary chunk.
 *
 * The type parameter only narrows what the caller believes about the JSON --
 * the parse itself cannot check it, which is the same trust `JSON.parse` has
 * always been. Chunks are 4-byte aligned and the padding is not counted in a
 * chunk's `length`; a reader that forgets that walks off the second chunk on
 * any file whose JSON is not a multiple of four bytes long.
 */
export function parseGlb<T extends GltfJson = GltfJson>(data: Uint8Array): Glb<T> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (data.byteLength < 12 || view.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB container')
  let offset = 12
  let json: T | null = null
  let bin: Uint8Array | null = null
  while (offset + 8 <= data.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const body = data.subarray(offset + 8, offset + 8 + length)
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(body)) as T
    if (type === CHUNK_BIN) bin = body
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

const NORMALIZED_DIVISOR: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }

const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
}

/**
 * An accessor as plain numbers, de-strided and de-normalized.
 *
 * JOINTS_0 and WEIGHTS_0 are the accessors that need both: an exporter may
 * interleave them in one bufferView with a stride, and store weights as
 * normalized uint8 or uint16 that mean `value / 255` or `value / 65535`.
 */
export function readAccessorRows(glb: Glb, index: number): { data: Float64Array; ncomp: number } {
  const accessor = glb.json.accessors?.[index]
  const bufferView = accessor && glb.json.bufferViews?.[accessor.bufferView]
  if (!accessor || !bufferView || !glb.bin) throw new Error(`accessor ${index} is unreadable`)
  const Ctor = COMPONENT_ARRAY[accessor.componentType as keyof typeof COMPONENT_ARRAY]
  if (!Ctor) throw new Error(`accessor ${index} has an unsupported component type`)
  const ncomp = TYPE_COMPONENTS[accessor.type]
  if (!ncomp) throw new Error(`accessor ${index} has an unsupported type ${accessor.type}`)
  const start = glb.bin.byteOffset + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const size = Ctor.BYTES_PER_ELEMENT
  const stride = bufferView.byteStride ?? ncomp * size
  const divisor = accessor.normalized ? (NORMALIZED_DIVISOR[accessor.componentType] ?? 1) : 1
  const buffer = glb.bin.buffer as ArrayBuffer
  const out = new Float64Array(accessor.count * ncomp)
  for (let i = 0; i < accessor.count; i++) {
    const row = new Ctor(buffer, start + i * stride, ncomp)
    for (let c = 0; c < ncomp; c++) out[i * ncomp + c] = row[c] / divisor
  }
  return { data: out, ncomp }
}

/** An accessor flattened to Float32, for animation samplers and the like. */
export function readAccessor(glb: Glb, index: number): Float32Array {
  return Float32Array.from(readAccessorRows(glb, index).data)
}

// ---- humanoid ----------------------------------------------------------------

/**
 * The humanoid map with the facts that come bundled with its version.
 *
 * `forwardZ` is the sign of the model's forward axis in its own space: -1 for
 * 0.x (the engine calls rotateVRM0 to turn it round), +1 for 1.0. The two are
 * kept on one object so code that needs the axis has to take the version with
 * it rather than assume.
 */
export type Humanoid =
  | { version: '0'; bones: Readonly<Record<string, number>>; forwardZ: -1 }
  | { version: '1'; bones: Readonly<Record<string, number>>; forwardZ: 1 }

export function readHumanoid(json: GltfJson): Humanoid {
  const ext = json.extensions ?? {}
  if (ext.VRM) {
    const bones: Record<string, number> = {}
    for (const { bone, node } of ext.VRM.humanoid?.humanBones ?? []) bones[bone] = node
    return { version: '0', bones, forwardZ: -1 }
  }
  if (ext.VRMC_vrm) {
    const bones: Record<string, number> = {}
    for (const [bone, entry] of Object.entries(ext.VRMC_vrm.humanoid?.humanBones ?? {})) bones[bone] = entry.node
    return { version: '1', bones, forwardZ: 1 }
  }
  throw new Error('not a VRM: neither extensions.VRM (0.x) nor extensions.VRMC_vrm (1.0) is present')
}

/**
 * The file's expression names in file order: 0.x blendShapeGroups, or 1.0
 * preset keys followed by custom keys. Emotions and lip sync are looked up by
 * these names, and a name that is not there is a silent no-op in the engine,
 * so a file with neither extension throws here rather than answering "none".
 */
export function readExpressions(json: GltfJson): string[] {
  const ext = json.extensions ?? {}
  if (ext.VRM) return (ext.VRM.blendShapeMaster?.blendShapeGroups ?? []).map((g) => g.name)
  if (ext.VRMC_vrm) {
    const expr = ext.VRMC_vrm.expressions ?? {}
    return [...Object.keys(expr.preset ?? {}), ...Object.keys(expr.custom ?? {})]
  }
  throw new Error('not a VRM: neither extensions.VRM (0.x) nor extensions.VRMC_vrm (1.0) is present')
}

/** The humanoid map of a .vrma (VRMC_vrm_animation), which uses VRM 1.0 names. */
export function readAnimationBones(json: GltfJson): Record<string, number> {
  const anim = json.extensions?.VRMC_vrm_animation
  if (!anim) throw new Error('not a VRM Animation file: no VRMC_vrm_animation extension')
  const bones: Record<string, number> = {}
  for (const [bone, entry] of Object.entries(anim.humanoid.humanBones)) bones[bone] = entry.node
  return bones
}

/**
 * The bones a VRM humanoid must declare -- VRMRequiredHumanBoneName in
 * @pixiv/three-vrm-core, 15 names. chest, neck, shoulders, toes and eyes are
 * optional; a body without them still loads.
 */
export const VRM_REQUIRED_BONES = [
  'hips',
  'spine',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
] as const

export function requiredMissing(humanoid: Humanoid): string[] {
  return VRM_REQUIRED_BONES.filter((bone) => !(bone in humanoid.bones))
}

// ---- springs -------------------------------------------------------------------

/**
 * Where the file keeps its spring bones, by version. The two shapes are
 * different enough (0.x: one node per collider group, offsets with z negated;
 * 1.0: colliders with their own nodes and shapes, groups of collider indices)
 * that flattening them here would be one more place for the sign conventions
 * to drift. Consumers that simulate hand either branch to three-vrm's own
 * loader, which knows both.
 */
export type SpringSource =
  | { kind: 'vrm0'; secondaryAnimation: Vrm0SecondaryAnimation }
  | { kind: 'vrm1'; springBone: Vrm1SpringBone }

export function readSprings(json: GltfJson): SpringSource {
  const ext = json.extensions ?? {}
  if (ext.VRM) {
    const secondaryAnimation = ext.VRM.secondaryAnimation ?? { boneGroups: [], colliderGroups: [] }
    return { kind: 'vrm0', secondaryAnimation }
  }
  if (ext.VRMC_vrm) {
    return { kind: 'vrm1', springBone: ext.VRMC_springBone ?? {} }
  }
  throw new Error('not a VRM: neither extensions.VRM (0.x) nor extensions.VRMC_vrm (1.0) is present')
}

// ---- rig identity ---------------------------------------------------------------

/**
 * The rig, as one comparable string: every humanoid bone's rest transform,
 * the transforms of any helper nodes between it and the nearest humanoid bone
 * above it, and which bone that is. Two bodies with the same string pose the
 * same way under every clip, whatever mesh hangs off the bones.
 *
 * The helper nodes are included because a VRoid export can put an unnamed
 * node between two humanoid bones; a translation on one of those moves the
 * bone below it in the world while the bone's own transform stays identical.
 *
 * Computed on the raw document, so a VRM 1.0 body facing +Z is a different
 * rig from its 0.x twin -- correctly, since every clearance number measured
 * against a rig is in world space.
 */
export function rigOf(json: GltfJson): string {
  const parentOf = new Map<number, number>()
  json.nodes.forEach((n, i) => n.children?.forEach((c) => parentOf.set(c, i)))
  const { bones } = readHumanoid(json)
  const boneOfNode = new Map<number, string>()
  for (const [bone, node] of Object.entries(bones)) boneOfNode.set(node, bone)
  const transform = (n: GltfNode) => [n.translation ?? [0, 0, 0], n.rotation ?? [0, 0, 0, 1], n.scale ?? [1, 1, 1]]
  const rows = Object.entries(bones)
    .map(([bone, node]) => {
      const chain = [transform(json.nodes[node])]
      let parentBone: string | null = null
      for (let p = parentOf.get(node); p !== undefined; p = parentOf.get(p)) {
        const above = boneOfNode.get(p)
        if (above) {
          parentBone = above
          break
        }
        chain.push(transform(json.nodes[p]))
      }
      return [bone, chain, parentBone] as const
    })
    .sort((a, b) => a[0].localeCompare(b[0]))
  return JSON.stringify(rows)
}
