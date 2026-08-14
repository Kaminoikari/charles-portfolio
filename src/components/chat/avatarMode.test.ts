import { describe, expect, it } from 'vitest'
import {
  gestureEnvelope,
  headAim,
  stepHeadAim,
  avatarSizeClass,
  avatarViewHalfWidth,
  AVATAR_WIDEST_GESTURE_REACH,
  AVATAR_LAUNCHER_HIT_INSET_PCT,
  AVATAR_LAUNCHER_HIT_CLASS,
  CHAT_PANEL_HEIGHT_CLASS,
  ARM_REST_UPPER_Z,
  ARM_REST_FORE_Z,
  ARM_GESTURE_PEAKS,
  elbowReach,
  widestReach,
  poseReach,
  armReach,
  AVATAR_CANVAS_DOCKED,
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_FRAMING_DEFAULT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_COLUMN_ASPECT,
  avatarColumnBox,
  AVATAR_COLUMN_BODY_FRACTION,
  CHAT_COLUMN_MIN_TRANSCRIPT,
  CHAT_TRANSCRIPT_PADDING,
  CHAT_PANEL_HEADER_H,
  CHAT_PANEL_INSET,
  CHAT_RAIL_W,
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
  // args: (mode, wide ≥880, md ≥768 — the rail's own breakpoint)
  it('stands above the launcher whenever the panel is stowed, any viewport', () => {
    expect(avatarPlacement('minimised', true, true)).toBe('launcher')
    expect(avatarPlacement('minimised', false, false)).toBe('launcher')
  })

  it('stands beside the docked panel only when the viewport has room for both', () => {
    expect(avatarPlacement('docked', true, true)).toBe('beside-panel')
  })

  it('hides while the docked panel covers a narrow (phone) viewport', () => {
    expect(avatarPlacement('docked', false, true)).toBe('hidden')
  })

  it('stands in her own column for any fullscreen takeover above the phone', () => {
    expect(avatarPlacement('fullscreen', true, true)).toBe('column')
    // From the md breakpoint (768px), below the 880px `wide` gate: a tablet
    // window keeps her too, just smaller — avatarColumnBox handles the size.
    expect(avatarPlacement('fullscreen', false, true)).toBe('column')
  })

  it('hides under a phone fullscreen takeover, the one window with no room', () => {
    expect(avatarPlacement('fullscreen', false, false)).toBe('hidden')
  })

  // The regression this pins: 'rail' and its height gates were removed on
  // 2026-08-14 because the column has nothing to collide with. Re-adding a
  // height demotion would silently take her off a short fullscreen window
  // again, where she now stands perfectly well at a reduced size.
  it('keeps her in fullscreen at any viewport height', () => {
    for (const vh of [520, 640, 760, 900, 1400]) {
      expect({ vh, at: avatarPlacement('fullscreen', true, true) }).toEqual({ vh, at: 'column' })
      expect(avatarColumnBox(1440, vh).h).toBeGreaterThan(0)
    }
  })
})

