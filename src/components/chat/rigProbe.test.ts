import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyMotion,
  buildMotion,
  buildRig,
  handJoints,
  headPenetration,
  headVolume,
  probeHand,
  resetRig,
  screenX,
  silhouetteJoints,
  type Motion,
  type Rig,
} from './rigProbe'
import {
  ARM_REST_FORE_Z,
  ARM_REST_UPPER_Z,
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_COLUMN_ASPECT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  avatarViewHalfWidth,
  avatarViewSpan,
} from './avatarMode'
import { AVATAR_MOTIONS, MAX_HIPS_SINK, type AvatarMotionName } from './avatarMotions'

const asset = (...parts: string[]): Uint8Array =>
  new Uint8Array(readFileSync(path.join(process.cwd(), 'public', 'avatar', ...parts)))

let cachedRig: Rig | null = null
function rig(): Rig {
  if (!cachedRig) cachedRig = buildRig(asset('AvatarSample_B_webp.vrm'))
  resetRig(cachedRig)
  return cachedRig
}

const motionCache = new Map<AvatarMotionName, Motion>()
function motion(name: AvatarMotionName): Motion {
  const cached = motionCache.get(name)
  if (cached) return cached
  const built = buildMotion(asset('animations', `${name}.vrma`))
  motionCache.set(name, built)
  return built
}

// The launcher and docked canvases share a framing and an aspect, so one box
// covers both; the fullscreen column is composed lower and tighter.
//
// Both sideways edges are checked against the same budget: the canvas itself.
// A hand past the canvas is not drawn at all, which is a hard rectangular cut
// through an arm. A hand past the VIEWPORT is a different matter and is no
// longer checked here — since 2026-08-19 her body hugs the panel's right edge
// (avatarColumnRightInset) and her gesture room deliberately hangs off screen,
// which the owner asked for and accepted the clipping of.
//
// Screen sides, not hers: facing the viewer mirrors her, so her right hand
// renders on the viewer's left. See rigProbe's screenX.
const COLUMN_HALF_WIDTH = avatarViewHalfWidth(AVATAR_FRAMING_COLUMN, {
  w: AVATAR_COLUMN_ASPECT,
  h: 1,
})

const FRAMES = {
  waistUp: {
    halfWidth: avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
    span: avatarViewSpan(AVATAR_FRAMING_DEFAULT),
  },
  column: {
    halfWidth: COLUMN_HALF_WIDTH,
    span: avatarViewSpan(AVATAR_FRAMING_COLUMN),
  },
}

describe('rigProbe', () => {
  it('rebuilds the shipped model rest pose it is going to measure against', () => {
    const r = rig()
    // Read straight out of the .vrm: her arms rest along ∓X in the T-pose, the
    // shoulder joint sits 0.081m off her centre line and the head bone at 1.320.
    expect(r.restPosition.leftUpperArm.x).toBeCloseTo(-0.081, 3)
    expect(r.restPosition.rightUpperArm.x).toBeCloseTo(0.081, 3)
    expect(r.restPosition.head.y).toBeCloseTo(1.32, 2)
    // Her eyes are in FRONT of the head bone, which is what fixes -Z as her
    // forward direction and so which way "palm toward the viewer" points.
    expect(r.restPosition.leftEye.z).toBeLessThan(r.restPosition.head.z)
  })

  // The two measurements below are the ones the old width-only check could not
  // see. They are pinned against the retired hand-authored poses precisely
  // because those poses are known-bad: if the probe ever stops reporting them as
  // bad, it has stopped being able to catch the next one.
  it('sees a fingertip inside her skull (the retired cheekPoke pose)', () => {
    const r = rig()
    for (const side of ['left', 'right'] as const) {
      const mirror = side === 'left' ? 1 : -1
      r.bones[`${side}UpperArm`].rotation.z = mirror * 0.25
      r.bones[`${side}LowerArm`].rotation.z = mirror * -2.6
    }
    r.root.updateMatrixWorld(true)
    const volume = headVolume(r)
    expect(headPenetration(r, volume, probeHand(r, 'left').fingertip)).toBeLessThan(1)
  })

  it('sees a peace sign whose palm faces away (the retired mirrored wrist twist)', () => {
    const r = rig()
    for (const side of ['left', 'right'] as const) {
      const mirror = side === 'left' ? 1 : -1
      r.bones[`${side}UpperArm`].rotation.z = 0
      r.bones[`${side}LowerArm`].rotation.z = mirror * -2.0
      // setHand() used to multiply the wrist twist by the same mirror as the
      // finger curl. A twist about the bone's own long axis does NOT change
      // sign under a left/right mirror (M·Rx(θ)·M = Rx(θ)), so the two hands
      // ended up rotated opposite ways: one palm out, one palm in.
      r.bones[`${side}Hand`].rotation.x = mirror * -1.0
    }
    r.root.updateMatrixWorld(true)
    expect(probeHand(r, 'right').palmToViewer).toBeGreaterThan(0.6)
    expect(probeHand(r, 'left').palmToViewer).toBeLessThan(-0.6)
  })

  it('reports a resting arm as straight and a folded one as flexed', () => {
    const r = rig()
    r.bones.leftUpperArm.rotation.z = ARM_REST_UPPER_Z
    r.bones.leftLowerArm.rotation.z = ARM_REST_FORE_Z
    r.root.updateMatrixWorld(true)
    const rest = probeHand(r, 'left').elbowFlex
    expect(rest).toBeLessThan(20)

    r.bones.leftLowerArm.rotation.z = ARM_REST_FORE_Z + 1.4
    r.root.updateMatrixWorld(true)
    expect(probeHand(r, 'left').elbowFlex).toBeGreaterThan(rest + 60)
  })
})

