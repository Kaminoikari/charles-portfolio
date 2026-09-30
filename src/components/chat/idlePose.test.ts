import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { parseGlb, type Glb } from './vrmHumanoid'
import { OFFERED_VARIANTS } from './avatarVariants'
import { REST_HALF_WIDTH } from '../avatar/stageLayout'
import {
  blendPoses,
  CLASP_BEHIND,
  forearmRollToHand,
  FINGER_DRIFT,
  fingerDrift,
  holdingHandFree,
  IDLE_POSE_FADE,
  IDLE_POSE_HOLD,
  idlePoseNow,
  idlePoseStart,
  solveIdlePose,
  solveIdlePoses,
  stepIdlePose,
  type IdlePoseName,
  type IdlePoseState,
} from './idlePose'
import {
  applyIdlePose,
  applyMotion,
  buildMotion,
  buildRigFrom,
  probeArmJoints,
  type ArmJoints,
  deriveSilhouetteSkin,
  measureIdleSkin,
  clothShell,
  TORSO_SEGMENTS,
  posedMesh,
  poseSkeleton,
  probeHand,
  resetRig,
  silhouetteReach,
  worldPosition,
  type Rig,
} from './rigProbe'

// ---- the clock ------------------------------------------------------------------

const half = () => 0.5

describe('the idle pose clock', () => {
  it('starts in the open pose', () => {
    const s = idlePoseStart(half)
    expect(s.current).toBe('open')
    expect(s.from).toBeNull()
  })

  it('holds a pose on the stage for 15–20s, then fades to the other', () => {
    for (const r of [0, 0.5, 0.999]) {
      let s = idlePoseStart(() => r)
      const hold = IDLE_POSE_HOLD.min + (IDLE_POSE_HOLD.max - IDLE_POSE_HOLD.min) * r
      let t = 0
      while (s.from === null && t < 60) {
        s = stepIdlePose(s, 0.1, true, false, half)
        t += 0.1
      }
      expect(t).toBeGreaterThan(hold - 0.2)
      expect(t).toBeLessThan(hold + 0.2)
      expect(s).toMatchObject({ from: 'open', current: 'behind' })
    }
  })

  it('finishes a fade in IDLE_POSE_FADE seconds and then stands in the new pose', () => {
    let s: IdlePoseState = { current: 'behind', from: 'open', blend: 0, hold: 18 }
    let t = 0
    while (s.from !== null) {
      s = stepIdlePose(s, 0.05, true, false, half)
      t += 0.05
    }
    expect(t).toBeCloseTo(IDLE_POSE_FADE, 1)
    expect(s.current).toBe('behind')
  })

  it('comes back to the open pose after the behind pose has held', () => {
    let s: IdlePoseState = { current: 'behind', from: null, blend: 1, hold: 0.05 }
    s = stepIdlePose(s, 0.1, true, false, half)
    expect(s).toMatchObject({ from: 'behind', current: 'open' })
  })

  it('does not swap under a clip', () => {
    let s: IdlePoseState = { current: 'open', from: null, blend: 1, hold: 0.05 }
    for (let i = 0; i < 100; i++) s = stepIdlePose(s, 0.1, true, true, half)
    expect(s).toMatchObject({ current: 'open', from: null, hold: 0.05 })
  })

  it('fades back to the open pose off the stage, and stays there', () => {
    let s: IdlePoseState = { current: 'behind', from: null, blend: 1, hold: 10 }
    s = stepIdlePose(s, 0.1, false, false, half)
    expect(s).toMatchObject({ from: 'behind', current: 'open' })
    for (let i = 0; i < 400; i++) s = stepIdlePose(s, 0.1, false, false, half)
    expect(s).toMatchObject({ current: 'open', from: null })
  })
})

// ---- the poses, on every body a visitor can pick ------------------------------

interface Look {
  id: string
  glb: Glb
  rig: Rig
}

const looks: Look[] = OFFERED_VARIANTS.map((v) => {
  const glb = parseGlb(new Uint8Array(readFileSync(path.join(process.cwd(), 'public', v.url))))
  return { id: v.id, glb, rig: buildRigFrom(glb) }
})

