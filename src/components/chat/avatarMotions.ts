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
// LICENCE, for the four clips taken from VRoid Project's free 7-pack of VRM
// Animation files (peaceSign, modelPose, spin, squat), verified on 2026-08-19
// to be bit-identical to the originals in pixiv's own VRMA_MotionPack.zip.
// Commercial use is permitted with attribution, and the pack's terms forbid
// redistributing the motions in a form that can be rigged or extracted without
// permission — which serving them from /avatar/animations is, and which the
// owner holds permission for. See docs/plans/avatar-motion-capture.md for the
// hashes and terms. CREDIT below is that pack's required attribution and
// names that pack only.
import type { AvatarPlacement } from './avatarMode'

export type AvatarMotionName =
  | 'peaceSign'
  | 'modelPose'
  | 'spin'
  | 'squat'
  | 'akimbo'
  | 'playFingers'
  | 'scratchHead'
  | 'idleLoop'
  | 'stretch'
  | 'dance'

// Which composed frame a motion has been measured against. The launcher and the
// docked canvas share a framing and an aspect ratio, so they share a budget;
// the fullscreen column is composed lower and slightly tighter.
export type MotionFrame = 'waistUp' | 'column'

/**
 * A measured guard violation this clip is knowingly shipped with.
 *
 * Every field is the clip's OWN measured worst case, so the guard still holds
 * it to a number rather than waving it through. rigProbe.test.ts also fails a
 * waiver that is not needed, which stops one being left behind after a clip is
 * re-exported or replaced: a waiver has to earn its place every run.
 */
export interface MotionWaiver {
  /** Highest hand, in metres, when it rises above a frame's top edge. */
  handTop?: number
  /** Deepest hand-against-face ellipsoid value, when it drops below 1. */
  handInHead?: number
  /** Widest sideways reach, in metres, when it passes the canvas half-width. */
  reach?: number
  /** Hips sideways offset at the clip's ends, in metres, when it is off centre. */
  hipsDrift?: number
  /** Highest wrist at the clip's ends, in metres, when an arm is not hanging. */
  endWrist?: number
}

export interface AvatarMotionDef {
  /** Frames this motion has been measured to fit. Enforced in rigProbe.test.ts. */
  placements: readonly MotionFrame[]
  /**
   * True when the point of the motion is a hand the viewer must read — a wave,
   * a peace sign. The probe then requires a palm actually turned to camera at
   * some point, which is the check the hand-authored doublePeace failed for its
   * whole life on the site.
   */
  showsPalm: boolean
  /** Measured guard violations shipped on purpose. Absent means none. */
  waiver?: MotionWaiver
}

