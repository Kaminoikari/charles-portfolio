// vrmHumanoid.ts is the only door to the humanoid map on the TypeScript side.
// These tests hold the reader itself, and hold the rest of the code to using it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  parseGlb,
  readAccessorRows,
  readAnimationBones,
  readExpressions,
  readHumanoid,
  readSprings,
  requiredMissing,
  rigOf,
  type GltfJson,
} from './vrmHumanoid'

const NODES = [{ translation: [0, 1, 0], children: [1] }, { translation: [0, 0.5, 0] }]
const BONES = { hips: 0, spine: 1 }

function doc(version: '0' | '1', extra: Record<string, unknown> = {}): GltfJson {
  const extensions =
    version === '0'
      ? { VRM: { humanoid: { humanBones: Object.entries(BONES).map(([bone, node]) => ({ bone, node })) }, ...extra } }
      : { VRMC_vrm: { humanoid: { humanBones: Object.fromEntries(Object.entries(BONES).map(([b, n]) => [b, { node: n }])) } }, ...extra }
  return { scene: 0, scenes: [{ nodes: [0] }], nodes: NODES, extensions } as GltfJson
}

/** A GLB with the given JSON and binary chunk, padded the way the spec says. */
function glb(json: unknown, bin: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json))
  const jsonPad = (4 - (text.length % 4)) % 4
  const binPad = (4 - (bin.length % 4)) % 4
  const total = 12 + 8 + text.length + jsonPad + 8 + bin.length + binPad
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, text.length, true)
  dv.setUint32(16, 0x4e4f534a, true)
  out.set(text, 20)
  out.fill(0x20, 20 + text.length, 20 + text.length + jsonPad)
  const binAt = 20 + text.length + jsonPad
  dv.setUint32(binAt, bin.length, true)
  dv.setUint32(binAt + 4, 0x004e4942, true)
  out.set(bin, binAt + 8)
  return out
}

describe('readHumanoid', () => {
  it('reads the same bones from a VRM 1.0 map as from its 0.x twin, and says which it saw', () => {
    const v0 = readHumanoid(doc('0'))
    const v1 = readHumanoid(doc('1'))
    expect(v0.bones).toEqual(BONES)
    expect(v1.bones).toEqual(BONES)
    expect(v0.version).toBe('0')
    expect(v1.version).toBe('1')
  })

  it('carries the forward axis with the version', () => {
    expect(readHumanoid(doc('0')).forwardZ).toBe(-1)
    expect(readHumanoid(doc('1')).forwardZ).toBe(1)
  })

  it('names both extensions when neither is present', () => {
    const plain = { ...doc('0'), extensions: {} }
    expect(() => readHumanoid(plain)).toThrow(/VRM.*VRMC_vrm/)
  })

  it('lists the spec-required bones a body lacks', () => {
    const missing = requiredMissing(readHumanoid(doc('0')))
    expect(missing).toContain('head')
    expect(missing).toContain('leftHand')
    expect(missing).not.toContain('hips')
    expect(missing).not.toContain('chest')
  })

  it('reads expression names from either version and refuses a file with neither', () => {
    const v0 = doc('0', { blendShapeMaster: { blendShapeGroups: [{ name: 'Blink' }, { name: 'A' }] } })
    expect(readExpressions(v0)).toEqual(['Blink', 'A'])
    const v1 = doc('1')
    v1.extensions!.VRMC_vrm!.expressions = { preset: { blink: {}, aa: {} }, custom: { wink: {} } }
    expect(readExpressions(v1)).toEqual(['blink', 'aa', 'wink'])
    // A body with no expressions at all must not read as "the same names as
    // every other body": that is exactly the silent no-op the registry test guards.
    expect(() => readExpressions({ ...doc('0'), extensions: {} })).toThrow(/VRM.*VRMC_vrm/)
  })

  it('reads a .vrma map through its own extension', () => {
    const vrma = {
      nodes: [],
      extensions: { VRMC_vrm_animation: { humanoid: { humanBones: { hips: { node: 3 }, spine: { node: 4 } } } } },
    } as GltfJson
    expect(readAnimationBones(vrma)).toEqual({ hips: 3, spine: 4 })
    expect(() => readAnimationBones(doc('0'))).toThrow(/VRMC_vrm_animation/)
  })
})

