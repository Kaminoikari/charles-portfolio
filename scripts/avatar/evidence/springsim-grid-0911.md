# The simulator's own comment named the wrong cost, by a factor of forty-six

2026-09-11. Thirteen new bodies need measuring, and at the rate the simulator
was running that was over 100 hours of wall clock. This is where the time
actually went, what was changed, and what proves the change did not move a
single millimetre of the answer.

## 1. The comment, and what it cost to believe

`springsim.ts`'s frame loop carried this:

```ts
// penetration, every other frame (skinning is the cost)
if (frame % 2 !== 0) continue
```

Believing it, I went looking at `skinAll()`, which does transform every vertex
of every set including normals that only `keep` needs. An instrumented copy of
the file, timing each stage of the frame loop with `performance.now()`, says
otherwise. AvatarSample_C, clip `akimbo`, 411 measured frames, 1,738.0s
accounted for:

| stage | seconds | share |
|---|---|---|
| `skinAll()` | 36.7 | 2.1% |
| `topOf()` | 0.7 | 0.0% |
| building the three grids | 2.7 | 0.2% |
| `Grid.signed()` | 1697.9 | **97.7%** |

Skinning is 2.1%, and the query outweighs it 46 to 1 (1697.9 / 36.7 = 46.3).
The comment is not slightly off; of the four stages, skinning is the second most
expensive and the query is nine hundred times the other three put together. It
is corrected in this commit.

Every figure in this document is reproduced with its raw output in
`springsim-grid-0911.log`, alongside the arithmetic that connects the derived
ones to the measured ones.

Two attempts before that one are worth recording so nobody repeats them.
`--cpu-prof` produced nothing, because the profile is only written when the
process exits and a single clip takes 44 minutes. The first instrumented copy
exited 0 with no output at all, because it was named `springsim.prof.tmp.ts`
and the file's entry guard is `if (/springsim\.ts$/.test(process.argv[1] ?? ''))`, so
`main()` never ran. That is the same silent-skip shape as
`project_test_entry_guard_silently_skips`.

## 2. Why the query was slow, in counts rather than adjectives

Counters on the same clip, per MEASURED frame. Penetration runs on every second
frame, so a measured frame is two simulated ones and these are not per-frame
numbers:

```
SETS  hair keep 417897  body keep 64456  face keep 20560  legs keep 26936
GRID body 1182 cells, 64456 verts, mean 54.5, max 2660, p90 105
GRID face   48 cells, 20560 verts, mean 428.3, max 1820, p90 1530
QUERY per measured frame: calls 1183481  mapGets 31953987  nonEmpty 9415692 (29.5%)
      vertsScanned 1504276479  vertsPerCall 1271.1  returnedREACH 27.0%
```

Two separate faults, and fixing either one alone would have made things worse.

**The cells were a `Map<number, number[]>` keyed by a packed integer.** Every
query paid 27 hash lookups whether or not the cells held anything, and 70.5% of
them landed on nothing: 31.9 million map reads per frame to reach 9.4 million
useful ones.

`calls` is not `hair keep` times two. The hair is asked against the body grid
and the face grid, and the skirt is asked against a third, the leg grid; the
three together make the count.

**One cell per REACH is 5cm, and a head is not 5cm.** The face mesh put 20,560
vertices into 48 cells, 428 to a cell and 1,530 at the 90th percentile, so a
query near her face compared itself against thousands of candidates to find one
nearest. Averaged over the frame that is 1,271 candidates per query and **1.5
billion distance computations per frame**.

Finer cells alone would have replaced 27 hash lookups with 729, which is why
they are not a fix on their own. The other order is not symmetrical and the
commit message overstated it: a flat array keyed the same way, still one cell per
REACH, would have removed the hashing and kept the 1,271 candidates, so it would
have been better rather than worse. What is true is that the finer cells only pay
once a lookup is an array index.

## 3. What it is now

Cells a quarter of REACH across, in one flat pair of `Int32Array`s (CSR: a
`start` index into an `items` run) laid over the set's own bounding box, so a
lookup is an array index and an empty cell costs one subtraction. The scan then
walks Chebyshev shells outward from the query's own cell and stops as soon as
the next shell cannot hold anything nearer.

The stopping rule is exact, not a heuristic. The query sits SOMEWHERE inside its
own cell, so a cell m shells away is at least (m-1) cells from it; after
finishing shell k nothing unscanned can be closer than k cells, and a `best`
already inside that radius is final. Points far enough outside the box on any
axis are rejected before any vertex is read. 27.0% of queries end at REACH one
way or another; nothing here counts how many of those took the cheap path rather
than scanning first, so no claim is made about the split.

One more thing changed name. `CELL` was two things at once, the grid's
resolution and the radius the query had to cover, tied together by
`r = ceil(REACH / CELL)`. They are now `FINE` and `REACH`: the answer depends on
`REACH` alone, and `FINE` only decides how many candidates get rejected on the
way to it.

## 4. That the answer did not move

This is the part that mattered. Every millimetre budget in every committed
clearance file was measured through the old implementation, and a query that
quietly returns the second-nearest vertex still returns a plausible distance.

