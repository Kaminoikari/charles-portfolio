// Chat-state → avatar-behaviour mapping for the 3D avatar guide, kept as pure
// functions so the rules are testable without WebGL or React.

import type { ChatStatus } from './useChatStream'
import type { ChatMode } from './useChatMode'

// What the avatar body is doing. The 3D engine consumes this; nothing else does.
//  idle       head sweeps left/right — nobody is talking
//  listening  head tilts up/down — the visitor is composing a question
//  speaking   viseme mouth loop + answering tint — retrieval and streaming
export type AvatarMode = 'idle' | 'listening' | 'speaking'

// `input` is the raw field value, NOT trimmed: during IME composition the field
// briefly holds marks or spaces, and the visitor is very much "typing" then.
export function deriveAvatarMode(input: string, status: ChatStatus): AvatarMode {
  if (status === 'streaming') return 'speaking'
  if (input.length > 0) return 'listening'
  return 'idle'
}

// Where the avatar stands for a given widget mode and viewport width.
// 'hidden' means display:none, never unmount: the wrapper stays mounted so a
// 5.5MB VRM is never re-fetched or re-parsed for a placement change (only a
// look swap, which the visitor asks for, loads a body after the first).
//  launcher      stowed panel — the character IS the launcher button
//  beside-panel  docked panel on a viewport big enough for her to read
//                beside it, side by side
//  column        fullscreen — she stands full height in a column of her own on
//                the right, at whatever size the window can pay for
//  hidden        fullscreen on a phone, or a docked panel covering one
export type AvatarPlacement = 'launcher' | 'beside-panel' | 'column' | 'hidden'

// `md` (≥768px) is the pipeline rail's own breakpoint (the aside is
// max-md:hidden) and doubles as the floor for the column: below it the panel
// is an edge-to-edge phone takeover with no room to stand anyone beside the
// text. `fitsBeside` gates the docked side-by-side layout separately, and is
// besidePanelFits() rather than a width: see it for why the docked question
// needs both axes when the column's needs only one.
//
// There is deliberately no height gate and no narrow-window fallback. Both used
// to exist because she stood at the FOOT of the pipeline rail, where a short or
// narrow window put her on top of the trace; in a column of her own she has
// nothing to collide with, and avatarColumnBox() answers "too small" by
// shrinking her rather than by moving her somewhere else.
export function avatarPlacement(
  mode: ChatMode,
  fitsBeside: boolean,
  md: boolean,
): AvatarPlacement {
  if (mode === 'fullscreen') return md ? 'column' : 'hidden'
  if (mode === 'minimised') return 'launcher'
  return fitsBeside ? 'beside-panel' : 'hidden'
}

// ---- head aim -------------------------------------------------------------
// Where she is looking for a given mode, in radians, before gestures are added
// on top. Each mode is its own slow sine pair, and they share one clock, so the
// value STEPS the frame the mode changes. That step is what HEAD_AIM_SMOOTHING
// is for; the engine runs this through a one-pole filter rather than using it
// directly.
//
// Idle used to sweep ±0.42 on a 5.2s period, which at the head bone is ±15.6°
// swinging back and forth without pause. The owner reported it on 2026-08-15 as
// her never keeping still, and it also stole the effect from `glance`, the idle
// act whose whole job is looking around. Idle now holds the viewer's eye with a
// 19s ±0.08 drift (±3° at the bone), and looking away is something she DOES
// rather than something she is always doing.
export function headAim(mode: AvatarMode, t: number): { yaw: number; pitch: number } {
  if (mode === 'idle') {
    return {
      yaw: Math.sin(t * ((2 * Math.PI) / 19)) * 0.08,
      pitch: Math.sin(t * ((2 * Math.PI) / 9.1)) * 0.05,
    }
  }
  if (mode === 'listening') {
    return {
      yaw: Math.sin(t * ((2 * Math.PI) / 7.0)) * 0.06,
      pitch: Math.sin(t * ((2 * Math.PI) / 1.6)) * 0.16 - 0.04,
    }
  }
  return {
    yaw: Math.sin(t * ((2 * Math.PI) / 6.5)) * 0.07,
    pitch: Math.sin(t * ((2 * Math.PI) / 4.3)) * 0.03,
  }
}

// One-pole rate for the filter above, per second. 6 settles a mode change in
// ~0.4s, so the end of an answer reads as a turn of the head. The cost is paid
// by the sinusoids themselves, and it scales with their speed: the 19s idle
// drift is untouched at any useful precision, while the fastest one (the 1.6s
// listening nod) keeps 85% and lags 0.133s. At this size that worst case is
// 0.024rad of aim, under 1° at the head bone.
export const HEAD_AIM_SMOOTHING = 6

// One filter step, per axis. It lives here rather than inline in the engine so
// the tests drive the same code the engine does: a test that re-implements the
// filter would keep passing with the engine's call removed. Scalar (not a
// {yaw,pitch} pair) to keep the animation loop allocation-free.
export function stepHeadAim(prev: number, target: number, dt: number): number {
  return prev + (target - prev) * Math.min(1, dt * HEAD_AIM_SMOOTHING)
}

// The same one-pole filter, for the camera rather than the head: a clip that
// declares a pan (avatarMotions' MotionPan) slides the frame while it plays and
// slides it back afterwards, and this is the trip between the two.
//
// Slow on purpose, and it can afford to be. The clip that needs it is 26.8s long
// and does not reach the edge it is being moved for until t=7.77s, so nothing
// here is racing a deadline; what it is avoiding is a camera that appears to
// snap. At 1.6 and 60fps the move is 80% done in a second, is 0.6mm short of a
// -0.08 pan at three seconds, and snaps onto it (the epsilon below) at 3.7s.
export const FRAME_PAN_SMOOTHING = 1.6
// Below this the filter's asymptote is called arrived. A one-pole never reaches
// its target, and a camera that is 0.2mm out forever keeps rewriting its own
// matrix every frame for a difference of 0.05px.
const FRAME_PAN_EPSILON = 0.0002

