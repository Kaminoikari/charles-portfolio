// The two poses she stands in when no clip is driving her arms.
//
// Until 2026-09-30 that was one A-pose written as two raw Z angles for every
// body (upper arm 66° down, forearm 14° more in the frontal plane, flat hands):
// a mannequin. docs/plans/avatar-idle-poses.md has the owner's two reference
// poses and the render prototype behind the numbers here.
//
// Both poses are written in BODY terms, which way each segment points and which
// way its palm faces, and turned into joint rotations per body. That is what
// lets one definition stand on a 0.x body facing -Z and a 1.0 body facing +Z,
// on long arms and short ones. The clasp behind the back is solved rather than
// authored: the holding hand's arm is placed by two-bone IK so its palm lands
// on the other wrist on every body, instead of on the one body the angles were
// tuned on.
//
// Pure: the solver reads rest positions and returns local rotations for three's
// normalized bones. The engine writes them (avatarGuideEngine), and rigProbe
// poses the real skeleton with them so rigProbe.test.ts can measure where the
// hands land on each family. Neither keeps a copy of a number from here.
import * as THREE from 'three'

export type IdlePoseName = 'open' | 'behind'

export const IDLE_POSES: readonly IdlePoseName[] = ['open', 'behind']

/**
 * What the solver needs from a body: its VRM version (which way it faces) and
 * where each normalized bone rests, in the file's own space. Only differences
 * of these are used, so any common offset (the hips lifted, the scene moved)
 * cancels.
 */
export interface PoseSkeleton {
  version: '0' | '1'
  rest: (bone: string) => THREE.Vector3 | undefined
}

/** A pose: local rotations for normalized bones, by VRM 1.0 bone name. */
export type PoseRotations = ReadonlyMap<string, THREE.Quaternion>

export interface SolvedPose {
  rotations: PoseRotations
  /**
   * Behind the back only: how far the holding palm ended up from where the
   * clasp puts it, in metres. 0 when the arm can reach, which it can on every
   * shipped body; the probe asserts that.
   */
  claspError: number
}

const SIDES = ['left', 'right'] as const
type Side = (typeof SIDES)[number]
const FOUR_FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const
const SEGMENTS = ['Proximal', 'Intermediate', 'Distal'] as const
const THUMB = ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal'] as const

/** Every bone a pose writes, per side: shoulder, arm, hand and fifteen finger joints. */
export function poseBones(side: Side): string[] {
  const out = [`${side}Shoulder`, `${side}UpperArm`, `${side}LowerArm`, `${side}Hand`]
  for (const f of FOUR_FINGERS) for (const s of SEGMENTS) out.push(`${side}${f}${s}`)
  for (const t of THUMB) out.push(`${side}${t}`)
  return out
}

export const POSE_BONES: readonly string[] = [...poseBones('left'), ...poseBones('right')]

const rad = THREE.MathUtils.degToRad

/** The body's own axes: forward (toward the viewer), up, and her left. */
interface Axes {
  f: THREE.Vector3
  u: THREE.Vector3
  l: THREE.Vector3
}

function axesOf(version: '0' | '1'): Axes {
  // A 0.x body faces -Z and a 1.0 body +Z (rigProbe's COORDINATE SPACE note);
  // her left is up × forward either way.
  const f = new THREE.Vector3(0, 0, version === '0' ? -1 : 1)
  const u = new THREE.Vector3(0, 1, 0)
  return { f, u, l: new THREE.Vector3().crossVectors(u, f) }
}

/**
 * The rotation that carries a rest segment (axis `a0`, palm normal `n0`) onto
 * a posed one (`a1`, `n1`). The normals are only directions to twist toward:
 * each is made square to its axis first.
 */
export function basisRotation(
  a0: THREE.Vector3,
  n0: THREE.Vector3,
  a1: THREE.Vector3,
  n1: THREE.Vector3,
): THREE.Quaternion {
  const frame = (a: THREE.Vector3, n: THREE.Vector3): THREE.Matrix4 => {
    const x = a.clone().normalize()
    const y = n.clone().addScaledVector(x, -n.dot(x)).normalize()
    return new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y))
  }
  const m = frame(a1, n1).multiply(frame(a0, n0).transpose())
  return new THREE.Quaternion().setFromRotationMatrix(m)
}

