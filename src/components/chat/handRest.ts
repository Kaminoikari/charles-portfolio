/**
 * A hand resting on her: the palm laid against her side, each finger curled
 * until its tip meets her, the thumb kept out of her.
 *
 * A clip captured on another body puts its hands where that body was. Akimbo's
 * hands on milfy (2026-10-04): the thumb of the hand at her waist 50mm inside
 * her and 70mm once the wrist was straightened, the fingers of the hand at her
 * hip 43–55mm off it, and a coat drawn in after that buried thumb opened her
 * back to the skirt (owner: "make sure both hands' angle on the hips and the
 * fingers are how a body works"). The arm stays the clip's; only the wrist,
 * the fingers and the thumb move, each by one turn about one axis, so the
 * hand keeps the shape the grip gave it.
 *
 * What she is, here, is a cloud of her surface (bodyCloud), carried by the
 * bones it hangs from, and a point's distance outside her is read along the
 * level line from her hips' upright axis, as the coat dent reads it.
 */
import * as THREE from 'three'
import type { Side } from './idlePose'

/** How far each joint's centre sits inside its own skin, in metres, where it rests on her. */
export const HAND_REST = {
  /** The palm over the middle finger's knuckle. */
  knuckle: 0.012,
  /** A finger joint, and the fingertip. */
  finger: 0.008,
  /** A thumb joint. */
  thumb: 0.009,
}

/**
 * How far above and below her hips, at rest, her surface is kept for her hands
 * to rest on, in metres: past where akimbo's fingertips go (60mm above the
 * hips to 190mm below, on milfy), and no further, since all of it is posed
 * and searched every frame a hand rests.
 */
export const REST_BAND = 0.35

/** How far each part may turn from the clip, in degrees. */
const FLEX = { least: -45, most: 45 }
const ROLL = { least: -35, most: 35 }
/** How far a wrist bends, in degrees from the forearm's line: back toward the hand's back, and toward the palm. */
const WRIST = { extension: 70, flexion: 60 }
/**
 * What a millimetre of hand in her costs against a millimetre of palm off
 * her, where the wrist is laid: the palm may stand off a little so that no
 * finger or thumb has to go into her.
 */
const SINK = 3
/** How far past straight a finger bends back, in degrees, at its knuckle. */
const BENT_BACK = 15
// From the grip's curl (HIP_GRIP's 35° in all): back to straight and past it, as a knuckle bends back.
const CURL = { least: -35 - BENT_BACK, most: 55 }
const THUMB = { least: -90, most: 20 }
const FINGERS = ['Index', 'Middle', 'Ring', 'Little']
/** The share of a finger's curl each joint takes, base to tip (idlePose.HIP_GRIP's 12:15:8). */
const CURL_SHARE = [12 / 35, 15 / 35, 8 / 35]
/** The share of the thumb's turn each joint takes, base to tip. */
const THUMB_SHARE = [0.6, 0.25, 0.15]
/** How many bones carry each point of her surface, as she is skinned. */
const INFLUENCES = 4

/** Her surface, each vertex carried by the bones it is skinned to, by their weights. */
export interface BodyCloud {
  /** xyz per vertex per influence, in that influence's bone's frame. */
  local: Float32Array
  /** The bone per vertex per influence, by index into `bones`. */
  bone: Uint16Array
  /** The weight per vertex per influence, 0 where unused; each vertex's sum to 1. */
  weight: Float32Array
  bones: THREE.Object3D[]
  /** Three vertex indices per triangle. */
  triangles: Uint32Array
}

/**
 * Takes `points` (world xyz, read with the bones where they stand now) into
 * the frames of the bones each is `carriedBy` (bone and weight; the heaviest
 * four kept), with the `triangles` (three indices into `points` each) whose
 * every corner is carried. The rest is left out.
 */
