import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { parseGlb, type Glb } from './vrmHumanoid'
import { OFFERED_VARIANTS } from './avatarVariants'
import { REST_HALF_WIDTH } from '../avatar/stageLayout'
import {
  armRollsToWrist,
  CLASP_BEHIND,
  clipDriven,
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
  sweepPoses,
  writeIdlePose,
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
 * read 15.2mm until the clasp moved to rest on her, then 0mm, and 0.9mm since
 * her elbows moved out to her sides (8.8mm at most through the fade). Every
 * other offered look is held to MAX_DEPTH.
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
 * with the hands clasped behind, people hold it short of that. CLASP.upperBack
 * hangs every offered look's upper arms 40.0–40.1° back (2026-09-30); this
 * leaves 1° over it.
 */
const MAX_UPPER_ARM_BACK = 41
/**
 * Two looks whose clothes one set of body-relative numbers cannot clear, each
 * at what it measured on 2026-09-30, so neither can get worse unnoticed:
 *
 * - milfy's hoodie hangs in a bell to her thighs (see DEPTH_WAIVER), 2.05 hip
 *   widths behind her hips, so the clasp stops at CLASP.deepest and her hands
 *   go under its hem, 88.0mm deep (86.0mm near the end of the fade); open
 *   hands sit 13.7mm into its flare.
 * - studio's coat flares from the waist, and her open hands brush its skirt,
 *   20.0mm in. The fade starts there, which is its deepest point (12.2mm at 10%).
 *
 * Both want the pose placed against the clothes each body wears, which the
 * solver does not see: it reads bones only.
 */
const CLOTH_WAIVER: Record<string, number> = { milfy: 0.089, studio: 0.02 }

/**
 * The furthest her clasped hands may stand off her clothes, in metres: they
 * rest on her. A clasp placed without her surface hung 4–9cm off Sendagaya
 * Shibu's skirt with the upper arms thrown back to reach it (2026-09-30).
 * Resting on her, every offered look measures 2.7–22.7mm (2026-09-30, with
 * her elbows out at her sides).
 */
const MAX_CLOTH_GAP = 0.024
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
 *   80–90°; hand behind the back is its functional test). Held to 103 here:
 *   with her hands behind her and her elbows out at her sides, where the
 *   owner's reference has them so the arms show from the front (2026-09-30),
 *   the forearms run in behind her and the upper arms turn in 89–102°
 *   (vivi the most, 101.8°, still and through the fade). Turning them in no
 *   further tucks the elbows in behind her back, where the previous version
 *   had them at 83.5° and the arms vanished from the front.
 * - forearm: rolls 75–90° either way from neutral (pronation, supination)
 * - wrist: bends, but does not roll; the forearm rolls for it
 *
 * 2026-09-30: the behind-back pose bent both elbows about 60° backwards and
 * rolled the left forearm 166° (the owner: "both arms would break").
 */