/**
 * A direction out of the shoulder: `out` degrees away from hanging straight
 * down toward her side `o`, then `fwd` degrees toward the viewer (negative is
 * behind her).
 */
function hang(ax: Axes, o: THREE.Vector3, out: number, fwd: number): THREE.Vector3 {
  return o
    .clone()
    .multiplyScalar(Math.sin(rad(out)))
    .addScaledVector(ax.u, -Math.cos(rad(out)))
    .addScaledVector(ax.f, Math.sin(rad(fwd)))
    .normalize()
}

/** A direction from three body-relative components: outward, down, back. */
function mix(ax: Axes, o: THREE.Vector3, outward: number, down: number, back: number): THREE.Vector3 {
  return o.clone().multiplyScalar(outward).addScaledVector(ax.u, -down).addScaledVector(ax.f, -back).normalize()
}

/** Curl, in degrees per segment (proximal, intermediate, distal), plus the thumb. */
interface Grip {
  curl: readonly [number, number, number]
  thumb: number
  /** Degrees each of index, middle, ring, little fans away from the middle. */
  spread: readonly [number, number, number, number]
}

// The owner's open hands: "fingers relaxed, loosely spread and slightly
// curled". The capture's own relaxed hands (spin, squat, modelPose, peaceSign
// ends) bend the proximals 20–30°; this stays under that so the hand still
// reads as open.
const OPEN_GRIP: Grip = { curl: [14, 18, 10], thumb: 10, spread: [-5, 0, 3, 7] }
// The hand being held: relaxed, fingers hanging in their natural curl.
const HELD_GRIP: Grip = { curl: [35, 45, 30], thumb: 15, spread: [-2, 0, 2, 4] }
// The holding hand closes round the other wrist, far enough that the grip
// reads past the wrist and bracelet it is partly hidden behind (plan).
const HOLDING_GRIP: Grip = { curl: [55, 65, 45], thumb: 35, spread: [0, 0, 0, 0] }

interface ArmChain {
  /** The shoulder (collarbone), when the pose moves it; identity otherwise. */
  shoulder?: THREE.Quaternion
  upper: THREE.Quaternion
  lower: THREE.Quaternion
  hand: THREE.Quaternion
}

class PoseBuilder {
  readonly out = new Map<string, THREE.Quaternion>()
  readonly ax: Axes
  readonly sk: PoseSkeleton
  constructor(sk: PoseSkeleton) {
    this.sk = sk
    this.ax = axesOf(sk.version)
  }

  side(side: Side): THREE.Vector3 {
    return side === 'left' ? this.ax.l.clone() : this.ax.l.clone().negate()
  }

  /** Every normalized bone rests at identity, so the palm's rest normal is down. */
  get palm0(): THREE.Vector3 {
    return this.ax.u.clone().negate()
  }

  /** World (model-frame) rotations for the three arm segments, written as locals. */
  arm(side: Side, chain: ArmChain): void {
    const shoulder = chain.shoulder ?? new THREE.Quaternion()
    this.out.set(`${side}Shoulder`, shoulder.clone())
    this.out.set(`${side}UpperArm`, shoulder.clone().invert().multiply(chain.upper))
    this.out.set(`${side}LowerArm`, chain.upper.clone().invert().multiply(chain.lower))
    this.out.set(`${side}Hand`, chain.lower.clone().invert().multiply(chain.hand))
  }

  /** The chain that points each segment along its direction, palm toward its normal. */
  chain(
    side: Side,
    dirs: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
    normals: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
  ): ArmChain {
    const p = this.palm0
    return {
      upper: basisRotation(this.axis(side, 'upper'), p, dirs[0], normals[0]),
      lower: basisRotation(this.axis(side, 'lower'), p, dirs[1], normals[1]),
      hand: basisRotation(this.axis(side, 'hand'), p, dirs[2], normals[2]),
    }
  }

  /**
   * Which way a segment runs at rest. Not simply out to her side: VRoid's own
   * samples rest their arms a little down and forward of a true T, and a
   * rotation built from the ideal axis lands the hand 30mm off where it was
   * aimed (measured on the clasp, 2026-09-30). Gishin's arms happen to be level,
   * which is why the prototype did not show it.
   */
  axis(side: Side, segment: 'upper' | 'lower' | 'hand'): THREE.Vector3 {
    const [from, to] =
      segment === 'upper'
        ? [`${side}UpperArm`, `${side}LowerArm`]
        : segment === 'lower'
          ? [`${side}LowerArm`, `${side}Hand`]
          : [`${side}Hand`, `${side}MiddleProximal`]
    return this.offset(from, to).normalize()
  }

