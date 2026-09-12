# Mutating the part-name clash resolution, one defence at a time

Runner: `scripts/avatar/evidence/mutations-clashes-0912.py`, handed the
committed blob of `partition.py`. It refuses to start unless that file is clean
in git and already equals the blob, asserts each pattern hits exactly once,
asserts the restore byte-for-byte, and clears `__pycache__` before every run.
Raw output in `mutations-clashes-0912.log`.

Run against this blob (check it with `git rev-parse HEAD:scripts/avatar/partition.py`;
a commit id would not survive the next comment edit):

    partition.py           4cd4bba35fec9a7c900f93737aafea332f063754

Baseline: 59 tests green in `gate_test`, and the loader collects 59.

Seven positions. Four decide a name (that a clash exists at all, which claim
keeps the plain name, what the ranking measures, which claim is numbered
first), two decide what the ranking is measured on, and one catches a resolver
that answered wrongly.

| # | what the mutation puts back | must go red | result |
|---|---|---|---|
| C1 | no resolution at all, which is where this step stood before | the dress-up class, and the two-meshes-one-name row | **as expected** |
| C2 | the plain name goes to the claim reaching least | the dress-up class, and the two-meshes-one-name row | **as expected** |
| C3 | claims are ranked on size | the reach-rather-than-size row | **as expected** |
| C4 | the claims that lose a name are numbered back to front | the document-order row | **as expected** |
| C5 | the number is taken without asking whether the grammar wrote it | the number-skips row | **as expected** |
| C6 | a claim reaches as far as its mesh's whole POSITION buffer | the reach-is-measured-on-drawn-vertices row | **as expected** |
| C7 | a name arriving twice is written twice | the resolver-repeats row | **as expected** |

## Why C3 needs a second body

C3 is the only row that survives on the shipped file. Reach and size agree
there: the body layer is both the tallest claim and the largest. They disagree
on the same export before `cover.trim` cut the covered triangles away, where
each inner layer is 5,970 triangles against the body's 4,139 and size hands
`Body_Skin` to a torso patch with no head and no feet.
`gate_test.BodyDrawingItsSkinInThreeLayers.export()` reads that older file out
of git at `6ae5189:public/avatar/vroid-studio-dressup.vrm` and checks its
sha256, the way `cover_test` reads the same blob. Without it C3 is green and
the choice of criterion is unpinned.

## Why C6 needs a stub rather than a body

No body on the disk both clashes and shares a vertex buffer across the claims
that clash: the dress-up export gives each primitive its own POSITION accessor,
and the VRoid exports that share one (mika-pink's body mesh is seven primitives
and one accessor) have no clash to resolve. So the row is exercised by stubbing
`hair_name` to make every strand claim `Outfit_Shoes` on mika-pink, where the
shoes baked into the body mesh draw 0.16m of vertices out of a buffer spanning
1.51m. Read through the indices the hair wins the name; read raw the body does.

## What C4 first pointed at, and why that decided nothing

The first version of this row swapped the `-i` out of
`max(group, key=lambda i: (claims[i]['extent'], -i))` and everything stayed
green. It decides nothing: `max` returns the first maximal item it meets, so
the term was a restatement of what Python already does, and no body has two
claims tied for the greatest reach anyway. The order that does decide is the
one the numbering loop walks, which is the order the rows were built in. The
`-i` is gone and C4 mutates the loop.
