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
import type { AvatarPlacement } from './avatarMode'

export type AvatarMotionName = 'peaceSign' | 'modelPose' | 'spin' | 'squat'

// Which composed frame a motion has been measured against. The launcher and the
// docked canvas share a framing and an aspect ratio, so they share a budget;
// the fullscreen column is composed lower and slightly tighter.
export type MotionFrame = 'waistUp' | 'column'

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
  // VRMA_07. She lowers into a squat and comes back up. Her hips reach 0.660,
  // which is 0.218 below her rest height and still above both frames' bottom
  // edges (0.618 waist-up, 0.430 column), so the whole motion stays in shot.
  // Her hands stay low the entire time (best palm-to-viewer 0.23), so this is
  // not a hand the viewer is meant to read.
  squat: { placements: ['waistUp', 'column'], showsPalm: false },
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