/**
 * How deep a forearm or hand may sit inside the torso and thigh capsules
 * (rigProbe.torsoCapsules), in metres. The capsules are inscribed in the skin
 * each bone drives, clothes included, so a few millimetres is a sleeve
 * brushing a hem.
 */
const MAX_DEPTH = 0.008
/**
 * milfy's hoodie hangs in a bell over her hips, and its hem is skinned to the
 * hips bone, so her hips capsule comes out 107mm in radius against 89mm on the
 * same skeleton in pink's clothes. Open hands lay the hoodie's own sleeves on
 * that hem, 10.7mm in by this measure, cloth on cloth, and it reads as a
 * sleeve resting on a hoodie in the render (2026-09-30). Behind her back it
 * read 15.2mm until the clasp moved to rest on her, 0mm since. Every other
 * offered look is held to MAX_DEPTH.
 */
const DEPTH_WAIVER: Record<string, number> = { milfy: 0.025 }
const maxDepth = (id: string): number => DEPTH_WAIVER[id] ?? MAX_DEPTH

/**
 * How deep a hand may sit inside the shell of her clothes (rigProbe.clothShell):
 * not at all. The shell is the outermost cloth in each band of height and
 * bearing, skirts included, so a hand inside it is under or through a hem.
 */
const MAX_CLOTH_DEPTH = 0

/**
 * How far back of hanging straight down an upper arm may swing behind her, in
 * degrees. A shoulder extends about 50–60° at the end of its range; standing
 * with the hands clasped behind, people hold it short of that. The pose the
 * owner chose measured 44.9° at most (2026-09-30); this leaves 1° over it.
 * Drawing the collarbones back 30° instead of 40° swings one arm to 47°.
 */
const MAX_UPPER_ARM_BACK = 46
/**
 * Two looks whose clothes one set of body-relative numbers cannot clear, each
 * at what it measured on 2026-09-30, so neither can get worse unnoticed:
 *
 * - milfy's hoodie hangs in a bell to her thighs (see DEPTH_WAIVER). Resting
 *   her hands on it threw her upper arms 51–57° back, so the clasp stops at
 *   CLASP.deepest and her hands go under its hem, 91.5mm deep (87.4mm near the
 *   end of the fade); open hands sit 13.7mm into its flare.
 * - studio's coat flares from the waist, and her open hands brush its skirt,
 *   20.0mm in. The fade starts there, which is its deepest point (12.3mm at 10%).
 *
 * Both want the pose placed against the clothes each body wears, which the
 * solver does not see: it reads bones only.
 */
const CLOTH_WAIVER: Record<string, number> = { milfy: 0.092, studio: 0.02 }

/**
 * The furthest her clasped hands may stand off her clothes, in metres: they
 * rest on her. A clasp placed without her surface hung 4–9cm off Sendagaya
 * Shibu's skirt with the upper arms thrown back to reach it (2026-09-30).
 * Resting on her, every offered look measured 42.5mm or less.
 */
const MAX_CLOTH_GAP = 0.045
const maxClothDepth = (id: string): number => CLOTH_WAIVER[id] ?? MAX_CLOTH_DEPTH

function posed(look: Look, rotations: ReadonlyMap<string, THREE.Quaternion>): void {
  resetRig(look.rig)
  for (const [bone, q] of rotations) look.rig.bones[bone]?.quaternion.copy(q)
  look.rig.root.updateMatrixWorld(true)
  look.rig.humanoid.update()
  look.rig.scene.updateMatrixWorld(true)
}

/**
 * How far each arm joint can go, in probeArmJoints' measures (degrees from
 * the rest pose, arms hanging, palms to the thighs being zero twist):
 *
 * - elbow: bends 0–150° toward the crook, never backwards; its sideways
 *   angle stays within the carrying angle, about 10–15° in a straight arm
 * - shoulder: rotates about 80–90° either way (normal internal rotation
 *   80–90°; hand behind the back is its functional test)
 * - forearm: rolls 75–90° either way from neutral (pronation, supination)
 * - wrist: bends, but does not roll; the forearm rolls for it
 *
 * 2026-09-30: the behind-back pose bent both elbows about 60° backwards and
 * rolled the left forearm 166° (the owner: "both arms would break").
 */
