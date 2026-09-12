# Mutating the body-relative hair frame, one defence at a time

Runner: `scripts/avatar/evidence/mutations-hairframe-0912.py`, handed the
committed blob of `partition.py`. It refuses to start unless the working copy
already equals it, asserts each pattern hits exactly once, asserts the restore
byte-for-byte, and clears `__pycache__` before every run. Raw output in
`mutations-hairframe-0912.log`.

Run against this blob (check it with `git rev-parse HEAD:scripts/avatar/partition.py`;
a commit id would not survive the next comment edit):

    partition.py           a3442dac3509963989f2385707e3b93fe3eae688

Baseline: 46 tests green in `gate_test`, and the loader collects 46, so nothing
after a misplaced `unittest.main()` is being skipped.

Six of the eight positions are the numbers themselves, plus the two ends of the
coordinate space they are measured in.

| # | what the mutation puts back | must go red | result |
|---|---|---|---|
| H1 | the waist is Mika's y 0.90 on every body | the own-hips row | **as expected** |
| H2 | the front of the face is Mika's z -0.03 on every body | the own-eyes row | **as expected** |
| H3 | forward is always -Z, the way a 0.x export has it | the which-way-is-forward row and the turned-around body | **as expected** |
| H4 | the back of the head starts at Mika's y 1.44 on every body | the own-crown row | **as expected** |
| H5 | off the midline is Mika's 0.12 on every body | the own-skull row | **as expected** |
| H6 | left is -X, the way a 0.x export has it | the eye-bone row | **as expected** |
| H7 | a strand is measured where its vertex buffer says | the turned-around body and the lifted body | **as expected** |
| H8 | the frame measures the face where its vertex buffer says | the lifted body | **as expected** |

## The two that are not numbers

`vrm1to0` faces a 1.0 export the 0.x way by parenting the scene to a node
rotated 180 degrees. Every bone moves and the vertex buffers do not, and the
pipeline runs that conversion before partition on every 1.0 file it is handed.
So a rule that compares a bone against a raw POSITION is comparing two
different spaces, and it put vrm1-twist-sample's entire head of hair in front
of its eyes and called it a fringe. `pose.skinned` puts both ends in the rest
world.

H7 and H8 are the two ends, and they need different tests, which is why there
are two invariance tests rather than the one the transform suggests. A rotation
about Y leaves every Y coordinate and every `|x|` untouched, so the turned-around
body cannot see the crown and the midline being measured from raw POSITION: H8
stays green against it. Lifting the body half a metre moves the bones and not
the buffers, and separates them.

## What H2 and H3 say about each other

Both are about the same line, and they are not the same defence. H2 puts the
number back and leaves the direction alone; H3 keeps the number body-relative
and fixes the direction to -Z. Under H2 the eye bone stops being consulted at
all, so the turned-around test also fails, and under H3 it is only the 1.0
export that goes wrong. The pair is what makes "in front of the eyes" mean
in front of *these* eyes, facing *this* way.
