import * as THREE from 'three'

/**
 * A coat that bells out over her hips swallows her hands whenever a clip puts
 * them there: milfy's hoodie hangs up to 19cm outside her body, and every clip
 * she wears puts a hand more than COAT_HAND_DEPTH into it somewhere (owner,
 * 2026-10-03: "the hands go through the coat"). Turning her arms out of the
 * way was tried and refused: the clips have to play exactly as captured, and
 * hands on her hips have to stay on her hips (owner, 2026-10-03).
 *
 * So the coat gives way to the hands. Wherever a hand is inside the coat, the
 * coat there is drawn in toward her, along the line out from her hips' upright
 * axis, to just inside the hand, and eases back to its own shape around it: a
 * hand on her hip presses the coat to her hip. The hand is a set of spheres
 * strung along its bones (handSpheres), and the same arithmetic runs on the
 * CPU (dentPoint, measured by coatDent.test.ts) and in the coat's vertex
 * shader (COAT_DENT_GLSL), after skinning, in world space.
 *
 * Only the body the coat was measured on is dented, by file: any other body
 * keeps every vertex where its skin puts it.
 */
export interface CoatDent {
  /** The body's file, as avatarVariants lists it. */
  url: string
  /** The coat's material: its vertices skinned mostly to her trunk give way. */
  material: string
}

export const COAT_DENTS: readonly CoatDent[] = [{ url: '/avatar/mika-milfy-13.vrm', material: 'Mellow_Outer' }]

/** The coat this body wears that gives way to her hands, or null. */
export function coatDentOf(url: string | null): CoatDent | null {
  return COAT_DENTS.find((c) => c.url === url) ?? null
}

/**
 * How deep a hand may stay inside the coat, in metres (rigProbe.handInGarment).
 * Not 0: a hand's mesh is not its spheres, and a knuckle or fingertip past them
 * may still touch the cloth.
 */
export const COAT_HAND_DEPTH = 0.02

/**
 * How far inside a hand sphere's near side the coat is drawn (`margin`), over
 * how much of the hand's surroundings it eases back to its own shape
 * (`falloff`), and how thick the cloth drawn in stays (`layers`), in metres.
 *
 * The coat is drawn in by up to 20cm. Over a 5cm falloff that tore its edge
 * into spikes, and drawing every vertex to the same depth laid its outside
 * and its lining on one surface, where the lining showed through in shards
 * (rendered on akimbo, 2026-10-03). So a vertex farther out stays farther out,
 * the whole depth beyond the hand pressed into `layers`.
 */
export const COAT_DENT = { margin: 0.004, falloff: 0.1, layers: 0.01, side: [0, 0.7], gap: 0.004 } as const

/**
 * How far off what she wears a resting hand stays when the coat gives way
 * under it (handRest.ts): room for the coat, pressed to COAT_DENT.gap off her
 * and COAT_DENT.layers thick, and 10mm more for where a finger's spheres sit
 * off its skin. Resting on her skirt, the coat had nowhere to go but over
 * her hand; with room for the coat alone it still cut across her fingers
 * (rendered on akimbo, 2026-10-04).
 */
export const COAT_UNDER_HAND = COAT_DENT.gap + COAT_DENT.layers + 0.01

/**
 * A vertex skinned mostly to one of these is a sleeve: it moves with the arm
 * and never gives way. Same rule as rigProbe.garmentTriangles.
 */
export const SLEEVE_BONE = /^(left|right)(Shoulder|UpperArm|LowerArm|Hand|Thumb|Index|Middle|Ring|Little)/

const FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const

/** Spheres per hand, in the order handSpheres writes them. */
export const HAND_SPHERE_COUNT = 3 + 2 + 2 + 2 + FINGERS.length * 4 + 4

/** Both hands' spheres (handSpheres). */
export const COAT_DENT_SPHERES = 2 * HAND_SPHERE_COUNT