export function stepFramePan(prev: number, target: number, dt: number): number {
  const next = prev + (target - prev) * Math.min(1, dt * FRAME_PAN_SMOOTHING)
  return Math.abs(target - next) < FRAME_PAN_EPSILON ? target : next
}

// ---- emotions ---------------------------------------------------------------
// What the face can do, and which VRM expression channels carry each one. The
// model ships four standard presets (three-vrm normalises VRM0's joy/angry/
// sorrow/fun to happy/angry/sad/relaxed) plus two CUSTOM groups whose names
// survive as-is, capitals included: 'Surprised' and 'Extra' (the >< face).
// That casing is load-bearing — the engine's availability gate compares these
// strings against the model's expression list, and lower-casing 'Surprised'
// is why she never once looked surprised in production before 2026-08-15.
//
// The last three are composites, added from the owner's expression-sheet
// reference (しいたけ目・怒り・青ざめ・なごみ目 — 怒り is the plain angry
// preset):
//  excited  the model's own >< face
//  nagomi   content closed-eye smile: relaxed curves the lids, blink closes them
//  pale     dread: sad brows plus a bluish face tint the engine layers on the
//           face materials, because no blendshape can recolour skin
export type EmotionName =
  | 'happy'
  | 'angry'
  | 'sad'
  | 'relaxed'
  | 'surprised'
  | 'excited'
  | 'nagomi'
  | 'pale'

export interface EmotionRecipe {
  // [expression channel, share of the emotion's weight it receives]
  channels: ReadonlyArray<readonly [string, number]>
  // The engine tints the face materials toward FACE_PALE_TINT by this weight.
  paleTint?: boolean
  // The engine floats the manga anger vein (💢) beside her head, opacity
  // riding the emotion's weight — the blendshape only changes the face, and
  // the owner's reference sheet draws 怒り with the mark.
  angerMark?: boolean
  // Write the channels at their full share as soon as the emotion is showing
  // at all, instead of scaling them by its weight. For a morph that only
  // renders correctly at 1 (see excited), every intermediate value is a broken
  // frame, so a snap is the better of the two artefacts.
  snapToFull?: boolean
}

// Where a snapToFull recipe flips on. It sits below the engine's 0.45 speech
// cap on purpose: `done` fires while she is still talking, and a threshold
// above the cap would mean the >< face never appears on the one cue that
// uses it.
export const EMOTION_SNAP_THRESHOLD = 0.25

export const EMOTION_RECIPES: Record<EmotionName, EmotionRecipe> = {
  happy: { channels: [['happy', 1]] },
  angry: { channels: [['angry', 1]], angerMark: true },
  sad: { channels: [['sad', 1]] },
  relaxed: { channels: [['relaxed', 1]] },
  surprised: { channels: [['Surprised', 1]] },
  // The model's own >< face, at FULL weight only: the X lashes rest inside the
  // head and the morph slides them out, so any partial weight leaves them
  // half-clipped by the face (0.85–0.93 render as black dots, 0.75 and below
  // as plain closed eyes). Verified across five weights on 2026-08-15; the
  // owner chose the authored 1.0 over a weightless closed-eye smile.
  excited: { channels: [['Extra', 1]], snapToFull: true },
  nagomi: {
    channels: [
      ['relaxed', 1],
      ['blink', 1],
    ],
  },
  // Sad at partial weight: full sorrow reads as about to cry, and the blue
  // carries most of the 青ざめ.
  pale: { channels: [['sad', 0.7]], paleTint: true },
}

// Multiplied over the face materials' base colour at full pale weight.
export const FACE_PALE_TINT: readonly [number, number, number] = [0.62, 0.74, 0.95]

// The face a head pat earns. Two places perform one pat: the pointer detector
// in AvatarGuide, which must react even when no sound can follow, and the
// giggle cue in ChatWidget, which re-applies its cue performance for every
// line it starts. They run back to back on the same pat, so both read THIS —
// otherwise tuning the pat in one of them is silently overwritten by the other.
export const PAT_EMOTION: Record<
  'happy' | 'annoyed',
  readonly [EmotionName, number, number]
> = {
  happy: ['happy', 0.9, 1.8],
  // Third pat inside 20s: petting a cat past its patience.
  annoyed: ['angry', 0.9, 1.6],
}

// What each of an emotion's channels should be set to at a displayed weight.
// The engine writes exactly this, so a test of this function tests what the
// face actually does — including the snapToFull rule, whose whole point is to
// survive weights it never chose (the 0.45 speech cap, a cue asking for 0.85).
export function emotionChannelValues(
  name: EmotionName,
  w: number,
): Array<readonly [string, number]> {
  const recipe = EMOTION_RECIPES[name]
  const scale = recipe.snapToFull ? (w > EMOTION_SNAP_THRESHOLD ? 1 : 0) : w
  return recipe.channels.map(([ch, share]) => [ch, scale * share] as const)
}

// ---- camera framing -------------------------------------------------------
// Lives here rather than in the engine so the React shell can read it without
// pulling three.js into the main bundle, and so the invariant below is unit
// testable without WebGL.
//
// Her on-screen size is `2 · distance · tan(fov/2) / canvasHeight` metres per
// pixel, so a taller canvas can be spent two ways, and both are in use:
//  · leave the framing alone and the same crop stretches over more pixels, so
//    she scales up — what the docked panel does, on purpose. Its box is 759.6px
//    tall against the launcher's 280px, so she renders 2.71× larger there,
//    waist-up either way (avatarDockedBox derives that height from the panel's;
//    it is not a number anyone wrote down);
//  · re-compose the framing for the taller box and choose what the extra height
//    buys — the fullscreen column spends it on scale and on her legs down to
//    the knee, rather than on air above her head.
// (A third way, dollying back to hold her size constant while showing more of
// her, was the old fullscreen rail's. It went with the rail on 2026-08-14.)
export const AVATAR_FOV = 27
// The camera sits this far above the point it looks at, for a slight tilt.
export const AVATAR_CAMERA_TILT = 0.1

