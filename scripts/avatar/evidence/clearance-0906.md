# Phase 5 — the dynamic clipping gates, the crown's producer, the clearance file

2026-09-06. Plan `~/.claude/plans/nested-conjuring-wirth.md`, Phase 5.

## What was wrong

Four things, all of them the same shape: a number that describes one body,
living somewhere that claims to describe every body.

- **`springsim.ts` could only run Milfy.** It named its meshes by material and
  mesh string (`Body.baked`, `Mellow_Outer`, `F00_000_00_*_SKIN`), its bones by
  ten `J_Bip_*` node names, its hair by `/^HairTail[LR]_\d$/`, its coat hem by
  the literal height `y >= 0.92`, and its sleeve cut by `|x| <= 0.3`. It
  simulated the twintails and nothing else, on two of the ten clips.
- **The crown was a hand-typed browser number with no producer.**
  `AvatarMotionDef.crown = 1.7276` was the topmost pixel of eighteen browser
  sweeps of `dance` on the VRoid body in 2026-08. It sat on the *clip*, which
  is what let the comment beside it say "milfy was not swept" — a per-body
  number on a per-clip object has nowhere honest to put a second body.
- **`envelope.HEIGHTS` was one body's numbers**, typed in as 0.60…1.00.
- **`pierce.py`, `inside.py` and `envelope.py` had no mutation receipts.**
  `RESULT.txt` section 六 listed only verify.py's detectors.

## What changed

| file | what it is now |
|---|---|
| `scripts/avatar/springsim.ts` | reads every mesh from the manifest and every bone from the humanoid map; simulates hair, coat, skin, face and skirt; reports the crown twice (world and projected); `--clearance` writes the simulated half |
| `scripts/avatar/clearance.ts` | the producers' side: `rigSha`, `producedAt`, `servedPath`, `writeGenerated` |
| `src/components/chat/clearance.ts` | the types, `combineClearance`, `crownOn`, `crownBound` |
| `src/components/chat/clearance/vroid-sample-b.{measured,simulated}.gen.ts` | the two produced halves |
| `src/components/chat/clearance/vroid-sample-b.ts` | the decisions: the browser fringe, the sweeps, the waivers, the exclusions |
| `scripts/measure-motions.ts` | `--write` makes it the producer of the measured half; the hair disclaimer became a real row per placement |
| `src/components/chat/avatarMotions.ts` | `crown` and `waiver` left `AvatarMotionDef`; `MotionWaiver` gained `crownTop` |
| `src/components/chat/rigProbe.ts` | `deriveRestCrown`; `sampleTimes` walks the clip at 60 Hz as well as at its keys |
| `scripts/avatar/envelope.py` | `HEIGHTS` became `heights(doc)`, knee to hip + 5cm |

Three producers write one file, and nothing a script writes can widen a guard:
the two `.gen.ts` halves are measurements, the hand module is decisions, and
`combineClearance` refuses to pair halves from different rigs.

## Deviations from the plan

1. **Two produced files, not one.** The plan had both producers writing
   `<family>.gen.ts`. They cannot: each would clobber the other's half. Split
   into `.measured.gen.ts` and `.simulated.gen.ts`, combined by a hand module.
2. **The crown had to be projected, not compared as a world height.** The plan
   said `crown = crownY + crownFringe`. Measured, that fringe came out at
   **+46mm** at the dance's peak and +12mm at rest — far too large to be a
   translucent-tip allowance, and not constant. The cause is perspective: the
   hop comes toward the camera, and the frame's top edge is a projected
   quantity. With every vertex projected through its own frame's camera
   (`FrameCamera`), the residual fell to **+1.3mm** at the peak and **-0.3mm**
   at rest. `crownScreen` is per frame, and the `framings` it was projected
   through are recorded beside it so a composition change is caught.
3. **The body gate needed hair roots excluded, and only one clip can carry a
   budget.** The signed distance saturates at 50mm (`REACH`), and the hair
   roots under the scalp are inside the skin at rest, so every clip read
   exactly the cap and a 60mm threshold could never fail. Raising `REACH` to
   0.15 made it worse: a skirt vertex by the waist got judged by a thigh
   vertex's normal and read 150mm. Kept `REACH = 0.05` and excluded hair
   already inside the skin in bind pose. That leaves `spin` at 4.8mm, which
   carries a real 20mm budget, and `dance` still at the cap because its tail
   passes through an arm. A "≤ 50" line on `dance` would be true whatever the
   hair did, so `dance` pins the cap instead (C18 reddens it), and the test
   says which of the two it is doing.
4. **Five clips needed a `crownTop` waiver.** Once the crown became a real
   number, `spin` (1.6185), `squat` (1.6022) and `idleLoop` (1.6043) failed the
   column's 1.6020 edge on the simulator's own reading, and `scratchHead`
   (1.6068) and `playFingers` (1.6053) failed it on the 2026-08-20 browser
   sweep, which drew those two above what the simulator derives. This is not a
   regression: it is that sweep's own recorded observation ("超出 0.4mm 到
   5mm ... 沒有處理") arriving as numbers. Added `crownTop` to `MotionWaiver`
   and declared the five, under the same rule as every other waiver — a waiver
   the clip does not need fails.
