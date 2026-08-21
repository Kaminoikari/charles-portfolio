import { describe, expect, it } from 'vitest'
import {
  AVATAR_BUBBLE_RIGHT_CLASS,
  AVATAR_BUBBLE_RIGHT_PX,
  AVATAR_CANVAS_DOCKED,
  AVATAR_CANVAS_LAUNCHER,
  AVATAR_ARM_ROOM,
  AVATAR_COLUMN_ASPECT,
  AVATAR_COLUMN_BODY_FRACTION,
  AVATAR_COLUMN_BODY_GAP,
  AVATAR_COLUMN_BODY_RIGHT,
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  AVATAR_LAUNCHER_BODY_FRACTION,
  AVATAR_LAUNCHER_HIT_CLASS,
  AVATAR_LAUNCHER_HIT_INSET_PCT,
  avatarColumnBox,
  avatarColumnRightInset,
  avatarGuideEnabled,
  AVATAR_HEAD_BOTTOM_Y,
  AVATAR_HEAD_TOP_Y,
  avatarHeadBand,
  avatarMetresPerPixel,
  avatarPlacement,
  avatarSizeClass,
  avatarViewHalfWidth,
  avatarViewSpan,
  besidePanelScale,
  CHAT_BESIDE_PANEL_RIGHT,
  CHAT_COLUMN_MIN_TRANSCRIPT,
  CHAT_PANEL_HEADER_H,
  CHAT_PANEL_HEIGHT_CLASS,
  CHAT_PANEL_INSET,
  CHAT_RAIL_W,
  CHAT_TRANSCRIPT_PADDING,
  deriveAvatarMode,
  EMOTION_RECIPES,
  emotionChannelValues,
  FACE_PALE_TINT,
  gestureEnvelope,
  headAim,
  stepFramePan,
  stepHeadAim,
} from './avatarMode'
import type { AvatarFraming } from './avatarMode'
import { FACE_BOX } from './rigProbe'

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