export interface AvatarFraming {
  distance: number
  lookAtY: number
}

// Waist-up, composed for the launcher canvas's 280px HEIGHT: top edge at world
// y=1.872 (her hair top is 1.582), bottom at y=0.768, upper thigh. Canvas width
// does not enter into it — see avatarViewHalfWidth.
//
// lookAtY was 1.17 until 2026-08-20, putting the top edge at 1.722. `stretch`
// puts a hand at 1.809, so it was cut at the top on the very canvas the owner
// asked to see it whole on.
//
// Height is not free the way width was. The visible span is 2·distance·tan(fov/2)
// — 1.104m here — and distance also sets how large she renders, so the span
// cannot grow without shrinking her or growing the canvas. What CAN move is
// where that fixed span sits, which is this number, and every 1mm the top edge
// rises is 1mm the bottom edge rises with it.
//
// Growing the canvas is what 2026-08-21 did instead, and it is a separate lever
// from this one: avatarDockedBox scales the docked box so that the air THIS
// number reserves lands above the panel rather than inside it. It does not
// relax the bounds below — the pool they define is in metres, and a bigger
// canvas spends the same span over more pixels.
//
// So it is chosen, not guessed. Two edges bound the waist-up pool:
//
//   top    ≥ 1.8091  `stretch`'s raised hand, SKIN and not bone: its highest
//                    joint is a thumb tip at 1.7971 and the rendered hand runs
//                    SKIN_ABOVE_JOINT past it. Measuring the joint alone is what
//                    put the first attempt at this fix 4px short.
//   bottom ≤ 0.8225  `peaceSign`'s hips, the lowest of the clips composed AS
//                    THEY STAND. `dance` reaches 0.7525 and `squat` 0.660, and
//                    neither bounds this number: `dance` moves the camera rather
//                    than this (avatarMotions' MotionPan) and is bounded by its
//                    own panned frame, and `squat` is simply not offered here.
//
// That leaves the window 1.2569 ≤ lookAtY ≤ 1.3747, and 1.32 is its centre to
// the nearest 10mm: 63mm of clearance above her hand, 55mm below her hips.
// Re-derive it, do not nudge it, if the pool changes.
//
// The bill is paid at the bottom and in air. The bottom cut rises from 0.618 to
// 0.768, so the docked canvas shows less of her thighs, and `squat` (hips to
// 0.660) plays in the fullscreen column only. And the top edge now sits 0.290m
// above her hair, 74px of empty canvas above her head at rest where there used
// to be 35px. That air is the raised hand's room; a frame cannot hold a gesture
// 0.23m above her head without reserving the space.
export const AVATAR_FRAMING_DEFAULT: AvatarFraming = { distance: 2.3, lookAtY: 1.32 }
// The fullscreen column's framing: head to knee, composed tight. The default
// framing leaves 0.23m of air above her hair, which reads as a big empty gap
// once the canvas is 800px tall, so this pulls the top edge down to 1.602 —
// 0.02m over her hair at 1.582, about 40px of clearance on screen and as close
// as her hair ornaments allow. The bottom edge stays at her knee (0.43), the
// same cut the old rail made, so the tightening is all headroom.
//
// The view is 1.172m tall against the default's 1.104m, which is why she comes
// out 10% larger on the same canvas — and why the column is proportionally
// WIDER than the rail was: her arm room is a fixed 0.674m spread over fewer
// metres of height. That is where AVATAR_COLUMN_ASPECT comes from.
//
// Composed for a figure that stands still, which is what nine of the ten clips
// do. `dance` does not: its hop throws her hair to 1.7276, 126mm past this top
// edge, so it pans this frame up while it plays (avatarMotions' MotionPan).
//
// The 0.02m of headroom above is measured to the hair's BIND POSE. On the render
// the spring bones settle it 29mm lower when she stands still (49mm of clearance,
// 34px on an 807px canvas) and throw it far higher when she moves, which is why a
// clip's real headroom is a rendered measurement and not this arithmetic.
export const AVATAR_FRAMING_COLUMN: AvatarFraming = { distance: 2.441, lookAtY: 1.016 }

// ---- arm rest pose ---------------------------------------------------------
// The engine pins her arms here whenever nothing else is driving them: VRM0's
// rest pose is a T-pose, and these Z rotations bring the arms down to her sides.
//
// This is all that is left of a much larger block. Until 2026-08-19 this file
// also carried a forward-kinematic model of her arm — reach, elbow span, a peak
// pose per gesture, and the widest point of every travel — because the arm
// gestures were hand-authored joint angles and the canvas had to be proven wide
// enough to contain them. Motion capture replaced those gestures, and the
// containment proof moved with them: rigProbe.ts poses the REAL skeleton out of
// the .vrm and rigProbe.test.ts measures each clip against each frame, which
// covers what this model covered plus everything it could not see (a hand
// inside her head, a palm turned away, a stance that sinks).
export const ARM_REST_UPPER_Z = 1.15
export const ARM_REST_FORE_Z = 0.25

