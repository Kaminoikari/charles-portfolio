import { describe, expect, it } from 'vitest'
import {
  headAim,
  stepHeadAim,
  avatarSizeClass,
  avatarViewHalfWidth,
  AVATAR_WIDEST_GESTURE_REACH,
  AVATAR_LAUNCHER_HIT_INSET_PCT,
  AVATAR_LAUNCHER_HIT_CLASS,
  AVATAR_RAIL_SCALE_ANCHOR_H,
  CHAT_PANEL_HEIGHT_CLASS,
  ARM_REST_UPPER_Z,
  ARM_REST_FORE_Z,
  STRETCH_ARM_FLARE,
  armReach,
  AVATAR_CANVAS_DOCKED,
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_CANVAS_RAIL,
  AVATAR_FRAMING_DEFAULT,
  AVATAR_FRAMING_RAIL,
  avatarMetresPerPixel,
  avatarViewSpan,
  deriveAvatarMode,
  avatarGuideEnabled,
  avatarPlacement,
} from './avatarMode'
import type { AvatarFraming } from './avatarMode'

describe('deriveAvatarMode', () => {
  it('is idle with empty input and no stream', () => {
    expect(deriveAvatarMode('', 'idle')).toBe('idle')
    expect(deriveAvatarMode('', 'error')).toBe('idle')
  })

  it('is listening while the visitor has typed anything', () => {
    expect(deriveAvatarMode('R', 'idle')).toBe('listening')
    expect(deriveAvatarMode('RAG 怎麼設計', 'idle')).toBe('listening')
  })

  it('treats whitespace-only input as typing too (IME composition often is)', () => {
    expect(deriveAvatarMode(' ', 'idle')).toBe('listening')
  })

  it('is speaking for the whole streaming window, regardless of input', () => {
    expect(deriveAvatarMode('', 'streaming')).toBe('speaking')
    expect(deriveAvatarMode('下一題打到一半', 'streaming')).toBe('speaking')
  })
})

describe('avatarPlacement', () => {
  // args: (mode, wide ≥880, tall ≥640, md ≥768 — the rail's own breakpoint)
  it('stands above the launcher whenever the panel is stowed, any viewport', () => {
    expect(avatarPlacement('minimised', true, true, true)).toBe('launcher')
    expect(avatarPlacement('minimised', false, false, false)).toBe('launcher')
  })

  it('stands beside the docked panel only when the viewport has room for both', () => {
    expect(avatarPlacement('docked', true, true, true)).toBe('beside-panel')
    // Width decides the docked case; a short-but-wide window still has the
    // side column free, so height does not demote it.
    expect(avatarPlacement('docked', true, false, true)).toBe('beside-panel')
  })

  it('hides while the docked panel covers a narrow (phone) viewport', () => {
    expect(avatarPlacement('docked', false, true, true)).toBe('hidden')
  })

  it('stands in the pipeline rail during a tall fullscreen takeover with a rail', () => {
    expect(avatarPlacement('fullscreen', true, true, true)).toBe('rail')
    // The rail exists from the md breakpoint (768px), below the 880px `wide`
    // gate — she stands wherever the rail does (768–880px tablet windows).
    expect(avatarPlacement('fullscreen', false, true, true)).toBe('rail')
  })

  it('hides under a phone fullscreen takeover (no rail exists there)', () => {
    expect(avatarPlacement('fullscreen', false, true, false)).toBe('hidden')
  })

  it('hides in a short fullscreen window, where she would collide with the pipeline', () => {
    expect(avatarPlacement('fullscreen', true, false, true)).toBe('hidden')
  })
})

function fakeMatchMedia(matches: Record<string, boolean>) {
  return (q: string) => ({ matches: matches[q] ?? false })
}

