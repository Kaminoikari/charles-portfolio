# The three gestures she plays without being asked pitched the wrong way too

2026-09-10, the same afternoon `bow` was fixed. `bow` was the visible one, so it
went first. `nod`, `bounce` and `toeLook` carry the same defect, and between
them they are far more of what a visitor actually sees: `nod` answers the `ack`,
`suggest` and `done` cues, and `bounce` and `toeLook` are both in the idle
rotation that fires on its own every few seconds. This is what each did, what it
does now, and how the scope of the fix was decided by measurement rather than by
argument.

## 1. The same one-curve-two-meanings shape

`avatarGuideEngine`'s gesture table writes head and spine pitch as plain
numbers, and a normalized bone's local axes follow the MODEL's. The two VRM
versions face opposite ways along Z, so one positive pitch carries her head
toward the model's own +Z either way, and that is FORWARD on a 1.0 body and
BACKWARD on a 0.x one. `VRMUtils.rotateVRM0` turns a 0.x body round so she faces
the camera and does not touch this, because it rotates the scene above the rig.

Every look this site offers is the same VRoid 0.x family, so the wrong direction
is the one every visitor got. `bow-0910.md` records the first half of this and
`avatarMode.facingSign` is the reader both halves use.

## 2. Which axes actually spoil

The fix had to touch pitch and leave yaw, roll and the eye target alone, and
that is a claim about the rig rather than about the gesture table, so it is
measured. One rotation on one bone, on all three registered family bodies, with
"toward her face" read off the eye against the head and "toward her left" read
off her own two hands (`pitch-0910.log`, part 1):

| rotation | on a 1.0 body | on a 0.x body | mirrors? |
|---|---|---|---|
| `head.x` +0.14 | eye 8.53mm toward her face | eye 8.25mm AWAY from it | yes, and the two mean opposite things |
| `head.y` +0.1 | eye 2.05mm toward her left | eye 2.87mm toward her left | no |
| `head.z` +0.16 | eye 10.20mm toward her right | eye 8.86mm toward her left | yes, and the two mean the same thing |

Pitch is the defect. Yaw does not mirror at all, so `tilt`, `glance`, `hipTwist`
and `toeLook`'s own `hy` are correct as written. Roll mirrors exactly as
`armRestSign` says, and is left alone anyway: a head tilted left reads the same
as one tilted right, and every gesture that rolls already picks its side from
the random `v`. The eye target is world space, so it never flips.

All three rows of that table are pinned as tests. The yaw and roll rows are the
two `axis semantics` tests; the pitch row is the `nod` test, whose offset at
`p = 0.25, env = 1` is exactly `head.x = fwd * 0.14`, the rotation the row
names. So the scope decision fails loudly if a future body disagrees with it.

## 3. What each gesture did

Off the shipped table, at each gesture's own peak, on each family's own body
(`pitch-0910.log`, part 2). The peak is found by stepping `t` in 1ms and taking
the largest `|hp|`, with `p` and `env` computed the way the engine's loop
computes them.

| gesture | played by | on a 0.x body it used to | it now |
|---|---|---|---|
| `nod` | `ack`, `suggest`, `done` | lift her chin on the first beat | drop it, eye 5.97mm toward the viewer |
| `bounce` | idle rotation | rock backwards, head 19.5mm away | dip forward, head 19.54mm toward |
| `toeLook` | idle rotation | lift her chin 17 degrees while sending her gaze to the floor | drop her eye 11.31mm |

`nod` is the odd one. Its curve is `sin(2*pi*p)`, symmetric in amplitude, so the
facing term changes the PHASE and not the depth: she answered "yes" chin-up
first and chin-down second, which is a shrug of the head rather than a nod. Its
test therefore reads the first down-beat, not the size of the pose.

`toeLook` is the one that contradicted itself inside a single gesture, because
its eye target is world space and always went down while its head pitch went
down only on a 1.0 body.

## 4. In the browser, through the real engine

`pitch-0910-browser.log` carries the full method and both passes. Two things in
it are worth repeating here.

The eye's world position cannot see `nod`. Its whole pitch is 0.14 rad, worth
about 8mm of eye swing, and the idle floor measured in the same window is 16mm
in Z. So this pass reads the gesture term itself, recovered exactly from two
bones the engine writes on the same frame:

```
head.rotation.x = pitch * 0.7 + OFF.hp        so   OFF.hp = head.x - (7/3) * neck.x
neck.rotation.x = pitch * 0.3
spine.rotation.x = OFF.sx
```

