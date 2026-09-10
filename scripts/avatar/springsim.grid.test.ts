// The nearest-vertex query, marked against the definition of its own answer.
//
// `Grid` is 97.7% of a simulation's wall clock (the profile is quoted in its
// docblock), so it is the one part of springsim worth making fast. It was made
// fast by changing the data structure underneath it, which is exactly the kind
// of change that can return a slightly different number without anything going
// visibly wrong: every millimetre budget in every committed clearance file was
// measured through the old version, and a query that silently picks the second
// nearest vertex instead of the nearest still returns a plausible distance.
//
// So the assertion here is equality with a brute-force scan, not closeness to
// it. The oracle below is the DEFINITION of the answer (walk every kept vertex,
// keep the nearest, take the sign from its normal) rather than a second copy of
// the grid: it shares no indexing, no cells and no early exit with the thing it
// marks, which is what makes it able to catch a broken shell bound.
//
// Its own file rather than a describe inside springsim.test.ts, for the reason
// springsim.derive.test.ts gives: the other springsim suites each block a
// worker for a minute or more, and vitest reports an unhandled "Timeout calling
// onTaskUpdate" over a run that passed.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AVATAR_VARIANTS } from '../../src/components/chat/avatarVariants'
import { parseGlb } from '../../src/components/chat/vrmHumanoid'
import { Grid, deriveManifest, gather, type SkinSet } from './springsim'

