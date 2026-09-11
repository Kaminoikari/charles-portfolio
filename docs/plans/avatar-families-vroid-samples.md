# VRoid's own sample avatars as rig families

Eleven were fetched and measured on 2026-09-11, and **all eleven are
registered**, each its own rig family, declared in `AVATAR_VARIANTS` and served
from `/avatar/`. **None of them is offered to visitors**: the look strip shows
only the bodies marked `offered`.

| | |
|---|---|
| `vroid-hair-female` | `vroid-sample-a` |
| `vroid-hair-male` | `vroid-sample-c` |
| `vroid-sendagaya-shibu` | `vroid-darkness-shibu` |
| `vroid-victoria-rubin` | `vroid-sakurada-fumiriya` |
| `vroid-vivi` | `vroid-sendagaya-shino` |
| | `vroid-vita` |

Five went in first. The other six landed on rules that no body of the original
three's proportions could reach, and went in the same day once those were fixed
at the rule rather than waived around; the measurements that forced each are in
**What the eleven found** below.

Why any of them are here is what `twist` and `studio` are here for. The
per-family paths in this repo — `motionPan`, `crownBound`, `panHolds`, the
per-family block of `rigProbe.test.ts`, and the `describe.each(FAMILIES)` blocks
of `avatarBow.test.ts` (one) and `avatarPitch.test.ts` (two) — were written
against one rig and generalised against three. They now run against fourteen.
Each of those `describe.each` blocks expands `AVATAR_FAMILIES` directly, so
adding a key to it is what widens them. A layer that only works on
the body it grew up on cannot survive that, and the point of the exercise is to
find out which parts those are.

They are not a step toward offering them. This site has one character, and the
look strip is a wardrobe rather than a cast list.

## Provenance and licence

All eleven were fetched on 2026-09-11 between 01:10 and 02:08 and repacked with
`scripts/compress_vrm_webp.py` (EXT_texture_webp). The originals are kept
alongside the repacks; where a body is served it is the repack that is served,
and the repack preserves the rig exactly, which is checked rather than assumed:
each body's `rigSha` in its two generated clearance halves is the sha of the
repack's rig. All eleven are committed and served from `/avatar/`.

The second table below is read out of each file's own `VRM.meta`, not off a
listing page. The first is read off the files themselves.

One column in it is an inference rather than a field, and is marked as such:
VRM 0.x `meta` has no redistribution key at all. Its keys are `version`,
`author`, `contactInformation`, `reference`, `title`, `texture`,
`allowedUserName`, `violentUssageName`, `sexualUssageName`,
`commercialUssageName`, `otherPermissionUrl`, `licenseName` and
`otherLicenseUrl`. Redistribution permission therefore comes from the licence
the file names, not from a field in it.

| file | bytes | sha256 (first 16) | registered |
|---|---|---|---|
| `AvatarSample_A_webp.vrm` | 5,054,576 | `d2549e2b00ca4b84` | yes |
| `AvatarSample_C_webp.vrm` | 4,907,920 | `ff2c311a83e70974` | yes |
| `Darkness_Shibu_webp.vrm` | 5,716,660 | `1bb025d3bb37e397` | yes |
| `HairSample_Female_webp.vrm` | 4,662,016 | `fbdcf35383bb4278` | yes |
| `HairSample_Male_webp.vrm` | 4,440,972 | `4e26b3e591b9aafa` | yes |
| `Sakurada_Fumiriya_webp.vrm` | 5,403,476 | `5182eda38f684baa` | yes |
| `Sendagaya_Shibu_webp.vrm` | 5,201,904 | `1eebe4c7048ff6cd` | yes |
| `Sendagaya_Shino_webp.vrm` | 5,078,880 | `60ea278921431bd3` | yes |
| `Victoria_Rubin_webp.vrm` | 4,805,272 | `f746f4d47253be62` | yes |
| `Vita_webp.vrm` | 4,750,248 | `0b81817448e2ebf2` | yes |
| `Vivi_webp.vrm` | 4,746,492 | `de7f379838c6a241` | yes |

