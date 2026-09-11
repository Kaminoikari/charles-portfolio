# Mutating the step-1 receipt's living check

`scripts/avatar/evidence/build-axes-0911.py` makes two assertions about today's
`build.py`, and they shadow each other: adding a constant nobody classified trips
the first, and it also makes the second's condition true, so one mutation cannot
tell you both are alive. These are the two that can.

Run against the blob committed at `107f357`, restoring the exact bytes read at the
start and asserting the restore. Raw output in
`build-axes-0911-mutations.log`.

Baseline: exit 0, green.

| # | what the mutation does | result |
|---|---|---|
| A1 | a constant is added to build.py and given no axis | **RED** |
| A2 | a constant SINCE lists is deleted, with nothing put in its place | **RED** |

A1 fires `build.py declares a constant no axis owns`; A2 fires `SINCE lists a
constant build.py no longer declares`. Deleting LEG_EDGES by renaming it reaches
only A1, because the new name is itself unowned, which is why A2 deletes the
block outright and puts a comment where it was.

The classification half of the same script is not mutated here: it reads the blob
at `135d33b` through `git show`, so nothing anyone does to the working tree can
change its answer. That is the point of pinning it.
