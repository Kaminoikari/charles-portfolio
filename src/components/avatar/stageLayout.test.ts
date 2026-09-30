// The /avatar page's two compositions, held in canvas rows for every body a
// visitor can pick: on a phone her head at the size and height of the owner's
// reference, in the character select the whole figure inside the band the
// panels leave free. A taller body, a new screen size or a moved panel that
// would break either fails here rather than on a screen.
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { AVATAR_CAMERA_TILT, AVATAR_FOV } from '../chat/avatarMode'
import { motionFrame } from '../chat/avatarMotions'
import { OFFERED_VARIANTS, familyOf } from '../chat/avatarVariants'
import { STAGE_SCENES } from './stageContent'
import {
  FEET_Y,
  HUD_DOCK_H,
  backdropBox,
  horizonRow,
  HEAD_AIR,
  HUD_CROWN_ROW,
  HUD_HEAD_SHARE,
  REST_HALF_WIDTH,
  SELECT_MIN_WIDTH,
  headHeight,
  hudFraming,
  isStagePath,
  restCrown,
  rowToWorldY,
  stageFraming,
  stageLayout,
  type StageBand,
} from './stageLayout'

const families = [...new Set(OFFERED_VARIANTS.map((v) => familyOf(v.id)))]

// The bands AvatarStagePage computes for the character select: its narrowest
// screen, a laptop, a common desktop and a large monitor.
const BANDS: Record<string, StageBand> = {
  'narrow 1024x768': { w: 1024, h: 768, top: 72 + 12, bottom: 768 - 24, width: 1024 - 380 - 300 - 48 },
  'laptop 1280x720': { w: 1280, h: 720, top: 72 + 12, bottom: 720 - 24, width: 1280 - 380 - 300 - 48 },
  'desktop 1440x900': { w: 1440, h: 900, top: 72 + 12, bottom: 900 - 24, width: 1440 - 380 - 300 - 48 },
  'monitor 2560x1440': { w: 2560, h: 1440, top: 72 + 12, bottom: 1440 - 24, width: 2560 - 380 - 300 - 48 },
}

/** Half the world width visible at the subject plane across `px` pixels, centred. */
function halfWidthAt(distance: number, h: number, px: number): number {
  const span = 2 * distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180))
  return (px / 2) * (span / h)
}

describe('stageFraming', () => {
  it('has a family to frame', () => {
    expect(families.length).toBeGreaterThan(0)
  })

  for (const [name, band] of Object.entries(BANDS)) {
    for (const family of families) {
      it(`fits ${family} head to feet inside the ${name} band`, () => {
        const f = stageFraming(band, family)
        const crown = restCrown(family) + HEAD_AIR
        // Soles on the band's bottom row, always.
        expect(rowToWorldY(f, band.h, band.bottom)).toBeCloseTo(FEET_Y, 4)
        // The crown (with its air) at or below the band's top row: on the top
        // row when height decides, lower when the band's width does.
        expect(rowToWorldY(f, band.h, band.top)).toBeGreaterThanOrEqual(crown - 1e-6)
        // And her resting width inside the band's width.
        expect(halfWidthAt(f.distance, band.h, band.width)).toBeGreaterThanOrEqual(REST_HALF_WIDTH - 1e-6)
        // One of the two is tight, or she is smaller than she needs to be.
        const heightTight = Math.abs(rowToWorldY(f, band.h, band.top) - crown) < 1e-6
        const widthTight = Math.abs(halfWidthAt(f.distance, band.h, band.width) - REST_HALF_WIDTH) < 1e-6
        expect(heightTight || widthTight).toBe(true)
      })
    }
  }

  it('reads each body its own crown', () => {
    const band = BANDS['desktop 1440x900']
    const crowns = families.map((f) => restCrown(f))
    // Bodies of different heights exist among the offered looks, so a shared
    // constant would crop the tallest or float the shortest.
    expect(Math.max(...crowns) - Math.min(...crowns)).toBeGreaterThan(0.02)
    const tallest = families[crowns.indexOf(Math.max(...crowns))]
    const shortest = families[crowns.indexOf(Math.min(...crowns))]
    expect(stageFraming(band, tallest).distance).toBeGreaterThan(stageFraming(band, shortest).distance)
  })

  it('survives a band with no room at all', () => {
    const f = stageFraming({ w: 300, h: 200, top: 150, bottom: 150, width: 0 }, families[0])
    expect(Number.isFinite(f.distance)).toBe(true)
    expect(Number.isFinite(f.lookAtY)).toBe(true)
  })
})