| body | licence | allowed user | commercial use | exporter |
|---|---|---|---|---|
| AvatarSample_A | Other | Everyone | Allow | VRoidStudio-0.14.0 |
| AvatarSample_C | Other | Everyone | Allow | VRoidStudio-0.14.0 |
| Darkness_Shibu | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |
| HairSample_Female | **CC0** | Everyone | Allow | VRoidStudio-0.11.2 |
| HairSample_Male | **CC0** | Everyone | Allow | VRoidStudio-0.11.2 |
| Sakurada_Fumiriya | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |
| Sendagaya_Shibu | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |
| Sendagaya_Shino | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |
| Victoria_Rubin | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |
| Vita | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |
| Vivi | **CC0** | Everyone | Allow | VRoidStudio-0.8.1 |

Nine are CC0, which permits redistribution and modification outright, so it
covers everything this repo does with them. Their metadata was re-read from the
committed files: `licenseName` CC0 and `allowedUserName` Everyone on every one.

The other two, `AvatarSample_A` and `AvatarSample_C`, carry `licenseName: Other`
with `allowedUserName: Everyone` and `commercialUssageName: Allow`, the same
three values `AvatarSample_B_webp.vrm` carries. That body this site has served to
visitors since before any of this, and all three are exports of the same pixiv
VRoid sample project by the same author from the same exporter generation
(VRoidStudio-0.14.0). `Other` with no `otherLicenseUrl` names no terms of its
own, so what covers these two is the same thing that covers the B this site
already serves, and it is recorded here as an inference rather than a reading.

## What each one cost to bring in

Three things had to be true per body, and only the third took judgement.

**The rig had to hash to something new.** It does, for all eleven: no two of the
fourteen bodies measured here share a `rigSha`. VRoid bakes body proportions
into rest transforms, so two exports of different characters differ even at the
same bone count.

**The two generated halves had to agree.** `measure-motions.ts` and
`springsim.ts` each write one, and both record `restCrownY` and `rigSha`
independently. All eleven agree on both to the digit. (The one family where they
differ is `vroid-sample-b`, by 6.3mm, because its two halves are measured on two
different bodies of one rig — `AvatarSample_B` and `mika-milfy-12` — which is
recorded behaviour rather than drift.)

**The fringe could not be measured.** It is the gap between the topmost drawn
pixel and the topmost vertex, and reading it means rendering the body and
looking at it. Nothing renders these. All eleven carry the VRoid family's 1.5mm
with the same note `twist` carries, and each says to strip it before the body is
ever offered.

Pans and waivers were not decided, they were derived. `scripts/derive-pans.ts`
re-runs the derivation against a re-simulated body until a pass changes nothing, and
every waiver below is the number `rigProbe.test.ts` itself reported, rounded one
step in the direction that keeps the guard meaningful. Receipts:
`scripts/avatar/evidence/vroid-samples-0911.log`.

## What the eleven found

Four rules held on the three bodies they were written against and did not hold
on some of these. All four are fixed at the rule. None of the fixes weakens a
guard, and the eight families registered before them pass all four unchanged,
which is why none of their numbers had to be re-derived. `vroid-sample-b`, the
one the site serves, did not move a millimetre.

### 1. The pan guard asked for a fixed point that need not exist

`springsim` projects each clip's crown through the frame's camera with the
family's declared pan already applied (`springsim.ts`, `clipCams`, built at
`lookAtY + pan(f)`). So `crownScreen` -- and therefore `panRange`'s `least` --
is a reading taken UNDER the very pan it is used to justify. `least` is a
function of the pan.

What that is NOT: a units error. The first diagnosis written here said the two
sides of `least = crownWorst(...) - ceiling` were in different frames of
reference, and proposed recording the crown unpanned and adding the pan back
arithmetically. Both halves of that are wrong, and both were measured
(`scripts/avatar/evidence/pan-shift-0911.md`):

