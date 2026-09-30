// A clip that takes over from one still playing must not move a bone in one
// frame. On 2026-09-27 switching Dance to Spin mid-play moved Gishin's chest
// 126mm in a single frame (Spin to Squat: 113mm): the playing clip was stopped
// outright, every bone it held dropped to rest, and the new clip only faded in
// from there. The bust springs read the jump as speed and swung to 72 degrees,
// turning the cleavage's painted crease shadow out onto the front of the chest.
//
// Driven through three's real AnimationMixer on a one-bone rig: the hips held
// 12cm off rest, which is the size of the jump measured on the site.
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { clipShare, poseUnderClips, releaseMotion, restUnderClip, takeOverMotion, type OutgoingMotion } from './avatarGuideEngine'

const FADE = 0.25
const DT = 1 / 60
// A clip taking the bones over in FADE seconds moves 12cm by at most
// 0.12 / (FADE * 60) = 8mm a frame; the hard cut moved all of it at once.
const MAX_STEP = 0.02

function rig() {
  const root = new THREE.Object3D()
  const hips = new THREE.Object3D()
  hips.name = 'hips'
  root.add(hips)
  return { root, hips, mixer: new THREE.AnimationMixer(root) }
}

// Rises from rest to 12cm over its first second and holds there.
const RISE = new THREE.AnimationClip('rise', 3, [
  new THREE.VectorKeyframeTrack('hips.position', [0, 1, 3], [0, 0, 0, 0, 0.12, 0, 0, 0.12, 0]),
])
// Stays at rest throughout.
const STILL = new THREE.AnimationClip('still', 3, [
  new THREE.VectorKeyframeTrack('hips.position', [0, 3], [0, 0, 0, 0, 0, 0]),
])

/**
 * Run `seconds` of frames the way the engine does; returns the largest
 * per-frame hips step. `from` is where the hips stood on the last frame drawn
 * before the call that led here: stopping a clip hands its bones back to rest
 * inside stop() itself, so a jump can land between frames, before this runs.
 */
function run(
  r: ReturnType<typeof rig>,
  outgoing: OutgoingMotion[],
  seconds: number,
  from = r.hips.position.y,
): number {
  let worst = 0
  let before = from
  for (let t = 0; t < seconds; t += DT) {
    for (let i = outgoing.length - 1; i >= 0; i--) if (!releaseMotion(outgoing[i], DT, FADE)) outgoing.splice(i, 1)
    r.mixer.update(DT)
    worst = Math.max(worst, Math.abs(r.hips.position.y - before))
    before = r.hips.position.y
  }
  return worst
}

describe('a clip taking the bones over from one still playing', () => {
  it('moves no bone further than the fade allows in one frame', () => {
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    expect(r.hips.position.y).toBeCloseTo(0.12, 3)
    const shown = r.hips.position.y
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE, outgoing)
    if (next.outgoing) outgoing.push(next.outgoing)
    expect(run(r, outgoing, 1, shown)).toBeLessThan(MAX_STEP)
    expect(r.hips.position.y).toBeCloseTo(0, 3)
  })

  it('does the same when the clip restarts itself', () => {
    // mixer.clipAction hands back the playing action for the same clip, and
    // resetting it would be the same one-frame jump from 12cm back to 0.
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    const shown = r.hips.position.y
    const again = takeOverMotion(r.mixer, RISE, first.action, FADE, outgoing)
    expect(again.action).not.toBe(first.action)
    if (again.outgoing) outgoing.push(again.outgoing)
    expect(run(r, outgoing, 0.5, shown)).toBeLessThan(MAX_STEP)
  })

  it('plays a clip asked for again while it is still letting go', () => {
    // Dance, Spin, Dance inside one fade: the first Dance is still giving its
    // weight back when it is asked for again, and reusing that action handed
    // the new play to the release, which stopped it; she settled to rest
    // with the button still showing Dance.
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    const spin = takeOverMotion(r.mixer, STILL, first.action, FADE, outgoing)
    if (spin.outgoing) outgoing.push(spin.outgoing)
    run(r, outgoing, FADE / 2)
    const shown = r.hips.position.y
    const again = takeOverMotion(r.mixer, RISE, spin.action, FADE, outgoing)
    if (again.outgoing) outgoing.push(again.outgoing)
    expect(run(r, outgoing, 0.5, shown)).toBeLessThan(MAX_STEP)
    expect(again.action.isRunning()).toBe(true)
    expect(again.action.getEffectiveWeight()).toBe(1)
    expect(outgoing).toHaveLength(0)
  })

  it('plays a clip restarted three times inside one fade', () => {
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    let last = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    for (let i = 0; i < 2; i++) {
      last = takeOverMotion(r.mixer, RISE, last.action, FADE, outgoing)
      if (last.outgoing) outgoing.push(last.outgoing)
      run(r, outgoing, FADE / 4)
    }
    run(r, outgoing, FADE)
    expect(last.action.isRunning()).toBe(true)
    expect(last.action.getEffectiveWeight()).toBe(1)
    expect(outgoing).toHaveLength(0)
  })

  it('lets the old clip go once the new one holds the bones', () => {
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE, outgoing)
    if (next.outgoing) outgoing.push(next.outgoing)
    run(r, outgoing, FADE + 0.1)
    expect(outgoing).toHaveLength(0)
    expect(first.action.isRunning()).toBe(false)
    expect(next.action.getEffectiveWeight()).toBe(1)
  })

  it('hands over from the weight a settling clip had got down to', () => {
    // The settle lowers a finished clip's weight by hand; a switch in the
    // middle of it must give back what the clip held then, not a full weight.
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    first.action.setEffectiveWeight(0.5)
    r.mixer.update(DT)
    const shown = r.hips.position.y
    expect(shown).toBeCloseTo(0.06, 3)
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE, outgoing)
    if (next.outgoing) outgoing.push(next.outgoing)
    expect(run(r, outgoing, 1, shown)).toBeLessThan(MAX_STEP)
  })

  it('leaves the procedural layer no share of the body while clips hand over', () => {
    // The engine lerps chest, hips and head toward its own pose by
    // 1 - clipShare. The incoming clip starts at weight 0, so a share that
    // missed the outgoing one would hand the whole chest to the procedural
    // pose on the first frame of every switch.
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE, outgoing)
    run(r, outgoing, 1.5)
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE, outgoing)
    if (next.outgoing) outgoing.push(next.outgoing)
    let least = clipShare(next.action, outgoing)
    for (let t = 0; t < FADE + 0.1; t += DT) {
      run(r, outgoing, DT)
      least = Math.min(least, clipShare(next.action, outgoing))
    }
    expect(least).toBeGreaterThan(0.95)
  })
})

