// The /avatar page's two compositions, held in canvas rows for every body a
// visitor can pick: on a phone her head at the size and height of the owner's
// reference, in the character select the whole figure inside the band the
// panels leave free. A taller body, a new screen size or a moved panel that
// would break either fails here rather than on a screen.
import { describe, expect, it } from 'vitest'
import { AVATAR_FOV } from '../chat/avatarMode'
import { motionFrame } from '../chat/avatarMotions'
import { OFFERED_VARIANTS, familyOf } from '../chat/avatarVariants'
import {
  FEET_Y,
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
