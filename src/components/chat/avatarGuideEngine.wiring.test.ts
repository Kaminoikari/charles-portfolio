import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The engine has no unit test, and cannot easily have one: it builds a
// WebGLRenderer in its first ten lines, so jsdom cannot run it and every test
// that touches it mocks the whole handle away (AvatarGuide.test.tsx).
//
// That is survivable for most of the engine, whose behaviour is at least
// visible in a browser. It is NOT survivable for the clip-driven camera pan,
// because of what the pan did to the guards next door: rigProbe.test.ts now
// measures `dance` against its PANNED frame (frameFor), so those guards only
// say "this clip fits" on the assumption that the engine really moves the
// camera. Delete the engine's five-line pan block and the whole suite stays
// green while the guards keep vouching for a clip that no longer fits — the
// exact shape of injection-bypasses-wiring.
//
// So this reads the source. It is a structural test and it is deliberately
// dumb: it cannot tell you the pan looks right (a browser sweep did that, see
// docs/plans/avatar-motion-capture.md), only that the five stages which carry
// the pan from the clip's data to the camera — aim, ask, ease, land, gate, one
// per `it` below — are still there. A rename
// will fail it and should be fixed by updating the pattern; a deletion will
// fail it and must not be.
const SOURCE = readFileSync(
  path.join(process.cwd(), 'src', 'components', 'chat', 'avatarGuideEngine.ts'),
  'utf8',
)

// Each handle method's own body. A regex walking from one method name to a
// statement is not enough: `[\s\S]*?` will happily run past the end of the
// method it started in and match the SAME statement inside the next one, which
// is how the first version of this file passed with setPlacement's landing
// deleted. Slicing to the method's closing brace first makes each assertion
// answer for one method.
function handlerBody(name: string): string {
  const start = SOURCE.indexOf(`    ${name}: (`)
  if (start < 0) throw new Error(`no ${name} handler in the engine`)
  const rest = SOURCE.slice(start)
  const end = rest.indexOf('\n    },')
  if (end < 0) throw new Error(`unterminated ${name} handler`)
  return rest.slice(0, end)
}

describe('the pan reaches the camera', () => {
  it('aims the camera at the placement height PLUS the clip pan', () => {
    // Without the `+ framePan` term every other statement here is decoration:
    // the value is computed, eased, and never looked at.
    expect(SOURCE).toMatch(/const y = framingLookAtY \+ framePan/)
    expect(SOURCE).toMatch(/camera\.position\.set\(0, y \+ AVATAR_CAMERA_TILT, framingDistance\)/)
    expect(SOURCE).toMatch(/camera\.lookAt\(0, y, 0\)/)
  })

  it('asks the running clip what the frame should be', () => {
    // The one definition both callers read. It has to name the clip AND the
    // placement's frame: `dance` pans one way in the waist-up frame and the
    // other way in the column, so dropping either argument picks the wrong
    // number rather than no number.
    expect(SOURCE).toMatch(/function panTargetNow\(\)/)
    expect(SOURCE).toMatch(/return motionPan\(motionName, motionFrame\(placement\)\)/)
    // …and hands back the resting composition once she starts putting her arms
    // down, which is what returns the camera at every exit.
    expect(SOURCE).toMatch(/if \(!motionAction \|\| settleDur > 0\) return 0/)
  })

  it('eases toward that target every frame', () => {
    expect(SOURCE).toMatch(/const panTarget = panTargetNow\(\)/)
    // The write is only useful if the camera is re-aimed after it.
    expect(SOURCE).toMatch(
      /framePan = stepFramePan\(framePan, panTarget, dt\)\s*\n\s*aimCamera\(\)/,
    )
  })

  it('lands on the target instead of easing when the placement cuts', () => {
    // A placement change CUTS the framing. Easing the pan across that cut
    // leaves the camera between two compositions for about a second — measured
    // at lookAtY 0.957 for ~600ms going fullscreen mid-`dance`, against hair at
    // 1.7276. Both handles land it, so the fix does not rest on which of
    // AvatarGuide's two effects React happens to run first.
    for (const name of ['setPlacement', 'setFraming']) {
      const body = handlerBody(name)
      expect(body, `${name} does not land the clip pan`).toMatch(/framePan = panTargetNow\(\)/)
      expect(body, `${name} does not re-aim the camera`).toMatch(
        /framePan = panTargetNow\(\)\s*\n\s*aimCamera\(\)/,
      )
    }
  })

  it('lands only where there is a cut to ride', () => {
    // setPlacement fires on launcher <-> beside-panel too, and those two share a
    // framing AND a frame: ChatWidget passes `framing` only in the column, so
    // setFraming does not fire there and nothing cuts. Landing unconditionally
    // would snap a mid-ease pan by up to 80mm — 20px on the launcher canvas — on
    // a transition that used to be continuous, so the landing is gated on the
    // composition actually changing.
    expect(handlerBody('setPlacement'), 'setPlacement lands without checking the frame').toMatch(
      /motionFrame\(next\) !== before/,
    )
  })
})