export function bodyCloud(
  points: ArrayLike<number>,
  triangles: ArrayLike<number>,
  carriedBy: (i: number) => readonly (readonly [THREE.Object3D, number])[] | null,
): BodyCloud {
  const bones: THREE.Object3D[] = []
  const index = new Map<THREE.Object3D, number>()
  const inverse: THREE.Matrix4[] = []
  const local: number[] = []
  const owner: number[] = []
  const weights: number[] = []
  const kept = new Map<number, number>()
  const p = new THREE.Vector3()
  const keep = (i: number): number | undefined => {
    if (kept.has(i)) return kept.get(i)
    const by = carriedBy(i)
    if (!by || by.length === 0) return undefined
    // One entry per bone, the heaviest INFLUENCES, weighed to 1.
    const merged = new Map<THREE.Object3D, number>()
    for (const [b, w] of by) if (w > 0) merged.set(b, (merged.get(b) ?? 0) + w)
    const top = [...merged].sort((x, y) => y[1] - x[1]).slice(0, INFLUENCES)
    const sum = top.reduce((a, [, w]) => a + w, 0)
    if (!(sum > 0)) return undefined
    for (let n = 0; n < INFLUENCES; n++) {
      const entry = top[n]
      if (!entry) {
        local.push(0, 0, 0)
        owner.push(0)
        weights.push(0)
        continue
      }
      const [b, w] = entry
      let k = index.get(b)
      if (k === undefined) {
        k = bones.length
        bones.push(b)
        index.set(b, k)
        b.updateWorldMatrix(true, false)
        inverse.push(b.matrixWorld.clone().invert())
      }
      p.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]).applyMatrix4(inverse[k])
      local.push(p.x, p.y, p.z)
      owner.push(k)
      weights.push(w / sum)
    }
    kept.set(i, weights.length / INFLUENCES - 1)
    return weights.length / INFLUENCES - 1
  }
  const tris: number[] = []
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    const corners = [triangles[t], triangles[t + 1], triangles[t + 2]].map(keep)
    if (corners.some((c) => c === undefined)) continue
    for (const c of corners) tris.push(c!)
  }
  return { local: Float32Array.from(local), bone: Uint16Array.from(owner), weight: Float32Array.from(weights), bones, triangles: Uint32Array.from(tris) }
}

/** The cloud where her bones stand now, in world xyz: into `into` where it is the right length. */
export function posedCloud(cloud: BodyCloud, into?: Float32Array): Float32Array {
  for (const b of cloud.bones) b.updateWorldMatrix(true, false)
  const p = new THREE.Vector3()
  const count = cloud.weight.length / INFLUENCES
  const out = into && into.length === count * 3 ? into : new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    let x = 0
    let y = 0
    let z = 0
    for (let n = 0; n < INFLUENCES; n++) {
      const j = i * INFLUENCES + n
      const w = cloud.weight[j]
      if (w === 0) continue
      p.fromArray(cloud.local, j * 3).applyMatrix4(cloud.bones[cloud.bone[j]].matrixWorld)
      x += p.x * w
      y += p.y * w
      z += p.z * w
    }
    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = z
  }
  return out
}

/** Her surface as a hand rests on it. */
export interface Surface {
  /** A point on the upright line through her hips, out from which `outside` reads. */
  hips: THREE.Vector3
  /**
   * How far a point is outside her, in metres (negative inside): its distance
   * out from her hips' upright axis less that of the outermost crossing of her
   * surface along the same level line. NaN where the line crosses none of her.
   */
  outside: (p: THREE.Vector3) => number
}

/** Height of a band and the number of sectors round her a triangle is filed under. */
const BAND = 0.005
const SECTORS = 128

/** How far from a wrist her surface is read, in metres: a hand's length and some. */
export const HAND_REACH = 0.2

/**
 * How far her hips, and each hand, may move before her surface is filed
 * again, in metres. Each triangle is filed a band and a sector wider than it
 * spans, and hands reach that much further, to cover the drift in between.
 */
const REFILE = { hips: 0.005, hand: 0.04 }

/**
 * Which triangles cross which band and sector round her, kept from frame to
 * frame: the triangles move on, and are read where they stand, but which
 * bucket each is in barely changes while her hips and hands stay put.
 */
