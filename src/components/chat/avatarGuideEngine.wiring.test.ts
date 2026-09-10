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

// The per-frame loop's own body. A regex over the whole file is position-blind,
// and several of the assertions below are about a value being read EVERY FRAME
// off whichever body is loaded. Hoisting `const fwd = facingSign(...)` up to the
// top of initAvatarGuide, next to `let vrm: VRM | null = null`, is a plausible
// "compute it once" follow-up: it leaves every string this file matches intact,
// and it pins `fwd` to +1 for the life of the engine because `vrm` is null at
// that point and `?? '1'` fills in. Every 0.x body would regress to exactly the
// defect this commit fixed.
function frameBody(): string {
  const start = SOURCE.indexOf('\n  function frame() {')
  if (start < 0) throw new Error('no frame() in the engine')
  const rest = SOURCE.slice(start + 1)
  const end = rest.indexOf('\n  }\n')
  if (end < 0) throw new Error('unterminated frame()')
  return rest.slice(0, end)
}

// Each handle method's own body, for the same reason one level down. A regex
// walking from one method name to a statement is not enough: `[\s\S]*?` will
// happily run past the end of the method it started in and match the SAME
// statement inside the next one, which is how the first version of this file
// passed with setPlacement's landing deleted. Slicing to the method's closing
// brace first makes each assertion answer for one method.
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
    expect(SOURCE).toMatch(/return motionPan\(motionName, motionFrame\(placement\), shownFamily\)/)
    // …and hands back the resting composition once she starts putting her arms
    // down, which is what returns the camera at every exit.
    // `|| !shownFamily` since 2026-09-07: the pan is per family, and no family
    // means no body on screen.
    expect(SOURCE).toMatch(/if \(!motionAction \|\| settleDur > 0 \|\| !shownFamily\) return 0/)
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

describe('the body version reaches everything that is posed with it', () => {
  it('asks armRestPins for THIS body version', () => {
    // rigProbe.test.ts proves the pins are right for each version by posing the
    // real skeleton with them. It cannot see what the engine hands them, and a
    // literal '0' here would restore exactly the bug that test now covers: every
    // 1.0 body pinned with the 0.x sign, standing at rest with its arms up.
    expect(SOURCE, 'pinArms does not read the version off the body').toMatch(
      /for \(const \[name, z\] of armRestPins\(v\.meta\.metaVersion\)\)/,
    )
  })

  it('reads the facing off the body every frame, and gives it to the gestures', () => {
    // The same fact one layer along, and it was left open for a day: four
    // gestures resolve their pitch against which way the body faces, and
    // avatarBow.test.ts (`bow`) and avatarPitch.test.ts (`nod`, `bounce`,
    // `toeLook`) prove the resolution is right for each version by posing the
    // real skeleton. None of them can see what the loop passes. A literal here
    // bows every 0.x body backwards again, which is the defect of 2026-09-10
    // (evidence/bow-0910.md, evidence/pitch-0910.md), and the whole suite stays
    // green while it does. Scoped to frameBody() because the visitor can swap
    // her look mid-session: a read hoisted out of the loop answers for whatever
    // body was loaded first, or for none.
    const frame = frameBody()
    expect(frame, 'the loop does not read the version off the body').toMatch(
      /const fwd = facingSign\(vrm\?\.meta\.metaVersion \?\? '1'\)/,
    )
    expect(frame, 'the gesture table is not given that facing').toMatch(
      /def\.apply\(p, env, gesture\.v, OFF, fwd\)/,
    )
  })

  it('poses the gaze through avatarMode rather than a second copy of the ratios', () => {
    // The gaze is the OTHER consumer of that facing, and it was the half left
    // unfixed on 2026-09-10: the engine spends one `pitch` on the head and neck
    // bones, which mirror with the version, and on an eye target in world
    // space, which does not. avatarPitch.test.ts poses a real skeleton with
    // `aimPitchPose` and `aimYawPose` and checks where her eye ends up on every
    // registered body. It cannot see whether the engine calls either of them.
    const frame = frameBody()
    expect(frame, 'the gaze yaw does not go through aimYawPose').toMatch(
      /const aimY = aimYawPose\(yaw\)/,
    )
    // …and the results are what the bones are actually written from. Computing
    // the pose and then writing a literal ratio next to it is the failure this
    // whole file exists for.
    for (const [line, why] of [
      [/head\.rotation\.y = blend\(head\.rotation\.y, aimY\.head \+ OFF\.hy\)/, 'head yaw'],
      [/head\.rotation\.x = blend\(head\.rotation\.x, aimP\.head \+ OFF\.hp\)/, 'head pitch'],
      [/neck\.rotation\.y = blend\(neck\.rotation\.y, aimY\.neck\)/, 'neck yaw'],
      [/neck\.rotation\.x = blend\(neck\.rotation\.x, aimP\.neck\)/, 'neck pitch'],
      [/spine\.rotation\.y = blend\(spine\.rotation\.y, aimY\.spine \+ OFF\.sy\)/, 'spine yaw'],
    ] as ReadonlyArray<readonly [RegExp, string]>) {
      expect(frame, `the ${why} is not written from avatarMode`).toMatch(line)
    }
    // The five ratios were 0.65 / 0.35 / 0.1 and 0.7 / 0.3, and are now only in
    // avatarMode. Any of them reappearing here is a second copy.
    expect(frame, 'a gaze ratio has been written back into the engine').not.toMatch(
      /(yaw \* 0\.65|yaw \* 0\.35|yaw \* 0\.1|pitch \* 0\.7|pitch \* 0\.3)/,
    )
  })

  it('resolves the gaze pitch against the body being posed, not a literal', () => {
    // Its own `it` because it is its own defect: the call can be there and be
    // handed a 1, which is the whole bug with the call kept.
    expect(frameBody(), 'the gaze pitch is not resolved against this body').toMatch(
      /const aimP = aimPitchPose\(pitch, fwd\)/,
    )
  })

  it('sends the eye target DOWN for a positive pitch, which is what defines the sign', () => {
    // The other end of the same invariant, and the one thing here that no test
    // outside this file can see. `pitch` means "look down" because of what it
    // does to this target, in world space, on any body; aimPitchPose exists to
    // make the bones agree with it. avatarPitch.test.ts holds a COPY of this
    // expression (`targetDrop`) and compares signs against it, so flipping the
    // minus here would leave the bones and the target disagreeing again with
    // that whole file green. This is the assertion that stops it.
    expect(frameBody(), 'the eye target no longer defines the pitch sign').toMatch(
      /1\.35 \+ Math\.sin\(pitch\) \* -4 \+ saccadeY \+ OFF\.ey,/,
    )
  })

  it('keeps the pins in one place instead of a table of its own', () => {
    // The old `const ARM_PINS` table lived here and wrote the six signs out by
    // hand. Two copies of a rest pose is how one of them gets a version and the
    // other does not, so the table itself must not come back.
    expect(SOURCE, 'the engine has grown its own arm-pin table again').not.toMatch(
      /const ARM_PINS/,
    )
  })
})