describe('avatarGuideEnabled', () => {
  const on = {
    matchMedia: fakeMatchMedia({ '(prefers-reduced-motion: reduce)': false }),
    webgl: () => true,
  }

  it('turns on for any visitor with motion allowed and WebGL2 — mobile included', () => {
    expect(avatarGuideEnabled(on)).toBe(true)
  })

  it('stays off under prefers-reduced-motion', () => {
    expect(
      avatarGuideEnabled({
        ...on,
        matchMedia: fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }),
      }),
    ).toBe(false)
  })

  it('stays off without WebGL2', () => {
    expect(avatarGuideEnabled({ ...on, webgl: () => false })).toBe(false)
  })

  it('never probes WebGL unless the cheaper reduced-motion gate already passed', () => {
    // The probe creates a real GL context, so reduced-motion visitors (who will
    // never see the avatar) must not pay that cost.
    let probed = 0
    const webgl = () => {
      probed++
      return true
    }
    avatarGuideEnabled({
      ...on,
      matchMedia: fakeMatchMedia({ '(prefers-reduced-motion: reduce)': true }),
      webgl,
    })
    expect(probed).toBe(0)
    avatarGuideEnabled({ ...on, webgl })
    expect(probed).toBe(1)
  })
})

describe('avatar camera framing', () => {
  // The rail hands her a taller canvas so more of her legs fit, and the dolly
  // that comes with it exists so the extra height does not also magnify her.
  // The scale it holds her to is AVATAR_RAIL_SCALE_ANCHOR_H's, read through the
  // default framing — resize the rail canvas without moving the distance and
  // she silently grows on the one screen with the least room to spare.
  it('holds the rail to the scale its dolly was composed against', () => {
    const anchor = avatarMetresPerPixel(AVATAR_FRAMING_DEFAULT, AVATAR_RAIL_SCALE_ANCHOR_H)
    const rail = avatarMetresPerPixel(AVATAR_FRAMING_RAIL, AVATAR_CANVAS_RAIL.h)
    // Within 0.02mm per pixel, i.e. under 1% of the ~3.23mm/px scale.
    expect(rail * 1000).toBeCloseTo(anchor * 1000, 1)
  })

  // The docked canvas is the one placement that deliberately does NOT hold that
  // scale: it is sized to the panel standing beside it, so she grows when the
  // chat opens. Two things make that a scale-up rather than a re-crop or a
  // stretch — she keeps AVATAR_FRAMING_DEFAULT (so the world span is untouched
  // and the growth is exactly the height ratio) and the box keeps the
  // launcher's proportions. Giving the docked placement its own framing, or
  // rounding the width off the ratio, breaks one of these.
  it('scales her up to the panel height, in proportion', () => {
    const launcher = avatarMetresPerPixel(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER.h)
    const docked = avatarMetresPerPixel(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_DOCKED.h)
    // Fewer metres per pixel = larger on screen, by the height ratio and
    // nothing else.
    expect(launcher / docked).toBeCloseTo(AVATAR_CANVAS_DOCKED.h / AVATAR_CANVAS_LAUNCHER.h, 6)
    expect(launcher / docked).toBeGreaterThan(1.5)
    // Same proportions, so she scales rather than stretches: within half a
    // percent of the launcher's aspect, which is all a whole-pixel width allows.
    const aspect = (c: { w: number; h: number }) => c.w / c.h
    expect(aspect(AVATAR_CANVAS_DOCKED)).toBeCloseTo(aspect(AVATAR_CANVAS_LAUNCHER), 2)
  })

  it('spends the rail canvas extra height below her, not as headroom', () => {
    const docked = avatarViewSpan(AVATAR_FRAMING_DEFAULT)
    const rail = avatarViewSpan(AVATAR_FRAMING_RAIL)
    // Same top edge: her head keeps its clearance instead of drifting down.
    expect(rail.top).toBeCloseTo(docked.top, 2)
    // Bottom edge drops from mid-thigh (~0.62) past the knee (~0.40).
    expect(docked.bottom).toBeGreaterThan(0.55)
    expect(rail.bottom).toBeLessThan(0.45)
  })

  it('keeps the launcher framing where the head has clearance', () => {
    const span = avatarViewSpan(AVATAR_FRAMING_DEFAULT)
    // Her hair top is at y≈1.582; anything below that crops her head.
    expect(span.top).toBeGreaterThan(1.6)
    // And the launcher canvas is the one the default framing was composed for.
    expect(AVATAR_CANVAS_LAUNCHER.h).toBe(280)
  })

  it('shows her whole arm span, with margin, in every placement', () => {
    const frames: Array<[string, AvatarFraming, { w: number; h: number }]> = [
      ['launcher', AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER],
      ['docked', AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_DOCKED],
      ['rail', AVATAR_FRAMING_RAIL, AVATAR_CANVAS_RAIL],
    ]
    for (const [name, framing, canvas] of frames) {
      const half = avatarViewHalfWidth(framing, canvas)
      // 15% past the fingertip, for the hand's own width and for hair the
      // spring bones throw outward mid-gesture.
      const clears = half > AVATAR_WIDEST_GESTURE_REACH * 1.15
      expect({ [name]: clears }).toEqual({ [name]: true })
      // Sized for that and not accidentally enormous: all three land on the
      // same half-width, so she has the same room in every placement.
      expect(half).toBeCloseTo(0.484, 2)
    }
  })

  // The reach is derived from the pose numbers the ENGINE uses, so a gesture
  // widened there moves it. Without that link the reach was hand-transcribed
  // and a wider stretch would clip again with the suite green.
  it('derives the widest reach from the arm pose the engine actually uses', () => {
    // Rest pose: arms down at her sides, well inside the frame.
    expect(armReach(ARM_REST_UPPER_Z, ARM_REST_FORE_Z)).toBeCloseTo(0.233, 3)
    // Stretch flares the upper arm out of that pin; this is what sets the width.
    expect(AVATAR_WIDEST_GESTURE_REACH).toBeCloseTo(0.409, 3)
    expect(AVATAR_WIDEST_GESTURE_REACH).toBe(
      armReach(ARM_REST_UPPER_Z - STRETCH_ARM_FLARE, ARM_REST_FORE_Z),
    )
    // A wider flare must demand a wider canvas, not silently start clipping.
    expect(armReach(ARM_REST_UPPER_Z - 0.6, ARM_REST_FORE_Z)).toBeGreaterThan(
      avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
    )
  })

  // The click target is a percentage of a width, so it only stays ~180px while
  // that width is 245. Nothing else ties the two together.
  it('keeps the launcher click target on her, not on the gesture margin', () => {
    // The class ChatWidget applies and the number must agree, or the constant
    // pins nothing — the class is what actually reaches the DOM.
    const pct = /left-\[(\d+)%\] right-\[(\d+)%\]/.exec(AVATAR_LAUNCHER_HIT_CLASS)
    expect(pct).not.toBeNull()
    expect(Number(pct![1])).toBe(AVATAR_LAUNCHER_HIT_INSET_PCT)
    expect(Number(pct![2])).toBe(AVATAR_LAUNCHER_HIT_INSET_PCT)
    const inset = AVATAR_LAUNCHER_HIT_INSET_PCT / 100
    const targetPx = AVATAR_CANVAS_LAUNCHER.w * (1 - 2 * inset)
    // Her resting silhouette is ~148px wide; the margin either side is hers to
    // swing into and must not be a button.
    expect(targetPx).toBeGreaterThan(160)
    expect(targetPx).toBeLessThan(200)
  })

  // The Tailwind literals and the constants are two spellings of one number,
  // and Tailwind's JIT forbids deriving one from the other. Without this, a
  // width edited in only one of the two places goes unnoticed.
  it('keeps the size classes and the canvas constants in step', () => {
    // Two shapes to read: a plain px box, and the docked box's min(px, vh)
    // pair, whose px branch is the uncapped size the constants record.
    const parse = (cls: string) => {
      const axis = (a: string) => {
        const m = new RegExp(`(?:^| )${a}-\\[(?:min\\()?(\\d+)px`).exec(cls)
        if (!m) throw new Error(`unparseable size class: ${cls}`)
        return Number(m[1])
      }
      return { w: axis('w'), h: axis('h') }
    }
    expect(parse(avatarSizeClass('launcher', true))).toEqual(AVATAR_CANVAS_LAUNCHER)
    expect(parse(avatarSizeClass('beside-panel', true))).toEqual(AVATAR_CANVAS_DOCKED)
    expect(parse(avatarSizeClass('rail', true))).toEqual(AVATAR_CANVAS_RAIL)
    // A short viewport drops the rail back to the launcher box.
    expect(parse(avatarSizeClass('rail', false))).toEqual(AVATAR_CANVAS_LAUNCHER)
  })

  // Her docked height is the panel's height — one number, two literals, because
  // Tailwind's JIT will not take an interpolated one. Raising the panel to
  // 600px and leaving her at 560 would otherwise open a 40px gap above her head
  // that nothing else in the suite looks at. (That the PANEL uses the constant
  // rather than its own copy is held by a ChatWidget test, which renders it.)
  it('sizes the docked canvas to the panel it stands beside', () => {
    const heightExpr = (cls: string) => /(?:^| )h-(\[[^\]]+\])/.exec(cls)?.[1]
    expect(heightExpr(avatarSizeClass('beside-panel', true))).toBe(
      heightExpr(CHAT_PANEL_HEIGHT_CLASS),
    )
  })

  // The vh branch has to carry the width ratio too. Height alone tracking the
  // viewport would shrink her while the width stayed at its px cap, handing her
  // arms a metre of empty room on a short screen.
  it('keeps the short-viewport branch on the same proportions', () => {
    const cls = avatarSizeClass('beside-panel', true)
    const vh = (a: string) => {
      const m = new RegExp(`(?:^| )${a}-\\[min\\(\\d+px,([\\d.]+)vh\\)`).exec(cls)
      if (!m) throw new Error(`no vh branch on ${a}: ${cls}`)
      return Number(m[1])
    }
    expect(vh('w') / vh('h')).toBeCloseTo(AVATAR_CANVAS_DOCKED.w / AVATAR_CANVAS_DOCKED.h, 3)
  })
})