// The clips that FAIL each guard are not in the repo — shipping four unused
// motion files to prove a test can go red is the wrong trade. These synthetic
// poses stand in for them, so every guard's measurement stays provably able to
// see the thing it is there to catch, on CI, without any asset at all.
describe('guard sensitivity', () => {
  // Values go in as the .vrma would carry them, so applyMotion's VRM0 axis flip
  // (x and z negated) applies to them too — which is itself worth having under
  // test, since getting that flip backwards is invisible from the front.
  function synthetic(parts: {
    rotation?: Record<string, [number, number, number, number]>
    hipsY?: number
    hipsX?: number
  }): Motion {
    const rotation: Record<string, { times: Float32Array; values: Float32Array }> = {}
    for (const [bone, q] of Object.entries(parts.rotation ?? {})) {
      rotation[bone] = { times: new Float32Array([0]), values: new Float32Array(q) }
    }
    const hipsTranslation =
      parts.hipsY === undefined && parts.hipsX === undefined
        ? null
        : {
            times: new Float32Array([0]),
            values: new Float32Array([
              parts.hipsX ?? 0,
              parts.hipsY ?? rig().restPosition.hips.y,
              0,
            ]),
          }
    return { rotation, hipsTranslation, duration: 0, restHipsY: 1, sampleTimes: [0], }
  }

  it('sees a hand that leaves the frame', () => {
    const r = rig()
    // Arms straight out horizontally puts a fingertip at 0.639, which the frame
    // still contains — that headroom is the point of the wide canvas. Adding a
    // step sideways is what carries a hand past the edge, and it is also how
    // the real offenders do it: `spin` reaches 0.658 by turning her body, not
    // by raising an arm further.
    const flat = synthetic({
      hipsX: -0.12,
      rotation: {
        leftUpperArm: [0, 0, 0, 1],
        rightUpperArm: [0, 0, 0, 1],
        leftLowerArm: [0, 0, 0, 1],
        rightLowerArm: [0, 0, 0, 1],
      },
    })
    applyMotion(r, flat, 0)
    const reach = Math.max(
      Math.abs(probeHand(r, 'left').fingertip.x),
      Math.abs(probeHand(r, 'right').fingertip.x),
    )
    expect(reach).toBeGreaterThan(FRAMES.waistUp.halfWidth)
    expect(reach).toBeGreaterThan(FRAMES.column.halfWidth)
  })

  // The whole reason the frames were widened on 2026-08-20. A distal finger bone
  // is not where the finger ends, and measuring there read ~20mm narrower than
  // what is drawn — enough that `spin` sat 0.5mm inside the old canvas edge with
  // a green suite. Nothing else pins this: once the frames were wide enough,
  // every clip cleared with or without the tips, so dropping them again would
  // have gone unnoticed.
  it('measures a finger to its skinned tip, not to its last joint', () => {
    const r = rig()
    const distal = new THREE.Vector3().setFromMatrixPosition(r.bones.rightIndexDistal.matrixWorld)
    const tip = new THREE.Vector3().setFromMatrixPosition(r.bones.rightIndexTip.matrixWorld)
    // Read out of the shipped VRM: J_Bip_R_Index3 -> J_Bip_R_Index3_end.
    expect(tip.distanceTo(distal)).toBeCloseTo(0.0204, 3)
    // The tip is FURTHER from her centre than the joint, which is why it moves
    // the sideways reading at all.
    expect(Math.abs(tip.x)).toBeGreaterThan(Math.abs(distal.x))
    // And the hand sampler actually hands it out.
    const sampled = handJoints(r, 'right')
    expect(sampled.some((j) => j.distanceTo(tip) < 1e-9)).toBe(true)
    expect(sampled.some((j) => j.distanceTo(distal) < 1e-9)).toBe(true)
  })

  it('sees a stance that sinks', () => {
    const r = rig()
    const restHipsY = r.restPosition.hips.y
    applyMotion(r, synthetic({ hipsY: restHipsY - 0.3 }), 0)
    const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
    expect(restHipsY - hips.y).toBeGreaterThan(MAX_HIPS_SINK)
  })

  // No clip in the pool trips the crop-bottom guard: `squat`, the one that goes
  // down on purpose, stops 0.042 above the waist-up edge. This pins the
  // MEASUREMENT — that a sunk hips reads below the edge, and that the two frames
  // crop differently — which is all a synthetic can do. Loosening the guard's
  // budget leaves this green; the red evidence for the guard itself is
  // `greeting` (hips 0.305, below both edges), and that needs its .vrma put back
  // in public/ because the clip is deliberately not in the repo.
  it('sees hips dropped through the bottom of the crop', () => {
    const r = rig()
    applyMotion(r, synthetic({ hipsY: FRAMES.waistUp.span.bottom - 0.05 }), 0)
    const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
    expect(hips.y).toBeLessThan(FRAMES.waistUp.span.bottom)
    expect(hips.y).toBeGreaterThan(FRAMES.column.span.bottom)
  })

  it('sees a body that is not upright', () => {
    const r = rig()
    // A quarter turn about X at the hips: the whole body pitches forward and
    // her feet swing up, which is the shape a missed rest-frame rebase makes.
    const half = Math.SQRT1_2
    applyMotion(r, synthetic({ rotation: { hips: [half, 0, 0, half] } }), 0)
    const y = (bone: string): number =>
      new THREE.Vector3().setFromMatrixPosition(r.bones[bone].matrixWorld).y
    expect(y('leftFoot')).toBeGreaterThan(y('hips'))
  })

  it('sees a hand raised above the frame', () => {
    const r = rig()
    // Left arm straight up: fingertips well over the top edge of both frames.
    // +z here, because applyMotion negates it: the arm has to end up raised,
    // and writing the sign that LOOKS right sends it to the floor instead.
    const half = Math.SQRT1_2
    applyMotion(
      r,
      synthetic({ rotation: { leftUpperArm: [0, 0, half, half], leftLowerArm: [0, 0, 0, 1] } }),
      0,
    )
    const top = probeHand(r, 'left').fingertip.y
    expect(top).toBeGreaterThan(FRAMES.waistUp.span.top)
    expect(top).toBeGreaterThan(FRAMES.column.span.top)
  })
})

