# Mutating the base-body contract, one defence at a time

Runner: `scripts/avatar/evidence/mutations-bodies-0911.py`, run against the
blobs committed at `2762021`. It refuses to start unless the working copies of
build.py plus bodies/mika_base.py already equal those blobs, asserts each pattern hits exactly once,
and asserts the restore byte-for-byte. Full output beside this file in
`mutations-bodies-0911.log`.

Baseline: 29 tests, green.

This axis has two kinds of defence and both are here. The hair material names
are DERIVED, so B1 to B6 break the derivation; the export's texture names and
the scalp hues are DECLARED, so B7 and B8 put a literal back. B9 and B10 are
the absolute heights, whose tests live in build_test, which is why this runner
runs both modules.

The outfit and base-body runs happened at `8b188d2`; `2762021` only reordered
the character runner's list, and all four mutated files are the same blob at
both commits (`git rev-parse 8b188d2:<path>` equals `git rev-parse HEAD:<path>`).

| # | what the mutation puts back | file | result |
|---|---|---|---|
| B1 | the head accessories name their hair material again | `build.py` | **RED** |
| B2 | a hair texture is spelled inline again | `build.py` | **RED** |
| B3 | the hair material is picked by name rather than by coverage | `build.py` | **RED** |
| B4 | a material this build added counts as the body's own | `build.py` | **RED** |
| B5 | a body whose hair cannot be found is allowed through | `build.py` | **RED** |
| B6 | only the main hair material keeps its black outline | `build.py` | **RED** |
| B7 | the scalp window is read off build.py again | `build.py` | **RED** |
| B8 | the scalp window is widened until it reaches the skin | `mika_base.py` | **RED** |
| B9 | a button height is typed back in | `build.py` | **RED** |
| B10 | the torso edges become offsets rather than fractions | `build.py` | **RED** |

10 of 10 red. A STILL GREEN row would mean that defence is not
tested by anything, which is the only result this table exists to catch.