const ARM_LIMITS: Record<keyof ArmJoints, [number, number]> = {
  flex: [0, 150],
  hingeOff: [-15, 15],
  upperTwist: [-90, 90],
  foreTwist: [-90, 90],
  wristTwist: [-10, 10],
  wristBend: [0, 80],
}

function outsideLimits(rig: Rig): string[] {
  const out: string[] = []
  for (const side of ['left', 'right'] as const) {
    const j = probeArmJoints(rig, side)
    for (const k of Object.keys(ARM_LIMITS) as (keyof ArmJoints)[]) {
      const [lo, hi] = ARM_LIMITS[k]
      // A straight elbow may read a hair under zero; 2° is the capture's own floor.
      const slack = k === 'flex' ? 2 : 0
      if (j[k] < lo - slack || j[k] > hi) out.push(`${side}.${k}=${j[k].toFixed(0)} outside ${lo}..${hi}`)
    }
  }
  return out
}

/**
 * The measure itself, held to people: every frame of every motion-captured
 * clip the site ships (public/avatar/animations) reads an elbow flex of -2°
 * or more. Flip probeArmJoints' crook and the captures read as elbows bent
 * backwards, so the limits above would be measuring the wrong way round.
 */
const CLIPS = readdirSync(path.join(process.cwd(), 'public/avatar/animations'))
  .filter((f) => f.endsWith('.vrma'))
  .map((f) => buildMotion(new Uint8Array(readFileSync(path.join(process.cwd(), 'public/avatar/animations', f)))))

function leastCapturedFlex(rig: Rig): number {
  let least = Infinity
  for (const clip of CLIPS) {
    for (let t = 0; t < clip.duration; t += 0.1) {
      resetRig(rig)
      applyMotion(rig, clip, t)
      for (const side of ['left', 'right'] as const) least = Math.min(least, probeArmJoints(rig, side).flex)
    }
  }
  resetRig(rig)
  return least
}

