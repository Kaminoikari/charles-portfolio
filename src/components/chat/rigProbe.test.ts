import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { VRMHumanoid } from '@pixiv/three-vrm'
import { parseGlb, readHumanoid, rigOf, type GltfJson } from './vrmHumanoid'
import { crownBound, crownOn } from './clearance'
import { CLEARANCE } from './clearance/vroid-sample-b'
import type { AvatarFamilyId } from './avatarVariants'
import {
  applyMotion,
  buildMotion,
  buildRig,
  deriveFingerSkinRadius,
  deriveRestCrown,
  handJoints,
  headPenetration,
  headVolume,
  probeHand,
  resetRig,
  screenX,
  silhouetteJoints,
  SKIN_ABOVE_JOINT,
  type Motion,
  type Rig,
} from './rigProbe'
import {
  ARM_REST_FORE_Z,
  ARM_REST_UPPER_Z,
  AVATAR_CAMERA_TILT,
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_FOV,
  AVATAR_COLUMN_ASPECT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  avatarViewHalfWidth,
  avatarViewSpan,
} from './avatarMode'
import {
  AVATAR_MOTIONS,
  IDLE_MOTIONS,
  IDLE_ROTATION_START,
  MAX_HIPS_SINK,
  motionPan,
  motionsFor,
  nextIdleMotion,
  OPENING_MOTION,
  settleSeconds,
  settleWeight,
  type AvatarMotionName,
  type IdleRotation,
  type MotionFrame,
} from './avatarMotions'

// The family every declared body belongs to, and the one whose clearance this
// file reads. motionsFor takes it because a second rig can exclude a clip.
const FAMILY = CLEARANCE.family as AvatarFamilyId

const asset = (...parts: string[]): Uint8Array =>
  new Uint8Array(readFileSync(path.join(process.cwd(), 'public', 'avatar', ...parts)))

type Doc = GltfJson & { extensions: NonNullable<GltfJson['extensions']> }

/** A .vrm with its JSON chunk edited in place; the binary chunk is copied through. */
function rewrite(data: Uint8Array, edit: (doc: Doc) => void): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const jsonLength = view.getUint32(12, true)
  const doc = JSON.parse(new TextDecoder().decode(data.subarray(20, 20 + jsonLength))) as Doc
  edit(doc)

  let blob = new TextEncoder().encode(JSON.stringify(doc))
  const pad = (4 - (blob.length % 4)) % 4
  if (pad) {
    const padded = new Uint8Array(blob.length + pad)
    padded.set(blob)
    padded.fill(0x20, blob.length)
    blob = padded
  }
  const rest = data.subarray(20 + jsonLength)
  const out = new Uint8Array(20 + blob.length + rest.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, out.length, true)
  dv.setUint32(12, blob.length, true)
  dv.setUint32(16, view.getUint32(16, true), true)
  out.set(blob, 20)
  out.set(rest, 20 + blob.length)
  return out
}

// A 1.0 export spells the thumb joints Metacarpal/Proximal/Distal where 0.x
// spells them Proximal/Intermediate/Distal (the same three joints).
const THUMB_VRM0_TO_VRM1: Record<string, string> = {
  leftThumbProximal: 'leftThumbMetacarpal',
  leftThumbIntermediate: 'leftThumbProximal',
  rightThumbProximal: 'rightThumbMetacarpal',
  rightThumbIntermediate: 'rightThumbProximal',
}

/**
 * The shipped body rewritten as a VRM 1.0 export would be: humanoid map as a
 * record under VRMC_vrm with the 1.0 thumb names, no VRM block, and every
 * scene root hung under one node turned π about Y so the body faces +Z.
 *
 * The expressions come across too, and they have to: 0.x binds a morph target
 * to a MESH index and 1.0 to a NODE, and since 2026-09-07 the face box is the
 * box of whatever the expressions move. A twin that dropped them would be a
 * body with no identifiable face, which no real 1.0 export is.
 */
function vrm1Twin(data: Uint8Array): Uint8Array {
  return rewrite(data, (doc) => {
    const { bones } = readHumanoid(doc)
    const record: Record<string, { node: number }> = {}
    for (const [bone, node] of Object.entries(bones)) record[THUMB_VRM0_TO_VRM1[bone] ?? bone] = { node }
    const nodeOfMesh = new Map<number, number>()
    doc.nodes.forEach((n, i) => {
      if (n.mesh !== undefined && !nodeOfMesh.has(n.mesh)) nodeOfMesh.set(n.mesh, i)
    })
    const preset: Record<string, { morphTargetBinds: { node: number; index: number; weight: number }[] }> = {}
    for (const group of doc.extensions.VRM?.blendShapeMaster?.blendShapeGroups ?? []) {
      const binds = (group.binds ?? []).flatMap((b) => {
        const node = nodeOfMesh.get(b.mesh)
        return node === undefined ? [] : [{ node, index: b.index ?? 0, weight: (b.weight ?? 100) / 100 }]
      })
      if (binds.length) preset[group.name.toLowerCase()] = { morphTargetBinds: binds }
    }
    delete doc.extensions.VRM
    doc.extensions.VRMC_vrm = { specVersion: '1.0', humanoid: { humanBones: record }, expressions: { preset } }
    doc.extensionsUsed = [...(doc.extensionsUsed ?? []).filter((e) => e !== 'VRM'), 'VRMC_vrm']
    const scene = doc.scenes![doc.scene ?? 0]
    doc.nodes.push({ name: 'vrm1-root', rotation: [0, 1, 0, 0], children: scene.nodes })
    scene.nodes = [doc.nodes.length - 1]
  })
}

