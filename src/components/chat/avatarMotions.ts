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

/**
 * Metres the frame slides while a clip plays, per frame it declares.
 *
 * A frame is composed for its pool, and each pool is nine clips, eight of which
 * stand still. The ninth does not: `dance` drops her hips 0.126m below rest,
 * hops 0.086m above it, and throws her hair higher still. One composition can hold that AND
 * `stretch`'s hands overhead, but only by spending the clearance the other eight
 * clips rely on. Rather than drop the clip (what happened on 2026-08-20) or
 * re-centre the frame for all nine, the camera moves for the clip that needs it
 * and moves back after: negative slides the frame DOWN, positive UP.
 *
 * The engine eases it in and out (stepFramePan) and rigProbe.test.ts measures a
 * panning clip against its OWN panned frame — and fails a pan the clip does not
 * need, the same way a waiver has to earn its place.
 */
export type MotionPan = Partial<Record<MotionFrame, number>>

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
  /** Frame movement this clip needs to be seen whole. Absent means none. */
  pan?: MotionPan
  /**
   * The highest point this clip DRAWS, in metres — hair and ornaments included.
   *
   * Read off the render, not off the rig, and that is the whole reason it
   * exists: her hair hangs from spring bones, which the probe does not simulate
   * (see rigProbe's note on what is still not modelled). The gap is not small.
   * At rest the spring settles her topmost drawn pixel 29mm BELOW the bind-pose
   * hair vertex; mid-hop the same strands are thrown 146mm above it. Rigging
   * that vertex to the head bone and calling it the crown puts the clip's worst
   * frame 32mm over the column's unpanned top edge, at t=19.53; the render puts
   * it 126mm over, and peaks at t=11.85. Close enough to sound like a
   * measurement, wrong by a factor of four, wrong about which frame, and wrong
   * in the direction that lets a clip through.
   *
   * It is a SAMPLING bound, not a ceiling. The spring is driven by the frame
   * timings it happens to get, so the peak moves run to run: nine column sweeps
   * at pan +0.16 topped out at 1.7215, and eighteen at +0.13 ranged over
   * 1.7175-1.7276, a 10mm spread. The figure carried below is that worst.
   * Record the worst you have seen, and read a higher reading as a result
   * rather than as noise to round away — this value only ever moves by hand, so
   * a thin margin costs a re-measure, never a silent regression.
   *
   * It is also the topmost pixel with alpha over 8/255, which counts the
   * translucent fringe on her hair tips and ornaments and not only the hair you
   * can see. In the column that fringe got to row 3 at worst, while the topmost
   * pixel above alpha 128 never rose past row 25 in the three sweeps measured
   * at both thresholds, 32mm lower. So this trips about 32mm before anything
   * visible is cut, which is the direction a guard should be wrong in — and a
   * re-measure at another threshold is not comparable.
   *
   * Absent means not measured, and absent is the norm: this costs a browser
   * sweep of every frame of the clip, and it is carried for the one clip whose
   * framing depends on it. The other nine were swept once on 2026-08-20 anyway.
   * The eight that play in the column all sit within 5mm of its top edge (spin,
   * playFingers and scratchHead 3-5mm PAST it, which is how they already ship
   * and is untouched by this); `stretch` plays waist-up only, where its highest
   * point is a hand and the bone guard above already measures it. See
   * docs/plans/avatar-motion-capture.md for the table.
   *
   * Re-measure if the model, the clip, or a frame's composition changes.
   */
  crown?: number
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
  // It also MOVES, which nothing else in the pool does, and it moves at both
  // ends. Her hips drop to 0.7525 and hop to 0.9644 against a rest height of
  // 0.8782, and the hop throws her hair to 1.7276 — 175mm above where it hangs
  // when she stands still. Against the two compositions:
  //
  //   waist-up  hips 15mm below the bottom edge, for 14 of 805 sampled frames
  //             from t=7.77s. This is what took the clip out of the waist-up
  //             pool on 2026-08-20 and off the launcher with it.
  //   column    119mm above the top edge at t=12.05, and above it at all on 98
  //             of 1589 rendered frames. That is the 2026-08-20 sweep, which
  //             is why its numbers sit 6mm under the `crown` above. What is
  //             out is hair and the ornaments in it — her skull was never
  //             measured and is not claimed — but at 119mm the cut runs
  //             through the whole crown of her head, and the screenshots at
  //             t=12.05 and t=19.46 show it flat. This shipped.
  //
  // A static re-centre of the waist-up frame was available and was not taken.
  // With this clip in the pool the window for lookAtY is 1.2569 (`stretch`'s
  // hand at the top) to 1.3047 (these hips at the bottom): 48mm wide, so its
  // centre leaves 24mm at both edges where the pool has 63mm and 55mm today.
  // That spends eight clips' margin on this one — and 24mm is inside the range
  // the unmodelled hair swings through.
  //
  // So the frame moves for the clip instead, and the two numbers are derived,
  // not dialled. What has to fit is this clip's OWN rendered extremes: hips
  // 0.7525 at the bottom, crown 1.7276 at the top, 0.975m apart.
  //
  //   waistUp  -0.08  centres those in the 1.104m span (midpoint 1.240, rounded
  //                   to 1.24 like every lookAtY here): 65mm under her hips,
  //                   65mm over her hair. The span had the room; it was sitting
  //                   in the wrong place.
  //   column   +0.13  the smallest pan that does not clip her hair, and so the
  //                   most leg this clip can keep: the column's spare room is
  //                   all at the BOTTOM, so every mm the frame rises is a mm of
  //                   her legs. Eighteen full-clip sweeps at this value never
  //                   reached row 0; the worst was row 3, putting crown 1.7276
  //                   4.4mm inside the 1.732 top edge. +0.12 was not swept —
  //                   that same measured crown is 5.6mm outside ITS edge, which
  //                   is why the guard reddens there. The 4.4mm is the
  //                   translucent fringe the crown threshold counts; the topmost
  //                   pixel a visitor can see stayed 36mm inside. So a
  //                   re-measure risks a red guard, not a visible cut. +0.16 is
  //                   this clip with a 34mm fringe margin and 30mm less leg;
  //                   neither setting reaches her knee, which avatarMode puts
  //                   at 0.40 in one comment and 0.43 in another — below this
  //                   frame's 0.560 bottom edge either way.
  //
  // Nothing else in the pool is touched by either number.
  dance: {
    placements: ['waistUp', 'column'],
    showsPalm: true,
    pan: { waistUp: -0.08, column: 0.13 },
    crown: 1.7276,
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

// ---- returning to rest -----------------------------------------------------
//
// Every clip hands the bones back to the engine's pinned rest pose (ARM_PINS in
// avatarGuideEngine.ts), and until 2026-08-20 that handover was a 0.25s LINEAR
// cross-fade for all ten of them. Two things were wrong with it, both measured
// on the running page rather than guessed:
//
//  · A linear weight ramp has a velocity STEP at both ends. In the recorded
//    trace her left upper arm drifts 0.0011 rad per frame through the clip's
//    last second and then moves 0.0137 in the first fade frame — twelve times
//    faster, in one frame — holds exactly that speed for fifteen frames, and
//    stops dead. Nothing alive starts or stops like that.
//  · A fixed duration over a variable distance. A clip's final pose is not the
//    pinned rest pose, and how far apart they are is a property of the clip:
//    from 0.060m of wrist travel (`squat`) to 0.540m (`dance`). At 0.25s flat
//    that is a ninefold spread in speed, so the same settle reads as gentle
//    after one clip and as a snap after another.
//
// So the settle is eased and its duration comes from the distance. The speed is
// the constant; the bounds keep a tiny settle from being instant and a huge one
// from making her look underwater.
//
// The floor is doing most of the work, and that is deliberate. Seven of the
// nine clips the waist-up idle picker draws from end within 0.143m of rest, so
// distance alone would leave them all at roughly the old timing; 0.4s is what
// actually slows THOSE down (peaceSign travels 0.097m: 0.41 m/s flat before,
// 0.24 m/s average now). Above 0.18m the speed takes over, which is where
// `idleLoop` (0.231m) and `dance` (0.540m) live — the two that were genuinely
// racing at 0.92 and 2.16 m/s.
const SETTLE_SPEED = 0.45
const SETTLE_MIN = 0.4
const SETTLE_MAX = 0.75

/** How long a settle covering `distance` metres of wrist travel should take. */
export function settleSeconds(distance: number): number {
  return Math.min(SETTLE_MAX, Math.max(SETTLE_MIN, distance / SETTLE_SPEED))
}

/**
 * The clip's weight `elapsed` seconds into a settle of `duration`.
 *
 * Smoothstep, so the derivative is zero at both ends: she leaves the clip's
 * last pose from a standstill and arrives at rest at a standstill. A linear
 * ramp is what this replaced.
 */
export function settleWeight(elapsed: number, duration: number): number {
  const p = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1
  return 1 - p * p * (3 - 2 * p)
}

export const MOTION_URL = (name: AvatarMotionName): string => `/avatar/animations/${name}.vrma`

// What the idle timer plays, IN THE ORDER IT PLAYS THEM. Every one reads as
// something a person would do unprompted while waiting; none needs a reason.
//
// This was a set until 2026-08-30 and is a sequence now, because picking at
// random repeated visibly: a single re-roll makes an immediate repeat unlikely
// and does nothing about seeing the same clip three times in five beats. Adding
// a clip here inserts it at that point in the rotation rather than adding a
// face to a die.
//
// It is also the order the composer's motion strip lists them in, which is why
// `dance` leads: it is the fixed opening (see OPENING_MOTION), and a strip whose
// first chip was not the clip she opens on would be describing a different
// rotation from the one that runs. Moving it here changes no behaviour — the
// opening is chosen by name, and the lap that follows covers the same clips
// either way.
export const IDLE_MOTIONS: readonly AvatarMotionName[] = [
  'dance',
  'peaceSign',
  'modelPose',
  'spin',
  'squat',
  'akimbo',
  'playFingers',
  'scratchHead',
  'idleLoop',
  'stretch',
]

/** The frame a placement composes to, or null where no avatar renders. */
export function motionFrame(placement: AvatarPlacement): MotionFrame | null {
  if (placement === 'hidden') return null
  return placement === 'column' ? 'column' : 'waistUp'
}

/**
 * How far the frame slides while `name` plays in `frame`. 0 for every clip that
 * fits the composition it is played in, which is all of them but one.
 *
 * Null on either argument means nothing is playing or nothing is rendered, and
 * both answer 0 — the resting composition. That is what returns the camera when
 * a clip ends or the visitor interrupts it.
 */
export function motionPan(name: AvatarMotionName | null, frame: MotionFrame | null): number {
  if (!name || !frame) return 0
  return AVATAR_MOTIONS[name].pan?.[frame] ?? 0
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

/**
 * The clip her first performance is always made of.
 *
 * Asked for by the owner on 2026-08-30: whatever else the rotation does, a
 * visitor's first sight of her performing is the dance.
 */
export const OPENING_MOTION: AvatarMotionName = 'dance'

/** Where the rotation has got to. Owned by the caller so this stays pure. */
export interface IdleRotation {
  /** Index into the placement's list for the clip to try NEXT. */
  cursor: number
  /** Whether the fixed opening has been dealt with, by playing or by expiring. */
  opened: boolean
}

export const IDLE_ROTATION_START: IdleRotation = { cursor: 0, opened: false }

/**
 * The next clip to play, and where that leaves the rotation.
 *
 * Split out of the engine's rAF loop so it can be tested at all: the engine
 * needs a WebGLRenderer in its first frames and jsdom cannot build one, so a
 * rule that lives inside the loop is a rule nothing checks.
 *
 * `ready` rather than a pre-filtered list, because the ten clips are fetched in
 * parallel after the entrance and arrive in whatever order the network returns
 * them. Filtering first would silently renumber the rotation every time another
 * clip landed, and the opening would become "the first clip to arrive" — which
 * is rarely the dance, since it is the largest of the ten.
 *
 * `openingExpired` bounds the wait for that opening. A clip that 404s or fails
 * to parse never reaches the cache, and waiting for it forever would trade a
 * missing dance for a character who never performs at all.
 *
 * Returns a null pick when nothing can play yet; the caller keeps its timer
 * running and asks again.
 */
export function nextIdleMotion(
  order: readonly AvatarMotionName[],
  ready: (name: AvatarMotionName) => boolean,
  state: IdleRotation,
  openingExpired = false,
): { pick: AvatarMotionName | null; next: IdleRotation } {
  if (order.length === 0) return { pick: null, next: state }

  if (!state.opened) {
    const at = order.indexOf(OPENING_MOTION)
    if (at >= 0 && ready(OPENING_MOTION)) {
      return { pick: OPENING_MOTION, next: { cursor: at + 1, opened: true } }
    }
    // Not yet, or not offered in this frame at all. Hold the rotation until the
    // wait runs out, then carry on from the top rather than stalling.
    if (at >= 0 && !openingExpired) return { pick: null, next: state }
    state = { cursor: 0, opened: true }
  }

  // Forward from the cursor, wrapping once. A clip still in flight is stepped
  // over rather than waited for, so a slow download costs its turn and not the
  // whole rotation; it comes back round next lap.
  for (let step = 0; step < order.length; step++) {
    const at = (state.cursor + step) % order.length
    if (ready(order[at])) {
      return { pick: order[at], next: { cursor: at + 1, opened: true } }
    }
  }
  return { pick: null, next: state }
}
