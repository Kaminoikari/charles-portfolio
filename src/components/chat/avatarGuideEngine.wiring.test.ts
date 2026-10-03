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
    expect(SOURCE).toMatch(/return cameraPan\(motionName, motionFrame\(placement\), shownFamily\)/)
    // …and hands back the resting composition once she starts putting her arms
    // down, which is what returns the camera at every exit.
    // `|| !shownFamily` since 2026-09-07: the pan is per family, and no family
    // means no body on screen.
    // Since 2026-09-25 the resting composition is per family too: a body
    // taller than Mika's rests with the camera raised by restPan.
    expect(SOURCE).toMatch(/if \(!shownFamily\) return 0/)
    expect(SOURCE).toMatch(
      /if \(!motionAction \|\| settleDur > 0\) return cameraPan\(null, motionFrame\(placement\), shownFamily\)/,
    )
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
  it('solves the idle poses for THIS body version', () => {
    // rigProbe.test.ts proves the poses are right for each version by posing
    // the real skeleton with them. It cannot see what the engine hands the
    // solver, and a literal '0' here would restore the bug of 2026-09-09: every
    // 1.0 body posed with the 0.x facing, its arms turned the wrong way.
    expect(SOURCE, 'solvePoses does not read the version off the body').toMatch(
      /version: v\.meta\.metaVersion,\s*rest: normalizedRest\(/,
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

describe('the idle poses', () => {
  it('alternates only on the stage, and never under a clip', () => {
    // idlePose.test.ts proves the clock swaps when told to and holds when told
    // to. What it is told comes from here: a clock that alternated in the chat
    // widget would put her hands behind her back where the framing was measured
    // for open hands, and one that started a swap under a clip would settle
    // the clip into a pose she was not standing in when it began.
    expect(frameBody()).toMatch(
      /poseState = stepIdlePose\(poseState, dt, placement === 'stage', share < 1, Math\.random\)/,
    )
  })

  it('hands the arms back on the procedural share, fingers included', () => {
    expect(frameBody()).toMatch(/const share = 1 - clipShare\(motionAction, outgoing\)/)
    expect(frameBody()).toMatch(/poseUnderClips\([^\n]*idlePoseNow\(poseState, poses\), share, /)
  })

  it('drifts the fingers on the same share, and keeps the grip closed', () => {
    expect(frameBody()).toMatch(/drift\.at\(t, share, share \* holdingHandFree\(poseState\)\)/)
  })

  it('lets a placement that offers no clip take the procedural beats', () => {
    // The stage offers none (the visitor picks them). Rolling a clip turn
    // there found nothing and parked the rotation in its opening wait for
    // good, so on /avatar she never moved her head.
    expect(frameBody()).toMatch(/const clipTurn = order\.length > 0 && /)
  })
})


describe('the clasp rests on her', () => {
  it("hands the solver her trunk's surface, in the frame her rest positions are in", () => {
    // idlePose.test.ts poses her with rigProbe.trunkSurface, read off the file.
    // What the engine hands over is only this code: points left in world space
    // would sit wherever the scene stands, and the clasp would rest against
    // the wrong place without a test anywhere noticing.
    expect(SOURCE).toMatch(/surface: trunkSurface\(v, h\.normalizedHumanBonesRoot\)/)
    expect(SOURCE).toMatch(/rest: normalizedRest\(\(bone\) => h\.getNormalizedBoneNode\(bone as BoneName\), h\.normalizedHumanBonesRoot\)/)
    expect(SOURCE).toMatch(/root\.worldToLocal\(mesh\.localToWorld\(p\)\)/)
    expect(SOURCE).toMatch(/if \(!trunk\[joints\.getComponent\(i, best\)\]\) continue/)
  })
})

describe('her shoulders and elbows keep their skin smooth', () => {
  it('moves the arm rolls down to the wrist for the skinning, and back after', () => {
    // idlePose.test.ts proves the move keeps every joint and hand where it
    // was; only this code makes the skin see it. Without the undo, a writer
    // that blends from the bone's current value would fold the moved roll back in.
    expect(frameBody()).toMatch(
      /const unroll = armRollsToWrist\(\(bone\) => h\.getNormalizedBoneNode\(bone as BoneName\)\)\s*\n\s*vrm\.update\(dt\)[^\n]*\n\s*unroll\(\)/,
    )
  })
})

describe('her elbows keep their outline clean', () => {
  it('thins the outline at the elbows of every body it installs, after the skeletons are combined', () => {
    // elbowOutline.test.ts proves the thinning; only this line puts it on her.
    expect(SOURCE).toMatch(/VRMUtils\.combineSkeletons\(loaded\.scene\)[\s\S]*?thinOutlinesAtElbows\(loaded\)\s*\n\s*scene\.add\(loaded\.scene\)/)
  })
})

describe('a clip that leaves bones to the idle pose', () => {
  // motionHandover.test.ts drives poseUnderClips and restUnderClip through a
  // real mixer; only these lines put them on her.
  it('writes the idle pose under the clips every frame, through poseUnderClips', () => {
    expect(frameBody()).toMatch(
      /poseState = stepIdlePose\([^\n]*\n\s*const h = vrm\.humanoid\s*\n\s*poseUnderClips\(\(bone\) => h\?\.getNormalizedBoneNode\(bone as BoneName\), idlePoseNow\(poseState, poses\), share, motionAction, outgoing, clipRest\(vrm\)\)/,
    )
  })

  it('has the mixer remember rest, not the idle pose, for a clip it starts', () => {
    expect(SOURCE).toMatch(
      /const take = \(\) => takeOverMotion\(m, clip, playing, MOTION_FADE, outgoing\)\s*\n\s*const \{ action, outgoing: out \} = poses\s*\n\s*\? restUnderClip\(\(bone\) => h\?\.getNormalizedBoneNode\(bone as BoneName\), poses\.open, clipRest\(vrm\), take\)\s*\n\s*: take\(\)/,
    )
  })
})

describe('her arms turn out over a coat that would swallow her hands', () => {
  // coatSwing.test.ts holds the curve to the coat by forward kinematics; only
  // these lines put the curve on her.
  function playBody(): string {
    const start = SOURCE.indexOf('\n  function playMotion(')
    if (start < 0) throw new Error('no playMotion in the engine')
    const rest = SOURCE.slice(start + 1)
    return rest.slice(0, rest.indexOf('\n  }\n'))
  }

  it('looks the curve up for the body on screen when a clip starts', () => {
    expect(playBody()).toMatch(/const curve = coatSwingCurve\(shownUrl, name\)\s*\n\s*if \(curve\) coatSwings\.set\(action, curve\)/)
  })

  it('turns the arms every frame after the idle pose is written under the clips, on each clip\'s own weight', () => {
    const body = frameBody()
    const pose = body.indexOf('poseUnderClips(')
    const turn = body.indexOf('turnArms(')
    expect(pose).toBeGreaterThan(0)
    expect(turn).toBeGreaterThan(pose)
    expect(body).toMatch(/degrees \+= coatSwingAt\(curve, action\.time\) \* action\.getEffectiveWeight\(\)/)
    expect(body).toMatch(/turnArms\(\(bone\) => h\?\.getNormalizedBoneNode\(bone as BoneName\), vrm\.meta\.metaVersion, degrees\)/)
    // Not behind `coatSwings.size > 0`: the frame after a clip lets go is the
    // one that takes its last turn back off.
    expect(body).not.toMatch(/if \(vrm && coatSwings\.size > 0\)/)
    expect(SOURCE).toMatch(/const turnArms = armSwing\(\)/)
  })
})

describe('she stands on the floor', () => {
  it('sways from the waist up and never turns the hips or a leg', () => {
    // Every leg is a child of the hips, so a roll on the hips swings both feet
    // across the floor with it. Until 2026-09-30 the idle weight shift was
    // exactly that, a hips roll: on the pink look /avatar opens with, her feet
    // slid 30.4mm side to side while her head moved 28.9mm, so the whole figure
    // drifted as one piece and read as floating. The sway lives on the spine now, where it
    // moves her head and leaves her feet where they stand.
    const body = frameBody()
    expect(body).not.toMatch(/hips\.rotation\.\w+\s*=/)
    expect(body).not.toMatch(/(UpperLeg|LowerLeg|Foot|Toes)'\)[^\n]*\.rotation/)
    expect(body).toMatch(/spine\.rotation\.z = blend\(spine\.rotation\.z, sway \*/)
  })
})
