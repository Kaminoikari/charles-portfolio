# The build's gate could not read a VRM 1.0 body at all

2026-09-10. `scripts/avatar/verify.py` is the gate the Milfy build has to pass
before a file ships. Every body it had ever been pointed at was a VRoid 0.x
export, and five of its checks turned out to be reading VRM 0.x's
`extensions.VRM` directly. On a 1.0 file two of them raise, one reports 45 tears
on a correct face, and two return an empty list, which is what a clean file
looks like. Only the first is loud: `loud_outlines` raised first and stopped
`report()`, so `undeclared_rims` never reached its own copy of the same index.

This is the same defect shape as the engine's facing bug fixed the same day
(`aim-0910.md`): a version-specific fact written where the version-blind code
lives. It is recorded separately because the consequence is different. The
engine posed a body wrongly and you could see it; the gate said PASS-shaped
things about files it had not looked at.

## 1. What it actually did

Pointed at a 1.0 body before this change, reproduced by running the pre-fix
reader expressions against the three 1.0 files in the tree:

| check | on a 1.0 body it | why |
|---|---|---|
| `loud_outlines` | raised `KeyError: 'VRM'` and stopped `report()` three checks in | indexed `doc['extensions']['VRM']['materialProperties']` |
| `undeclared_rims` | never ran, because the raise came first | same index |
| `torn_shapes` | reported 45 tears on a correct face (`seed-san`), 37 on `vrm1-twist-sample`, 39 on `vroid-studio-dressup` | read expressions out of `blendShapeMaster`, found none, so it skipped no mesh and measured the face's own eyelids |
| `stranded_collider_groups` | returned `[]` on files carrying 2, 12 and 22 collider groups | read `secondaryAnimation`, which 1.0 does not have |
| `misaligned_material_properties` | returned `[]`, printed `0` | 1.0 has no parallel array, so the check has nothing to mean |

The last row is the one worth naming: `[]` from a check that never ran is
indistinguishable from `[]` from a check that ran and found nothing.

## 2. Where the version now lives

Three readers in `humanoid.py`, which is where every other version difference in
this pipeline already sits:

- `mtoon(doc)` returns one entry per material in `doc['materials']` order, with
  `outlineColor`, `rimColor` and `outlineWidthMode`. 0.x reads the parallel
  `materialProperties` array positionally; 1.0 reads `VRMC_materials_mtoon` off
  the material. A material with no MToon at all gets an entry with all three
  None, so callers can zip against `doc['materials']` by index.
- `expression_meshes(doc)` returns the mesh indices any expression drives a
  morph target on. 0.x names the mesh in the bind; 1.0 names a NODE, and the
  mesh is what that node draws.
- `springs(doc)` already existed and already normalised both versions. The gate
  simply was not calling it.

`verify.py` now goes through those three and holds no `extensions.VRM` index of
its own except in `misaligned_material_properties`, which is 0.x by definition.

The 0.x readings are unchanged by this. All 34 materials on `mika-milfy-12`, all
19 on `mika-pink` and `AvatarSample_B_webp` come back through `mtoon` with the
same colours the direct index produced, which is what keeps those three rows of
the table in section 6 identical to the shipped ones.

## 3. One thing deliberately not fixed

`mtoon` reports `outlineWidthMode`, and neither colour check consults it. A
material whose outline width mode is `none` draws no second pass and so cannot
recolour anything, which makes it arguable that `loud_outlines` should skip
those. Skipping them would take the SHIPPED 0.x reading from 13 loud materials
to 5 on `mika-pink` and `AvatarSample_B_webp` alike.

That is a question about where this threshold belongs, it is identical on both
versions, and answering it while teaching the function a second file format
would change a shipped number for a reason that has nothing to do with VRM 1.0.
So it is left alone, and mutation V7 is the receipt: adding the width-mode skip
turns `test_the_width_mode_is_not_consulted_on_either_version` red.

## 4. What holds it

`verify_test.py` gained a `VersionBoundChecks` class, eight tests, run against
`fixtures/seed-san.vrm` (1.0) and `fixtures/alicia-solid.vrm` (0.x). Four of them
plant a defect into a copy of a real body rather than into a synthetic doc: a
loud outline on both versions, an outline whose width mode is off on both, a rim
colour on a quiet material, and a spare collider group. The other four read a
fixture as it is and assert what a correct file produces: `report()` completes
and prints its N/A line, a clean body strands nothing, a correct face tears
nothing, and the alignment check refuses to run on 1.0. The whole file is 14
tests and they pass.