// How far into a gesture the body is, from 0 at rest to 1 at the full pose.
// `dur` is the movement time, split evenly between the rise and the fall, and
// `hold` parks the body at the full pose in between. A named pose needs that
// plateau: the pure sine the beats were tuned with touches 1 for a single
// frame, so a peace sign appears to bounce off her temple instead of being
// held there. A hold of 0 reproduces that sine exactly, which is why the
// ambient beats can keep it.
export function gestureEnvelope(t: number, dur: number, hold: number): number {
  const ramp = dur / 2
  if (t < ramp) return Math.sin((t / ramp) * (Math.PI / 2))
  if (t < ramp + hold) return 1
  const falling = (dur + hold - t) / ramp
  return Math.sin(Math.max(0, falling) * (Math.PI / 2))
}

// Canvas boxes per placement.
//
// The widths are set by how much room her arms need, not by how big she should
// look. They were sized against the forward-kinematic reach model this file used
// to carry; that model is gone (see the note above ARM_REST_UPPER_Z) and the
// containment proof now lives in rigProbe.test.ts, which measures every shipped
// clip against these same boxes. Because the FOV is vertical, width only adds
// horizontal view: the same character at the same size with more room beside
// her. The old widths showed ±0.355m, so a stretch lost its last 14-17px and a
// wave its last 10-12px. These show ±AVATAR_ARM_ROOM.
//
// That figure was ±0.674m until 2026-08-20, when the paragraph standing here
// hedged in prose about a gap the code was not measuring: rigProbe read the
// distal finger JOINT, and this model's fingertip is skinned out to an `_end`
// leaf 20.4mm past it. The prose was right and useless — `spin` really did peak
// 0.5mm inside the edge, `dance` really did overrun by 23mm, and the suite was
// green throughout. The probe now walks to the tip, and the boxes were widened
// to 0.7415 so the pool clears with room: `dance` 44mm, `spin` 68mm.
//
// Still not modelled: hair, which the spring bones throw outward at runtime.
// If clipping is ever reported again with the fingertips comfortably inside,
// that is the next thing to measure.
//
// The extra area is transparent, so it costs page space nowhere; the launcher's
// click target and the speech bubble beside her both had to move to match, and
// each is pinned to its constant by a test in avatarMode.test.ts.
//
// The docked box is not here at all any more, for the same reason the column's
// is not: it answers to the viewport as well as to the panel. See
// avatarDockedBox().
export const AVATAR_CANVAS_LAUNCHER = { w: 376, h: 280 }

// Canvas width per unit height, shared by the launcher and the docked box. It
// is the launcher's proportions and not a number of its own, because the two
// share AVATAR_FRAMING_DEFAULT: the fov is vertical, so this ratio IS her arm
// room (avatarViewHalfWidth), and a docked box off this ratio would hand her a
// different reach in the two placements. rigProbe.test.ts measures every clip
// against the launcher box on that assumption.
export const AVATAR_WAISTUP_ASPECT = AVATAR_CANVAS_LAUNCHER.w / AVATAR_CANVAS_LAUNCHER.h

// The docked canvas hangs to the LEFT of the panel, from a fixed right offset:
// the panel's own 400px plus a 36px gutter. It is wider than the gap left of
// the panel on a narrow desktop window: the 2026-08-15 widening put 226px of a
// 752px canvas off the left edge at 900px, 26px of it her shoulder, and the box
// has only grown since. She scales down to fit instead, continuously rather than
// at a breakpoint, which is the same call the owner made for the column on
// 2026-08-14: a smaller Mika, never a cut one.
export const CHAT_BESIDE_PANEL_RIGHT = 436

// Both the panel and her canvas sit on `bottom-5`, which is what lines their
// bottom edges up, and that shared edge is the whole reason her figure is the
// panel's height. So the two must be one number: move the panel off bottom-5
// and leave this behind and her hair lands off the panel's top edge by the
// difference. Nothing in production reads the px value any more — the class is
// what positions both boxes — and it stays because the tests measure her hair
// top with it, which is the only place that mismatch would show.
//
// The class is here for the same reason every other pair in this file is: the
// px number cannot be interpolated into a Tailwind literal, so it is written
// twice and a test converts the class back through Tailwind's 4px spacing unit
// (bottom-5 = 5 × 0.25rem = 20px). ChatWidget must CONSUME the class rather
// than spell its own `bottom-5`, which a render test checks on both elements.
export const CHAT_DOCK_BOTTOM = 20
export const CHAT_DOCK_BOTTOM_CLASS = 'bottom-5'

// The layer her docked canvas paints on, and it must stay BELOW the nav's
// (Nav.tsx's NAV_Z_CLASS). Both were z-50 until 2026-08-21, which was harmless
// while her canvas was the panel's height and started 188px down a 768px
// window. Now it starts at 0 there, `stretch` puts a hand 43px below its top,
// and the nav bar is 77px tall: at equal z-indexes the later element in the DOM
// wins, the widget mounts after the nav, so that hand was painted over the nav
// links. Below the nav it is occluded instead, which costs her nothing — her
// head is 26% down the canvas and never reaches this band.
//
// 45 rather than 40, so no layer in the site ties with hers: the nav is 50, the
// skills labels are UniverseSection's 40, and a tie is settled by DOM order,
// which is exactly the invisible rule that put a hand on top of the nav in the
// first place.
export const AVATAR_DOCKED_Z_CLASS = 'z-[45]'
// Tailwind's spacing scale: one step is 0.25rem, and the root font size is the
// browser default 16px, so a step is 4px. Only the test does this arithmetic.
export const TAILWIND_SPACING_PX = 4