const ARM_LIMITS: Record<keyof ArmJoints, [number, number]> = {
  flex: [0, 150],
  hingeOff: [-15, 15],
  upperTwist: [-103, 103],
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

it('every waiver names a look', () => {
  const ids = looks.map((l) => l.id)
  expect([...Object.keys(DEPTH_WAIVER), ...Object.keys(CLOTH_WAIVER)].filter((id) => !ids.includes(id))).toEqual([])
})

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

  it('shows her arms from the front when her hands are behind her', () => {
    // The owner, 2026-09-30, on a phone, with a game's dressing room for
    // reference: "from the front both arms have completely vanished". The
    // collarbones swung back 40° and the elbows tucked in behind her, so 0–17%
    // of each upper arm's skin showed from the front. Her elbows now stay out
    // at her sides and only the forearms go round her: the upper arms show
    // 33–84% as much as with her hands open (pink and base the least, under
    // a jacket that covers their arms either way).
    applyIdlePose(look.rig, 'open')
    const open = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    applyIdlePose(look.rig, 'behind')
    const behind = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
    expect(open.upperArm).toBeGreaterThan(100)
    const share = behind.upperArmVisible / behind.upperArm / (open.upperArmVisible / open.upperArm)
    expect(share, 'upper arm seen behind, against open').toBeGreaterThan(0.3)
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

  // Registered only on a waived look, so the other looks report nothing
  // rather than a skip each. 'every waiver names a look' keeps a key that
  // matches no look from leaving this unregistered everywhere.
  if (look.id in CLOTH_WAIVER) it('needs the clothes waiver it declares', () => {
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
    // chose the one resting on her with the elbows at 40°; then, with a
    // game's dressing room for reference, "from the front both arms have
    // completely vanished". The upper arms now hang 40° back with the elbows
    // out at her sides (14–28mm past the shoulder joints) and bend 43–71°.
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

describe('sweepPoses', () => {
  it('is what the clock hands the engine: from one pose, by the waypoint, to the other', () => {
    const { rig } = looks[0]
    const poses = solveIdlePoses(poseSkeleton(rig))
    const at = (blend: number) => idlePoseNow({ current: 'behind', from: 'open', blend, hold: 18 }, poses)
    for (const [bone, q] of at(0)) expect(q.angleTo(poses.open.get(bone)!), bone).toBeLessThan(1e-6)
    for (const [bone, q] of at(0.5)) expect(q.angleTo(poses.via.get(bone)!), bone).toBeLessThan(1e-6)
    for (const [bone, q] of at(1)) expect(q.angleTo(poses.behind.get(bone)!), bone).toBeLessThan(1e-6)
    // Backwards, the same road: open to behind at 0.3 is behind to open at 0.7.
    const back = idlePoseNow({ current: 'open', from: 'behind', blend: 0.7, hold: 18 }, poses)
    for (const [bone, q] of at(0.3)) expect(q.angleTo(back.get(bone)!), bone).toBeLessThan(1e-5)
    expect(idlePoseNow({ current: 'behind', from: null, blend: 1, hold: 18 }, poses)).toBe(poses.behind)
  })

  it.each(looks.map((l) => [l.id, l] as const))('takes her hands round the waypoint in one sweep on %s', (_, look) => {
    // The owner, 2026-10-01: the move behind her back "is right but jerky".
    // Eased at both ends of each half, the fade stopped her wrist dead at the
    // waypoint (3% of its top speed, on every body) and sent it back out 150°
    // from the way it came in (Gishin's right wrist): a corner. Now it turns there on a curve, at
    // 39% of its top speed on Gishin.
    const poses = solveIdlePoses(poseSkeleton(look.rig))
    for (const hand of ['rightHand', 'leftHand']) {
      const wrist = (blend: number) => {
        posed(look, idlePoseNow({ current: 'behind', from: 'open', blend, hold: 18 }, poses))
        return worldPosition(look.rig, hand)
      }
      const frames = (fps: number) => {
        const n = Math.round(IDLE_POSE_FADE * fps)
        const p = Array.from({ length: n + 1 }, (_, i) => wrist(i / n))
        const v = p.slice(1).map((q, i) => q.clone().sub(p[i]))
        const turn = Math.max(...v.slice(1).map((d, i) => d.angleTo(v[i])))
        return { n, speed: v.map((d) => d.length()), turn }
      }
      const at60 = frames(60)
      const fastest = Math.max(...at60.speed)
      const middle = at60.speed.slice(Math.round(at60.n * 0.2), Math.round(at60.n * 0.8))
      expect(Math.min(...middle) / fastest, `${hand}: slowest between 20% and 80% of the fade, of the fastest`).toBeGreaterThan(0.3)
      // It sets off from rest and comes to rest: 2% of the top speed in the
      // first and last frames, where an unshaped sweep starts and stops at 74–88%.
      expect(at60.speed[0] / fastest, `${hand}: first frame, of the fastest`).toBeLessThan(0.1)
      expect(at60.speed[at60.n - 1] / fastest, `${hand}: last frame, of the fastest`).toBeLessThan(0.1)
      // A corner turns as far in a frame at any frame rate; a curve turns half
      // as far at twice the rate.
      expect(frames(120).turn / at60.turn, `${hand}: sharpest turn per frame at 120fps against 60fps`).toBeLessThan(0.6)
    }
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
    // From the waypoint in to behind her back, where both ends are true
    // hinges: split, the elbow stays on its hinge (0.09° at most on the first
    // look, 2026-10-01); whole, it strays 5.6°. The open pose is 7.8° off its
    // hinge already, so the first half cannot tell the two apart.
    const worst = (axes?: ReadonlyMap<string, THREE.Vector3>) =>
      Math.max(...[0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95].map((s) => hingeOff(sweepPoses(poses.open, poses.via, poses.behind, s, axes))))
    expect(worst()).toBeGreaterThan(4)
    expect(worst(poses.rollAxes)).toBeLessThan(1)
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


describe('the arm rolls go to the wrist', () => {
  // chest > upperArm > lowerArm > hand, each joint a little off its parent's
  // axes the way a real rig's are.
  function arm(sign: 1 | -1) {
    const chest = new THREE.Object3D()
    const upper = new THREE.Object3D()
    const fore = new THREE.Object3D()
    const hand = new THREE.Object3D()
    upper.position.set(0.1 * sign, 0.3, 0)
    fore.position.set(0.26 * sign, -0.012, 0.004)
    hand.position.set(0.24 * sign, 0.01, -0.006)
    chest.add(upper)
    upper.add(fore)
    fore.add(hand)
    chest.quaternion.setFromEuler(new THREE.Euler(0.05, 0.1, 0))
    const roll = (o: THREE.Object3D, child: THREE.Object3D, bend: THREE.Quaternion, angle: number) =>
      o.quaternion.copy(bend).multiply(new THREE.Quaternion().setFromAxisAngle(child.position.clone().normalize(), angle))
    roll(upper, fore, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.2, 1.1 * sign)), 1.3 * sign)
    roll(fore, hand, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1).cross(hand.position).normalize(), 0.9), 1.45)
    hand.quaternion.setFromEuler(new THREE.Euler(0.1, 0.35, -0.2))
    return { chest, upper, fore, hand }
  }
  const world = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, false)
    return { q: o.getWorldQuaternion(new THREE.Quaternion()), p: o.getWorldPosition(new THREE.Vector3()) }
  }
  const rollAbout = (o: THREE.Object3D, child: THREE.Object3D) => {
    const a = child.position.clone().normalize()
    return Math.abs(o.quaternion.x * a.x + o.quaternion.y * a.y + o.quaternion.z * a.z)
  }

  it('leaves the upper arm and forearm no roll, and every joint and hand where and how it was', () => {
    const sides = { left: arm(1), right: arm(-1) }
    const bone = (name: string) => {
      const side = name.startsWith('left') ? sides.left : name.startsWith('right') ? sides.right : null
      if (!side) return null
      return name.endsWith('UpperArm') ? side.upper : name.endsWith('LowerArm') ? side.fore : name.endsWith('Hand') ? side.hand : null
    }
    const parts = ['upper', 'fore', 'hand'] as const
    const before = (['left', 'right'] as const).map((s) => parts.map((k) => ({ w: world(sides[s][k]), q: sides[s][k].quaternion.clone() })))
    // Both rolls are really there to move.
    for (const s of ['left', 'right'] as const) {
      expect(rollAbout(sides[s].upper, sides[s].fore)).toBeGreaterThan(0.3)
      expect(rollAbout(sides[s].fore, sides[s].hand)).toBeGreaterThan(0.3)
    }
    const undo = armRollsToWrist(bone)
    ;(['left', 'right'] as const).forEach((s, i) => {
      const { upper, fore, hand } = sides[s]
      expect(rollAbout(upper, fore)).toBeLessThan(1e-9)
      expect(rollAbout(fore, hand)).toBeLessThan(1e-9)
      for (const [k, o] of [['fore', fore], ['hand', hand]] as const) {
        const now = world(o)
        const was = before[i][parts.indexOf(k)].w
        expect(now.p.distanceTo(was.p)).toBeLessThan(1e-9)
      }
      expect(world(hand).q.angleTo(before[i][2].w.q)).toBeLessThan(1e-6)
    })
    undo()
    ;(['left', 'right'] as const).forEach((s, i) => {
      parts.forEach((k, j) => expect(sides[s][k].quaternion.equals(before[i][j].q)).toBe(true))
    })
  })
})

describe('the idle pose under a clip', () => {
  // waveWink drove her arms and hands and nothing else (until 2026-10-01, when
  // it was cut from the peace sign's mocap; idleLoop still leaves the fingers
  // to the pose). Blended from last
  // frame's value, a shoulder or finger no clip writes walks all the way to the
  // pose at any share, so she waved with the hands-behind pose's shoulders
  // swung back and its fist (2026-09-30).
  const about = (deg: number, axis = new THREE.Vector3(0, 0, 1)) =>
    new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg))
  const rig = () => {
    const bones = new Map(['leftUpperArm', 'leftShoulder', 'leftIndexProximal'].map((n) => {
      const o = new THREE.Object3D()
      o.name = `Normalized_${n}`
      return [n, o] as const
    }))
    return { bones, bone: (n: string) => bones.get(n) }
  }
  const pose = new Map([
    ['leftUpperArm', about(-60)],
    ['leftShoulder', about(20, new THREE.Vector3(0, 1, 0))],
    ['leftIndexProximal', about(80)],
  ])
  const rest = new Map([['leftUpperArm', about(-70)]])
  const clipArm = about(40, new THREE.Vector3(1, 0, 0))

  it('eases a bone no clip drives from its rest, not from where it was', () => {
    const { bones, bone } = rig()
    const driven = (node: THREE.Object3D) => node.name === 'Normalized_leftUpperArm'
    for (let frame = 0; frame < 30; frame++) {
      bones.get('leftUpperArm')!.quaternion.copy(clipArm) // the mixer's write
      writeIdlePose(bone, pose, 0.2, driven, rest)
    }
    const at = (n: string) => bones.get(n)!.quaternion
    expect(at('leftIndexProximal').angleTo(new THREE.Quaternion().slerp(pose.get('leftIndexProximal')!, 0.2))).toBeLessThan(1e-6)
    expect(at('leftShoulder').angleTo(new THREE.Quaternion().slerp(pose.get('leftShoulder')!, 0.2))).toBeLessThan(1e-6)
    expect(at('leftUpperArm').angleTo(clipArm.clone().slerp(pose.get('leftUpperArm')!, 0.2))).toBeLessThan(1e-6)
  })

  it('takes an undriven bone from its own rest where it has one', () => {
    const { bones, bone } = rig()
    bones.get('leftUpperArm')!.quaternion.copy(about(10))
    writeIdlePose(bone, pose, 0.25, () => false, rest)
    const want = rest.get('leftUpperArm')!.clone().slerp(pose.get('leftUpperArm')!, 0.25)
    expect(bones.get('leftUpperArm')!.quaternion.angleTo(want)).toBeLessThan(1e-6)
  })

  it('writes the pose outright when no clip holds her', () => {
    const { bones, bone } = rig()
    writeIdlePose(bone, pose, 1, () => false, rest)
    for (const [n, q] of pose) expect(bones.get(n)!.quaternion.angleTo(q)).toBeLessThan(1e-6)
  })

  it('reads which nodes a clip drives off its tracks', () => {
    const clip = new THREE.AnimationClip('wave', 1, [
      new THREE.QuaternionKeyframeTrack('Normalized_leftUpperArm.quaternion', [0], [0, 0, 0, 1]),
      new THREE.VectorKeyframeTrack('Normalized_hips.position', [0], [0, 0, 0]),
    ])
    const drives = clipDriven([clip])
    const node = (name: string) => Object.assign(new THREE.Object3D(), { name })
    expect(drives(node('Normalized_leftUpperArm'))).toBe(true)
    expect(drives(node('Normalized_hips'))).toBe(false)
    expect(drives(node('Normalized_leftShoulder'))).toBe(false)
  })
})