/** Radii, in metres: across the palm, at its two edges, and along a finger and the thumb. */
export const HAND_RADIUS = { palm: 0.03, edge: 0.02, heel: 0.025, wrist: 0.02, finger: 0.018, thumb: 0.016 } as const

/** How far either side of the wrist joint the wrist's two spheres sit, across the hand. */
const WRIST_SIDE = 0.03

/**
 * Both hands as spheres (xyz centre, w radius), from where `bone` puts each
 * humanoid bone in the world: three along the palm from the wrist to the
 * middle finger's root, one at each of its edges, two over the heel of the
 * hand toward the thumb, one either side of the wrist, then four along each finger
 * and the thumb, the last one past the end joint by most of the joint before.
 * A bone the body lacks leaves its spheres at radius 0.
 */
export function handSpheres(bone: (name: string) => THREE.Vector3 | null, out: THREE.Vector4[]): THREE.Vector4[] {
  let i = 0
  const put = (p: THREE.Vector3 | null, r: number) => {
    const s = (out[i++] ??= new THREE.Vector4())
    if (p) s.set(p.x, p.y, p.z, r)
    else s.set(0, 0, 0, 0)
  }
  const mid = new THREE.Vector3()
  const tip = new THREE.Vector3()
  for (const side of ['left', 'right'] as const) {
    const hand = bone(`${side}Hand`)
    const middle = bone(`${side}MiddleProximal`)
    for (const f of [0, 0.5, 1]) put(hand && middle ? mid.lerpVectors(hand, middle, f) : null, HAND_RADIUS.palm)
    put(bone(`${side}IndexProximal`), HAND_RADIUS.edge)
    put(bone(`${side}LittleProximal`), HAND_RADIUS.edge)
    // The heel of the hand, out to the thumb: on milfy up to 19mm past the
    // spheres above (measured at rest, 2026-10-03).
    const thumb = bone(`${side}ThumbMetacarpal`)
    const thumb2 = bone(`${side}ThumbProximal`)
    put(hand && thumb ? mid.lerpVectors(hand, thumb, 0.5) : null, HAND_RADIUS.heel)
    put(thumb && thumb2 ? mid.lerpVectors(thumb, thumb2, 0.5) : null, HAND_RADIUS.heel)
    // Either edge of the wrist, out across the hand toward the little finger
    // and the index finger: the wrist's mesh reaches 45mm off its joint there.
    for (const edge of [`${side}LittleProximal`, `${side}IndexProximal`]) {
      const e = bone(edge)
      if (hand && middle && e) {
        const axis = mid.copy(middle).sub(hand).normalize()
        const across = tip.copy(e).sub(hand)
        across.addScaledVector(axis, -across.dot(axis)).normalize().multiplyScalar(WRIST_SIDE).add(hand)
        put(across, HAND_RADIUS.wrist)
      } else put(null, HAND_RADIUS.wrist)
    }
    const chain = (names: string[], r: number) => {
      const joints = names.map((n) => bone(`${side}${n}`))
      for (const j of joints) put(j, r)
      const [a, b] = joints.slice(-2)
      put(a && b ? tip.copy(b).sub(a).multiplyScalar(0.8).add(b) : null, r)
    }
    for (const f of FINGERS) chain([`${f}Proximal`, `${f}Intermediate`, `${f}Distal`], HAND_RADIUS.finger)
    chain(['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'], HAND_RADIUS.thumb)
  }
  return out
}