Twelve mutations, each restored by writing back the bytes read at the top, with
`__pycache__` cleared before every run because an equal-length mutation landing
in the same second runs the previous one's bytecode. Every one is red, and every
defence added here has at least one that breaks it. Four of the new assertions
never appear as the failing line, and that is masking rather than a gap: three
of them sit behind `assertEqual(14, len(...))` in the rim test, which fails
first, and `assertIn('bones', text)` only ever goes red as part of V8's ERROR.
The table names the failing test, not the failing line; the log carries both.

| mutation | what it breaks | red tests |
|---|---|---|
| V1 | `humanoid.mtoon` takes the 0.x branch for both versions | loud outline, rim, width mode |
| V2 | 1.0 outline colour always None | loud outline, width mode |
| V3 | 1.0 rim colour always `[1,1,1]` | rim |
| V4 | 1.0 expression list always empty | torn shapes |
| V5 | spring reading back to an empty 0.x shape | stranded collider group |
| V6 | `NOT_APPLICABLE` back to `[]` | alignment says it cannot run, report runs |
| V7 | `loud_outlines` skips materials whose outline is off | width mode |
| V8 | `loud_outlines` back to the pre-fix body verbatim | report runs, loud outline, width mode |
| V9 | the stranding check stops filtering by what the springs use | clean body strands nothing, stranded group, 0.x report |
| V10 | `report()` prints the count where it printed N/A | report runs |
| V11 | 0.x outline colour always None | loud outline, width mode |
| V12 | the 0.x alignment comparison inverted | alignment says it cannot run, 0.x report |

V8 is the original defect put back word for word. A first draft of it swapped
only the two lines that index `extensions.VRM` and left the new `max(rgb)` in
place, which on a 0.x body folds alpha into the chroma and reddened an unrelated
0.x test; that reading is not in this log.

V9 is the false-positive half of the stranding check. V5 empties the spring
reading, so both the used set and the group list go empty and a clean body still
strands nothing; only dropping the filter itself can turn that test red.

The last three exist because a reviewer found assertions that nothing reached.
V10 separates the sentinel from the sentence: the CHECK knowing it cannot run is
V6's, while report() SAYING so on the page had been held only by the accident
that `_NotApplicable` has no `__getitem__`, so the `skew[:5]` below it raised.
Give the sentinel that one method and a silent `0` would have come back with
every test green. V11 and V12 break the 0.x halves that V1 through V10 never
reach, because in each of those the 1.0 half fails first and stops the test.

V2 and V11 are the one pair whose red test NAMES are identical, since the two
tests they break each run both versions and a test name cannot say which half
gave way. That is why both loops carry the version in the assertion message: the
log shows V2 failing on `seed-san 1.0` and V11 on `alicia-solid 0.x`, which is
the distinction the names cannot make.

V3 is the one that earned its test. The first version of the rim test asserted
only that the planted material dropped out and the list stayed non-empty, and V3
left it green: `seed-san` has 17 materials of which 7 carry no MToon block at
all, so a reader that hands every MToon material a rim colour still leaves those
7 in the list. The test now asserts the count, 14 quiet on the untouched fixture
and 13 with a colour planted on one, which is 7 without MToon plus 7 stating
(0,0,0), with 3 stating a real colour. `mutations-verify-0910.log` carries each
run's output.

## 5. What the gate says about the five bodies

Read after the change, on the files `public/avatar/` serves.

| body | VRM | materials | loud outlines | no rim | torn shapes | torn bindings | stranded | alignment |
|---|---|---|---|---|---|---|---|---|
| `mika-milfy-12` | 0 | 34 | 0 | 0 | 0 | 0 | 0 | 0 |
| `mika-pink` | 0 | 19 | 13 | 19 | 0 | 1 | 0 | 0 |
| `AvatarSample_B_webp` | 0 | 19 | 13 | 19 | 0 | 1 | 0 | 0 |
| `vrm1-twist-sample` | 1 | 13 | 7 | 13 | 0 | 4 | 0 | N/A |
| `vroid-studio-dressup` | 1 | 17 | 10 | 6 | 0 | 0 | 0 | N/A |

