# Mutating the review fix, one defence at a time

Runner: `scripts/avatar/evidence/mutations-review-0912.py`, handed the committed
blobs of `partition.py` and `pose.py`. It refuses to start unless the working
copies already equal them, asserts each pattern hits exactly once, asserts the
restore byte-for-byte, and clears `__pycache__` before every run. Raw output in
`mutations-review-0912.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit id
would not survive the next comment edit):

    partition.py           205feecf3a22ef7ec06c0075aa9bced89e8bfce7
    pose.py                079a766c18bbc382e7f5e3d8646c4da5a55d47c8

Baseline: 54 tests green across `gate_test` and `pose_test`, and the loader
collects 50 and 4.

Four positions, one per silent wrong answer the review found.

| # | what the mutation puts back | must go red | result |
|---|---|---|---|
| V1 | a body with no eye bone is let through to the frame | the no-eye-bone row | **as expected** |
| V2 | mesh names may repeat or be missing | the shared-name row and the nameless-mesh row | **as expected** |
| V3 | an unskinned primitive keeps its own vertex buffer's coordinates | the node-places-it row | **as expected** |
| V4 | both kinds of unnamable material are reported as carrying no token | the token-and-no-part row | **as expected** |

## One defence, not two, for the eye bone

`hair_frame` indexes `bones['leftEye']` directly and `recognise()` requires the
bone. That looks like two defences and it is one: putting the old
`bones.get('leftEye', bones['head'])` back reddens nothing, because recognise
never lets such a body reach the frame. Its absence is not load-bearing, so it
gets no row; the `KeyError` it would raise is a backstop, not a guard. V1
mutates the guard, which is the one position a body can actually get past.

## What V3 could not be tested against

Every VRM on the disk is skinned throughout, so no fixture exercises the
unskinned path at all. `pose_test.AMeshWithNoSkin` builds one: a single
primitive with no `JOINTS_0` under a node carrying the same 180-degree turn
about Y that `vrm1to0` inserts. Without the fix it comes back at
`(0, 1, +2)` while every skinned mesh in the same file turns to `(0, 1, -2)`.