/**
 * Where the coat's point `p` goes with the hands at `spheres`, both in world
 * space; `hips` is any point on her hips' upright axis. Moves `p` in place.
 *
 * Along the level line out from the axis through `p`, each sphere ahead of the
 * axis asks for the point to sit no farther out from the axis than the
 * sphere's near side less COAT_DENT.margin. Off the sphere's own line that is
 * as far out as the hand is, never the hand's shadow on the point's line: on
 * a slant that falls short of her, and drew the back of the coat in through
 * her skirt in akimbo. The ask holds fully where the line passes through the sphere and
 * less and less out to COAT_DENT.falloff beyond it, or twice as far as the
 * point is drawn in if that is farther: a coat that bells 20cm out cannot be
 * pressed to her hip in less without folding (a 20cm draw over 10cm pulled
 * the hem out into a spike in dance). Only the coat on the hand's side gives
 * way, by the cosine between the point's line and the hand's (COAT_DENT.side):
 * unbounded, hands at her sides drew in the whole back of the coat in akimbo.
 * The depth beyond the hand is pressed into COAT_DENT.layers so the cloth
 * keeps its order. Away from the hand it is not drawn in past `floor`, how
 * far out from the axis what she wears under the coat is now (coatFloors),
 * plus COAT_DENT.gap: unbounded, the back of the coat went in through her
 * skirt in akimbo, which flares out past her hands there. In line with the
 * hand the hand decides: the floor is one corner of a skirt that swings and
 * turns, and held the coat 50mm outside a hand nothing she wore lay under in
 * macarena. It comes in from the sphere's edge over the sphere's radius or
 * twice its lift, whichever is wider (over the radius alone an 11cm lift
 * folded the hem into a spike in dance). The deepest ask wins. A point already
 * inside that stays where it is.
 *
 * `hold` (0 to 1) is how far her hands rest on her (handRest.ts, the clip's
 * weight): resting, they lie outside what she wears, so nothing she wears is
 * under them to give way and the floor holds everywhere, in line with a hand
 * too. Without it the coat went in under her resting wrists, heels and
 * thumbs, and her skirt showed through it round her hands in akimbo
 * (rendered 2026-10-04).
 */
export function dentPoint(p: THREE.Vector3, hips: THREE.Vector3, spheres: readonly THREE.Vector4[], floor = 0, hold = 0): THREE.Vector3 {
  const least = floor > 0 ? floor + COAT_DENT.gap : -Infinity
  const dx = p.x - hips.x
  const dz = p.z - hips.z
  const r = Math.hypot(dx, dz)
  if (r < 1e-6) return p
  const ux = dx / r
  const uz = dz / r
  let to = r
  for (const s of spheres) {
    if (s.w <= 0) continue
    const cx = s.x - hips.x
    const cz = s.z - hips.z
    const along = cx * ux + cz * uz
    if (along <= 0) continue
    const sx = cx - along * ux
    const sz = cz - along * uz
    const sy = s.y - p.y
    const off2 = sx * sx + sy * sy + sz * sz
    const off = Math.sqrt(off2)
    const reach = Math.hypot(cx, cz)
    const hand = reach - Math.sqrt(Math.max(s.w * s.w - off2, 0)) - COAT_DENT.margin
    const lift = Math.max(0, least - hand)
    const near = hand + lift * THREE.MathUtils.smoothstep(off, s.w, s.w + Math.max(s.w, 2 * lift))
    if (r <= near) continue
    const pressed = near + COAT_DENT.layers * (1 - Math.exp(-(r - near) / COAT_DENT.layers))
    const facing = along / reach
    const w =
      (1 - THREE.MathUtils.smoothstep(off, s.w, s.w + Math.max(COAT_DENT.falloff, 2 * (r - near)))) *
      THREE.MathUtils.smoothstep(facing, COAT_DENT.side[0], COAT_DENT.side[1])
    to = Math.min(to, r + w * (pressed - r))
  }
  if (hold > 0) to += hold * (Math.max(to, Math.min(r, least)) - to)
  const k = Math.max(to, 0) / r
  p.x = hips.x + dx * k
  p.z = hips.z + dz * k
  return p
}

/** Height of a band and the number of sectors round her a triangle is filed under in coatFloors. */
const FLOOR_BAND = 0.01
const FLOOR_SECTORS = 64

/**
 * What she wears under the coat, per coat vertex: along the level line from
 * her hips' upright axis out to the vertex, the outermost crossing of `under`,
 * given as the corner of the crossed triangle nearest the crossing (-1 where
 * nothing is crossed), and the crossing itself into `crossings` (xyz per coat
 * vertex). Found once, at rest, both in one space; `coat` and
 * `under.positions` are xyz runs, `under.triangles` three indices each. Posed,
 * the crossing carried by that corner's skin is the floor (dentPoint): it
 * moves with what she wears, which a distance taken at rest does not
 * (macarena's skirt sat up to 58mm inside where it rests).
 */
