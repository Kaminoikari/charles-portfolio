// A part is the vertices its primitives DRAW, on either glTF layout.
//
// glTF lets a mesh's primitives share one vertex buffer and differ only in
// which triangles they draw, and every VRoid export in this repo does that:
// AvatarSample_B's hair is 77 primitives over a single 9,476-vertex accessor.
// A body build.py produced is the other layout, one accessor per primitive.
//
// `gather` and `deriveManifest` both used to read a primitive's attribute
// accessor and treat it as that primitive's vertices, which is only true on the
// second layout. On the first it silently means the WHOLE MESH, and the two
// callers broke in different directions:
//
//   - `gather` stacked the same buffer once per primitive. AvatarSample_B's
//     hair set was 729,652 vertices holding 6,974 distinct positions.
//   - `deriveManifest` gave every primitive of the hair mesh the same
//     mesh-wide spring share, strands and static scalp averaged together. That
//     average is 35.0% on Vita and 35.3% on Vivi, under SPRING_DOMINATED, so
//     those bodies derived NO moving hair and the simulator refused to run.
//
// The three committed bodies below cover all three layouts between them, so
// these are marked against real files rather than against a constructed one.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseGlb, readAccessorRows } from '../../src/components/chat/vrmHumanoid'
import { deriveManifest, drawnVertices, gather, type GltfPrimitive } from './springsim'

const body = (file: string): string => path.resolve('public/avatar', file)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGlb = { json: any; bin: Uint8Array }
const glbOf = (file: string): AnyGlb => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = parseGlb<any>(new Uint8Array(readFileSync(file)))
  if (!g.bin) throw new Error(`no BIN chunk in ${file}`)
  return { json: g.json, bin: g.bin }
}

const cache = new Map<string, AnyGlb>()
const load = (file: string): AnyGlb => {
  const at = body(file)
  const hit = cache.get(at)
  if (hit) return hit
  const g = glbOf(at)
  cache.set(at, g)
  return g
}

/** Independently: which vertices does this part's triangles reference? */
const drawnByHand = (g: AnyGlb, meshName: string, primitives: number[]): Map<number, Set<number>> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mesh = g.json.meshes.find((m: any) => m.name === meshName)
  if (!mesh) throw new Error(`no mesh ${meshName}`)
  const per = new Map<number, Set<number>>()
  for (const pi of primitives) {
    const prim = mesh.primitives[pi] as GltfPrimitive
    const a = prim.attributes.POSITION
    const seen = per.get(a) ?? new Set<number>()
    per.set(a, seen)
    if (prim.indices === undefined) {
      for (let i = 0; i < g.json.accessors[a].count; i++) seen.add(i)
      continue
    }
    const idx = readAccessorRows(g, prim.indices)
    for (let k = 0; k < idx.data.length; k++) seen.add(idx.data[k])
  }
  return per
}

