# Phase 6a receipt (2026-09-06): one retarget, on three-vrm's own humanoid

Plan: `~/.claude/plans/nested-conjuring-wirth.md`, section "Phase 6a". Files
this receipt cites are in this directory unless a path is given.

## What was wrong

Three copies of "turn a .vrma onto this body", all VRM 0.x only:

- `rigProbe.ts` rebuilt three-vrm's normalized rig by hand (glTF parent walk),
  flipped x/z unconditionally (`applyMotion`) and never wrote the pose back to
  the raw nodes. It also renamed thumb tracks the 0.x way (`toModelBoneName`).
- `springsim.ts` had its own `Poser` writing flipped normalized rotations
  straight onto the raw nodes ("which rest at identity here"), a private
  `_v0Import` call for the springs, and its own sampler.
- `motion.py` flipped with `YAW` unconditionally and never translated the
  clip's 1.0 thumb names into a 0.x body's: the clip's `leftThumbProximal`
  (middle joint) landed on the body's `leftThumbProximal` (base joint), the
  base joint's own track (`leftThumbMetacarpal`) landed nowhere, and the
  middle joint was never posed.

`FACE_BOX` was a 2026-08-19 hand measurement carried as constants and only
re-centred on another body, never re-sized.

## What changed

- `vrmHumanoid.buildNodes(json)` (moved from springsim): one `THREE.Bone` per
  glTF node, parented and placed as the file says.
- `rigProbe.buildRigFrom(glb)`: `buildNodes` → raw bones renamed to three-vrm's
  1.0 thumb names for a 0.x file (`thumbBoneNameMap`, as `VRMHumanoidLoaderPlugin`
  does) → `new VRMHumanoid(humanBones)`. `Rig` gained `humanoid`, `version`,
  `raw`, `scene`, `faceBox`; `bones` are the humanoid's normalized nodes (plus
  the synthetic `…Tip` per finger, hung on the normalized distal). `applyMotion`
  flips only when `version === '0'`, then `root.updateMatrixWorld` →
  `humanoid.update()` → `scene.updateMatrixWorld`, so the raw skeleton carries
  the pose. `buildMotion` no longer renames anything; `handJoints` samples the
  thumb at Metacarpal/Proximal/Distal.
- `springsim.ts`: `Poser`, `sampleQuat`, `buildNodes` deleted; `runClip` poses
  through `applyMotion`; springs imported through the public `plugin.afterRoot`
  (which dispatches 1.0/0.x itself); `Skinner` and the tail readings run on
  `rig.raw`. `springsim.test.ts` pins the shipped readings (dance 37mm @17.23s
  yaw −107°, spin 42mm @2.07s yaw −90°, ±2mm/0.1s/3°) as the instrument's identity.
- `motion.py`: `YAW` applied only when `humanoid.version(model_doc) == '0'`;
  delta keyed by `humanoid.model_bone_name(model_doc, bone)` (new; the thumb
  table `V1_TO_V0_THUMB` moved from `vrm1to0.py` into `humanoid.py`); clip
  samples read as float64. `retarget_test.angle` takes `humanoid.forward_z`.
- `deriveFaceBox(glb, raw, headNode)`: AABB of the vertices of every mesh named
  `Face…` that are mostly skinned to the head, in the file's own space, stored
  as `Rig.faceBox`; `headVolume(rig)` reads it. `FACE_BOX` deleted.
  `avatarMode.test.ts` now holds `AVATAR_HEAD_BOTTOM_Y` to within 1mm of the
  shipped body's derived box (was `toBe(FACE_BOX.min.y)`).
- `deriveFingerSkinRadius(glb, rig)`: largest distance from any Body vertex
  mostly skinned to an outer phalanx to that phalanx's segment. Reported by
  `measure-motions.ts` beside `SKIN_ABOVE_JOINT`.
- New `scripts/avatar/retarget-dump.ts` (raw world rotation of every humanoid
  bone at requested clip times, shipped body and its VRM 1.0 twin) and
  `scripts/avatar/retarget_parity_test.py`.

## Deviations from the plan text, and why