const milfy = AVATAR_VARIANTS.find((v) => v.id === 'milfy')
if (!milfy) throw new Error('no milfy variant declared')
const MODEL = process.env.SPRINGSIM_TEST_MODEL ?? path.resolve('public', milfy.url.replace(/^\//, ''))

/** REACH, the distance the query saturates at. Not exported; pinned here. */
const REACH = 0.05

/**
 * The answer, by definition: the nearest kept vertex, signed by whether the
 * point is in front of that vertex's normal, saturating at REACH.
 *
 * Deliberately the slowest possible implementation. Its only job is to be
 * obviously right.
 */
function brute(set: SkinSet, x: number, y: number, z: number): number {
  const P = set.outPos
  let best = Infinity
  let bestI = -1
  for (const i of set.keep) {
    const dx = P[i * 3] - x
    const dy = P[i * 3 + 1] - y
    const dz = P[i * 3 + 2] - z
    const d = dx * dx + dy * dy + dz * dz
    if (d < best) {
      best = d
      bestI = i
    }
  }
  if (bestI < 0 || best > REACH * REACH) return REACH
  const N = set.outNrm
  const dot =
    (x - P[bestI * 3]) * N[bestI * 3] +
    (y - P[bestI * 3 + 1]) * N[bestI * 3 + 1] +
    (z - P[bestI * 3 + 2]) * N[bestI * 3 + 2]
  return Math.sign(dot || 1) * Math.sqrt(best)
}

/** A set the grid can read, holding whatever geometry a test hands it. */
function setOf(pos: number[], nrm: number[], keep?: number[]): SkinSet {
  const n = pos.length / 3
  return {
    label: 'test',
    n,
    pos: Float64Array.from(pos),
    nrm: Float64Array.from(nrm),
    joints: new Float64Array(n * 4),
    weights: new Float64Array(n * 4),
    skin: 0,
    keep: Int32Array.from(keep ?? [...Array(n).keys()]),
    outPos: Float64Array.from(pos),
    outNrm: Float64Array.from(nrm),
  }
}

/** Deterministic, so a failure is reproducible from the test name alone. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('the nearest-vertex query, against a brute-force scan', () => {
  // The shipped body, read once. Face and Body_Skin are the two sets every
  // penetration query is asked against, so they are the geometry the grid
  // actually meets: a few thousand vertices packed onto a surface, which is
  // where an early exit that stops one shell too soon starts returning the
  // wrong vertex.
  //
  // These counts were larger when this file was written, because `gather` was
  // reading a shared vertex buffer once per primitive and stacking the same
  // 2,054 face vertices ten times over. The floors below are the real counts.
  let cached: { face: SkinSet; body: SkinSet } | null = null
  const real = (): { face: SkinSet; body: SkinSet } => {
    if (cached) return cached
    const raw = readFileSync(MODEL)
    const g = parseGlb<Parameters<typeof deriveManifest>[0]['json']>(new Uint8Array(raw))
    if (!g.bin) throw new Error('no BIN chunk')
    const manifest = deriveManifest({ json: g.json, bin: g.bin })
    const rest = (part: string, stride: number): SkinSet => {
      const set = gather(g.json, g.bin as Uint8Array, manifest, part, stride)
      // The grid reads outPos/outNrm, which the simulator fills by skinning.
      // The rest pose is the same geometry at the same scale with the same
      // clustering, and the grid cannot tell the difference: it never looks at
      // a joint, a weight or a frame.
      set.outPos.set(set.pos)
      set.outNrm.set(set.nrm)
      return set
    }
    cached = { face: rest('Face', 1), body: rest('Body_Skin', 1) }
    return cached
  }

  it('agrees on every query, on the face the penetration test is asked about', () => {
    const face = real().face
    expect(face.keep.length).toBeGreaterThan(2000)
    const grid = new Grid(face)
    const P = face.outPos
    const r = rng(20260911)
    // Points drawn near real vertices, which is where hair actually is: a
    // query that never lands near anything would pass on an all-REACH answer.
    let inside = 0
    for (let t = 0; t < 3000; t++) {
      const i = face.keep[Math.floor(r() * face.keep.length)]
      const x = P[i * 3] + (r() - 0.5) * 0.12
      const y = P[i * 3 + 1] + (r() - 0.5) * 0.12
      const z = P[i * 3 + 2] + (r() - 0.5) * 0.12
      const want = brute(face, x, y, z)
      expect(grid.signed(x, y, z)).toBe(want)
      if (want !== REACH) inside++
    }
    // Without this the test could pass on 3000 saturated answers, which the
    // outside-the-box reject alone would satisfy.
    expect(inside).toBeGreaterThan(1500)
  })

  it('agrees on the body shell too, whose vertices are spread over a whole figure', () => {
    const body = real().body
    expect(body.keep.length).toBeGreaterThan(4000)
    const grid = new Grid(body)
    const P = body.outPos
    const r = rng(770077)
    let inside = 0
    for (let t = 0; t < 3000; t++) {
      const i = body.keep[Math.floor(r() * body.keep.length)]
      const x = P[i * 3] + (r() - 0.5) * 0.12
      const y = P[i * 3 + 1] + (r() - 0.5) * 0.12
      const z = P[i * 3 + 2] + (r() - 0.5) * 0.12
      const want = brute(body, x, y, z)
      expect(grid.signed(x, y, z)).toBe(want)
      if (want !== REACH) inside++
    }
    expect(inside).toBeGreaterThan(1500)
  })

  it('finds a vertex that sits outside its own bounding box by less than REACH', () => {
    // The fast reject is the one place a query is answered without looking at
    // any vertex. A reject drawn at the box edge instead of REACH beyond it
    // would return REACH here, and every one of these has a real answer.
    const face = real().face
    const grid = new Grid(face)
    const P = face.outPos
    let lo = [Infinity, Infinity, Infinity]
    let hi = [-Infinity, -Infinity, -Infinity]
    for (const i of face.keep)
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a], P[i * 3 + a])
        hi[a] = Math.max(hi[a], P[i * 3 + a])
      }
    const r = rng(5150)
    let answered = 0
    for (let t = 0; t < 600; t++) {
      const a = t % 3
      const past = 0.001 + r() * (REACH - 0.002)
      const p = [0, 0, 0].map((_, k) => lo[k] + r() * (hi[k] - lo[k]))
      p[a] = t % 6 < 3 ? lo[a] - past : hi[a] + past
      const want = brute(face, p[0], p[1], p[2])
      expect(grid.signed(p[0], p[1], p[2])).toBe(want)
      if (want !== REACH) answered++
    }
    expect(answered).toBeGreaterThan(100)
  })

  it('saturates rather than reaching, for a point outside the geometry entirely', () => {
    const face = real().face
    const grid = new Grid(face)
    const P = face.outPos
    const i = face.keep[0]
    for (const away of [0.0501, 0.2, 5]) {
      const v = grid.signed(P[i * 3] + 1000, P[i * 3 + 1], P[i * 3 + 2] + away)
      expect(v).toBe(REACH)
    }
  })

  it('saturates for a point INSIDE the box that is still too far from anything', () => {
    // The test above is answered by the cheap out-of-box reject and never
    // reaches the `best > REACH * REACH` clamp, which a review measured: the
    // mutation that removes that clamp does not turn it red. This one has to
    // go through the clamp, because the query sits inside the bounding box
    // with nothing near it. Two vertices far apart, and the middle is empty.
    const set = setOf([-0.5, 0, 0, 0.5, 0, 0], [1, 0, 0, -1, 0, 0])
    const g = new Grid(set)
    expect(g.signed(0, 0, 0)).toBe(REACH)
    expect(g.signed(0, 0, 0)).toBe(brute(set, 0, 0, 0))
    // and one just inside REACH of an end, to show the set is reachable at all.
    // Positive: that vertex's normal points +x and the query is 40mm along it.
    expect(g.signed(-0.46, 0, 0)).toBeCloseTo(0.04, 12)
  })

  it('settles two vertices at exactly equal distance the same way a scan would', () => {
    // Ties are the one input where the answer could depend on the order cells
    // are walked in, and the two normals can disagree, so the sign flips rather
    // than a digit. The pair below is equidistant from the origin, in different
    // cells, with opposing normals: 40mm apart in the answer. Both orderings
    // are tried, because the fix is "lowest vertex index wins" and putting them
    // in the other order has to give the other answer, not the same one.
    const A = { pos: [0.02, 0, 0], nrm: [1, 0, 0] }
    const B = { pos: [0, 0.02, 0], nrm: [0, -1, 0] }
    for (const [first, second] of [[A, B], [B, A]]) {
      const set = setOf([...first.pos, ...second.pos], [...first.nrm, ...second.nrm])
      const g = new Grid(set)
      const got = g.signed(0, 0, 0)
      expect(got).toBe(brute(set, 0, 0, 0))
      // whichever went in first is the one that answers
      expect(Math.abs(got)).toBeCloseTo(0.02, 12)
    }
    // and the two orderings really do disagree, or this proves nothing
    const ab = new Grid(setOf([...A.pos, ...B.pos], [...A.nrm, ...B.nrm])).signed(0, 0, 0)
    const ba = new Grid(setOf([...B.pos, ...A.pos], [...B.nrm, ...A.nrm])).signed(0, 0, 0)
    expect(Math.sign(ab)).not.toBe(Math.sign(ba))
  })

  it('answers on a set with nothing kept, and on a set with one vertex', () => {
    const empty = setOf([0, 0, 0], [0, 1, 0], [])
    expect(new Grid(empty).signed(0, 0, 0)).toBe(REACH)
    const one = setOf([0.4, 1.2, -0.3], [0, 0, 1])
    const g = new Grid(one)
    expect(g.signed(0.4, 1.2, -0.29)).toBeCloseTo(0.01, 12)
    expect(g.signed(0.4, 1.2, -0.31)).toBeCloseTo(-0.01, 12)
    expect(g.signed(0.4, 1.2, 0.3)).toBe(REACH)
  })

  it('prefers a near vertex in its own cell over a far one two shells out', () => {
    // What this actually exercises is the early exit. The box starts at the far
    // vertex, so with FINE = 0.0125 the far one is in cell 0 and both the near
    // one and the query are in cell 2: the answer is found at k = 0, and the
    // break at k = 2 has to fire without ever looking at cell 0. An earlier
    // draft of this comment had the two the other way round.
    const near = [0.0, 0.0, 0.006]
    const far = [0.0, 0.0, -0.03]
    const set = setOf([...far, ...near], [0, 0, -1, 0, 0, 1])
    const g = new Grid(set)
    expect(g.signed(0, 0, 0)).toBeCloseTo(-0.006, 12)
    expect(g.signed(0, 0, 0)).toBe(brute(set, 0, 0, 0))
  })

  it('agrees on points placed exactly on cell boundaries', () => {
    // Cell membership is a floor(), so a query on a boundary and a vertex on a
    // boundary are the two inputs where an off-by-one in the shell walk shows
    // up as a wrong ANSWER rather than as wasted work.
    const FINE = 0.0125
    const pos: number[] = []
    const nrm: number[] = []
    for (let a = 0; a < 6; a++)
      for (let b = 0; b < 6; b++)
        for (let c = 0; c < 6; c++) {
          pos.push(a * FINE, b * FINE, c * FINE)
          nrm.push(0, 1, 0)
        }
    const set = setOf(pos, nrm)
    const g = new Grid(set)
    const r = rng(99)
    let answered = 0
    for (let t = 0; t < 400; t++) {
      const p = [0, 1, 2].map(() => Math.round(r() * 10 - 2) * FINE)
      const want = brute(set, p[0], p[1], p[2])
      expect(g.signed(p[0], p[1], p[2])).toBe(want)
      if (want !== REACH) answered++
    }
    // The other data-driven tests carry this floor and this one did not, so a
    // change to the query range could have left it comparing 400 saturated
    // answers and still passing.
    expect(answered).toBeGreaterThan(200)
  })

  it('agrees on scattered geometry that leaves most of its box empty', () => {
    // A sparse set is where a shell walk does the most work per answer, and
    // where a bound that stops early has the most room to be wrong.
    const r = rng(31337)
    const pos: number[] = []
    const nrm: number[] = []
    for (let i = 0; i < 400; i++) {
      pos.push(r() * 0.6 - 0.3, r() * 0.6 - 0.3, r() * 0.6 - 0.3)
      const n = [r() - 0.5, r() - 0.5, r() - 0.5]
      const len = Math.hypot(n[0], n[1], n[2]) || 1
      nrm.push(n[0] / len, n[1] / len, n[2] / len)
    }
    const set = setOf(pos, nrm)
    const g = new Grid(set)
    let answered = 0
    for (let t = 0; t < 2000; t++) {
      const p = [0, 1, 2].map(() => r() * 0.7 - 0.35)
      const want = brute(set, p[0], p[1], p[2])
      expect(g.signed(p[0], p[1], p[2])).toBe(want)
      if (want !== REACH) answered++
    }
    expect(answered).toBeGreaterThan(200)
  })
})