describe('hudFraming', () => {
  // Phones held upright, from the smallest the site supports to a tablet.
  const HEIGHTS = [640, 740, 844, 932, 1180]

  for (const family of families) {
    it(`puts ${family}'s crown and chin where the reference has them`, () => {
      for (const h of HEIGHTS) {
        const f = hudFraming(h, family)
        const crownRow = HUD_CROWN_ROW * h
        const chinRow = (HUD_CROWN_ROW + HUD_HEAD_SHARE) * h
        expect(rowToWorldY(f, h, crownRow), `${h}px crown`).toBeCloseTo(restCrown(family), 4)
        expect(rowToWorldY(f, h, chinRow), `${h}px chin`).toBeCloseTo(restCrown(family) - headHeight(family), 4)
      }
    })
  }

  it('shows her larger than the whole-figure framing would', () => {
    // The reason it exists: head to toe on a phone left her face too small.
    for (const family of families) {
      const whole = stageFraming({ w: 390, h: 844, top: 80, bottom: 844 - 200, width: 366 }, family)
      expect(hudFraming(844, family).distance).toBeLessThan(whole.distance * 0.8)
    }
  })

  it('measures a head for every body, in the range a VRoid head falls in', () => {
    for (const family of families) {
      expect(headHeight(family), family).toBeGreaterThan(0.2)
      expect(headHeight(family), family).toBeLessThan(0.35)
    }
  })
})

describe('stageLayout', () => {
  it('gives phones and upright tablets the HUD and wider screens the character select', () => {
    expect(stageLayout(360)).toBe('hud')
    expect(stageLayout(820)).toBe('hud')
    expect(stageLayout(SELECT_MIN_WIDTH - 1)).toBe('hud')
    expect(stageLayout(SELECT_MIN_WIDTH)).toBe('select')
    expect(stageLayout(1440)).toBe('select')
  })
})

describe('isStagePath', () => {
  const prefixes = ['', '/zh-TW', '/ja']

  it('matches the page under every locale, with or without a trailing slash', () => {
    for (const p of ['/avatar', '/avatar/', '/zh-TW/avatar', '/ja/avatar/']) {
      expect(isStagePath(p, prefixes), p).toBe(true)
    }
  })

  it('matches nothing else', () => {
    for (const p of ['/', '/about', '/zh-TW', '/avatars', '/avatar/x', '/fr/avatar', '/projects/avatar']) {
      expect(isStagePath(p, prefixes), p).toBe(false)
    }
  })
})

describe('the stage placement', () => {
  it('has no measured frame, so no clip pans the camera off the whole figure', () => {
    // The widget's frames pan up to 0.28m to follow a clip; on the stage that
    // would lift her feet off the bottom of the band stageFraming fits.
    expect(motionFrame('stage')).toBeNull()
  })
})