- **`SKIN_ABOVE_JOINT` stays a constant.** The plan's derivation ("skin past
  the synthetic Tip along the finger axis") measures 0.74mm on this body
  (rightThumbDistal, `retarget-0906-probe-skinpast.log`), not 12mm: the 12mm
  read off the screenshot is skin radius seen from above at the stretch pose,
  which depends on the pose. The derived finger skin radius is 18.0mm
  (`retarget-0906-measure.log`, 18.03 in the probe), reported and tested
  (≥ 0.012, < 0.02); the frame keeps reserving 12mm until Phase 5's per-clip
  skin top replaces it.
- **The springsim readings pinned are the 2026-09-06 pre-change ones, not the
  plan's "2026-09-04: dance 38mm / spin 32mm".** Those were read on
  `mika-milfy-3.vrm`; the body is `mika-milfy-12.vrm` now and the plan's
  numbers no longer exist to reproduce. The requirement (the new poser must
  reproduce what the old one measured) is met against the readings taken
  immediately before the change (`retarget-0906-springsim-before.log`).
- **The parity test's twin tolerance is 1e-4°, not the 1e-6° the red run
  used.** Even in float64 the two paths round differently through acos near
  1; a flip error is 13° at the hips (the red run) and 180° at a hand.
- **`faceBox` lives on the `Rig`, in the file's space, not as a `headVolume`
  parameter in head-local space.** `headVolume(rig)` converts to head-local as
  before, every consumer keeps its signature, and the twin's box comes out
  turned round with the body (tested).
- **No `measure-motions.ts --write` producer.** Nothing consumes a written
  clearance file yet; Phase 5 introduces the `.gen.ts`. The report prints both
  derived numbers instead.
- **Face mesh chosen by mesh name (`/^Face/`), not by manifest part or
  material.** The shipped bodies and VRoid exports both name it so; the
  manifest fallback the plan sketched is not needed until a body without the
  name shows up, and the derivation throws rather than guesses when none does.

## Measurements

- **VRMHumanoid in Node** (`retarget-0906-probe-humanoid.ts`, log
  `retarget-0906-probe-humanoid.log`): on the shipped 0.x body, its VRM 1.0
  twin (root turned π) and a 0.x body whose left upper arm rests on a 15°
  roll, a seven-bone pose written on the normalized nodes and pushed through
  `update()` lands every raw bone at the same world position (0.0000mm) and
  rotation delta (0.00000°) as the normalized one.
- **Parity** (`retarget-0906-pytests.log`): motion.py against the TypeScript
  rig, 3 clips × 4 frames, every humanoid bone's raw world rotation, shipped
  body and twin: worst 0.0746° (modelPose @2.82s, rightIndexDistal; nlerp vs
  slerp), limit 0.5°.
- **Springsim reproduces itself** (`retarget-0906-springsim-before.log` and
  `…-before-stride3.log` before; `retarget-0906-springsim-after.log`, the same
  `--clip=all` table through the new poser, after; `…-springsim-test.log` is
  the green pinned test): all ten clips read the same coat depth, time, yaw,
  body depth and jump, e.g. dance 37mm @17.23s yaw −107°, body 50mm, jump
  21.7°; spin 42mm @2.07s yaw −90°, jump 12.4°. The only differences are two
  timestamps of a tied 17mm body reading (idleLoop 0.00s → 8.17s, peaceSign
  0.00s → 2.93s): the reading is the rest value and the argmax falls on a
  different frame of the tie.
- **Face box** (`retarget-0906-probe-faceratio.log`): derived
  (−0.0917, 1.2873, −0.1126)…(0.0918, 1.5034, 0.0326) against the 2026-08-19
  constants (−0.092, 1.287, −0.113)…(0.092, 1.503, 0.033): ≤ 0.4mm per edge.
  The dance face ratio moves 0.2987 → 0.3004 (waiver floor 0.29) and that is
  the box, not the thumbs: the same rig with the old constants reads 0.2987.
- **Flip pinned to the 0.x body** (`retarget-0906-probe-flip.log`): at dance
  8.23s the closest hand joint reads ellipsoid value 0.266 flipped and 11.864
  unflipped; the twin test alone cannot see which version is flipped (both
  bodies flipped the wrong way still agree up to the half turn), so
  `flips the clip for the 0.x body it ships on` asserts < 0.5.