/**
 * The shipped body with two bones resting on a rotation: the left upper arm
 * rolled 15° about X and the right lower leg 10° about Z. Every shipped body
 * rests at identity on every node, so without this no test here could tell a
 * retarget that handles rest rotations from one that ignores them.
 */
function tiltedRest(data: Uint8Array): Uint8Array {
  return rewrite(data, (doc) => {
    const { bones } = readHumanoid(doc)
    const q = (axis: THREE.Vector3, deg: number) =>
      new THREE.Quaternion().setFromAxisAngle(axis, (deg * Math.PI) / 180).toArray() as [number, number, number, number]
    doc.nodes[bones.leftUpperArm].rotation = q(new THREE.Vector3(1, 0, 0), 15)
    doc.nodes[bones.rightLowerLeg].rotation = q(new THREE.Vector3(0, 0, 1), 10)
  })
}

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

// Per-(body, clip) numbers live in the clearance file, not on the clip: a
// waiver is a measured violation of THIS family's bodies, and the crown is
// what the spring solver threw on the simulated body carried onto this one by
// its own resting crown (clearance.ts crownOn). AvatarMotionDef keeps only what
// is true of the clip wherever it plays.
const waiverOf = (name: string) => CLEARANCE.clips[name]?.waiver

let cachedRestCrown: number | null = null
function restCrown(): number {
  if (cachedRestCrown === null) {
    const glb = parseGlb(asset('AvatarSample_B_webp.vrm'))
    cachedRestCrown = deriveRestCrown(glb, rig())
  }
  return cachedRestCrown
}
// The crown a frame has to clear: derived through that frame's camera, or the
// browser's worst where a sweep has drawn it higher (crownBound).
const crownOf = (name: string, frame: MotionFrame): number => crownBound(CLEARANCE, name, frame, restCrown())

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