describe('the backdrop against her', () => {
  // Where a far point level with the camera lands, through a camera set up the
  // way the engine sets its own (position over the look-at point, lookAt).
  const drawnHorizon = (distance: number, lookAtY: number, w: number, h: number): number => {
    const cam = new THREE.PerspectiveCamera(AVATAR_FOV, w / h, 0.1, 5000)
    cam.position.set(0, lookAtY + AVATAR_CAMERA_TILT, distance)
    cam.lookAt(0, lookAtY, 0)
    cam.updateMatrixWorld()
    const p = new THREE.Vector3(0, lookAtY + AVATAR_CAMERA_TILT, distance - 4000).project(cam)
    return ((1 - p.y) / 2) * h
  }
  const phone = { w: 390, h: 844 }
  const desk = { w: 1440, h: 900 }
  // Wider than the pictures: only here does covering the width set the size.
  const wide = { w: 2560, h: 1080 }
  const wideBand: StageBand = { w: 2560, h: 1080, top: 72 + 12, bottom: 1080 - 24, width: 2560 - 380 - 300 - 48 }

  it('finds the row the camera draws its horizon on', () => {
    for (const family of families) {
      const f = hudFraming(phone.h, family)
      expect(Math.abs(horizonRow(f, phone.h) - drawnHorizon(f.distance, f.lookAtY, phone.w, phone.h))).toBeLessThan(0.5)
    }
  })

  it.each(families)("puts every scene's eye level on the camera's horizon, and covers the screen down to the dock, on %s", (family) => {
    const setups = [
      { view: phone, framing: hudFraming(phone.h, family), floor: phone.h - HUD_DOCK_H },
      { view: desk, framing: stageFraming(BANDS['desktop 1440x900'], family), floor: desk.h },
      { view: wide, framing: stageFraming(wideBand, family), floor: wide.h },
    ]
    for (const { view, framing, floor } of setups) {
      const row = horizonRow(framing, view.h)
      for (const scene of STAGE_SCENES) {
        const box = backdropBox(view, row, scene.horizon, floor)
        expect(box.top + scene.horizon * box.height, scene.id).toBeCloseTo(row, 6)
        expect(box.top, `${scene.id} leaves the top bare`).toBeLessThanOrEqual(0)
        expect(box.top + box.height, `${scene.id} stops short`).toBeGreaterThanOrEqual(floor - 1e-6)
        expect((box.height * 16) / 9, `${scene.id} leaves the sides bare`).toBeGreaterThanOrEqual(view.w)
      }
    }
  })

  it('no longer leaves a scene looking up at her from her knees on a phone', () => {
    // The owner's complaint, in her own terms: with the picture at the bottom
    // 80% of the screen, every eye level cut Sendagaya Shibu at 0.67–1.02m
    // while the camera stood at 1.21m. Now each cuts her where the camera is.
    const f = hudFraming(phone.h, 'vroid-sendagaya-shibu')
    const row = horizonRow(f, phone.h)
    for (const scene of STAGE_SCENES) {
      const old = phone.h * 0.2 + scene.horizon * 0.8 * phone.h
      expect(rowToWorldY(f, phone.h, old), `${scene.id}, the old way`).toBeLessThan(1.05)
      const box = backdropBox(phone, row, scene.horizon, phone.h - HUD_DOCK_H)
      expect(rowToWorldY(f, phone.h, box.top + scene.horizon * box.height), scene.id).toBeCloseTo(rowToWorldY(f, phone.h, row), 6)
      expect(rowToWorldY(f, phone.h, row)).toBeGreaterThan(1.15)
    }
  })

  it('keeps the pictures pulled back on a phone', () => {
    // The owner, 2026-09-30, before the horizon: "the background could zoom
    // out a little on a phone, it looks too close". Covering the whole height,
    // a phone saw 26% of a picture's width. The eye level now fixes where each
    // picture sits, and reaching down only to the dock keeps them as far back
    // as that allows: 27–32% of the width, and 20% of moon-beach, whose eye
    // level sits lowest. Reaching down to the screen's foot would show 18–25%
    // (13% of moon-beach).
    const f = hudFraming(phone.h, 'vroid-sendagaya-shibu')
    const row = horizonRow(f, phone.h)
    for (const scene of STAGE_SCENES) {
      const box = backdropBox(phone, row, scene.horizon, phone.h - HUD_DOCK_H)
      const shown = phone.w / ((box.height * 16) / 9)
      expect(shown, scene.id).toBeGreaterThan(scene.id === 'moon-beach' ? 0.19 : 0.25)
    }
  })
})