export function coatFloors(
  coat: ArrayLike<number>,
  under: { positions: ArrayLike<number>; triangles: ArrayLike<number> },
  hips: THREE.Vector3,
  crossings?: Float32Array,
): Int32Array {
  const pos = under.positions
  const tri = under.triangles
  const sector = (x: number, z: number) =>
    Math.floor(((Math.atan2(z - hips.z, x - hips.x) / (2 * Math.PI)) + 1) * FLOOR_SECTORS) % FLOOR_SECTORS
  const buckets = new Map<number, number[]>()
  for (let t = 0; t < tri.length / 3; t++) {
    let lo = Infinity
    let hi = -Infinity
    const sectors: number[] = []
    for (let k = 0; k < 3; k++) {
      const v = tri[t * 3 + k] * 3
      lo = Math.min(lo, pos[v + 1])
      hi = Math.max(hi, pos[v + 1])
      sectors.push(sector(pos[v], pos[v + 2]))
    }
    // The shorter way round between the triangle's three sectors.
    sectors.sort((a, b) => a - b)
    const gaps = [sectors[1] - sectors[0], sectors[2] - sectors[1], sectors[0] + FLOOR_SECTORS - sectors[2]]
    const widest = gaps.indexOf(Math.max(...gaps))
    const from = sectors[(widest + 1) % 3]
    const span = FLOOR_SECTORS - gaps[widest]
    for (let b = Math.floor(lo / FLOOR_BAND); b <= Math.floor(hi / FLOOR_BAND); b++) {
      for (let k = 0; k <= span; k++) {
        const key = b * FLOOR_SECTORS + ((from + k) % FLOOR_SECTORS)
        const list = buckets.get(key)
        if (list) list.push(t)
        else buckets.set(key, [t])
      }
    }
  }
  const floors = new Int32Array(coat.length / 3).fill(-1)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const hit = new THREE.Vector3()
  const ray = new THREE.Ray()
  for (let i = 0; i < floors.length; i++) {
    const x = coat[i * 3]
    const y = coat[i * 3 + 1]
    const z = coat[i * 3 + 2]
    const r = Math.hypot(x - hips.x, z - hips.z)
    if (r < 1e-6) continue
    ray.origin.set(hips.x, y, hips.z)
    ray.direction.set((x - hips.x) / r, 0, (z - hips.z) / r)
    let out = 0
    for (const t of buckets.get(Math.floor(y / FLOOR_BAND) * FLOOR_SECTORS + sector(x, z)) ?? []) {
      a.fromArray(pos as number[], tri[t * 3] * 3)
      b.fromArray(pos as number[], tri[t * 3 + 1] * 3)
      c.fromArray(pos as number[], tri[t * 3 + 2] * 3)
      if (!ray.intersectTriangle(a, b, c, false, hit)) continue
      const d = hit.distanceTo(ray.origin)
      if (d >= r || d <= out) continue
      out = d
      const corners = [a, b, c].map((v) => v.distanceTo(hit))
      floors[i] = tri[t * 3 + corners.indexOf(Math.min(...corners))]
      crossings?.set([hit.x, hit.y, hit.z], i * 3)
    }
  }
  return floors
}

/**
 * dentPoint in GLSL, line for line, for MToon's vertex shader: it runs on
 * `transformed` right after `#include <skinning_vertex>`, scaled by the
 * vertex's `coatDentable` (1 on the coat, 0 on a sleeve or a mesh the patch
 * never gave the attribute to).
 */