// Her body's box inside the waist-up canvas, as fractions of the canvas width,
// read off the render at rest: alpha over 24 on a 438-sample sweep, with the
// gesture frames left in and the quartiles taken. Everything outside it is
// transparent margin her arms swing into.
//
// Two edges rather than a width and an assumption of symmetry. She is NOT
// centred — the measured edges are 0.3049 and 0.6863, a middle of 0.496 — and
// assuming she was is what ran 3.3px of her left sleeve off the screen on a
// portrait tablet, where the scale binds hardest. Left is rounded DOWN from
// that measurement and right UP, so ordinary resting sway stays inside the box;
// the stored box's own middle is 0.495, which is the number the test pins.
//
// The launcher and the docked placement share the waist-up frame, so they share
// these: the launcher places its speech bubble against her left edge,
// besidePanelScale keeps exactly the width on screen, and avatarDockedRight
// spends everything right of BODY_RIGHT. The launcher's click inset is NOT one
// of them — it is a percentage pinned to its own px bounds by a test, and
// wiring it here would be a refactor this change has no reason to make.
//
// The width was named for the launcher until 2026-08-22, while the docked scale
// used a separate 0.9096 that was never her body at all.
export const AVATAR_WAISTUP_BODY_LEFT = 0.3
export const AVATAR_WAISTUP_BODY_RIGHT = 0.69
export const AVATAR_WAISTUP_BODY_FRACTION =
  AVATAR_WAISTUP_BODY_RIGHT - AVATAR_WAISTUP_BODY_LEFT

// How much of the docked canvas has to stay on screen, and it is her body:
// AVATAR_WAISTUP_BODY_FRACTION, the same silhouette the launcher's speech
// bubble is placed against, because both placements use the same waist-up
// frame. The rest of the canvas is transparent gesture margin and may run off
// the left edge, which is the trade the owner accepted on 2026-08-19.
//
// This was 0.9096 until 2026-08-22, and that number was the bug rather than the
// policy: the comment here said "what the scale protects is her BODY" while the
// arithmetic protected 0.91 of the canvas, of which only 0.39 is her. Measured
// off the render, her silhouette at rest spans 0.305 to 0.686 of the width, so
// the old number defended 0.21 of empty air on her left and 0.21 on her right,
// and paid for it by shrinking her on every window narrow enough for this to
// bind. The body-on-screen test has always modelled it the correct way, which
// is why it stayed green through the whole mistake.
export function besidePanelScale(vw: number, canvasW: number): number {
  const body = canvasW * AVATAR_WAISTUP_BODY_FRACTION
  // A zero-width canvas has no body to keep on screen, and dividing by it would
  // hand the wrapper a NaN transform. Full size is the no-op answer.
  if (body <= 0) return 1
  return Math.min(1, Math.max(0, (vw - CHAT_BESIDE_PANEL_RIGHT) / body))
}

// Everything right of AVATAR_WAISTUP_BODY_RIGHT is transparent, and until
// 2026-08-22 that strip was what stood between her and the panel: 0.31 of a
// 1020px canvas is 316px, so on a desktop she sat 332px from a panel the layout
// claims to put 16px from her. This spends the strip instead of displaying it,
// exactly as avatarColumnRightInset already does for the fullscreen column.
// What ends up over the panel is transparent margin, and a gesture reaching
// into it is drawn BEHIND the panel (z-[45] against z-50), so it is hidden
// rather than painted on the conversation.
//
// The docked wrapper's `right`, in px, for a canvas of this width at this
// scale. The 16px gap she ends up with is the one already inside
// CHAT_BESIDE_PANEL_RIGHT — spending the strip is what finally measures that
// gap to HER rather than to the edge of her canvas. It goes negative on a wide
// canvas, which is fine: the overhang is transparent, takes no pointer events,
// and a fixed box hanging right adds no scroll.
export function avatarDockedRight(canvasW: number, scale: number): number {
  return CHAT_BESIDE_PANEL_RIGHT - (1 - AVATAR_WAISTUP_BODY_RIGHT) * canvasW * scale
}

// The docked panel's height: the Tailwind literal ChatWidget applies, and the
// same rule as two numbers for avatarDockedBox to compute with. Tailwind's JIT
// will not take an interpolated value, so the three spellings are held together
// by a test that parses the class back.
//
// Both halves reach her box, and which one wins is which one the panel itself
// is on: the vh branch below 700px of height, the 560px literal above it. That
// is new as of 2026-08-22. Until then a screen-top cap sat in front of them and
// won every short window, so the vh half was dead code in her box and this note
// said so.
export const CHAT_PANEL_HEIGHT_CLASS = 'h-[min(560px,80vh)]'
export const CHAT_PANEL_HEIGHT_PX = 560
export const CHAT_PANEL_HEIGHT_VH = 80

// The panel's rendered height, from the class above. Two things measure
// themselves against it — her box and the gate that decides whether she stands
// beside it at all — and they must not be able to disagree.
function chatPanelHeight(vh: number): number {
  return Math.min(CHAT_PANEL_HEIGHT_PX, (vh * CHAT_PANEL_HEIGHT_VH) / 100)
}

// Fraction of the canvas that sits above her hair, from the framing itself —
// re-dolly the waist-up frame and this follows without being edited. Same rule:
// the box and the gate both need it and must read the one definition.
function dockedHeadroom(): number {
  const span = avatarViewSpan(AVATAR_FRAMING_DEFAULT)
  return (span.top - AVATAR_HEAD_TOP_Y) / (span.top - span.bottom)
}

