// The /avatar page's composition: which layout a viewport gets, and where the
// camera stands so the whole figure lands in the part of the canvas the page
// leaves free for it.
//
// The canvas fills the page and the controls float over it (the phone's dock,
// the desktop's two panels), so "full body" means the figure fits the band
// between them, not the canvas. The framing is solved from that band rather
// than written down per viewport: the same arithmetic serves a 390x844 phone
// and a 2560x1440 monitor, and a body with a higher crown gets the headroom it
// needs from its own clearance file instead of a shared constant.
//
// Pure functions of their inputs, so the test can hold the numbers without a
// browser or a GL context.
import { AVATAR_FOV, type AvatarFraming } from '../chat/avatarMode'
import { AVATAR_FAMILIES, type AvatarFamilyId } from '../chat/avatarVariants'

/**
 * Which of the two agreed layouts a viewport gets (owner, 2026-09-29):
 *   hud     A: the stage fills the screen and a dock at the bottom switches
 *           looks, motions, expressions and scenes in tabs, all under one thumb
 *   select  B: a fighting-game character select, every option on screen at
 *           once, the figure standing between the two panels
 * B needs two side panels and a stage between them, which a tablet held
 * upright does not have room for, so B starts at Tailwind's `lg` (1024px).
 */
export type StageLayout = 'hud' | 'select'
export const SELECT_MIN_WIDTH = 1024

export function stageLayout(viewportWidth: number): StageLayout {
  return viewportWidth >= SELECT_MIN_WIDTH ? 'select' : 'hud'
}

/**
 * Air over the resting crown, in metres. A standing figure with no room over
 * its hair reads as cropped even when nothing is; 6cm is roughly a hand's
 * breadth on a 1.58m figure.
 */
export const HEAD_AIR = 0.06
/**
 * Where the frame's bottom edge sits: just under the soles. VRoid bodies stand
 * on y = 0 at rest.
 */
export const FEET_Y = -0.02
/**
 * Half the width the resting figure needs, in metres: arms down, a bob or a
 * skirt, and a few centimetres either side. A band narrower than this in world
 * terms makes the figure smaller rather than cutting her sides off. Clips reach
 * further (a dance throws a hand 0.71m out); on a phone held upright those
 * hands leave the screen for a moment, which is the price of her filling it.
 */
export const REST_HALF_WIDTH = 0.36

/** The part of the canvas the figure must fit in, in CSS pixels. */
export interface StageBand {
  /** Canvas size. */
  w: number
  h: number
  /** Rows the crown and the soles may reach: the band's top and bottom. */
  top: number
  bottom: number
  /** Free width, centred on the canvas (the camera looks down the middle). */
  width: number
}

/** The resting crown of a family's bodies, from its clearance file. */
export function restCrown(family: AvatarFamilyId): number {
  return AVATAR_FAMILIES[family].restCrownY
}

/**
 * Camera distance and look-at height that put the family's resting crown (plus
 * HEAD_AIR) at the band's top row and the soles at its bottom row, or, where
 * the band is too narrow for REST_HALF_WIDTH, the soles still on the bottom row
 * and the figure small enough to fit sideways.
 *
 * The engine's camera stands AVATAR_CAMERA_TILT above the look-at point, a
 * pitch of about 1.5 degrees at these distances; the vertical mapping below
 * treats it as level, which is off by well under a pixel per metre.
 */
export function stageFraming(band: StageBand, family: AvatarFamilyId): AvatarFraming {
  const top = restCrown(family) + HEAD_AIR
  const k = Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))
  const bandH = Math.max(1, band.bottom - band.top)
  // Visible world height of the whole canvas at the subject plane.
  const tall = ((top - FEET_Y) * band.h) / bandH
  const wide = (2 * REST_HALF_WIDTH * band.h) / Math.max(1, band.width)
  const span = Math.max(tall, wide)
  return {
    distance: span / (2 * k),
    lookAtY: FEET_Y + ((band.bottom - band.h / 2) * span) / band.h,
  }
}

/** World height at a canvas row, for a framing: the inverse the test checks against. */
export function rowToWorldY(framing: AvatarFraming, h: number, row: number): number {
  const span = 2 * framing.distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))
  return framing.lookAtY + ((h / 2 - row) * span) / h
}

/** The page's path under every locale prefix ('' for English). */
export const STAGE_PATH = '/avatar'

/**
 * Whether a pathname is the stage page in any locale. The chat widget stays
 * off it: its launcher is a second copy of her in the corner of a page that is
 * all her, and a second WebGL context for nothing.
 */
export function isStagePath(pathname: string, prefixes: readonly string[]): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return prefixes.some((prefix) => path === `${prefix}${STAGE_PATH}`)
}
