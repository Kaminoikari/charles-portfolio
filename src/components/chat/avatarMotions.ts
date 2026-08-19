// The motion-capture half of Mika's performance.
//
// Her arm gestures used to be hand-authored bone angles. Every one of them was
// a guess at where an angle would put a hand, and the only automated check was
// the sideways reach against the canvas width, so seven of the ten shipped
// broken (see docs/plans/avatar-motion-capture.md for the measurements). These
// clips are motion capture: the joints are coordinated because a person moved
// that way, and the probe in rigProbe.ts measures where they actually land
// before any of them reaches a visitor.
//
// LICENCE. VRoid Project's free 7-pack of VRM Animation files, verified on
// 2026-08-19 to be bit-identical to the originals in pixiv's own
// VRMA_MotionPack.zip. Commercial use is permitted with attribution, and the
// pack's terms forbid redistributing the motions in a form that can be rigged
// or extracted without permission — which serving them from /avatar/animations
// is, and which the owner holds permission for. Do not add a motion here
// without checking where its file came from and whether its terms allow
// bundling. See docs/plans/avatar-motion-capture.md for the hashes and terms.
import {
  AVATAR_COLUMN_ASPECT,
  AVATAR_COLUMN_RIGHT_INSET,
  AVATAR_FRAMING_COLUMN,
  avatarViewHalfWidth,
  type AvatarPlacement,
} from './avatarMode'

export type AvatarMotionName = 'peaceSign' | 'modelPose' | 'spin'

// Which composed frame a motion has been measured against. The launcher and the
// docked canvas share a framing and an aspect ratio, so they share a budget;
// the fullscreen column is composed lower and slightly tighter.
export type MotionFrame = 'waistUp' | 'column'

export interface AvatarMotionDef {
  /** Frames this motion has been measured to fit. Enforced in rigProbe.test.ts. */
  placements: readonly MotionFrame[]
  /**
   * How far toward the VIEWER'S RIGHT the clip's hands reach, in metres,
   * measured by rigProbe over every keyframe and pinned to that measurement by
   * a test.
   *
   * The viewer's right is the side that gets cut off: the column canvas hangs a
   * fixed 32px past the viewport's right edge. It is also HER LEFT, because
   * facing you mirrors her sideways axis, so this number is the negated MINIMUM
   * of the probe's x, not its maximum (see rigProbe's screenX). Getting that
   * backwards filters the wrong hand, and the wrong hand happens to be the one
   * a peace sign is held in.
   *
   * The loss grows as the canvas shrinks: 0.038m on a 1136px column, 0.269m on
   * a 160px one. Certifying at one viewport therefore certifies one viewport,
   * which is why the picker consults this at run time (see motionsFor) instead
   * of a yes/no baked in here.
   */
  screenRightReach: number
  /**
   * True when the point of the motion is a hand the viewer must read — a wave,
   * a peace sign. The probe then requires a palm actually turned to camera at
   * some point, which is the check the hand-authored doublePeace failed for its
   * whole life on the site.
   */
  showsPalm: boolean
}

