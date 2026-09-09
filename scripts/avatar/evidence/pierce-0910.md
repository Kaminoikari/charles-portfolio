# Two things the clipping gate was counting that a viewer never saw

2026-09-10. Cutting the body out from under the clothes (`cover-0910.md`) is
what moved `Outfit_Cardigan` off 5.03 times its limit, and two of the pixels it
left behind were things a viewer never saw. This is the pair of changes that
separated those from real clipping, and what each is allowed to excuse.

## 1. A hand in front of a chest is not a hand through a sleeve

`pierce._arm_triangles` drops BARE arm skin and keeps arm skin that has
arm-driven cloth within 40mm of it. That rule is right about a sleeve and says
nothing about the rest of what can be within 40mm of an arm.

At `dance` t=23.45s the export's hand comes to rest beside its own cuff, so the
arm skin is kept, and most of what the cardigan then scores is the pale hand
against the hoodie's TORSO panel, which no arm drives.

So the gate gained a fourth condition beside the three it already had: arm skin
counts only against cloth an arm drives. A forearm through its own sleeve still
counts, and a hand in front of a chest does not.

`partmap.draw` answers the "does an arm drive this triangle" question, by the
same dominant joint and the same all-three-corners rule it already used for which
SIDE drives a triangle, and it rides in the green channel of the extra pass that
was already being rasterised, so the gate costs exactly what it did before. The
bone list moved to `humanoid.ARM_BONES` because two modules now read it: pierce
asks which skin is arm skin and partmap asks which cloth an arm drives, and a
second copy would let a sleeve stop being a sleeve halfway through the
comparison.

Measured at `dance` t=23.45s against a limit of 150: on the body that ships
today, 340 pixels without the condition and 89 with it; on the same export
before its covered skin was cut, 556 and 323. The gap between the two bodies is
why the test that pins this condition asserts the part's own limit rather than a
number chosen between one body's two readings.

It moves the shipped Milfy body too, and the first draft of this note said it
did not. `Outfit_Bottom` was that body's worst part before the condition, 103
pixels of 150 at `modelPose` t=4.7s in `clearance-0906-motion.log`. Re-run over
the same ten clips with the condition in place, it no longer appears among the
worst parts at all, and the body's worst clip ratio falls from 0.69 to 0.47:
what is left at the top is `Acc_Bandage_Thigh` at 14 pixels of 30, which was
already the second row of that log.

Those pixels are the false positive `pierce.py`'s own docstring names. Her hand
rests against her thigh with the skirt's hem in front of the wrist, so the skin
is arm skin and the cloth it scores against is a skirt no arm drives
(`pierce-0910-milfy-hand.png`). At that frame the condition takes
`Outfit_Bottom` from 97 pixels to 0 in the side view, its worst, and 136 to 0
across all three views. It is not the only garment it touches: the cardigan
loses 11 of its 20 and keeps 9 (`pierce-0910-frames.log`).

Loosening a gate on the body every visitor sees needs its own test rather than a
sentence, and the first version of that test could not fail. It defined the
dropped pixels by the gate's own rule and then asserted the rule back, which is
true of any input. What
`test_it_drops_a_hand_resting_against_a_skirt_on_the_shipped_body` pins now is
what the rule does not decide: the skirt goes from over 50 pixels to none, and
no other garment is emptied that way. `test_a_skirt_is_never_arm_driven` holds
the other half, that no arm drives that garment.

## 2. The glasses, which the gate cannot read at all

`Acc_Glasses` scores 51 pixels against a limit of 30 at `dance` t=16.75s, and it
is not a defect. The temple arm passes from the lens behind the ear, and the ear
sits 8.6 to 11.0mm nearer the camera than it, so every condition the gate has
passes on a frame that renders correctly: the gap is inside the 30mm window, the
temple's outer face is toward the camera, head skin and head-driven cloth are
both centred, and no arm is involved. `pierce.py`'s docstring already recorded
two shapes of this blind spot (a hand resting on a hip, a sock on the far leg);
an accessory that passes behind a piece of body is the third.

No fifth condition was invented for it. Nothing measured here distinguishes the
ear in front of a temple from a real burst, and a condition guessed at under the
last item on a list is how a gate goes quietly blind. What the gate gained
instead is a per-body declaration:

```json
"pierce_waivers": {"Acc_Glasses": {"pixels": 60, "why": "..."}}
```

`pierce.waivers` refuses one with no `why`, and refuses one that names a part the
body does not have. The reason is required because the only honest use of this is
a measured false positive; without it a waiver is a raised threshold wearing a
costume. 60 is that worst reading rounded up to the next ten: a real defect on
a part that covers 1,043 pixels would be several hundred.

The shipped Milfy body declares none, and the test says so, so the mechanism
cannot quietly spread to the body every visitor sees.

## What this leaves

On the trimmed export, all ten clips pass every part: the worst garment is
`Outfit_Cardigan` at 0.98 of its limit (147 pixels of 150, `playFingers`
t=1.8s), and the waived glasses at 51 of 60. `gate-0910-shipped.log` is that run
against the sha256 of the file it read, and the shipped Milfy body in the same
run reads 0.47. Three pixels is the whole margin,
and `cover-0910.md` section 6 is what stands between it and a hundred.

Seven mutations, seven reds, in `pierce-0910-mutations.log`
(`cover-0910-mutations.log` holds the nineteen behind `cover.py` and one behind
its own fixture, and `pipeline-0910-mutations.log` the four behind the wiring
between the steps):

| mutation | what goes red |
|---|---|
| partmap marks no cloth as arm-driven | `test_the_buffer_says_which_cloth_an_arm_drives` |
| partmap marks every cloth as arm-driven | that one and `test_a_skirt_is_never_arm_driven` |
| pierce counts arm skin against any cloth | `test_a_hand_in_front_of_a_chest_is_not_clipping` |
| a waiver needs no reason | `test_a_waiver_without_a_reason_stops_the_run` |
| a waiver may name a part the body lacks | `test_a_waiver_for_a_part_this_body_lacks_stops_the_run` |
| the waiver lowers the limit instead of raising it | `test_a_declared_waiver_raises_that_part_only` |
| partmap says an arm drives the skirt too | `test_it_drops_a_hand_resting_against_a_skirt_on_the_shipped_body` |
