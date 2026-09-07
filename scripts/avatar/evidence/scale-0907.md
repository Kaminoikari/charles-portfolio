# The size dimension: a synthetic scaled body, and the waist it found

2026-09-07. Closes the one requirement the real second body could not meet.

## Why there is a synthetic body at all

The plan's fixture list asks for a second body at least 10% away in height, and
says why: a constant that is secretly a length in metres cannot be told apart
from a derived landmark while every body it meets is the same size. Seed-san,
the real second body, came out **1.5801 against our 1.5815 — 0.1% apart**
(`docs/plans/avatar-fixture-seed-san.md`), so it closed the shape dimension and
left the size one open. The plan recorded that gap rather than waiving it:
「尺度相關的絕對常數不會被它逼出來，那個維度留給合成縮放身體」.

`scalebody.py` is that body. It applies a similarity transform about the origin
— every node translation, every vertex, every morph delta, every inverse bind
matrix's translation column, and the spring bones' own lengths — so the result
is the same body, the same topology, the same skinning, at a size the pipeline
has never seen. On `mika-pink.vrm` at 1.25x it moved 260 things and the mesh
came out 1.9769 tall against 1.5815, a ratio of 1.250000.

What it deliberately does not scale is written into its module docstring:
`stiffiness` and `dragForce` are dimensionless, but `gravityPower` is not, and
how to scale it depends on how three-vrm integrates it. The fixture is therefore
honest for geometry and landmarks, which is what it was built for, and its hair
hangs differently from a real body of that size.

## What it found, first run

`evidence/scale-0907-probe.py` runs every landmark derivation through its real
entry point on the base body and on 0.8x and 1.25x copies. A derivation that
describes the body must return exactly k times its base value.

Eight of seventeen did. The failure was not a rounding difference:

```
landmarks.waist    base 0.960000   x0.8 -> 1.020000   x1.25 -> 1.020000
```

**The same 1.020 on both.** That is the signature of an answer that came from a
constant rather than from a body. `build.landmarks` searched for the waist in
`np.arange(0.88, 1.16, 0.01)` with a 12mm slab — a band in metres, read once off
this VRoid body. On a body a fifth shorter the real waist is at 0.768, below the
bottom of that band, so the search returned the narrowest slice that happened to
fall inside a band the body had outgrown: a height on the chest. It did not
fail, warn, or return nothing. And because `torso_edges` is measured from the
waist, all three garment edges inherited the wrong answer.

## The fix, and why it moves nothing on the shipped body

The band is now four fractions of the body's own hips-to-shoulder span
(`build.WAIST_SEARCH`), chosen so this body's sample grid is the grid it already
had. `evidence/scale-0907-drift.log`:

```
waist   was 0.960000000   now 0.959999986   delta -0.014 µm
  bandeau_top    1.180925728 -> 1.180925726  -0.002 µm
  torso   was   651  now   651  vertices differing: 0
  strap   was  2333  now  2333  vertices differing: 0
  sleeve  was  2640  now  2640  vertices differing: 0
```

Every vertex falls on the same side of every cut. **No rebuild was run**, so
this is a measurement of the cuts, not a vertex sha of a rebuilt body; the
deltas are at or below float32's resolution at these magnitudes, but that is a
prediction and not a receipt.

After the fix all thirteen landmark values follow the body exactly (ratio
1.000000 at both 0.8x and 1.25x) — `evidence/scale-0907.log`.

## Guards

`evidence/mutations-0907-scale.md`, W1–W8, all RED. Two came back GREEN first
and both were fixture weaknesses rather than threshold problems, which is the
same trap this batch has hit throughout:

- **W5** (start the search halfway up the torso) passed because the synthetic
  body's narrowest ring sat at the midpoint of the hips-to-shoulder span, the
  one height a band truncated from either end still contains. The fixture's
  waist now sits a quarter of the way up, where a real one is.
- **W8** mutated the test's own tolerance to be looser, which cannot make a test
  fail. It was replaced by the mutation the test actually exists to catch: read
  the waist off the skeleton instead of the mesh.

Suites: 240 python tests, 427 vitest across 27 files, both green
(`scale-0907-pytests.log`, `scale-0907-vitest.log`).

## Still carrying a length — reported, not fixed

The probe leaves four rows flagged, all one thing: `envelope.heights` is the leg
sweep's sampling grid, and `ABOVE_HIP = 0.05`, `STEP = 0.01` and the `round(knee,
2)` anchor are all metric. On a 0.8x body the sweep's top lands at ratio 1.019
and its step covers a different share of the leg.

That is left alone on purpose. It is a **sampling grid for a scan**, not a
landmark: it changes how finely the leg envelope is measured, not where anything
is. A landmark that is wrong reports a chest height as a waist; a grid that is
wrong reports the same envelope at another resolution.

Out of scope, found while measuring, listed so it is not lost: `build()`'s
outfit construction still holds `lm['waist'] - 0.055`, `abs(p[:, 0]) < 0.105`
and `shoulder_top + 0.02`. These are offsets of the hand-modelled Milfy outfit,
which the plan puts outside generalisation (「內容層本來就不在範圍內」).