describe('a part is what its primitives draw, whichever way the file is laid out', () => {
  it('reads a shared vertex buffer once, not once per primitive', () => {
    // AvatarSample_B is the shared-buffer layout. Pinned here, so that if the
    // fixture is ever replaced by a file laid out the other way this test says
    // so instead of quietly becoming a second copy of the milfy case.
    const g = load('AvatarSample_B_webp.vrm')
    const manifest = deriveManifest(g)
    const hair = Object.entries(manifest.parts).find(([k]) => k.startsWith('Hair'))
    expect(hair).toBeDefined()
    const [name, part] = hair as [string, { mesh: string; primitives: number[] }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mesh = g.json.meshes.find((m: any) => m.name === part.mesh)
    const accessors = new Set(part.primitives.map((pi: number) => mesh.primitives[pi].attributes.POSITION))
    expect(part.primitives.length).toBeGreaterThan(20)
    expect(accessors.size).toBe(1)

    const buffer = g.json.accessors[[...accessors][0]].count as number
    const set = gather(g.json, g.bin, manifest, name, 1)
    // The old code returned primitives.length * buffer. The new code cannot
    // return more than the buffer holds, however many primitives point at it.
    expect(set.n).toBeLessThanOrEqual(buffer)
    expect(set.n).toBe([...drawnByHand(g, part.mesh, part.primitives).values()][0].size)
  })

  it('splits one shared buffer between moving hair and everything else', () => {
    // The point of a per-primitive share. A VRoid hair mesh holds the strands
    // AND the static scalp cap in one buffer, so measured mesh-wide it reads a
    // single number for every primitive and the mesh can only go entirely one
    // way. On Vita and Vivi that number is 35%, under the threshold, and they
    // derived no hair at all. On AvatarSample_B it is over the threshold, so
    // the whole mesh became hair INCLUDING the scalp that never moves.
    //
    // Either way the mesh-wide reading cannot split a mesh, and that is what
    // this pins: the hair mesh's primitives land in two different roles, and
    // between them they account for all of it.
    const g = load('AvatarSample_B_webp.vrm')
    const parts = deriveManifest(g).parts
    const hair = Object.entries(parts).find(([k]) => k.startsWith('Hair'))
    expect(hair).toBeDefined()
    const [, hairPart] = hair as [string, { mesh: string; primitives: number[] }]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mesh = g.json.meshes.find((m: any) => m.name === hairPart.mesh)
    const total = mesh.primitives.length as number
    expect(hairPart.primitives.length).toBeGreaterThan(0)
    expect(hairPart.primitives.length).toBeLessThan(total)

    // The rest of that same mesh, under some other role.
    const others = Object.entries(parts).filter(
      ([k, v]) => !k.startsWith('Hair') && v.mesh === hairPart.mesh,
    )
    const rest = others.reduce((s, [, v]) => s + v.primitives.length, 0)
    expect(rest).toBeGreaterThan(0)
    expect(hairPart.primitives.length + rest).toBe(total)
  })

  it('never lets a hair mesh be the body the penetration test measures against', () => {
    // Once the share is read per primitive a VRoid hair mesh splits, and its
    // static half lands in the Body_Skin role carrying more primitives than the
    // actual body mesh has. Ranked on primitive count it took the canonical
    // name, so `bodyDepthMm` was measured against static hair, which moving
    // strands lie flat against: mika-pink read 50mm on all ten clips, the
    // saturation cap.
    const g = load('AvatarSample_B_webp.vrm')
    const parts = deriveManifest(g).parts
    const hairMeshes = new Set(
      Object.entries(parts).filter(([k]) => k.startsWith('Hair')).map(([, v]) => v.mesh),
    )
    expect(hairMeshes.size).toBeGreaterThan(0)
    expect(parts.Body_Skin).toBeDefined()
    expect(hairMeshes.has(parts.Body_Skin.mesh)).toBe(false)

    // The fixture has to actually pose the problem: that same hair mesh must
    // have left primitives in the Body_Skin role, or a rule that ignores the
    // question entirely would pass this.
    const trailing = Object.entries(parts).filter(
      ([k, v]) => k.startsWith('Body_Skin') && k !== 'Body_Skin' && hairMeshes.has(v.mesh),
    )
    expect(trailing.length).toBeGreaterThan(0)
    // and they are still listed, so they are skinned and the crown sees them
    expect(trailing[0][1].primitives.length).toBeGreaterThan(
      parts.Body_Skin.primitives.length,
    )
  })

  it('leaves out buffer vertices no triangle references', () => {
    // vroid-studio-dressup buffers 3,295 vertices for an inner-top part whose
    // triangles reference 298 of them. The other 2,997 are not drawn anywhere,
    // and putting them in a collision shell puts phantom geometry in it.
    const g = load('vroid-studio-dressup.vrm')
    const manifest = JSON.parse(
      readFileSync(body('vroid-studio-dressup.parts.json'), 'utf8'),
    ) as Parameters<typeof gather>[2]
    const name = 'Body_Skin_Inner_Top'
    const part = manifest.parts[name]
    expect(part).toBeDefined()
    const accessor = g.json.meshes.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any) => m.name === part.mesh,
    ).primitives[part.primitives[0]].attributes.POSITION
    const buffered = g.json.accessors[accessor].count as number
    const drawn = [...drawnByHand(g, part.mesh, part.primitives).values()][0].size
    // The fixture has to actually have undrawn vertices or this proves nothing.
    expect(drawn).toBeLessThan(buffered)
    expect(gather(g.json, g.bin, manifest, name, 1).n).toBe(drawn)
  })

  it('is unchanged on a body whose primitives each own their buffer', () => {
    // mika-milfy-12 is the layout the old code was written for and the one the
    // shipped clearance was measured on. Every one of its parts draws its whole
    // buffer, so the new rule has to return exactly what the old one did.
    const g = load('mika-milfy-12.vrm')
    const manifest = JSON.parse(
      readFileSync(body('mika-milfy-12.parts.json'), 'utf8'),
    ) as Parameters<typeof gather>[2]
    let checked = 0
    for (const [name, part] of Object.entries(manifest.parts)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mesh = g.json.meshes.find((m: any) => m.name === part.mesh)
      const accessors = new Set(part.primitives.map((pi: number) => mesh.primitives[pi].attributes.POSITION))
      if (accessors.size !== part.primitives.length) continue // the Face, which shares
      const buffered = [...accessors].reduce((s, a) => s + (g.json.accessors[a].count as number), 0)
      expect(gather(g.json, g.bin, manifest, name, 1).n).toBe(buffered)
      checked++
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('counts every vertex of a primitive that carries no index list', () => {
    const g = load('mika-milfy-12.vrm')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prim = g.json.meshes[0].primitives[0] as GltfPrimitive
    const count = g.json.accessors[prim.attributes.POSITION].count as number
    const bare: GltfPrimitive = { attributes: prim.attributes }
    expect(bare.indices).toBeUndefined()
    expect(drawnVertices(g, bare).size).toBe(count)
  })

  it('produces the same set twice, so a re-measured file can be diffed', () => {
    const g = load('AvatarSample_B_webp.vrm')
    const manifest = deriveManifest(g)
    const name = Object.keys(manifest.parts).find((k) => k.startsWith('Hair')) as string
    const a = gather(g.json, g.bin, manifest, name, 1)
    const b = gather(g.json, g.bin, manifest, name, 1)
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos))
    expect(Array.from(a.nrm)).toEqual(Array.from(b.nrm))
  })
})