export interface SurfaceFiling {
  hips: THREE.Vector3
  near: THREE.Vector3[]
  base: number
  bands: number
  /** Where each bucket's run starts in `filed`, and one past the last. */
  start: Int32Array
  /** Triangle offsets (into `triangles`), bucket by bucket. */
  filed: Int32Array
}

const sectorAbout = (hips: THREE.Vector3) => (x: number, z: number) => {
  const s = Math.floor((Math.atan2(z - hips.z, x - hips.x) / (2 * Math.PI) + 0.5) * SECTORS)
  return Math.min(Math.max(s, 0), SECTORS - 1)
}

/** Files the triangles within `reach` of one of `near` (every one where none is given) by the bands and sectors each spans. */
function fileSurface(
  positions: ArrayLike<number>,
  triangles: ArrayLike<number>,
  hips: THREE.Vector3,
  near: readonly THREE.Vector3[],
  reach: number,
): SurfaceFiling {
  const sector = sectorAbout(hips)
  const reach2 = reach * reach
  const count = positions.length / 3
  const close = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    let hit = near.length === 0
    for (let k = 0; !hit && k < near.length; k++) {
      const dx = positions[i * 3] - near[k].x
      const dy = positions[i * 3 + 1] - near[k].y
      const dz = positions[i * 3 + 2] - near[k].z
      hit = dx * dx + dy * dy + dz * dz <= reach2
    }
    close[i] = hit ? 1 : 0
  }
  // Per kept triangle: low band, high band, first sector, last (past SECTORS
  // across the seam), each a band and a sector wider for the drift until the
  // next filing.
  const spans: number[] = []
  const kept: number[] = []
  let base = Infinity
  let top = -Infinity
  for (let t = 0; t + 2 < triangles.length; t += 3) {
    const a = triangles[t]
    const b = triangles[t + 1]
    const c = triangles[t + 2]
    if (!close[a] && !close[b] && !close[c]) continue
    const sa = sector(positions[a * 3], positions[a * 3 + 2])
    const sb = sector(positions[b * 3], positions[b * 3 + 2])
    const sc = sector(positions[c * 3], positions[c * 3 + 2])
    let first = Math.min(sa, sb, sc)
    let last = Math.max(sa, sb, sc)
    if (last - first > SECTORS / 2) {
      // Across the seam, the short way round.
      const half = SECTORS / 2
      first = Math.min(sa >= half ? sa : SECTORS, sb >= half ? sb : SECTORS, sc >= half ? sc : SECTORS)
      last = Math.max(sa < half ? sa : -1, sb < half ? sb : -1, sc < half ? sc : -1) + SECTORS
    }
    const ya = positions[a * 3 + 1]
    const yb = positions[b * 3 + 1]
    const yc = positions[c * 3 + 1]
    const lo = Math.floor(Math.min(ya, yb, yc) / BAND) - 1
    const hi = Math.floor(Math.max(ya, yb, yc) / BAND) + 1
    kept.push(t)
    spans.push(lo, hi, first - 1 + SECTORS, last + 1 + SECTORS)
    base = Math.min(base, lo)
    top = Math.max(top, hi)
  }
  const bands = kept.length ? top - base + 1 : 0
  // One flat run per bucket, counted first.
  const start = new Int32Array(bands * SECTORS + 1)
  let filed = new Int32Array(0)
  for (let pass = 0; pass < 2; pass++) {
    const fill = pass === 1 ? start.slice() : start
    for (let n = 0; n < kept.length; n++) {
      for (let k = spans[n * 4] - base; k <= spans[n * 4 + 1] - base; k++) {
        for (let s = spans[n * 4 + 2]; s <= spans[n * 4 + 3]; s++) {
          const key = k * SECTORS + (s % SECTORS)
          if (pass === 0) start[key + 1]++
          else filed[fill[key]++] = kept[n]
        }
      }
    }
    if (pass === 0) {
      for (let k = 0; k < bands * SECTORS; k++) start[k + 1] += start[k]
      filed = new Int32Array(start[bands * SECTORS])
    }
  }
  return { hips: hips.clone(), near: near.map((q) => q.clone()), base, bands, start, filed }
}

