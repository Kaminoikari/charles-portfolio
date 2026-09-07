# The second family: VRM1_Constraint_Twist_Sample

The registry's second rig family, and the first body in it that is not an export
of the VRoid project every other body here descends from. It is declared in
`AVATAR_VARIANTS` and served from `/avatar/`, but it is **not offered to
visitors**: the look strip shows only the bodies marked `offered`, and this one
is not one of them. Mika is the character this site has; a second family exists
so that "the clips fit" stops being a single global fact and becomes a fact per
rig, with the guards to prove it.

## Provenance and licence

| | |
|---|---|
| served file | `public/avatar/vrm1-twist-sample.vrm` |
| source | https://github.com/vrm-c/vrm-specification/blob/master/samples/VRM1_Constraint_Twist_Sample/vrm/VRM1_Constraint_Twist_Sample.vrm |
| fetched | 2026-09-07 |
| size | 10,776,032 bytes |
| sha256 | `12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2` |
| author | pixiv Inc. |
| licence | VRM Public License 1.0 (https://vrm.dev/licenses/1.0/) |

Read out of the file's own `VRMC_vrm.meta` rather than off the listing page
(`scripts/avatar/evidence/seed-0907-candidate.ts`):

```
name                     VRM1_Constraint_Twist_Sample
authors                  ["pixiv Inc."]
copyrightInformation     (c) 2022 pixiv Inc.
licenseUrl               https://vrm.dev/licenses/1.0/
avatarPermission         everyone
allowRedistribution      true
modification             allowModificationRedistribution
commercialUsage          corporation
creditNotation           unnecessary
```

Redistribution and modified redistribution are both permitted, and unlike
Seed-san this file's own metadata says credit is **unnecessary**, so serving it
from `/avatar/` carries no obligation. The attribution above is recorded because
provenance is worth keeping, not because the licence demands it.

## Why this body

Read out of the files themselves by
`scripts/avatar/evidence/family2-0907-table.ts` (receipt
`family2-0907-table.log`), which counts each row the same way on both versions
so a column compares one question. Per BODY, not per family: half of these are
not what a family holds constant, and the two VRoid bodies below prove it.

| property | `twist` | `base` / `pink` | `milfy` |
|---|---|---|---|
| rigSha (`rigOf`) | `fd3a65952d9bce0a…` | `e2aad79ec6667a55…` | `e2aad79ec6667a55…` |
| VRM version | **1.0**, `VRMC_vrm` + `VRMC_springBone`, +Z forward | 0.x, −Z | 0.x, −Z |
| non-identity humanoid rest rotations | **28 of 54**, up to 120° | 0 of 54 | 0 of 54 |
| spring chains | 22 | 11 | 4 |
| collider shapes / groups | 13 / 12 | 28 / 12 | 202 / 17 |
| expressions | 18 VRM1 presets | 15 VRM0 blendShapeGroups | 15 VRM0 blendShapeGroups |
| resting crown | 1.6154 | 1.5820 | 1.5757 |
| widest drawn vertex | 0.6945 (47mm spare) | 0.6670 (74mm spare) | 0.6670 (74mm spare) |
| finger skin past the tip joint | 25.7mm | 18.0mm | 18.0mm |

The last two columns are ONE family and disagree on three rows: spring chains,
colliders, and the resting crown. That is the point of the split the registry
makes — `rigOf` hashes the skeleton, so springs, colliders and hair length are
free to differ inside a family, and the numbers that depend on them (the crown
above all) are measured per body. Milfy's 4 chains against 11 is a rebuild with
its own twin tails, not a lighter body. The six rows they agree on are the ones
`rigOf` covers or that follow from the same mesh.

"Non-identity" is measured as an ANGLE. Comparing the rotation array against
`[0,0,0,1]` counts 26 more bones on this body than are actually turned: files
carry identity quaternions written with float noise. By angle the split is
clean — the same 28 bones are over 0°, over 0.1° and over 1°, with nothing in
between, and 16 of them are over 5°.

The rig hashes differently, which is the only thing that makes it a second
family: 54 bones either way, but 28 of them rest somewhere the VRoid family's do
not, so a clip retargeted onto it lands elsewhere and the numbers that say
whether it stays in frame have to be measured again.

## What the second pass found

`rigProbe.test.ts` ran its whole `bundled motions` block against one body until
2026-09-07. It is now `describe.each` over `AVATAR_FAMILIES`, so this family is
held to the same 70 tests the first one is, and the file runs 194 where it ran
124. Turning that on failed five guards, and none of the five meant what it
looked like.

**One was the probe reading a 1.0 body through 0.x's axes.** `rigProbe` fixed
her forward direction at −Z, which is what a 0.x file faces before the engine
turns it round; `VRMUtils.rotateVRM0` is a no-op on a 1.0 file, which faces +Z
and is already looking at the camera. So `palmToViewer` was dotting this body's
palm against the direction of her back, and `peaceSign` measured 0.26 where it
needed 0.6. The sign now comes off `rig.version`, the way `applyMotion`'s clip
flip and `springsim`'s camera already did. Measured both ways round rather than
argued (`evidence/family2-0907-space.ts`):

| | eyes vs head bone | toes vs head bone | faces |
|---|---|---|---|
| VRoid 0.x | −29.7mm | −87.9mm | −Z |
| twist 1.0 | +21.4mm | +103.0mm | +Z |

`screenX` carried the same 0.x assumption and is fixed with it, but it is not
one of the five: at the time nothing would have reddened, because every caller
read both screen edges against the same budget and the mirror cancelled. That
stopped being true later the same day — the guard added for the stale generated
half compares each measured edge against the side the producer recorded, which
tells them apart — so F7 is a RED row now rather than the GREEN control it was
written as. The header's sideways axis had the same bug in prose — it
declared `+X = her right` flatly, when her left eye sits at x −0.018 on the
VRoid body and +0.017 on this one.

**One was a guard that had a body's name in it.** The rigSha assertion parsed
`AvatarSample_B_webp.vrm` by hand, so the second family was being asked whether
its clearance matched the FIRST family's rig. It reads `fam.body` now.

**Three were the clip, seen on a second body** — two clips, but `dance` reddens
two separate guards, the face one and the end-pose one. `dance` and `idleLoop`
broke the end-pose budgets, and the first family waives the same four numbers on
the same two clips. Side by side (`evidence/family2-0907-ends-*.log`):

| clip | measure | this body | VRoid (waived to) |
|---|---|---|---|
| dance | handInHead | 0.212 | 0.197 (0.19) |
| dance | hipsDrift | 144.9mm | 140.2mm (150mm) |
| dance | endWrist | 1.2358 | 1.1877 (1.19) |
| idleLoop | hipsDrift | 157.3mm | 152.1mm (160mm) |

Both drift numbers are 1.034× the first family's, which is the ratio of the two
bodies' resting hips (0.9081 against 0.8782): `applyMotion` scales a clip's hips
track by rest height, so the same clip walks 3.4% further to the side on the
taller body. The deepest face frame lands one 60Hz sample apart, t=8.23s here
against t=8.22s there — at `rigProbe.SAMPLE_HZ` those are neighbours, not one
frame. This family declares its own four, measured on it.

Nothing is excluded: every clip in the pool clears this body's frames once its
pan is applied.

`measure-motions.ts` computed `hipsDrift` and `endWrist` and printed neither, so
the report whose stated job is telling you whether a new body can keep the clip
pack was withholding two of the four numbers that decide it. It prints all three
end-pose measurements now, against the budget actually in force, and it found a
SIXTH failure the unit test could not reach: `dance`'s end wrist at 1.2358, which
sits behind an assertion that never ran because the drift assertion above it
failed first. `MAX_END_DRIFT` and `MAX_END_WRIST` moved to `avatarMotions.ts`
beside `MAX_HIPS_SINK` so the guard and the report read one copy.

## What it costs a visitor

A body no visitor can select still ships to every visitor, because
`AVATAR_FAMILIES` is imported eagerly and each family's clearance is three
modules of numbers. Two `vite build` runs one commit apart, receipt
`evidence/family2-0907-bundle.log`:

| eager index chunk | raw | gzip |
|---|---|---|
| `HEAD~1` | 939.46 kB | 345.79 kB |
| `1e4b0fa` | 943.83 kB | 346.90 kB |
| difference | **+4.37 kB** | **+1.11 kB** |

That is the whole commit, not the clearance file alone: the same chunk also
carries this change's edits to `rigProbe`, `avatarMotions`, `clearance`,
`avatarVariants`, `LookStrip` and `ChatWidget`. Most of it is the second
family's three clearance modules, and it is worth naming because it grows with
every family added. The
`.vrm` itself (10.8 MB) costs nothing until something asks for it: bodies are
fetched by URL at runtime, and nothing offers this one.

One more thing nothing was watching: `clips[*].reach` has no reader — only
`waiver.reach` is read — so this family's generated half sat mirrored, written
before `screenX` stopped assuming a 0.x body. Ten pairs, values right and labels
backwards. The frame guard now re-measures and compares against what the
producer wrote. Mutation F10 reverts one pair and reddens one test; the file as
it shipped, all ten pairs mirrored, reddens ten. Both counted:
`evidence/family2-0907-reach-counts.log`.

Receipts: `evidence/family2-0907-mutate.py` (F1–F10, nine RED and one GREEN
control), `family2-0907-space.log`, `family2-0907-ends-*.log`,
`family2-0907-pans.log`, `family2-0907-table.log`, `family2-0907-bundle.log`,
`family2-0907-reach-counts.log`.

## The body this replaced, and why

Seed-san (`scripts/avatar/fixtures/seed-san.vrm`,
`docs/plans/avatar-fixture-seed-san.md`) was the plan's chosen second body and
remains the integration fixture for the BUILD pipeline, where it did its job.
It cannot be a variant, and the reason is worth keeping because no guard caught
it:

Seed-san draws a **1.21m robot arm** (`robo_arm`, 3,795 vertices) rigged to 32
bones that no humanoid entry claims. Nothing retargets those bones; the arm
rides its humanoid parent rigidly. In bind pose, before any clip plays, its
outermost vertex is **1.2135 screen units against a 0.7415 half-width budget**,
so 472mm of it is outside the frame. The widest thing on any body the registry
declares is 0.6945, and on the three VRoid bodies it is 0.6670.

`measure-motions` never said so, because the sideways guard measures humanoid
JOINTS (`rigProbe.silhouetteJoints`) and the robot arm has none. What did notice
was the crown, which is a VERTEX measure: a `springsim --clearance` run on this
body projected a crown far in front of it, which is what sent me looking. That
run's log was not kept, so the figure it printed is deliberately not quoted
here; what is quoted below is measured by probes whose logs are beside them, and
they are enough on their own — a bone at z=1.547 above head height, and a drawn
vertex 472mm outside the frame. Receipts: `scripts/avatar/evidence/seed-0907-probe.ts`
(the furthest-forward node above head height, `robo_f_pinky.03.L` at z=1.547),
`seed-0907-meshes.ts` (the mesh bounds, and 32 `robo*` nodes of which 0 are in
the humanoid map), `seed-0907-candidate.ts` (the silhouette against the budget).
All three were written while the fixture still sat in `public/avatar` and could
not run once it moved; they take a path from the repo root now, and their `.log`
files beside them are what the figures above are read from.

**Flagged, not fixed** (out of scope for this change): the sideways guard's
joint proxy has no skin allowance at all, while the vertical one adds
`SKIN_ABOVE_JOINT`. On every body declared here the widest drawn vertex is
inside the budget with 47mm or more to spare (`family2-0907-table.log`), so
nothing is cropped today; a body whose silhouette is not its joints would not be
caught.

## What PASS means here

Three rounds of review produced six FAIL verdicts and one code defect (the
mirrored `reach` pairs, `2f27c0c`). The other findings were prose, and roughly
half of each round's were made by the previous round's fixes. "Neither reviewer
can find anything" is not a condition that terminates, so from round four the
bar is written down instead:

- **Gate A — mechanical.** `npx vitest run`, `npm run build`, `pytest`, and
  `family2-0907-mutate.py` all green, with the harness's ten rows reading nine
  RED and F8 GREEN and every restore sha256-verified. Receipts are the `.log`
  files in `scripts/avatar/evidence/`.
- **Gate B — scope and grade.** Reviewers read `9f47b0e..HEAD` and nothing
  else, and grade each finding BLOCKING (a reader would act wrongly on it, or
  shipped behaviour is wrong) or ADVISORY (taste, wording, a suggestion).
  **PASS is zero BLOCKING.** ADVISORY findings are recorded here and not fixed.
- **Gate C — no new prose.** A round's fixes may correct an existing sentence
  or delete one. Adding a paragraph, a number without a `.log` beside it, or a
  count nobody ran is what kept rounds two and three alive.

A number in this document or in a comment is BLOCKING only if a receipt in
`scripts/avatar/evidence/` contradicts it. If nothing measured it, the fix is to
delete the number, and the finding is ADVISORY.

Round four returned **PASS from both reviewers, zero BLOCKING**. Two of the five
ADVISORY findings were sentences a receipt contradicted, so they were corrected:
`vroid-sample-b.ts`'s "scratchHead is the same story one millimetre lower" (the
three pairs in `crown-0907-headroom.log` differ by 1.5mm, 0.1mm and 3.5mm, and
in two directions) and `family2-0907-space.ts`'s header, which described
`CAMERA_DIR` and `screenX(x) = -x` in the present tense after this very run had
replaced them. A third was the Gate A sentence above pointing at a build receipt
that did not exist; `family2-0907-build.log` is that receipt.

**Recorded and not fixed**, per Gate B:

- `clearance.ts:274` rejects a waiver or a `crownSeen` entry naming a clip no
  producer measured, but `pans`, added on 2026-09-07, is not in that list. A pan
  declared for a clip outside the pool is a silent dead key. Declaring the wrong
  VALUE, or none at all, is still caught by the derivation guard.
- `rigProbe.test.ts:530` runs once per family over `crownSeen`, which is empty
  for this one, so that guard asserts nothing on the second family. Nothing has
  rendered this body; the emptiness is the honest state, not a gap in coverage.
