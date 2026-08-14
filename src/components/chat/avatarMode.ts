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
//  rail          wide fullscreen — she stands at the bottom of the pipeline rail
//  hidden        narrow fullscreen (no rail), or a docked panel covering a phone
export type AvatarPlacement = 'launcher' | 'beside-panel' | 'rail' | 'hidden'

// `tall` (viewport height ≥640px) only matters for the rail: in a short window
// the pipeline stations reach the bottom and would overlap her. `md` (≥768px)
// is the rail's OWN breakpoint (the aside is max-md:hidden), distinct from
// `wide` (≥880px) which gates the docked side-by-side layout — she stands
// wherever the rail exists, including 768–880px tablet windows.
export function avatarPlacement(
  mode: ChatMode,
  wide: boolean,
  tall: boolean,
  md: boolean,
): AvatarPlacement {
  if (mode === 'fullscreen') return md && tall ? 'rail' : 'hidden'
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
// pixel. Hold that ratio constant and a taller canvas shows MORE of her at the
// same size, instead of scaling her up — which is the whole point of the rail
// getting its own framing: same Mika, more leg.
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
// The rail's 400px-tall canvas is 58px taller than the docked one. Distance grows
// with it (2.3 × 400/342) and the look-at drops so the extra view lands below
// her, not as headroom: the top edge stays at 1.722 and the bottom reaches
// y=0.431, just past her knees.
export const AVATAR_FRAMING_RAIL: AvatarFraming = { distance: 2.69, lookAtY: 1.076 }

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
export const AVATAR_CANVAS_LAUNCHER = { w: 245, h: 280 }
export const AVATAR_CANVAS_DOCKED = { w: 300, h: 342 }
export const AVATAR_CANVAS_RAIL = { w: 300, h: 400 }

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
export function avatarSizeClass(placement: AvatarPlacement, roomy: boolean): string {
  if (placement === 'rail' && roomy) return 'h-[400px] w-[300px]'
  if (placement === 'beside-panel') return 'h-[342px] w-[300px]'
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