  fingers(side: Side, grip: Grip): void {
    const o = this.side(side)
    // Finger locals are in the hand's rest frame, which is the model's: a
    // finger runs along `o` and curls toward the palm about o × palm.
    const curlAxis = new THREE.Vector3().crossVectors(o, this.palm0).normalize()
    const fanAxis = this.palm0
    FOUR_FINGERS.forEach((finger, i) => {
      SEGMENTS.forEach((seg, j) => {
        const q = new THREE.Quaternion().setFromAxisAngle(curlAxis, rad(grip.curl[j]))
        // The fan belongs to the base joint only. Its sign is per side so
        // "away from the middle" means the same on both hands.
        if (j === 0) {
          const fan = new THREE.Quaternion().setFromAxisAngle(
            fanAxis,
            rad(grip.spread[i] * (side === 'left' ? 1 : -1) * (this.sk.version === '0' ? 1 : -1)),
          )
          q.premultiply(fan)
        }
        this.out.set(`${side}${finger}${seg}`, q)
      })
    })
    // The thumb folds across the palm about the finger axis; which sign does
    // that depends on the side and on the version, as the prototype measured.
    const thumbSign = (side === 'left' ? 1 : -1) * (this.sk.version === '0' ? 1 : -1)
    this.out.set(`${side}ThumbMetacarpal`, new THREE.Quaternion().setFromAxisAngle(o, rad(thumbSign * grip.thumb)))
    this.out.set(`${side}ThumbProximal`, new THREE.Quaternion().setFromAxisAngle(curlAxis, rad(grip.curl[1] * 0.5)))
    this.out.set(`${side}ThumbDistal`, new THREE.Quaternion().setFromAxisAngle(curlAxis, rad(grip.curl[2] * 0.5)))
  }

  rest(bone: string): THREE.Vector3 {
    const at = this.sk.rest(bone)
    if (!at) throw new Error(`idlePose: this body has no ${bone}`)
    // A copy: the caller's vectors may be the rig's own rest positions
    // (rigProbe hands over `restPosition`), and the solver adds to what this
    // returns. Handing back the original moved her rest shoulders a little
    // further every solve.
    return at.clone()
  }

  /** A child's rest offset from its parent joint. */
  offset(parent: string, child: string): THREE.Vector3 {
    return this.rest(child).clone().sub(this.rest(parent))
  }
}

/**
 * Open hands: the owner's first reference and the rest pose everywhere.
 *
 * Upper arms a little out and a touch forward, elbows nearly straight with
 * the forearm flaring a little further, wrists turned so the palms face forward
 * and down, hands just outside the thighs.
 */
/** Degrees out from hanging straight down, per segment. */
export const OPEN_ARM = { upper: 16, fore: 24, hand: 38 }

function solveOpen(b: PoseBuilder): void {
  const { f, u } = b.ax
  for (const side of SIDES) {
    const o = b.side(side)
    const chain = b.chain(
      side,
      [hang(b.ax, o, OPEN_ARM.upper, 4), hang(b.ax, o, OPEN_ARM.fore, 10), hang(b.ax, o, OPEN_ARM.hand, 14)],
      [
        o.clone().negate(),
        o.clone().negate().addScaledVector(f, 0.8),
        f.clone().multiplyScalar(0.8).addScaledVector(u, -0.6).addScaledVector(o, -0.2),
      ],
    )
    b.arm(side, chain)
    b.fingers(side, OPEN_GRIP)
  }
}

/**
 * Two-bone IK: the elbow for a shoulder, a wrist target and two bone lengths,
 * bending toward `pole`. A target out of reach is approached along the line.
 */
function twoBone(
  shoulder: THREE.Vector3,
  wrist: THREE.Vector3,
  upperLen: number,
  foreLen: number,
  pole: THREE.Vector3,
): { elbow: THREE.Vector3; wrist: THREE.Vector3 } {
  const d = wrist.clone().sub(shoulder)
  const along = d.clone().normalize()
  const reach = THREE.MathUtils.clamp(d.length(), Math.abs(upperLen - foreLen) + 1e-4, upperLen + foreLen - 1e-4)
  const cos = (upperLen * upperLen + reach * reach - foreLen * foreLen) / (2 * upperLen * reach)
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos))
  const side = pole.clone().addScaledVector(along, -pole.dot(along)).normalize()
  const elbow = shoulder
    .clone()
    .addScaledVector(along, upperLen * cos)
    .addScaledVector(side, upperLen * sin)
  const reached = shoulder.clone().addScaledVector(along, reach)
  return { elbow, wrist: reached }
}

