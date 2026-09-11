# Mutating the skin repaint, one defence at a time

Runner: `scripts/avatar/evidence/mutations-skin-0912.py`, handed the committed
blobs of `skin.py` and `skin_test.py`. It refuses to start unless the working
copies already equal them, asserts each pattern hits exactly once, asserts the
restore byte-for-byte, and clears `__pycache__` before every run. Raw output in
`mutations-skin-0912.log`.

Run against these blobs (check one with `git rev-parse HEAD:<path>`; a commit
id would not survive the next comment edit):

    skin.py                40153685d51128cd346d09dde90faeac426cd901
    skin_test.py           e78a2746ca33e1d6dfaa8516d33926893e288710

Baseline: 12 tests, green, and the loader collects 12.

Each row declares WHICH tests must go red, rather than only that something did.
A mutation usually reddens more than that (a stubbed lookup takes a setUpClass
down with it), and the runner reports those separately without holding them
against the row. The result the table exists to catch is a named test that
stayed green, which would mean nothing was guarding that defence.

| # | what the mutation puts back | must go red | result |
|---|---|---|---|
| S1 | the pyramid stops after nine halvings again | the synthetic hole, the non-square image, the dark-blotch row | **as expected** |
| S2 | `half()` halves a dimension that is already one | the non-square image | **as expected** |
| S3 | nine halvings, judged on the body nine was tuned for | the two synthetic rows only | **as expected** |
| S4 | the body's skin material is one body's name written down again | the face-atlas row | **as expected** |
| S5 | any SKIN material will do, whichever part it belongs to | face atlas, model number, the written-down name | **as expected** |
| S6 | skin is whatever is bright enough, at one body's brightness | the garment row and the leftover row | **as expected** |
| S7 | the body's colour is read off the whole arm, sleeve and all | the sleeve row | **as expected** |
| S8 | any vertex will do, however little of it the hand drives | the garment row | **as expected** |

## Three things this table cost, and what they were worth

**A defence that shadowed another.** An earlier version of pull_push filled any
still-empty coarse cell with the average of every valid pixel. With that line
present, stopping the pyramid at nine halvings still produced the right answer
and S1 came back green on the rows it should have reddened. It is gone; `half()`
carrying a dimension already at 1 does the same work in a place that S2 can
reach on its own.

**A guard that had lost its teeth.** The end-to-end row compared the fill's
MEDIAN against the surviving skin's mean, with 30 of slack. Introducing the
per-body reference changed the mask slightly, and the same defect then measured
24 on AvatarSample_A: under the threshold, so S1 passed that row. The dark TAIL
is what the defect is. Under nine halvings the fill's first percentile falls to
45 against the surviving skin's 185 on AvatarSample_A, 40 against 180 on
AvatarSample_C and 46 against 194 on Darkness_Shibu; with the pyramid run to
one pixel it sits at or above the skin's on all sixteen. A reading that moves
by 163 where the other moved by 24.

**An expectation written before the test it named.** S4 and S5 first declared
that `apply` would fail, and it does not: `apply` resolves the material itself,
so `body_image`'s default is reached only by a caller that omits it. The
expectations are now derived from what each mutation actually removes.

## What S3 says

With nine halvings and the fixture pointed at `mika-pink.vrm`, the two rows
about a real body pass. mika-pink's largest hole swallows no coarse cell whole
(0 of 16 empty at the ninth level, against 2 of 16 on AvatarSample_A), so the
body this pipeline was written on cannot show the defect at all. Those rows are
only tests because their fixture is a body this pipeline was not written for.