describe('readSprings', () => {
  it('returns the 0.x block under kind vrm0 and the 1.0 block under kind vrm1', () => {
    const v0 = readSprings(doc('0', { secondaryAnimation: { boneGroups: [{ bones: [1] }], colliderGroups: [] } }))
    expect(v0.kind).toBe('vrm0')
    if (v0.kind === 'vrm0') expect(v0.secondaryAnimation.boneGroups[0].bones).toEqual([1])

    const d1 = doc('1')
    d1.extensions!.VRMC_springBone = { springs: [{ joints: [{ node: 1 }] }] }
    const v1 = readSprings(d1)
    expect(v1.kind).toBe('vrm1')
    if (v1.kind === 'vrm1') expect(v1.springBone.springs?.[0].joints[0].node).toBe(1)
  })

  it('gives a 0.x body without springs an empty block rather than undefined', () => {
    const v0 = readSprings(doc('0'))
    expect(v0.kind === 'vrm0' && v0.secondaryAnimation.boneGroups).toEqual([])
  })
})

describe('rigOf', () => {
  it('is the same string for a 0.x body and its 1.0 twin with the same nodes', () => {
    expect(rigOf(doc('1'))).toBe(rigOf(doc('0')))
  })

  it('changes when a helper node above a bone moves', () => {
    const a = doc('0')
    const b = { ...doc('0'), nodes: [{ translation: [0, 1, 0], children: [2] }, { translation: [0, 0.5, 0] }, { translation: [0, 0.01, 0], children: [1] }] }
    expect(rigOf(b)).not.toBe(rigOf(a))
  })
})

describe('parseGlb / readAccessorRows', () => {
  it('finds the BIN chunk behind a JSON chunk whose length is not a multiple of four', () => {
    // Eighteen bytes of JSON: the chunk is padded to twenty, and a reader that
    // walks by `length` alone lands two bytes short of the BIN header.
    const json = { nodes: [], a: 1 }
    expect(new TextEncoder().encode(JSON.stringify(json)).length % 4).not.toBe(0)
    const bin = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const parsed = parseGlb(glb(json, bin))
    expect(parsed.bin && Array.from(parsed.bin)).toEqual(Array.from(bin))
  })

  it('de-strides and de-normalizes an accessor', () => {
    // Two rows of VEC2 uint8 normalized, interleaved with two junk bytes each.
    const bin = new Uint8Array([255, 0, 9, 9, 0, 255, 9, 9])
    const json = {
      nodes: [],
      bufferViews: [{ byteOffset: 0, byteLength: 8, byteStride: 4 }],
      accessors: [{ bufferView: 0, componentType: 5121, count: 2, type: 'VEC2', normalized: true }],
    }
    const rows = readAccessorRows(parseGlb(glb(json, bin)), 0)
    expect(rows.ncomp).toBe(2)
    expect(Array.from(rows.data)).toEqual([1, 0, 0, 1])
  })
})

describe('wiring', () => {
  // Injection-style tests skip the wiring layer. This one reads the source: no
  // TypeScript file but vrmHumanoid.ts may reach into the humanoid map itself,
  // or a VRM 1.0 base body throws in whichever file runs first.
  const INLINE = [/\.humanoid\??\.humanBones/, /extensions\??\.VRM\??\.humanoid/, /extensions\??\.VRMC_vrm\??\.humanoid/]
  const ROOTS = ['src', 'scripts']
  const SKIP = new Set(['vrmHumanoid.ts', 'vrmHumanoid.test.ts'])

  function* sources(dir: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry)
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      if (statSync(full).isDirectory()) yield* sources(full)
      else if (/\.(ts|tsx)$/.test(entry) && !SKIP.has(entry)) yield full
    }
  }

  it('no file outside vrmHumanoid.ts reads the humanoid map inline', () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of sources(path.join(process.cwd(), root))) {
        const text = readFileSync(file, 'utf8')
        if (INLINE.some((re) => re.test(text))) offenders.push(path.relative(process.cwd(), file))
      }
    }
    expect(offenders, `these files read humanBones themselves instead of through vrmHumanoid.ts: ${offenders.join(', ')}`).toEqual([])
  })
})
