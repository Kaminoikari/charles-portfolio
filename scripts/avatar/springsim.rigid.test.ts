// A body whose crown no spring can move, and what springsim may still say about it.
//
// The VRoid Studio dress-up export of 2026-09-09 declares sixteen spring groups
// and only the bust appears in any skin's joint list, so its crown is rigid
// geometry the humanoid poses (evidence/parts-0909.md). springsim used to refuse
// such a body outright, which left that whole rig family with no simulated crown
// and its candidate allowlist empty.
//
// Its own file rather than a describe inside springsim.derive.test.ts, for the
// reason that file's header gives: these are CPU-bound simulations, and one
// worker blocked for 60s straight makes vitest report an unhandled "Timeout
// calling onTaskUpdate" over a run that passed.
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AVATAR_VARIANTS } from '../../src/components/chat/avatarVariants'
import { parseGlb } from '../../src/components/chat/vrmHumanoid'
import { parseArgs, runClip } from './springsim'

const milfy = AVATAR_VARIANTS.find((v) => v.id === 'milfy')
if (!milfy) throw new Error('no milfy variant declared')
const MODEL = process.env.SPRINGSIM_TEST_MODEL ?? path.resolve('public', milfy.url.replace(/^\//, ''))

function clipFile(clip: string): string {
  return path.resolve('public/avatar/animations', `${clip}.vrma`)
}

describe('a body whose hair no spring moves', () => {
  // The VRoid Studio dress-up export of 2026-09-09 declares sixteen spring
  // groups and only the bust appears in any skin's joint list, so its crown is
  // rigid geometry the humanoid poses (evidence/parts-0909.md). springsim used
  // to refuse that body outright, which left the whole family with no simulated
  // crown and the candidate allowlist empty.
  //
  // Letting it through is safe because the crown does not depend on which
  // primitive is called the hair, which the second test here measures rather
  // than assumes. What the hair list does decide is the jump columns and the
  // four tuning flags, and the third test holds the flags.
  const dir = mkdtempSync(path.join(tmpdir(), 'springsim-rigid-'))
  const truthParts = JSON.parse(readFileSync(MODEL.replace(/\.vrm$/, '.parts.json'), 'utf8')) as {
    parts: Record<string, { mesh: string; primitives: number[] }>
    landmarks: { waist: number }
  }

  /** The model with its glTF JSON edited, written where runClip can read it. */
  function repack(to: string, edit: (json: Record<string, unknown>) => void): string {
    const g = parseGlb<Record<string, unknown>>(new Uint8Array(readFileSync(MODEL)))
    if (!g.bin) throw new Error('no BIN chunk')
    edit(g.json)
    const json = Buffer.from(JSON.stringify(g.json))
    const bin = Buffer.from(g.bin)
    const jsonPad = (4 - (json.length % 4)) % 4
    const binPad = (4 - (bin.length % 4)) % 4
    const out = Buffer.alloc(12 + 8 + json.length + jsonPad + 8 + bin.length + binPad)
    let at = 0
    const u32 = (v: number): void => void (at = out.writeUInt32LE(v, at))
    u32(0x46546c67); u32(2); u32(out.length)
    u32(json.length + jsonPad); u32(0x4e4f534a)
    json.copy(out, at); at += json.length
    out.fill(0x20, at, at + jsonPad); at += jsonPad
    u32(bin.length + binPad); u32(0x004e4942)
    bin.copy(out, at); at += bin.length
    out.fill(0, at, at + binPad)
    writeFileSync(to, out)
    return to
  }

  /** The shipped manifest, written beside `model`, with `parts` replaced. */
  function withParts(model: string, parts: typeof truthParts.parts): string {
    writeFileSync(model.replace(/\.vrm$/, '.parts.json'),
      JSON.stringify({ parts, landmarks: truthParts.landmarks }))
    return model
  }

  // The shipped body under the same clip, run once and shared: two tests want
  // it, and a worker blocked for 60s straight makes vitest report an unhandled
  // "Timeout calling onTaskUpdate" over a run that passed (see this file's
  // header). Lazily, so a throw is an assertion failure and not a suite one.
  //
  // `spin` rather than `dance` for the same reason. Renaming the 65 Hair_*
  // parts drops them out of the stride rule (gather strides Hair_* and
  // Outfit_Bottom, everything else is every vertex), so the misnamed run
  // queries six times as much hair as the named one whatever --stride says;
  // spin is 9.32s against dance's 26.80s and still turns the twintails 12°.
  let shippedRun: Promise<Awaited<ReturnType<typeof runClip>>> | null = null
  const shipped = (): Promise<Awaited<ReturnType<typeof runClip>>> =>
    (shippedRun ??= runClip(parseArgs([MODEL, '--clip=spin', '--stride=6']), clipFile('spin')))

  /**
   * The shipped body with only its bust springs kept: springs that still move
   * 4,178 drawn vertices, half a metre under the crown, which is the shape the
   * dress-up export has. Its own manifest still names the twintails `Hair_*`,
   * so hairJoints comes back empty and this is the rigid path.
   */
  function bustOnly(name: string): string {
    const model = repack(path.join(dir, name), (json) => {
      const vrm = (json.extensions as Record<string, { secondaryAnimation: { boneGroups: { comment?: string }[] } }>).VRM
      const groups = vrm.secondaryAnimation.boneGroups
      const kept = groups.filter((g) => g.comment === 'Bust')
      expect(kept.length, 'the shipped body has a bust spring group to keep').toBe(1)
      expect(groups.length, 'and other groups to drop').toBeGreaterThan(1)
      vrm.secondaryAnimation.boneGroups = kept
    })
    return withParts(model, truthParts.parts)
  }

  it('measures the crown of a body whose hair holds no spring joint', async () => {
    const r = await runClip(parseArgs([bustOnly('rigid.vrm'), '--clip=spin', '--stride=6']), clipFile('spin'))
    expect(r.restCrownY, 'a resting crown').toBeGreaterThan(1.5)
    expect(r.crownY, 'and a crown over the clip').toBeGreaterThanOrEqual(r.restCrownY)
    // Said out loud, because the jump columns it produces are 0.0° with no bone
    // name, which is what a run that lost its springs also prints.
    expect(r.rigidHair, 'and it says the crown is rigid').toBe(true)
    expect(r.jumpBone, 'no tail bone turned').toBe('')
    const springy = await shipped()
    expect(springy.rigidHair, 'the shipped body is not rigid').toBe(false)
    expect(springy.jumpBone, 'its tail bones do turn').not.toBe('')
  }, 240_000)

  it('gets the same crown whichever primitive the manifest calls the hair', async () => {
    // The reason the empty list is reported rather than thrown. Every spring in
    // the file is solved whatever the parts are called, and the crown is the
    // topmost vertex of everything listed, so a manifest that points Hair_* at
    // the face still carries the twintails' throw. Were that untrue, letting a
    // rigid-hair body through would understate the crown, and the frame gate
    // reads the crown to decide what it may approve.
    const model = path.join(dir, 'misnamed-hair.vrm')
    copyFileSync(MODEL, model)
    const parts: typeof truthParts.parts = {}
    for (const [name, part] of Object.entries(truthParts.parts)) {
      parts[name.startsWith('Hair_') ? name.replace('Hair_', 'Fluff_') : name] = part
    }
    // The face, not the body skin: the bust springs ARE in the body's skin, so
    // pointing Hair_* there finds spring joints and never reaches this path.
    parts.Hair_Wrong = truthParts.parts.Face
    expect(Object.keys(parts).filter((k) => k.startsWith('Hair_')), 'one hair part, the wrong one').toEqual(['Hair_Wrong'])
    withParts(model, parts)
    const misnamed = await runClip(parseArgs([model, '--clip=spin', '--stride=6']), clipFile('spin'))
    const named = await shipped()
    expect(misnamed.rigidHair, 'the wrong name empties the hair joint list').toBe(true)
    expect(named.rigidHair).toBe(false)
    expect(misnamed.crownY, 'same crown').toBeCloseTo(named.crownY, 4)
    expect(misnamed.crownScreen.column, 'same crown through the column camera').toBeCloseTo(named.crownScreen.column, 4)
    expect(misnamed.crownScreen.waistUp, 'and through the waist-up camera').toBeCloseTo(named.crownScreen.waistUp, 4)
    // What IS lost, and why the flag exists: the jump columns go quiet.
    expect(named.jumpDeg, 'the twintails do turn').toBeGreaterThan(1)
    expect(misnamed.jumpDeg, 'and the misnamed run cannot see it').toBe(0)
  }, 240_000)

  it('refuses a tuning flag it would have to swallow', async () => {
    // --hit, --gravity, --no-arms and --no-coat all act on the hair's spring
    // joints. With none to act on, the run would print the flag in its header
    // and change nothing, which reads as a tuned result.
    const model = bustOnly('rigid-flag.vrm')
    await expect(runClip(parseArgs([model, '--clip=spin', '--stride=6', '--gravity=0']), clipFile('spin')))
      .rejects.toThrow(/--gravity .* names none that any spring touches/)
    await expect(runClip(parseArgs([model, '--clip=spin', '--stride=6', '--no-arms']), clipFile('spin')))
      .rejects.toThrow(/--no-arms/)
  }, 240_000)
})
