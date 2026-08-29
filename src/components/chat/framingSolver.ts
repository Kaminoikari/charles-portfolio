/**
 * Choose a camera framing for a body, instead of hand-deriving one per model.
 *
 * `AVATAR_FRAMING_DEFAULT`'s lookAtY is a literal with a paragraph of derivation
 * above it: the top edge has to clear the highest skin any offered clip reaches,
 * the bottom edge has to keep the lowest hips in frame, the visible span is fixed
 * by distance and fov, and the number is the centre of whatever window those two
 * bounds leave. That derivation is an algorithm, and it was run once, by hand, on
 * one body. A second body — a child, a taller adult — has different extremes and
 * needs the same derivation run again.
 *
 * So this is that paragraph as code. It does not change the shipped framing:
 * `framingSolver.test.ts` asserts it reproduces 1.32 from the actual clips, which
 * is what makes it trustworthy on a body nobody has composed by hand.
 *
 * What it deliberately does NOT do is pick `distance`. Distance trades how large
 * the body renders against how much vertical span exists to place, and that is a
 * design call about how big she should look, not a constraint the geometry can
 * settle.
 */
import * as THREE from 'three'

import {
  applyMotion,
  resetRig,
  silhouetteJoints,
  SKIN_ABOVE_JOINT,
  type Motion,
  type Rig,
} from './rigProbe'

export interface NamedMotion {
  name: string
  motion: Motion
}

export interface BodyExtremes {
  /** Highest rendered point over the clips, joint plus the skin above it. */
  topSkin: number
  /** Lowest hips over the clips: the frame may not cut above them. */
  bottomHips: number
  /** Which clip set each bound, so an empty window can be argued with. */
  topClip: string
  bottomClip: string
}

const scratch = new THREE.Vector3()

function hipsY(rig: Rig): number {
  const hips = rig.bones.hips
  if (!hips) throw new Error('rig has no hips bone')
  hips.updateWorldMatrix(true, false)
  return hips.getWorldPosition(scratch).y
}

/**
 * The two bounds, sampled over every keyframe of every clip that must fit.
 *
 * Sampling the clip's own keyframe times rather than a fixed count is the same
 * choice `Motion.sampleTimes` documents: at 60fps a fixed 120 samples steps over
 * five frames at a time, which is long enough to walk past the one frame where a
 * hand is at its highest.
 *
 * `SKIN_ABOVE_JOINT` is added because the frame has to clear the RENDERED hand,
 * not its thumb-tip joint; measuring the joint alone is what once put a fix a few
 * pixels short.
 */
export function motionExtremes(rig: Rig, clips: NamedMotion[]): BodyExtremes {
  if (clips.length === 0) throw new Error('no clips to bound the framing with')
  let topSkin = -Infinity
  let bottomHips = Infinity
  let topClip = ''
  let bottomClip = ''
  for (const { name, motion } of clips) {
    for (const t of motion.sampleTimes) {
      resetRig(rig)
      applyMotion(rig, motion, t)
      for (const joint of silhouetteJoints(rig)) {
        const skin = joint.y + SKIN_ABOVE_JOINT
        if (skin > topSkin) {
          topSkin = skin
          topClip = name
        }
      }
      const hips = hipsY(rig)
      if (hips < bottomHips) {
        bottomHips = hips
        bottomClip = name
      }
    }
  }
  resetRig(rig)
  return { topSkin, bottomHips, topClip, bottomClip }
}

export interface FramingSolution {
  lookAtY: number
  /** The feasible range for lookAtY; empty when min > max. */
  window: { min: number; max: number }
  /** Vertical metres the frame covers, from distance and fov alone. */
  span: number
  /** Metres of air between each edge and the bound it clears. */
  clearance: { top: number; bottom: number }
}

/** Vertical metres visible at `distance` under a vertical `fov` in degrees. */
export function viewSpan(distance: number, fov: number): number {
  return 2 * distance * Math.tan((fov / 2) * (Math.PI / 180))
}

/**
 * Where to point the camera so both bounds are held, centred in whatever room
 * that leaves.
 *
 * Centring rather than hugging either edge is what makes the number survive a
 * clip being added later: the slack is spent evenly, so a new gesture reaching a
 * little higher does not immediately break the frame.
 *
 * `round` mirrors the hand-derivation, which took the centre to the nearest
 * 10mm. Sub-millimetre precision here is false: the bounds come from a rig whose
 * skin offset is itself an estimate.
 */
export function solveFraming(
  extremes: BodyExtremes,
  opts: { distance: number; fov: number; round?: number },
): FramingSolution {
  const round = opts.round ?? 0.01
  const span = viewSpan(opts.distance, opts.fov)
  const half = span / 2
  const window = { min: extremes.topSkin - half, max: extremes.bottomHips + half }
  if (window.min > window.max) {
    throw new Error(
      `no framing holds both bounds at distance ${opts.distance}: the clips span ` +
        `${(extremes.topSkin - extremes.bottomHips).toFixed(4)}m ` +
        `(${extremes.topClip} on top, ${extremes.bottomClip} below) but the frame ` +
        `covers ${span.toFixed(4)}m. Move the camera back, or drop a clip.`,
    )
  }
  const centre = (window.min + window.max) / 2
  const lookAtY = Math.round(centre / round) * round
  return {
    lookAtY,
    window,
    span,
    clearance: {
      top: lookAtY + half - extremes.topSkin,
      bottom: extremes.bottomHips - (lookAtY - half),
    },
  }
}