// The frame a clip is actually played in. A clip that declares a pan slides the
// camera while it runs (MotionPan, eased by stepFramePan), so measuring it
// against the resting composition would answer a question the visitor is never
// asked. The sideways budget is unaffected: the pan is vertical, and half-width
// comes from the distance, which it does not touch.
function frameFor(name: AvatarMotionName, placement: MotionFrame) {
  const frame = FRAMES[placement]
  const pan = motionPan(name, placement)
  return {
    halfWidth: frame.halfWidth,
    span: { top: frame.span.top + pan, bottom: frame.span.bottom + pan },
  }
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

  it('accepts a VRM 1.0 twin of the shipped body and reads the same rest pose off it', () => {
    // The same bones, the map spelled the 1.0 way (a record under VRMC_vrm
    // instead of a list under VRM), the whole scene turned to face +Z as a
    // 1.0 export does. Nothing else changes, so every rest position must come
    // back the same up to that half turn -- x and z negated, y untouched.
    const r = buildRig(vrm1Twin(asset('AvatarSample_B_webp.vrm')))
    expect(r.restPosition.leftUpperArm.x).toBeCloseTo(+0.081, 3)
    expect(r.restPosition.rightUpperArm.x).toBeCloseTo(-0.081, 3)
    expect(r.restPosition.head.y).toBeCloseTo(1.32, 2)
    expect(r.restPosition.leftEye.z).toBeGreaterThan(r.restPosition.head.z)
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
    // Left arm straight up, and her whole stance lifted on top of that. The arm
    // alone used to clear both frames; since the waist-up frame was raised to
    // 1.872 for `stretch` it no longer does — straight up from her shoulder is
    // 1.793, which is 79mm SHORT of the new top edge. That is a fact about her
    // proportions, not a reason to lower the frame, so the synthetic pose lifts
    // her instead.
    //
    // +z here, because applyMotion negates it: the arm has to end up raised,
    // and writing the sign that LOOKS right sends it to the floor instead.
    const half = Math.SQRT1_2
    applyMotion(
      r,
      synthetic({
        // applyMotion rescales a hips track by restPosition.hips.y / restHipsY,
        // and synthetic() declares restHipsY = 1, so this is multiplied by 0.878
        // on the way in: 1.25 lands her hips at 1.098, a lift of 0.22.
        hipsY: 1.25,
        rotation: { leftUpperArm: [0, 0, half, half], leftLowerArm: [0, 0, 0, 1] },
      }),
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

  it('has a clearance entry for every clip, measured on this rig', () => {
    // The clearance file is the pool's numbers for this family of bodies. A
    // clip without one has no crown and no waivers, so every guard below would
    // run on defaults; a file measured on some other rig is another body's
    // numbers wearing this one's name (avatarVariants.test.ts holds every
    // declared variant to the same sha).
    expect(Object.keys(CLEARANCE.clips).sort()).toEqual([...names].sort())
    const doc = parseGlb(asset('AvatarSample_B_webp.vrm')).json
    expect(CLEARANCE.rigSha).toBe(createHash('sha256').update(rigOf(doc)).digest('hex'))
  })

  it('carries no browser crown lower than the simulator derives', () => {
    // crownSeen is the worst the browser has drawn a clip's crown at, recorded
    // by hand and only ever raised. The derived crown is the simulator's
    // reading on the same family; a hand number below it is a sweep that
    // missed the peak, and the fix is another sweep, not a lower floor.
    for (const [name, byFrame] of Object.entries(CLEARANCE.crownSeen)) {
      for (const [frame, seen] of Object.entries(byFrame) as [MotionFrame, number][]) {
        const derived = crownOn(CLEARANCE, name, frame, restCrown())
        expect(seen, `${name} browser crown in ${frame} vs derived ${derived.toFixed(4)}`).toBeGreaterThanOrEqual(derived)
      }
    }
  })

  it('was simulated under the composition the engine uses today', () => {
    // crownScreen is a projection through the frame's camera, so it is only
    // as current as the camera it was projected through. A changed framing,
    // fov, tilt or pan without a re-run of springsim --clearance would leave
    // every crown row comparing yesterday's projection with today's edge.
    const f = CLEARANCE.framings
    expect(f.fov).toBe(AVATAR_FOV)
    expect(f.tilt).toBe(AVATAR_CAMERA_TILT)
    expect(f.frames.waistUp).toEqual(AVATAR_FRAMING_DEFAULT)
    expect(f.frames.column).toEqual(AVATAR_FRAMING_COLUMN)
    for (const name of names) {
      expect(f.pans[name] ?? null, `${name} pan when the clearance was produced`).toEqual(AVATAR_MOTIONS[name].pan ?? null)
    }
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
      const faceBudget = waiverOf(name)?.handInHead
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
    // The crown against every declared frame, judged after the loop: a
    // crownTop waiver is needed if the crown leaves ANY declared frame (the
    // column is the tight one), and binds in every frame.
    const crownBudget = waiverOf(name)?.crownTop
    let crownPast = -Infinity
    for (const placement of def.placements) {
      const frame = frameFor(name as AvatarMotionName, placement)
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
        // Every joint of the hand, the same set the face and silhouette guards
        // use. Sampling the wrist and the index tip alone read `stretch` at
        // 1.7698 when its highest bone is a THUMB tip at 1.7971 — 27mm, and the
        // top edge was tuned against the smaller number.
        for (const side of ['left', 'right'] as const) {
          for (const joint of handJoints(r, side)) maxY = Math.max(maxY, joint.y)
        }
      }
      // The bottom edge is not checked: an arm hanging at her side leaves the
      // waist-up frame the same way a real one does, and the canvas masks it.
      // A waiver replaces the budget with the clip's own measured worst case,
      // and is itself checked: declaring one that the clip does not need is a
      // failure, so a stale waiver cannot sit here quietly widening the guard.
      const reachBudget = waiverOf(name)?.reach
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
      // Against the top of her SKIN, not of her skeleton. Clearing the joint
      // alone is what the first attempt at the raised-hand fix did, and it
      // still rendered a cut hand: see SKIN_ABOVE_JOINT.
      const skinTop = maxY + SKIN_ABOVE_JOINT
      const topBudget = waiverOf(name)?.handTop
      if (topBudget !== undefined) {
        expect(
          skinTop,
          `${name} declares a handTop waiver it does not need in ${placement}`,
        ).toBeGreaterThan(frame.span.top)
      }
      expect(skinTop, `${name} highest hand in ${placement}`).toBeLessThan(
        topBudget ?? frame.span.top,
      )
      // …and against the top of her HAIR. The rig has no spring bones, so
      // this file cannot sweep it; the clearance file carries what three-vrm's
      // own spring solver threw on the simulated body (springsim.ts) plus the
      // translucent fringe the browser draws past the topmost vertex, and
      // crownOn moves that onto this body by its own resting crown. What this
      // file can measure is hands, and `dance` never raises one near the top
      // edge — so before the crown row existed nothing here looked at the
      // frame the browser drew 119mm of her hair past on the 2026-08-20 sweep.
      const crown = crownOf(name, placement)
      crownPast = Math.max(crownPast, crown - frame.span.top)
      expect(crown, `${name} highest hair in ${placement}`).toBeLessThan(crownBudget ?? frame.span.top)
    }
    if (crownBudget !== undefined) {
      expect(crownPast, `${name} declares a crownTop waiver it does not need`).toBeGreaterThan(0)
    }
  })

  // A pan has to earn its place, exactly as a waiver does. It costs a visible
  // camera move every time the clip plays, so a clip that would sit inside the
  // resting composition anyway must not ask for one — and a pan left behind
  // after a clip is re-exported or a frame is recomposed is a move the visitor
  // pays for and nobody needs.
  //
  // "Needs it" means the clip leaves the UNPANNED frame: hips out of the bottom
  // (why `dance` pans DOWN in the waist-up frame), a hand out of the top, or a
  // measured crown out of the top (why it pans UP in the column). Those are the
  // three edges the guards above measure, so those are the three this can
  // honestly claim to have checked.
  it.each(Object.entries(AVATAR_MOTIONS))('%s declares no pan it does not need', (name, def) => {
    for (const [frame, pan] of Object.entries(def.pan ?? {}) as [MotionFrame, number][]) {
      // A pan for a frame the clip is never played in is dead configuration:
      // nothing applies it and nothing measures against it.
      expect(def.placements, `${name} pans a frame it does not declare`).toContain(frame)
      expect(pan, `${name} declares a zero pan in ${frame}`).not.toBe(0)

      const r = rig()
      const m = motion(name as AvatarMotionName)
      let lowestHips = Infinity
      let highestHand = -Infinity
      for (const time of m.sampleTimes) {
        applyMotion(r, m, time)
        lowestHips = Math.min(
          lowestHips,
          new THREE.Vector3().setFromMatrixPosition(r.bones.hips.matrixWorld).y,
        )
        for (const side of ['left', 'right'] as const) {
          for (const joint of handJoints(r, side)) highestHand = Math.max(highestHand, joint.y)
        }
      }
      const rest = FRAMES[frame].span
      const escapes =
        lowestHips < rest.bottom ||
        highestHand + SKIN_ABOVE_JOINT > rest.top ||
        crownOf(name, frame) > rest.top
      expect(escapes, `${name} fits ${frame} unpanned and does not need its pan`).toBe(true)
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
  // cap. Her hips at rest are 0.878, the waist-up frame ends at 0.768, and the
  // column's at 0.430; squat's deepest is 0.660, which is why it plays in the
  // column only.
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
        frameFor(name as AvatarMotionName, placement).span.bottom,
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
    (name) => {
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

      const driftBudget = waiverOf(name)?.hipsDrift
      if (driftBudget !== undefined) {
        expect(drift, `${name} declares a hipsDrift waiver it does not need`).toBeGreaterThan(
          MAX_END_DRIFT,
        )
      }
      expect(drift, `${name} hips drift at its ends`).toBeLessThan(driftBudget ?? MAX_END_DRIFT)

      const wristBudget = waiverOf(name)?.endWrist
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


// What the idle picker is allowed to draw from, per placement. The geometry
// guards above answer "does this clip fit here"; this one answers "is it
// offered here at all", which is a different question and the one that went
// wrong on 2026-08-20: `dance` was dropped from the waist-up frame to keep it
// out of a crop it no longer fits, and with the launcher and the docked panel
// both composed waist-up, that took it off the two surfaces a visitor sees
// without opening anything. Nothing failed; it simply stopped happening.
describe('the idle pool', () => {
  it('offers dance wherever she is rendered', () => {
    for (const placement of ['launcher', 'beside-panel', 'column'] as const) {
      expect(motionsFor(placement, FAMILY), `dance is missing from ${placement}`).toContain('dance')
    }
  })

  it('always opens on the dance, whatever else has loaded', () => {
    // The ten clips are fetched together and arrive in network order, and the
    // dance is the largest of them, so the beat that opens has to WAIT rather
    // than take what is there. Every other clip ready and the dance missing is
    // exactly the state that used to hand the opening to whoever won the race.
    const order = motionsFor('column', FAMILY)
    const everythingElse = (name: AvatarMotionName) => name !== OPENING_MOTION
    const held = nextIdleMotion(order, everythingElse, IDLE_ROTATION_START)
    expect(held.pick, 'opened on something other than the dance').toBeNull()
    expect(held.next.opened).toBe(false)

    const opened = nextIdleMotion(order, () => true, IDLE_ROTATION_START)
    expect(opened.pick).toBe(OPENING_MOTION)
    expect(opened.next.opened).toBe(true)
  })

  it('plays the rotation in declared order, not at random', () => {
    // Ten beats from a cold start on a body with every clip ready. The dance
    // leads because the opening says so, then IDLE_MOTIONS from the top. Any
    // repeat inside one lap means the cursor is not advancing.
    const order = motionsFor('column', FAMILY)
    const played: AvatarMotionName[] = []
    let state: IdleRotation = IDLE_ROTATION_START
    for (let i = 0; i < order.length; i++) {
      const { pick, next } = nextIdleMotion(order, () => true, state)
      state = next
      if (pick) played.push(pick)
    }
    expect(played[0]).toBe(OPENING_MOTION)
    expect(new Set(played).size, `repeated inside one lap: ${played.join(', ')}`).toBe(played.length)
    const rest = order.filter((n) => n !== OPENING_MOTION)
    expect(played.slice(1)).toEqual(rest.slice(0, played.length - 1))
  })

  it('wraps back to the top instead of stopping at the end', () => {
    const order = motionsFor('column', FAMILY)
    let state: IdleRotation = IDLE_ROTATION_START
    const played: AvatarMotionName[] = []
    for (let i = 0; i < order.length * 2; i++) {
      const { pick, next } = nextIdleMotion(order, () => true, state)
      state = next
      if (pick) played.push(pick)
    }
    expect(played).toHaveLength(order.length * 2)
    expect(played.slice(order.length)).toEqual(played.slice(0, order.length).map((_, i) =>
      played[order.length + i]))
    // The second lap covers the same set as the first.
    expect(new Set(played.slice(order.length))).toEqual(new Set(played.slice(0, order.length)))
  })

  it('steps over a clip that has not arrived rather than waiting for it', () => {
    // A slow download costs that clip its turn, never the rotation. Waiting
    // here would freeze every performance behind one file.
    const order = motionsFor('column', FAMILY)
    const missing = order.find((n) => n !== OPENING_MOTION)!
    let state: IdleRotation = { cursor: 0, opened: true }
    const played: AvatarMotionName[] = []
    for (let i = 0; i < order.length; i++) {
      const { pick, next } = nextIdleMotion(order, (n) => n !== missing, state)
      state = next
      if (pick) played.push(pick)
    }
    expect(played).not.toContain(missing)
    expect(played).toHaveLength(order.length)
  })

  it('gives up on a dance that never arrives instead of never performing', () => {
    // An unbounded wait trades a missing opening for a character who stands
    // still for the life of the page, which is far worse than the wrong clip.
    const order = motionsFor('column', FAMILY)
    const withoutDance = (name: AvatarMotionName) => name !== OPENING_MOTION
    const { pick, next } = nextIdleMotion(order, withoutDance, IDLE_ROTATION_START, true)
    expect(pick, 'expired and still played nothing').not.toBeNull()
    expect(pick).not.toBe(OPENING_MOTION)
    expect(next.opened).toBe(true)
  })

  it('holds its place when nothing at all has loaded', () => {
    const order = motionsFor('column', FAMILY)
    const state: IdleRotation = { cursor: 3, opened: true }
    const { pick, next } = nextIdleMotion(order, () => false, state)
    expect(pick).toBeNull()
    expect(next).toEqual(state)
  })

  it('offers every idle clip somewhere, so the rotation can reach them all', () => {
    // motionsFor filters twice: by frame, and by what this family excludes. A
    // clip listed in IDLE_MOTIONS that no placement offers is one the rotation
    // steps over forever — unless this family has written down why it cannot
    // wear it, which is a decision rather than a gap.
    const excluded = CLEARANCE.excluded
    const reachable = new Set([
      ...motionsFor('launcher', FAMILY),
      ...motionsFor('beside-panel', FAMILY),
      ...motionsFor('column', FAMILY),
    ])
    for (const name of IDLE_MOTIONS) {
      if (name in excluded) {
        // The other direction, and the one that needs saying: a clip this
        // family excludes must not be reachable on it. No family excludes a
        // pool clip today, so this branch is unreached until a second rig
        // declares one; evidence/families-0906-mutate.py runs it against a
        // clearance that excludes `squat`, where dropping motionsFor's
        // exclusion filter turns it red.
        expect(reachable.has(name), `${name} is excluded on ${FAMILY} but still offered`).toBe(false)
        continue
      }
      expect(reachable.has(name), `${name} is in the rotation but no placement offers it`).toBe(true)
    }
  })

  it('offers nothing where she is not rendered', () => {
    expect(motionsFor('hidden', FAMILY)).toHaveLength(0)
  })

  it('draws only from clips the frame guards above have measured', () => {
    // Every name the picker can return has to be a key of AVATAR_MOTIONS, which
    // is what every guard in this file iterates. A clip reachable at runtime but
    // absent from that table would be unmeasured.
    for (const placement of ['launcher', 'beside-panel', 'column'] as const) {
      for (const name of motionsFor(placement, FAMILY)) expect(AVATAR_MOTIONS[name]).toBeDefined()
    }
  })
})

// The handover at the end of a clip. What the visitor sees is not the clip's
// last frame, it is the trip from there back to the pinned rest pose, and that
// trip was reported as "too fast, unnatural" on 2026-08-20.
describe('returning to rest', () => {
  // The pinned rest pose, rebuilt from the same two constants ARM_PINS uses in
  // avatarGuideEngine.ts. Reading it from source is the point: change the rest
  // pose and the settle distances below move with it.
  function pinnedRest(r: Rig): { left: THREE.Vector3; right: THREE.Vector3 } {
    resetRig(r)
    r.bones.leftUpperArm.rotation.set(0, 0, ARM_REST_UPPER_Z)
    r.bones.rightUpperArm.rotation.set(0, 0, -ARM_REST_UPPER_Z)
    r.bones.leftLowerArm.rotation.set(0, 0, ARM_REST_FORE_Z)
    r.bones.rightLowerArm.rotation.set(0, 0, -ARM_REST_FORE_Z)
    r.root.updateMatrixWorld(true)
    return {
      left: new THREE.Vector3().setFromMatrixPosition(r.bones.leftHand.matrixWorld),
      right: new THREE.Vector3().setFromMatrixPosition(r.bones.rightHand.matrixWorld),
    }
  }

  /** How far the settle has to carry her wrists after this clip's last frame. */
  function endDistance(name: AvatarMotionName): number {
    const r = rig()
    const rest = pinnedRest(r)
    const m = motion(name)
    applyMotion(r, m, m.duration)
    const l = new THREE.Vector3().setFromMatrixPosition(r.bones.leftHand.matrixWorld)
    const right = new THREE.Vector3().setFromMatrixPosition(r.bones.rightHand.matrixWorld)
    return Math.max(l.distanceTo(rest.left), right.distanceTo(rest.right))
  }

  it('eases in and out instead of ramping', () => {
    expect(settleWeight(0, 0.5)).toBe(1)
    expect(settleWeight(0.5, 0.5)).toBe(0)
    expect(settleWeight(0.6, 0.5)).toBe(0)
    expect(settleWeight(0.25, 0.5)).toBeCloseTo(0.5, 6)
    // The whole point, and what a linear ramp fails: she leaves the clip's pose
    // from a standstill and arrives at rest at a standstill. A linear fade
    // would have moved 10% of the way in each of these, which is the velocity
    // step that was reported as unnatural.
    expect(1 - settleWeight(0.05, 0.5)).toBeLessThan(0.03)
    expect(settleWeight(0.45, 0.5)).toBeLessThan(0.03)
  })

  it('spends longer on a settle that has further to travel', () => {
    // Between the clamps the duration tracks the distance, so the SPEED is the
    // constant rather than the duration. That band is 0.18m to 0.338m, which is
    // where `idleLoop` and `dance` sit; everything shorter rides the floor.
    expect(settleSeconds(0.3)).toBeCloseTo(settleSeconds(0.2) * 1.5, 6)
    // …and outside them it stops, so a clip ending already at rest still takes
    // a moment and one ending mid-air does not take all day.
    expect(settleSeconds(0)).toBe(settleSeconds(0.05))
    expect(settleSeconds(2)).toBe(settleSeconds(10))
    expect(settleSeconds(2)).toBeLessThan(1)
  })

  // The guard for the actual complaint. Every bundled clip is measured, so a
  // new one that ends with an arm out cannot quietly get a 0.3s snap.
  it.each(Object.keys(AVATAR_MOTIONS))('%s puts its arms down at a human speed', (name) => {
    const distance = endDistance(name as AvatarMotionName)
    const speed = distance / settleSeconds(distance)
    expect(speed, `${name} settle speed (m/s over ${distance.toFixed(3)}m)`).toBeLessThan(0.75)
  })

  // The floor is the half of the fix that reaches the clips the idle picker
  // actually draws: seven of the eight waist-up clips end within 0.143m of rest,
  // so the speed limit alone would leave them at roughly the timing that was
  // reported as too fast. Nothing else pins it — the ceiling above is far too
  // loose to notice — so the complaint is written down as a requirement here.
  const FLAT_FADE_WAS = 0.25
  it.each(Object.keys(AVATAR_MOTIONS))('%s settles slower than the fade it replaced', (name) => {
    const distance = endDistance(name as AvatarMotionName)
    const before = distance / FLAT_FADE_WAS
    const now = distance / settleSeconds(distance)
    expect(now, `${name} settle speed against the flat ${FLAT_FADE_WAS}s fade`).toBeLessThan(
      before * 0.7,
    )
  })

  // …and the scaling has to be load-bearing on the real clips, not just on
  // synthetic distances: at least one bundled clip must end far enough out that
  // it needs more than the shortest settle. `dance` ends 0.540m from rest,
  // `idleLoop` 0.231m; at the old flat 0.25s those were 2.16 and 0.92 m/s.
  it('has at least one clip that the distance scaling actually lengthens', () => {
    const shortest = settleSeconds(0)
    const stretched = (Object.keys(AVATAR_MOTIONS) as AvatarMotionName[]).filter(
      (name) => settleSeconds(endDistance(name)) > shortest,
    )
    expect(stretched.length).toBeGreaterThan(0)
  })
})

// Phase 6a (2026-09-06): the rig IS three-vrm's VRMHumanoid, built on the
// file's own node tree. The normalized bones the tests above pose are the
// humanoid's normalized nodes; `humanoid.update()` writes them through to the
// raw nodes, which is what the browser skins. Until now this file, springsim.ts
// and motion.py each carried their own retarget, and the VRM0 axis flip in
// all three was unconditional: a VRM 1.0 body would have played every clip
// mirrored front-to-back, and the rigProbe twin test above passed anyway
// because it only reads the rest pose.
describe('three-vrm humanoid rig', () => {
  /** A .glb container round the two chunks, for the hand-built bodies below. */
  const glb = (json: unknown, bin: Uint8Array): Uint8Array => {
    const text = new TextEncoder().encode(JSON.stringify(json))
    const pad = (n: number) => (4 - (n % 4)) % 4
    const out = new Uint8Array(12 + 8 + text.length + pad(text.length) + 8 + bin.length + pad(bin.length))
    const dv = new DataView(out.buffer)
    dv.setUint32(0, 0x46546c67, true)
    dv.setUint32(4, 2, true)
    dv.setUint32(8, out.length, true)
    dv.setUint32(12, text.length + pad(text.length), true)
    dv.setUint32(16, 0x4e4f534a, true)
    out.set(text, 20)
    out.fill(0x20, 20 + text.length, 20 + text.length + pad(text.length))
    const binAt = 20 + text.length + pad(text.length)
    dv.setUint32(binAt, bin.length + pad(bin.length), true)
    dv.setUint32(binAt + 4, 0x004e4942, true)
    out.set(bin, binAt + 8)
    return out
  }

  const world = (o: THREE.Object3D): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld)
  const SAMPLE = ['hips', 'head', 'leftHand', 'rightHand', 'leftFoot', 'rightIndexTip', 'leftThumbDistal'] as const

  it('is a VRMHumanoid and knows which VRM version it came from', () => {
    const r = rig()
    expect(r.humanoid).toBeInstanceOf(VRMHumanoid)
    expect(r.version).toBe('0')
    expect(buildRig(vrm1Twin(asset('AvatarSample_B_webp.vrm'))).version).toBe('1')
  })

  it('names the thumb joints the way three-vrm does, and a thumb track lands on them', () => {
    const r = rig()
    // VRM 0.x spells them Proximal/Intermediate/Distal; VRMHumanoid renames
    // them on import to the 1.0 Metacarpal/Proximal/Distal, which is also how
    // every .vrma names them, so no renaming is left for a track to miss.
    expect('leftThumbMetacarpal' in r.bones).toBe(true)
    expect('leftThumbIntermediate' in r.bones).toBe(false)
    expect(handJoints(r, 'left')).toHaveLength(21)
    const m = motion('dance')
    expect('leftThumbMetacarpal' in m.rotation).toBe(true)
    applyMotion(r, m, 3.89)
    expect(r.bones.leftThumbMetacarpal.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.01)
  })

  it('plays a clip on a VRM 1.0 twin without the VRM0 flip, so the two bodies strike the same pose', () => {
    // The twin is the same body turned π about Y. A clip is authored in VRM 1.0
    // space; three-vrm flips x/z for a 0.x body and leaves a 1.0 body alone.
    // Done right, the two posed bodies differ by exactly that half turn: every
    // joint of the twin sits at (-x, y, -z) of the shipped body's.
    const v0 = rig()
    const v1 = buildRig(vrm1Twin(asset('AvatarSample_B_webp.vrm')))
    const m = motion('dance')
    for (const t of [3.89, 10.0, 17.23]) {
      applyMotion(v0, m, t)
      applyMotion(v1, m, t)
      for (const bone of SAMPLE) {
        const a = world(v0.bones[bone])
        const b = world(v1.bones[bone])
        expect(b.x, `${bone} x @${t}`).toBeCloseTo(-a.x, 6)
        expect(b.y, `${bone} y @${t}`).toBeCloseTo(a.y, 6)
        expect(b.z, `${bone} z @${t}`).toBeCloseTo(-a.z, 6)
      }
    }
  })

  it('flips the clip for the 0.x body it ships on', () => {
    // The twin test above only says the two bodies agree up to the half turn,
    // which a flip applied to the WRONG version satisfies just as well. This
    // pins the flip to the 0.x body with a fact of the dance: at 8.23s her
    // hand is at her cheek (the face waiver dance ships with), and the
    // unflipped clip puts it nowhere near (ellipsoid value 11.9, probe
    // evidence/retarget-0906-probe-flip.log).
    const r = rig()
    const volume = headVolume(r)
    applyMotion(r, motion('dance'), 8.23)
    let closest = Infinity
    for (const side of ['left', 'right'] as const) {
      for (const joint of handJoints(r, side)) closest = Math.min(closest, headPenetration(r, volume, joint))
    }
    expect(closest).toBeLessThan(0.5)
  })

  it('writes the pose through to the raw nodes, rest rotations included', () => {
    // The raw nodes are what the mesh is skinned to. On a body whose bones rest
    // on a rotation, a retarget that ignores the rest lands the raw arm
    // somewhere else than the normalized one; the two have to coincide.
    for (const body of [asset('AvatarSample_B_webp.vrm'), tiltedRest(asset('AvatarSample_B_webp.vrm'))]) {
      const r = buildRig(body)
      const m = motion('dance')
      for (const t of [0, 3.89, 10.0]) {
        applyMotion(r, m, t)
        for (const bone of Object.keys(r.bones)) {
          if (bone.endsWith('Tip')) continue // synthetic, no raw node
          const raw = r.humanoid.getRawBoneNode(bone as never)
          if (!raw) throw new Error(`no raw ${bone}`)
          expect(world(raw).distanceTo(world(r.bones[bone])), `${bone} @${t}`).toBeLessThan(1e-6)
        }
      }
    }
  })

  it('derives the face box from the meshes the expressions move, instead of carrying 2026-08-19 numbers', () => {
    const r = rig()
    // The numbers the box replaced, measured by hand on 2026-08-19 against a
    // head bone at (0, 1.320, 0.005): x ±0.092, y 1.287–1.503, z -0.113–0.033.
    const expected = { min: [-0.092, 1.287, -0.113], max: [0.092, 1.503, 0.033] }
    for (const side of ['min', 'max'] as const) {
      for (const [k, axis] of (['x', 'y', 'z'] as const).entries()) {
        expect(Math.abs(r.faceBox[side][axis] - expected[side][k]), `${side}.${axis}`).toBeLessThan(0.002)
      }
    }
    // The hair is skinned to the head too and reaches 0.1m higher; a box that
    // included it would let a hand hover above her crown and call it a hit.
    expect(r.faceBox.max.y).toBeLessThan(1.51)
    // Derived in the file's own space: the twin's box is the shipped box turned round.
    const twin = buildRig(vrm1Twin(asset('AvatarSample_B_webp.vrm')))
    expect(twin.faceBox.min.z).toBeCloseTo(-0.033, 3)
    expect(twin.faceBox.max.z).toBeCloseTo(0.113, 3)
    expect(headVolume(twin).centre.z).toBeCloseTo(-headVolume(r).centre.z, 6)
  })

  it('leaves the neck rows out of the face box', () => {
    // The shipped Face mesh has no vertex weighted mostly to anything but the
    // head, so the filter is invisible there; a two-vertex Face mesh with one
    // vertex on the neck shows what it is for.
    const bone = (name: string, translation: number[]) => ({ name, translation })
    const nodes = [
      { ...bone('Hips', [0, 0.8, 0]), children: [1] },
      { ...bone('Neck', [0, 0.4, 0]), children: [2] },
      bone('Head', [0, 0.1, 0]),
      { name: 'Face', mesh: 0, skin: 0 },
    ]
    const positions = new Float32Array([0, 1.4, 0, 0, 0.9, 0]) // one at the head, one far down the neck
    const joints = new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0])
    const weights = new Float32Array([1, 0, 0, 0, 0.9, 0.1, 0, 0])
    // Inverse bind matrices: the inverses of the joints' rest globals (hips
    // 0.8, neck 1.2, head 1.3), column-major, so skinning at rest is identity.
    const ibm = new Float32Array(3 * 16)
    ;[0.8, 1.2, 1.3].forEach((y, k) => new THREE.Matrix4().makeTranslation(0, -y, 0).toArray(ibm, k * 16))
    const bin = new Uint8Array(positions.byteLength + joints.byteLength + weights.byteLength + ibm.byteLength)
    bin.set(new Uint8Array(positions.buffer), 0)
    bin.set(joints, positions.byteLength)
    bin.set(new Uint8Array(weights.buffer), positions.byteLength + joints.byteLength)
    bin.set(new Uint8Array(ibm.buffer), positions.byteLength + joints.byteLength + weights.byteLength)
    const json = {
      scene: 0,
      scenes: [{ nodes: [0, 3] }],
      nodes,
      meshes: [{ name: 'Face', primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
      skins: [{ joints: [0, 1, 2], inverseBindMatrices: 3 }],
      bufferViews: [
        { byteOffset: 0, byteLength: positions.byteLength },
        { byteOffset: positions.byteLength, byteLength: joints.byteLength },
        { byteOffset: positions.byteLength + joints.byteLength, byteLength: weights.byteLength },
        { byteOffset: positions.byteLength + joints.byteLength + weights.byteLength, byteLength: ibm.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 2, type: 'VEC3' },
        { bufferView: 1, componentType: 5121, count: 2, type: 'VEC4' },
        { bufferView: 2, componentType: 5126, count: 2, type: 'VEC4' },
        { bufferView: 3, componentType: 5126, count: 3, type: 'MAT4' },
      ],
      // A blendShape group binding mesh 0 is what marks that mesh as the face.
      // Since 2026-09-07 that is the whole identification -- the mesh being
      // CALLED Face is now decoration, and this fixture keeps the name only so
      // the test still reads as being about a face.
      extensions: {
        VRM: {
          humanoid: { humanBones: [{ bone: 'hips', node: 0 }, { bone: 'neck', node: 1 }, { bone: 'head', node: 2 }] },
          blendShapeMaster: { blendShapeGroups: [{ name: 'Blink', binds: [{ mesh: 0, index: 0, weight: 100 }] }] },
        },
      },
    }
    const r = buildRig(glb(json, bin))
    expect(r.faceBox.min.y).toBeCloseTo(1.4, 6)
    expect(r.faceBox.max.y).toBeCloseTo(1.4, 6)
  })

  /**
   * A body with two meshes: mesh 0 (`hair`) hangs off node 3 and mesh 1
   * (`Face`) off node 4, both skinned wholly to the head. Which one the face
   * box lands on is decided entirely by `ext`, and the two indices are kept
   * apart on purpose — a 1.0 bind names a NODE, and reading it as a mesh index
   * is a bug that hides on any body where the two happen to agree.
   */
  const twoMeshBody = (ext: Record<string, unknown>): Uint8Array => {
    const bone = (name: string, translation: number[]) => ({ name, translation })
    const nodes = [
      { ...bone('Hips', [0, 0.8, 0]), children: [1] },
      { ...bone('Neck', [0, 0.4, 0]), children: [2] },
      bone('Head', [0, 0.1, 0]),
      { name: 'the-real-face', mesh: 0, skin: 0 },
      { name: 'the-decoy', mesh: 1, skin: 0 },
    ]
    const positions = new Float32Array([0, 1.4, 0, 0, 1.45, 0, 0, 1.9, 0, 0, 1.95, 0])
    const joints = new Uint8Array(16)
    for (let v = 0; v < 4; v++) joints[v * 4] = 2 // every vertex on the head
    const weights = new Float32Array(16)
    for (let v = 0; v < 4; v++) weights[v * 4] = 1
    const ibm = new Float32Array(3 * 16)
    ;[0.8, 1.2, 1.3].forEach((y, k) => new THREE.Matrix4().makeTranslation(0, -y, 0).toArray(ibm, k * 16))
    const bin = new Uint8Array(320)
    bin.set(new Uint8Array(positions.buffer), 0)
    bin.set(joints, 48)
    bin.set(new Uint8Array(weights.buffer), 64)
    bin.set(new Uint8Array(ibm.buffer), 128)
    const skinned = { JOINTS_0: 2, WEIGHTS_0: 3 }
    return glb(
      {
        scene: 0,
        scenes: [{ nodes: [0, 3, 4] }],
        nodes,
        meshes: [
          { name: 'hair', primitives: [{ attributes: { POSITION: 0, ...skinned } }] },
          { name: 'Face', primitives: [{ attributes: { POSITION: 1, ...skinned } }] },
        ],
        skins: [{ joints: [0, 1, 2], inverseBindMatrices: 4 }],
        bufferViews: [
          { byteOffset: 0, byteLength: 48 },
          { byteOffset: 48, byteLength: 16 },
          { byteOffset: 64, byteLength: 64 },
          { byteOffset: 128, byteLength: 192 },
        ],
        accessors: [
          { bufferView: 0, byteOffset: 0, componentType: 5126, count: 2, type: 'VEC3' },
          { bufferView: 0, byteOffset: 24, componentType: 5126, count: 2, type: 'VEC3' },
          { bufferView: 1, componentType: 5121, count: 2, type: 'VEC4' },
          { bufferView: 2, componentType: 5126, count: 2, type: 'VEC4' },
          { bufferView: 3, componentType: 5126, count: 3, type: 'MAT4' },
        ],
        extensions: ext,
      },
      bin,
    )
  }

  it('finds the face by what the expressions move, not by what a mesh is called', () => {
    // The generalisation, stated as the case that used to go wrong: a body
    // whose face mesh is called `hair` and which also has a mesh called `Face`
    // that no expression touches. Reading the name picks the decoy and puts the
    // face box 50cm too high; reading the binds picks the real one. Seed-san is
    // this body in the wild — its meshes are hair, hair_tail, head, robo_arm,
    // wear, and the one the expressions deform is `head`.
    const r = buildRig(
      twoMeshBody({
        VRM: {
          humanoid: { humanBones: [{ bone: 'hips', node: 0 }, { bone: 'neck', node: 1 }, { bone: 'head', node: 2 }] },
          blendShapeMaster: { blendShapeGroups: [{ name: 'Blink', binds: [{ mesh: 0, index: 0, weight: 100 }] }] },
        },
      }),
    )
    expect(r.faceBox.min.y, 'the bound mesh is the face').toBeCloseTo(1.4, 6)
    expect(r.faceBox.max.y, 'and the mesh merely CALLED Face is not').toBeCloseTo(1.45, 6)
  })

  it("resolves a 1.0 expression bind through the node it names to that node's mesh", () => {
    // Same body, same face, written the 1.0 way: `morphTargetBinds` names node
    // 3, whose mesh is 0. Taking the 3 for a mesh index finds nothing (there is
    // no mesh 3) and the box comes back empty.
    const r = buildRig(
      twoMeshBody({
        VRMC_vrm: {
          specVersion: '1.0',
          humanoid: { humanBones: { hips: { node: 0 }, neck: { node: 1 }, head: { node: 2 } } },
          expressions: { preset: { blink: { morphTargetBinds: [{ node: 3, index: 0, weight: 1 }] } } },
        },
      }),
    )
    expect(r.faceBox.min.y, 'the mesh hanging off the node the bind names').toBeCloseTo(1.4, 6)
    expect(r.faceBox.max.y).toBeCloseTo(1.45, 6)
  })

  it('reads a finger skin radius off the mesh that covers the hand-measured margin', () => {
    // SKIN_ABOVE_JOINT (12mm) was read off a screenshot. The mesh says how far
    // the skin of the two outer phalanges sits from their bone: that has to be
    // at least the margin the frame reserves, and nowhere near a palm.
    const radius = deriveFingerSkinRadius(parseGlb(asset('AvatarSample_B_webp.vrm')), rig())
    expect(radius).toBeGreaterThanOrEqual(SKIN_ABOVE_JOINT)
    expect(radius).toBeLessThan(0.02)
  })
})