* The pan is an exact translation of the whole camera rig, so
  `screen_p(P) === screen_0(P - p·ŷ) + p` to 4.4e-16 over 36 samples. It is
  therefore not an arithmetic offset on a recorded HEIGHT -- recovering the
  panned reading needs the crown's world position re-projected, not its
  unpanned height plus a constant.
* `avatarViewSpan` returns `lookAtY + half` with the unpanned `lookAtY`, and
  `screen` returns absolute subject-plane height, so under pan `p` the top edge
  sits at `view.top + p`. "The crown is inside" is exactly
  `screen_p(crown) - view.top <= p`, which is `least <= p`. The subtraction is
  dimensionally correct as written.

The defect is narrower. The requirement is `least(pan) <= pan`;
`rigProbe.test.ts` asserted `pan === ceil(least(pan))`, a fixed point of that
composition. The function is decreasing -- measured at -0.015 to -0.079 per unit
for a single crown point, and -0.34 once `crownWorst` takes its max across a
clip's placements -- so `p - least(p)` is strictly increasing and the smallest
grid point that fits is unique and well defined. The fixed point is not: on the
centimetre grid three of the fourteen families have none. `vroid-sample-c`,
clip `spin`, frame `column`:

```
pan 0.26  ->  least 0.26230  ->  ceil  ->  0.27
pan 0.27  ->  least 0.25890  ->  ceil  ->  0.26
```

At pan 0.27 the crown needs 258.9mm of lift and is given 270mm. It fits. The
equality was never the requirement. `vroid-darkness-shibu` did the same at
0.10/0.09 (later 0.01/0.00 once its waivers moved the ceiling) and
`vroid-sendagaya-shino` at 0.18/0.17.

**The fix** is `clearance.panHolds`, which asks whether a declared pan is
justified rather than whether it equals a re-derivation: `least <= pan <= most`,
and within one centimetre of the policy's point. The second condition is what
keeps it a guard -- without it any pan tall enough to clear the hair would pass,
including ones that spend a quarter of her legs. A family that does have a fixed
point satisfies both by construction, which is why nothing already registered
moved. `panFor` stays as the proposer for `scripts/derive-pans.ts`; the runtime
never calls either, because it reads the `pans` the decisions module declares.

The same relaxation removed the second symptom: `panFor` used to ask for pans
that `rigProbe.test.ts`'s "declares no pan it does not need" -- which judges
against the UNPANNED frame -- said were unnecessary, on `vroid-sample-a` and
`vroid-vita` for `dance` in `waistUp`.

### 2. `handTop` and `reach` waivers could not describe one frame

A waiver is declared per CLIP. `crownTop` is validated across all the placements
a clip declares, against a max taken after the loop; `handTop` and `reach` were
validated INSIDE the placement loop, so each had to be needed in every frame the
clip declares or the guard failed for declaring one that was not needed.

No clip on the first three families exceeds an edge in one frame and not the
other, so this never bit. `vroid-sakurada-fumiriya` and `vroid-sendagaya-shino`
do:

```
dance        declares a handTop waiver it does not need in waistUp:
             hand 1.8732 against that frame's top 2.0022
scratchHead  declares a handTop waiver it does not need in waistUp:
             hand 1.6727 against that frame's top 1.8722
```

Both clips need the waiver in `column` and could not have it, so the `column`
failure could not be waived at all.

**The fix** is to make those two checks the shape `crownTop`'s already had:
accumulate the worst overshoot across the clip's placements and ask once, after
the loop, that the waiver was needed somewhere. Enforcement stays per placement
and the budget still binds in every frame, so nothing is loosened; what changes
is that a clip which leaves one frame and not the other can now say so.

### 3. A range boundary was read past the precision it was written at

`measure-motions.ts` rounds what it records to four decimal places
(`round(w.hipsLow, 4)`), so any range boundary derived from one carries half of
that last digit. `vroid-sample-a` has a `dance` whose lowest hips sit on the
waist-up frame's bottom edge: the edge is 0.767816 and four places is 0.7678,
sixteen micrometres below it, so `most` came out at -0.00002.