describe('the idle pose under a clip that does not turn every bone', () => {
  // The waveWink of 2026-09-30 turned only the arms. Played while peaceSign (which turns the
  // shoulders too) still held her, the shoulders were handed back by the
  // mixer itself when peaceSign let go: restoreOriginalState puts back what
  // they were when peaceSign started, the idle pose's shoulders swung back,
  // and nothing wrote them again while the wave held the whole body.
  const about = (deg: number, axis: THREE.Vector3) => new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg))
  const X = new THREE.Vector3(1, 0, 0)
  const Y = new THREE.Vector3(0, 1, 0)
  const hold = (node: string, q: THREE.Quaternion) =>
    new THREE.QuaternionKeyframeTrack(`${node}.quaternion`, [0, 3], [...q.toArray(), ...q.toArray()])
  const PEACE = new THREE.AnimationClip('peace', 3, [hold('shoulder', about(10, X)), hold('arm', about(30, X))])
  const WAVE = new THREE.AnimationClip('wave', 3, [hold('arm', about(-60, X))])
  const REST: ReadonlyMap<string, THREE.Quaternion> = new Map()
  const IDLE = new Map([
    ['shoulder', about(20, Y)],
    ['arm', about(-70, X)],
  ])
  const fromRest = (q: THREE.Quaternion) => THREE.MathUtils.radToDeg(q.angleTo(new THREE.Quaternion()))

  // She stands in the idle pose for half a second; `start` plays a clip the
  // way playMotion does, and `frames` runs the engine's frame order.
  function stage() {
    const root = new THREE.Object3D()
    const nodes = new Map(['shoulder', 'arm'].map((n) => [n, Object.assign(new THREE.Object3D(), { name: n })]))
    for (const n of nodes.values()) root.add(n)
    const mixer = new THREE.AnimationMixer(root)
    const bone = (n: string) => nodes.get(n)
    const shoulder = nodes.get('shoulder')!
    const outgoing: OutgoingMotion[] = []
    let playing: THREE.AnimationAction | null = null
    let worst = 0
    let before = shoulder.quaternion.clone()
    const frames = (seconds: number) => {
      for (let t = 0; t < seconds; t += DT) {
        for (let i = outgoing.length - 1; i >= 0; i--) if (!releaseMotion(outgoing[i], DT, FADE)) outgoing.splice(i, 1)
        mixer.update(DT)
        poseUnderClips(bone, IDLE, 1 - clipShare(playing, outgoing), playing, outgoing, REST)
        worst = Math.max(worst, THREE.MathUtils.radToDeg(shoulder.quaternion.angleTo(before)))
        before = shoulder.quaternion.clone()
      }
    }
    const start = (clip: THREE.AnimationClip) => {
      const next = restUnderClip(bone, IDLE, REST, () => takeOverMotion(mixer, clip, playing, FADE, outgoing))
      if (next.outgoing) outgoing.push(next.outgoing)
      playing = next.action
    }
    frames(0.5)
    worst = 0
    return { shoulder, arm: nodes.get('arm')!, frames, start, outgoing, worst: () => worst }
  }

  it('keeps the shoulders at rest when the wave takes over from a clip that turns them, and never jumps them', () => {
    const { shoulder, frames, start, outgoing, worst } = stage()
    start(PEACE)
    frames(1)
    start(WAVE)
    frames(1)
    expect(outgoing).toHaveLength(0)
    expect(fromRest(shoulder.quaternion)).toBeLessThan(0.01)
    // Fading from the idle pose's 20° about one axis to the clip's 10° about
    // another in FADE seconds steps at most 1.9° a frame. With the mixer
    // remembering the idle pose, the old clip letting go handed the shoulder
    // back to it and the next frame's pose layer put it at rest: about 19–20°
    // in one frame.
    expect(worst()).toBeLessThan(2.5)
  })

  it('eases them to rest when the wave starts straight from the idle pose', () => {
    const { shoulder, frames, start, worst } = stage()
    start(WAVE)
    frames(1)
    expect(fromRest(shoulder.quaternion)).toBeLessThan(0.1)
    expect(worst()).toBeLessThan(2.5)
  })

  it('leaves every bone where the frame put it when a clip starts inside the frame', () => {
    // The chat's idle rotation starts its clips in the frame loop, after the
    // pose is written and before the render: whatever the start leaves on a
    // bone is what that frame draws.
    const { shoulder, arm, start } = stage()
    const was = [shoulder.quaternion.clone(), arm.quaternion.clone()]
    start(WAVE)
    expect(shoulder.quaternion.angleTo(was[0])).toBeLessThan(1e-6)
    expect(arm.quaternion.angleTo(was[1])).toBeLessThan(1e-6)
  })
})
