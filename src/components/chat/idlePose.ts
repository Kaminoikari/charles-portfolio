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
  /**
   * Her surface at rest, as xyz triples in the frame `rest` answers in: every
   * vertex skinned to her trunk or legs (TRUNK_ANCHOR), clothes and skirts
   * included, hair and arms left out. The clasp rests against it.
   */
  surface: ArrayLike<number>
}

/**
 * The humanoid bones whose skin, and whatever hangs from them, counts as her
 * trunk: what her hands rest against and must stay out of. A vertex belongs
 * by the bone its heaviest joint is or hangs from, so a skirt on spring joints
 * under the hips or thighs counts and hair under the head does not.
 */
export const TRUNK_ANCHOR = /^(hips|spine|chest|upperChest|(left|right)(UpperLeg|LowerLeg|Foot|Toes))$/

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
 * An arm through `upper` and `fore` (the directions shoulder to elbow and
 * elbow to wrist), built the way an arm is jointed, ending in the hand
 * rotation `hand`.
 *
 * The elbow is a hinge that bends only toward the crook of the arm, which at
 * rest faces forward (palms down). So the upper arm's roll is not free: it is
 * whatever turns the crook toward the forearm. The forearm then swings about
 * that hinge alone and rolls about its own length (pronation) as far as the
 * hand needs, leaving the wrist to bend without twisting. 2026-09-30: built
 * segment by segment from a guessed "palm normal" each, the behind-back pose
 * bent both elbows about 60° backwards and rolled the left forearm 166°
 * (the owner: "both arms would break").
 */
function hinged(
  b: PoseBuilder,
  side: Side,
  upper: THREE.Vector3,
  fore: THREE.Vector3,
  hand: THREE.Quaternion,
): Pick<ArmChain, 'upper' | 'lower' | 'hand'> {
  const aU = b.axis(side, 'upper')
  const aL = b.axis(side, 'lower')
  const crook0 = b.ax.f.clone().addScaledVector(aU, -b.ax.f.dot(aU)).normalize()
  const x = upper.clone().normalize()
  const d = fore.clone().normalize()
  // A straight arm has no crook to aim; any roll will do, so keep it forward.
  const crook = d.clone().addScaledVector(x, -d.dot(x))
  if (crook.lengthSq() < 1e-6) crook.copy(b.ax.f).addScaledVector(x, -b.ax.f.dot(x))
  const qU = basisRotation(aU, crook0, x, crook)
  const swung = new THREE.Quaternion().setFromUnitVectors(aL.clone().applyQuaternion(qU).normalize(), d).multiply(qU)
  // The roll the hand asks of the wrist, handed to the forearm.
  const rel = swung.clone().invert().multiply(hand)
  const p = rel.x * aL.x + rel.y * aL.y + rel.z * aL.z
  const roll = new THREE.Quaternion(aL.x * p, aL.y * p, aL.z * p, rel.w).normalize()
  return { upper: qU, lower: swung.multiply(roll), hand }
}

/**
 * Where the clasp sits and how the elbows bend, in the body's own terms: the
 * clasp rests against whatever she wears behind her, and its offsets are in
 * hip widths (the distance between the two upper-leg joints).
 *
 * - `across`: the held wrist's offset toward her left of the midline
 * - `upperBack`: degrees each upper arm hangs back of straight down. The
 *   forearms go round her from there, so the clasp's height is wherever the
 *   held forearm's length lands (long-armed bodies clasp lower, as a person
 *   does). 40 turns each upper arm in 89–102° to bring the forearm across her
 *   back (idlePose.test.ts, ARM_LIMITS); hung straighter, the forearms run
 *   back as well as across and the shoulders turn in past 115°.
 * - `clear`: how far behind her surface (PoseSkeleton.surface) the held
 *   wrist sits, in metres, at the clasp's height and across the width of her
 *   hands: far enough that the holding hand, on her side of that wrist, rests
 *   on her instead of in her. Until 2026-09-30 the clasp sat a fixed 1.2 hip
 *   widths behind her hips joint, whatever she wore: pink's fingers sank 25mm
 *   into her jacket's hem, and Sendagaya Shibu's hands hung 4cm off her skirt
 *   with the upper arms thrown back to reach there (owner: "the arm pose
 *   behind her back is very unnatural").
 * - `deepest`: the furthest behind her hips joint the held wrist may go, in
 *   hip widths, whatever she wears. Every other offered look clasps within
 *   1.44; milfy's hoodie stands out behind her 2.05, and when the clasp rested
 *   on it her upper arms swung 51–57° back, at the end of a shoulder's range.
 *   Her hands go under its hem instead (see idlePose.test.ts, CLOTH_WAIVER).
 * - `elbowIn`: how far inside the shoulder joint each elbow hangs, in
 *   metres; negative is outside it. Out at her sides, where the owner's
 *   reference has them (a game's dressing room, 2026-09-30), the upper arms
 *   show from the front. Until then the elbows bent back and in behind her,
 *   22–59mm inside the shoulders, and with the collarbones swung back 40°
 *   the owner found "from the front both arms have completely vanished". Bent
 *   outward 5–15cm past the shoulders, an earlier version read as hands on
 *   hips; 3cm is as far as idlePose.test.ts lets them go.
 * - `shoulderBack`: degrees the collarbones swing back, drawing the shoulder
 *   joints a little behind her the way a person's go when they clasp their
 *   hands behind them.
 * - `heldHand`: the held hand's direction (outward, down, back)
 */
