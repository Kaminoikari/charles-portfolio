// The /avatar page's promise is "always the whole figure". These hold the
// framing to it in canvas rows, for every body a visitor can pick and for the
// bands both layouts actually leave free, so a taller body, a new phone size
// or a thicker dock that would crop her head or feet fails here rather than on
// a screen.
import { describe, expect, it } from 'vitest'
import { AVATAR_FOV } from '../chat/avatarMode'
import { motionFrame } from '../chat/avatarMotions'
import { OFFERED_VARIANTS, familyOf } from '../chat/avatarVariants'
import {
  FEET_Y,
  HEAD_AIR,
  REST_HALF_WIDTH,
  SELECT_MIN_WIDTH,
  isStagePath,
  restCrown,
  rowToWorldY,
  stageFraming,
  stageLayout,
  type StageBand,
} from './stageLayout'

const families = [...new Set(OFFERED_VARIANTS.map((v) => familyOf(v.id)))]

// The bands AvatarStagePage computes, at the sizes that matter: the smallest
// phone the site supports, a common one, a tablet held upright (still the
// HUD), a laptop and a large monitor (the character select).
const BANDS: Record<string, StageBand> = {
  'phone 360x640': { w: 360, h: 640, top: 60 + 12, bottom: 640 - 180 - 12, width: 360 - 24 },
  'phone 390x844': { w: 390, h: 844, top: 68 + 12, bottom: 844 - 190 - 12, width: 390 - 24 },
  'tablet 820x1180': { w: 820, h: 1180, top: 72 + 12, bottom: 1180 - 190 - 12, width: 820 - 24 },
  'laptop 1280x720': { w: 1280, h: 720, top: 72 + 24, bottom: 720 - 112, width: 1280 - 380 - 300 - 48 },
  'desktop 1440x900': { w: 1440, h: 900, top: 72 + 24, bottom: 900 - 112, width: 1440 - 380 - 300 - 48 },
  'monitor 2560x1440': { w: 2560, h: 1440, top: 72 + 24, bottom: 1440 - 112, width: 2560 - 380 - 300 - 48 },
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

  it('fills a phone by height, not by width', () => {
    // The HUD exists so she fills the screen; if the width rule decided on an
    // ordinary phone she would stand small in the middle of it.
    const band = BANDS['phone 390x844']
    for (const family of families) {
      const f = stageFraming(band, family)
      expect(rowToWorldY(f, band.h, band.top)).toBeCloseTo(restCrown(family) + HEAD_AIR, 4)
    }
  })

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