// Her box beside the docked panel.
//
// Until 2026-08-21 this was the panel's own `min(560px,80vh)`, and the CANVAS
// did stand exactly as tall as the panel — but she did not. The waist-up
// framing puts the top edge at world y=1.872 against a hair top of 1.582, so
// the top 26.3% of the canvas is empty air, held for `stretch`'s raised hand
// (1.809). On the 560px canvas that was 147px of nothing above her head, so her
// hair top to the shared bottom edge measured 413px beside a 560px panel, which
// is what the owner read as her not being the same height as the window.
//
// Dollying in would have filled it by re-cropping — and cut the raised hand off
// at the top, which is the one thing the framing above was rewritten to stop. So
// the canvas grows instead: at h = panelH / (1 − headroom) the air above her
// head is exactly the panel's overhang, her hair top lands on the panel's top
// edge, and her figure fills the panel's height. Nothing about the composition
// moves — same distance, same lookAtY, same aspect — so every clip rigProbe has
// cleared stays cleared, and she simply renders 1.36× larger.
//
// Width follows, because arm room is fixed in METRES: a 560px figure needs a
// 1020px canvas. What that costs in window width is decided by besidePanelScale,
// and only her BODY has to fit: 0.39 of 1020px is 398px, so she is full size
// from 834px of window up. The same arithmetic asked for 1364px until
// 2026-08-22, when the scale was still dividing by 0.9096 of the canvas instead
// of by her.
//
// The bill is headroom, and on a short viewport it is paid off the top of the
// screen. The canvas is taller than the panel and grows upward from the shared
// bottom edge, so under ~780px of height it runs past y=0. Until 2026-08-22 it
// was capped there and she gave up height instead. Measured on a 16 Pro held
// sideways (874x402), that cap cost her 12.4%: with the divisor above fixed she
// reaches 0.876 of the panel with it and 1.0 without. Removing it while the
// divisor was still wrong would have bought nothing at all — 0.822 either way,
// because a bound scale decides her height from width whatever the box is. Both
// had to go. The cap is gone: what overhangs is the empty air above her hair,
// and a raised hand reaching into it is clipped by the screen edge. That is the
// same trade as a gesture running off the left edge, and the owner asked for it
// in the same sentence.
//
// Her figure is never the thing that overhangs. Her hair top lands on the
// panel's top edge by construction, and the panel is on screen at every height:
// at 80vh the top edge sits at 0.2·vh − 20, positive for any window over 100px
// tall.
export function avatarDockedBox(vh: number): { w: number; h: number } {
  const h = Math.max(0, chatPanelHeight(vh) / (1 - dockedHeadroom()))
  return { w: h * AVATAR_WAISTUP_ASPECT, h }
}

// How tall her FIGURE stands as a fraction of the panel it is standing next to.
// This is what the docked gate is really asking, and it needs both axes: once
// besidePanelScale binds, her figure's height on screen is decided by WIDTH
// alone (it normalises to (vw − 436) / her body fraction whatever the box was),
// while the panel it is read against keeps growing with HEIGHT until it hits
// 560px. A width-only gate therefore answers a two-axis
// question with one number, and where you set that number depends on the height
// you happened to test at.
//
// That is not theoretical: this gate WAS a bare width, and lowering it to 700
// for a landscape phone (852x393, where she reaches 0.80 of the panel) also let
// in every portrait tablet above 700px, where the same width buys far less
// against a full-height panel — 0.33 at an iPad mini's 744x1133. That is below
// the 0.46 of a landscape SE, which is the size we had already judged reads as
// a smudge rather than as a character.
export function besidePanelFigureRatio(vw: number, vh: number): number {
  const panelH = chatPanelHeight(vh)
  // A zero-height panel has no height to be a fraction of. Nothing is standing
  // beside it either, so the gate below should read this as "no".
  if (panelH <= 0) return 0
  const box = avatarDockedBox(vh)
  return (box.h * (1 - dockedHeadroom()) * besidePanelScale(vw, box.w)) / panelH
}

// The floor is a judgment, and it says half. Below half the panel's height she
// stops reading as someone standing next to the conversation and starts reading
// as decoration, which is the call the owner made when a landscape SE was the
// only device near the line.
//
// It used to be derived from what the placement had shipped, and that anchor is
// gone: what shipped was besidePanelScale defending 0.9096 of a canvas that is
// 0.39 her, so every window narrow enough for it to bind rendered her smaller
// than the geometry required. Deriving a floor from a bug preserves the bug.
//
// What the floor decides now is only the narrow end, because the fix put every
// landscape phone at the full panel height: 543px of width at 375 tall, 548 at
// 393, 635 at a desktop height. A phone held upright is out by a wider margin
// than any threshold in this range would move — the panel alone is 400px, so
// the scale reaches zero before this is consulted.
export const BESIDE_PANEL_MIN_FIGURE_RATIO = 0.5

export function besidePanelFits(vw: number, vh: number): boolean {
  return besidePanelFigureRatio(vw, vh) >= BESIDE_PANEL_MIN_FIGURE_RATIO
}

// ---- the fullscreen column ------------------------------------------------
// Fullscreen stands her at the right, the full height of the panel body, with
// the transcript to her left. Unlike every other placement her box is computed
// rather than written down, because it answers to BOTH viewport axes: height
// decides how tall she can be, width decides how tall she may be.
//
// Panel geometry she is measured against. The header number is measured off the
// rendered panel, not guessed — it is what keeps her head below the close
// button rather than behind it.
export const CHAT_PANEL_INSET = 16
export const CHAT_PANEL_HEADER_H = 61
export const CHAT_RAIL_W = 236
// The narrowest the transcript TEXT may be squeezed — measured on the text, not
// on the column that holds it, which is why the padding below is subtracted
// separately. (It was the column at first, and delivered 312px of text where
// the name promised 360.) Not a comfort target: it is the floor at which the
// column stops taking width and starts shrinking her instead. 360 is roughly a
// phone measure, which a chat transcript reads fine at.
export const CHAT_COLUMN_MIN_TRANSCRIPT = 360
// The transcript's own px-6, both sides. ChatWidget applies it as a class and
// adds her reserve to the right one, so the budget has to allow for it or the
// floor above is short by exactly this much.
export const CHAT_TRANSCRIPT_PADDING = 48
// Canvas width per unit height, from AVATAR_FRAMING_COLUMN: ±0.6745m of arm room
// over a 0.586m half-height view. Tighter than the rail's 0.75 because the
// framing is tighter vertically — the arm room is the same metres either way.
// Metres from her centre to a side edge — the arm room every placement gets.
// This is the ONE definition: the column aspect below divides by its own
// half-height, the launcher and docked canvases are sized so their width/height
// lands on the same number, and rigProbe.test.ts measures every clip against it.
// Raised from 0.6745 on 2026-08-20 because the probe, once it measured the
// SKINNED fingertip instead of the distal joint, put `spin` 0.5mm inside the
// edge and `dance` 23mm past it.
export const AVATAR_ARM_ROOM = 0.7415