describe('avatarColumnBox', () => {
  const bodyH = (vh: number) => vh - 2 * CHAT_PANEL_INSET - CHAT_PANEL_HEADER_H
  // The TEXT width ChatWidget ends up rendering, not the column that holds it:
  // the padding is what the first version of this helper forgot, and it hid a
  // 48px shortfall against the floor that the browser then showed. Mirrors
  // ChatWidget's own layout — element = min(column, 760 + reserve), text =
  // element − padding − reserve.
  const transcript = (vw: number, vh: number) => {
    const { reserve } = avatarColumnBox(vw, vh)
    const column = vw - 2 * CHAT_PANEL_INSET - CHAT_RAIL_W
    return Math.min(column, 760 + reserve) - CHAT_TRANSCRIPT_PADDING - reserve
  }

  // The headline promise: on a normal laptop she is the full height of the
  // panel body, top of her head just under the header, feet at its floor.
  it('gives her the whole panel body on a window that can pay for it', () => {
    for (const [vw, vh] of [
      [1440, 900],
      [1512, 982],
      [1728, 1117],
      [1920, 1080],
    ]) {
      expect({ vw, h: avatarColumnBox(vw, vh).h }).toEqual({ vw, h: bodyH(vh) })
    }
  })

  // The owner's requirement, stated exactly: narrowing the window must not drop
  // her to some other placement. What that means arithmetically is that her
  // height is CONTINUOUS in the viewport width — a fallback is a step, and a
  // step is what this catches. The slope is 1/(aspect·bodyFraction) ≈ 1.51px of
  // height per px of width, so 2 is just above the real gradient and hundreds
  // below any discrete switch.
  //
  // Full height itself arrives at 1210px, not 1200: at 1200 she gives up 14px
  // of 807. Recorded here because it is a near miss rather than a fact.
  it('changes height continuously as the window narrows, with no fallback step', () => {
    let worst = { vw: 0, jump: 0 }
    for (let vw = 800; vw <= 1600; vw++) {
      const jump = Math.abs(avatarColumnBox(vw + 1, 900).h - avatarColumnBox(vw, 900).h)
      if (jump > worst.jump) worst = { vw, jump }
    }
    expect(worst.jump).toBeLessThan(2)
    expect(avatarColumnBox(1210, 900).h).toBe(bodyH(900))
    expect(bodyH(900) - avatarColumnBox(1200, 900).h).toBeCloseTo(14, 0)
  })

  // Below that the width binds, and the answer is a smaller Mika rather than a
  // different placement. This is the whole reason the old rail fallback could
  // be deleted; a Math.min dropped here would put her head through the header.
  it('shrinks her instead of overrunning a narrow window', () => {
    const box = avatarColumnBox(1024, 900)
    expect(box.h).toBeLessThan(bodyH(900))
    expect(box.h).toBeGreaterThan(300)
    // Width is binding, so the transcript lands exactly on its floor.
    expect(transcript(1024, 900)).toBeCloseTo(CHAT_COLUMN_MIN_TRANSCRIPT, 6)
  })

  it('never squeezes the transcript below its floor, at any viewport', () => {
    for (let vw = 768; vw <= 2560; vw += 64) {
      for (const vh of [520, 700, 900, 1200, 1440]) {
        const left = transcript(vw, vh)
        // Floating point only — the box is derived from this bound.
        expect({ vw, vh, ok: left >= CHAT_COLUMN_MIN_TRANSCRIPT - 1e-9 }).toEqual({
          vw,
          vh,
          ok: true,
        })
      }
    }
  })

  // Whichever axis binds, the box keeps the framing's aspect — that is what
  // stops a narrow window from cropping her arms off instead of scaling her.
  it('holds the aspect and the body fraction while it shrinks', () => {
    for (const [vw, vh] of [
      [1920, 1080],
      [1200, 900],
      [1024, 900],
      [860, 700],
    ]) {
      const box = avatarColumnBox(vw, vh)
      expect(box.w / box.h).toBeCloseTo(AVATAR_COLUMN_ASPECT, 6)
      expect(box.reserve).toBeLessThan(box.w)
      expect(box.reserve / box.w).toBeCloseTo(AVATAR_COLUMN_BODY_FRACTION, 6)
    }
  })

  // A window narrower than the rail plus the floor has a negative budget. She
  // is hidden there by avatarPlacement's md gate, but the box must not answer
  // with a negative canvas — a negative width/height reaches the DOM as an
  // invalid style and the engine's aspect goes NaN.
  it('clamps to zero rather than going negative on an impossible window', () => {
    const box = avatarColumnBox(400, 900)
    expect(box.h).toBe(0)
    expect(box.w).toBe(0)
    expect(box.reserve).toBe(0)
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
  // The column framing's whole job is to spend the headroom the default leaves.
  // Loosen the top edge and the empty gap above her head comes back on an
  // 800px canvas, which is what the recompose was for; drop the bottom edge and
  // it stops being the head-to-knee crop the owner chose.
  it('composes the column tight to her head, keeping the knee', () => {
    const span = avatarViewSpan(AVATAR_FRAMING_COLUMN)
    // Her hair top is 1.582 — above it, but by centimetres rather than the
    // default's 0.14m.
    expect(span.top).toBeGreaterThan(1.582)
    expect(span.top - 1.582).toBeLessThan(0.05)
    // Knee is ~0.40, mid-thigh ~0.62: the cut stays just below the knee.
    expect(span.bottom).toBeLessThan(0.45)
    expect(span.bottom).toBeGreaterThan(0.38)
  })

  // The aspect is not a taste decision, it is that framing's arm room divided
  // by its half-height. Retuning the framing without retuning the aspect is
  // exactly how gestures start clipping, so this derives one from the other.
  it('derives the column aspect from the framing it belongs to', () => {
    const span = avatarViewSpan(AVATAR_FRAMING_COLUMN)
    const halfHeight = (span.top - span.bottom) / 2
    expect(AVATAR_COLUMN_ASPECT).toBeCloseTo(0.484 / halfHeight, 2)
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
      // The column's box is computed, so it is checked at the two viewports
      // that bind it differently: 1440×900 where height decides, and 1024×900
      // where the transcript floor does. The aspect holds either way, which is
      // the property that keeps her arms in frame while she shrinks.
      ['column@1440', AVATAR_FRAMING_COLUMN, avatarColumnBox(1440, 900)],
      ['column@1024', AVATAR_FRAMING_COLUMN, avatarColumnBox(1024, 900)],
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
  it('derives the widest reach from the arm poses the engine actually uses', () => {
    // Rest pose: arms down at her sides, well inside the frame.
    expect(armReach(ARM_REST_UPPER_Z, ARM_REST_FORE_Z)).toBeCloseTo(0.233, 3)
    // The widest is `wave`'s fingertip at 0.393. It used to be `stretch` at
    // 0.409, which was retired on 2026-08-14 for reading as no gesture at all.
    expect(AVATAR_WIDEST_GESTURE_REACH).toBeCloseTo(0.393, 3)
    // A wider pose must demand a wider canvas, not silently start clipping.
    expect(armReach(ARM_REST_UPPER_Z - 0.6, ARM_REST_FORE_Z)).toBeGreaterThan(
      avatarViewHalfWidth(AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_LAUNCHER),
    )
  })

  // Every gesture that moves an arm, not just the widest one. The elbow is
  // checked alongside the fingertip because the poses that fold the forearm
  // back (hands behind her head, a hand on her hip) put their widest point
  // there, and a fingertip-only check waves them straight through.
  it('keeps every arm gesture inside the canvas, elbows included', () => {
    const half = avatarViewHalfWidth(AVATAR_FRAMING_COLUMN, avatarColumnBox(1440, 900))
    for (const [name, g] of Object.entries(ARM_GESTURE_PEAKS)) {
      for (const [side, pose] of Object.entries(g)) {
        if (!pose) continue
        const widest = poseReach(pose)
        expect({ at: `${name}.${side}`, fits: widest < half }).toEqual({
          at: `${name}.${side}`,
          fits: true,
        })
      }
    }
  })

  // The elbow term in widestReach() is inert against the CURRENT table (every
  // fingertip beats every elbow), so nothing else would notice it being
  // deleted. This feeds it a pose where the elbow is the widest point — arm
  // out near horizontal, forearm folded right back — and holds it to that.
  it('measures the elbow when a pose folds the hand back inside it', () => {
    const elbowLed = { fake: { left: { upper: 0.1, fore: 2.6 } } }
    const pose = elbowLed.fake.left
    expect(elbowReach(pose.upper)).toBeGreaterThan(armReach(pose.upper, pose.fore))
    expect(widestReach(elbowLed)).toBeCloseTo(elbowReach(pose.upper), 6)
  })

  // The peaks table is the engine's pose source, so a typo there is a real
  // pose change. These two are the load-bearing ones: `wave` sets the width,
  // and handsBehindHead is the only gesture whose elbow beats its fingertip.
  it('pins the poses the width budget is measured against', () => {
    expect(ARM_GESTURE_PEAKS.wave.right).toEqual({ upper: 0.3, fore: 1.0 })
    const behind = ARM_GESTURE_PEAKS.handsBehindHead.left!
    expect(elbowReach(behind.upper)).toBeGreaterThan(armReach(behind.upper, behind.fore))
  })

  // The owner's report was that a pose "snaps back the moment it arrives".
  // These hold the plateau that fixed it, and hold the ramps to the exact sine
  // the ambient beats were tuned against.
  it('parks a named pose at the full pose for its whole hold', () => {
    // 2s of movement, 3.5s parked: full envelope from the end of the rise to
    // the start of the fall, which is the part the owner asked for.
    for (const t of [1.0, 2.0, 3.0, 4.4]) expect(gestureEnvelope(t, 2, 3.5)).toBe(1)
    // Rises from nothing and returns to nothing, so the arms reach the pins.
    expect(gestureEnvelope(0, 2, 3.5)).toBe(0)
    expect(gestureEnvelope(5.5, 2, 3.5)).toBeCloseTo(0, 6)
    // Half a second in, a quarter of the way up the rise.
    expect(gestureEnvelope(0.5, 2, 3.5)).toBeCloseTo(Math.sin(Math.PI / 4), 6)
  })

  it('leaves a beat with no hold on the sine curve it was tuned with', () => {
    for (const t of [0, 0.4, 1.1, 1.6, 2.2, 2.4]) {
      expect(gestureEnvelope(t, 2.4, 0)).toBeCloseTo(Math.sin((t / 2.4) * Math.PI), 6)
    }
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
    expect(parse(avatarSizeClass('launcher'))).toEqual(AVATAR_CANVAS_LAUNCHER)
    expect(parse(avatarSizeClass('beside-panel'))).toEqual(AVATAR_CANVAS_DOCKED)
  })

  // Her docked height is the panel's height — one number, two literals, because
  // Tailwind's JIT will not take an interpolated one. Raising the panel to
  // 600px and leaving her at 560 would otherwise open a 40px gap above her head
  // that nothing else in the suite looks at. (That the PANEL uses the constant
  // rather than its own copy is held by a ChatWidget test, which renders it.)
  it('sizes the docked canvas to the panel it stands beside', () => {
    const heightExpr = (cls: string) => /(?:^| )h-(\[[^\]]+\])/.exec(cls)?.[1]
    expect(heightExpr(avatarSizeClass('beside-panel'))).toBe(
      heightExpr(CHAT_PANEL_HEIGHT_CLASS),
    )
  })

  // The vh branch has to carry the width ratio too. Height alone tracking the
  // viewport would shrink her while the width stayed at its px cap, handing her
  // arms a metre of empty room on a short screen.
  it('keeps the short-viewport branch on the same proportions', () => {
    const cls = avatarSizeClass('beside-panel')
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
  it('still steps between speaking and idle, so the filter is still load-bearing', () => {
    let worst = 0
    for (let t = 0; t < 60; t += 0.005) {
      worst = Math.max(worst, Math.abs(headAim('idle', t).yaw - headAim('speaking', t).yaw))
    }
    // Was ~0.487rad when idle swept ±0.42. Calming idle to a ±0.08 drift on
    // 2026-08-15 shrank the step to ~0.15rad, which is still 5.6° at the head
    // bone in a single frame, so the smoothing below stays.
    expect(worst).toBeGreaterThan(0.13)
    expect(worst).toBeLessThan(0.2)
  })

  // What the owner asked for on 2026-08-15: she should stop swinging her head
  // while nothing is happening. A sweep is easy to reintroduce by nudging one
  // amplitude, and nothing else would notice.
  it('keeps her facing the viewer while idle', () => {
    let worst = 0
    for (let t = 0; t < 120; t += 0.01) worst = Math.max(worst, Math.abs(headAim('idle', t).yaw))
    // 0.12rad of aim is 4.5° at the head bone: a drift, not a sweep.
    expect(worst).toBeLessThan(0.12)
    // And not frozen — she is a character, not a photograph.
    expect(worst).toBeGreaterThan(0.02)
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

  it('leaves the idle drift itself essentially untouched', () => {
    // Smoothing that fixes the step must not flatten the drift it rides on.
    // Held as a RATIO of the raw amplitude so retuning idle cannot quietly
    // turn this into a test of the amplitude instead of a test of the filter.
    const dt = 1 / 60
    let v = 0
    let peak = 0
    let raw = 0
    for (let t = 0; t < 60; t += dt) {
      const target = headAim('idle', t).yaw
      v = stepHeadAim(v, target, dt)
      if (t > 10) {
        peak = Math.max(peak, Math.abs(v))
        raw = Math.max(raw, Math.abs(target))
      }
    }
    expect(peak / raw).toBeGreaterThan(0.95)
  })
})