export const CLASP = {
  across: 0.25,
  upperBack: 40,
  clear: 0.04,
  deepest: 1.5,
  elbowIn: -0.03,
  shoulderBack: 20,
  heldHand: [-0.35, 0.9, 0.1] as [number, number, number],
  holdingHand: [-0.8, 0.5, 0.15] as [number, number, number],
}

/** The slab of her surface the clasp rests against: metres above and below its height, and either side of the held wrist. */
const CLASP_BAND = { height: 0.05, width: 0.1 }

/** Where the palm's centre sits, as a fraction of the way from wrist to middle knuckle. */
const PALM_CENTRE = 0.6
/** How far in front of the held wrist (on her side of it) the holding palm closes: the wrist's own depth. */
export const CLASP_BEHIND = 0.025

/**
 * Hands behind the back: the owner's second reference.
 *
 * Her left hand hangs relaxed against her lower back, palm back. Her right
 * hand holds it by the wrist from her side of it, palm back too, the way a
 * person clasps their hands behind them: its palm is placed CLASP_BEHIND in
 * front of the left wrist. The upper arms hang down her sides and the
 * forearms go round her (CLASP.upperBack, CLASP.elbowIn); both arms are placed
 * by two-bone IK toward those elbows, so the pose is the same on a long-armed
 * body and a short one, and jointed by `hinged`.
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
  // Where each elbow hangs: the upper arm CLASP.upperBack back from straight
  // down, the elbow CLASP.elbowIn inside the shoulder joint, so from the
  // front her arms run down her sides and only the forearms go round her.
  const elbowAt = (side: Side): THREE.Vector3 => {
    const upperLen = b.offset(`${side}UpperArm`, `${side}LowerArm`).length()
    const inward = CLASP.elbowIn / upperLen
    const hang = Math.sqrt(1 - inward * inward)
    return shoulderAt(side).addScaledVector(
      b.side(side).multiplyScalar(-inward)
        .addScaledVector(b.ax.u, -hang * Math.cos(rad(CLASP.upperBack)))
        .addScaledVector(back, hang * Math.sin(rad(CLASP.upperBack))),
      upperLen,
    )
  }
  const place = (side: Side, wristTarget: THREE.Vector3, hand: THREE.Quaternion): { chain: ArmChain; error: number } => {
    // The collarbone swings back CLASP.shoulderBack, drawing the shoulder
    // joint a little behind her.
    const collar = collarOf(side)
    const shoulder = shoulderAt(side)
    const upperLen = b.offset(`${side}UpperArm`, `${side}LowerArm`).length()
    const foreLen = b.offset(`${side}LowerArm`, `${side}Hand`).length()
    // The elbow bends toward where the upper arm hangs (elbowAt): exactly
    // there for the held arm, whose wrist was placed from it, and as near as
    // the holding arm's reach allows.
    const { elbow, wrist } = twoBone(shoulder, wristTarget, upperLen, foreLen, elbowAt(side).sub(shoulder))
    return { chain: { shoulder: collar, ...hinged(b, side, elbow.clone().sub(shoulder), wrist.clone().sub(elbow), hand) }, error: wrist.distanceTo(wristTarget) }
  }

  // The held hand: palm back, hanging down and a little across.
  const oL = b.side('left')
  const heldHand = basisRotation(b.axis('left', 'hand'), b.palm0, mix(b.ax, oL, ...CLASP.heldHand), back)
  // How far back her surface reaches at a height (metres above the hips
  // joint), across the width her two hands take up round the held wrist.
  const across = CLASP.across * hipWidth
  const surfaceBehind = (height: number): number => {
    let most = -Infinity
    const p = new THREE.Vector3()
    for (let i = 0; i + 2 < b.sk.surface.length; i += 3) {
      p.set(b.sk.surface[i], b.sk.surface[i + 1], b.sk.surface[i + 2]).sub(hips)
      if (Math.abs(p.dot(b.ax.u) - height) > CLASP_BAND.height) continue
      if (Math.abs(p.dot(oL) - across) > CLASP_BAND.width) continue
      most = Math.max(most, p.dot(back))
    }
    return most
  }
  // The held upper arm hangs CLASP.upperBack back with its elbow
  // CLASP.elbowIn inside the shoulder joint, and the forearm reaches down
  // from there to the clasp: its height is wherever the forearm's length
  // lands. That depends on how far back the wrist is, which depends on the
  // height; a few rounds settle both.
  const foreLen = b.offset('leftLowerArm', 'leftHand').length()
  const elbowL = elbowAt('left')
  const wristL = new THREE.Vector3()
  let depth = hipWidth
  for (let round = 0; round < 4; round++) {
    wristL.copy(hips).addScaledVector(oL, across).addScaledVector(back, depth)
    const d = wristL.clone().sub(elbowL)
    const level = d.clone().projectOnPlane(b.ax.u).length()
    const drop = Math.sqrt(Math.max(0, foreLen * foreLen - level * level))
    wristL.addScaledVector(b.ax.u, -d.dot(b.ax.u) - drop)
    const behind = surfaceBehind(wristL.clone().sub(hips).dot(b.ax.u))
    if (behind === -Infinity) throw new Error('idlePose: no surface behind her where the clasp goes')
    depth = Math.min(behind + CLASP.clear, CLASP.deepest * hipWidth)
  }
  const held = place('left', wristL, heldHand)
  b.arm('left', held.chain)
  b.fingers('left', HELD_GRIP)

  // The holding hand points across toward her left and down and takes the
  // other wrist from the body side, palm back, both palms facing away from
  // her. Palm forward, closing over the wrist from outside, asked the right
  // forearm to roll 107–110° past neutral, where a forearm stops at 80–90°.
  const oR = b.side('right')
  const holdingHand = basisRotation(b.axis('right', 'hand'), b.palm0, mix(b.ax, oR, ...CLASP.holdingHand), back)
  const palm = b.offset('rightHand', 'rightMiddleProximal').multiplyScalar(PALM_CENTRE).applyQuaternion(holdingHand)
  const target = wristL.clone().addScaledVector(back, -CLASP_BEHIND).sub(palm)
  const holding = place('right', target, holdingHand)
  b.arm('right', holding.chain)
  b.fingers('right', HOLDING_GRIP)
  return { error: Math.max(held.error, holding.error) }
}

/**
 * Where her hands pass between the two poses, in the body's own terms: each
 * wrist `out` hip widths to her side of the hips joint, `back` behind it and
 * `down` below it, the elbow bent back toward it, the collarbone swung back
 * `shoulderBack` degrees, the hand hanging, palm to her side.
 *
 * A person's arms go round her hips. Blended straight from one pose to the
 * other they cut through them, and a fixed swing about the shoulder that went
 * round her skin still swept her hands through every skirt and hem (46mm into
 * Sendagaya Shibu's pleats, 92mm into Victoria Rubin's, by
 * rigProbe.clothShell, 2026-09-30); swung far enough to clear them, it either
 * turned her shoulders past what a shoulder turns or left the stage frame.
 * A waypoint solved like the clasp is an arm a person could hold, so both
 * halves of the fade run between two such arms.
 */