describe.each(looks)('idle poses on $id', (look) => {
  it('reads the captured motions as elbows that bend forward', () => {
    expect(leastCapturedFlex(look.rig)).toBeGreaterThan(-3)
  })

  it.each(['open', 'behind'] as const)('keeps every arm joint where a person can put it in the %s pose', (pose: IdlePoseName) => {
    applyIdlePose(look.rig, pose)
    expect(outsideLimits(look.rig)).toEqual([])
  })

  it('bends the elbows forward, the way elbows bend, behind her back', () => {
    // The envelope's floor, named: a negative flex is an elbow bent backwards.
    applyIdlePose(look.rig, 'behind')
    for (const side of ['left', 'right'] as const) {
      expect(probeArmJoints(look.rig, side).flex, `${side} elbow`).toBeGreaterThan(20)
    }
  })

  it('keeps the joints humanly possible on the way between the two poses', () => {
    const poses = solveIdlePoses(poseSkeleton(look.rig))
    for (let i = 1; i < 10; i++) {
      posed(look, idlePoseNow({ current: 'behind', from: 'open', blend: i / 10, hold: 18 }, poses))
      expect(outsideLimits(look.rig), `${i * 10}%`).toEqual([])
    }
  })

  it('clasps: the holding palm closes on the other wrist', () => {
    // Read off the posed skeleton, not off the solver's own report: the palm
    // centre (60% of the way from wrist to middle knuckle) against a point
    // CLASP_BEHIND in front of the held wrist, on her side of it.
    const { claspError } = applyIdlePose(look.rig, 'behind')
    expect(claspError).toBeLessThan(0.001)
    const r = look.rig
    const palm = worldPosition(r, 'rightHand').lerp(worldPosition(r, 'rightMiddleProximal'), 0.6)
    const back = new THREE.Vector3(0, 0, r.version === '0' ? 1 : -1)
    const target = worldPosition(r, 'leftHand').addScaledVector(back, -CLASP_BEHIND)
    expect(palm.distanceTo(target), 'palm to the held wrist').toBeLessThan(0.005)
  })

  it('hides both hands from the front when they are behind her back', () => {
    // The owner's first note on the prototype: the hands sat too high and
    // showed from the front.
    applyIdlePose(look.rig, 'behind')
    const m = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    expect(m.hand).toBeGreaterThan(500)
    expect(m.visible, `${m.visible} hand vertices show from the front`).toBe(0)
  })

  it('sees the hands from the front when they are at her sides', () => {
    // The other half of the check above: the same measure on the open pose,
    // so a measure that never sees anything cannot pass it.
    applyIdlePose(look.rig, 'open')
    const m = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    expect(m.visible / m.hand).toBeGreaterThan(0.9)
  })

  it.each(['open', 'behind'] as const)('keeps her hands out of her body in the %s pose', (pose: IdlePoseName) => {
    applyIdlePose(look.rig, pose)
    const { depth, capsules } = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    // A capsule skipped for too little skin would read as 0mm: nothing measured, nothing deep.
    expect(capsules, 'torso and thigh capsules built').toBe(TORSO_SEGMENTS.length)
    expect(depth, `${(depth * 1000).toFixed(1)}mm deep`).toBeLessThanOrEqual(maxDepth(look.id))
  })

  it('keeps them out on the way between the two poses', () => {
    const poses = solveIdlePoses(poseSkeleton(look.rig))
    for (let i = 1; i < 10; i++) {
      posed(look, idlePoseNow({ current: 'behind', from: 'open', blend: i / 10, hold: 18 }, poses))
      const { depth } = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
      expect(depth, `${(depth * 1000).toFixed(1)}mm deep at ${i * 10}%`).toBeLessThanOrEqual(maxDepth(look.id))
    }
  })

  it.each(['open', 'behind'] as const)('keeps her hands outside her clothes in the %s pose', (pose: IdlePoseName) => {
    applyIdlePose(look.rig, pose)
    const { clothDepth } = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    expect(clothDepth, `${(clothDepth * 1000).toFixed(1)}mm into her clothes`).toBeLessThanOrEqual(maxClothDepth(look.id))
  })

  it('rests the clasped hands on her instead of holding them off her', () => {
    applyIdlePose(look.rig, 'behind')
    const { clothDepth } = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    expect(-clothDepth, `${(-clothDepth * 1000).toFixed(1)}mm off her clothes`).toBeLessThan(MAX_CLOTH_GAP)
  })

  it.runIf(look.id in CLOTH_WAIVER)('needs the clothes waiver it declares', () => {
    // A waiver the measure no longer needs is stale, and a measure that reads
    // nothing anywhere would pass every check above.
    let deepest = -Infinity
    for (const pose of ['open', 'behind'] as const) {
      applyIdlePose(look.rig, pose)
      deepest = Math.max(deepest, measureIdleSkin(look.rig, posedMesh(look.glb, look.rig)).clothDepth)
    }
    expect(deepest).toBeGreaterThan(MAX_CLOTH_DEPTH + 0.01)
  })

  it('keeps them outside her clothes on the way between the two poses', () => {
    // The capsules above are inscribed in her skin and leave her skirt out, so
    // the fade passed them while it swept both hands through Sendagaya Shibu's
    // pleats (owner, 2026-09-30: "when the hands come in to her body they go
    // inside her clothes"). Twenty steps: the deepest point sat at 85–95% on
    // most bodies, between the tenths the capsule check samples.
    const poses = solveIdlePoses(poseSkeleton(look.rig))
    for (let i = 1; i < 20; i++) {
      posed(look, idlePoseNow({ current: 'behind', from: 'open', blend: i / 20, hold: 18 }, poses))
      const { clothDepth } = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
      expect(clothDepth, `${(clothDepth * 1000).toFixed(1)}mm into her clothes at ${i * 5}%`).toBeLessThanOrEqual(maxClothDepth(look.id))
    }
  })

  it('hangs the arms behind her the way a person holds them, close to her body', () => {
    // The owner, 2026-09-30, on four versions in turn: "the arms behind her
    // are a little too straight" (elbows at 32–49°, hands hanging off her),
    // then "they should sit closer to the body" (elbows bent outward to 5–15cm
    // past the shoulder joints, which from the front camera reads as hands on
    // hips), then "the arm pose behind her back is very unnatural": her upper
    // arms were thrown 49–73° back, at the end of a shoulder's range, to reach
    // a clasp that hung in the air behind her. Shown three heights, the owner
    // chose the one resting on her with the elbows at 40°.
    applyIdlePose(look.rig, 'behind')
    const r = look.rig
    const shoulderOut = Math.abs(r.restPosition.leftUpperArm.x - r.restPosition.hips.x)
    const back = new THREE.Vector3(0, 0, r.version === '0' ? 1 : -1)
    for (const side of ['left', 'right'] as const) {
      expect(probeHand(r, side).elbowFlex, `${side} elbow`).toBeGreaterThan(30)
      const upper = worldPosition(r, `${side}LowerArm`).sub(worldPosition(r, `${side}UpperArm`))
      const thrownBack = THREE.MathUtils.radToDeg(Math.atan2(upper.dot(back), -upper.y))
      expect(thrownBack, `${side} upper arm, degrees back of hanging`).toBeLessThan(MAX_UPPER_ARM_BACK)
      const out = Math.abs(worldPosition(r, `${side}LowerArm`).x - worldPosition(r, 'spine').x) - shoulderOut
      expect(out, `${side} elbow past the shoulder`).toBeLessThan(0.03)
    }
  })

  it('stands with open hands just outside her thighs, palms toward the viewer', () => {
    applyIdlePose(look.rig, 'open')
    for (const side of ['left', 'right'] as const) {
      const out = Math.abs(worldPosition(look.rig, `${side}Hand`).x - worldPosition(look.rig, 'hips').x)
      expect(out, `${side} wrist from the midline`).toBeGreaterThan(0.2)
      expect(out, `${side} wrist from the midline`).toBeLessThan(0.28)
      expect(probeHand(look.rig, side).palmToViewer, `${side} palm`).toBeGreaterThan(0.5)
      expect(probeHand(look.rig, side).elbowFlex, `${side} elbow`).toBeLessThan(25)
    }
  })

  it('fits the stage frame on the way between the two poses, by way of the waypoint', () => {
    resetRig(look.rig)
    const skin = deriveSilhouetteSkin(look.glb, look.rig)
    const poses = solveIdlePoses(poseSkeleton(look.rig))
    for (let i = 1; i < 10; i++) {
      posed(look, idlePoseNow({ current: 'behind', from: 'open', blend: i / 10, hold: 18 }, poses))
      const reach = silhouetteReach(look.rig, skin)
      expect(Math.max(reach.left, reach.right), `${i * 10}%`).toBeLessThan(REST_HALF_WIDTH)
    }
  })

  it.each(['open', 'behind'] as const)('fits the stage frame in the %s pose', (pose: IdlePoseName) => {
    // The skin radii are read off the T-pose, as everywhere they are used.
    resetRig(look.rig)
    const skin = deriveSilhouetteSkin(look.glb, look.rig)
    applyIdlePose(look.rig, pose)
    const reach = silhouetteReach(look.rig, skin)
    expect(Math.max(reach.left, reach.right)).toBeLessThan(REST_HALF_WIDTH)
  })
})