5. **The crown-throw floor is 0.05, not the plan's 0.10.** The plan derived
   0.10 from the VRoid body's long hair being thrown 146mm. The simulated body
   is Milfy, whose twintails are shorter and read 89mm, so a 0.10 floor would
   fail on a correct simulation. 0.05 still separates a simulator that tracks
   the crown from one that does not (C1 and C2 both redden it).
6. **The skirt gate is 40mm with a different mutation body.** The plan wanted
   `≤ 60` reddened by a copy with the skirt's spring collider groups cleared.
   That copy changes nothing: the file's `J_Sec_*_Skirt` springs are dormant
   because Phase 4 skins the skirt by drape, so what the gate actually measures
   is the skinning. The mutation body is instead a copy with `Outfit_Bottom`
   skinned wholly to the hips, which reads 49mm against the shipped 18mm; the
   budget is 40 so that body fails and the shipped one has room.
7. **Phase 6a's deferred face-sampling item was fixed here.** See below.

Four smaller substitutions, for the record.

- The plan's twin mutation ("留 `_v0Import` → 拋錯") has no target any more:
  Phase 6a replaced that path with `plugin.afterRoot`. C3 reddens the twin test
  through the version-dependent camera sign instead.
- The plan's fringe-removal mutation was to redden `dance`'s "declares a pan it
  does not need". With the fringe at 1.5mm the clip that stops needing its
  waiver first is `squat`, so C8 reddens that.
- `crownY` is the topmost vertex of every part she draws, not of `Hair_*` only
  as the plan's bullet said. The frame's top edge cuts whatever is up there,
  and on `stretch` that is a hand.
- `dropSleeves`' `|x| <= 0.3` cut was removed rather than replaced with a
  shoulder-x fallback. Phase 4's binding data names each part's lead bone, so
  the sleeves can be selected by "dominated by an arm bone" outright and the
  positional fallback has nothing left to do.

## The face guard sampled keyframes only

Phase 6a left this open: `rigProbe.test.ts` asserted the dance's hand is 0.266
into the head ellipsoid at an interpolated frame while `measure-motions`
reported 0.300. Measured (`clearance-0906-probe-face.ts`), the cause is that
half the clip pack is keyed at 30fps and the engine draws the frames between:

| clip | keys | worst at keys | worst at 60 Hz | largest key gap |
|---|---|---|---|---|
| dance | 805 | 0.3004 @8.233s | **0.1975 @8.217s** | 34.0ms |
| scratchHead | 194 | 1.2173 | 1.2173 | 34.0ms |
| peaceSign | 702 | 1.9245 | 1.9246 | 16.7ms |
| stretch | 137 | 2.2361 | 2.2362 | 34.0ms |
| squat | 692 | 2.7028 | 2.7030 | 16.7ms |
| spin | 560 | 5.7712 | 5.7714 | 16.7ms |
| modelPose | 452 | 11.3843 | 11.3843 | 16.7ms |
| akimbo | 321 | 18.7142 | 18.7142 | 34.0ms |
| playFingers | 145 | 22.3535 | 22.3542 | 34.0ms |
| idleLoop | 250 | 36.6637 | 36.6637 | 41.7ms |

Nine of the ten are unchanged to four decimals. The one that moves is the one
that has a waiver, and it moves by a third. Converted to a distance, the
dance's hand goes **51.0mm** into the head ellipsoid, in 34 of the 1608 frames
the engine draws; it was 38.9mm on the keyframe grid.

`sampleTimes` now walks the clip at 60 Hz as well, and `dance`'s `handInHead`
went from 0.29 to **0.19**. The waiver did not get looser: the measurement
stopped stepping over the worst frame. Re-producing the measured half changed
exactly two fields (`faceRatio` 0.3004 → 0.1975, `faceRatioAt` 8.23 → 8.22) and
nothing else.

The probe rebuilds the keyframe union from the tracks rather than reading
`sampleTimes`, which now carries the 60 Hz walk this table is the evidence for.
Reading it would compare the fix with itself.

## Measurements

**The crown, simulator against browser** (Milfy, column framing, alpha > 8/255,
live-preview at 60fps on a GPU):

| | simulator | browser | residual |
|---|---|---|---|
| at rest | 1.5881 | 1.5853–1.5878 | −0.3mm |
| dance peak | 1.7099 @11.97s | 1.7112 @11.96s | +1.3mm |

`crownFringe` is 0.0015: the larger residual rounded up to 1.5mm, just over the
1.302mm a column row is worth at this framing (`avatarMetresPerPixel`).

**`crownOn`'s one approximation, bounded** (`clearance-0906-probe-transfer.log`).
It carries the throw as a projected height and the offset between two bodies'
resting crowns as a world height. Over this family's actual spread of 6.3mm,
carrying that offset projected instead of world moves the answer by at most
+0.32mm (a crown 80mm toward the camera) and −0.15mm (80mm away), 0.10mm on the
axis, in both frames. Inside the fringe. A family whose bodies differ by
centimetres would need the sibling's resting crown projected too.

