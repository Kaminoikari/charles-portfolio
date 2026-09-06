# Integration fixture: Seed-san

The second body the pipeline is checked against. It is a fixture, not a variant:
it is never declared in `AVATAR_VARIANTS`, never served from `/avatar/`, and
nothing about it reaches a visitor. It exists so that Phases 1–4 have an
acceptance on a body that is not the VRoid sample, which is the only way to
tell a generalised pipeline from one that happens to work on the body it was
written against.

## Provenance and licence

| | |
|---|---|
| file | `scripts/avatar/fixtures/seed-san.vrm` |
| source | https://github.com/vrm-c/vrm-specification/blob/master/samples/Seed-san/vrm/Seed-san.vrm |
| fetched | 2026-09-07 |
| size | 10,917,800 bytes |
| sha256 | `624d0d554bc205bbdc33e22a68a2c3c20edebb3e573011ead8878a65e5329b23` |
| author | VirtualCast, Inc. |
| licence | VRM Public License 1.0 (https://vrm.dev/licenses/1.0/) |

The VRM Public License grants what the file's own `VRMC_vrm.meta` says it
grants, so the terms below are read out of the binary rather than off the
listing page:

```
avatarPermission           everyone
allowRedistribution        true
modification               allowModificationRedistribution
commercialUsage            corporation
creditNotation             required
copyrightInformation       VirtualCast, Inc.
licenseUrl                 https://vrm.dev/licenses/1.0/
```

Redistribution and modification are both permitted, including redistribution of
a modified file, which is exactly what a pipeline run produces. **The one
obligation is credit**: `creditNotation: required` means any surface that shows
a build derived from this file must name VirtualCast, Inc. Nothing derived from
it is shipped today (fixture builds land in `scripts/avatar/out/`, which is not
served), so the obligation currently has no surface; the moment one appears the
credit goes with it.

## Why this body

The plan asked for a fixture that walks paths the VRoid family cannot. Measured
against `public/avatar/AvatarSample_B_webp.vrm`:

| property the plan asked for | Seed-san | base body |
|---|---|---|
| VRM 1.0, `VRMC_vrm` + `VRMC_springBone`, +Z forward | yes, specVersion 1.0 | VRM 0.x, −Z |
| humanoid bone set different from the 54 | **51** — no `upperChest`, no eyes, VRM1 thumb names | 54 |
| non-identity rest rotations | **all 51 humanoid nodes** | every one identity |
| spring chain with colliders | 9 springs, 8 colliders, 2 chains carrying collider groups | 11 / 12 / 9 |
| VRM1 `expressions` presets | 18, including `blink`, `aa`, `ee`, `ih`, `oh`, `ou` | VRM0 `blendShapeMaster` |
| MToon materials | `VRMC_materials_mtoon` | VRM0 `materialProperties` |

Two of the plan's requirements are NOT met, and both are recorded here rather
than waived quietly:

- **Height.** The plan wanted a body ≥10% away from 1.5046. Seed-san stands
  1.5801 against the base's 1.5815 — 0.1% apart. So this fixture does not
  exercise the scale-dependent absolute constants. Three of the ones this note
  first listed are gone: `build.py`'s 1.181 / 1.168–1.252 / 1.155 became
  fractions of the body's own waist-to-shoulder span on 2026-09-07, and
  `proportion.CHIN_Y` became a fraction of the band between the neck joint and
  the lowest head-owned vertex the same day. `twintail.TIE_Y` and
  `COAT_LEG_BAND_TOP` remain. That dimension stays with the synthetic scaled
  body Phase 5 already uses, which is the fixture that can vary height alone.
- **A-pose or non-vertical legs.** Seed-san's upper-to-lower leg segment sits
  0.9° off vertical and its arm 0.5° off horizontal; the base is 3.4° and 2.7°.
  It is closer to a T-pose, not further. The requirement was a proxy for
  "does not rest the way VRoid rests", and the mechanism it was proxying for is
  met far more strongly: `outfit.py`'s header says the retarget breaks because
  "VRoid leaves every rest rotation at identity", and here every single
  humanoid node carries a real rotation.

And one property the plan did not think to ask for, which is probably the most
valuable thing in the file:

- **Five meshes, five skins, five distinct inverse-bind-matrix accessors, and
  joint lists of five different lengths (23, 7, 1, 21, 80).** The base body has
  three skins that all share one 125-joint list and one IBM accessor, which is
  why Phase 3's per-mesh skin work — `pierce`, `partmap`, `twintail`,
  `bonemap`, `outfit.pieces`, `build`'s head-accessory slot — has a wiring scan
  and no behavioural test anywhere. This file is that test.

## First run

`python3 make.py --base fixtures/seed-san.vrm`, log in
`scripts/avatar/evidence/fixture-0907-make.log`. It gets through the entry
conversion and the first gate and stops where the plan predicted it would:

- **Step 0b, VRM 1.0 → 0.x (Phase 3.5): passes**, and reports what it cannot
  carry rather than dropping it silently — three expression `override*` fields,
  six VRM1-only meta fields, 23 nodes' `VRMC_node_constraint`, seven capsule
  colliders approximated as 2–7 spheres each, two springs whose per-joint
  stiffness/hitRadius collapse to the root joint's, and eight materials whose
  `matcapFactor` of [0,0,0] becomes white under 0.x's colourless `_SphereAdd`.
- **Step 1, partition: this is where the run stops, and the first time it ran it
  did not stop at all.** `partition` names Body's parts by primitive INDEX and
  the hair by where a strand sits in this body's space, and it selected those
  rules by mesh name (`Body.baked`, `Face.baked`). Seed-san's meshes are called
  `hair`, `hair_tail`, `head`, `robo_arm` and `wear`, so every one of them fell
  through to the hair rule and the step wrote a six-part manifest calling a
  robot's arm and its clothes `Hair_Twintail_R`, `Hair_Bangs`, `Hair_Side_L`.
  No error, a file that loads, a manifest that reads plausibly, and every later
  step would have believed it.

  Fixed the same day: `partition.recognise(doc)` states the assumptions the
  naming rests on and `partition()` refuses a body that does not meet them,
  naming both what it wanted and what it found. The run now ends there with:

  ```
  1. partition
  out/base-vrm0.vrm 不是這一步認得的 VRoid 匯出，拒絕命名：
    - 沒有名為 Face.baked 的 mesh（有的是：hair, hair_tail, head, robo_arm, wear）
    - 沒有名為 Body.baked 的 mesh，因此 BODY_NAMES 的 primitive 編號對不到任何東西
  ```

  Four tests in `gate_test.PartitionRecognises` and five mutations
  (`evidence/mutations-0907-fixture.md`, P1–P5) hold it, P5 being the positive
  half so that "refuse everything" cannot pass as a guard.

## verify.report against the original

The plan's acceptance for the fixture was `verify.report` run with it as the
baseline. `verify.report('out/base-vrm0.vrm', baseline='fixtures/seed-san.vrm')`
asks one question the baseline is actually for -- did the conversion move a bone
-- and a dozen it asks of any file. Log in `evidence/fixture-0907-verify.log`.

**The baseline comparison passes: `compare(baseline, this) = []`.** It did not
on the first run, and neither reason was a moved bone:

- the conversion turns the body π about Y (0.x faces −Z, 1.0 faces +Z), so every
  bone off the centre line read as moved by twice its offset;
- the two versions spell the thumb joints differently (Metacarpal/Proximal/
  Distal against Proximal/Intermediate/Distal), so `leftThumbProximal` was
  measured against the joint one along, 32mm away, and two bones per hand looked
  like they existed on one side only.

`vrmrig.compare` now expresses both sides the 0.x way before measuring. Within
one version -- every build-time gate -- nothing changes: both sides get the same
treatment. Seven mutations in `evidence/mutations-0907-compare.md`, all RED,
two of them the positive half (a bone that really moved is still caught, across
the versions and within one).

The report still returns False, on three checks that are this site's art
direction rather than anything about a VRM:

| check | what it says | whose |
|---|---|---|
| `loud_outlines` | two materials outline at chroma 0.08 and 0.09 against a 0.04 cap | the site's flat-black outline look |
| `undeclared_rims` | five materials state no `_RimColor`, so they would take the site accent | the site's rim convention |
| `torn_bindings` | `wear#3` grows an edge 36mm with an upper arm at 60° | Seed-san's own garment weighting |

The third is the one worth being sure about, because it is the check Phase 4
exists for. It reads **35.666022291444214mm on the original 1.0 file and
35.666022291444214mm on the conversion** -- identical to the last digit, so the
conversion did not touch the skinning. It is how VirtualCast weighted that
garment, not something this pipeline did to it.

Out of scope, noted rather than fixed: `verify.loud_outlines` raises a bare
`KeyError: 'VRM'` on a 1.0 file. Everything verify checks is a 0.x output of
this pipeline, so it is never handed one in normal use.

## What this run settles, and what it does not

**Settled: Phases 0–4 generalise.** The plan predicted the fixture would be
stopped in order by the `54` bone gate, `outfit.py`'s `MAP`, `skins[0]`, and
`build.py:590`. All four are gone — the entry conversion, the humanoid reader,
the skeleton gate and the per-mesh skin resolution all took a 51-bone VRM 1.0
robot with five differently-shaped skins and non-identity rest rotations
everywhere, without a special case.

**Not settled: the content layer, and it is not a bug.** What stops the run is
that `partition` (which primitive is a shoe) and `make.DROP` (which parts the
Milfy recipe removes) are facts about a VRoid export, and `build.py` grafts an
outfit modelled for that body. Deriving "which primitive is a garment" on an
arbitrary VRM is the automatic-fitting problem the plan already ruled out of
scope. So the honest end state is a pipeline whose machinery is body-agnostic
and whose recipe is not, with the boundary between them now marked by a refusal
instead of by a wrong answer.