/**
 * Her surface (`positions`, world xyz, and `triangles`) as Surface reads it,
 * about the upright line through `hips`. Only triangles with a corner within
 * `reach` of one of `near` are filed, where given: the surface a hand can rest
 * on. `last` is the filing a previous call returned, used again while her
 * hips and hands are within REFILE of where it was made.
 */
export function surfaceOf(
  positions: ArrayLike<number>,
  triangles: ArrayLike<number>,
  hips: THREE.Vector3,
  near: readonly THREE.Vector3[] = [],
  reach = Infinity,
  last?: SurfaceFiling | null,
): Surface & { filing: SurfaceFiling } {
  const still =
    last &&
    last.hips.distanceTo(hips) <= REFILE.hips &&
    last.near.length === near.length &&
    near.every((q, k) => last.near[k].distanceTo(q) <= REFILE.hand)
  const filing = still ? last : fileSurface(positions, triangles, hips, near, reach + REFILE.hand)
  const { base, bands, start, filed } = filing
  const sector = sectorAbout(hips)
  const outside = (q: THREE.Vector3): number => {
    const dx = q.x - hips.x
    const dz = q.z - hips.z
    const r = Math.hypot(dx, dz)
    if (r < 1e-6) return NaN
    const k = Math.floor(q.y / BAND) - base
    if (k < 0 || k >= bands) return NaN
    const ux = dx / r
    const uz = dz / r
    const key = k * SECTORS + sector(q.x, q.z)
    let outer = -Infinity
    for (let f = start[key]; f < start[key + 1]; f++) {
      const t = filed[f]
      // Moller-Trumbore, the ray level from (hips.x, q.y, hips.z) along (ux, 0, uz).
      const a = triangles[t] * 3
      const b = triangles[t + 1] * 3
      const c = triangles[t + 2] * 3
      const e1x = positions[b] - positions[a]
      const e1y = positions[b + 1] - positions[a + 1]
      const e1z = positions[b + 2] - positions[a + 2]
      const e2x = positions[c] - positions[a]
      const e2y = positions[c + 1] - positions[a + 1]
      const e2z = positions[c + 2] - positions[a + 2]
      const px = -uz * e2y
      const py = uz * e2x - ux * e2z
      const pz = ux * e2y
      const det = e1x * px + e1y * py + e1z * pz
      if (Math.abs(det) < 1e-12) continue
      const inv = 1 / det
      const tx = hips.x - positions[a]
      const ty = q.y - positions[a + 1]
      const tz = hips.z - positions[a + 2]
      const u = (tx * px + ty * py + tz * pz) * inv
      if (u < 0 || u > 1) continue
      const qx = ty * e1z - tz * e1y
      const qy = tz * e1x - tx * e1z
      const qz = tx * e1y - ty * e1x
      const v = (ux * qx + uz * qz) * inv
      if (v < 0 || u + v > 1) continue
      const along = (e2x * qx + e2y * qy + e2z * qz) * inv
      if (along > outer) outer = along
    }
    return outer === -Infinity ? NaN : r - outer
  }
  return { hips: hips.clone(), outside, filing }
}

/**
 * `cloud` with the triangles a layer over them hides left out: those whose
 * every corner, at rest, lies more than 3mm inside the outermost crossing of
 * its own line out from her hips. Her body under her clothes, the lining
 * under a skirt. Read once at load; fewer points to pose and triangles to
 * file every time.
 */
