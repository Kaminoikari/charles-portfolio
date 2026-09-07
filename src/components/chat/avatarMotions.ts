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
import { AVATAR_FAMILIES, type AvatarFamilyId } from './avatarVariants'

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
 * A measured guard violation a clip is knowingly shipped with, on one family
 * of bodies: it lives in the family's clearance file (clearance/<family>.ts),
 * not here, because a violation is a property of the clip ON A BODY.
 *
 * Every field is the clip's OWN measured worst case, so the guard still holds
 * it to a number rather than waving it through. rigProbe.test.ts also fails a
 * waiver that is not needed, which stops one being left behind after a clip is
 * re-exported or replaced: a waiver has to earn its place every run.
 */
export interface MotionWaiver {
  /** Highest hand, in metres, when it rises above a frame's top edge. */
  handTop?: number
  /**
   * Highest crown, in metres on the frame's subject plane, when the hair
   * rises above a frame's top edge (clearance.ts crownBound). The column is
   * composed 20mm over her resting hair, so a standing clip that tilts her
   * head or swings a tail toward the camera puts translucent tips a few
   * millimetres past the edge; the 2026-08-20 sweep found four clips doing it
   * (spin, playFingers, scratchHead, idleLoop) and shipped them, and this is
   * that decision with a number on it. Five clips declared one until
   * 2026-09-07: those four, plus squat, whose rise the simulator sees past the
   * edge and that sweep measured 18mm inside it. Three do today — playFingers
   * and scratchHead took a derived +0.02 column pan instead, because the VRoid
   * body's own simulation put them higher than anyone had accepted.
   */
  crownTop?: number
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
 * re-centre the frame for all nine, the camera moves for the clips that need it
 * and moves back after: negative slides the frame DOWN, positive UP. Since
 * 2026-09-07 `playFingers` and `scratchHead` need a much smaller one too, for
 * hair rather than for hips.
 *
 * The engine eases it in and out (stepFramePan) and rigProbe.test.ts measures a
 * panning clip against its OWN panned frame — and fails a pan the clip does not
 * need, the same way a waiver has to earn its place.
 */
export type MotionPan = Partial<Record<MotionFrame, number>>

/**
 * Where in the range of pans that FIT a clip each frame takes its pan.
 *
 * The range itself is arithmetic on the clip's own extremes and the frame's
 * span, and clearance.panRange derives it per family. Which end of that range
 * to stand at is a composition decision, and it differs by frame because the
 * spare room does:
 *
 *   waistUp  centre. The span has room above her hair and below her hips, so
 *            the clip sits in the middle of what fits and both edges keep the
 *            same margin.
 *   column   the least lift that clears her hair. The column's spare room is
 *            all at the BOTTOM, so every millimetre the frame rises is a
 *            millimetre of her legs, and centring would spend 9cm of them.
 *
 * A second family re-derives the numbers; this stays, because it is about the
 * compositions rather than about a body.
 */
export const PAN_POLICY: Record<MotionFrame, 'centre' | 'least'> = {
  waistUp: 'centre',
  column: 'least',
}

/**
 * What is true of a clip wherever it plays. Anything measured on a body (its
 * crown, its waivers, how far it reaches) is per (body, clip) and lives in
 * the family's clearance file (src/components/chat/clearance/): before
 * 2026-09-06 `crown` and `waiver` sat here, and the comment on `dance` had to
 * explain that a second body "was not swept" because the numbers could not
 * say whose they were.
 */
export interface AvatarMotionDef {
  /**
   * Frames this motion has been measured to fit. Enforced in rigProbe.test.ts.
   * Nominally per body too (a taller body would need other frames), and the
   * first thing a second family has to re-derive; kept here with `pan` because
   * every family shares the compositions today.
   */
  placements: readonly MotionFrame[]
  /**
   * True when the point of the motion is a hand the viewer must read — a wave,
   * a peace sign. The probe then requires a palm actually turned to camera at
   * some point, which is the check the hand-authored doublePeace failed for its
   * whole life on the site.
   */
  showsPalm: boolean
  /**
   * Frame movement this clip needs to be seen whole. Absent means none.
   *
   * Declared here and DERIVED in clearance.panFor, which rigProbe.test.ts holds
   * this to: the range of pans that fit the clip's own crown and hips in the
   * frame's span, then PAN_POLICY. Declared as well as derived because the
   * producer needs a pan before the file it is derived from exists -- springsim
   * projects each crown through the frame's camera with this clip's pan, and
   * records which pan it used. So this is the number, and the derivation is
   * what keeps it honest when a clip is re-exported or a frame recomposed.
   *
   * A second family re-derives it by running panFor against its own clearance,
   * which until 2026-09-07 meant redoing the paragraph on `dance` by hand.
   */
  pan?: MotionPan
}

// Three clips of the pack are kept out on purpose, and the measurements that
// keep them out are in the clearance file's `excluded` (greeting,
// showFullBody, shoot), so nobody re-adds one on the assumption that an
// official clip must be safe. A clip is only listed here once the probe agrees
// it fits; adding one without running that check is how the hand-authored
// gestures got where they were.
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
  // 2026-09-07: gains a +0.02 column pan. It never needed one while the crown
  // came from the Milfy body. The number the guard reads for this clip in the
  // column goes 1.6053 (the 2026-08-20 browser sweep) to 1.6143, and waist-up
  // 1.5913 (the transfer) to 1.6220, so panFor's "smallest lift that clears"
  // answers 2cm. The alternative was to
  // widen its crownTop waiver from 1.606 to 1.6138 and keep the camera still,
  // which is the owner's call to make and not a derivation, so the derived pan
  // is what ships until that call is made.
  playFingers: { placements: ['waistUp', 'column'], pan: { column: 0.02 }, showsPalm: false },
  // A hand up to the back of her head. Closest approach to her face is 1.34,
  // clear of the ellipsoid, and the palm does turn to the viewer at 0.89.
  // Same as playFingers, and for the same reason: +0.02 in the column, or a
  // crownTop waiver widened from 1.607 to 1.6139 if the camera should stay put.
  scratchHead: { placements: ['waistUp', 'column'], pan: { column: 0.02 }, showsPalm: true },
  // A standing idle, and by far the quietest clip here: 0.337 to the viewer's
  // left, 0.035 to the right, hands never above y=0.768. It does stand 0.152 to
  // one side of centre, at both ends and so throughout, which the fade slides
  // her across on the way in and out: about 38px on the launcher canvas. The
  // waiver for that is in the clearance file.
  idleLoop: { placements: ['waistUp', 'column'], showsPalm: false },
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
  // What it still does is put a hand 51.0mm inside her head for 34 of the 1608
  // frames the engine draws, around t=8.22s — ellipsoid 0.1975, ten times the
  // 4.9mm that kept `shoot` out. That figure has got worse twice, both times
  // because the measurement improved: on the distal joint alone it read
  // 26.8mm, on the whole skinned hand 38.9mm, and on the whole hand sampled at
  // the rate the engine draws (rather than at the clip's 30fps keys) 51.0mm.
  // The waiver for it, and for the two below, is in the clearance file.
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
  // 0.8782, and the hop throws her hair to 1.7276 on the VRoid body — 175mm
  // above where it hangs when she stands still (the clearance file's crownSeen;
  // the spring solver reads the same hop on the Milfy body's twintails as
  // 89mm, its clips.dance.crownY). Against the two compositions:
  //
  //   waist-up  hips 15mm below the bottom edge, for 14 of 805 sampled frames
  //             from t=7.77s. This is what took the clip out of the waist-up
  //             pool on 2026-08-20 and off the launcher with it.
  //   column    119mm above the top edge at t=12.05, and above it at all on 98
  //             of 1589 rendered frames. That is the 2026-08-20 sweep, which
  //             is why its numbers sit 6mm under the crown recorded. What is
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
  // 0.7525 at the bottom, crown 1.7276 at the top, 0.975m apart. Since
  // 2026-09-07 that derivation is clearance.panFor rather than this paragraph;
  // what follows is why each was what it was when it was written by hand, and
  // the note at the end of this comment is why panFor now answers a centimetre
  // higher in both.
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
  //
  // The crown was MEASURED ON THE VRoid BODIES in the browser. Since 2026-09-06
  // the family's clearance file also carries what three-vrm's spring solver
  // reads on the Milfy body (scripts/avatar/springsim.ts), and rigProbe.test.ts
  // holds every clip's crown, browser or derived, whichever is higher, to
  // its frames: the swing of Milfy's twin tails, a different spring chain,
  // is simulated rather than argued about.
  //
  // 2026-09-07: both numbers moved a centimetre, and the reason is that the
  // crown they are solved against went up. The VRoid bodies (pink and the base
  // sample, one geometry between them) were simulated in their own right for
  // the first time -- springsim could not run on them until deriveManifest --
  // and they throw this clip's hair higher than anything the guard had for it
  // before: the column crown goes 1.7276 -> 1.7389 (+11.3mm) and the waist-up
  // 1.7133 -> 1.7244 (+11.1mm), both of those previous numbers being the
  // browser sweep rather than the Milfy transfer, which read lower still.
  // clearance.panFor re-derives -0.07 and +0.14 from that, and rigProbe.test.ts
  // holds these declarations to what it derives.
  dance: {
    placements: ['waistUp', 'column'],
    showsPalm: true,
    pan: { waistUp: -0.07, column: 0.14 },
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
 * Motions cleared for a placement ON A BODY OF THIS FAMILY. Empty when nothing
 * renders there.
 *
 * Two filters, and they answer different questions. `placements` is a property
 * of the CLIP: which compositions it was authored to sit in, true wherever it
 * plays. The family's `excluded` is a property of the BODY: a clip the pack
 * ships but this skeleton cannot wear, because retargeting it there puts a
 * hand through a face or a hip out of frame. One family excludes nothing from
 * this pool today — its three exclusions are clips that never entered it — and
 * avatarVariants.test.ts holds every family to having a measurement or a
 * written reason for all ten, so a second rig cannot quietly offer a clip
 * nobody checked on it.
 *
 * The family is required rather than defaulted. A default would let the wiring
 * that carries the loaded body's family to this call be deleted with every
 * test still green.
 *
 * There is deliberately no viewport check here. Between 2026-08-19 and the same
 * evening this filtered a column clip out when the canvas was too narrow to show
 * its whole reach; then the owner asked for her BODY to hug the panel's right
 * edge and said a clipped gesture is fine. Her body's visibility is now a
 * property of avatarColumnRightInset, and what a clip has to fit is the canvas,
 * which rigProbe.test.ts checks before it can be listed above.
 */
export function motionsFor(placement: AvatarPlacement, family: AvatarFamilyId): readonly AvatarMotionName[] {
  const frame = motionFrame(placement)
  if (!frame) return []
  const excluded = AVATAR_FAMILIES[family].excluded
  return IDLE_MOTIONS.filter(
    (name) => AVATAR_MOTIONS[name].placements.includes(frame) && !(name in excluded),
  )
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
 * is rarely the dance: at 730KB it is the third largest of the ten, behind
 * peaceSign's 1,336KB and squat's 772KB (decimal, as the files measure
 * 729,512 / 1,335,704 / 771,944 bytes), and it is also the longest to play.
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