Only `mika-milfy-12` passes, and that is the correct reading rather than a
problem to fix. This gate is the MILFY BUILD's exit check, and its thresholds
were set against what that build produces. The other four are stock or
third-party bodies the site serves as-is, and nothing in the serving path asks
them to pass it. What changed today is that the two 1.0 rows are now measurements
instead of a crash and three silent zeros.

The rim column is the one that reads the same on both versions for the same
reason. `vrm1-twist-sample` states `parametricRimColorFactor` as (0,0,0) on all
13 of its materials and `vroid-studio-dressup` on 6 of its 17, where the two 0.x
bodies leave `_RimColor` out of all 19 entirely. Both mean the same thing to a
renderer, which is why the check tests the value and not the key.

The outline column does not generalise that neatly, and an earlier draft of this
paragraph said it did. What the two 0.x bodies have is one colour on everything:
all 13 of their loud materials carry (0.275, 0.09, 0.125), chroma 0.184, face and
body and clothes alike. `vrm1-twist-sample` is the same shape at a different
value, 7 materials all at (0.061, 0.009, 0.014), chroma 0.053, and only one of
the 7 is a face material. `vroid-studio-dressup` is the one that differs: 9 of
its 10 sit at that same 0.053, and the tenth,
`N00_000_00_HairBack_00_HAIR (Instance) (Instance)`, is a green outline at
(0.191, 0.515, 0.503), chroma 0.324. That is eight times the 0.04 limit, and six
times what the other nine on that body read, which is the comparison an earlier
draft of this sentence quoted against the limit by mistake. It is the loudest
outline on any body here, and `report()` prints only the first five findings of
each check, so it is invisible on the page and shows up only in the returned
list. Nothing in this change made it so; it is simply the first time the check
could see that file at all.

`vrm1-twist-sample`'s four torn bindings at 60 to 62mm are its own shoulders and
predate anything here: it is the twist-bone sample, its upper arms carry twist
joints this pipeline's 25mm limit was never measured against, and it is in the
registry without being offered to visitors.

## 6. Scope

Python only. `humanoid.py`, `verify.py` and `verify_test.py`, plus this file, its
mutation log and its suite log, plus one line moved in `dressup_test.py`.

That last one is outside the job as agreed, and it is here rather than left for
later because it makes a number in this document true: the guard that decides
which of its tests run sat above two of its classes, so the suite total in
section 7 was counting 8 of its 11. Moving it is the whole change; all three of
the tests it uncovers already pass.

Two documents carried statements this change makes false, and both are updated
rather than left to be found later. `docs/reports/mika-r3-studio-2026-09-09.md`
had a table row saying the gate could not run on VRM 1.0 and a command block
routing 1.0 files through a partial wrapper in a build directory
(`build/mika-reuse/r3-studio-20260909/structure-check.py`, whose `VRM0_ONLY`
list is exactly these five checks); it gains a dated note below the table.
`scripts/avatar/RESULT.txt`'s guard table described three of these checks in
their 0.x spellings alone: `_OutlineColor` and `_RimColor` for the two colour
ones, and `blendShapeMaster` binds for how `torn_shapes` recognises an
expression mesh. Each is now half of what the check reads.

`git diff --name-only` lists no TypeScript, so nothing under `src/` is in this
change and the browser is not part of its verification.

## 7. The suite

Every Python test module in `scripts/avatar/`, 443 tests across 31 modules, all
green. 28 of the 31 reach `verify` or `humanoid` through their import graph,
which is why the whole directory ran rather than the neighbouring files.

443 rather than the 440 the first run counted, and the three are the reason this
section is worth reading twice. `dressup_test.py` carried its
`if __name__ == '__main__': unittest.main()` at line 194, above the last two
classes in the file, so running the file collected 8 tests and the 3 in
`TheOrderOfThePipeline` and `TheWaiverReachesTheGate` never ran at all. Nothing
says so: 8 of 8 passing prints exactly like a full run, and the file had been
green in every suite receipt this project has written. All three pass. The guard
now sits at the end of the file, and every one of the 31 modules was checked the
same way, by comparing what running the file reports against what
`unittest.TestLoader` collects from it; `dressup_test.py` was the only one where
the two disagreed.

That file is also the one module that imports `verify_test`, for
`snapped_weights`, which is one of the helpers this commit rewrote. It was rerun
after that change and is green at 11.