export const COAT_DENT_GLSL = /* glsl */ `
attribute float coatDentable;
attribute vec3 coatDentFloorAt;
attribute vec4 coatDentFloorIndex;
attribute vec4 coatDentFloorWeight;
uniform vec3 coatDentHips;
uniform float coatDentHold;
uniform vec4 coatDentSpheres[${COAT_DENT_SPHERES}];
// The floor's corner (coatFloors) skinned as its own mesh skins it: same
// skeleton, its own bind-space position and weights. 0 where there is none.
float coatDentFloor() {
  if (coatDentFloorWeight.x + coatDentFloorWeight.y + coatDentFloorWeight.z + coatDentFloorWeight.w <= 0.0) return 0.0;
  vec4 at = vec4(coatDentFloorAt, 1.0);
  vec4 skinned = getBoneMatrix(coatDentFloorIndex.x) * at * coatDentFloorWeight.x
    + getBoneMatrix(coatDentFloorIndex.y) * at * coatDentFloorWeight.y
    + getBoneMatrix(coatDentFloorIndex.z) * at * coatDentFloorWeight.z
    + getBoneMatrix(coatDentFloorIndex.w) * at * coatDentFloorWeight.w;
  vec4 world = modelMatrix * (bindMatrixInverse * skinned);
  return length(world.xz - coatDentHips.xz);
}
vec3 coatDentPoint(vec3 p) {
  float floorAt = coatDentFloor();
  float least = floorAt > 0.0 ? floorAt + ${COAT_DENT.gap.toFixed(6)} : -1e9;
  float dx = p.x - coatDentHips.x;
  float dz = p.z - coatDentHips.z;
  float r = length(vec2(dx, dz));
  if (r < 1e-6) return p;
  float ux = dx / r;
  float uz = dz / r;
  float to = r;
  for (int i = 0; i < ${COAT_DENT_SPHERES}; i++) {
    vec4 s = coatDentSpheres[i];
    if (s.w <= 0.0) continue;
    float cx = s.x - coatDentHips.x;
    float cz = s.z - coatDentHips.z;
    float along = cx * ux + cz * uz;
    if (along <= 0.0) continue;
    float sx = cx - along * ux;
    float sz = cz - along * uz;
    float sy = s.y - p.y;
    float off2 = sx * sx + sy * sy + sz * sz;
    float off = sqrt(off2);
    float reach = length(vec2(cx, cz));
    float hand = reach - sqrt(max(s.w * s.w - off2, 0.0)) - ${COAT_DENT.margin.toFixed(6)};
    float lift = max(0.0, least - hand);
    float near = hand + lift * smoothstep(s.w, s.w + max(s.w, 2.0 * lift), off);
    if (r <= near) continue;
    float pressed = near + ${COAT_DENT.layers.toFixed(6)} * (1.0 - exp(-(r - near) / ${COAT_DENT.layers.toFixed(6)}));
    float facing = along / reach;
    float w =
      (1.0 - smoothstep(s.w, s.w + max(${COAT_DENT.falloff.toFixed(6)}, 2.0 * (r - near)), off)) *
      smoothstep(${COAT_DENT.side[0].toFixed(6)}, ${COAT_DENT.side[1].toFixed(6)}, facing);
    to = min(to, r + w * (pressed - r));
  }
  if (coatDentHold > 0.0) to += coatDentHold * (max(to, min(r, least)) - to);
  float k = max(to, 0.0) / r;
  return vec3(coatDentHips.x + dx * k, p.y, coatDentHips.z + dz * k);
}
`

/** The line in MToon's vertex shader after which `transformed` holds the skinned position. */
export const MTOON_SKINNED = '#include <skinning_vertex>'

const COAT_DENT_APPLY = `
  if (coatDentable > 0.0) {
    vec4 coatDentWorld = modelMatrix * vec4(transformed, 1.0);
    coatDentWorld.xyz = mix(coatDentWorld.xyz, coatDentPoint(coatDentWorld.xyz), coatDentable);
    transformed = (inverse(modelMatrix) * coatDentWorld).xyz;
  }
`

