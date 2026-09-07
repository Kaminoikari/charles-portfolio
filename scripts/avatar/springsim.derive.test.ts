// The parts a body is measured in, when no build wrote them down.
//
// springsim needs a manifest (which primitives are hair, which are the face,
// where the waist is) and the build writes one beside every body it produces.
// Bodies it did not produce — mika-pink, the base sample, any fixture — have
// none, and before this the clearance for those could only come from a browser
// scan. deriveManifest reads the parts off the file itself: hair is what the
// spring bones actually move, the face is what the expressions deform, and
// everything else is one skin part.
//
// It is checked against the SHIPPED Milfy body, the one case where a derived
// manifest and a written one can be compared property by property.
//
// Its own file rather than a describe inside springsim.test.ts: both are
// CPU-bound simulations, and one worker blocked for 60s straight makes vitest
// report an unhandled "Timeout calling onTaskUpdate" over a run that passed.
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AVATAR_VARIANTS } from '../../src/components/chat/avatarVariants'
import { parseGlb } from '../../src/components/chat/vrmHumanoid'
import { deriveManifest, parseArgs, runClip } from './springsim'

const milfy = AVATAR_VARIANTS.find((v) => v.id === 'milfy')
if (!milfy) throw new Error('no milfy variant declared')
const MODEL = process.env.SPRINGSIM_TEST_MODEL ?? path.resolve('public', milfy.url.replace(/^\//, ''))

function clipFile(clip: string): string {
  return path.resolve('public/avatar/animations', `${clip}.vrma`)
}

describe('parts read off the file, for a body no build wrote a manifest for', () => {
  // The simulator could only ever run on a body this pipeline had built, which
  // left the Seed-san fixture unmeasurable and left mika-pink and the base body
  // with no simulated crown at all (their clearance falls back to a browser
  // scan). deriveManifest reads the roles off the file. This body HAS a real
  // manifest, so it is the one place the derivation can be marked against a
  // truth rather than judged by whether it looks sensible.
  const glbOf = (file: string) => {
    const raw = readFileSync(file)
    const g = parseGlb<Parameters<typeof deriveManifest>[0]['json']>(new Uint8Array(raw))
    if (!g.bin) throw new Error('no BIN chunk')
    return { json: g.json, bin: g.bin }
  }
  const truth = JSON.parse(readFileSync(MODEL.replace(/\.vrm$/, '.parts.json'), 'utf8')) as {
    parts: Record<string, { mesh: string; primitives: number[] }>
    landmarks: { waist: number }
  }
  const key = (mesh: string, pi: number) => `${mesh}[${pi}]`
  // Derived once, lazily, rather than in a beforeAll: the derivation re-parses
  // an 11MB GLB and walks every vertex, so it must not run once per test, and a
  // hook that throws fails the whole SUITE, which is a much weaker receipt than
  // a named assertion going red (evidence/reviewfix-0907-mutate.py, X7).
  let cached: ReturnType<typeof deriveManifest> | null = null
  const derived = (): ReturnType<typeof deriveManifest> => (cached ??= deriveManifest(glbOf(MODEL)))

  it('calls moving hair hair, and calls nothing else hair', () => {
    const saidHair = new Set<string>()
    for (const [name, part] of Object.entries(derived().parts)) {
      if (name.startsWith('Hair_')) for (const pi of part.primitives) saidHair.add(key(part.mesh, pi))
    }
    const reallyHair = new Set<string>()
    for (const [name, part] of Object.entries(truth.parts)) {
      if (name.startsWith('Hair_')) for (const pi of part.primitives) reallyHair.add(key(part.mesh, pi))
    }
    expect(saidHair.size, 'the derivation finds moving hair at all').toBeGreaterThan(0)
    // One direction only, and it is the one that matters. Everything it calls
    // hair really is hair; the reverse is false by design, because the bangs
    // and the scalp cap are skinned to the head bone and have no springs — they
    // are still listed (under Body_Skin), which is what the crown needs.
    for (const k of saidHair) expect(reallyHair.has(k), `derived Hair_* contains ${k}, which the build calls something else`).toBe(true)
  })

  it('puts every skinned primitive somewhere, so the crown still sees the whole body', () => {
    const listed = new Set<string>()
    for (const part of Object.values(derived().parts)) for (const pi of part.primitives) listed.add(key(part.mesh, pi))
    const everything = new Set<string>()
    for (const part of Object.values(truth.parts)) for (const pi of part.primitives) everything.add(key(part.mesh, pi))
    for (const k of everything) expect(listed.has(k), `${k} is in the build's manifest but nothing derived lists it`).toBe(true)
  })

  it('names one Face and one Body_Skin, whatever the mesh layout is', () => {
    // runClip asks for those two keys exactly. A body with several meshes in a
    // role (the fixture has five meshes) must still answer them, or the
    // simulator refuses a body it could have measured.
    expect(derived().parts.Face, 'Face').toBeDefined()
    expect(derived().parts.Body_Skin, 'Body_Skin').toBeDefined()
    expect(derived().derived, 'the manifest says it was derived, so main can say so too').toBe(true)
  })

  it('simulates a body with no manifest beside it, and gets a crown out of it', async () => {
    // The two simulations live in the test rather than in a hook for the same
    // reason the derivation above does: a hook that throws fails the whole
    // suite, and a suite failure names no assertion.
    const dir = mkdtempSync(path.join(tmpdir(), 'springsim-noparts-'))
    const bare = path.join(dir, 'no-manifest.vrm')
    copyFileSync(MODEL, bare)
    const noParts = await runClip(parseArgs([bare, '--clip=dance', '--stride=6']), clipFile('dance'))
    const built = await runClip(parseArgs([MODEL, '--clip=dance', '--stride=6']), clipFile('dance'))
    // The scenario, not the unit: mika-pink and the base body are VRoid exports
    // this pipeline never built, so no .parts.json exists for them and their
    // clearance has to fall back to a browser scan for the crown. The simulator
    // has to come back with a crown rather than an error.
    expect(noParts.restCrownY, 'a resting crown').toBeGreaterThan(1)
    expect(noParts.crownY, 'the dance throws it higher than it rests').toBeGreaterThan(noParts.restCrownY)
    // And it is the same crown the built manifest gives, because the crown is
    // the topmost vertex of everything listed and both list every primitive:
    // the built manifest by naming them, the derived one by sweeping whatever
    // is not moving hair or face into Body_Skin.
    expect(Math.abs(noParts.crownY - built.crownY), 'crown, derived parts vs built').toBeLessThanOrEqual(0.002)
    expect(Math.abs(noParts.restCrownY - built.restCrownY), 'rest crown, derived vs built').toBeLessThanOrEqual(0.002)
    // And it says which columns it could not measure. A derived manifest names
    // no cardigan and no skirt, so their eight columns carry values nothing
    // produced: 0 for the depths, and for `yaw` whichever frame came first.
    // The table prints `—` for them off these two flags, so a column of zeros
    // cannot be read as a clean result.
    expect(noParts.hasCoat, 'a derived manifest has no cardigan').toBe(false)
    expect(noParts.hasSkirt, 'and no skirt').toBe(false)
    expect(built.hasCoat, 'the built one has both').toBe(true)
    expect(built.hasSkirt).toBe(true)
  }, 180_000)

  it('refuses a body whose skinned meshes it cannot address by name', () => {
    // A manifest names a mesh and gather() looks it up by that name, so two
    // meshes sharing one -- or one with no name at all -- would produce a
    // manifest that reads one mesh's primitive indices off another, or resolves
    // to nothing. Both are refused with the names in the message.
    const twoAlike = glbOf(MODEL)
    const skinned = twoAlike.json.nodes.filter((n) => n.mesh !== undefined && n.skin !== undefined)
    expect(skinned.length, 'the body has several skinned meshes to muddle').toBeGreaterThan(1)
    const first = twoAlike.json.meshes[skinned[0].mesh as number]
    const second = twoAlike.json.meshes[skinned[1].mesh as number]
    const shared = first.name as string
    second.name = shared
    expect(() => deriveManifest(twoAlike)).toThrowError(new RegExp(shared))

    const nameless = glbOf(MODEL)
    const anon = nameless.json.nodes.filter((n) => n.mesh !== undefined && n.skin !== undefined)[0]
    delete nameless.json.meshes[anon.mesh as number].name
    expect(() => deriveManifest(nameless)).toThrowError(/沒有名字/)
  })

  it('puts the waist within a hand of where the build measured it', () => {
    // The build finds the waist where the torso is narrowest; this uses the
    // hips joint, which is the landmark that narrow point sits nearest. The
    // only consumer is the coat's hem band (waist − 4cm), so being close is
    // the whole requirement — but "close" has to be stated, or a derivation
    // that returned zero would pass everything above.
    expect(Math.abs(derived().landmarks.waist - truth.landmarks.waist)).toBeLessThan(0.1)
  })
})