`retarget_test.py` is the one row that reports no test count: it is a gate
script rather than a unittest module, and it prints `PASS` and exits 0 across
its 10 clips. `cover_test.py` at 927s and `pierce_test.py` at 261s are the two
heavy ones; everything else is under 32s. The full table is in
`verify-vrm1-0910-suite.log`.

The first attempt to run it in one background process was killed by the system
for memory pressure after four modules, so it was rerun in foreground batches.
That was worth chasing rather than retrying, because the cause turned out to
matter: the tests in this directory leak their temp copies. `verify_test.py` had
three sites that wrote a copy of a body and removed nothing, two of them a whole
VRM with its binary chunk. This commit adds a fourth, `edited()`, which cleans up
from the start, and a fifth `mkdtemp()` that is the shared root the other three
now write into. 8.63GB had accumulated in `/var/folders`, the disk
reached 100% with 135MB free, and a mutation pass taken in that state reported
five of the mutations reddening four to nine tests apiece against the one to
three they actually redden. What separates the two readings is not a traceback,
because the log filter kept only the summary lines; it is that every test which
errored writes a copy of a body before it asserts anything, every test which does
not stayed green, and the whole set returned to the table above once there was
room. They arrive as unittest ERRORs and read exactly like real findings.

All four now clean up. `edited()` is a method and frees its own directory as each
test ends, which matters over a long run; `perturbed()`, `snapped_weights()` and
`DanglingJoints.doc()` are reached without a test instance to hang that on, so
they write under one root removed at process exit. A first pass fixed `edited()`
and `perturbed()` and this paragraph then claimed the leak was gone, which both
reviewers caught: `snapped_weights()` alone was still leaving 12MB per call,
twice per run, and it writes the largest file of the three. Measured now, a run
leaves the `/var/folders` `tmp*` count unchanged and no `verify_test-*` root.

## 8. What review changed

Two read-only reviewers went over the first commit of this. Both failed it on
the same claim, and it was the one this document made about itself: that the
temp-file leak was fixed. It was half fixed. `verify_test.py` has four
`mkdtemp()` sites, the first pass caught two, and the largest of the three that
write a whole body was among the two left alone. Section 7 said "a run now
leaves nothing in /var/folders" and a run left 24MB.

The spec reviewer failed it a second time on section 5's outline paragraph,
which claimed the two 1.0 bodies read the same way the 0.x ones do. They do on
rim and they do not on outline: one 1.0 body's loudest material is a green hair
outline at chroma 0.324, eight times the limit, sitting past the five findings
`report()` prints. That paragraph is rewritten above from the measured lists.

Four smaller things came out of the same pass and are fixed in this commit:
`stranded_collider_groups`'s docstring promised a name the code cannot produce
on 1.0; `report()`'s N/A line had no assertion and was held only by the accident
that the sentinel has no `__getitem__`; two assertions on the 0.x side were
reachable by no mutation, now V11 and V12; and `RESULT.txt`'s guard table still
named `_OutlineColor` and `_RimColor` as what the colour checks read.

## 9. What the second review round changed

Both reviewers went over the amended commit. The code reviewer passed it; the
spec reviewer failed it on two numbers, both of them written during the first
round's fixes rather than carried over from the original.

`chroma 0.324` was called six times the limit. The limit is 0.04, so it is
eight; six is what it reads against the other outlines on its own body, which is
a different sentence. The kind of slip that a rewrite invites: the paragraph it
replaced was wrong about which materials were loud, and its replacement got the
materials right and the arithmetic wrong.

The suite log quoted `dressup_test.py` at 8 tests. The loader collects 11, and
the reason is section 7's second paragraph: that file ran its own
`unittest.main()` from the middle. So 440 was never this tree's number, and the
receipt that would have shown it was the one being audited. Every module has now
been compared run-count against loader-count, and this was the only one.

Four smaller findings are fixed in the same pass: the summary sentence in four
places said one check raised and three returned an empty list, when two raise,
one returns 45 false findings and two return an empty list (the measured table
in section 1 always said so, and three docstrings copied the wrong summary
above it); the V6 row of the mutation table listed one of its two red tests;
"between them they reach every assertion added here" was too strong, and now
says which four assertions are masked and by what; `RESULT.txt`'s guard table
still described `torn_shapes` as reading `blendShapeMaster`; and `report()`'s
own stats line printed `blendShapeGroups` for a 1.0 file, which is the same slip
as the `_RimColor` in the rim message that the first commit fixed, so it now
prints `expressions`.