/**
 * Where the clasp sits and how the elbows bend, in the body's own terms. The
 * clasp is placed against her hips and scaled by her hip width (the distance
 * between the two upper-leg joints), so a broader body clasps further out
 * behind a broader back.
 *
 * - `across`: the held wrist's offset toward her left of the midline
 * - `flex`: how far the held elbow bends, in degrees; sets the clasp's height
 * - `back`: how far behind the hips joint it sits
 * - `pole`: how far back each elbow bends, against 1 straight out to the side.
 *   Mostly back: bent outward, the elbows stood 5–15cm past her shoulders
 *   and read from the front as hands on hips (owner, 2026-09-30: "the arms
 *   behind her should sit closer to the body"). Bent back, they stay behind
 *   her sides.
 * - `shoulderBack`: degrees the collarbones swing back
 * - `heldHand`: the held hand's direction (outward, down, back)
 */
export const CLASP = {
  across: 0.25,
  flex: 65,
  back: 0.95,
  pole: 4,
  shoulderBack: 15,
  heldHand: [-0.35, 0.9, 0.1] as [number, number, number],
  holdingHand: [-0.8, 0.5, 0.15] as [number, number, number],
}

/** Where the palm's centre sits, as a fraction of the way from wrist to middle knuckle. */
const PALM_CENTRE = 0.6
/** How far behind the held wrist the holding palm closes: the wrist's own depth. */
export const CLASP_BEHIND = 0.025

/**
 * Hands behind the back: the owner's second reference.
 *
 * Her left hand hangs relaxed against her lower back, palm back. Her right
 * hand holds it by the wrist, the way a person clasps their hands behind them:
 * its palm is placed CLASP_BEHIND behind the left wrist. Both arms are solved
 * by two-bone IK, the elbows bending back and held close to her sides, so
 * the pose is the same on a long-armed body and a short one.
 */
function solveBehind(b: PoseBuilder): { error: number } {
  const { f } = b.ax
  const back = f.clone().negate()
  const hips = b.rest('hips')
  const hipWidth = b.rest('leftUpperLeg').distanceTo(b.rest('rightUpperLeg'))

  const collarOf = (side: Side): THREE.Quaternion =>
    new THREE.Quaternion().setFromAxisAngle(b.ax.u, rad(CLASP.shoulderBack) * (side === 'left' ? 1 : -1))
  const shoulderAt = (side: Side): THREE.Vector3 =>
    b.rest(`${side}Shoulder`).add(b.offset(`${side}Shoulder`, `${side}UpperArm`).applyQuaternion(collarOf(side)))
  const place = (side: Side, wristTarget: THREE.Vector3, hand: THREE.Quaternion, normal: THREE.Vector3): { chain: ArmChain; error: number } => {
    const o = b.side(side)
    // The collarbone swings back, drawing the shoulder joint behind her the
    // way a person's does when they clasp their hands behind them; without it
    // the arm can only reach round her by throwing the elbow out sideways.
    const collar = collarOf(side)
    const shoulder = shoulderAt(side)
    const upperLen = b.offset(`${side}UpperArm`, `${side}LowerArm`).length()
    const foreLen = b.offset(`${side}LowerArm`, `${side}Hand`).length()
    const pole = o.clone().addScaledVector(back, CLASP.pole)
    const { elbow, wrist } = twoBone(shoulder, wristTarget, upperLen, foreLen, pole)
    const chain: ArmChain = {
      shoulder: collar,
      upper: basisRotation(b.axis(side, 'upper'), b.palm0, elbow.clone().sub(shoulder), back.clone().addScaledVector(o, -0.3).negate()),
      lower: basisRotation(b.axis(side, 'lower'), b.palm0, wrist.clone().sub(elbow), normal.clone().addScaledVector(o, -0.3)),
      hand,
    }
    return { chain, error: wrist.distanceTo(wristTarget) }
  }

  // The held hand: palm back, hanging down and a little across.
  const oL = b.side('left')
  const heldHand = basisRotation(b.axis('left', 'hand'), b.palm0, mix(b.ax, oL, ...CLASP.heldHand), back)
  // Across and back are placed against her hips; the HEIGHT is whatever puts
  // the held elbow at CLASP.flex. A fixed height bent pink's long arms to 95°
  // and threw her elbows 14cm out past her shoulders while Vivi's bent 72°
  // (2026-09-30): a long-armed body clasps lower, as a person does.
  const wristL = hips.clone().addScaledVector(oL, CLASP.across * hipWidth).addScaledVector(back, CLASP.back * hipWidth)
  {
    const upperLen = b.offset('leftUpperArm', 'leftLowerArm').length()
    const foreLen = b.offset('leftLowerArm', 'leftHand').length()
    const reach = Math.sqrt(upperLen ** 2 + foreLen ** 2 + 2 * upperLen * foreLen * Math.cos(rad(CLASP.flex)))
    const d = wristL.clone().sub(shoulderAt('left'))
    const level = d.clone().projectOnPlane(b.ax.u).length()
    const drop = Math.sqrt(Math.max(0, reach * reach - level * level))
    wristL.addScaledVector(b.ax.u, -d.dot(b.ax.u) - drop)
  }
  const held = place('left', wristL, heldHand, back)
  b.arm('left', held.chain)
  b.fingers('left', HELD_GRIP)

  // The holding hand points across toward her left and down, palm forward
  // onto the other wrist.
  const oR = b.side('right')
  const holdingHand = basisRotation(b.axis('right', 'hand'), b.palm0, mix(b.ax, oR, ...CLASP.holdingHand), f)
  const palm = b.offset('rightHand', 'rightMiddleProximal').multiplyScalar(PALM_CENTRE).applyQuaternion(holdingHand)
  const target = wristL.clone().addScaledVector(back, CLASP_BEHIND).sub(palm)
  const holding = place('right', target, holdingHand, f)
  b.arm('right', holding.chain)
  b.fingers('right', HOLDING_GRIP)
  return { error: Math.max(held.error, holding.error) }
}