**The pinned spring readings reproduce** after the de-Milfying rewrite: dance
37mm into the coat at t=17.23s, yaw −107°; spin 42mm at t=2.07s, −90°; largest
one-frame turn 21.7°.

**The two mutated bodies fail their gates** (`clearance-0906-models.py`, read
back in `clearance-0906-models.log`):

| body | reads on `dance` | shipped body reads |
|---|---|---|
| skirt skinned wholly to the hips | 49mm of leg through the skirt | 18mm |
| twintails with no colliders | 267mm into the coat, 13% of the tail, 54mm in at rest, 29.2° one-frame turn | 37mm, 0%, 0mm, 21.7° |

In the mutation log the second body fails on the rest-pose coat assertion
(53.9mm against a 5mm budget), which is the first of that test's five and so
the one that reports. The deeper readings above are the same body measured
straight through the simulator.

**The derived leg-envelope heights change nothing measurable.** Knee to hip+5cm
is 0.50…0.92 on the shipped body against the typed 0.60…1.00; the 33 shared
heights differ by at most 0.0003mm, and no height above 0.90 ever carried a
leg.

**The static clipping gates separate** (`clipping-0906-receipts.md`): every
garment sunk 25mm into the body, the boot shrunk to 0.9.

| garment | pierce control | pierce mutated | inside control | inside mutated |
|---|---|---|---|---|
| Outfit_Top | 0.00 | 34.05 | 0/313 | 237/313 |
| Outfit_Socks | 0.00 | 9.76 | 1/307 | 142/307 |
| Outfit_Bottom | 0.00 | 6.31 | 0/307 | 82/307 |
| Outfit_Cardigan | 0.03 | 6.35 | 0/303 | 16/303 |
| Outfit_Shoes | 0.01 | 4.01 | 2/301 | 9/301 |

`motion.py` over the ten clips, bodice sunk 25mm: 0.02× (playFingers t=0.6s)
against 36.79× (idleLoop t=3.89s). The multipliers in `motion.py`'s own
calibration comment (38, 20, 11, 8, 2.83) were measured on the 2026-08 build
and the garments have been rebuilt several times since; what this receipt
establishes is the separation, not those numbers.

## Red first

`clearance-0906-red.log` is the first run: 5 failed of 12, the test files
unable to resolve `./clearance` before the modules existed.

Two intermediate runs are kept because they are where the last two deviations
were found. `clearance-0906-vitest-first.log` (6 failed of 146) is the first
run with a real crown, where `spin`, `squat` and `idleLoop` failed the column's
top edge — deviation 4. `clearance-0906-vitest-second.log` (1 failed of 131) is
after the `crownTop` waivers, failing on a top-edge number in a regex that had
been written against the waist-up edge rather than the column's.

`clearance-0906-probe-crown.ts` and its log are the walk that found deviation
2: the world crown tracked frame by frame against what the browser drew, which
is what showed the gap was not a constant fringe.

`clearance-0906-pytests.log` is the Python suite before the envelope tests
were added; `clearance-0906-pytests-green.log` is the final one.

## Green

| suite | result |
|---|---|
| `npx vitest run` | 26 files, 407 tests passed |
| `python3 -m unittest discover -s scripts/avatar -p '*_test.py'` | 223 tests, OK |
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0 |
| `python3 scripts/avatar/envelope.py` | 41 heights carry a leg, radius 0.3007 at most |
| `python3 scripts/avatar/pierce.py` | PASS, 15 px total at rest |
| `python3 scripts/avatar/motion.py` | PASS, worst 0.69× (Outfit_Bottom, modelPose t=4.7s) |

`leg-envelope.json` was regenerated over the derived heights and committed with
the change, so the file the build reads and the heights the test derives are
the same sweep.

Both produced halves were re-run from the final source and came back
byte-identical to what is committed, so the artifacts are what today's code
writes rather than what an earlier draft wrote.

## Mutations

22, all RED with the restore verified by sha256:
`mutations-0906-clearance.md`. The harness is Phase 6a's, with one check added:
a non-zero exit only counts as RED if the output shows a test that ran and
failed. `vitest -t <name that matches nothing>` also exits non-zero, and the
first run of C15 was exactly that — the wrong rig in one produced half is
refused by `combineClearance` at module load, so the test it was aimed at never
ran. C15 now moves both halves together, which is the failure mode it means: a
declared variant whose rig is not the family's.

## Not done

- **The pans are still per-clip, not per-body.** `motionPan` lives on
  `AvatarMotionDef` and the clearance records the framings it was simulated
  under, but a second family would have to re-derive them by hand. Noted in
  `avatarMotions.ts`; Phase 6b.
- **The VRoid bodies cannot be simulated.** They have no manifest, so `pink`
  and `base` contribute browser sweeps (`crownSeen`) rather than a simulation.
  `crownBound` takes the larger of the two, so the sweeps are not lost.
- **`build.py` still carries absolute heights** that correspond to no humanoid
  landmark (`torso` 1.181, `strap` 1.168–1.252, `sleeve` 1.155). Phase 6b.
