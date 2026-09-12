# Mutating the content-derived mesh roles, one defence at a time

Runner: `scripts/avatar/evidence/mutations-meshes-0912.py`, handed the committed
blob of `partition.py`. It refuses to start unless the working copy already
equals it, asserts each pattern hits exactly once, asserts the restore
byte-for-byte, and clears `__pycache__` before every run. Raw output in
`mutations-meshes-0912.log`.

Run against this blob (check it with `git rev-parse HEAD:scripts/avatar/partition.py`;
a commit id would not survive the next comment edit):

    partition.py           d78714d89162ef4675d8b50197c22115f7bf51cd

Baseline: 61 tests green in `gate_test`, and the loader collects 61, so nothing
after a misplaced `unittest.main()` is being skipped.

Re-run at `205feec`. The table was first run at `86dc878`, before the hair
frame changed `hair_name`'s signature, and one row's pattern had to be re-aimed
then: M3's `elif` became an `if` guarded on there being exactly one face mesh.
Two later comment-only commits moved the blob again, and each time every row was
re-run rather than re-pinned, because a comment edit is exactly what a blob sha
is here to catch.

Eight positions decide that a mesh's role comes from what it is made of. Each
is broken alone.

| # | what the mutation puts back | must go red | result |
|---|---|---|---|
| M1 | the face is the mesh literally called `Face.baked` | the found-by-materials row, and every test of the body whose meshes are not named `.baked` | **as expected** |
| M2 | any number of face meshes will do, as long as there is one | the two-face-meshes row | **as expected** |
| M3 | the face mesh is not asked for the morph targets it is locked for | the no-morph-targets row | **as expected** |
| M4 | only the mesh called `Body.baked` is checked for names it cannot read | the hand-authored-material-in-any-mesh row | **as expected** |
| M5 | a hair strand counts as a material the grammar cannot place | the recognised row, the strand row, and Vivi's whole class | **as expected** |
| M6 | every HAIR material is the one baked-in back-hair object | the two-kinds-of-hair row and Vivi's whole class | **as expected** |
| M7 | a MATCAP accessory has no name, so its body is refused | the accessory row | **as expected** |
| M8 | the grammar is consulted only inside a mesh called `Body.baked` | every test of the body whose meshes are not named `.baked` | **as expected** |

## Why these eight, and not one

The change reads as a single idea, and it is four separate decisions with two
guards each. M1 and M2 are both about the face and neither covers the other:
finding it by its materials is one thing, and refusing when two meshes carry
them is another, because which of the two holds the 56 morph targets would
otherwise be a coin toss and the loser gets split like a garment. M3 is a third:
being the mesh `blendShapeMaster` binds into is the reason Face is locked at
all, so the morph targets are required rather than assumed.

M4 and M5 are the two halves of one sentence in `recognise()`. Scanning every
mesh instead of one is what makes a hand-authored name in the hair mesh a
refusal rather than something `hair_name` then places by geometry. Excusing
strands is what stops the same scan turning every VRoid body on the disk away
because of its own hair. Remove either and the other reads as complete.

M6 and M7 are `body_name`'s two new answers, and M6 is the one that shows the
grammar was always sufficient: telling `HairBack` from `Hair` is what a mesh
boundary used to stand in for.

M8 is the routing. It is invisible on Mika and on Vivi, because on both of them
the mesh called `Body.baked` holds exactly the primitives the grammar can name
and the hair mesh holds exactly the strands. Only vrm1-twist-sample separates
the two, which is why that fixture exists.

## What the eight cost, and what it bought

**Four of them came back as an unreadable crash.** `partition()` refuses by
raising `SystemExit`, two test classes call it from `setUpClass`, and unittest's
`setUpClass` handler catches `Exception`, which `SystemExit` is not. So one
refusal ended the run with a traceback and no counts, no failure names and
nothing to match a must-fail set against. It is a worse failure mode in ordinary
use than a failing class, and it was hiding four rows of this table. Fixed
separately, before this table was run, by turning the refusal into an
`AssertionError`.