export function solveIdlePose(sk: PoseSkeleton, name: IdlePoseName): SolvedPose {
  const b = new PoseBuilder(sk)
  if (name === 'open') {
    solveOpen(b)
    return { rotations: b.out, claspError: 0 }
  }
  const { error } = solveBehind(b)
  return { rotations: b.out, claspError: error }
}

/**
 * Rest positions read off three-vrm's normalized rig: every node rests at
 * identity rotation with its local position the rest offset from its parent,
 * so summing positions up the chain gives where it rests. Rotations written on
 * the rig since do not move these.
 */
export function normalizedRest(
  node: (bone: string) => THREE.Object3D | null | undefined,
  root: THREE.Object3D,
): (bone: string) => THREE.Vector3 | undefined {
  return (bone) => {
    let n = node(bone)
    if (!n) return undefined
    const at = new THREE.Vector3()
    while (n && n !== root) {
      at.add(n.position)
      n = n.parent
    }
    return at
  }
}

/**
 * A pose part way to another: every bone slerped by `s`, eased at both ends.
 * Bones only one side lists are carried as they are.
 */
export function blendPoses(from: PoseRotations, to: PoseRotations, s: number): Map<string, THREE.Quaternion> {
  const e = s * s * (3 - 2 * s)
  const out = new Map<string, THREE.Quaternion>()
  for (const [bone, q] of to) {
    const a = from.get(bone)
    out.set(bone, a ? a.clone().slerp(q, e) : q.clone())
  }
  for (const [bone, q] of from) if (!out.has(bone)) out.set(bone, q.clone())
  return out
}

// ---- which pose, when ----------------------------------------------------------
//
// On /avatar (the `stage` placement) she alternates between the two poses on
// her own, the owner's choice on 2026-09-30: hold one for 15–20s, crossfade to
// the other. Everywhere else she stands in the open pose. A clip playing over
// her pauses the hold, so no swap starts under a performance; a crossfade
// already under way when the clip begins runs on to its end.

/** Seconds a pose holds before the stage swaps it, drawn anew each time. */
export const IDLE_POSE_HOLD = { min: 15, max: 20 } as const
/** Seconds the crossfade between the two poses takes. */
export const IDLE_POSE_FADE = 1.8