/** The uniforms every patched material reads: write `.value` each frame. */
export interface CoatDentUniforms {
  coatDentHips: { value: THREE.Vector3 }
  coatDentSpheres: { value: THREE.Vector4[] }
  /** How far her hands rest on her, 0 to 1 (dentPoint `hold`). */
  coatDentHold: { value: number }
}

export function coatDentUniforms(): CoatDentUniforms {
  return {
    coatDentHips: { value: new THREE.Vector3() },
    // Radius 0 everywhere: nothing dents until the first frame writes them.
    coatDentSpheres: { value: Array.from({ length: COAT_DENT_SPHERES }, () => new THREE.Vector4()) },
    coatDentHold: { value: 0 },
  }
}

/**
 * Give the coat named `coat.material` (and its MToon outline, which three-vrm
 * names "<material> (Outline)") to her hands: every mesh drawn with it gets a
 * `coatDentable` attribute, 0 on a vertex whose heaviest bone is a sleeve
 * bone, and the corner of what she wears under it that is its floor
 * (coatFloors, found on everything else she wears but her hair, as she
 * stands now: call it at rest, with `hips` her hips in the world), as that
 * corner's bind-space position, bones and weights; its materials dent by
 * `uniforms`. `humanName` names
 * the humanoid bone a skeleton bone is, if any.
 */
