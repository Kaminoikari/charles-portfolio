# Mutating the skin repaint, one defence at a time

Runner: `scripts/avatar/evidence/mutations-skin-0912.py`, handed the committed
blobs of `skin.py` and `skin_test.py`. It refuses to start unless the working
copies already equal them, asserts each pattern hits exactly once, asserts the
restore byte-for-byte, and clears `__pycache__` before every run. Raw output in
`mutations-skin-0912.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit
id would not survive the next comment edit):

    skin.py                1f297ef4a221df49ac653ca6eafeab44c4504d4a
    skin_test.py           b53a27c33153836cad11580e6318eff290d0237f

Baseline: 3 tests, green. The loader collects 3 as well.

Each row declares WHICH tests it expects to fail, because "something went red"
is not the interesting fact here. S3 is the reason: it applies S1's mutation
and swaps the fixture to the body nine levels was tuned for, and what it shows
is the real-body test dropping out of the failure list.

| # | what the mutation puts back | expects to fail | result |
|---|---|---|---|
| S1 | the pyramid stops after nine halvings again | all three | **as expected** |
| S2 | `half()` halves a dimension that is already one | the non-square one | **as expected** |
| S3 | nine halvings, judged on the body nine was tuned for | the two synthetic ones | **as expected** |

## Why there are two defences and not one

S1 and S2 both concern the pyramid reaching a single pixel, and they are
separate because they fail on different images. `while weight.size > 1` is what
makes the pyramid deep enough on the square 2048 atlas that every body here
has; `half()` carrying a dimension already at 1 is what makes a single pixel
reachable at all when the image is not square, where halving both dimensions
unconditionally goes 6x400, 3x200, 1x100, 0x50. Either one alone leaves a
coarsest level with cells nothing valid reaches, which is the whole defect.

An earlier version had a third line that filled any still-empty coarse cell
with the average of every valid pixel. It is gone, because it SHADOWED S1: with
that line present, stopping the pyramid at nine halvings still produced the
right answer, and the mutation came back green on the two tests it should have
reddened. Two defences against the same failure, and only one of them testable.

## What S3 says

With nine halvings and the fixture pointed at `mika-pink.vrm`, the real-body
test passes. mika-pink's largest hole swallows no coarse cell whole (0 of 16
empty at the ninth level, against 2 of 16 on AvatarSample_A), so the body this
pipeline was written on cannot show the defect. The test is only a test because
its fixture is a body this pipeline was not written for.
