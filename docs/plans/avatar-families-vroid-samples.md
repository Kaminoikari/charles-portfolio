# VRoid's own sample avatars as rig families

Eleven were fetched and measured on 2026-09-11. **Five are registered**, each
its own rig family, declared in `AVATAR_VARIANTS` and served from `/avatar/`,
and **none of them is offered to visitors**: the look strip shows only the
bodies marked `offered`.

| registered | held back |
|---|---|
| `vroid-hair-female` | `vroid-sample-a` |
| `vroid-hair-male` | `vroid-sample-c` |
| `vroid-sendagaya-shibu` | `vroid-darkness-shibu` |
| `vroid-victoria-rubin` | `vroid-sakurada-fumiriya` |
| `vroid-vivi` | `vroid-sendagaya-shino` |
| | `vroid-vita` |

Why any of them are here is what `twist` and `studio` are here for. The
per-family paths in this repo — `motionPan`, `crownBound`, `panFor`, the
per-family block of `rigProbe.test.ts`, and the `describe.each(FAMILIES)` blocks
of `avatarBow.test.ts` (one) and `avatarPitch.test.ts` (two) — were written
against one rig and generalised against three. They now run against eight. Each
of those `describe.each` blocks expands `AVATAR_FAMILIES` directly, so adding a
key to it is what widens them. A layer that only works on
the body it grew up on cannot survive that, and the point of the exercise is to
find out which parts those are.

They are not a step toward offering them. This site has one character, and the
look strip is a wardrobe rather than a cast list.

The six held back are held back because the exercise worked: they found two
rules that do not survive a body of their proportions. Both are in **What the
eleven found** below, with the measurements. Neither affects the five, which
pass all 624 guards as they stand.

## Provenance and licence

All eleven were fetched on 2026-09-11 between 01:10 and 02:08 and repacked with
`scripts/compress_vrm_webp.py` (EXT_texture_webp). The originals are kept
alongside the repacks; where a body is served it is the repack that is served,
and the repack preserves the rig exactly, which is checked rather than assumed:
each body's `rigSha` in its two generated clearance halves is the sha of the
repack's rig. Only the five registered bodies are committed and served; the
other six are recorded here because they were measured, and the table is what a
future attempt at them starts from.

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
| `AvatarSample_A_webp.vrm` | 5,054,576 | `d2549e2b00ca4b84` | held |
| `AvatarSample_C_webp.vrm` | 4,907,920 | `ff2c311a83e70974` | held |
| `Darkness_Shibu_webp.vrm` | 5,716,660 | `1bb025d3bb37e397` | held |
| `HairSample_Female_webp.vrm` | 4,662,016 | `fbdcf35383bb4278` | yes |
| `HairSample_Male_webp.vrm` | 4,440,972 | `4e26b3e591b9aafa` | yes |
| `Sakurada_Fumiriya_webp.vrm` | 5,403,476 | `5182eda38f684baa` | held |
| `Sendagaya_Shibu_webp.vrm` | 5,201,904 | `1eebe4c7048ff6cd` | yes |
| `Sendagaya_Shino_webp.vrm` | 5,078,880 | `60ea278921431bd3` | held |
| `Victoria_Rubin_webp.vrm` | 4,805,272 | `f746f4d47253be62` | yes |
| `Vita_webp.vrm` | 4,750,248 | `0b81817448e2ebf2` | held |
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
covers everything this repo does with them. The five committed bodies are all in
that nine, and their metadata was re-read from the committed files: `licenseName`
CC0 and `allowedUserName` Everyone on every one.

The other two, `AvatarSample_A` and `AvatarSample_C`, carry `licenseName: Other`
with `allowedUserName: Everyone` and `commercialUssageName: Allow`, the same
three values `AvatarSample_B_webp.vrm` carries. That body this site has served to
visitors since before any of this, and all three are exports of the same pixiv
VRoid sample project by the same author from the same exporter generation
(VRoidStudio-0.14.0). Neither A nor C is committed, so their rows above were read
from the fetched files during the session that measured them and cannot be
re-checked from this repository; they are recorded for whoever brings them
back.

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
looking at it. Nothing renders these. All five carry the VRoid family's 1.5mm
with the same note `twist` carries, and each says to strip it before the body is
ever offered.

