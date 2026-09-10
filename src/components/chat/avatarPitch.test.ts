// The rest of the pitch class: `nod`, `bounce` and `toeLook`, on each family's
// own body.
//
// `bow` was the first of these to be fixed and has its own file next door,
// because it is cue-driven and carries browser evidence of its own
// (scripts/avatar/evidence/bow-0910.md). These three are the ones the site
// plays without being asked: `nod` answers the `ack`, `suggest` and `done`
// cues, and `bounce` and `toeLook` are both in the idle rotation, so every
// visitor sees them.
//
// WHY PITCH AND ONLY PITCH. A normalized bone's local axes follow the MODEL's,
// and the two VRM versions face opposite ways along Z, so the same rotation
// means different things on the two. Which of the three axes that actually
// spoils is measured here rather than argued, in the two `axis semantics`
// tests at the foot of the per-family block:
//
//   pitch (X)  mirrors, and the two directions mean opposite things. +0.14 on
//              the head swings her eye 8.53mm TOWARD her face on a 1.0 body and
//              8.25mm AWAY from it on a 0.x one. A defect, and the three
//              gestures below carried it. So did `bow`, fixed first.
//   yaw (Y)    does NOT mirror. +0.1 on the head turns her eye toward her own
//              left on both, 2.05mm on 1.0 and 2.87mm on 0.x. Nothing to fix.
//   roll (Z)   mirrors, 10.20mm toward her right on 1.0 against 8.86mm toward
//              her left on 0.x, and a head tilted left reads the same as one
//              tilted right. Every gesture that rolls picks its side from `v`
//              at random anyway. Left alone deliberately.
//
// The eye target is world space (`eyeTarget.position.set(x, y, 4)`, which is
// out past the camera at 2.3, on the viewer's side), so it never flips either.
// `toeLook` writes both a head pitch and an eye target, which is what made it
// the clearest of the three: on a 0.x body it used to lift her chin while
// sending her gaze to the floor.
//
// Every reading below is taken at env = 1, the top of the envelope, which is
// where the curve is deepest and the two signs are furthest apart. That is a
// bigger pose than the gesture reaches on screen for `nod`, whose sine and
// whose envelope peak at different moments: its own peak is 0.108 rad, not
// 0.14. scripts/avatar/evidence/pitch-0910.log carries both, and
// pitch-0910-browser.log the same three curves through the real engine.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildRig, resetRig, type Rig } from './rigProbe'
import { aimPitchPose, aimYawPose, armRestSign, facingSign } from './avatarMode'
import { GESTURE_NAMES, gestureOffsets, type GestureName } from './avatarGuideEngine'
import { AVATAR_FAMILIES, type AvatarFamilyId } from './avatarVariants'

const asset = (...parts: string[]): Uint8Array =>
  new Uint8Array(readFileSync(path.join(process.cwd(), 'public', 'avatar', ...parts)))

