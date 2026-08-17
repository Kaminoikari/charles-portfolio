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
// 'hidden' means display:none, never unmount: the wrapper stays mounted so the
// 5.5MB VRM is fetched and parsed exactly once per page.
//  launcher      stowed panel — the character IS the launcher button
//  beside-panel  docked panel on a viewport wide enough for both, side by side
//  column        fullscreen — she stands full height in a column of her own on
//                the right, at whatever size the window can pay for
//  hidden        fullscreen on a phone, or a docked panel covering one
export type AvatarPlacement = 'launcher' | 'beside-panel' | 'column' | 'hidden'

// `md` (≥768px) is the pipeline rail's own breakpoint (the aside is
// max-md:hidden) and doubles as the floor for the column: below it the panel
// is an edge-to-edge phone takeover with no room to stand anyone beside the
// text. `wide` (≥880px) gates the docked side-by-side layout, separately.
//
// There is deliberately no height gate and no narrow-window fallback. Both used
// to exist because she stood at the FOOT of the pipeline rail, where a short or
// narrow window put her on top of the trace; in a column of her own she has
// nothing to collide with, and avatarColumnBox() answers "too small" by
// shrinking her rather than by moving her somewhere else.
export function avatarPlacement(mode: ChatMode, wide: boolean, md: boolean): AvatarPlacement {
  if (mode === 'fullscreen') return md ? 'column' : 'hidden'
  if (mode === 'minimised') return 'launcher'
  return wide ? 'beside-panel' : 'hidden'
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
//    she scales up — what the docked panel does, on purpose. Her 560px box is
//    1.64× the launcher's 280px one and she renders 1.64× larger, waist-up
//    either way;
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
// y=1.722 (her hair top is 1.582), bottom at y=0.618, mid-thigh. Canvas width
// does not enter into it — see avatarViewHalfWidth.
export const AVATAR_FRAMING_DEFAULT: AvatarFraming = { distance: 2.3, lookAtY: 1.17 }
// The fullscreen column's framing: head to knee, composed tight. The default
// framing leaves 0.14m of air above her hair, which reads as a big empty gap
// once the canvas is 800px tall, so this pulls the top edge down to 1.602 —
// 0.02m over her hair at 1.582, about 40px of clearance on screen and as close
// as her hair ornaments allow. The bottom edge stays at her knee (0.43), the
// same cut the old rail made, so the tightening is all headroom.
//
// The view is 1.172m tall against the default's 1.291m, which is why she comes
// out 10% larger on the same canvas — and why the column is proportionally
// WIDER than the rail was: her arm room is a fixed 0.484m spread over fewer
// metres of height. That is where AVATAR_COLUMN_ASPECT comes from.
export const AVATAR_FRAMING_COLUMN: AvatarFraming = { distance: 2.441, lookAtY: 1.016 }

// ---- arm reach ------------------------------------------------------------
// Her arm, measured off the VRM's own bone translations (metres). VRM0's rest
// pose is a T-pose, so an arm starts along ±x and the upperArm/lowerArm z
// rotations swing it down in the xy plane.
const ARM = { shoulderX: 0.081, upper: 0.233, foreAndHand: 0.333 }

// The rest pose the engine pins the arms to, and how far `stretch` flares them
// out of it. These live here, rather than as literals in the engine's gesture
// table, so the reach below is COMPUTED from the same numbers the engine poses
// with: widening a gesture now moves the required canvas width, and the test
// that checks the canvas contains her reach turns red.
export const ARM_REST_UPPER_Z = 1.15
export const ARM_REST_FORE_Z = 0.25

// Where the elbow and the fingertip sit, sideways from her centre line, for one
// arm attitude, measured in the frontal plane.
function armSpan(zUpper: number, zFore: number): { elbow: number; tip: number } {
  const elbow = -ARM.shoulderX + ARM.upper * Math.cos(Math.PI + zUpper)
  return { elbow, tip: elbow + ARM.foreAndHand * Math.cos(Math.PI + zUpper + zFore) }
}

// Distance from her centre line to a fingertip, for a given pair of arm
// rotations. Angles are measured from +x, so the left arm starts at π.
export function armReach(zUpper: number, zFore: number): number {
  return Math.abs(armSpan(zUpper, zFore).tip)
}

// Distance from her centre line to the ELBOW. Gestures that fold the forearm
// back — hands behind the head, a hand on her hip — put their widest point
// here, not at the fingertip, so a reach check that only looked at fingertips
// would wave them through and then clip the elbow.
export function elbowReach(zUpper: number): number {
  return Math.abs(armSpan(zUpper, 0).elbow)
}

export interface ArmFrame {
  upper: number
  fore: number
}

// One frame of an arm's travel from its rest pin to a pose. The ENGINE poses
// from this and the width check below measures it, so the two cannot disagree
// about what the arm does between the two ends. The travel is a plain linear
// interpolation of both joints, which is the motion the owner approved; a
// shoulder turn tried on 2026-08-15 to narrow it was rejected as something no
// human shoulder does, and the canvases were widened to fit the real motion
// instead.
export function armAt(pose: ArmPose, env: number): ArmFrame {
  return {
    upper: ARM_REST_UPPER_Z + (pose.upper - ARM_REST_UPPER_Z) * env,
    fore: ARM_REST_FORE_Z + (pose.fore - ARM_REST_FORE_Z) * env,
  }
}

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

// ---- what each arm gesture actually does -----------------------------------
// The peak pose (envelope = 1) of every gesture that moves an arm, in the
// engine's own bone units: `upper` is |z| on the upper arm (smaller = raised
// toward the T-pose) and `fore` is |z| on the forearm (larger = folded in
// toward the shoulder). The engine's GESTURES table READS this, so these are
// the poses themselves and not a description that can drift from them, and the
// canvas-width check below therefore covers every gesture rather than one.
// A gesture may also swing an arm forward out of the frontal plane, toward the
// viewer. That rotation is about the x axis, so it leaves the sideways reach
// modelled here untouched, and the pose needs no field for it: measured on the
// model, the resting wrist sits at x 0.212 and a 1.25 rad forward swing moves
// it to 0.207. An earlier version of this file scored such a swing as
// cos(forward) foreshortening, which understated the width by 3x.
export interface ArmPose {
  upper: number
  fore: number
}
// Named so the engine's GestureName can be built from it: every arm gesture
// must appear here, and the Record makes a missing one a type error.
export type ArmGestureName =
  | 'lookHand'
  | 'hairTouch'
  | 'doublePeace'
  | 'singlePeace'
  | 'cheekPoke'
  | 'salute'
  | 'pointAtYou'
  | 'handsBehindHead'
  | 'handOnHip'
  | 'hipWave'

export const ARM_GESTURE_PEAKS: Record<ArmGestureName, { left?: ArmPose; right?: ArmPose }> = {
  // Every pose below was set by measuring where the wrist bone actually lands
  // in world space, not by solving the angles on paper: `fore` continues the
  // upper arm's rotation rather than opposing it, so the intuitive positive
  // value folds the hand DOWN across the body. Every hand-up pose here is
  // negative, and the first draft of all eight had it backwards.
  // Reference heights on this model: head bone 1.320, cheek ~1.38, brow ~1.45,
  // hair top 1.582, hip ~0.90.

  // Right palm raised in front of her and studied.
  lookHand: { right: { upper: 0.9, fore: 1.2 } },
  // Left hand up to her hair.
  hairTouch: { left: { upper: 0.4, fore: 1.35 } },

  // Wrists at (±0.24, 1.40) — eye level, just outside her hair.
  doublePeace: { left: { upper: 0.0, fore: -2.0 }, right: { upper: 0.0, fore: -2.0 } },
  singlePeace: { right: { upper: 0.0, fore: -2.0 } },
  // Wrists at (±0.15, 1.31), so the extended index finger lands on her cheek.
  cheekPoke: { left: { upper: 0.25, fore: -2.6 }, right: { upper: 0.25, fore: -2.6 } },
  // Right wrist at (0.13, 1.45), her brow. Left hand goes to the hip.
  salute: { right: { upper: -0.45, fore: -2.0 }, left: { upper: 0.75, fore: 1.45 } },
  // Aimed at the viewer: the z angles stay at rest and the engine does the
  // whole gesture with a forward swing, putting the fingertip 0.52 in front of
  // her and only 0.23 to the side. Raising the arm sideways first, as the first
  // draft did, sent the fingertip to 0.60 and off the edge of the canvas.
  pointAtYou: { right: { upper: ARM_REST_UPPER_Z, fore: ARM_REST_FORE_Z } },
  // Wrists at (±0.20, 1.51) and pushed back in depth by the gesture itself.
  // The elbows are the widest point of any pose here, which is what
  // elbowReach() exists for.
  handsBehindHead: { left: { upper: -0.45, fore: -1.6 }, right: { upper: -0.45, fore: -1.6 } },
  // Wrist at (0.12, 0.87), the top of her thigh, with the elbow winged out.
  handOnHip: { left: { upper: 0.75, fore: 1.45 } },
  // That hand on the hip, and the other one up in a proper greeting.
  hipWave: { left: { upper: 0.75, fore: 1.45 }, right: { upper: -0.25, fore: -1.6 } },
}

// The widest point a set of poses reaches, fingertip or elbow. Taken as a
// parameter rather than closing over the table so a test can feed it a pose
// whose elbow beats every fingertip: with the real table the fingertips win
// everywhere, which leaves the elbow term unproven and free to be deleted.
// How far one arm gesture reaches sideways over its WHOLE travel: the further
// of the fingertip and the elbow, at every point between the rest pin and the
// pose. Sampling the travel rather than the pose is the whole point — the peak
// is the narrow part of these gestures, and checking it alone is what let a
// clipping raise ship.
const ARM_PATH_SAMPLES = 96
export function poseReach(p: ArmPose): number {
  let worst = 0
  for (let i = 0; i <= ARM_PATH_SAMPLES; i++) {
    const f = armAt(p, i / ARM_PATH_SAMPLES)
    const span = armSpan(f.upper, f.fore)
    worst = Math.max(worst, Math.abs(span.tip), Math.abs(span.elbow))
  }
  return worst
}

export function widestReach(peaks: Record<string, { left?: ArmPose; right?: ArmPose }>): number {
  return Math.max(
    ...Object.values(peaks).flatMap((g) =>
      [g.left, g.right].filter((p): p is ArmPose => p !== undefined).map(poseReach),
    ),
  )
}

// What the canvas width has to contain.
export const AVATAR_WIDEST_GESTURE_REACH = widestReach(ARM_GESTURE_PEAKS)

// Canvas boxes per placement.
//
// The widths are set by that reach, not by how big she should look. Because the
// FOV is vertical, width only adds horizontal view: the same character at the
// same size with more room beside her. The old widths showed ±0.355m, so a
// stretch lost its last 14-17px and a wave its last 10-12px. These show ±0.484m,
// which clears the reach by 18% — enough for the hand's own thickness and for
// hair the spring bones throw outward. The extra area is transparent, so it
// costs page space nowhere; only the launcher's click target had to be narrowed
// to match (see ChatWidget).
//
// The docked box is the odd one out: it is sized to the PANEL, not to a number
// of its own, so she stands exactly as tall as the thing she is standing next
// to. Its height is the panel's `min(560px,80vh)` and its width follows at the
// same 491/560 ratio, so the ±0.484m of arm room survives the resize. Both
// literals below are the uncapped 100%-of-560 case; on a viewport under 700px
// tall the vh branch scales the pair together and she simply renders smaller.
//
// The fullscreen column has no entry here at all: its box is arithmetic, not a
// number, because it answers to both viewport axes at once. See
// avatarColumnBox().
export const AVATAR_CANVAS_LAUNCHER = { w: 342, h: 280 }
export const AVATAR_CANVAS_DOCKED = { w: 684, h: 560 }

// The docked canvas hangs to the LEFT of the panel, from a fixed right offset:
// the panel's own 400px plus a 36px gutter. At 684px wide it no longer fits a
// narrow desktop window — at 900px, 226px of the canvas is off the left edge of
// the screen and 26px of that is her shoulder. She scales down to fit instead,
// continuously rather than at a breakpoint, which is the same call the owner
// made for the column on 2026-08-14: a smaller Mika, never a cut one.
export const CHAT_BESIDE_PANEL_RIGHT = 436
export function besidePanelScale(vw: number): number {
  return Math.min(1, Math.max(0, (vw - CHAT_BESIDE_PANEL_RIGHT) / AVATAR_CANVAS_DOCKED.w))
}

// The docked panel's height, as the Tailwind literal. It lives here, next to
// the canvas that must match it, because those are one number wearing two hats:
// ChatWidget CONSUMES this for the panel and avatarSizeClass() spells the same
// min() for the canvas, and a test parses both back so raising the panel
// without raising her cannot pass silently.
export const CHAT_PANEL_HEIGHT_CLASS = 'h-[min(560px,80vh)]'

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
// The column canvas must travel 48px farther right than the panel's 16px inset.
// Its subject is centred inside a wide gesture-safe frame, so pinning that
// frame to the panel edge leaves visible empty canvas after Mika. This optical
// nudge aligns the figure with the right edge while retaining enough room for
// the widest hand pose before the viewport clips it.
export const AVATAR_COLUMN_RIGHT_INSET = -32
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
// Canvas width per unit height, from AVATAR_FRAMING_COLUMN: ±0.484m of arm room
// over a 0.586m half-height view. Tighter than the rail's 0.75 because the
// framing is tighter vertically — the arm room is the same metres either way.
export const AVATAR_COLUMN_ASPECT = 0.6745 / 0.586
// How much of that width her RESTING silhouette and hair actually cover,
// measured off the render. The rest is transparent gesture margin, and the
// transcript only reserves the body: a stretch does sweep a transparent hand
// past the text (reaching 0.92 of the width), which is the point of gestures
// that are not boxed in, and is safe because the wrapper takes no pointer
// events. Raise this and she pushes the text away; lower it and she stands on
// top of it.
export const AVATAR_COLUMN_BODY_FRACTION = 0.5741

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
export const AVATAR_LAUNCHER_HIT_INSET_PCT = 24
// The class ChatWidget applies. Same arrangement as avatarSizeClass(): the JIT
// needs the literal, so the number is written twice and a test parses this
// string back to hold the two together. ChatWidget must CONSUME this rather
// than spell its own copy, or the constant above pins nothing.
export const AVATAR_LAUNCHER_HIT_CLASS = 'left-[24%] right-[24%]'

// Where her body actually ends inside the launcher canvas, as a fraction of the
// canvas width, read off the render at rest with her hair. Her body is CENTRED,
// so widening the canvas walks her inland and walks this edge with her — which
// is why the speech bubble beside her has now been nudged twice, once per
// widening, with nothing tying the two together. The test below is that tie.
export const AVATAR_LAUNCHER_BODY_FRACTION = 0.415
// How far the bubble's right edge sits from the wrapper's right corner, so its
// tail lands beside her head instead of on it.
export const AVATAR_BUBBLE_RIGHT_PX = 256
export const AVATAR_BUBBLE_RIGHT_CLASS = 'right-[256px]'

// The Tailwind class for each box. Tailwind's JIT only sees arbitrary values
// written as complete literals, so the numbers cannot be interpolated from the
// constants above — which is exactly why this lives next to them and is pinned
// by a test that parses these strings back. Editing one of these widths without
// editing its constant used to be silent; now it is red.
// 70.14vh = 80vh × 491/560: the vh branch has to carry the ratio too, or a
// short viewport would shrink her height while keeping full width and hand her
// a metre of empty room beside her arms.
//
// The column is absent on purpose: its box is avatarColumnBox() arithmetic
// applied as an inline style, so it has no literal here to keep in step.
export function avatarSizeClass(placement: AvatarPlacement): string {
  if (placement === 'beside-panel') return 'h-[min(560px,80vh)] w-[min(684px,97.71vh)]'
  return 'h-[280px] w-[342px]'
}

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