// back 2.5 since the clasp moved to her sides (2026-09-30): at 1.9 the last
// fifth of the fade brushed the hands through pink's, Victoria Rubin's and
// Vivi's hems, up to 8.7mm; 2.4 was the least that cleared every look.
export const IDLE_POSE_VIA = { out: 2.1, back: 2.5, down: 0.5, pole: 3, shoulderBack: 8 }

function solveVia(b: PoseBuilder): PoseRotations {
  const { f, u } = b.ax
  const back = f.clone().negate()
  const hips = b.rest('hips')
  const hipWidth = b.rest('leftUpperLeg').distanceTo(b.rest('rightUpperLeg'))
  for (const side of SIDES) {
    const o = b.side(side)
    const collar = new THREE.Quaternion().setFromAxisAngle(u, rad(IDLE_POSE_VIA.shoulderBack) * (side === 'left' ? 1 : -1))
    const shoulder = b.rest(`${side}Shoulder`).add(b.offset(`${side}Shoulder`, `${side}UpperArm`).applyQuaternion(collar))
    const wrist = hips
      .clone()
      .addScaledVector(o, IDLE_POSE_VIA.out * hipWidth)
      .addScaledVector(back, IDLE_POSE_VIA.back * hipWidth)
      .addScaledVector(u, -IDLE_POSE_VIA.down * hipWidth)
    const upperLen = b.offset(`${side}UpperArm`, `${side}LowerArm`).length()
    const foreLen = b.offset(`${side}LowerArm`, `${side}Hand`).length()
    const { elbow, wrist: reached } = twoBone(shoulder, wrist, upperLen, foreLen, o.clone().addScaledVector(back, IDLE_POSE_VIA.pole))
    const hand = basisRotation(b.axis(side, 'hand'), b.palm0, mix(b.ax, o, 0.15, 1, 0.2), o.clone().negate())
    b.arm(side, { shoulder: collar, ...hinged(b, side, elbow.clone().sub(shoulder), reached.clone().sub(elbow), hand) })
    b.fingers(side, OPEN_GRIP)
  }
  return b.out
}