export function outerLayer(cloud: BodyCloud, hips: THREE.Vector3): BodyCloud {
  const positions = posedCloud(cloud)
  const surface = surfaceOf(positions, cloud.triangles, hips)
  const p = new THREE.Vector3()
  const kept: number[] = []
  for (let t = 0; t + 2 < cloud.triangles.length; t += 3) {
    let shown = false
    for (let k = 0; k < 3 && !shown; k++) {
      p.fromArray(positions, cloud.triangles[t + k] * 3)
      shown = !(surface.outside(p) < -0.003)
    }
    if (shown) kept.push(cloud.triangles[t], cloud.triangles[t + 1], cloud.triangles[t + 2])
  }
  // Only the vertices a kept triangle uses, renumbered.
  const renumber = new Map<number, number>()
  for (const i of kept) if (!renumber.has(i)) renumber.set(i, renumber.size)
  const local = new Float32Array(renumber.size * INFLUENCES * 3)
  const bone = new Uint16Array(renumber.size * INFLUENCES)
  const weight = new Float32Array(renumber.size * INFLUENCES)
  for (const [from, to] of renumber) {
    local.set(cloud.local.subarray(from * INFLUENCES * 3, (from + 1) * INFLUENCES * 3), to * INFLUENCES * 3)
    bone.set(cloud.bone.subarray(from * INFLUENCES, (from + 1) * INFLUENCES), to * INFLUENCES)
    weight.set(cloud.weight.subarray(from * INFLUENCES, (from + 1) * INFLUENCES), to * INFLUENCES)
  }
  return { local, bone, weight, bones: cloud.bones, triangles: Uint32Array.from(kept, (i) => renumber.get(i)!) }
}

const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3())

/** Turns `node` by the world rotation `q`, through its own joint. */
function turnBy(node: THREE.Object3D, q: THREE.Quaternion): void {
  if (!node.parent) return
  const parent = node.parent.getWorldQuaternion(new THREE.Quaternion())
  node.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent))
  node.updateWorldMatrix(false, true)
}

/** Turns `node` by `angle` about the world `axis`, through its own joint. */
function turn(node: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
  if (angle !== 0) turnBy(node, new THREE.Quaternion().setFromAxisAngle(axis, angle))
}

/** The joints of a chain turned about one axis, joint j by the sum of the first j+1 angles; the last point is the tip. */
function swing(points: THREE.Vector3[], axis: THREE.Vector3, angles: number[]): THREE.Vector3[] {
  const out = [points[0].clone()]
  const q = new THREE.Quaternion()
  let sum = 0
  for (let j = 1; j < points.length; j++) {
    sum += angles[Math.min(j - 1, angles.length - 1)]
    q.setFromAxisAngle(axis, sum)
    out.push(points[j].clone().sub(points[j - 1]).applyQuaternion(q).add(out[j - 1]))
  }
  return out
}

/**
 * The best angle in [least, most] degrees by `cost`. Fresh: every 5°, then
 * every degree round the best, the clip's own winning a tie. From `from`
 * (last frame's): every degree within 3° of it, walking on while the best is
 * at the edge.
 */
function search(least: number, most: number, cost: (angle: number) => number, from?: number): number {
  const rad = THREE.MathUtils.degToRad
  const seen = new Map<number, number>()
  const costAt = (d: number) => {
    let c = seen.get(d)
    if (c === undefined) {
      c = d < least || d > most ? Infinity : cost(rad(d))
      seen.set(d, c)
    }
    return c
  }
  let best = from === undefined ? 0 : Math.round(from)
  const better = (d: number) => {
    if (costAt(d) < costAt(best) - 1e-9) best = d
  }
  if (from === undefined) {
    for (let d = least; d <= most; d += 5) better(d)
    const centre = best
    for (let d = centre - 4; d <= centre + 4; d++) better(d)
    return rad(best)
  }
  for (let walk = 0; walk < 12; walk++) {
    const centre = best
    for (let d = centre - 3; d <= centre + 3; d++) better(d)
    if (Math.abs(best - centre) < 3) break
  }
  return rad(best)
}

/**
 * The best pair of angles by `cost`, each in its range in degrees. Fresh:
 * every 10°, then every 3° and every degree round the best so far, the clip's
 * own pair winning a tie. From `from` (last frame's): every degree within 2°
 * of it, walking on while the best is at the edge.
 */