describe('solveIdlePose', () => {
  it('leaves the rest positions it is handed untouched', () => {
    // rigProbe hands over the rig's own `restPosition` vectors. A solver that
    // added to one moved her rest shoulders 22mm further back every solve, and
    // every later measurement in the file was taken on that drifted skeleton.
    const { rig } = looks[0]
    const before = Object.fromEntries(Object.entries(rig.restPosition).map(([k, v]) => [k, v.clone()]))
    const sk = poseSkeleton(rig)
    for (let i = 0; i < 3; i++) for (const pose of ['open', 'behind'] as const) solveIdlePose(sk, pose)
    for (const [k, v] of Object.entries(before)) expect(rig.restPosition[k].distanceTo(v), k).toBe(0)
  })
})

describe('clothShell', () => {
  it("counts her skirt, which hangs off spring bones and no humanoid bone", () => {
    // The shell exists for what the capsules leave out. Part of Sendagaya
    // Shibu's skirt is skinned to spring joints hung from her thighs (217
    // vertices, 2026-09-30), so those vertices have no humanoid owner and only
    // their anchor says they belong to her. Read the anchor off the owner
    // instead and that part of the skirt drops out of the shell.
    const look = looks.find((l) => l.id === 'sendagaya-shibu')!
    resetRig(look.rig)
    const mesh = posedMesh(look.glb, look.rig)
    const shell = clothShell(look.rig, mesh)
    const hips = worldPosition(look.rig, 'hips')
    const skirt: number[] = []
    for (let i = 0; i < mesh.owner.length; i++) if (mesh.owner[i] === null && /UpperLeg$/.test(mesh.anchor[i] ?? '')) skirt.push(i)
    expect(skirt.length, 'spring-skinned vertices anchored to her thighs').toBeGreaterThan(200)
    const p = new THREE.Vector3()
    let inside = 0
    for (const i of skirt) {
      p.fromArray(mesh.positions, i * 3)
      const r = new THREE.Vector3(p.x - hips.x, 0, p.z - hips.z)
      p.addScaledVector(r.normalize(), -0.005)
      if (shell.depth(p) > 0) inside++
    }
    expect(inside / skirt.length).toBeGreaterThan(0.95)
  })
})

