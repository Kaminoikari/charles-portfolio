# The first VRM 1.0 body the engine ever drew, and what it found

2026-09-09. `vroid-studio-dressup` was put under `public/avatar/` and added to
`AVATAR_FAMILIES` so that its one remaining carried field, `crownFringe`, could
be measured the way the recipe says: render the body and look at the topmost
drawn pixel. Two things came out of the run, and the second one had to be fixed
before the first could be taken.

Dev server: `npm run dev`, Vite on :5173. Browser: Playwright Chromium.
Page: `scripts/avatar/live-preview.html?model=/avatar/vroid-studio-dressup.vrm&mikadebug=1`,
with `scripts/avatar/live-preview-config.ts`'s `MIKA_MILFY_FAMILY` pointed at
this family for the run and put back afterwards, which is what that file's own
docstring is for.

## 1. At rest, both arms pointed straight up

`armrest-0909-before.png`. She stands in the column framing with her arms
vertical, the sleeves leaving the top of the frame. Nothing was playing:
`__mikaState` reported `motion: null`, `motionW: 0`, `gesture: null`, and the
normalized arm bones sat at exactly the values `pinArms` writes
(`leftUpperArm` z = +1.15, `rightUpperArm` z = -1.15).

So the pins were doing what they say and saying the wrong thing. `ARM_PINS` in
`avatarGuideEngine.ts` carried a comment that named its own assumption ("VRM0
rest pose is a T-pose; these Z rotations bring the arms down"), and the
assumption is only half a fact:

- a 0.x body faces **-Z**, so her left arm rests along **-X**, and a **positive**
  Z rotation swings it **down**;
- a 1.0 body faces **+Z**, so her left arm rests along **+X**, and that same
  rotation swings it **up**.

`rigProbe.ts` has carried this fact since the second family arrived (its
COORDINATE SPACE note, and `forwardZ`), and every measurement in it goes through
that sign. The arm pins were the one place in product code still writing the 0.x
sign as a literal. It had never mattered: `vrm1-twist-sample` is a 1.0 rig, but it is
declared and never rendered, so no 1.0 body had ever been posed at rest by the
engine.

Confirmed in the page before touching any source, by writing the opposite sign
onto the four arm bones through `__mikaVrm.humanoid.getNormalizedBoneNode`: the
arms came down, and the topmost drawn row moved from 0 (the sleeves, clipped at
the frame edge, 968px wide at hoodie red) to 4 at x = 876, which is her hair.

**The fix**: `avatarMode.armRestPins(version)` is now the one definition, the
engine reads the version off the body (`v.meta.metaVersion`), and
`rigProbe.applyArmRest` poses the real skeleton with the same table so a test
can look at where the wrists land. `armrest-0909-after.png` is the same page
after it.

Three defences, three mutations, each red on its own (`armrest-0909-mutations.log`):

| mutation | what goes red |
|---|---|
| `armRestSign` ignores the version (back to the 0.x literal) | `rests with her arms down` on both 1.0 families: left wrist 412mm **above** the shoulder, expected below. The 0.x family stays green. |
| the engine pins with a literal `'0'` | `asks armRestPins for THIS body version` |
| the engine grows a `const ARM_PINS` table back | `keeps the pins in one place instead of a table of its own` |

## 2. The crown fringe, measured

Recipe from `clearance-0906.md`: the topmost canvas row whose alpha clears 8,
converted through the frame's own top edge (`camLookY + distance·tan(fov/2)`),
against what the simulator projected for the same instant.

The reading that counts is the one taken **under a clip**. A clip owns the bones
outright (`proceduralW` is 0 at full weight), so the browser and the simulator
are posing the same body; at rest the engine's breathing and weight shift lift
her a couple of millimetres that no bind pose has, and the column leaves this
body only 2.6mm of headroom to see it in.

`dance`, column framing, pan 0.12 not yet declared at the time of the run so the
camera sat at the then-declared 1.146 (0.13). That is also why the simulator
column below reads 1.7198 and the file now holds 1.7211: declaring 0.12 lowered
the camera a centimetre and the same crown projects 1.3mm higher.

| canvas rows | mm per row | topmost drawn row | that row spans | simulator |
|---|---|---|---|---|
| 2400 | 0.4884 | 25 @ t=11.97s | 1.71933 – 1.71982 | 1.7198 @ 11.97s |
| 1000 | 1.1721 | 10 @ t=11.96s | 1.71914 – 1.72031 | 1.7198 @ 11.97s |

The projection lands inside the drawn row both times, and on its top edge at the
finer one: the drawn crown is at most **0.02mm** above the topmost vertex at
0.49mm/row and **0.51mm** at 1.17mm/row. The residual did not grow with the row,
which is what says the fringe here is the row and not an outline: Milfy's crown
is a spring-driven twintail with a VRoid outline on it (its own residual read
1.3mm and it declares 1.5mm), this is a short rigid bob. `crownFringe` is
declared 0.0005, the larger of the two bounds to the tenth of a millimetre; it
is 25x the 0.02mm the finer run actually bounds the residual at, and `least`
comes out 119.6mm against a 120mm grid whether the tenth is kept or not.

The peak time matches the simulator's `crownT` to the frame (11.97s against
11.97s), which is the same agreement the 2026-09-06 Milfy run got (11.96 against
11.97).

