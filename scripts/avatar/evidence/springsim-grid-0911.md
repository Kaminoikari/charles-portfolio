# The simulator's own comment named the wrong cost, by a factor of forty

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

Skinning is 2.1%. The comment is not slightly off; it names the second-cheapest
stage of four as the cost. It is corrected in this commit.

Two attempts before that one are worth recording so nobody repeats them.
`--cpu-prof` produced nothing, because the profile is only written when the
process exits and a single clip takes 44 minutes. The first instrumented copy
exited 0 with no output at all, because it was named `springsim.prof.tmp.ts`
and the file's entry guard is `if (/springsim\.ts$/.test(process.argv[1]))`, so
`main()` never ran. That is the same silent-skip shape as
`project_test_entry_guard_silently_skips`.

## 2. Why the query was slow, in counts rather than adjectives

Counters on the same clip, per measured frame:

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

**One cell per REACH is 5cm, and a head is not 5cm.** The face mesh put 20,560
vertices into 48 cells, 428 to a cell and 1,530 at the 90th percentile, so a
query near her face compared itself against thousands of candidates to find one
nearest. Averaged over the frame that is 1,271 candidates per query and **1.5
billion distance computations per frame**.

Finer cells alone would have replaced 27 hash lookups with 729. The map alone
would have kept the 1,271 candidates. They had to go together.

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
axis are rejected before any vertex is read, which is most of the 27% that
saturate.

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

Not close: equal, on all 2,366,962. The timing is from the same harness, so
both sides carry the same `performance.now()` overhead.

**A brute-force oracle, committed.** `springsim.grid.test.ts` marks `Grid`
against a scan of every kept vertex on the shipped body's own Face and Body_Skin
geometry, plus adversarial cases: points outside the bounding box by less than
REACH, points on cell boundaries, a set with nothing kept, a single vertex, and
sparse geometry that leaves most of its box empty. The oracle shares no
indexing, no cells and no early exit with the thing it marks. Eight tests, and
each real-geometry test asserts that a majority of its queries found something,
so it cannot pass on 3,000 saturated answers.

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

`npm run build` exit 0.

## 5. A side effect worth naming

Every springsim run recorded in `pitch-0910.md` exited 1 on unhandled
`[vitest-worker]: Timeout calling "onTaskUpdate"` reporter errors, over runs
where every test passed. That was diagnosed there as a property of this machine,
and the diagnosis was right as far as it went: a worker blocked solid for two
minutes starves the reporter. None of the three runs above produced one. The
cause was the same 97.7%.