// Measured 2026-08-19 by retargeting all seven clips of the pack onto
// AvatarSample_B_webp.vrm. Four are absent on purpose, and the numbers are here
// so nobody re-adds one on the assumption that an official clip must be safe:
//
//   greeting      opens with her hips at y=0.310, 0.568m below her rest height,
//                 and she rises off the floor over the first 2.4s. A fingertip
//                 is also 17.0mm inside her head across 67 frames between
//                 t=2.27s and t=7.23s. Two independent failures.
//   showFullBody  reaches 0.713 toward the viewer's left against a 0.675 canvas
//                 budget, for 54 frames between t=1.42s and t=2.30s. That edge
//                 is the one over the transcript, so the cut happens in the
//                 middle of the screen rather than off it: about 32px of hand
//                 disappearing for nearly a second on a 1920x1080 column.
//   shoot         VRMA_04, and it SHIPPED until the probe was widened from the
//                 index fingertip to all sixteen hand joints: its right thumb
//                 crosses into her cheek for 16 frames from t=3.35s to t=3.60s,
//                 4.9mm past the face ellipsoid. Index-only it measures 1.19 and
//                 looks clean. Do not re-add it without fixing the clip.
//
// A clip is only listed once the probe agrees it fits; adding one without
// running that check is how the hand-authored gestures got where they were.
export const AVATAR_MOTIONS: Record<AvatarMotionName, AvatarMotionDef> = {
  // VRMA_03. The V is held beside her face, palm out, for about two seconds.
  peaceSign: { placements: ['waistUp', 'column'], showsPalm: true },
  // VRMA_06. A quiet standing pose; the hands stay low and never lead, and the
  // probe agrees — its best palm-to-viewer is 0.35, so it is not a hand the
  // viewer is meant to read and the palm guard does not apply to it.
  modelPose: { placements: ['waistUp', 'column'], showsPalm: false },
  // VRMA_05. A turn on the spot. She passes through 178° of body yaw, which is
  // a question of what suits a chat guide and not of whether the motion is
  // sound; on every measurement of soundness it is the cleanest of the seven
  // after modelPose.
  spin: { placements: ['waistUp', 'column'], showsPalm: true },
  // VRMA_07. She lowers into a squat and comes back up, hips down to 0.660.
  // Column only. The waist-up frame was raised on 2026-08-20 to fit `stretch`'s
  // raised hands, and its bottom edge came up with it, from 0.618 to 0.768 —
  // past her hips at the bottom of the squat. The column crops at 0.430 and has
  // room to spare. Her hands stay low the entire time (best palm-to-viewer
  // 0.23), so this is not a hand the viewer is meant to read.
  squat: { placements: ['column'], showsPalm: false },
  // Hands to her hips. Reaches 0.250 / 0.274 to the two screen sides against a
  // 0.674 budget, hands never above y=0.938, hips flat at 0.882. Best
  // palm-to-viewer is -0.15, the backs of her hands, which is what hands on
  // hips look like from the front.
  akimbo: { placements: ['waistUp', 'column'], showsPalm: false },
  // She turns her fingers over in front of her. The smallest of the ten:
  // 0.233 / 0.234 sideways, hands never above y=0.954. Palm -0.10.
  playFingers: { placements: ['waistUp', 'column'], showsPalm: false },
  // A hand up to the back of her head. Closest approach to her face is 1.34,
  // clear of the ellipsoid, and the palm does turn to the viewer at 0.89.
  scratchHead: { placements: ['waistUp', 'column'], showsPalm: true },
  // A standing idle, and by far the quietest clip here: 0.337 to the viewer's
  // left, 0.035 to the right, hands never above y=0.768. It does stand 0.152 to
  // one side of centre, at both ends and so throughout, which the fade slides
  // her across on the way in and out: about 38px on the launcher canvas.
  idleLoop: {
    placements: ['waistUp', 'column'],
    showsPalm: false,
    waiver: { hipsDrift: 0.16 },
  },
  // Arms overhead: highest joint 1.7971, highest SKIN 1.8091. Waist-up only, and
  // the reason that frame was raised on 2026-08-20 — at the old 1.722 top edge
  // this was cut on the very canvas the owner wanted to watch it on, and it now
  // clears the 1.8722 edge by 63mm. The column crops at 1.602 and cannot hold it
  // without giving up the full-height composition that placement exists for, so
  // it is simply not offered there.
  stretch: { placements: ['waistUp'], showsPalm: true },
  // 26.8s, the longest by far, and the clip that drove the 2026-08-20 widening:
  // it reaches 0.6978 to the viewer's left, which was 23mm past the old 0.6745
  // canvas and sits 44mm inside the 0.7415 one. Its reach waiver is gone with
  // that, because a waiver that is not needed is a test failure.
  //
  // What it still does is put a hand 38.9mm inside her head for 18 frames around
  // t=8.23s — ellipsoid 0.299, eight times the 4.9mm that kept `shoot` out. That
  // figure got WORSE when the probe started measuring the skinned fingertip: on
  // the distal joint alone it read 26.8mm.
  //
  // Its VRMC_vrm_animation has no specVersion, so three-vrm logs one warning per
  // load and assumes 1.0. The other nine clips declare it.
  //
  // It also ends badly for a clip the engine has to fade out of: hips 0.140 off
  // centre and her right wrist still up at 1.188, where the guard wants an arm
  // hanging below 1.05. `greeting` was dropped partly for ending at 1.15.
  //
  // Column only since the waist-up frame rose for `stretch`: it drops its hips to
  // 0.7525, and holding both that and a raised hand would need the waist-up frame
  // to sit within 4mm of two opposite edges at once.
  dance: {
    placements: ['column'],
    showsPalm: true,
    waiver: { handInHead: 0.29, hipsDrift: 0.15, endWrist: 1.19 },
  },
}

// How far a clip's FIRST AND LAST frames may sit below her rest height. Motion
// capture carries its own stance, and three-vrm-animation scales the hips track
// by the two rigs' rest heights without re-seating it, so a clip authored on a
// rig that stood lower pulls the whole body down the canvas. 0.08m is about 20px
// on the launcher canvas: visible if you look for it, invisible in motion.
//
// This is checked at the ends and nowhere else, which is the 2026-08-20
// correction. Applied to every frame it also rejected `squat` for going down —
// which is what a squat is. A retargeting offset shows itself at the ends,
// because a clip that opens and closes standing must open and close at her own
// height; what happens in between is the motion, and the guard for THAT is the
// frame's bottom edge.
export const MAX_HIPS_SINK = 0.08

export const MOTION_URL = (name: AvatarMotionName): string => `/avatar/animations/${name}.vrma`

// What the idle timer may pick. All three read as something a person would do
// unprompted while waiting; none of them needs a reason.
export const IDLE_MOTIONS: readonly AvatarMotionName[] = [
  'peaceSign',
  'modelPose',
  'spin',
  'squat',
  'akimbo',
  'playFingers',
  'scratchHead',
  'idleLoop',
  'stretch',
  'dance',
]

/** The frame a placement composes to, or null where no avatar renders. */
export function motionFrame(placement: AvatarPlacement): MotionFrame | null {
  if (placement === 'hidden') return null
  return placement === 'column' ? 'column' : 'waistUp'
}

/**
 * Motions cleared for a placement. Empty when nothing renders there.
 *
 * There is deliberately no viewport check here. Between 2026-08-19 and the same
 * evening this filtered a column clip out when the canvas was too narrow to show
 * its whole reach; then the owner asked for her BODY to hug the panel's right
 * edge and said a clipped gesture is fine. Her body's visibility is now a
 * property of avatarColumnRightInset, and what a clip has to fit is the canvas,
 * which rigProbe.test.ts checks before it can be listed above.
 */
export function motionsFor(placement: AvatarPlacement): readonly AvatarMotionName[] {
  const frame = motionFrame(placement)
  if (!frame) return []
  return IDLE_MOTIONS.filter((name) => AVATAR_MOTIONS[name].placements.includes(frame))
}
