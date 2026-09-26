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
import { clipShare, releaseMotion, takeOverMotion, type OutgoingMotion } from './avatarGuideEngine'

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
    const first = takeOverMotion(r.mixer, RISE, null, FADE)
    run(r, outgoing, 1.5)
    expect(r.hips.position.y).toBeCloseTo(0.12, 3)
    const shown = r.hips.position.y
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE)
    if (next.outgoing) outgoing.push(next.outgoing)
    expect(run(r, outgoing, 1, shown)).toBeLessThan(MAX_STEP)
    expect(r.hips.position.y).toBeCloseTo(0, 3)
  })

  it('does the same when the clip restarts itself', () => {
    // mixer.clipAction hands back the playing action for the same clip, and
    // resetting it would be the same one-frame jump from 12cm back to 0.
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE)
    run(r, outgoing, 1.5)
    const shown = r.hips.position.y
    const again = takeOverMotion(r.mixer, RISE, first.action, FADE)
    expect(again.action).not.toBe(first.action)
    if (again.outgoing) outgoing.push(again.outgoing)
    expect(run(r, outgoing, 0.5, shown)).toBeLessThan(MAX_STEP)
  })

  it('lets the old clip go once the new one holds the bones', () => {
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE)
    run(r, outgoing, 1.5)
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE)
    if (next.outgoing) outgoing.push(next.outgoing)
    run(r, outgoing, FADE + 0.1)
    expect(outgoing).toHaveLength(0)
    expect(first.action.isRunning()).toBe(false)
    expect(next.action.getEffectiveWeight()).toBe(1)
  })

  it('leaves the procedural layer no share of the body while clips hand over', () => {
    // The engine lerps chest, hips and head toward its own pose by
    // 1 - clipShare. The incoming clip starts at weight 0, so a share that
    // missed the outgoing one would hand the whole chest to the procedural
    // pose on the first frame of every switch.
    const r = rig()
    const outgoing: OutgoingMotion[] = []
    const first = takeOverMotion(r.mixer, RISE, null, FADE)
    run(r, outgoing, 1.5)
    const next = takeOverMotion(r.mixer, STILL, first.action, FADE)
    if (next.outgoing) outgoing.push(next.outgoing)
    let least = clipShare(next.action, outgoing)
    for (let t = 0; t < FADE + 0.1; t += DT) {
      run(r, outgoing, DT)
      least = Math.min(least, clipShare(next.action, outgoing))
    }
    expect(least).toBeGreaterThan(0.95)
  })
})