Read exactly, that says zero does not fit. The range then centred, and the
waist-up frame asked for a **100mm downward camera move** on a clip that
`rigProbe.test.ts` measures as comfortably inside the frame, which is how the
two guards came to contradict each other on this body.

**The fix** is `clearance.RECORDED`, half the last digit the producers write,
used wherever a pan is compared against a range boundary. It is four orders of
magnitude below the centimetre these pans are dialled in, so no pan anyone
could see turns on it.

### 4. A clip the family cannot wear still had to fit

`excluded` is where a family writes down that a clip is not for this body, and
`motionsFor` drops it. The guards that ask whether a clip fits its frames did
not consult it, so an excluded clip still had to produce a pan that brought it
into every frame it declares.

`vroid-sakurada-fumiriya` stands 1.9216m at the crown. Her `dance` needs 231mm
of lift to bring its hair inside the waist-up frame and has 215mm before her
hips leave the bottom. No pan exists, and the file already said so. What the
guard's insistence bought was the earlier pass rubber-stamping a `crownTop`
waiver 503mm above the column's top edge -- on a body nobody has ever rendered,
which is to say an owner's acceptance that no owner gave.

**The fix** is that the two fit guards skip a clip the family excludes. It is
not an escape hatch: `offers every idle clip somewhere` asserts both directions,
so a clip excluded to dodge a guard would leave the rotation, where it would be
seen. Of the fourteen families only this one excludes a clip that is in
`AVATAR_MOTIONS` at all -- `vroid-sample-b`'s three exclusions name clips that
were dropped from the pack entirely.

The general lesson, which is the one worth carrying: **a `crownTop` waiver on a
body nobody has looked at is not a decision.** Where a pan brings the clip in,
pan it -- `vroid-sendagaya-shino`'s dance took a 180mm column pan and needs no
waiver at all. Where no pan does, `excluded` is the honest answer.

## Two bodies that were never candidates

`fem_vroid_webp.vrm` and `masc_vroid_webp.vrm` were fetched with the others and
are not registered. They declare 0 and 1 spring bones respectively, so they have
no hair that moves, and `springsim` cannot produce a clearance file for a body
with nothing to simulate. That is the file being honest rather than the
simulator failing: a crown that never moves has no clip-by-clip throw to
measure. Registering them would need a different producer, and nothing needs
them.

## Adding the twelfth

Each of these cost about a minute. For a new family: fetch the body into
`public/avatar/`, run `measure-motions.ts --write` and `springsim.ts
--clearance` with `--family=<id>` (never without it, see the `clearance regen
needs --family` note), write the decisions module, add the id to
`AvatarFamilyId`, `AVATAR_FAMILIES`, `AvatarVariantId` and `AVATAR_VARIANTS`
with `offered: false`, then run `scripts/derive-pans.ts` and re-simulate until
a pass changes nothing.

Two things that loop will not decide for you, and both are decisions rather
than measurements:

* **`crownFringe`.** Nothing renders these bodies, so it can only be carried
  from `vroid-sample-b`. It enters `least` linearly, so a body whose crown
  lands within 1.5mm of a frame edge has its whole pan resting on a number
  measured on somebody else. `vroid-vita`'s dance is 0.9mm past the waist-up
  edge, which is to say it is inside the frame and the borrowed fringe is what
  puts it out.
* **A `crownTop` waiver.** It is the owner having looked at the clip going past
  the top edge and accepted it, and on a body nobody has rendered there is no
  owner to do that. Setting one to whatever the crown measured is how the
  earlier pass ended up admitting 503mm of overflow on
  `vroid-sakurada-fumiriya`. If a pan brings the clip in, pan it; if no pan
  does, the honest answer is `excluded`, which is what that family's `dance`
  now carries for the waist-up frame.
