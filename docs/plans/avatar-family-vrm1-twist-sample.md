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

Read out of the two files by `scripts/avatar/evidence/family2-0907-table.ts`
(receipt `family2-0907-table.log`), which counts each row the same way on both
versions so the columns compare one question:

| property | this body | the VRoid family |
|---|---|---|
| rigSha (`rigOf`) | `fd3a65952d9bce0a…` | `e2aad79ec6667a55…` |
| VRM version | **1.0**, `VRMC_vrm` + `VRMC_springBone`, +Z forward | 0.x, −Z |
| non-identity humanoid rest rotations | **28 of 54**, up to 120° | 0 of 54 |
| spring chains | 22 | 11 |
| collider shapes / groups | 13 / 12 | 28 / 12 |
| expressions | 18 VRM1 presets | 15 VRM0 blendShapeGroups |
| resting crown | 1.6154 | 1.5820 |
| widest drawn vertex | 0.6945 (47mm spare) | 0.6670 (74mm spare) |
| finger skin past the tip joint | 25.7mm | 18.0mm |

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
one of the five: nothing would have reddened, because every caller reads both
screen edges against the same budget and the mirror cancels. Mutation F7 is that
statement, checked. The header's sideways axis had the same bug in prose — it
declared `+X = her right` flatly, when her left eye sits at x −0.018 on the
VRoid body and +0.017 on this one.

**One was a guard that had a body's name in it.** The rigSha assertion parsed
`AvatarSample_B_webp.vrm` by hand, so the second family was being asked whether
its clearance matched the FIRST family's rig. It reads `fam.body` now.

**Two were the clip, seen on a second body.** `dance` and `idleLoop` broke the
end-pose budgets, and the first family waives the same four numbers on the same
two clips. Side by side (`evidence/family2-0907-ends-*.log`):

| clip | measure | this body | VRoid (waived to) |
|---|---|---|---|
| dance | handInHead | 0.212 | 0.197 (0.19) |
| dance | hipsDrift | 144.9mm | 140.2mm (150mm) |
| dance | endWrist | 1.2358 | 1.1877 (1.19) |
| idleLoop | hipsDrift | 157.3mm | 152.1mm (160mm) |

Both drift numbers are 1.034× the first family's, which is the ratio of the two
bodies' resting hips (0.9081 against 0.8782): `applyMotion` scales a clip's hips
track by rest height, so the same clip walks 3.4% further to the side on the
taller body. The deepest face frame is the same frame on both, t=8.23s against
t=8.22s. This family declares its own four, measured on it.

Nothing is excluded: every clip in the pool clears this body's frames once its
pan is applied.

`measure-motions.ts` computed `hipsDrift` and `endWrist` and printed neither, so
the report whose stated job is telling you whether a new body can keep the clip
pack was withholding two of the four numbers that decide it. It prints all three
end-pose measurements now, against the budget actually in force, and it found a
fifth failure the unit test could not reach: `dance`'s end wrist at 1.2358, which
sits behind an assertion that never ran because the drift assertion above it
failed first. `MAX_END_DRIFT` and `MAX_END_WRIST` moved to `avatarMotions.ts`
beside `MAX_HIPS_SINK` so the guard and the report read one copy.

## What it costs a visitor

A body no visitor can select still ships to every visitor, because
`AVATAR_FAMILIES` is imported eagerly and each family's clearance is three
modules of numbers. Measured as two `vite build` runs one commit apart:

| | raw | gzip |
|---|---|---|
| before | 939.46 kB | 345.79 kB |
| after | 943.83 kB | 346.90 kB |
| this family | **+4.37 kB** | **+1.11 kB** |

That is the price of the second rig being a real declaration rather than a
fixture, and it is worth naming because it grows with every family added. The
`.vrm` itself (10.8 MB) costs nothing until something asks for it: bodies are
fetched by URL at runtime, and nothing offers this one.

Receipts: `evidence/family2-0907-mutate.py` (F1–F9, seven RED and two GREEN
controls), `family2-0907-space.log`, `family2-0907-ends-*.log`,
`family2-0907-pans.log`, `family2-0907-table.log`.

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
so 472mm of it is outside the frame. Every body already here sits at 0.6670.

`measure-motions` never said so, because the sideways guard measures humanoid
JOINTS (`rigProbe.silhouetteJoints`) and the robot arm has none. What did notice
was the crown, which is a VERTEX measure: `springsim` read this body's `spin`
crown at 2.2274 through the column camera against a world crown of 1.6115,
which is a drawn vertex 1.24m in front of the body. That number is correct; the
arm really is out there. Receipts: `scripts/avatar/evidence/seed-0907-probe.ts`
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
