// One body, several appearances — and the wiring that makes the choice real.
//
// The registry on its own is easy to get wrong in a way no unit test would
// notice: AvatarGuide could resolve a variant and then load a constant, and
// every test of `variantUrl` would still pass while the site rendered the same
// body forever. That is the injection-bypasses-wiring shape, so the last test
// here reads AvatarGuide's source and requires the resolved URL to be what
// reaches the engine.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACTIVE_VARIANT, AVATAR_VARIANTS, variantUrl } from './avatarVariants'

/** Just enough of the glTF document to compare two bodies. */
interface VrmDoc {
  nodes: unknown
  skins?: unknown
  scenes: unknown
  scene?: number
  meshes: unknown
  accessors: unknown
  extensions: {
    VRM: {
      humanoid: unknown
      blendShapeMaster: { blendShapeGroups: { name: string }[] }
    }
  }
}

/**
 * The glTF JSON chunk of a served .vrm, parsed.
 *
 * A .vrm is a glb: 12-byte header, then length-prefixed chunks, of which the
 * first is the JSON. Reading it directly means these tests need no GPU and no
 * loader, which matters because jsdom cannot build the WebGLRenderer that the
 * real load path starts with.
 */
const parsed = new Map<string, VrmDoc>()

function gltfOf(url: string): VrmDoc {
  // Memoised because each body is a 5.5MB file with a multi-megabyte JSON chunk,
  // and the tests below ask for the same two files repeatedly. Parsing them per
  // assertion put enough CPU into the shared worker pool to time out an
  // unrelated ChatWidget test at its 5s budget.
  const hit = parsed.get(url)
  if (hit) return hit
  const raw = readFileSync(path.join(process.cwd(), 'public', url.replace(/^\//, '')))
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const jsonLength = view.getUint32(12, true)
  const doc = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + jsonLength))) as VrmDoc
  parsed.set(url, doc)
  return doc
}

/** Everything that has to be identical across variants, as one comparable string. */
function skeletonOf(doc: VrmDoc): string {
  return JSON.stringify([
    doc.nodes,
    doc.skins,
    doc.scenes,
    doc.scene ?? 0,
    doc.meshes,
    doc.accessors,
    doc.extensions.VRM.humanoid,
  ])
}

describe('avatar variants', () => {
  it('resolves the active variant by default', () => {
    const active = AVATAR_VARIANTS.find((v) => v.id === ACTIVE_VARIANT)
    expect(active, `ACTIVE_VARIANT "${ACTIVE_VARIANT}" is not declared`).toBeDefined()
    expect(variantUrl()).toBe(active!.url)
  })

  it('refuses an id it does not know instead of quietly using the default', () => {
    // A fallback here is the worst possible behaviour for the one workflow this
    // exists for: someone adds an outfit, mistypes the id, and sees the old
    // body — which reads as "the swap does not work" rather than "typo".
    expect(() => variantUrl('outfit-that-was-never-declared')).toThrow(/unknown avatar variant/)
    expect(() => variantUrl('outfit-that-was-never-declared')).toThrow(/declared: /)
  })

  it('declares only files that are actually served', () => {
    // /avatar/* is cache-immutable, so a variant pointing at a path that does
    // not exist is a body that never loads and a launcher that never becomes a
    // character. Cheap to check here, invisible until someone opens the site.
    for (const v of AVATAR_VARIANTS) {
      expect(v.url, `${v.id} must be served from /avatar/`).toMatch(/^\/avatar\/.+\.vrm$/)
      const onDisk = path.join(process.cwd(), 'public', v.url.replace(/^\//, ''))
      expect(existsSync(onDisk), `${v.id} points at a missing file: ${v.url}`).toBe(true)
    }
  })

  it('gives every variant its own id', () => {
    const ids = AVATAR_VARIANTS.map((v) => v.id)
    expect(new Set(ids).size, `duplicate variant ids: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('gives every variant the same skeleton', () => {
    // The whole point of a variant registry is that the ten motion clips are
    // shared. Those clips' clearance numbers are absolute world-space distances
    // measured against one body, so a variant whose bones moved is a different
    // body wearing another body's numbers, and what a visitor sees is a hand
    // through a face. A repaint cannot move a bone; an export from a project
    // with a nudged body slider can, and looks identical in a file listing.
    const bodies = AVATAR_VARIANTS.map((v) => ({ id: v.id, doc: gltfOf(v.url) }))
    const [first, ...rest] = bodies
    for (const other of rest) {
      expect(
        skeletonOf(other.doc),
        `${other.id} does not share ${first.id}'s skeleton; the motion clips' clearances were measured on ${first.id}`,
      ).toBe(skeletonOf(first.doc))
    }
  })

  it('gives every variant the same expression names', () => {
    // Expressions and lip sync are looked up BY NAME on the loaded model
    // (avatarGuideEngine gates each recipe on availableEmotions.has(channel)),
    // and a missing name is a silent no-op: she simply stops making that face,
    // with no error anywhere. So the names are part of what a variant has to
    // keep, exactly as much as the bones are.
    const names = (url: string) =>
      gltfOf(url).extensions.VRM.blendShapeMaster.blendShapeGroups.map((g) => g.name).join(',')
    const [first, ...rest] = AVATAR_VARIANTS
    for (const other of rest) {
      expect(
        names(other.url),
        `${other.id} is missing expressions ${first.id} has; emotions and visemes would silently stop firing`,
      ).toBe(names(first.url))
    }
  })

  it('loads the resolved variant rather than a constant of its own', () => {
    // Structural, and deliberately so: AvatarGuide builds a WebGLRenderer in
    // its first frames, so jsdom cannot run the load. What this can say is that
    // the URL handed to the engine comes from the registry. Reintroducing a
    // `const VRM_URL = '/avatar/....vrm'` and passing it is exactly the change
    // that leaves every other test in this file green.
    const source = readFileSync(
      path.join(process.cwd(), 'src', 'components', 'chat', 'AvatarGuide.tsx'),
      'utf8',
    )
    expect(source, 'AvatarGuide must resolve the variant').toMatch(/\bvariantUrl\(\)/)
    expect(
      source,
      'AvatarGuide must not carry a .vrm path of its own; declare it in avatarVariants',
    ).not.toMatch(/['"][^'"]*\.vrm['"]/)
    // And the resolved value has to be the argument the engine is initialised
    // with, not merely mentioned somewhere in the file.
    expect(source, 'the resolved URL must be what initAvatarGuide receives').toMatch(
      /initAvatarGuide\(\s*canvas,\s*variantUrl\(\)/,
    )
  })
})
