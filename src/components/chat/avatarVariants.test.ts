// One body, several appearances — and the wiring that makes the choice real.
//
// The registry on its own is easy to get wrong in a way no unit test would
// notice: AvatarGuide could resolve a variant and then load a constant, and
// every test of `variantUrl` would still pass while the site rendered the same
// body forever. That is the injection-bypasses-wiring shape, so the last test
// here reads ChatWidget's and AvatarGuide's source and requires the resolved
// URL to be what reaches the engine.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { ACTIVE_VARIANT, AVATAR_VARIANTS, variantUrl } from './avatarVariants'
import { readExpressions, readHumanoid, rigOf, type GltfJson } from './vrmHumanoid'

/**
 * The glTF JSON chunk of a served .vrm, parsed.
 *
 * A .vrm is a glb: 12-byte header, then length-prefixed chunks, of which the
 * first is the JSON. Reading it directly means these tests need no GPU and no
 * loader, which matters because jsdom cannot build the WebGLRenderer that the
 * real load path starts with.
 */
const parsed = new Map<string, GltfJson>()

function gltfOf(url: string): GltfJson {
  // Memoised because each body is a 5.5MB file with a multi-megabyte JSON chunk,
  // and the tests below ask for the same two files repeatedly. Parsing them per
  // assertion put enough CPU into the shared worker pool to time out an
  // unrelated ChatWidget test at its 5s budget.
  const hit = parsed.get(url)
  if (hit) return hit
  const raw = readFileSync(path.join(process.cwd(), 'public', url.replace(/^\//, '')))
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const jsonLength = view.getUint32(12, true)
  const doc = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + jsonLength))) as GltfJson
  parsed.set(url, doc)
  return doc
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

  it('gives every variant its own url', () => {
    // ChatWidget maps a settled URL back to an id with a first-match find, so
    // two entries sharing a file would mark the wrong chip as the body on
    // screen. Cheap to forbid here; invisible in the component.
    const urls = AVATAR_VARIANTS.map((v) => v.url)
    expect(new Set(urls).size, `two variants share a file: ${urls.join(', ')}`).toBe(urls.length)
  })

  it('gives every variant the same rig', () => {
    // The whole point of a variant registry is that the ten motion clips are
    // shared. Those clips' clearance numbers are absolute world-space distances
    // measured against one body, so a variant whose bones moved is a different
    // body wearing another body's numbers, and what a visitor sees is a hand
    // through a face. A repaint cannot move a bone; an export from a project
    // with a nudged body slider can, and looks identical in a file listing.
    //
    // Compared at the RIG, not the whole node/mesh/accessor set: an outfit is
    // different geometry on the same bones, which is exactly what this list is
    // for, and byte-identical meshes would forbid every real variant. What a
    // new mesh changes that the rig does not — a fingertip's distance to the
    // face, hair against the frame's top edge — is scripts/measure-motions.ts's
    // job, run per body before it is declared.
    const bodies = AVATAR_VARIANTS.map((v) => ({ id: v.id, doc: gltfOf(v.url) }))
    const [first, ...rest] = bodies
    expect(Object.keys(readHumanoid(first.doc).bones).length).toBeGreaterThan(50)
    for (const other of rest) {
      expect(
        rigOf(other.doc),
        `${other.id} does not share ${first.id}'s rig; the motion clips' clearances were measured on ${first.id}`,
      ).toBe(rigOf(first.doc))
    }
  })

  it('gives every variant the same expression names', () => {
    // Expressions and lip sync are looked up BY NAME on the loaded model
    // (avatarGuideEngine gates each recipe on availableEmotions.has(channel)),
    // and a missing name is a silent no-op: she simply stops making that face,
    // with no error anywhere. So the names are part of what a variant has to
    // keep, exactly as much as the bones are.
    // readExpressions throws on a file with neither VRM extension, and the
    // reference list is checked for the names the engine actually plays, so
    // "every body has no expressions" cannot pass as "every body has the same".
    const names = (url: string) => readExpressions(gltfOf(url)).join(',')
    const [first, ...rest] = AVATAR_VARIANTS
    const reference = readExpressions(gltfOf(first.url))
    expect(reference).toContain('Blink')
    expect(reference).toContain('A')
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
    // the URL handed to the engine comes from the registry through the
    // visitor's pick. Reintroducing a `const VRM_URL = '/avatar/....vrm'` in
    // either file and passing it is exactly the change that leaves every other
    // test in this file green.
    const read = (file: string) =>
      readFileSync(path.join(process.cwd(), 'src', 'components', 'chat', file), 'utf8')
    const widget = read('ChatWidget.tsx')
    const guide = read('AvatarGuide.tsx')
    for (const [name, source] of [
      ['ChatWidget', widget],
      ['AvatarGuide', guide],
    ] as const) {
      expect(
        source,
        `${name} must not carry a .vrm path of its own; declare it in avatarVariants`,
      ).not.toMatch(/['"][^'"]*\.vrm['"]/)
    }
    // The widget resolves the visitor's pick and hands the guide the URL...
    expect(widget, 'ChatWidget must resolve the wanted variant for the guide').toMatch(
      /vrmUrl=\{variantUrl\(variantWanted\)\}/,
    )
    expect(widget, 'the strip must offer the registry, not a list of its own').toMatch(
      /variants=\{AVATAR_VARIANTS\}/,
    )
    // ...which is what the engine is initialised with, and what a later change
    // of it is swapped to. Both, because dropping either leaves a body that
    // loads once and never changes, with every test above still green.
    expect(guide, 'the prop must be what initAvatarGuide receives').toMatch(
      /initAvatarGuide\(\s*canvas,\s*vrmUrlRef\.current/,
    )
    expect(guide, 'a change of the prop must reach the engine as a swap').toMatch(
      /loadVariant\(vrmUrl\)/,
    )
  })
})