export const AVATAR_COLUMN_ASPECT = AVATAR_ARM_ROOM / 0.586
// How much of that width her RESTING silhouette and hair actually cover,
// measured off the render. The rest is transparent gesture margin, and the
// transcript only reserves the body: a stretch does sweep a transparent hand
// past the text (reaching 0.92 of the width), which is the point of gestures
// that are not boxed in, and is safe because the wrapper takes no pointer
// events. Raise this and she pushes the text away; lower it and she stands on
// top of it.
export const AVATAR_COLUMN_BODY_FRACTION = 0.5222

// Where her RESTING silhouette's right edge falls, as a fraction of the canvas
// width measured from the canvas's left. Read off the render on 2026-08-19: at
// 1920x1080 her arms-down figure ends 793px into a 1136px canvas (0.699), and
// four samples at 1440x900 put it between 0.706 and 0.713. 0.70 covers both.
//
// This is NOT derivable from AVATAR_COLUMN_BODY_FRACTION. That constant answers
// how much width to keep clear of the text and carries clearance beyond her
// silhouette; assuming she was centred inside it put this edge at 0.787 and left
// her 100px short of where she was supposed to stand. Her figure also does not
// sit centred in the canvas — the framing leans her slightly left of it — which
// is the other half of the same error. Re-measure this from a screenshot if the
// column framing, the canvas aspect, or the model changes.
export const AVATAR_COLUMN_BODY_RIGHT = 0.6819

// Breathing room between her silhouette's right edge and the panel's inner
// right edge. Landing her flush (a gap of 0) put her sleeve 4px off the panel
// border at 1920x1080, which the owner read as too tight on 2026-08-19. This is
// the one number to turn if she wants to stand nearer or further from the edge;
// everything else in the placement is measurement.
export const AVATAR_COLUMN_BODY_GAP = 32

// Where her column canvas sits, as a CSS `right` in px. Negative hangs it past
// the viewport's right edge.
//
// This cannot be a constant, which is what it was until 2026-08-19. The width
// after her figure is `w · (1 − AVATAR_COLUMN_BODY_RIGHT)`: 341px on a 1136px
// column, 48px on a 160px one. A fixed -48 swallowed the whole of the small one
// and a seventh of the large one, which is why she stood ~200px short of the
// panel's edge at 1920x1080 while nearly touching it at 768x1024.
//
// So pin the FIGURE rather than the frame: hang the canvas out by exactly that
// width, less the panel's own inset, and her body's right edge lands flush with
// the panel's inner right edge at every canvas size. What now overhangs is her
// gesture room, and gestures may be clipped by the viewport. That is the trade
// the owner asked for on 2026-08-19: her body always whole, her reach free to
// run off the edge.
//
// The transcript's reserve is deliberately left alone. It is still the full
// AVATAR_COLUMN_BODY_FRACTION, so the text does not move; moving her right
// simply opens more space between the two.
export function avatarColumnRightInset(canvasW: number): number {
  const margin = canvasW * (1 - AVATAR_COLUMN_BODY_RIGHT)
  // Math.min keeps this at +0 when the margin is already inside where she is
  // meant to stand; negating a Math.max would hand back -0, which is not 0 to a
  // strict test.
  return Math.min(0, CHAT_PANEL_INSET + AVATAR_COLUMN_BODY_GAP - margin)
}

export interface AvatarColumnBox {
  // Canvas box. Fixed-positioned against the panel's bottom-right inner corner.
  w: number
  h: number
  // What the transcript column must keep clear on its right. Always ≤ w: the
  // difference is the transparent margin, which overhangs and costs nothing.
  reserve: number
}

// Her box for a viewport. Height is the panel body, unless her reserve would
// squeeze the transcript past its floor — then width is the binding constraint
// and she shrinks, keeping the aspect so no gesture starts clipping. This is
// what replaces the old narrow-window fallback: there is no other placement to
// fall back to, so the box itself absorbs a small window.
export function avatarColumnBox(vw: number, vh: number): AvatarColumnBox {
  const bodyH = vh - 2 * CHAT_PANEL_INSET - CHAT_PANEL_HEADER_H
  const budget =
    vw -
    2 * CHAT_PANEL_INSET -
    CHAT_RAIL_W -
    CHAT_TRANSCRIPT_PADDING -
    CHAT_COLUMN_MIN_TRANSCRIPT
  // reserve = h · aspect · bodyFraction, so this inverts it for h.
  const hFromWidth = budget / (AVATAR_COLUMN_ASPECT * AVATAR_COLUMN_BODY_FRACTION)
  const h = Math.max(0, Math.min(bodyH, hFromWidth))
  const w = h * AVATAR_COLUMN_ASPECT
  return { w, h, reserve: w * AVATAR_COLUMN_BODY_FRACTION }
}

// Percent inset, each side, of the launcher's click target inside that canvas.
// It exists so the transparent gesture margin is not clickable, which means it
// is tied to the launcher WIDTH: a wider canvas with this left alone silently
// hands the margin back.
export const AVATAR_LAUNCHER_HIT_INSET_PCT = 26
// The class ChatWidget applies. Same arrangement as AVATAR_LAUNCHER_SIZE_CLASS:
// the JIT needs the literal, so the number is written twice and a test parses
// this string back to hold the two together. ChatWidget must CONSUME this rather
// than spell its own copy, or the constant above pins nothing.
export const AVATAR_LAUNCHER_HIT_CLASS = 'left-[26%] right-[26%]'

