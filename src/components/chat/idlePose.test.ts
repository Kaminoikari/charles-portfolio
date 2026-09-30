import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { parseGlb, type Glb } from './vrmHumanoid'
import { OFFERED_VARIANTS } from './avatarVariants'
import { REST_HALF_WIDTH } from '../avatar/stageLayout'
import {
  blendPoses,
  CLASP_BEHIND,
  FINGER_DRIFT,
  fingerDrift,
  holdingHandFree,
  IDLE_POSE_FADE,
  IDLE_POSE_HOLD,
  idlePoseNow,
  idlePoseStart,
  solveIdlePose,
  stepIdlePose,
  type IdlePoseName,
  type IdlePoseState,
} from './idlePose'
import {
  applyIdlePose,
  buildRigFrom,
  deriveSilhouetteSkin,
  measureIdleSkin,
  TORSO_SEGMENTS,
  posedMesh,
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
 * same skeleton in pink's clothes. Both poses lay the hoodie's own sleeves on
 * that hem: 23.2mm behind her back and 10.7mm with open hands by this measure,
 * cloth on cloth, and it reads as a sleeve resting on a hoodie in the render
 * (2026-09-30). Every other offered look is held to MAX_DEPTH.
 */
const DEPTH_WAIVER: Record<string, number> = { milfy: 0.025 }
const maxDepth = (id: string): number => DEPTH_WAIVER[id] ?? MAX_DEPTH

function posed(look: Look, rotations: ReadonlyMap<string, THREE.Quaternion>): void {
  resetRig(look.rig)
  for (const [bone, q] of rotations) look.rig.bones[bone]?.quaternion.copy(q)
  look.rig.root.updateMatrixWorld(true)
  look.rig.humanoid.update()
  look.rig.scene.updateMatrixWorld(true)
}

describe.each(looks)('idle poses on $id', (look) => {
  it('clasps: the holding palm closes on the other wrist', () => {
    // Read off the posed skeleton, not off the solver's own report: the palm
    // centre (60% of the way from wrist to middle knuckle) against a point
    // CLASP_BEHIND behind the held wrist.
    const { claspError } = applyIdlePose(look.rig, 'behind')
    expect(claspError).toBeLessThan(0.001)
    const r = look.rig
    const palm = worldPosition(r, 'rightHand').lerp(worldPosition(r, 'rightMiddleProximal'), 0.6)
    const back = new THREE.Vector3(0, 0, r.version === '0' ? 1 : -1)
    const target = worldPosition(r, 'leftHand').addScaledVector(back, CLASP_BEHIND)
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
    const sk = { version: look.rig.version, rest: (b: string) => look.rig.restPosition[b] }
    const open = solveIdlePose(sk, 'open').rotations
    const behind = solveIdlePose(sk, 'behind').rotations
    for (let i = 1; i < 10; i++) {
      posed(look, blendPoses(open, behind, i / 10))
      const { depth } = measureIdleSkin(look.rig, posedMesh(look.glb, look.rig))
      expect(depth, `${(depth * 1000).toFixed(1)}mm deep at ${i * 10}%`).toBeLessThanOrEqual(maxDepth(look.id))
    }
  })

  it('bends the elbows behind her and keeps them close to her body', () => {
    // The owner, 2026-09-30, on two earlier versions: "the arms behind her
    // are a little too straight" (elbows at 32–49°), then "they should sit
    // closer to the body" (elbows bent outward to 5–15cm past the shoulder
    // joints, which from the front camera reads as hands on hips).
    applyIdlePose(look.rig, 'behind')
    const r = look.rig
    const shoulderOut = Math.abs(r.restPosition.leftUpperArm.x - r.restPosition.hips.x)
    for (const side of ['left', 'right'] as const) {
      expect(probeHand(r, side).elbowFlex, `${side} elbow`).toBeGreaterThan(60)
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
    const sk = { version: rig.version, rest: (b: string) => rig.restPosition[b] }
    for (let i = 0; i < 3; i++) for (const pose of ['open', 'behind'] as const) solveIdlePose(sk, pose)
    for (const [k, v] of Object.entries(before)) expect(rig.restPosition[k].distanceTo(v), k).toBe(0)
  })
})

describe('blendPoses', () => {
  it('starts on the first pose and ends on the second', () => {
    const { rig } = looks[0]
    const sk = { version: rig.version, rest: (b: string) => rig.restPosition[b] }
    const open = solveIdlePose(sk, 'open').rotations
    const behind = solveIdlePose(sk, 'behind').rotations
    for (const [bone, q] of blendPoses(open, behind, 0)) expect(q.angleTo(open.get(bone)!)).toBeLessThan(1e-6)
    for (const [bone, q] of blendPoses(open, behind, 1)) expect(q.angleTo(behind.get(bone)!)).toBeLessThan(1e-6)
  })

  it('is what the clock hands the engine mid-fade', () => {
    const { rig } = looks[0]
    const sk = { version: rig.version, rest: (b: string) => rig.restPosition[b] }
    const poses = { open: solveIdlePose(sk, 'open').rotations, behind: solveIdlePose(sk, 'behind').rotations }
    // 0.3, not 0.5: the eased halfway point is the same from either end, so
    // it cannot tell a fade that runs backwards.
    const now = idlePoseNow({ current: 'behind', from: 'open', blend: 0.3, hold: 18 }, poses)
    for (const [bone, q] of blendPoses(poses.open, poses.behind, 0.3)) expect(q.angleTo(now.get(bone)!)).toBeLessThan(1e-6)
    expect(idlePoseNow({ current: 'behind', from: null, blend: 1, hold: 18 }, poses)).toBe(poses.behind)
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

