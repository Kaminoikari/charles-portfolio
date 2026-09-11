# Every defence in the pan rule, mutated one at a time

Run against commit `bb31fd0` on 2026-09-11. Each mutation writes its bytes, runs
the tests, then writes back the exact bytes read at the start; nothing is
restored with `git checkout`, and each runner refuses to start unless the
working file already equals the committed blob. That refusal earned its place
during this run: the first attempt was killed for memory pressure partway
through R3 and left the mutation on disk, which without the check would have
been the next run's "baseline".

## The rule itself

`src/components/chat/clearance.ts` against `src/components/chat/clearance.test.ts`.

| id | mutation | result | which test caught it |
|---|---|---|---|
| P1 | panHolds stops checking that the pan clears the crown | RED | refuses a pan that leaves the crown outside the top edge; holds a pan that is not equal to its own re-derivation |
| P2 | panHolds stops checking that her hips stay on the bottom edge | RED | refuses a pan that takes her hips off the bottom edge |
| P3 | panHolds stops checking the pan against the policy point | RED | refuses a pan more than the grid step above what the policy asks for |
| P4 | panHolds demands the policy point exactly, as the old equality did | RED | holds a pan that is not equal to its own re-derivation; refuses a pan more than the grid step above what the policy asks for |
| P5 | a range boundary is read exactly instead of to four places | RED | reads a range boundary to the precision its producers wrote it at; holds a pan that is not equal to its own re-derivation |

P4 is the rule that was there before 2026-09-11: demanding the policy point
exactly IS the `pan === ceil(least)` equality, and it reddens the test built
from AvatarSample_C's two readings. That is the whole case for the change,
stated as a mutation rather than as a paragraph.

## The guards that read it

`src/components/chat/rigProbe.test.ts`. These RESTORE the pre-2026-09-11 rule
rather than break the new one, so the column that matters is which body each one
blocks: a rule that blocks nothing was not worth changing.

Run per family with `-t "bundled motions on '<id>'"`. The quotes are part of the
title and a filter without them selects nothing and skips all 1050 tests, which
is why each run asserts a green baseline of 71 before mutating -- a RED measured
against a filter that matched nothing is not a RED.

| id | restored rule | family | baseline | mutated | which guard fires |
|---|---|---|---|---|---|
| R1 | `reach` must be needed in EVERY placement | vroid-sakurada-fumiriya | 71 pass | 2 fail | spin, squat stay inside every frame they declare |
| R1 | " | vroid-sample-c | 71 pass | 3 fail | dance, spin, squat stay inside every frame they declare |
| R1 | " | vroid-sendagaya-shino | 71 pass | 1 fail | dance stays inside every frame it declares |
| R1b | `handTop` must be needed in EVERY placement | vroid-sendagaya-shino | 71 pass | 1 fail | scratchHead stays inside every frame it declares |
| R2 | the pan guard stops consulting `excluded` | vroid-sakurada-fumiriya | 71 pass | 1 fail | pans by what the measurements leave room for |
| R3 | the stays-inside guard stops consulting `excluded` | vroid-sakurada-fumiriya | 71 pass | 1 fail | dance stays inside every frame it declares |
| R4 | the pan-need guard reads this frame's crown, not the clip's | vroid-vita | 71 pass | 1 fail | dance declares no pan it does not need |

R1 blocks three separate families, which is the answer to whether the
per-placement waiver rule was worth changing: it was not one body's quirk.