function search2(
  a: { least: number; most: number },
  b: { least: number; most: number },
  cost: (x: number, y: number) => number,
  from?: [number, number],
): [number, number] {
  const rad = THREE.MathUtils.degToRad
  const seen = new Map<number, number>()
  const costAt = (x: number, y: number) => {
    const key = x * 1000 + y
    let c = seen.get(key)
    if (c === undefined) {
      c = x < a.least || x > a.most || y < b.least || y > b.most ? Infinity : cost(rad(x), rad(y))
      seen.set(key, c)
    }
    return c
  }
  let best: [number, number] = from ? [Math.round(from[0]), Math.round(from[1])] : [0, 0]
  const better = (x: number, y: number) => {
    if (costAt(x, y) < costAt(best[0], best[1]) - 1e-9) best = [x, y]
  }
  if (!from) {
    for (let x = a.least; x <= a.most; x += 10) for (let y = b.least; y <= b.most; y += 10) better(x, y)
    for (const [step, span] of [[3, 9], [1, 2]]) {
      const [cx, cy] = best
      for (let x = cx - span; x <= cx + span; x += step) for (let y = cy - span; y <= cy + span; y += step) better(x, y)
    }
    return [rad(best[0]), rad(best[1])]
  }
  for (let walk = 0; walk < 12; walk++) {
    const [cx, cy] = best
    for (let x = cx - 2; x <= cx + 2; x++) for (let y = cy - 2; y <= cy + 2; y++) better(x, y)
    if (Math.abs(best[0] - cx) < 2 && Math.abs(best[1] - cy) < 2) break
  }
  return [rad(best[0]), rad(best[1])]
}

/** How far `gap` is from resting: off by the distance, and three times that inside. */
const miss = (gap: number, skin: number) => (Number.isNaN(gap) ? 0 : gap < skin ? 3 * (skin - gap) : gap - skin)
/** How far inside her `gap` is, nothing where it is clear of her. */
const sunk = (gap: number, skin: number) => (Number.isNaN(gap) ? 0 : Math.max(0, skin - gap))

/** The thumb's chain with its tip, a distal's length past the last joint. */
function thumbChain([m, p, d]: THREE.Vector3[]): THREE.Vector3[] {
  return [m, p, d, d.clone().add(d.clone().sub(p))]
}

/** The thumb turned about its root, out of her (negative) or into her: the axis it turns about. */
function thumbAxis([m, p]: THREE.Vector3[], hips: THREE.Vector3): THREE.Vector3 {
  // Into her is level, toward her axis, where the thumb's root is.
  const inward = new THREE.Vector3(hips.x - m.x, 0, hips.z - m.z).normalize()
  return new THREE.Vector3().crossVectors(p.clone().sub(m).normalize(), inward).normalize()
}

/**
 * How far the thumb's joints past its root are inside her, turned by
 * `angle`: past resting on her, or, where the arm has put the root itself in
 * her (a flared skirt round the wrist), past the root's own depth.
 */
function thumbSunk(chain: THREE.Vector3[], axis: THREE.Vector3, angle: number, outside: Surface['outside']): number {
  const [m, j2, j3, t] = swing(chain, axis, THUMB_SHARE.map((s) => s * angle))
  const root = outside(m)
  const skin = Number.isNaN(root) ? HAND_REST.thumb : Math.min(HAND_REST.thumb, root)
  return sunk(outside(j2), skin) + sunk(outside(j3), skin) + sunk(outside(t), skin)
}

/** The thumb's turn out of her: no joint in her, the tip on her where it can be. */
function liftThumb(joints: THREE.Vector3[], surface: Surface, from?: number): { axis: THREE.Vector3; lift: number } {
  const chain = thumbChain(joints)
  const axis = thumbAxis(joints, surface.hips)
  const lift = search(THUMB.least, THUMB.most, (a) => {
    const [, , , t] = swing(chain, axis, THUMB_SHARE.map((s) => s * a))
    return 0.25 * miss(surface.outside(t), HAND_REST.thumb) + 4 * thumbSunk(chain, axis, a, surface.outside)
  }, from)
  return { axis, lift }
}

/**
 * What restHand found for one hand, in degrees from the clip's pose: where
 * the next frame's search starts, so a held pose costs a few looks round
 * last frame's answer in place of a search of every angle.
 */
export interface HandRestMemory {
  roll: number
  flex: number
  curl: number[]
  lift: number
}

/**
 * Rests one hand on her, on `weight` of the turn: normalized bones, the
 * clip's pose already on them. Each turn is found against her surface as it
 * stands now, then taken by `weight`, so a clip fading in or out takes its
 * hands on and off her on its own curve. `last` is what it found for this
 * hand last frame, where its searches start; it returns what it found now
 * (null where it did nothing).
 */