Pans and waivers were not decided, they were derived. `scripts/derive-pans.ts`
re-runs `panFor` against a re-simulated body until a pass changes nothing, and
every waiver below is the number `rigProbe.test.ts` itself reported, rounded one
step in the direction that keeps the guard meaningful. Receipts:
`scripts/avatar/evidence/vroid-samples-0911.log`.

## What the eleven found

Two rules hold on the three bodies they were written against and do not hold on
some of these. Both are recorded here rather than worked around, because the
fix to either one changes numbers that three registered families already
depend on, including the one the site serves.

### 1. The pan derivation can fail to converge

`springsim` projects each clip's crown through the frame's camera with the
family's declared pan already applied (`springsim.ts:1240`, the camera is built
at `lookAtY + pan(f)`). `panRange` then subtracts the frame's top edge computed
WITHOUT the pan (`clearance.ts:440`, `least = crownWorst(...) - ceiling`). The
two sides of that subtraction are in different frames of reference, so raising
the pan lowers the projected crown and therefore lowers the pan the next
derivation asks for.

That feedback is known and documented: the recipe is to re-derive until a pass
changes nothing, and the first three families settle in one to four passes. On
some bodies it does not settle at all, because `least` lands on a grid line and
the two neighbouring centimetres point at each other. Measured on
`vroid-sample-c`, clip `spin`, frame `column`:

```
pan 0.26  ->  least 0.26230  ->  ceil  ->  0.27
pan 0.27  ->  least 0.25890  ->  ceil  ->  0.26
```

`vroid-darkness-shibu` does the same at 0.10/0.09 (later 0.01/0.00 once its
waivers moved the ceiling) and `vroid-sendagaya-shino` at 0.18/0.17.
`rigProbe.test.ts:603` asserts the declared pan equals what `panFor` derives, so
neither value passes, and excluding the clip does not help: the loop at
`:600-601` does not consult `excluded`.

The same double-count makes `panFor` ask for pans that a different guard says
are unnecessary. `rigProbe.test.ts:786` decides a pan is needed by checking the
UNPANNED frame, and on `vroid-sample-a` and `vroid-vita` it disagrees with
`panFor` about `dance` in `waistUp`.

The fix that removes the cause rather than the symptom is to record the crown
unpanned and apply the pan arithmetically in `panRange`. Then `panFor` is a pure
function of the body, converges in one pass by construction, and agrees with the
guards that already read unpanned. It would re-derive the pans of all fourteen
families, `vroid-sample-b` included, which is why it is written down here
instead of done.

### 2. `handTop` and `reach` waivers cannot describe one frame

A waiver is declared per CLIP. `crownTop` is validated across all the
placements a clip declares (`rigProbe.test.ts:745`, against a max), but
`handTop` and `reach` are validated inside the placement loop (`:714`, `:686`),
so those two must be needed in EVERY frame the clip declares or the guard fails
for declaring one that is not needed.

No clip on the first three families exceeds an edge in one frame and not the
other, so this never bit. `vroid-sakurada-fumiriya` and
`vroid-sendagaya-shino` do:

```
dance        declares a handTop waiver it does not need in waistUp:
             hand 1.8732 against that frame's top 2.0022
scratchHead  declares a handTop waiver it does not need in waistUp:
             hand 1.6727 against that frame's top 1.8722
```

Both clips need the waiver in `column` and cannot have it, so the `column`
failure cannot be waived at all. The fix is to make those two checks match
`crownTop`'s, or to make the waiver per frame. Either changes a guard three
registered families run under.

## Two bodies that were never candidates

`fem_vroid_webp.vrm` and `masc_vroid_webp.vrm` were fetched with the others and
are not registered. They declare 0 and 1 spring bones respectively, so they have
no hair that moves, and `springsim` cannot produce a clearance file for a body
with nothing to simulate. That is the file being honest rather than the
simulator failing: a crown that never moves has no clip-by-clip throw to
measure. Registering them would need a different producer, and nothing needs
them.

## Bringing the held six back

Their measurements exist and cost about a minute each to reproduce. For each
family: fetch the body into `public/avatar/`, run `measure-motions.ts --write`
and `springsim.ts --clearance` with `--family=<id>` (never without it, see the
`clearance regen needs --family` note), write the decisions module, add the id
to `AvatarFamilyId`, `AVATAR_FAMILIES`, `AvatarVariantId` and `AVATAR_VARIANTS`
with `offered: false`, then re-derive pans to a fixed point. That last step is
the one that does not terminate for three of them until finding 1 above is
resolved.