// Measured 2026-08-19 by retargeting all seven clips of the pack onto
// AvatarSample_B_webp.vrm. Four are absent on purpose, and the numbers are here
// so nobody re-adds one on the assumption that an official clip must be safe:
//
//   greeting      hips start at y=0.306, 0.57m below her rest height — she
//                 rises off the floor over the first four seconds — and a
//                 fingertip passes through her cheek at t=6.06s (0.65)
//   squat         hips sink 0.218, most of the way to the frame's bottom edge,
//                 and its best palm-to-viewer is 0.23
//   showFullBody  reaches 0.713 toward the viewer's left, past the canvas
//                 itself, and never turns a palm to the viewer (0.32)
//   shoot         VRMA_04, and it SHIPPED until the probe was widened from the
//                 index fingertip to all sixteen hand joints: its right thumb
//                 crosses into her cheek for 16 frames around t=3.45s, 7-10mm
//                 past the face ellipsoid. Index-only it measures 1.19 and looks
//                 clean. Do not re-add it without fixing the clip.
//
// A clip is only listed once the probe agrees it fits; adding one without
// running that check is how the hand-authored gestures got where they were.
export const AVATAR_MOTIONS: Record<AvatarMotionName, AvatarMotionDef> = {
  // VRMA_03. The V is held beside her face, palm out, for about two seconds.
  peaceSign: { placements: ['waistUp', 'column'], screenRightReach: 0.444, showsPalm: true },
  // VRMA_06. A quiet standing pose; the hands stay low and never lead, and the
  // probe agrees — its best palm-to-viewer is 0.35, so it is not a hand the
  // viewer is meant to read and the palm guard does not apply to it.
  modelPose: { placements: ['waistUp', 'column'], screenRightReach: 0.286, showsPalm: false },
  // VRMA_05. A turn on the spot. She passes through 178° of body yaw, which is
  // a question of what suits a chat guide and not of whether the motion is
  // sound; on every measurement of soundness it is the cleanest of the seven
  // after modelPose.
  spin: { placements: ['waistUp', 'column'], screenRightReach: 0.509, showsPalm: true },
}

// How far a clip may drop her hips below their rest height. Motion capture
// carries its own stance, and three-vrm-animation scales the hips track by the
// two rigs' rest heights without re-seating it, so a clip authored on a rig
// that stood lower pulls the whole body down the canvas. 0.08m is about 20px
// on the launcher canvas: visible if you look for it, invisible in motion.
export const MAX_HIPS_SINK = 0.08

export const MOTION_URL = (name: AvatarMotionName): string => `/avatar/animations/${name}.vrma`

// What the idle timer may pick. All three read as something a person would do
// unprompted while waiting; none of them needs a reason.
export const IDLE_MOTIONS: readonly AvatarMotionName[] = ['peaceSign', 'modelPose', 'spin']

/** The frame a placement composes to, or null where no avatar renders. */
export function motionFrame(placement: AvatarPlacement): MotionFrame | null {
  if (placement === 'hidden') return null
  return placement === 'column' ? 'column' : 'waistUp'
}

/**
 * Metres of the VIEWER'S right side that a column canvas of `canvasW` pixels
 * actually shows. The canvas always frames the same ±0.6745m whatever its pixel size,
 * and AVATAR_COLUMN_RIGHT_INSET pushes a fixed 32px of that past the viewport,
 * so the loss in metres scales with 1/canvasW. A 1136px column keeps 0.6365m;
 * a 160px one (an iPad held upright, the narrowest a column ever gets) keeps
 * 0.4051m, already narrower than peaceSign's 0.444m.
 *
 * A canvas of zero width shows zero metres, and that is also the answer a
 * caller who has not measured its canvas should get: the failure to know is
 * treated as the worst case, so nothing is offered until a width is known.
 */
export function columnVisibleHalfWidth(canvasW: number): number {
  if (!(canvasW > 0)) return 0
  const half = avatarViewHalfWidth(AVATAR_FRAMING_COLUMN, { w: AVATAR_COLUMN_ASPECT, h: 1 })
  return Math.max(0, half - (Math.abs(AVATAR_COLUMN_RIGHT_INSET) / canvasW) * 2 * half)
}

/**
 * Motions cleared for a placement. Empty when nothing renders there.
 *
 * `columnCanvasW` is the column canvas's rendered width in CSS pixels; leave it
 * out for the placements whose canvas is fully on screen. Omitting it in the
 * column means the widest clips are offered on an iPad in portrait, where the
 * column is 160px wide and 20% of it is off the right edge of the screen, so
 * the unmeasured default is the worst case and offers nothing.
 */
export function motionsFor(
  placement: AvatarPlacement,
  columnCanvasW?: number,
): readonly AvatarMotionName[] {
  const frame = motionFrame(placement)
  if (!frame) return []
  const budget = frame === 'column' ? columnVisibleHalfWidth(columnCanvasW ?? 0) : Infinity
  return IDLE_MOTIONS.filter(
    (name) =>
      AVATAR_MOTIONS[name].placements.includes(frame) &&
      AVATAR_MOTIONS[name].screenRightReach < budget,
  )
}