/**
 * Both poses for one body, with what a crossfade between them needs to keep
 * her elbows jointed: each forearm's rest axis (see blendPoses).
 */
export interface IdlePoses extends Readonly<Record<IdlePoseName, PoseRotations>> {
  rollAxes: ReadonlyMap<string, THREE.Vector3>
  /** Where the hands pass on their way between the two poses (see IDLE_POSE_VIA). */
  via: PoseRotations
}

export function solveIdlePoses(sk: PoseSkeleton): IdlePoses {
  const b = new PoseBuilder(sk)
  return {
    open: solveIdlePose(sk, 'open').rotations,
    behind: solveIdlePose(sk, 'behind').rotations,
    rollAxes: new Map(SIDES.map((side) => [`${side}LowerArm`, b.axis(side, 'lower')])),
    via: solveVia(new PoseBuilder(sk)),
  }
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
 *
 * A bone in `rollAxes` (the forearms, about their own rest axis) is split into
 * its bend and its roll, and each is blended on its own. An elbow is a hinge
 * plus the forearm's roll; slerped whole, the two mix part way and the elbow
 * bends sideways, 18–19° at 30% from open hands to behind her back
 * (2026-09-30), past what an elbow can do.
 */
export function blendPoses(
  from: PoseRotations,
  to: PoseRotations,
  s: number,
  rollAxes?: ReadonlyMap<string, THREE.Vector3>,
): Map<string, THREE.Quaternion> {
  const e = s * s * (3 - 2 * s)
  const out = new Map<string, THREE.Quaternion>()
  for (const [bone, q] of to) {
    const a = from.get(bone)
    const axis = rollAxes?.get(bone)
    if (a && axis) {
      const [sa, ta] = swingTwist(a, axis)
      const [sb, tb] = swingTwist(q, axis)
      out.set(bone, sa.slerp(sb, e).multiply(ta.slerp(tb, e)))
    } else out.set(bone, a ? a.clone().slerp(q, e) : q.clone())
  }
  for (const [bone, q] of from) if (!out.has(bone)) out.set(bone, q.clone())
  return out
}

/**
 * Moves each arm's roll down to the wrist, and returns what puts it back.
 *
 * A VRoid arm has no twist bones: the skin at the shoulder is blended between
 * the chest and the upper arm, and at the elbow between the upper arm and the
 * forearm, so a bone rolled about its own length wrings the blended skin at
 * its top. The owner saw both on 2026-09-30: a black notch across each elbow
 * (the forearm's roll, a line from about 40°; the idle poses and the
 * motion-capture clips roll it 80° and more) and a hole torn in Sendagaya
 * Shibu's sleeve under the shoulder with her hands behind her (the upper arm
 * turned in 69–85°, as a person's is to bring the forearms round behind).
 * The wrist's skin takes all of it cleanly, and the elbow takes the upper
 * arm's roll too: it is a turn about the line through shoulder and elbow,
 * which the elbow's ring of skin turns with.
 * A notch at a deeply bent elbow is another thing, the outline's hull
 * coming through folded skin; elbowOutline.ts takes that one.
 *
 * So each upper arm's roll moves onto its forearm, and each forearm's onto its
 * hand. Nothing moves or turns but skin: bone · child = swing · roll · child,
 * and each roll is about the line to the next joint, so no joint moves.
 *
 * The engine calls it just before vrm.update copies the normalized bones onto
 * the skinned ones, then undoes it, so every writer keeps reading the arm it
 * wrote.
 */
export function armRollsToWrist(bone: (name: string) => THREE.Object3D | null | undefined): () => void {
  const undo: [THREE.Object3D, THREE.Quaternion][] = []
  const pass = (from: THREE.Object3D, to: THREE.Object3D) => {
    const [swing, roll] = swingTwist(from.quaternion, to.position.clone().normalize())
    from.quaternion.copy(swing)
    to.quaternion.premultiply(roll)
  }
  for (const side of ['left', 'right'] as const) {
    const upper = bone(`${side}UpperArm`)
    const fore = bone(`${side}LowerArm`)
    const hand = bone(`${side}Hand`)
    if (!upper || !fore || !hand) continue
    for (const b of [upper, fore, hand]) undo.push([b, b.quaternion.clone()])
    pass(upper, fore)
    pass(fore, hand)
  }
  return () => {
    for (const [b, q] of undo) b.quaternion.copy(q)
  }
}

/** `q` as a swing (about an axis square to `axis`) after a roll about `axis`: q = swing · roll. */
function swingTwist(q: THREE.Quaternion, axis: THREE.Vector3): [THREE.Quaternion, THREE.Quaternion] {
  const p = q.x * axis.x + q.y * axis.y + q.z * axis.z
  const roll = new THREE.Quaternion(axis.x * p, axis.y * p, axis.z * p, q.w)
  if (roll.lengthSq() < 1e-12) roll.set(0, 0, 0, 1)
  roll.normalize()
  return [q.clone().multiply(roll.clone().invert()), roll]
}

/**
 * Writes `pose` on the bones, `share` of the way from what is under it: 1 is
 * the pose outright, less lets the clips keep the rest of her. A bone a clip
 * drives is blended from where the clip put it this frame. A bone no clip
 * drives has only last frame's value under it, and blending from that walks it
 * all the way to the pose at any share, so it is blended from its rest instead
 * (`rest`, identity where absent), the pose the clips were made on. waveWink
 * drives her arms and hands and nothing else; over the hands-behind pose it
 * waved with her shoulders swung back and the holding hand's fist (2026-09-30).
 */
export function writeIdlePose(
  bone: (name: string) => THREE.Object3D | null | undefined,
  pose: PoseRotations,
  share: number,
  driven: (node: THREE.Object3D) => boolean,
  rest: PoseRotations,
): void {
  for (const [name, q] of pose) {
    const b = bone(name)
    if (!b) continue
    if (share >= 1) {
      b.quaternion.copy(q)
      continue
    }
    if (!driven(b)) {
      const r = rest.get(name)
      if (r) b.quaternion.copy(r)
      else b.quaternion.identity()
    }
    b.quaternion.slerp(q, share)
  }
}

/**
 * Whether any of `clips` turns a node, read off their track names. Only
 * rotations count, the one thing the idle pose writes: a hips position track
 * leaves the hips' turn to the pose.
 */
export function clipDriven(clips: readonly THREE.AnimationClip[]): (node: THREE.Object3D) => boolean {
  const names = new Set<string>()
  for (const clip of clips) {
    for (const track of clip.tracks) {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name)
      if (propertyName === 'quaternion') names.add(nodeName)
    }
  }
  return (node) => names.has(node.name)
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
export function idlePoseNow(s: IdlePoseState, poses: IdlePoses): PoseRotations {
  if (s.from === null) return poses[s.current]
  // Through the waypoint beside her hips: the first half of the fade takes
  // her hands out to it, the second in to the pose she is going to.
  return s.blend < 0.5
    ? blendPoses(poses[s.from], poses.via, s.blend * 2, poses.rollAxes)
    : blendPoses(poses.via, poses[s.current], s.blend * 2 - 1, poses.rollAxes)
}

// ---- the life in her hands ------------------------------------------------------
//
// The plan's life layer: breathing, the upper-body sway and the idle beats move
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