describe('blendPoses', () => {
  it('starts on the first pose and ends on the second', () => {
    const { rig } = looks[0]
    const sk = poseSkeleton(rig)
    const open = solveIdlePose(sk, 'open').rotations
    const behind = solveIdlePose(sk, 'behind').rotations
    for (const [bone, q] of blendPoses(open, behind, 0)) expect(q.angleTo(open.get(bone)!)).toBeLessThan(1e-6)
    for (const [bone, q] of blendPoses(open, behind, 1)) expect(q.angleTo(behind.get(bone)!)).toBeLessThan(1e-6)
  })

  it('is what the clock hands the engine mid-fade, by way of the waypoint', () => {
    const { rig } = looks[0]
    const poses = solveIdlePoses(poseSkeleton(rig))
    // 0.3 and 0.8, not 0.5: the halfway point is the waypoint itself from
    // either end, so it cannot tell a fade that runs backwards.
    const early = idlePoseNow({ current: 'behind', from: 'open', blend: 0.3, hold: 18 }, poses)
    for (const [bone, q] of blendPoses(poses.open, poses.via, 0.6, poses.rollAxes)) expect(q.angleTo(early.get(bone)!), bone).toBeLessThan(1e-6)
    const late = idlePoseNow({ current: 'behind', from: 'open', blend: 0.8, hold: 18 }, poses)
    for (const [bone, q] of blendPoses(poses.via, poses.behind, 0.6, poses.rollAxes)) expect(q.angleTo(late.get(bone)!), bone).toBeLessThan(1e-6)
    expect(idlePoseNow({ current: 'behind', from: null, blend: 1, hold: 18 }, poses)).toBe(poses.behind)
  })

  it('keeps the elbow a hinge part way, where a whole-bone slerp bends it sideways', () => {
    // The premise of rollAxes, on the solver's own rotations: without it the
    // forearm leaves its hinge plane mid-fade.
    const { rig } = looks[0]
    const poses = solveIdlePoses(poseSkeleton(rig))
    const hingeOff = (pose: ReadonlyMap<string, THREE.Quaternion>): number => {
      resetRig(rig)
      for (const [bone, q] of pose) rig.bones[bone]?.quaternion.copy(q)
      rig.root.updateMatrixWorld(true)
      return Math.max(...(['left', 'right'] as const).map((s) => Math.abs(probeArmJoints(rig, s).hingeOff)))
    }
    expect(hingeOff(blendPoses(poses.open, poses.behind, 0.3))).toBeGreaterThan(15)
    expect(hingeOff(blendPoses(poses.open, poses.behind, 0.3, poses.rollAxes))).toBeLessThan(10)
  })
})

