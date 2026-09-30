// The /avatar page's composition: which layout a viewport gets, and where the
// camera stands so the figure lands where the page wants her.
//
// The two layouts frame her differently, both at the owner's direction:
//   hud     her head at the size and height of the owner's reference (a gacha
//           dressing room on a phone, 2026-09-29): big enough to read her face,
//           her legs running on under the dock
//   select  the whole figure, head to toe, in the band between the panels
// Both are solved from the viewport and the body's own measurements (its
// clearance file's resting crown and chin) rather than written down per
// screen, so a 360x640 phone, a 2560x1440 monitor and a taller body all get
// the same composition.
//
// Pure functions of their inputs, so the test can hold the numbers without a
// browser or a GL context.
import { AVATAR_CAMERA_TILT, AVATAR_FOV, type AvatarFraming } from '../chat/avatarMode'
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
 * The phone dock's height, in CSS pixels (HudDock: a 44px tab row, a 96px
 * picker row and their padding). The backdrop must reach down to it; under
 * it the page may show the blurred fill, which the dock's glass blurs anyway.
 */
export const HUD_DOCK_H = 170

/**
 * The canvas row the camera's horizon crosses. The engine's camera stands
 * AVATAR_CAMERA_TILT over the point it looks at, so it looks a little down
 * and its horizon sits a little above the canvas's middle.
 */
export function horizonRow(framing: AvatarFraming, h: number): number {
  const k = Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))
  return h / 2 - ((h / 2) * (AVATAR_CAMERA_TILT / framing.distance)) / k
}

/** Where a backdrop is drawn: its top edge and height, in CSS pixels. Its width follows at 16:9. */
export interface BackdropBox {
  top: number
  height: number
}

/**
 * The box a 16:9 backdrop whose eye level is `horizon` (StageScene.horizon)
 * fills, so that eye level lands on the camera's horizon row.
 *
 * A painting's eye level is where its painter stood: anyone standing on its
 * ground is cut by that line at the painter's eye height. Put anywhere else,
 * she stands in the picture at another height than it was drawn from. The
 * owner, 2026-09-30, against a game's dressing room whose horizon runs through
 * the girl's shoulders: "the background and the figure are a perfect match
 * there, in distance and focal length". Here the paintings' eye levels,
 * 0.45–0.72 of the way down, lay at 56–78% of a 390x844 phone's height,
 * cutting Sendagaya Shibu at 0.67–1.02m, thigh to hip, while the camera
 * stood at 1.21m, at her waist, 44% of the way down: she stood in each scene
 * like a giant.
 *
 * The box is as small as it can be while it covers the screen's width and
 * top and reaches down to `floor`; below that the page shows a blurred copy.
 * Small, because the owner found the pictures too close on a phone when they
 * covered its whole height (2026-09-30): reaching down only to the dock, a
 * phone draws them 0.80–0.97 of its height (moon-beach, whose eye level sits
 * lowest, 1.29) and sees 27–32% of each one's width (20%).
 */
export function backdropBox(view: { w: number; h: number }, row: number, horizon: number, floor: number): BackdropBox {
  const height = Math.max((view.w * 9) / 16, row / horizon, (floor - row) / (1 - horizon))
  return { top: row - horizon * height, height }
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
 * further (a dance throws a hand 0.71m out); those pass behind a panel for a
 * moment, which is the price of her filling the stage.
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
 * The phone framing, off the owner's reference screenshot (2026-09-29, a
 * 920x2000 capture): the top of her hair 18.8% of the way down the screen, and
 * crown to chin 16.2% of its height. Fractions of the height, so any phone
 * held upright composes the same.
 */
export const HUD_CROWN_ROW = 0.188
export const HUD_HEAD_SHARE = 0.162

/** Crown to chin of a family's resting body, in metres, from its clearance file. */
export function headHeight(family: AvatarFamilyId): number {
  const f = AVATAR_FAMILIES[family]
  return f.restCrownY - f.faceBox.min[1]
}

/**
 * Camera distance and look-at height that put the family's resting crown at
 * HUD_CROWN_ROW of an `h`-pixel canvas and its head HUD_HEAD_SHARE of it tall.
 */
export function hudFraming(h: number, family: AvatarFamilyId): AvatarFraming {
  const k = Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))
  const pxPerMetre = (HUD_HEAD_SHARE * h) / headHeight(family)
  const span = h / pxPerMetre
  return {
    distance: span / (2 * k),
    lookAtY: restCrown(family) - ((0.5 - HUD_CROWN_ROW) * h) / pxPerMetre,
  }
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
