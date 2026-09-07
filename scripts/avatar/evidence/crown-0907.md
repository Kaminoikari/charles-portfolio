# The crown belongs to the body, not to the family

2026-09-07. Closes a gap the family work left behind: clearance is measured per
rig family, but one of the things it carries is not a property of the rig.

## What a family shares, and what it does not

`vroid-sample-b` covers three bodies: the shipped `mika-milfy-12.vrm`, the
alternate look `mika-pink.vrm`, and the upstream `AvatarSample_B_webp.vrm`. They
share a rig, which is what `rigSha` pins, so the camera framings, the leg
envelope and the body-depth measurements are all one measurement for all three.

The crown is not like that. It is the top of the hair, and the hair is geometry
the body owns. Only `mika-milfy-12` had ever been simulated — `springsim` refused
a body with no `.parts.json` until `deriveManifest` — so the other two got their
crown by transfer:

```
crownOn = c.crownScreen[frame] - file.restCrownY + restCrownY + file.crownFringe
```

which slides the simulated body's screen-space crown by the difference in rest
height. That is a rigid shift of one body's hair onto another's, and there is no
reason for it to be right.

## The two VRoid bodies are one simulation

Before simulating anything, the cheap question: are the two unsimulated bodies
actually different meshes? `evidence/crown-0907-geomhash.ts` hashes every
attribute of every primitive, textures excluded:

```
avatar/mika-pink.vrm               b5f5a9c87fd2fca7
avatar/AvatarSample_B_webp.vrm     b5f5a9c87fd2fca7
avatar/mika-milfy-12.vrm           c849ab91c4ec5384
```

Identical. `mika-pink.vrm` is the VRoid sample with our textures over it, and the
geometry was never touched. So the family needs **one** more simulation, not two,
and a test now pins that (`clearance.test.ts`, `is one simulation because the two
VRoid bodies are one geometry`) so a future body swap cannot silently make the
single run cover only one of them.

## What the transfer got wrong

`evidence/crown-0907-sim-pink.log` is pink's own ten clips, and it disagrees with
the transfer **in both directions**. The numbers below are the transfer as the
guard computes it, on the VRoid body's own resting crown (1.5820) and not on the
simulated Milfy body's (1.5757) — the two differ by 6.3mm, and reading the file's
own `restCrownY` back into `crownOn` cancels the transfer entirely, which is a
mistake this write-up made once:

- `idleLoop` through the column camera: the transfer says 1.6043, pink's own hair
  reaches 1.5649. The transfer over-reads by **39.4mm**.
- `playFingers` waist-up: the transfer says 1.5913, pink reaches 1.6220. The
  transfer under-reads by **30.7mm**.

An over-read costs framing; an under-read is the one that matters, because the
guard that is supposed to catch hair leaving the frame was checking a height the
body never reaches.

Note what pink's log says about its own parts: with no `.parts.json` the manifest
is derived, and only one hair part comes out spring-driven, so the coat and skirt
columns print `—`. The crown does not depend on that split — it is the topmost
vertex of any part — which is why this run is usable for the crown and not for
the garment columns.

## The wiring

`ClearanceFile` gains `alsoSimulated: readonly ClearanceSimulated[]`, passed as
`combineClearance`'s fourth argument, validated for `rigSha` and for covering
every clip. `crownBound` then hands out the worst of the three sources:

```ts
export function crownBound(file, clip, frame, restCrownY): number {
  const own = file.alsoSimulated.map((s) => s.clips[clip].crownScreen[frame] + file.crownFringe)
  return Math.max(crownOn(file, clip, frame, restCrownY),
                  file.crownSeen[clip]?.[frame] ?? -Infinity, ...own)
}
```

This is a guard-side number. `crownBound` is read by `rigProbe.test.ts`, by
`panFor`, and by `measure-motions.ts`'s report; nothing in the runtime render
path calls it. So the finding is "a guard
had never been run against this body", not "the site was cropping hair".