export interface IdlePoseState {
  /** The pose she is in, or fading to. */
  current: IdlePoseName
  /** The pose she is fading from; null when she is standing in `current`. */
  from: IdlePoseName | null
  /** 0 to 1 through the fade. */
  blend: number
  /** Seconds left before the stage swaps poses. */
  hold: number
}

export function idlePoseStart(rand: () => number): IdlePoseState {
  return { current: 'open', from: null, blend: 1, hold: drawHold(rand) }
}

function drawHold(rand: () => number): number {
  return IDLE_POSE_HOLD.min + (IDLE_POSE_HOLD.max - IDLE_POSE_HOLD.min) * rand()
}

/**
 * One frame of the pose clock. `alternate` is whether this placement swaps
 * poses at all (the stage does); `paused` holds the clock (a clip is playing).
 * A placement that does not alternate fades her back to the open pose.
 */
export function stepIdlePose(
  s: IdlePoseState,
  dt: number,
  alternate: boolean,
  paused: boolean,
  rand: () => number,
): IdlePoseState {
  if (s.from !== null) {
    const blend = Math.min(1, s.blend + dt / IDLE_POSE_FADE)
    return blend >= 1 ? { ...s, from: null, blend: 1 } : { ...s, blend }
  }
  if (!alternate) {
    if (s.current === 'open') return s
    return { current: 'open', from: s.current, blend: 0, hold: drawHold(rand) }
  }
  if (paused) return s
  const hold = s.hold - dt
  if (hold > 0) return { ...s, hold }
  const next: IdlePoseName = s.current === 'open' ? 'behind' : 'open'
  return { current: next, from: s.current, blend: 0, hold: drawHold(rand) }
}

/** The rotations the clock asks for this frame. */
export function idlePoseNow(s: IdlePoseState, poses: Readonly<Record<IdlePoseName, PoseRotations>>): PoseRotations {
  if (s.from === null) return poses[s.current]
  return blendPoses(poses[s.from], poses[s.current], s.blend)
}

// ---- the life in her hands ------------------------------------------------------
//
// The plan's life layer: breathing, the weight shift and the idle beats move
// her body, and this keeps the fingers from standing like a mannequin's. Each
// finger's base joint curls and uncurls a few degrees on its own slow period.

/** Degrees a finger's base joint drifts either way. */
export const FINGER_DRIFT = 3
const DRIFT_FINGERS = ['Index', 'Middle', 'Ring', 'Little'] as const
const DRIFT_PERIOD = [5.3, 6.1, 5.7, 6.7]

export interface FingerDrift {
  bone: string
  /** Extra rotation to multiply onto the pose's own, in the joint's local frame. */
  q: THREE.Quaternion
}

/** Preallocated so the frame loop allocates nothing. */
export function fingerDrift(version: '0' | '1'): { drift: FingerDrift[]; at: (t: number, left: number, right: number) => FingerDrift[] } {
  const { u, l } = axesOf(version)
  const palm = u.clone().negate()
  const axisOf = (side: Side): THREE.Vector3 =>
    new THREE.Vector3().crossVectors(side === 'left' ? l : l.clone().negate(), palm).normalize()
  const drift: FingerDrift[] = []
  const axes: THREE.Vector3[] = []
  for (const side of SIDES) {
    for (const finger of DRIFT_FINGERS) {
      drift.push({ bone: `${side}${finger}Proximal`, q: new THREE.Quaternion() })
      axes.push(axisOf(side))
    }
  }
  const at = (t: number, left: number, right: number): FingerDrift[] => {
    drift.forEach((d, i) => {
      const k = i % DRIFT_FINGERS.length
      const weight = i < DRIFT_FINGERS.length ? left : right
      const angle = rad(FINGER_DRIFT) * weight * Math.sin((2 * Math.PI * t) / DRIFT_PERIOD[k] + k * 1.7 + (i < 4 ? 0 : 0.9))
      d.q.setFromAxisAngle(axes[i], angle)
    })
    return drift
  }
  return { drift, at }
}

/**
 * How much of the holding hand may drift: all of it in the open pose, none of
 * it while it grips the other wrist, and the fade's share between.
 */
export function holdingHandFree(s: IdlePoseState): number {
  const open = s.current === 'open' ? 1 : 0
  if (s.from === null) return open
  const e = s.blend * s.blend * (3 - 2 * s.blend)
  return s.current === 'open' ? e : 1 - e
}
