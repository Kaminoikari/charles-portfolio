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
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  avatarColumnBox,
  avatarViewHalfWidth,
  avatarViewSpan,
} from './avatarMode'
import {
  AVATAR_MOTIONS,
  columnVisibleHalfWidth,
  MAX_HIPS_SINK,
  motionsFor,
  type AvatarMotionName,
} from './avatarMotions'

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
// The column's budget is its VISIBLE half-width, not its canvas half-width. The
// column canvas deliberately overhangs the viewport's right edge so her body
// sits against it, which means the outer slice of her gesture margin is off
// screen. Certifying a clip against the full canvas would wave through one that
// is cut off on the right for every visitor.
//
// That loss is a fixed 32px out of however wide the canvas rendered, so it is
// NOT one number: the column is 1136px at 1920x1080 and 160px on an iPad in
// portrait, which keeps 0.6365m and 0.4051m of her right side respectively. The
// desktop reference below is what the bundled clips are certified at; the
// narrow end is handled by motionsFor(), which withholds a clip whose reach the
// canvas cannot show, and is guarded separately.
const COLUMN_REFERENCE = { vw: 1440, vh: 900 }
const COLUMN_BOX = avatarColumnBox(COLUMN_REFERENCE.vw, COLUMN_REFERENCE.vh)

// `canvasHalfWidth` is what the canvas frames; `halfWidth` is what the viewer
// can see of its RIGHT half after the column's overhang. They are the same
// number for the waist-up canvases, which are wholly on screen.
const FRAMES = {
  waistUp: {
    canvasHalfWidth: avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
    halfWidth: avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
    span: avatarViewSpan(AVATAR_FRAMING_DEFAULT),
  },
  column: {
    canvasHalfWidth: columnVisibleHalfWidth(Infinity),
    halfWidth: columnVisibleHalfWidth(COLUMN_BOX.w),
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

  it('sees a stance that sinks', () => {
    const r = rig()
    const restHipsY = r.restPosition.hips.y
    applyMotion(r, synthetic({ hipsY: restHipsY - 0.3 }), 0)
    const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
    expect(restHipsY - hips.y).toBeGreaterThan(MAX_HIPS_SINK)
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
      expect(worst, `${name} deepest fingertip against her face`).toBeGreaterThan(1)
      expect(def.placements.length).toBeGreaterThan(0)
    },
  )

  // The two sideways edges are cropped differently, so they are checked against
  // different budgets. The canvas is centred on her, and its LEFT half is wholly
  // on screen (it floats over the transcript, transparent), so that side only
  // has to fit the canvas. Its RIGHT half is where the column overhangs the
  // viewport, so that side has to fit what is actually visible.
  //
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
      expect(screenLeft, `${name} reach to the viewer's left in ${placement}`).toBeLessThan(
        frame.canvasHalfWidth,
      )
      expect(screenRight, `${name} reach to the viewer's right in ${placement}`).toBeLessThan(
        frame.halfWidth,
      )
      expect(maxY, `${name} highest hand in ${placement}`).toBeLessThan(frame.span.top)
    }
  })


  // motionsFor() decides at run time whether a column is wide enough to show a
  // clip, and it decides from AvatarMotionDef.screenRightReach. That number is a
  // hand-written copy of a measurement, so it is pinned to the measurement here;
  // otherwise swapping a .vrma leaves the picker filtering on the old file's
  // reach and the guard below certifies nothing. It is also the number whose
  // SIGN is easy to get wrong, which is the whole reason it goes through
  // screenX rather than reading wrist.x directly.
  it.each(Object.entries(AVATAR_MOTIONS))(
    '%s declares the reach the picker filters on',
    (name, def) => {
      const r = rig()
      const m = motion(name as AvatarMotionName)
      let measured = -Infinity
      for (const time of m.sampleTimes) {
        applyMotion(r, m, time)
        for (const joint of silhouetteJoints(r)) {
          measured = Math.max(measured, screenX(joint.x))
        }
      }
      expect(measured, `${name} measured reach to the viewer's right`).toBeCloseTo(
        def.screenRightReach,
        3,
      )
    },
  )

  // How much of the viewer's right survives depends on the canvas's pixel width.
  // At the desktop reference every column clip fits. At the narrowest a column
  // ever gets — a tablet held upright, where `md` has only just been met — the
  // canvas is 160px and its budget no longer covers peaceSign.
  it('offers a column clip only while the canvas can show its reach', () => {
    const column = motionsFor('column', COLUMN_BOX.w)
    expect(column.length).toBeGreaterThan(0)
    for (const name of column) {
      expect(
        AVATAR_MOTIONS[name].screenRightReach,
        `${name} at the ${Math.round(COLUMN_BOX.w)}px reference column`,
      ).toBeLessThan(FRAMES.column.halfWidth)
    }

    const narrow = avatarColumnBox(768, 1024)
    const narrowBudget = columnVisibleHalfWidth(narrow.w)
    expect(narrowBudget).toBeLessThan(FRAMES.column.halfWidth)
    const offered = motionsFor('column', narrow.w)
    expect(offered.length).toBeLessThan(column.length)
    for (const name of offered) {
      expect(AVATAR_MOTIONS[name].screenRightReach).toBeLessThan(narrowBudget)
    }

    // An unmeasured column canvas is treated as the worst case, so a caller that
    // forgets the width gets silence instead of a clipped hand.
    expect(motionsFor('column')).toHaveLength(0)
    // The waist-up canvases are wholly on screen, so they are unaffected.
    expect(motionsFor('launcher')).toHaveLength(Object.keys(AVATAR_MOTIONS).length)
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

  // Motion capture brings its own stance with it. `greeting` was dropped from
  // the pack over exactly this: its hips open 0.57m below her rest height and
  // rise off the floor over four seconds, which on the launcher canvas is her
  // sinking most of the way out of frame before she waves.
  it.each(Object.keys(AVATAR_MOTIONS))('%s keeps her standing at her own height', (name) => {
    const r = rig()
    const m = motion(name as AvatarMotionName)
    const restHipsY = r.restPosition.hips.y
    let deepest = 0
    for (const time of m.sampleTimes) {
      applyMotion(r, m, time)
      const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
      deepest = Math.max(deepest, restHipsY - hips.y)
    }
    expect(deepest, `${name} deepest hips sink`).toBeLessThan(MAX_HIPS_SINK)
  })

  // Both ends of a clip have to be a plain standing rest pose. The engine fades
  // in and out over MOTION_FADE at every entry and exit, and a fade only covers
  // a SHORT distance gracefully: `greeting`, now dropped, ended with a hand
  // still up at y=1.15, which is most of an arm's travel to cross in a quarter
  // of a second. This guard is what keeps the fade's job small.
  it.each(Object.keys(AVATAR_MOTIONS))('%s opens and closes on a standing pose', (name) => {
    const r = rig()
    const m = motion(name as AvatarMotionName)
    for (const time of [0, m.duration]) {
      applyMotion(r, m, time)
      const hips = new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld)
      expect(Math.abs(hips.x), `${name} hips drift at t=${time}`).toBeLessThan(0.1)
      for (const side of ['left', 'right'] as const) {
        // Wrist below the shoulder (y=1.215) means the arm is hanging.
        expect(probeHand(r, side).wrist.y, `${name} ${side} wrist at t=${time}`).toBeLessThan(1.05)
      }
    }
  })
})