export function restHand(
  node: (bone: string) => THREE.Object3D | null | undefined,
  side: Side,
  surface: Surface,
  weight: number,
  last?: HandRestMemory | null,
): HandRestMemory | null {
  if (!(weight > 0)) return null
  const { outside } = surface
  const lower = node(`${side}LowerArm`)
  const hand = node(`${side}Hand`)
  const middle = node(`${side}MiddleProximal`)
  const fingers = FINGERS.map((f) => ['Proximal', 'Intermediate', 'Distal'].map((s) => node(`${side}${f}${s}`)))
  const thumbJoints = ['Metacarpal', 'Proximal', 'Distal'].map((s) => node(`${side}Thumb${s}`))
  const index = node(`${side}IndexProximal`)
  const little = node(`${side}LittleProximal`)
  if (!lower || !hand || !middle || !index || !little || !fingers.every((f) => f.every(Boolean)) || !thumbJoints.every(Boolean)) return null
  const deg = THREE.MathUtils.radToDeg
  hand.updateWorldMatrix(true, true)

  // The wrist. The hand rolls about the forearm's line (the engine hands a
  // forearm's roll to the wrist anyway: armRollsToWrist) and tips about the
  // line across the wrist, toward the palm or its back, until both outer
  // knuckles lie on her, the fingers can clear her (bent back as far as they
  // go) and the thumb's root is out of her.
  const wrist = at(hand)
  const forearm = wrist.clone().sub(at(lower)).normalize()
  const along = at(middle).sub(wrist).normalize()
  // A normalized bone rests at identity with the palm facing down, so the
  // palm's normal is down carried by the hand's turn.
  const palm = new THREE.Vector3(0, -1, 0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()))
  // Turning about `flexAxis` by a positive angle takes the fingers toward the palm.
  const flexAxis = new THREE.Vector3().crossVectors(along, palm).normalize()
  const knuckles = [at(index), at(little)]
  // Each finger's joints and tip, as the clip and the grip hold it.
  const chains = fingers.map((f) => {
    const [p1, p2, p3] = f.map((j) => at(j!))
    return [p1, p2, p3, p3.clone().add(p3.clone().sub(p2))]
  })
  // The thumb's own base: the thumb turns about it, so it cannot be lifted later.
  const thumbAt = thumbJoints.map((j) => at(j!))
  const thumbBase = thumbAt[0]
  const rootSunk = sunk(outside(thumbBase), HAND_REST.thumb)
  const turnOf = (roll: number, flex: number) =>
    new THREE.Quaternion().setFromAxisAngle(forearm, roll).multiply(new THREE.Quaternion().setFromAxisAngle(flexAxis, flex))
  const moved = (q: THREE.Quaternion, x: THREE.Vector3) => x.clone().sub(wrist).applyQuaternion(q).add(wrist)
  const handCost = (roll: number, flex: number) => {
    const q = turnOf(roll, flex)
    const bent = along.clone().applyQuaternion(q)
    // Flexion is positive: the forearm's line to the hand's, about the tipped axis.
    const bend = THREE.MathUtils.radToDeg(Math.atan2(new THREE.Vector3().crossVectors(forearm, bent).dot(flexAxis.clone().applyQuaternion(q)), forearm.dot(bent)))
    if (bend > WRIST.flexion || bend < -WRIST.extension) return Infinity
    // Each finger bent as far back as it goes: the palm may lie no closer to
    // her than lets the fingers clear her.
    const palmNow = palm.clone().applyQuaternion(q)
    let cost = 0
    for (const chain of chains) {
      const [p1, p2, p3, tip] = chain.map((x) => moved(q, x))
      const axis = new THREE.Vector3().crossVectors(p2.clone().sub(p1).normalize(), palmNow).normalize()
      const [, , j3, t] = swing([p1, p2, p3, tip], axis, CURL_SHARE.map((s) => s * THREE.MathUtils.degToRad(CURL.least)))
      cost += SINK * (sunk(outside(t), HAND_REST.finger) + sunk(outside(j3), HAND_REST.finger))
    }
    for (const k of knuckles) cost += miss(outside(moved(q, k)), HAND_REST.knuckle)
    // The thumb's root no deeper in her than the clip put it: the arm may have
    // put it there, and only the arm could take it out.
    cost += SINK * Math.max(0, sunk(outside(moved(q, thumbBase)), HAND_REST.thumb) - rootSunk)
    // And the thumb can still be lifted out of her: turned as far out as it goes.
    const turned = thumbAt.map((x) => moved(q, x))
    cost += SINK * thumbSunk(thumbChain(turned), thumbAxis(turned, surface.hips), THREE.MathUtils.degToRad(THUMB.least), outside)
    return cost
  }
  const [roll, flex] = search2(ROLL, FLEX, handCost, last ? [last.roll, last.flex] : undefined)
  const handTurn = turnOf(roll * weight, flex * weight)
  turnBy(hand, handTurn)
  palm.applyQuaternion(handTurn)

  // Each finger: curled until its tip meets her, no joint inside her.
  const curls: number[] = []
  for (const [n, joints] of fingers.entries()) {
    const [p1, p2, p3] = joints.map((j) => at(j!))
    // The fingertip, a distal's length past the last joint.
    const tip = p3.clone().add(p3.clone().sub(p2))
    const dir = p2.clone().sub(p1).normalize()
    const axis = new THREE.Vector3().crossVectors(dir, palm).normalize()
    const curl = search(CURL.least, CURL.most, (a) => {
      const [, j2, j3, t] = swing([p1, p2, p3, tip], axis, CURL_SHARE.map((s) => s * a))
      return miss(outside(t), HAND_REST.finger) + 2 * (sunk(outside(j2), HAND_REST.finger) + sunk(outside(j3), HAND_REST.finger))
    }, last?.curl[n])
    curls.push(deg(curl))
    joints.forEach((j, k) => turn(j!, axis, curl * CURL_SHARE[k] * weight))
  }

  // The thumb: out of her, resting on her where it can.
  const thumb = thumbJoints.map((j) => at(j!))
  const { axis, lift } = liftThumb(thumb, surface, last?.lift)
  thumbJoints.forEach((j, k) => turn(j!, axis, lift * THUMB_SHARE[k] * weight))
  return { roll: deg(roll), flex: deg(flex), curl: curls, lift: deg(lift) }
}