export function dentCoat(
  scene: THREE.Object3D,
  coat: CoatDent,
  uniforms: CoatDentUniforms,
  humanName: (bone: THREE.Object3D) => string | null,
  hips: THREE.Vector3,
): number {
  const names = new Set([coat.material, `${coat.material} (Outline)`])
  scene.updateMatrixWorld(true)
  const sleeves = (mesh: THREE.SkinnedMesh): Uint8Array => {
    const index = mesh.geometry.getAttribute('skinIndex')
    const weight = mesh.geometry.getAttribute('skinWeight')
    const out = new Uint8Array(index.count)
    for (let i = 0; i < index.count; i++) {
      let best = 0
      for (let k = 1; k < 4; k++) if (weight.getComponent(i, k) > weight.getComponent(i, best)) best = k
      const name = humanName(mesh.skeleton.bones[index.getComponent(i, best)])
      out[i] = name && SLEEVE_BONE.test(name) ? 1 : 0
    }
    return out
  }
  const atRest = (mesh: THREE.SkinnedMesh): Float32Array => {
    const count = mesh.geometry.getAttribute('position').count
    const out = new Float32Array(count * 3)
    const v = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld)
      out[i * 3] = v.x
      out[i * 3 + 1] = v.y
      out[i * 3 + 2] = v.z
    }
    return out
  }
  const coats: THREE.SkinnedMesh[] = []
  const underPositions: number[] = []
  // From where atRest puts each of them back to the space its skin starts from.
  const underToBind: THREE.Matrix4[] = []
  const underTriangles: number[] = []
  // Per under vertex, what skinning it again needs: bind-space position, and
  // its four bones and weights.
  const underBind: number[] = []
  const underBones: (THREE.Bone | null)[] = []
  const underWeights: number[] = []
  const v = new THREE.Vector3()
  scene.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh
    if (!mesh.isSkinnedMesh) return
    const mats = [mesh.material].flat()
    if (mats.some((m) => names.has(m.name))) coats.push(mesh)
    const sleeve = sleeves(mesh)
    const base = underPositions.length / 3
    for (const x of atRest(mesh)) underPositions.push(x)
    const toBind = mesh.bindMatrix.clone().multiply(mesh.matrixWorld.clone().invert())
    for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) underToBind.push(toBind)
    const position = mesh.geometry.getAttribute('position')
    const skinIndex = mesh.geometry.getAttribute('skinIndex')
    const skinWeight = mesh.geometry.getAttribute('skinWeight')
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix)
      underBind.push(v.x, v.y, v.z)
      let sum = 0
      for (let k = 0; k < 4; k++) sum += skinWeight.getComponent(i, k)
      for (let k = 0; k < 4; k++) {
        underBones.push(mesh.skeleton.bones[skinIndex.getComponent(i, k)] ?? null)
        underWeights.push(sum > 0 ? skinWeight.getComponent(i, k) / sum : 0)
      }
    }
    const index = mesh.geometry.index
    const count = index ? index.count : mesh.geometry.getAttribute('position').count
    const groups = mesh.geometry.groups.length > 0 ? mesh.geometry.groups : [{ start: 0, count, materialIndex: 0 }]
    for (const g of groups) {
      const m = Array.isArray(mesh.material) ? mesh.material[g.materialIndex ?? 0] : mesh.material
      if (!m || names.has(m.name) || /Hair/i.test(m.name)) continue
      for (let t = g.start; t + 2 < Math.min(g.start + g.count, count); t += 3) {
        const corners = [0, 1, 2].map((k) => (index ? index.getX(t + k) : t + k))
        if (corners.some((v) => sleeve[v])) continue
        for (const v of corners) underTriangles.push(base + v)
      }
    }
  })
  const under = { positions: underPositions, triangles: underTriangles }
  const patched = new Set<THREE.Material>()
  for (const mesh of coats) {
    const sleeve = sleeves(mesh)
    mesh.geometry.setAttribute('coatDentable', new THREE.BufferAttribute(Float32Array.from(sleeve, (s) => 1 - s), 1))
    const crossings = new Float32Array(mesh.geometry.getAttribute('position').count * 3)
    const floors = coatFloors(atRest(mesh), under, hips, crossings)
    const at = new Float32Array(floors.length * 3)
    const index = new Float32Array(floors.length * 4)
    const weight = new Float32Array(floors.length * 4)
    floors.forEach((f, i) => {
      if (f < 0) return
      // The crossing itself, carried by its corner's skin: the corner alone
      // sat up to 20mm off the crossing on her skirt's wide triangles.
      const off = new THREE.Vector3().fromArray(crossings, i * 3).sub(new THREE.Vector3().fromArray(underPositions, f * 3))
      off.applyMatrix3(new THREE.Matrix3().setFromMatrix4(underToBind[f]))
      for (let k = 0; k < 3; k++) at[i * 3 + k] = underBind[f * 3 + k] + off.getComponent(k)
      for (let k = 0; k < 4; k++) {
        // The same skeleton serves every mesh once combineSkeletons has run;
        // a bone this mesh's skeleton lacks gives up its weight.
        const b = underBones[f * 4 + k]
        const j = b ? mesh.skeleton.bones.indexOf(b) : -1
        index[i * 4 + k] = Math.max(j, 0)
        weight[i * 4 + k] = j >= 0 ? underWeights[f * 4 + k] : 0
      }
    })
    mesh.geometry.setAttribute('coatDentFloorAt', new THREE.BufferAttribute(at, 3))
    mesh.geometry.setAttribute('coatDentFloorIndex', new THREE.BufferAttribute(index, 4))
    mesh.geometry.setAttribute('coatDentFloorWeight', new THREE.BufferAttribute(weight, 4))
    for (const m of [mesh.material].flat()) if (names.has(m.name)) patched.add(m)
  }
  for (const m of patched) patchMaterial(m, uniforms)
  return coats.length
}

function patchMaterial(m: THREE.Material, uniforms: CoatDentUniforms): void {
  const compile = m.onBeforeCompile.bind(m)
  const key = m.customProgramCacheKey.bind(m)
  m.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer)
    if (!shader.vertexShader.includes(MTOON_SKINNED)) throw new Error(`coatDent: ${m.name} has no ${MTOON_SKINNED}`)
    shader.uniforms.coatDentHips = uniforms.coatDentHips
    shader.uniforms.coatDentHold = uniforms.coatDentHold
    shader.uniforms.coatDentSpheres = uniforms.coatDentSpheres
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${COAT_DENT_GLSL}\nvoid main() {`)
      .replace(MTOON_SKINNED, `${MTOON_SKINNED}\n${COAT_DENT_APPLY}`)
  }
  m.customProgramCacheKey = () => `${key()},coatDent`
  m.needsUpdate = true
}