Neither run ever drew a pixel in row 0: through the whole clip, at both
resolutions, the crown stayed inside the frame. That is why the family declares
no `crownTop` waiver.

At rest the same page reads, for the record and not for the fringe:

| frame | topmost row | that row spans | simulator (bind pose) |
|---|---|---|---|
| column | 1 of 1000 | 1.59969 – 1.60086 | 1.5994 |
| waist-up | 248 of 1000 | 1.59719 – 1.59830 | 1.5971 |

The waist-up projection sits 0.09mm under its drawn row's lower edge and the
column one 0.29mm under its, so both read a fraction of a row high, and the
column row's top is 1.17mm under the 1.6020 top edge with nothing playing.
This body's resting crown is close enough to that edge that the engine's own
idle layer can touch it. Two quiet windows were scanned in the column with the
arms already fixed: one of 700 frames put the topmost row at 0 in 118 of them
and never below row 4, the other of 500 frames never left rows 1 to 3. No guard
reads any of this, and it is the reason the column rest reading is useless for
measuring a fringe.

## The same class, one layer over, measured and NOT fixed

The arm pins were not the only place the engine writes a rotation straight onto a
normalized bone with no version term. The whole procedural layer does:
`GestureOffsets` (bow, nod, tilt, toeLook and the rest), `headAim`, and the
breathing and weight shift all write `head`/`neck`/`spine`/`chest`/`hips`
rotations directly. So they mirror between versions too, on all three axes.

`pitch-0909-probe.ts` applies `bow`'s own offsets (spine +0.32, head +0.18) to
each registered body and reports where her head ends up relative to the way her
eyes point (`pitch-0909.log`):

| body | VRM | bow carries her head |
|---|---|---|
| vroid-sample-b (the shipped one) | 0 | **121.8mm BACKWARD**, 26.4mm down |
| vrm1-twist-sample | 1 | 136.1mm forward, 8.8mm down |
| vroid-studio-dressup | 1 | 136.1mm forward, 8.8mm down |

Measured live in the browser on the shipped body as well, through the engine's
own `playGesture('bow')`: her head moved -118.8mm in world Z with her eyes
pointing +Z, and her left eye -148.0mm. The 3mm difference from the offline
figure has two parts: the probe reads this family's base file and the page ran
`mika-milfy-12.vrm` (one family, `rigOf` hashes the same for both), and the live
peak sampled was spineX 0.318, headX 0.185 against the probe's exact 0.32 and
0.18, with the idle sway on top.

So the shipped body leans AWAY from the viewer when she bows, and the two 1.0
bodies would bow toward it. It reads as a bow on screen because her head drops
26mm at the same time, and `toeLook` reads as looking down because it also
drives the eye target down by 2.

NOT FIXED HERE. It is outside what this change was for, the two 1.0 bodies are
`offered: false` so no visitor sees the mirror, and correcting the sign changes a
visible motion on the body every visitor DOES see, which is the owner's call and
needs a browser watch of all nine gestures rather than a probe.

## What the run did not check

Whether `speaking` mode should abort a clip. `playMotion('dance')` was called
under `setMode('speaking')` and the clip stopped 0.5s in, at weight 0.07; under
`idle` the same call runs the clip to its end. Plausibly deliberate (she should
talk, not dance) and nothing here depends on it, so it is recorded rather than
chased.