describe('finger drift', () => {
  it.each(['0', '1'] as const)('turns each base joint about its curl axis, by at most FINGER_DRIFT, on a %s body', (version) => {
    // The curl axis is the finger's rest direction crossed with the palm's
    // (down at rest): the axis idlePose curls a grip about, so the drift
    // opens and closes the hand rather than fanning or twisting it.
    const { at } = fingerDrift(version)
    const left = new THREE.Vector3(version === '0' ? -1 : 1, 0, 0)
    const palm = new THREE.Vector3(0, -1, 0)
    const curl = { left: left.clone().cross(palm), right: left.clone().negate().cross(palm) }
    let most = 0
    for (let t = 0; t < 20; t += 0.05) {
      for (const d of at(t, 1, 1)) {
        const angle = 2 * Math.acos(Math.min(1, Math.abs(d.q.w)))
        most = Math.max(most, (angle * 180) / Math.PI)
        if (angle < 1e-4) continue
        const axis = new THREE.Vector3(d.q.x, d.q.y, d.q.z).normalize()
        expect(Math.abs(axis.dot(d.bone.startsWith('left') ? curl.left : curl.right))).toBeCloseTo(1, 6)
      }
    }
    expect(most).toBeGreaterThan(FINGER_DRIFT * 0.9)
    expect(most).toBeLessThanOrEqual(FINGER_DRIFT + 1e-6)
  })

  it('does not move a hand whose weight is 0', () => {
    const { at } = fingerDrift('0')
    for (const d of at(3.3, 1, 0)) {
      if (d.bone.startsWith('right')) expect(d.q.angleTo(new THREE.Quaternion())).toBe(0)
      else expect(d.q.angleTo(new THREE.Quaternion())).toBeGreaterThan(0)
    }
  })

  it('lets the holding hand drift only while it is not holding', () => {
    expect(holdingHandFree({ current: 'open', from: null, blend: 1, hold: 10 })).toBe(1)
    expect(holdingHandFree({ current: 'behind', from: null, blend: 1, hold: 10 })).toBe(0)
    expect(holdingHandFree({ current: 'behind', from: 'open', blend: 0.25, hold: 10 })).toBeGreaterThan(0.5)
    expect(holdingHandFree({ current: 'open', from: 'behind', blend: 0.25, hold: 10 })).toBeLessThan(0.5)
  })
})


describe('the forearm roll goes to the hand', () => {
  // upperArm > lowerArm > hand, the wrist 0.24m down the forearm's own +x.
  function arm(side: 'left' | 'right') {
    const upper = new THREE.Object3D()
    const fore = new THREE.Object3D()
    const hand = new THREE.Object3D()
    fore.position.set(0.22, 0, 0)
    hand.position.set(0.24, 0.01, 0)
    upper.add(fore)
    fore.add(hand)
    upper.quaternion.setFromEuler(new THREE.Euler(0.3, -0.2, 1.1))
    const axis = hand.position.clone().normalize()
    const hinge = new THREE.Vector3(0, 0, 1).cross(axis).normalize()
    const bend = new THREE.Quaternion().setFromAxisAngle(hinge, side === 'left' ? 0.9 : -0.9)
    fore.quaternion.copy(bend).multiply(new THREE.Quaternion().setFromAxisAngle(axis, 1.45))
    hand.quaternion.setFromEuler(new THREE.Euler(0.1, 0.35, -0.2))
    return { upper, fore, hand, axis, bend }
  }
  const world = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false)
    return { q: o.getWorldQuaternion(new THREE.Quaternion()), p: o.getWorldPosition(new THREE.Vector3()) }
  }
  const sides = { left: arm('left'), right: arm('right') }
  const bone = (name: string) =>
    name === 'leftLowerArm' ? sides.left.fore : name === 'leftHand' ? sides.left.hand
      : name === 'rightLowerArm' ? sides.right.fore : name === 'rightHand' ? sides.right.hand : null

  it('leaves the forearm only its bend, and every hand where and how it was', () => {
    const before = (['left', 'right'] as const).map((s) => [world(sides[s].hand), sides[s].fore.quaternion.clone(), sides[s].hand.quaternion.clone()] as const)
    const undo = forearmRollToHand(bone)
    ;(['left', 'right'] as const).forEach((s, i) => {
      const { fore, hand, axis, bend } = sides[s]
      const after = world(hand)
      expect(after.q.angleTo(before[i][0].q)).toBeLessThan(1e-6)
      expect(after.p.distanceTo(before[i][0].p)).toBeLessThan(1e-9)
      // What is left on the forearm turns nothing about its own length.
      const p = fore.quaternion.x * axis.x + fore.quaternion.y * axis.y + fore.quaternion.z * axis.z
      expect(Math.abs(p)).toBeLessThan(1e-9)
      expect(fore.quaternion.angleTo(bend)).toBeLessThan(1e-6)
    })
    undo()
    ;(['left', 'right'] as const).forEach((s, i) => {
      expect(sides[s].fore.quaternion.equals(before[i][1])).toBe(true)
      expect(sides[s].hand.quaternion.equals(before[i][2])).toBe(true)
    })
  })
})