describe('fullscreen avatar optical alignment', () => {
  // The width after her figure scales with the canvas, so a FIXED inset cannot
  // hold her against the edge: -48px left her 194px short at 1920x1080 and cut
  // 14px off her at 768x1024. What is pinned here is the outcome the owner
  // asked for — her body flush with the panel's inner right edge — at every
  // size the column can take.
  const bodyEdgeFromViewportRight = (vw: number, vh: number): number => {
    const { w } = avatarColumnBox(vw, vh)
    const margin = w * (1 - AVATAR_COLUMN_BODY_RIGHT)
    return margin + avatarColumnRightInset(w)
  }

  it.each([
    [1920, 1080],
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [900, 900],
    [768, 1024],
  ])('stands her body against the panel edge at %ix%i', (vw, vh) => {
    expect(bodyEdgeFromViewportRight(vw, vh)).toBeCloseTo(
      CHAT_PANEL_INSET + AVATAR_COLUMN_BODY_GAP,
      6,
    )
  })

  it('never lets the canvas hang out so far that her body leaves the screen', () => {
    for (let vw = 768; vw <= 2560; vw += 16) {
      expect(bodyEdgeFromViewportRight(vw, 900)).toBeGreaterThanOrEqual(0)
    }
  })

  it('stops hanging out at all once the margin is smaller than where she stands', () => {
    // A canvas this narrow has less transparent margin than the inset and gap
    // together, so there is nothing to absorb and she simply stands inside.
    expect(avatarColumnRightInset(10)).toBe(0)
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
    // Above her hair top, but by centimetres rather than the default's 0.14m.
    expect(span.top).toBeGreaterThan(AVATAR_HEAD_TOP_Y)
    expect(span.top - AVATAR_HEAD_TOP_Y).toBeLessThan(0.05)
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
    expect(AVATAR_COLUMN_ASPECT).toBeCloseTo(AVATAR_ARM_ROOM / halfHeight, 2)
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

  // The head-pat hit test used to carry the band as two hardcoded canvas
  // percentages, measured once against lookAtY 1.17. Raising the frame to 1.32
  // on 2026-08-20 moved her head down inside the canvas and slid the band off
  // the part of it a pat lands on, silently: still her crown in the waist-up
  // frame, her chin and mouth in the column, and drifting again on the next
  // dolly. These hold the band to the FRAMING instead, in both placements.
  // AVATAR_HEAD_BOTTOM_Y is a hand-copy of a measurement that lives somewhere
  // else. Replacing a literal with a constant in the file that reads it is not
  // convergence: re-measuring the model updates rigProbe's box and would leave
  // the band's chin behind, silently, which is the exact class of drift the
  // band was rewritten to stop. This is the only thing that would notice.
  it('takes her chin from the same box rigProbe measures fingers against', () => {
    expect(AVATAR_HEAD_BOTTOM_Y).toBe(FACE_BOX.min.y)
  })

  describe('avatarHeadBand', () => {
    const cases = [
      ['waist-up', AVATAR_FRAMING_DEFAULT, AVATAR_CANVAS_DOCKED],
      ['column', AVATAR_FRAMING_COLUMN, { w: 800, h: 745 }],
    ] as const

    for (const [name, framing, canvas] of cases) {
      // Fractions of the canvas, so the test speaks the same units the hit test
      // does, and converting back to metres is what proves they mean her head.
      const yOf = (fraction: number) => {
        const span = avatarViewSpan(framing)
        return span.top - (span.top - span.bottom) * fraction
      }

      it(`puts the ${name} band on her head, from hair top to chin`, () => {
        const band = avatarHeadBand(framing, canvas)
        // Top edge clears her hair without floating far above it.
        expect(yOf(band.top)).toBeGreaterThan(AVATAR_HEAD_TOP_Y)
        expect(yOf(band.top) - AVATAR_HEAD_TOP_Y).toBeLessThan(0.06)
        // Bottom edge reaches her chin and stops short of her collarbone.
        expect(yOf(band.bottom)).toBeCloseTo(AVATAR_HEAD_BOTTOM_Y, 3)
        expect(yOf(band.bottom)).toBeGreaterThan(1.2)
      })

      it(`keeps the ${name} band inside the canvas and wider than her face`, () => {
        const band = avatarHeadBand(framing, canvas)
        expect(band.top).toBeGreaterThanOrEqual(0)
        expect(band.bottom).toBeLessThanOrEqual(1)
        expect(band.bottom).toBeGreaterThan(band.top)
        // Her face is ±0.092m; the band has to cover the hair around it and
        // stay well inside the arm room, which is where her hands swing.
        const metresFromCentre = band.halfWidth * canvas.w
          * avatarMetresPerPixel(framing, canvas.h)
        expect(metresFromCentre).toBeGreaterThan(0.092)
        expect(metresFromCentre).toBeLessThan(AVATAR_ARM_ROOM)
      })
    }
  })

  it('keeps the launcher framing where the head has clearance', () => {
    const span = avatarViewSpan(AVATAR_FRAMING_DEFAULT)
    // Anything below her hair top crops her head.
    expect(span.top).toBeGreaterThan(AVATAR_HEAD_TOP_Y)
    // And the launcher canvas is the one the default framing was composed for.
    expect(AVATAR_CANVAS_LAUNCHER.h).toBe(280)
  })

  // The canvas is a wide box with a lot of transparent air in it, and this is
  // what holds every placement to the SAME amount of air. What that width has
  // to contain is no longer computed here: rigProbe.test.ts measures each
  // motion-capture clip against this exact half-width on the real skeleton.
  it('gives her the same arm room in every placement', () => {
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
      // All four land on the same half-width, so a clip cleared in one
      // placement is cleared in all of them.
      expect({ [name]: half }).toEqual({ [name]: expect.closeTo(AVATAR_ARM_ROOM, 2) })
    }
  })

  // gestureEnvelope's plateau: no bundled beat uses it today (they are all pure
  // sine), but it is the shape any held pose needs, so it stays proven.
  it('parks a pose at the full envelope for its whole hold', () => {
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

  // The docked canvas is wider than the gap left of the panel on a narrow
  // desktop window, so it has to shrink. Without this the 2026-08-15 widening
  // pushed 226px of canvas, including 26px of her shoulder, off the left edge at
  // 900px — a fix for one kind of clipping that caused another.
  //
  // What must stay on screen is HER, not the canvas. Until 2026-08-20 the two
  // were the same assertion, because the scale divided by the full canvas. The
  // arm-room widening that day added 68px of transparent margin either side, and
  // defending those empty pixels would have shrunk her 9% at 1120px, where she
  // is full size today. So the margin may hang off the left edge and her body
  // may not.
  it('shrinks the docked canvas rather than running HER off the screen', () => {
    const canvasLeft = (vw: number) =>
      vw - CHAT_BESIDE_PANEL_RIGHT - AVATAR_CANVAS_DOCKED.w * besidePanelScale(vw)
    // Her body is centred in the canvas and covers this fraction of its width.
    const bodyLeft = (vw: number) =>
      canvasLeft(vw) +
      AVATAR_CANVAS_DOCKED.w *
        besidePanelScale(vw) *
        ((1 - AVATAR_LAUNCHER_BODY_FRACTION) / 2)
    // From the placement gate (880) upward, she never leaves the screen.
    for (let vw = 880; vw <= 2560; vw += 4) {
      expect({ vw, ok: bodyLeft(vw) >= -1e-9 }).toEqual({ vw, ok: true })
    }
    // And the margin is what absorbs it: at the gate the canvas itself does
    // hang off, which is the trade this test now permits and pins.
    expect(canvasLeft(880)).toBeLessThan(0)
    // Full size as soon as there is room for it, and never larger.
    expect(besidePanelScale(1120)).toBeCloseTo(1, 6)
    expect(besidePanelScale(1920)).toBe(1)
    // Continuous, like the column: the owner rejected a step there, and a step
    // here would be the same jump in her size for one pixel of window.
    for (let vw = 880; vw < 1200; vw++) {
      expect(Math.abs(besidePanelScale(vw + 1) - besidePanelScale(vw))).toBeLessThan(0.01)
    }
  })

  // The bubble sits beside her head, so its offset is measured from the same
  // corner her body is centred against. It has been corrected twice now, once
  // per canvas widening, each time only after it landed on her face on a phone.
  it('keeps the speech bubble clear of her body, at whatever width the canvas is', () => {
    const px = /right-\[(\d+)px\]/.exec(AVATAR_BUBBLE_RIGHT_CLASS)
    expect(px).not.toBeNull()
    expect(Number(px![1])).toBe(AVATAR_BUBBLE_RIGHT_PX)
    // Her body is centred in the canvas, so its left edge is this far from the
    // wrapper's right corner. The bubble's right edge has to be further out.
    const bodyLeftEdge =
      AVATAR_CANVAS_LAUNCHER.w / 2 + (AVATAR_CANVAS_LAUNCHER.w * AVATAR_LAUNCHER_BODY_FRACTION) / 2
    expect(AVATAR_BUBBLE_RIGHT_PX).toBeGreaterThan(bodyLeftEdge)
    // With room to read as a separate object rather than a sticker on her arm.
    expect(AVATAR_BUBBLE_RIGHT_PX - bodyLeftEdge).toBeGreaterThan(10)
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

describe('emotion recipes', () => {
  // The engine's availability gate compares channel names against the model's
  // expression list verbatim. The custom groups keep their authored casing,
  // and lower-casing 'Surprised' is why the surprised emotion silently never
  // played in production — these pin the exact strings.
  it('addresses the custom expressions by their authored, capitalised names', () => {
    expect(EMOTION_RECIPES.surprised.channels).toEqual([['Surprised', 1]])
    // Full weight is load-bearing too: the X lashes rest INSIDE the head, so
    // partial weights render them half-clipped (black dots at 0.85-0.93,
    // plain closed eyes at 0.75 and below). Owner-confirmed 2026-08-15.
    expect(EMOTION_RECIPES.excited.channels).toEqual([['Extra', 1]])
  })

  // The bug this pins, found in review on 2026-08-15: the cue asked for
  // excited at 0.85 and the engine multiplies cue weight by channel share, so
  // the >< face that the owner signed off at 1.0 rendered as the half-clipped
  // 0.85 frame every single time. The speech cap makes it worse — `done`
  // fires while she is still talking, which clamps the weight to 0.45.
  it('renders the >< morph at full through both the cue weight and the speech cap', () => {
    for (const w of [0.45, 0.85, 1]) {
      expect({ w, ch: emotionChannelValues('excited', w) }).toEqual({ w, ch: [['Extra', 1]] })
    }
    // Still off before it flips on, and off once the release passes back down.
    expect(emotionChannelValues('excited', 0.2)).toEqual([['Extra', 0]])
  })

  it('scales every other emotion by its weight, so only the snap morph snaps', () => {
    expect(emotionChannelValues('pale', 0.5)).toEqual([['sad', 0.35]])
    expect(emotionChannelValues('nagomi', 0.5)).toEqual([
      ['relaxed', 0.5],
      ['blink', 0.5],
    ])
  })

  it('floats the anger vein for angry, and only angry', () => {
    for (const [name, recipe] of Object.entries(EMOTION_RECIPES)) {
      expect({ name, mark: recipe.angerMark === true }).toEqual({ name, mark: name === 'angry' })
    }
  })

  it('builds nagomi from curved lids plus closed lids', () => {
    const channels = EMOTION_RECIPES.nagomi.channels.map(([ch]) => ch).sort()
    expect(channels).toEqual(['blink', 'relaxed'])
  })

  it('marks pale, and only pale, for the face tint', () => {
    for (const [name, recipe] of Object.entries(EMOTION_RECIPES)) {
      expect({ name, tints: recipe.paleTint === true }).toEqual({ name, tints: name === 'pale' })
    }
    // Bluish, not blue: every component stays high enough that the face still
    // reads as skin under it.
    expect(Math.min(...FACE_PALE_TINT)).toBeGreaterThan(0.5)
    expect(FACE_PALE_TINT[2]).toBeGreaterThan(FACE_PALE_TINT[0])
  })

  it('gives every emotion at least one channel at a sane share', () => {
    for (const recipe of Object.values(EMOTION_RECIPES)) {
      expect(recipe.channels.length).toBeGreaterThan(0)
      for (const [, share] of recipe.channels) {
        expect(share).toBeGreaterThan(0)
        expect(share).toBeLessThanOrEqual(1)
      }
    }
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

// The camera's own filter. `dance` is the only clip that asks the frame to move
// (avatarMotions' MotionPan); these are the properties that make the move read
// as a camera and not as a cut.
describe('stepFramePan', () => {
  const dt = 1 / 60

  it('takes about a second to cover a pan, not a frame', () => {
    const target = -0.08
    let v = 0
    let frames = 0
    while (Math.abs(target - v) > Math.abs(target) * 0.2 && frames < 600) {
      v = stepFramePan(v, target, dt)
      frames++
    }
    const seconds = frames / 60
    expect(seconds).toBeGreaterThan(0.5) // a snap would be one frame
    expect(seconds).toBeLessThan(2) // and a crawl would still be moving at t=7.77s
  })

  it('gets there in time for the frames the pan exists for', () => {
    // `dance` first puts her hips below the unpanned bottom edge at t=7.77s and
    // its hair over the column's unpanned top edge at t=7.79 (three sweeps read
    // 7.79/7.80/7.80, with 103-108 frames of the clip over that edge). The
    // camera has to be all the way there by then, not most of the way, in both
    // frames it pans in.
    for (const target of [-0.08, 0.13]) {
      let v = 0
      for (let t = 0; t < 7.77; t += dt) v = stepFramePan(v, target, dt)
      expect(v).toBe(target)
    }
  })

  it('arrives exactly, so a parked camera stops being rewritten', () => {
    // A one-pole is asymptotic: without the epsilon this never equals its
    // target and the engine's `framePan !== panTarget` check is true forever.
    let v = 0
    for (let i = 0; i < 600; i++) v = stepFramePan(v, -0.08, dt)
    expect(v).toBe(-0.08)
    expect(stepFramePan(-0.08, -0.08, dt)).toBe(-0.08)
  })

  it('comes back the same way it went', () => {
    let v = -0.08
    let frames = 0
    while (v !== 0 && frames < 600) {
      v = stepFramePan(v, 0, dt)
      frames++
    }
    expect(v).toBe(0)
    expect(frames / 60).toBeGreaterThan(0.5)
  })

  it('covers the same ground whatever the frame rate', () => {
    // dt-scaled, so a 30Hz tab and a 120Hz one see the same move over the same
    // wall-clock second rather than one of them panning at half speed.
    let slow = 0
    for (let t = 0; t < 1; t += 1 / 30) slow = stepFramePan(slow, -0.08, 1 / 30)
    let fast = 0
    for (let t = 0; t < 1; t += 1 / 120) fast = stepFramePan(fast, -0.08, 1 / 120)
    expect(Math.abs(slow - fast)).toBeLessThan(0.006)
  })
})