## Red first (`retarget-0906-red.log`)

vitest: 9 failed of 131 (the six new rig tests, the two `buildNodes` tests,
and the wiring scan, which caught the first draft of the raw-vs-normalized
test reaching into `humanoid.humanBones`). Python: `retarget_parity_test`
2 failures (twin 13.2° off at the hips; `leftThumbIntermediate` never posed)
and 1 error (`retarget-dump.ts` did not exist).

## Green (`retarget-0906-vitest.log`, `retarget-0906-pytests.log`, `retarget-0906-retarget-test.log`)

- `npx vitest run`: 25 files, 395 tests (the final run, after the two tests added for R1/R5).
- `python3 -m unittest discover -s scripts/avatar -p '*_test.py'`: 219 tests.
- `python3 scripts/avatar/retarget_test.py`: PASS, worst +1.94° (idleLoop).
- `npx tsx scripts/measure-motions.ts`: every clip within budget; prints the
  derived box and the 18.0mm finger skin.

## Mutations (`retarget-0906-mutate.py`, `mutations-0906-retarget.md`)

Twenty-one, each a single named test, byte-copy restore checked by sha256, a
green vitest re-run once before it is believed. The first run (fifteen) left
two green: R1 (flip on the wrong version) because the twin test only checks
the two bodies against each other, and R5 (head-dominant filter) because the
shipped Face mesh has no vertex that the filter removes. Both got their own
test (`flips the clip for the 0.x body it ships on`, `leaves the neck rows of
the Face mesh out of the face box`). The spec review then found the
`measure-motions.test.ts` report guard (`reports the face box and the finger
skin it read off the body`) without a mutation and without a red-log entry:
it was written after the derivation landed, so its red evidence is M1
(box line dropped), M2 (the 12mm constant printed instead of the derived
radius; the pattern was tightened to `18.\dmm` for this) and R9 (vertices
not skinned by their joints, so a taller body's box stops scaling). R10
(version not carried) and V2 (node scale ignored) cover the two remaining new
tests. The code review then found the parity loop driven by the dump's own
key set with no floor: `test_vrm1_twin` now asserts the dumped bone set
equals the body's humanoid set, and P5 (dump drops the thumbs) turns it red.
The harness was re-run whole: see the table in `mutations-0906-retarget.md`.

## Code review follow-ups (same day)

- `skinnedVertices` now skins each vertex by its joints' rest matrices
  (`jointWorld · inverseBind`, the mesh node's own transform ignored, as glTF
  says and as springsim's `Skinner` does) instead of applying the mesh node's
  world matrix; identical on every body in the repo, different on a body
  whose Face node carries a transform its joints do not. Primitives sharing a
  vertex buffer are decoded once. The synthetic Face-mesh test fixture gained
  inverse bind matrices.
- `deriveFingerSkinRadius` takes the next joint from an explicit table and
  skips a zero-length segment: under mutation R8 the old code produced NaN
  (`0/0` in `closestPointToPoint`) rather than a palm-sized radius, so the
  guard was red for the wrong reason.
- A VRM 1.0 file that still spells its thumbs the 0.x way is renamed too
  (`existsPreviousThumbName` in three-vrm's `_v1Import`), on both sides.
- `yawDeg`'s comment had the sign backwards for a 0.x body; the number is
  unchanged. `measure-motions.ts` parses the model once.

## Not done

- No VRM 1.0 body has been through `springsim` (the twin has no
  `VRMC_springBone`; `afterRoot` would take one). Phase 5/6b.
- The parity test compares rotations only; `motion.py` does not retarget the
  hips translation and never did.
- `retarget-dump.ts` is only exercised on the shipped body and its twin, both
  resting at identity on every bone; the tilted-rest case is covered on the
  TypeScript side alone (`writes the pose through to the raw nodes`).
- The 0.266 read at an interpolated frame (8.23s) against 0.300 at the nearest
  keyframes says the face guard, which samples keyframes only, can miss a
  slightly deeper point between two keys. Out of scope; noted for Phase 5.
