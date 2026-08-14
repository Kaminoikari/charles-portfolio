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

// Waist-up, composed for the 180×280 launcher canvas: top edge at world
// y=1.722 (her hair top is 1.582), bottom at y=0.618, mid-thigh.
export const AVATAR_FRAMING_DEFAULT: AvatarFraming = { distance: 2.3, lookAtY: 1.17 }
// The rail's 220×400 canvas is 58px taller than the docked one. Distance grows
// with it (2.3 × 400/342) and the look-at drops so the extra view lands below
// her, not as headroom: the top edge stays at 1.722 and the bottom reaches
// y=0.431, just past her knees.
export const AVATAR_FRAMING_RAIL: AvatarFraming = { distance: 2.69, lookAtY: 1.076 }

// Canvas boxes per placement. ChatWidget must spell the Tailwind classes out as
// literals for the JIT to see them, so these are duplicated there by necessity;
// ChatWidget.test.tsx asserts the rendered canvas matches these numbers.
export const AVATAR_CANVAS_LAUNCHER = { w: 180, h: 280 }
export const AVATAR_CANVAS_DOCKED = { w: 220, h: 342 }
export const AVATAR_CANVAS_RAIL = { w: 220, h: 400 }

// Metres of world per canvas pixel — the number that must match across
// placements for her to look the same size in each.
export function avatarMetresPerPixel(framing: AvatarFraming, canvasHeight: number): number {
  return (2 * framing.distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))) / canvasHeight
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