/**
 * Three's mixer writes a bone only when the clip's value for it has changed
 * since the frame before (PropertyMixer.apply compares the two). Through a
 * still stretch of a clip, and the last frame clampWhenFinished holds while
 * she settles, a bone keeps whatever the layers after the mixer turned it to,
 * and a layer that turns a bone from where it stands (restHand,
 * limitRadialDeviation) turns it again on top, every frame: her wrists and
 * thumbs wound round in akimbo's holds (rendered 2026-10-04).
 *
 * `begin`, right after the mixer, puts back the clip's own turn on every bone
 * that still stands exactly where `end` left it last frame, and remembers
 * each bone's turn as the clip's; `end`, after the last layer, remembers where
 * the layers left them. `clear` forgets every bone.
 */
export function clipUnderLayers(): {
  begin(bones: Iterable<THREE.Object3D>): void
  end(): void
  clear(): void
} {
  const clip = new Map<THREE.Object3D, THREE.Quaternion>()
  const layered = new Map<THREE.Object3D, THREE.Quaternion>()
  return {
    begin(bones) {
      for (const bone of bones) {
        const left = layered.get(bone)
        const own = clip.get(bone)
        if (left && own && bone.quaternion.equals(left)) bone.quaternion.copy(own)
        if (own) own.copy(bone.quaternion)
        else clip.set(bone, bone.quaternion.clone())
      }
    },
    end() {
      for (const bone of clip.keys()) {
        const left = layered.get(bone)
        if (left) left.copy(bone.quaternion)
        else layered.set(bone, bone.quaternion.clone())
      }
    },
    clear() {
      clip.clear()
      layered.clear()
    },
  }
}