A control run with no gesture clicked reads 0.000 and 0.000 over 157 frames,
which is what makes that separation a measurement rather than a hope.

Before and after, on the milfy body the site serves:

| gesture | before | after |
|---|---|---|
| `nod` peak `hp` | +0.108 at 256ms | -0.108 at 258ms |
| `nod` first beat | +0.030 at 88ms | -0.030 at 91ms |
| `bounce` peak `hp` and `sx` | +0.050 at 587ms | -0.050 at 600ms |
| `toeLook` peak `hp` | +0.300 at 1000ms | -0.300 at 994ms |

Opposite signs on every row. The four rows above agree in magnitude to three
decimals; the full nine-row table in `pitch-0910-browser.log` has one that does
not, `toeLook`'s first beat at +0.031 against -0.032, because "first frame past
0.03 rad" lands on a different frame in the two passes while the envelope is
still climbing. The offline probe finds the same peaks independently: 0.1078 at
274ms, 0.0500 at 600ms, 0.3000 at 1000ms.

`pitch-0910-toelook-before.png` and `-after.png` are the two poses, each read on
the frame whose recovered `hp` was the largest of its own trace, with an `ink`
fraction taken in the same frame to catch a blank read. Measured on those two
committed files, 944x856 apiece, their silhouettes differ by 56,052 XOR pixels,
13.6% of the mean foreground, and 14.65px of centroid. No count is carried across
from the pair that failed review earlier the same day, because that was a
different crop and the counts do not compare. What that pair was is the point:
two near-idle frames, 0.6px of centroid apart on their own crop
(bow-0910-browser.log).

## 5. What holds it

`avatarPitch.test.ts`, 31 tests: six per registered family body, two per
version-blind gesture, and one that checks the two lists between them account
for every gesture the table has. Seven mutations, each red on exactly one named
test, listed with its output in `pitch-0910-mutations.log`. `bounce` gets two of
them because it writes the same weight on the spine and on the head, and
dropping either factor alone leaves the other's test green.

Three of the seven run the other way, against mistakes this fix invites rather
than against the fix itself. One ADDS a facing term to `tilt`, which rolls. One
takes the version-blind sample list back to the quarter points, where `wiggle`'s
sin(4*pi*p) lands on its own zeros at every sample and the comparison would have
been between two pieces of floating-point residue. One drops a gesture out of
both lists, which is how an eleventh gesture would arrive covered by nothing.
All three of those holes were found by a reviewer, not by me.

`npm run build` exit 0.

The whole suite is 630 tests across 30 files and every one of them passed, in
four runs rather than one, each on the runner's own default settings:

| run | files | tests | duration |
|---|---|---|---|
| everything but the three springsim files | 27 | 613 | 64.41s |
| `springsim.test.ts` | 1 | 6 | 124.40s |
| `springsim.rigid.test.ts` | 1 | 5 | 116.59s |
| `springsim.derive.test.ts` | 1 | 6 | 68.19s |

The first row is this commit as it stands. The three springsim rows were taken
while it was being finished, and they still describe it, because none of what
they measure changed: the commit touches twelve files, and none of them is one
of those three, nor one of the six files under `src/components/chat/` that the
three import (`avatarMode`, `avatarMotions`, `avatarVariants`, `clearance`,
`rigProbe`, `vrmHumanoid`).

Every one of those runs still exited 1, on unhandled `[vitest-worker]: Timeout
calling "onTaskUpdate"` reporter errors. That is not this change: `base-b.log`
is a 28-file run of the tree before this test file existed, every file passing,
carrying the same two errors.

The split is a property of this machine, not of the change. The three springsim
files solve 60Hz spring simulations against wall-clock bounds (`Hook timed out
in 120000ms`, `Test timed out in 240000ms`, `Test timed out in 60000ms`), which
makes them the only tests in the suite whose result depends on how busy the
machine is. Six attempts of this code failed in them and nowhere else, every
time on the clock and never on an assertion, and the same files pass one at a
time. This change edits four files under `src/`, all of them in
`src/components/chat/`: `avatarGuideEngine.ts` and the three test files beside
it. No springsim file imports any of the four, directly or through
`springsim.ts`. A draft of this sentence gave a reason instead of that check and
the reason was wrong: springsim does reach into `src/components/chat/`, for six
files, none of which this change edits.