interface Family {
  id: AvatarFamilyId
  body: string
}
const FAMILIES: readonly Family[] = Object.entries(AVATAR_FAMILIES).map(([id, clearance]) => ({
  id: id as AvatarFamilyId,
  body: clearance.measuredOn.replace(/^\/avatar\//, ''),
}))

const rigCache = new Map<string, Rig>()
function rigOfBody(body: string): Rig {
  let r = rigCache.get(body)
  if (!r) {
    r = buildRig(asset(body))
    rigCache.set(body, r)
  }
  resetRig(r)
  return r
}

const at = (r: Rig, b: string): THREE.Vector3 =>
  new THREE.Vector3().setFromMatrixPosition(r.bones[b].matrixWorld)

// The offset channels measured in radians, which is every one except the eye
// target. `ex` and `ey` move a target four units out, so a millirad of head roll
// and a thousandth of an eye-target unit are nothing like the same motion and
// must not share a threshold. The Record spelling is what keeps this list from
// going stale: a channel added to GestureOffsets that is not `ex` or `ey` stops
// this file compiling until it is named here, and `npm run build` type-checks
// tests.
type Channel = keyof ReturnType<typeof gestureOffsets>
const RADIANS: Record<Exclude<Channel, 'ex' | 'ey'>, true> = {
  hp: true,
  hy: true,
  hr: true,
  sx: true,
  sy: true,
  sz: true,
  cx: true,
}
const RADIAN_CHANNELS = Object.keys(RADIANS) as ReadonlyArray<Exclude<Channel, 'ex' | 'ey'>>

/**
 * Where a body's rig sits before anything is applied, in its own local space.
 *
 * `faceZ` is the way her face points, read off the eye against the head.
 * `herLeft` is the way her left is, read off her own two hands. Both come from
 * the body rather than from the version, so a body that disagrees with its own
 * metadata would show up here instead of being assumed away.
 */
function rest(body: string): { r: Rig; faceZ: number; herLeft: number; eye0: THREE.Vector3 } {
  const r = rigOfBody(body)
  r.root.updateMatrixWorld(true)
  const eye0 = at(r, 'leftEye')
  return {
    r,
    faceZ: Math.sign(eye0.z - at(r, 'head').z),
    herLeft: Math.sign(at(r, 'leftHand').x - at(r, 'rightHand').x),
    eye0,
  }
}

describe.each(FAMILIES)('procedural pitch on $id', (fam: Family) => {
  /**
   * How far a gesture's HEAD pitch alone carries her eye along her facing.
   *
   * The head term has to be read at the eye: rotating a bone does not move its
   * own origin, so the head bone's world position says nothing about `hp`.
   */
  function eyeTowardFace(name: GestureName, p: number): number {
    const { r, faceZ, eye0 } = rest(fam.body)
    r.bones.head.rotation.x = gestureOffsets(name, p, 1, 1, facingSign(r.version)).hp
    r.root.updateMatrixWorld(true)
    return (at(r, 'leftEye').z - eye0.z) * faceZ
  }

  /** How far a gesture's SPINE pitch alone carries her head along her facing. */
  function headTowardFace(name: GestureName, p: number): number {
    const { r, faceZ } = rest(fam.body)
    const head0 = at(r, 'head')
    r.bones.spine.rotation.x = gestureOffsets(name, p, 1, 1, facingSign(r.version)).sx
    r.root.updateMatrixWorld(true)
    return (at(r, 'head').z - head0.z) * faceZ
  }

  // `nod` is the odd one of the three. Its curve is sin(2*pi*p), symmetric in
  // amplitude, so the facing term changes the PHASE and not the size: unfixed,
  // a 0.x body answers "yes" by raising her chin first and dropping it second.
  // So this reads the FIRST down-beat, at p=0.25 where the sine peaks, and not
  // the depth of the pose.
  it('nod starts by dipping her chin toward the viewer', () => {
    // 7.67mm on 0.x and 8.53mm on 1.0; unfixed the 0.x bodies read -8.25mm.
    expect(eyeTowardFace('nod', 0.25)).toBeGreaterThan(0.005)
  })

  // `bounce` writes the same weight on the spine and on the head, so each one
  // needs its own assertion: dropping the facing term from either alone leaves
  // the other's test green. p=1/6 is where |sin(3*pi*p)| first peaks.
  it('bounce dips her torso toward the viewer', () => {
    // 19.54mm on 0.x and 21.35mm on 1.0; unfixed the 0.x bodies read -19.49mm.
    expect(headTowardFace('bounce', 1 / 6)).toBeGreaterThan(0.005)
  })

  it('bounce dips her head toward the viewer too, not just her torso', () => {
    // 0.05 rad about a pivot 57mm below the eye is a small swing: 2.81mm on
    // 0.x and 3.10mm on 1.0, against -2.89mm unfixed. 2mm sits between the two
    // signs, which is all this has to separate.
    expect(eyeTowardFace('bounce', 1 / 6)).toBeGreaterThan(0.002)
  })

  // `toeLook` is the one that contradicted itself: its eye target is world
  // space and always went down, while its head pitch went down only on a 1.0
  // body. So this reads the eye's HEIGHT, which is what the gesture's name
  // claims, and pins the eye target beside it.
  it('toeLook drops her eye, agreeing with the eye target it sends down', () => {
    const { r, eye0 } = rest(fam.body)
    const o = gestureOffsets('toeLook', 0.5, 1, 1, facingSign(r.version))
    r.bones.head.rotation.x = o.hp
    r.root.updateMatrixWorld(true)
    // 11.31mm down on 0.x and 9.13mm on 1.0; unfixed the 0.x bodies lift the
    // eye 6.22mm instead.
    expect(at(r, 'leftEye').y - eye0.y).toBeLessThan(-0.005)
    expect(o.ey).toBeLessThan(0)
  })

  // -- axis semantics, which is the argument for the scope of the fix --------

  it('a positive yaw turns her toward her own left on either version', () => {
    const { r, herLeft, eye0 } = rest(fam.body)
    r.bones.head.rotation.y = 0.1
    r.root.updateMatrixWorld(true)
    // 2.87mm on 0.x, 2.05mm on 1.0. Same side, so yaw needs no facing term and
    // `tilt`, `glance`, `hipTwist` and `toeLook`'s own `hy` are left alone.
    expect((at(r, 'leftEye').x - eye0.x) * herLeft).toBeGreaterThan(0.001)
  })

  it('a positive roll tilts to opposite sides on the two versions', () => {
    const { r, herLeft, eye0 } = rest(fam.body)
    r.bones.head.rotation.z = 0.16
    r.root.updateMatrixWorld(true)
    const towardHerLeft = (at(r, 'leftEye').x - eye0.x) * herLeft
    // 8.86mm toward her left on 0.x, 10.20mm toward her right on 1.0: the same
    // mirror `armRestSign` already names. Roll is left alone even so, because
    // a head tilted left and one tilted right read the same, and every gesture
    // that rolls picks its side from `v` at random.
    expect(Math.sign(towardHerLeft)).toBe(armRestSign(r.version))
    expect(Math.abs(towardHerLeft)).toBeGreaterThan(0.005)
  })
})

// The four whose pitch resolves against the facing. `bow` is pinned next door in
// avatarBow.test.ts; the other three are the per-family block above. Listed here
// so the partition assertion at the foot of the file has both halves.
const PITCH_SIGNED: readonly GestureName[] = ['bow', 'nod', 'bounce', 'toeLook']

// The other half of the scope: a facing term on an axis that does not mirror
// would be a new defect, not a fix. These gestures write yaw, roll and the eye
// target only, and `leanBack` writes pitch in the model's own space on purpose.
const VERSION_BLIND: readonly GestureName[] = [
  'wiggle',
  'tilt',
  'glance',
  'swayStep',
  'hipTwist',
  'leanBack',
]

// 0.125 is in the list because of `wiggle`, whose curve is sin(4*pi*p): on the
// quarter points alone every sample lands on one of its own zeros, so the
// comparison would have been between two numbers that were both floating-point
// residue. The second assertion is what stops that returning quietly, on this
// gesture or a later one.
const BLIND_SAMPLES = [0, 0.125, 0.25, 0.5, 0.75, 1] as const

describe.each(VERSION_BLIND)('%s reads the same on either facing', (name: GestureName) => {
  it('gives identical offsets at both signs of fwd', () => {
    for (const p of BLIND_SAMPLES) {
      expect(gestureOffsets(name, p, 1, 1, -1)).toEqual(gestureOffsets(name, p, 1, 1, 1))
    }
  })

  it('is sampled somewhere it actually moves', () => {
    const biggest = Math.max(
      ...BLIND_SAMPLES.flatMap((p) => {
        const o = gestureOffsets(name, p, 1, 1, 1)
        return RADIAN_CHANNELS.map((k) => Math.abs(o[k]))
      }),
    )
    expect(biggest).toBeGreaterThan(0.001)
  })
})

// An eleventh gesture added to the table and to neither list would be covered by
// nothing in this file, and every test above would stay green while it was.
it('sorts every gesture the table has into one of the two groups', () => {
  expect([...PITCH_SIGNED, ...VERSION_BLIND].sort()).toEqual([...GESTURE_NAMES].sort())
})

// The three channels that carry a pitch. `cx` is here for a channel nobody
// writes yet: it adds to the chest's breathing, and the chest mirrors like the
// other two (+0.012 rad swings her eye 4.51mm toward her face on a 1.0 body and
// 4.06mm away from it on a 0.x one, evidence/aim-0910.md). A gesture that
// started using it would be a mirrored pitch with no facing term, and the two
// version-blind tests above would call it correct, because "identical at both
// signs of fwd" is exactly what an unsigned pitch is.
const PITCH_CHANNELS = ['hp', 'sx', 'cx'] as const

// `leanBack` is the one gesture allowed to write a pitch without resolving it:
// leaning toward the model's own +Z is what that pose IS, and avatarBow.test.ts
// pins it at both versions so it cannot quietly become the corrected curve.
const MODEL_SPACE_PITCH: readonly GestureName[] = ['leanBack']

describe('every pitch in the table is either resolved or a named exception', () => {
  /** The deepest pitch this gesture reaches over the samples, on any channel. */
  function deepestPitch(name: GestureName): number {
    return Math.max(
      ...BLIND_SAMPLES.flatMap((p) => {
        const o = gestureOffsets(name, p, 1, 1, 1)
        return PITCH_CHANNELS.map((k) => Math.abs(o[k]))
      }),
    )
  }

  it.each(GESTURE_NAMES)('%s', (name: GestureName) => {
    const writesPitch = deepestPitch(name) > 0.001
    const resolved = PITCH_SIGNED.includes(name) || MODEL_SPACE_PITCH.includes(name)
    expect(writesPitch, `${name} writes a pitch without being listed as resolving one`).toBe(
      resolved,
    )
  })
})

// The layer under the gestures has the same axis problem, and it is the one a
// visitor sees continuously rather than in beats: `headAim` returns a pitch that
// the engine spends TWICE, on bones and on the eye target, and only one of those
// two consumers mirrors between versions.
//
//   head.rotation.x = pitch * 0.7    neck.rotation.x = pitch * 0.3
//       the model's own space, so it means opposite things on the two versions
//   eyeTarget.position.y = 1.35 + Math.sin(pitch) * -4
//       world space, so a positive pitch sends her gaze DOWN on every body
//
// The eye target is what DEFINES the sign: `pitch` means "look down" because
// that is what it does to the target, on any body. The bones have to agree, and
// on a 0.x body they did the opposite. In `listening` that is a chin lifted
// 3.85 degrees while the gaze goes to the floor, held for as long as the
// visitor is typing (evidence/aim-0910.md). The readings below are taken at
// `headAim`'s own extremes, +0.12 and -0.20, which are the targets rather than
// the eased values the bones reach; the sign, which is all that is asserted, is
// the same either way.
describe.each(FAMILIES)('the mode-driven gaze on $id', (fam: Family) => {
  /** Where her eye ends up when only ONE of the two gaze bones is written. */
  function eyeDrop(bone: 'head' | 'neck', pitch: number): number {
    const r = rigOfBody(fam.body)
    r.root.updateMatrixWorld(true)
    const eye0 = at(r, 'leftEye')
    const pose = aimPitchPose(pitch, facingSign(r.version))
    r.bones[bone].rotation.x = pose[bone]
    r.root.updateMatrixWorld(true)
    return at(r, 'leftEye').y - eye0.y
  }

  /** Where the eye TARGET goes for the same pitch. World space, never mirrors. */
  const targetDrop = (pitch: number): number => Math.sin(pitch) * -4

  // listening reaches +0.12 and -0.20; idle and speaking stay inside those.
  it.each([
    ['looking down', 0.12],
    ['looking up', -0.2],
  ])('head term agrees with the eye target when %s', (_label, pitch: number) => {
    // Looking down, her eye drops 2.69mm on 0.x and 2.02mm on 1.0; unsigned,
    // the 0.x body lifts it 2.29mm while the target goes down.
    expect(Math.sign(eyeDrop('head', pitch))).toBe(Math.sign(targetDrop(pitch)))
  })

  it.each([
    ['looking down', 0.12],
    ['looking up', -0.2],
  ])('neck term agrees with the eye target when %s', (_label, pitch: number) => {
    // The neck carries 0.3 against the head's 0.7, so its own swing is smaller:
    // 1.48mm down on 0.x and 1.19mm on 1.0, against 1.31mm UP unsigned. Its own
    // test even so, because dropping the facing from one half leaves the other
    // half's test green.
    expect(Math.sign(eyeDrop('neck', pitch))).toBe(Math.sign(targetDrop(pitch)))
  })

  // The yaw half, which carries no facing term. Its own test rather than the
  // axis-semantics one above: that one writes `head.rotation.y = 0.1` by hand
  // and so cannot see aimYawPose at all. Signing the yaw the way the pitch is
  // signed would be a new defect, and this is what says so on a real skeleton.
  it('all three yaw terms turn her toward her own left, on either version', () => {
    const { r, herLeft, eye0 } = rest(fam.body)
    const aim = aimYawPose(0.1)
    r.bones.head.rotation.y = aim.head
    r.bones.neck.rotation.y = aim.neck
    r.bones.spine.rotation.y = aim.spine
    r.root.updateMatrixWorld(true)
    // The three ratios sum to 1.1 of the input, so this is a bigger swing than
    // the 0.1 the axis test uses on the head alone: 3.26mm on 0.x and 2.16mm on
    // 1.0. Signed, the 0.x body reads -3.47mm instead and the two 1.0 bodies do
    // not move at all, which is why this has to be measured on every family.
    expect((at(r, 'leftEye').x - eye0.x) * herLeft).toBeGreaterThan(0.001)
  })
})