describe('bundled motions', () => {
  const names = Object.keys(AVATAR_MOTIONS) as AvatarMotionName[]

  // The load-bearing check for buildMotion's rest-frame rebase. A .vrma whose
  // humanoid nodes rest on non-identity rotations decodes into a body folded in
  // half with its feet above its head if the rebase is skipped, and that pose is
  // NARROW, so every other guard here passes on it. Anatomy is what catches it.
  // modelPose is such a file: 34 of its 52 humanoid bones carry a non-identity
  // LOCAL rest rotation, its hips a ~120° axis permutation, and once those
  // accumulate down the chain all 52 rest in a non-identity WORLD orientation,
  // which is the frame the rebase actually divides out.
  it.each(Object.keys(AVATAR_MOTIONS))('%s decodes to an upright body', (name) => {
    const r = rig()
    const m = motion(name as AvatarMotionName)
    const y = (bone: string): number =>
      new THREE.Vector3().setFromMatrixPosition(r.bones[bone].matrixWorld).y
    for (const time of m.sampleTimes) {
      applyMotion(r, m, time)
      expect(y('leftFoot'), `${name} left foot above hips at t=${time}`).toBeLessThan(y('hips'))
      expect(y('rightFoot'), `${name} right foot above hips at t=${time}`).toBeLessThan(y('hips'))
      expect(y('hips'), `${name} hips above head at t=${time}`).toBeLessThan(y('head'))
    }
  })

  it('ships every motion the table declares', () => {
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) expect(motion(name).duration).toBeGreaterThan(1)
  })

  it.each(Object.entries(AVATAR_MOTIONS))(
    '%s keeps her fingertips out of her own head',
    (name, def) => {
      const r = rig()
      const m = motion(name as AvatarMotionName)
      const volume = headVolume(r)
      let worst = Infinity
      for (const time of m.sampleTimes) {
        applyMotion(r, m, time)
        for (const side of ['left', 'right'] as const) {
          // Every joint of the hand. Sampling the index fingertip alone let
          // `shoot` ship with its THUMB 7-10mm inside her cheek: index-only it
          // measures 1.19 and looks clean, whole-hand it measures 0.90.
          for (const joint of handJoints(r, side)) {
            worst = Math.min(worst, headPenetration(r, volume, joint))
          }
        }
      }
      const faceBudget = def.waiver?.handInHead
      if (faceBudget !== undefined) {
        expect(worst, `${name} declares a handInHead waiver it does not need`).toBeLessThan(1)
      }
      expect(worst, `${name} deepest fingertip against her face`).toBeGreaterThan(faceBudget ?? 1)
      expect(def.placements.length).toBeGreaterThan(0)
    },
  )

  // Both sideways edges are checked against the same budget: the canvas. A hand
  // past the canvas is not drawn at all, which is a hard rectangular cut through
  // an arm. Whether the canvas itself is wholly on screen is a separate question
  // and is deliberately NOT asked here — since 2026-08-19 the column hangs off
  // the viewport on purpose (avatarColumnRightInset) and a clipped gesture is
  // accepted.
  //
  // The two sides are still asserted separately so a failure names the edge.
  // Screen sides, not hers: facing the viewer mirrors her, so her right hand
  // renders on the viewer's left. See rigProbe's screenX.
  it.each(Object.entries(AVATAR_MOTIONS))('%s stays inside every frame it declares', (name, def) => {
    const r = rig()
    const m = motion(name as AvatarMotionName)
    for (const placement of def.placements) {
      const frame = FRAMES[placement]
      let screenLeft = -Infinity
      let screenRight = -Infinity
      let maxY = -Infinity
      for (const time of m.sampleTimes) {
        applyMotion(r, m, time)
        // The outermost point of a pose is not always a hand: a raised elbow or
        // a splayed little finger can be, so the whole silhouette is sampled.
        for (const joint of silhouetteJoints(r)) {
          screenLeft = Math.max(screenLeft, -screenX(joint.x))
          screenRight = Math.max(screenRight, screenX(joint.x))
        }
        for (const side of ['left', 'right'] as const) {
          const { wrist, fingertip } = probeHand(r, side)
          maxY = Math.max(maxY, wrist.y, fingertip.y)
        }
      }
      // The bottom edge is not checked: an arm hanging at her side leaves the
      // waist-up frame the same way a real one does, and the canvas masks it.
      // A waiver replaces the budget with the clip's own measured worst case,
      // and is itself checked: declaring one that the clip does not need is a
      // failure, so a stale waiver cannot sit here quietly widening the guard.
      const reachBudget = def.waiver?.reach
      if (reachBudget !== undefined) {
        expect(
          Math.max(screenLeft, screenRight),
          `${name} declares a reach waiver it does not need in ${placement}`,
        ).toBeGreaterThan(frame.halfWidth)
      }
      expect(screenLeft, `${name} reach to the viewer's left in ${placement}`).toBeLessThan(
        reachBudget ?? frame.halfWidth,
      )
      expect(screenRight, `${name} reach to the viewer's right in ${placement}`).toBeLessThan(
        reachBudget ?? frame.halfWidth,
      )
      const topBudget = def.waiver?.handTop
      if (topBudget !== undefined) {
        expect(
          maxY,
          `${name} declares a handTop waiver it does not need in ${placement}`,
        ).toBeGreaterThan(frame.span.top)
      }
      expect(maxY, `${name} highest hand in ${placement}`).toBeLessThan(
        topBudget ?? frame.span.top,
      )
    }
  })



  it.each(
    Object.entries(AVATAR_MOTIONS).filter(([, def]) => def.showsPalm),
  )('%s turns a palm to the viewer at some point', (name) => {
    const r = rig()
    const m = motion(name as AvatarMotionName)
    let best = -1
    for (const time of m.sampleTimes) {
      applyMotion(r, m, time)
      for (const side of ['left', 'right'] as const) {
        best = Math.max(best, probeHand(r, side).palmToViewer)
      }
    }
    expect(best, `${name} best palm-to-viewer`).toBeGreaterThan(0.6)
  })

  // A clip must never sink out of the bottom of the crop. This is the guard for
  // what a motion DOES: `squat` lowers her hips 0.218 on purpose and belongs in
  // the pool, so the budget is the frame's own bottom edge rather than a flat
  // cap. Her hips at rest are 0.878, the waist-up frame ends at 0.618, and the
  // column's at 0.430; squat's deepest is 0.660.
  it.each(Object.entries(AVATAR_MOTIONS))('%s keeps her hips inside the crop', (name, def) => {
    const r = rig()
    const m = motion(name as AvatarMotionName)
    let lowest = Infinity
    for (const time of m.sampleTimes) {
      applyMotion(r, m, time)
      const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
      lowest = Math.min(lowest, hips.y)
    }
    for (const placement of def.placements) {
      expect(lowest, `${name} lowest hips in ${placement}`).toBeGreaterThan(
        FRAMES[placement].span.bottom,
      )
    }
  })

  // Both ends of a clip have to be a plain standing rest pose. The engine fades
  // in and out over MOTION_FADE at every entry and exit, and a fade only covers
  // a SHORT distance gracefully: `greeting`, now dropped, ended with a hand
  // still up at y=1.15, which is most of an arm's travel to cross in a quarter
  // of a second. This guard is what keeps the fade's job small.
  const MAX_END_DRIFT = 0.1
  // Wrist below the shoulder (y=1.215) means the arm is hanging.
  const MAX_END_WRIST = 1.05

  it.each(Object.entries(AVATAR_MOTIONS))(
    '%s opens and closes on a standing pose',
    (name, def) => {
      const r = rig()
      const m = motion(name as AvatarMotionName)
      const restHipsY = r.restPosition.hips.y
      // Both ends are measured before anything is asserted: a waiver is earned
      // by either end, so the worst of the two is what it has to be judged on.
      let drift = 0
      let wrist = -Infinity
      for (const time of [0, m.duration]) {
        applyMotion(r, m, time)
        const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
        drift = Math.max(drift, Math.abs(hips.x))
        for (const side of ['left', 'right'] as const) {
          wrist = Math.max(wrist, probeHand(r, side).wrist.y)
        }
        // Motion capture brings its own stance with it, and a clip whose ends do
        // not sit at her own height is one three-vrm-animation has mis-seated on
        // her rig. `greeting` opens 0.568 low and rises off the floor over 2.4s,
        // which on the launcher canvas is her sinking most of the way out of
        // frame before she waves. Checked at the ends only: see MAX_HIPS_SINK.
        expect(restHipsY - hips.y, `${name} hips sink at t=${time}`).toBeLessThan(MAX_HIPS_SINK)
      }

      const driftBudget = def.waiver?.hipsDrift
      if (driftBudget !== undefined) {
        expect(drift, `${name} declares a hipsDrift waiver it does not need`).toBeGreaterThan(
          MAX_END_DRIFT,
        )
      }
      expect(drift, `${name} hips drift at its ends`).toBeLessThan(driftBudget ?? MAX_END_DRIFT)

      const wristBudget = def.waiver?.endWrist
      if (wristBudget !== undefined) {
        expect(wrist, `${name} declares an endWrist waiver it does not need`).toBeGreaterThan(
          MAX_END_WRIST,
        )
      }
      expect(wrist, `${name} highest wrist at its ends`).toBeLessThan(
        wristBudget ?? MAX_END_WRIST,
      )
    },
  )
})