// AVATAR_WAISTUP_BODY_LEFT, which the speech bubble below is placed against, is
// declared with the docked scale that shares her body box.
// How far the bubble's right edge sits from the wrapper's right corner, so its
// tail lands beside her head instead of on it.
export const AVATAR_BUBBLE_RIGHT_PX = 273
export const AVATAR_BUBBLE_RIGHT_CLASS = 'right-[273px]'

// The Tailwind class for the launcher box. Tailwind's JIT only sees arbitrary
// values written as complete literals, so the numbers cannot be interpolated
// from AVATAR_CANVAS_LAUNCHER — which is exactly why this lives next to it and
// is pinned by a test that parses the string back. Editing this width without
// editing the constant used to be silent; now it is red.
//
// The docked box and the column have no entry here on purpose: both are
// arithmetic (avatarDockedBox, avatarColumnBox) applied as an inline style,
// because both answer to the viewport and no literal can. That leaves one class
// rather than a per-placement function, which is why this is a constant now —
// the remaining placements are the launcher and 'hidden', and 'hidden' takes
// display:none from ChatWidget and never paints.
export const AVATAR_LAUNCHER_SIZE_CLASS = 'h-[280px] w-[376px]'

// Metres of world per canvas pixel — the number that must match across
// placements for her to look the same size in each.
export function avatarMetresPerPixel(framing: AvatarFraming, canvasHeight: number): number {
  return (2 * framing.distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))) / canvasHeight
}

// Metres from her centre to the left/right canvas edge. The FOV is vertical, so
// this is the one framing number the canvas WIDTH moves; height and distance
// together fix how big she looks, and width then buys room for her arms.
export function avatarViewHalfWidth(
  framing: AvatarFraming,
  canvas: { w: number; h: number },
): number {
  return framing.distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180)) * (canvas.w / canvas.h)
}

// World-space heights the top and bottom canvas edges land on. Her hair top is
// at y≈1.582, mid-thigh ≈0.62, knee ≈0.40.
export function avatarViewSpan(framing: AvatarFraming): { top: number; bottom: number } {
  const half = framing.distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))
  return { top: framing.lookAtY + half, bottom: framing.lookAtY - half }
}

// ---- head band ------------------------------------------------------------
// Where her HEAD is, for the head-pat hit test.
//
// Both numbers are the same measurements the framing comments above cite: her
// hair top at 1.582, and the bottom of the Face.baked bounding box at 1.287,
// which is her chin (rigProbe.ts's FACE_BOX carries that measurement and uses
// it for fingers-inside-her-skull checks).
export const AVATAR_HEAD_TOP_Y = 1.582
export const AVATAR_HEAD_BOTTOM_Y = 1.287

// A tap wants a forgiving target, so the band clears her hair by a few
// centimetres rather than hugging it.
const HEAD_BAND_SLACK_Y = 0.03

// Her face box is ±0.092m and her hair adds 0.079m ABOVE it (1.503 -> 1.582);
// assuming it adds about as much at the sides gives ~0.17m, and 0.15 keeps the
// band inside that rather than reaching for the arm room on either side.
const HEAD_BAND_HALF_WIDTH = 0.15

/**
 * The head-pat target for a framing, as fractions of the canvas box.
 *
 * `top` and `bottom` are measured DOWN from the canvas top edge; `halfWidth` is
 * measured out from the horizontal centre, as a fraction of the canvas WIDTH.
 *
 * Derived rather than hardcoded on purpose. The hit test used to carry the band
 * as two literal percentages measured against lookAtY 1.17; raising the frame
 * to 1.32 on 2026-08-20 moved her head down inside the canvas, and the band was
 * left pointing at the wrong part of it with nothing to notice: it kept the top
 * half of her head in the waist-up frame and swapped to the bottom half in the
 * column, and every future dolly would have moved it again.
 */
export function avatarHeadBand(
  framing: AvatarFraming,
  canvas: { w: number; h: number },
): { top: number; bottom: number; halfWidth: number } {
  const view = avatarViewSpan(framing)
  const span = view.top - view.bottom
  return {
    top: Math.max(0, (view.top - (AVATAR_HEAD_TOP_Y + HEAD_BAND_SLACK_Y)) / span),
    bottom: (view.top - AVATAR_HEAD_BOTTOM_Y) / span,
    halfWidth: HEAD_BAND_HALF_WIDTH / (2 * avatarViewHalfWidth(framing, canvas)),
  }
}

interface GateInputs {
  matchMedia: (q: string) => Pick<MediaQueryList, 'matches'>
  // A thunk, not a boolean: probing WebGL2 creates a real GL context, so it
  // stays lazy and only runs after the cheaper reduced-motion check passes —
  // a reduced-motion visitor never sees the avatar and must not pay the probe.
  webgl: () => boolean
}

// Capability gate — the avatar is on for everyone (mobile included) since the
// 2026-08-13 production launch. Only two things turn it off: the visitor asked
// for reduced motion, or the device can't run WebGL2. Inputs are injected so
// tests never touch real browser globals.
export function avatarGuideEnabled({ matchMedia, webgl }: GateInputs): boolean {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return webgl()
}

// Browser-bound wrapper used by the widget; the testable core stays injected.
export function avatarGuideEnabledInBrowser(): boolean {
  return avatarGuideEnabled({
    matchMedia: (q) => window.matchMedia(q),
    webgl: hasWebGL,
  })
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return false
    // Release the probe context right away — browsers cap live GL contexts
    // (~16) and the real one for the avatar canvas is about to be created.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
