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
// value STEPS the frame the mode changes: idle sweeps ±0.42 while speaking
// barely moves at ±0.07, making the end of an answer worth up to 0.487rad
// (27.9°) of yaw in a single frame — 18° at the head bone, plus a 2.85-unit
// sideways jump of the eye target. That snap is what HEAD_AIM_SMOOTHING is for;
// the engine runs this through a one-pole filter rather than using it directly.
export function headAim(mode: AvatarMode, t: number): { yaw: number; pitch: number } {
  if (mode === 'idle') {
    return {
      yaw: Math.sin(t * ((2 * Math.PI) / 5.2)) * 0.42,
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
// by the sinusoids themselves, and it scales with their speed: the 5.2s idle
// sweep keeps 98% of its amplitude and lags 11°, while the fastest one (the
// 1.6s listening nod) keeps 85% and lags 0.133s. At this size that worst case
// is 0.024rad of aim, under 1° at the head bone.
export const HEAD_AIM_SMOOTHING = 6

// One filter step, per axis. It lives here rather than inline in the engine so
// the tests drive the same code the engine does: a test that re-implements the
// filter would keep passing with the engine's call removed. Scalar (not a
// {yaw,pitch} pair) to keep the animation loop allocation-free.
export function stepHeadAim(prev: number, target: number, dt: number): number {
  return prev + (target - prev) * Math.min(1, dt * HEAD_AIM_SMOOTHING)
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
export const STRETCH_ARM_FLARE = 0.35

// Distance from her centre line to a fingertip, for a given pair of arm
// rotations. Angles are measured from +x, so the left arm starts at π.
export function armReach(zUpper: number, zFore: number): number {
  const upperDir = Math.PI + zUpper
  const foreDir = upperDir + zFore
  const elbow = -ARM.shoulderX + ARM.upper * Math.cos(upperDir)
  return Math.abs(elbow + ARM.foreAndHand * Math.cos(foreDir))
}

// The widest any gesture puts a fingertip: `stretch`, which flares the upper arm
// without folding the forearm back in. 0.409m. `wave` is next at 0.393; the
// other arm gestures either fold the forearm (hairTouch, lookHand) or move the
// arm in depth only (armSwing).
export const AVATAR_WIDEST_GESTURE_REACH = armReach(
  ARM_REST_UPPER_Z - STRETCH_ARM_FLARE,
  ARM_REST_FORE_Z,
)

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
export const AVATAR_CANVAS_LAUNCHER = { w: 245, h: 280 }
export const AVATAR_CANVAS_DOCKED = { w: 491, h: 560 }

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
export const AVATAR_COLUMN_ASPECT = 0.484 / 0.586
// How much of that width her RESTING silhouette and hair actually cover,
// measured off the render. The rest is transparent gesture margin, and the
// transcript only reserves the body: a stretch does sweep a transparent hand
// past the text (reaching 0.92 of the width), which is the point of gestures
// that are not boxed in, and is safe because the wrapper takes no pointer
// events. Raise this and she pushes the text away; lower it and she stands on
// top of it.
export const AVATAR_COLUMN_BODY_FRACTION = 0.8

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
export const AVATAR_LAUNCHER_HIT_INSET_PCT = 13
// The class ChatWidget applies. Same arrangement as avatarSizeClass(): the JIT
// needs the literal, so the number is written twice and a test parses this
// string back to hold the two together. ChatWidget must CONSUME this rather
// than spell its own copy, or the constant above pins nothing.
export const AVATAR_LAUNCHER_HIT_CLASS = 'left-[13%] right-[13%]'

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
  if (placement === 'beside-panel') return 'h-[min(560px,80vh)] w-[min(491px,70.14vh)]'
  return 'h-[280px] w-[245px]'
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