**Both implementations, side by side, on a real clip.** The old class was kept
as `GridSlow`, the new one built beside it, and a wrapper ran both on every
query the simulation issued and compared the returned doubles:

```
AB over 2366962 queries: mismatches 0  worst |delta| 0
TIME old 10.2s   new 2.0s   speedup 5.2x
```

Not close: equal, on all 2,366,962. 2,366,962 is exactly 1,183,481 x 2, so this
is an exhaustive comparison over the first TWO measured frames of 411, about
0.5% of the clip, rather than a sample spread across it. The timing is from the
same harness, so both sides carry the same `performance.now()` overhead; 5.2 is
the ratio of the unrounded totals, and the two printed figures are rounded to
one decimal.

Ties are the one input where the two could legitimately disagree, since they
scan in different orders and `d < best` keeps whichever was seen first. A review
built the case: two vertices equidistant from a query with opposing normals
return +d or -d depending only on the walk order. It has never been observed on
real geometry, so `Grid` now settles ties on the lower vertex index, which is
what a scan in index order keeps, and `springsim.grid.test.ts` pins both
orderings of that pair.

**A brute-force oracle, committed.** `springsim.grid.test.ts` marks `Grid`
against a scan of every kept vertex on the shipped body's own Face and Body_Skin
geometry, plus adversarial cases: points outside the bounding box by less than
REACH, points on cell boundaries, a set with nothing kept, a single vertex, and
sparse geometry that leaves most of its box empty. The oracle shares no
indexing, no cells and no early exit with the thing it marks. Ten tests. Each data-driven test asserts a floor on how many of its queries
found something rather than saturating, so none can pass on a run where the
answer was REACH every time: 1,500 of 3,000 on the two real-geometry tests, 200
of 400 on the boundary test, 200 of 2,000 on the sparse one, and 100 of 600 on
the outside-the-box test, which is deliberately lower because most of those
points genuinely have nothing within REACH.

Eleven mutations, eleven red, each named with the tests it broke in
`mutations-grid-0911.log`. One draft mutation stayed green and is written up
there rather than dropped: it was provably equivalent (`start[1] += start[0]`
where `start[0]` is always 0), and it was replaced by two that are not.

**The three existing suites, unchanged, still pass.** They run real clips and
assert on real millimetre numbers, so they are the end-to-end receipt:

| suite | tests | before (`pitch-0910.md`) | now |
|---|---|---|---|
| `springsim.test.ts` | 6 | 124.40s | 34.10s |
| `springsim.rigid.test.ts` | 5 | 116.59s | 17.62s |
| `springsim.derive.test.ts` | 6 | 68.19s | 27.20s |

`npm run build` exits 0, but it is NOT a type gate for this change. Its three
referenced configs include `src`, `api`+`rag`, and `vite.config.ts`, and nothing
under `src` imports anything under `scripts`, so `tsc -b` never reads
`springsim.ts`. This repo already has a memory for the shape of that trap
(`tsc_solution_config_checks_nothing`) and this is a second instance of it.
`scripts/` is type-checked here by pointing tsc at it explicitly with
`tsconfig.app.json`'s own options, strict included: 0 errors.

## 5. Which run each number came from

Three different runs are quoted above and they do not all measure the same span,
so the arithmetic between them does not close, and it should not be made to.

The stage profile accounts for 1,738.0s over 411 measured frames, which is 29
minutes. The 44 minutes is a different observation: the sequential queue ran
`vroid-sample-a` for 90 minutes and finished 1 of its 10 clips. So "44 minutes"
is a whole clip on a loaded machine, and "1,738.0s" is the four instrumented
stages of one clip on a quieter one. The 97.7% is a share of the instrumented
total, not of the 44 minutes, and no claim here needs it to be both.

The set sizes and query counters in section 2 were taken BEFORE `gather` was
fixed to stop stacking a shared vertex buffer once per primitive, which is the
subject of `springshare-0911.md`. That is why they are so large: the 417,897
hair vertices are one 7,083-vertex buffer read once per primitive, 118 times,
and halved by the stride. The part draws 2,310 distinct vertices. They are
left as measured, because they are the problem this rewrite was answering, and
the rewrite stands on its own — the A/B ran on those same sets, and it is the
same 5.2x whatever is in them. The end-to-end figure that includes both fixes is
the 2.81s in section 4.

## 6. A side effect worth naming

Every springsim run recorded in `pitch-0910.md` exited 1 on unhandled
`[vitest-worker]: Timeout calling "onTaskUpdate"` reporter errors, over runs
where every test passed, and the suite had to be taken in four separate runs
because of it. After this change the whole suite runs in one: 32 files, 674
tests, 105.69s, exit 0, no reporter error.

That is an observation and not a diagnosis, and an earlier draft of this
paragraph overstated it into one. `pitch-0910.md` records the same error on
`base-b.log`, a 28-file run that contained no springsim file at all, so a
springsim worker blocked for two minutes cannot be the whole cause. What can be
said is that the runs that used to produce it no longer do.