describe('head aim across mode changes', () => {
  // The bug this guards: each mode is its own sine pair on a shared clock, so
  // the raw value jumps the frame the mode flips. Reported as "she snaps to a
  // disconnected angle the moment she finishes speaking".
  it('has a large raw discontinuity between speaking and idle', () => {
    let worst = 0
    for (let t = 0; t < 60; t += 0.005) {
      worst = Math.max(worst, Math.abs(headAim('idle', t).yaw - headAim('speaking', t).yaw))
    }
    // ~0.487rad = 27.9° of yaw, 18° once the head bone's 0.65 share is applied.
    expect(worst).toBeGreaterThan(0.45)
  })

  it('settles a mode change over a few tenths of a second, not one frame', () => {
    const dt = 1 / 60
    const from = headAim('speaking', 40.33).yaw
    const to = headAim('idle', 40.33).yaw
    let v = from
    let frames = 0
    while (Math.abs(to - v) > Math.abs(to - from) * 0.1 && frames < 600) {
      v = stepHeadAim(v, to, dt)
      frames++
    }
    const seconds = frames / 60
    expect(seconds).toBeGreaterThan(0.2) // a snap would be ~0.02s
    expect(seconds).toBeLessThan(0.8) // and a drift would read as lag
  })

  it('leaves the idle sweep itself essentially untouched', () => {
    // Smoothing that fixes the step must not flatten the 5.2s sweep it rides on.
    const dt = 1 / 60
    let v = 0
    let peak = 0
    for (let t = 0; t < 30; t += dt) {
      v = stepHeadAim(v, headAim('idle', t).yaw, dt)
      if (t > 10) peak = Math.max(peak, Math.abs(v)) // skip the initial settle
    }
    expect(peak).toBeGreaterThan(0.4) // raw amplitude is 0.42
  })
})
