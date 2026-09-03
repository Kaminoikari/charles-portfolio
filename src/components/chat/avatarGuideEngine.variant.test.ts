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
    const install = body.indexOf('installVrm(gltf.userData.vrm as VRM, url)')
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

  it('keeps the cyan flash for the first body only', () => {
    // The entrance runs on every body, but its COLOUR half does not: lerping a
    // replacement body 75% toward cyan for a second reads as broken colour
    // rather than as an arrival, which is how the owner reported it. Deleting
    // the counter term here brings that back, and no other test can see it.
    expect(fnBody('installVrm')).toMatch(/bodiesInstalled\+\+/)
    expect(SOURCE).toMatch(
      /const flashW =\s*bodiesInstalled === 1 && matzT >= 0 && matzT <= 1 \? \(1 - Math\.min\(matzT, 1\)\) \* 0\.75 : 0/,
    )
  })

  it('drops a result that a newer request, a teardown or a lost context overtook', () => {
    expect(fnBody('loadVariant')).toMatch(
      /if \(disposed \|\| contextLost \|\| seq !== loadSeq\) \{\s*VRMUtils\.deepDispose\(gltf\.scene\)\s*resolve\(false\)\s*return/,
    )
  })

  it('keeps the body on screen when a swap fails, and reports a failure only with none', () => {
    expect(fnBody('loadVariant')).toMatch(/if \(!disposed && !vrm && seq === loadSeq\) onLoadFailed\?\.\(\)/)
  })
})