`combineClearance` also refuses a second body whose `framings` differ from the
primary's. That is not decoration: `crownScreen` is a projection taken WITH the
clip's pan applied, and this change proves it — the pans moved a centimetre and
every affected `crownScreen` moved with them. The guard that holds the primary
simulation to today's composition (`rigProbe.test.ts`, `was simulated under the
composition the engine uses today`) reads `ClearanceFile.framings`, which
`combineClearance` fills from the primary alone, so without this check a second
body simulated under an older framing, lens or pan would have fed stale
projections into `crownBound` with nothing looking at it.

## The second bug, found while reading the first

`panRange` applied a clip's `crownTop` waiver as a **replacement** for the
frame's top edge:

```ts
const ceiling = c.waiver?.crownTop ?? view.top      // before
const ceiling = Math.max(view.top, c.waiver?.crownTop ?? -Infinity)   // after
```

A waiver is the owner having watched a clip go past the top edge and accepted it.
It can only ever RAISE the ceiling. Every waiver in this file was decided while
looking at the column framing, whose edge is 1.6020; the same clip's waist-up
edge is 1.8722, so applying the waiver there lowered the ceiling by **266mm**.

**Three copies of that read existed**, and the sweep for the other two is why
this section is here at all: `rigProbe.test.ts`'s crown guard, and
`measure-motions.ts`'s report row. All three now take the max.

The bug had no effect on shipped output, because no waived clip's waist-up crown
was between the waiver and the real edge. Two of the three copies are pinned on a
body constructed to sit in that band:

- `clearance.ts` — a synthetic clearance file (`clearance.test.ts`, `lets a
  waiver raise a frame edge and never lower one`). Shipped data cannot show it,
  because two of the five waivers were replaced by pans in this same change.
- `measure-motions.ts` — the shipped body scaled 1.15× (`measure-motions.test.ts`,
  `lets a waiver raise the top edge it reports against, never lower it`). At that
  factor `spin`'s waist-up crown is 1.84, above its 1.6200 waiver and below the
  1.8722 edge. The existing 1.35× body is no use: its crown clears both, so the
  row is a violation either way.

The third has no mutation row and cannot have one: it IS a test assertion
(`rigProbe.test.ts`, the crown line of `%s stays inside every frame it
declares`). A mutation harness reddens production code by watching a test fail;
there is no test watching this test. What it has instead is the same one-line
shape as the other two and a comment pointing here.

## The pans that replaced two waivers

Once `playFingers` and `scratchHead` carry pink's crown, both sit above the
column camera's top edge. Two routes were available: widen their waivers
(`playFingers` 1.606 → 1.6138, `scratchHead` 1.607 → 1.6139, so 7.8mm and 6.9mm)
or pan the camera. The pan wins, because a pan
is derived from the measurements — `panFor` computes it — while a waiver is an
aesthetic acceptance that only the owner can give, and neither of these two was
ever accepted at the new height. Both waivers are gone and both clips declare
`pan: { column: 0.02 }`. `dance` moved with the raised crown too: `waistUp`
−0.08 → −0.07, `column` 0.13 → 0.14.

### It is a loop, and it converges

`crownScreen` is projected with the clip's pan already applied, so changing a pan
invalidates the simulation that suggested it. Re-simulating after the pan change
(`crown-0907-sim-pink-prepan.log` against `crown-0907-sim-pink.log`) moved every
affected crown by at most 2.2mm, and not all in the same direction:

```
dance        column 1.7394 -> 1.7374 (-2.0mm)   waistUp 1.7251 -> 1.7229 (-2.2mm)
playFingers  column 1.6123 -> 1.6128 (+0.5mm)   waistUp unchanged
scratchHead  column 1.6124 -> 1.6127 (+0.3mm)   waistUp unchanged
```

So it is not a clean negative feedback — a 1cm rise costs the dance 2mm of crown
and buys the other two a few tenths — but it is far too small to move a pan that
is rounded to the centimetre, and the second pass changed none of them. That is
the convergence claim, and it is empirical rather than argued.
`evidence/crown-0907-headroom.log` is the final state with the regenerated
numbers in place; every clip and framing has positive headroom, the tightest
being `spin/column` at 0.3mm, `idleLoop/column` at 0.7mm and `squat/column` at
0.8mm, each against its own waiver.

### A pan is not applied the moment the clip starts

`stepFramePan` eases the camera onto its target, and every crown guard here
compares against the SETTLED edge. That was harmless while `dance` was the only
panning clip — its crown peaks at 11.97s, with the camera parked long before.
The two new pans are not like that: pink's `scratchHead` throws its crown at
**t=1.10s**, by which point 83% of the 2cm has arrived. It still clears, by
4.4mm rather than the 7.8mm the settled guard derives, so nothing is cut; but
nothing was checking it either. `clearance.test.ts`'s `has the pan it needs by
the time the crown gets there, not only at rest` now walks the filter at 60Hz to
each body's own `crownT` and compares there. K9 reddens it by slowing
`FRAME_PAN_SMOOTHING` tenfold, which is the shape of the failure it exists for.

## Guards

`evidence/mutations-0907-crown.md`, K1–K9, all RED. Three came back GREEN first
and all three were real weaknesses in the tests rather than thresholds:

- **K1** (drop `alsoSimulated` out of `crownBound`) passed against the clip-level
  frame check, because the new larger pan left enough room to hide the dropped
  bound. It now runs against the wiring test instead.
- **K2** (put the waiver back to replacement) had nothing left to observe on
  shipped data once the pans replaced the two waivers it used to bite. It runs
  against the new synthetic-file unit test.
- **K3** (unwire `[PINK]` from `combineClearance`) passed because the test read
  `PINK_SIMULATED` directly rather than going through `crownBound(CLEARANCE, …)`
  — the injection-bypasses-wiring trap. The test was split so one half is the
  wiring guard and the other is the frame check.

Suites: 434 vitest across 27 files, 247 python, both green
(`crown-0907-vitest.log`, `crown-0907-pytests.log`).
