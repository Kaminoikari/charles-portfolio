import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The engine cannot run under jsdom (see avatarGuideEngine.wiring.test.ts for
// why, and for the shape of this file). What a body swap has to keep true is
// structural and easy to lose in an edit: the first load and the swap MUST be
// one code path, or the swap quietly stops doing something the first load does
// (rebinding clips, capturing materials, re-arming the entrance) and every
// other test stays green because none of them can load a body. So this reads
// the source, one `it` per invariant. A rename fails it and should be fixed
// by updating the pattern; a deletion fails it and must not be.
const SOURCE = readFileSync(
  path.join(process.cwd(), 'src', 'components', 'chat', 'avatarGuideEngine.ts'),
  'utf8',
)

/** The body of one of the engine's inner functions, up to its own closing brace. */
function fnBody(name: string): string {
  const start = SOURCE.indexOf(`  function ${name}(`)
  if (start < 0) throw new Error(`no ${name} in the engine`)
  const rest = SOURCE.slice(start)
  const end = rest.indexOf('\n  }\n')
  if (end < 0) throw new Error(`unterminated ${name}`)
  return rest.slice(0, end)
}

function handlerBody(name: string): string {
  const start = SOURCE.indexOf(`  const handle: AvatarGuideHandle = {`)
  const rest = SOURCE.slice(start)
  const end = rest.indexOf('\n  }\n')
  const body = rest.slice(0, end)
  if (!body.includes(name)) throw new Error(`no ${name} on the handle`)
  return body
}

describe('a body swap is the first load, run again', () => {
  it('loads the first body through loadVariant, so the two paths are one', () => {
    expect(SOURCE).toMatch(/^ {2}void loadVariant\(vrmUrl\)$/m)
    // And nothing else fetches a body: one loader.load for the VRM.
    expect(SOURCE.match(/loader\.load\(/g)).toHaveLength(1)
  })

  it('exposes the swap on the handle', () => {
    expect(handlerBody('loadVariant')).toMatch(/^ {4}loadVariant,$/m)
  })

  it('releases the old body before installing the new one', () => {
    const body = fnBody('loadVariant')
    const release = body.indexOf('uninstallVrm()')
    const install = body.indexOf('installVrm(gltf.userData.vrm as VRM, url, family)')
    expect(release).toBeGreaterThan(-1)
    expect(install).toBeGreaterThan(release)
  })

  it("releases the old body's scene, clips and mixer", () => {
    const body = fnBody('uninstallVrm')
    expect(body).toMatch(/scene\.remove\(vrm\.scene\)/)
    expect(body).toMatch(/VRMUtils\.deepDispose\(vrm\.scene\)/)
    expect(body).toMatch(/motionClips\.clear\(\)/)
    expect(body).toMatch(/mixer = null/)
    // A clip on its way out still owns bones; it is stopped, not abandoned.
    expect(body).toMatch(/stopMotion\(\)/)
  })

  it('rebinds every motion clip to the new bones instead of fetching again', () => {
    // A clip is built against one body's bone nodes, so the parsed source is
    // kept at load...
    expect(fnBody('loadMotion')).toMatch(/motionSources\.set\(name, animation\)/)
    // ...and every clip is rebuilt from it on install.
    expect(fnBody('installVrm')).toMatch(
      /for \(const \[name, animation\] of motionSources\)\s*motionClips\.set\(name, createVRMAnimationClip\(animation, loaded\)\)/,
    )
  })

  it('materializes the new body the way it did the first', () => {
    const body = fnBody('installVrm')
    expect(body).toMatch(/matzT = -1/)
    // A swap can land mid-entrance; the running particles go first.
    expect(body.indexOf('disposeParticles()')).toBeLessThan(body.indexOf('matzT = -1'))
  })

  it('never writes colour during the entrance', () => {
    // The entrance used to open every body 75% toward cyan and fade over a
    // second. On a swapped body that read as broken colour (fixed 2026-09-03,
    // first body only); on the first body the owner read it as "Mika changes
    // colour every time the site opens" (2026-09-04). The scale pop, the
    // particles and the shadow stay; m.color is the answering tint's and the
    // pale emotion's alone. Re-adding a flash term brings both reports back.
    expect(SOURCE).not.toMatch(/CYAN_FLASH|flashW|bodiesInstalled/)
    expect(SOURCE).toMatch(/if \(tint > 0 \|\| paleW > 0\.003\) \{/)
  })

  it('drops a result that a newer request, a teardown or a lost context overtook', () => {
    expect(fnBody('loadVariant')).toMatch(
      /if \(disposed \|\| contextLost \|\| seq !== loadSeq\) \{\s*VRMUtils\.deepDispose\(gltf\.scene\)\s*resolve\(false\)\s*return/,
    )
  })

  it('keeps the body on screen when a swap fails, and reports a failure only with none', () => {
    expect(fnBody('loadVariant')).toMatch(/if \(!disposed && !vrm && seq === loadSeq\) onLoadFailed\?\.\(\)/)
  })

  it('takes the new body onto its own family, so the clip pool follows the swap', () => {
    // Which clips she offers is a property of the SKELETON she is wearing, not
    // of the one she loaded first (motionsFor's second argument). A swap that
    // set shownUrl and left shownFamily behind would keep offering the previous
    // family's pool, and on a body that excludes a clip that is a clip
    // retargeted onto a skeleton nobody measured it on.
    //
    // Structural, and it has to be: the engine needs a WebGLRenderer, so no
    // test here can perform an actual swap and read the pool back.
    const install = fnBody('installVrm')
    expect(install, 'installVrm must set the family of the body it installs').toMatch(
      /shownUrl = url\s*(?:\/\/[^\n]*\n\s*)*shownFamily = family/,
    )
    // And the two readers ask for it rather than naming a family of their own.
    expect(SOURCE).toMatch(/motionsFor\(placement, shownFamily\)/)
    expect(SOURCE).toMatch(/motionsFor\(asked, shownFamily\)/)
    expect(SOURCE, 'the engine must not hard-code a family id').not.toMatch(/motionsFor\([^)]*'[a-z-]+'\)/)
  })

  it('settles the family before it releases the body on screen', () => {
    // Ordering, and it is the whole guard. familyFor returns null for a body
    // nothing declared, and resolving that AFTER uninstallVrm would put the new
    // body in the scene with no clips bound and resolve(true) never reached:
    // the promise never settles, so the look strip stays busy for the life of
    // the page. Resolved first, an undeclared URL costs nothing and changes
    // nothing — the same outcome as a 404, which is what the visitor sees.
    const body = fnBody('loadVariant')
    const resolveFamily = body.indexOf('const family = familyFor(url)')
    const release = body.indexOf('uninstallVrm()')
    expect(resolveFamily, 'loadVariant must resolve the family itself').toBeGreaterThan(-1)
    expect(release).toBeGreaterThan(resolveFamily)
    // ...and refuse rather than continue, reporting on the same condition the
    // 404 path uses (a visitor who can still see her gets no error).
    expect(body).toMatch(
      /if \(!family\) \{(?:\s*\/\/[^\n]*)*\s*if \(!disposed && !vrm\) onLoadFailed\?\.\(\)\s*return Promise\.resolve\(false\)/,
    )
    // installVrm is handed the settled family, so it has no lookup left to fail.
    expect(body).toMatch(/installVrm\(gltf\.userData\.vrm as VRM, url, family\)/)
    // And nothing resolves a family anywhere else. The declaration is an arrow
    // (`const familyFor = (url: string) =>`), so this counts CALLS, and there
    // is exactly the one above: a second resolution somewhere later is how the
    // ordering this test pins gets quietly reintroduced.
    expect(SOURCE.match(/familyFor\(/g), 'familyFor is called once, in loadVariant').toHaveLength(1)
  })

  it('lets the registry outrank a caller-declared family', () => {
    // declaredFamily is a FALLBACK for a body the registry has never heard of,
    // which is the only thing it is documented to be. Written the other way
    // round it silently outranks the registry for bodies the registry does
    // know: point the preview tool at a declared body of a second family while
    // its own constant still names the first, and every clip is filtered by the
    // wrong family's exclusions and judged against the wrong clearances — the
    // one mistake the whole family layer exists to prevent. One `??` apart, and
    // nothing else in the suite can tell the two orders apart while exactly one
    // family is declared.
    expect(SOURCE, 'the registry answers first; declaredFamily only fills a gap').toMatch(
      /familyOfUrl\(url\) \?\? declaredFamily/,
    )
  })
})
