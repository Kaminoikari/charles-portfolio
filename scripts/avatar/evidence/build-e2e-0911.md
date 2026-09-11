# The refactor's end-to-end acceptance: the manifest, field for field

The module-contract plan's acceptance is that `build()` produces the same
manifest before and after the move. Running `make.py` would have answered it and
was the wrong way to ask: its last step copies over
`public/avatar/mika-milfy-12.vrm`, which the site serves cache-immutable under a
versioned name, and this pipeline has a known byte non-determinism in
`head.py`'s two hair buns. So the question was asked without it.

`build-e2e-0911-prep.py` runs make.py's steps 0b-4 (VRM 1.0 entry conversion,
partition, strip, skin repaint, proportion) from `baseline.vrm` into a scratch
directory. `build-e2e-0911-run.py` then runs ONE tree's `build()` against those
inputs and prints what it produced. Point it at a `git archive` of the
pre-refactor tree and at the working tree, and the two answers are directly
comparable.

    $ python3 scripts/avatar/evidence/build-e2e-0911-prep.py <scratch>/out
    $ git archive 135d33b scripts/avatar | tar -x -C <scratch>/before
    $ python3 scripts/avatar/evidence/build-e2e-0911-run.py \
          <scratch>/before/scripts/avatar <scratch>/out before
    $ python3 scripts/avatar/evidence/build-e2e-0911-run.py \
          <repo>/scripts/avatar <scratch>/out after

`build-e2e-0911-run.py` writes its JSON after build()'s own progress output, so
read it from the first line that is `{`. The converted garments it copies in come
from this repo's `scripts/avatar/out/blender`, located from the script's own
path: an earlier version reached for `os.path.join(out, '..', 'out', 'blender')`,
which collapses onto `out/blender` itself whenever the scratch directory happens
to be called `out`, which is exactly what the command above used to say.

## Result

Run twice. First comparing `135d33b` (the last commit before the character
contract moved) with `30488d3` plus the shadowing fix, then again after the
review round moved 31 more literals out of `build.py` (`8b188d2`). Both runs
produced the same table:

| what | before | after |
|---|---|---|
| manifest, walked field by field over 26 parts | identical | identical |
| manifest sha256 | `aa49410c4a4a2612…` | same |
| VRM bytes | 12034560 | same |
| parts added by build() | 32 | same |
| landmarks | identical | identical |

## What it caught that 487 unit tests did not

`edge` holds `torso_edges(lm)` for the whole of `build()`, and the button loop
rebound it to a vertex. Step 4 gave the camisole frill a torso edge to read,
three hundred lines below that loop, so it indexed a numpy array with a string
and raised. Every unit test stayed green, because none of them runs `build()`
end to end: the contract tests exercise the seams, and the seams were right.

That is the second shadowing of the same shape in one day -- the first was a
local named `hair_materials` over the new module-level function. `build_test`
now has `DerivedOnce`, which asserts that the values `build()` derives once and
reads far away are each bound exactly once, and that they are each still bound
at all, because a name that stops existing would pass the first half for free.
It watched ten names when it was written and twelve after the review round added
`paint` and `band_part`; the count is not repeated anywhere, so that it cannot
go stale the way the figures this round spent an afternoon correcting did.
