# The body under the clothes, and the two guards that decide how much of it goes

2026-09-10. The dress-up export's last open defect was the hoodie: the pixel
clipping gate scored `Outfit_Cardigan` at 755 pixels against a limit of 150 on
`modelPose` at t=2.82s, 5.03 times over, and the render showed it. This is what
that turned out to be and what was built for it.

## 1. It is not skin, and there are three bodies

`public/avatar/vroid-studio-dressup.vrm` draws a body in three meshes:

| part | mesh | vertices | triangles | material |
|---|---|---:|---:|---|
| `Body_Skin` | `Body (merged).baked(copy).baked[0]` | 2,795 | 4,139 | `N00_000_00_Body_00_SKIN` |
| `Body_Skin_Inner_Top` | `InnerTop.baked[0]` | 3,295 | 5,970 | `N00_000_00_Body_00_SKIN(Clone)` |
| `Body_Skin_Inner_Bottom` | `InnerBottom.baked[0]` | 3,295 | 5,970 | `N00_000_00_Body_00_SKIN(Clone)` |

The two inner layers are the same surface twice: identical POSITION, index and
UV bytes, and identical again after skinning. `Body_Skin` spans x ±0.694,
y 0.015 to 1.593 and the inner layers x ±0.526, y 0.145 to 1.406, so the first
has the head, hands and feet and the other two have the torso and upper limbs.
They share not one vertex position. Studio's auto-mask ate `Body_Skin`'s torso
and never touched the other two, which is why the median distance from an inner
vertex to the nearest `Body_Skin` vertex is 86.8mm: in the torso there is no
`Body_Skin` left to be near.

**They are not redundant, and that matters because deleting one would have been
the obvious move.** Their materials differ: base colour textures of 96,269 and
106,510 bytes. The first draws an inner bottom, the second a black camisole, both
on a transparent field. `parts-0909.md` says of them 「是同一片身體畫了兩次」,
which is true of the geometry and would be read as true of what they draw; it is
not. Whichever is deleted, what it draws goes with it.

So the two layers are inner WEAR on a body copy, and the manifest calls them
skin. The black patch the gate was counting is that camisole coming through the
hoodie.

## 2. Why the weights were not the answer

`refit.py` already ran on this file and `verify.torn_bindings` passes: no single
primitive tears. Measured at the failing frame, 1,637 inner-layer vertices start
inside the cardigan at rest, a median 22.9mm in; at t=2.82s, 173 of them are
outside it, the worst by 29.9mm. Over that interval the body moved a median
105.2mm and the cloth over it 110.6mm. Nothing is torn; two primitives simply
disagree, and chasing that means fitting every garment to every body it might be
worn on.

Skin that is inside a garment at rest is skin nobody can see. Cutting it removes
the class rather than this instance of it, so `cover.py` cuts it.

## 3. The criterion, and the three versions of it that were wrong

The first version asked for the nearest cloth VERTEX within 50mm and took the
sign from that vertex's normal. It fails on the case the module exists for. This
hoodie stands 50 to 80mm off the chest, so **106 of the camisole's 166 exposed
vertices had no cloth within reach at all** and stayed in; widening the ball far
enough to reach a loose hoodie also reaches the garment on the far side of the
torso, where the sign means nothing.

The criterion now casts a ray along the vertex's OWN outward normal, 150mm long.
That is the question a viewer standing in front of that piece of skin would ask.
What took three tries is what the ray is allowed to hit on the way.

**Cloth anywhere along the ray.** A ray long enough to clear a hood is long
enough to cross a head, and a vertex inside the mouth has a normal pointing into
the skull, so 120 mouth vertices reported the hood BEHIND the head as cover --
every one of them facing into the skull, the hood a median 117.7mm away through
the whole head, and 58 triangles of `FaceMouth` deleted with them
(`mouth-0910.log`). The jaw and the neck went with them and the collar ate into
the neck: 2,495 pixels once the camera is on the head (M17). Nothing downstream
catches it. The hole guard of section 4 counts pixels that lost their paint, and
these kept theirs; they just stopped being skin. Only a camera on the head shows
it, and the full-body framings the rest of this work uses are too coarse for a
notch a few millimetres wide.

**Cloth must be the FIRST surface the ray meets.** That fixes the neck: the head
camera moves 394 pixels, a sliver along the collar's own edge. It also stops the
cull reaching the camisole. Of the 135 inner-layer vertices whose cloth was
rejected because skin came first, **99 were blocked by `Body (merged)` a median
0.49mm away and never more than 1.55mm** -- the same body drawn twice, half a
millimetre apart, not the far side of anything. 765 triangles of torso stayed in
and the cardigan read 171 pixels against a limit of 150.

**Skip the skin within a few millimetres of the start and keep looking.** The
obvious repair, and it is wrong in the other direction. Two standoffs were
measured, 2mm and 10mm, and both cut the neck out from under the collar again:
2,481 pixels at head framing, as bad as the rule they were repairing. The
reason is that the same half-millimetre nesting that hides the camisole behind
`Body (merged)` is what holds `Body (merged)` itself back at the collar opening,
so a threshold cannot tell one from the other. There is no value that separates
them: the two are the same geometry with opposite right answers.

**What separates them is which layer a viewer sees.** Cutting BOTH inner layers
entirely -- all 5,970 triangles of each, 11,940 -- moves the head camera 0
pixels. All 2,481 come
from 1,173 triangles of `Body_Skin` and the face. So the two are not the same
question, and the property that tells them apart is measurable off the file
(`opacity-0910.log`, and the spans below):

| skin primitive | vertices on an opaque texel | height it spans |
|---|---:|---:|
| `Body_Skin` | 100.0% | 100.0% |
| `Face` skin | 100.0% | 14.8% |
| `FaceMouth` | 100.0% | 1.6% |
| `FaceEyeline` | 46.7% | 2.2% |
| `FaceBrow` | 19.2% | 1.1% |
| `EyeHighlight` | 7.7% | 1.0% |
| `Body_Skin_Inner_Top` | 23.8% | 79.9% |
| `Body_Skin_Inner_Bottom` | 6.3% | 79.9% |

A layer that paints over almost none of itself is inner wear drawn on a copy of
the body, transparent everywhere the garment it draws is not, and the real body
is in front of it wherever both exist. So the body a viewer sees can only be
hidden by cloth, and cloth has to come first for it; the copies underneath are
hidden by that body as well, and cloth anywhere along the ray is enough.

**Transparency alone is the wrong test, and the table says why.** Eyeliner,
eyebrows and eye highlights are alpha masks drawn ON the visible face, and they
read 46.7%, 19.2% and 7.7%. Nothing on this body's face has a garment within
150mm, so exempting them would cost nothing HERE, but a dress-up export with the
hood up or a high collar would put cloth inside that reach and delete the
eyebrows with neither guard watching: `cover.holes` sees face skin still
painting behind them, and `pierce.py` only ever counts skin coming THROUGH
cloth. So a layer also has to be body-sized, which the copies are and a face
decal is not: 79.9% of the body's height against 2.2% for the largest of those
three decals, and 14.8% for the tallest face primitive of any kind, the face
skin itself. That last one is the margin that binds: the two groups are a factor
of five apart, 79.9% against 14.8%, and the threshold sits in the gap with 3.4
times' clearance above the face skin. That is `cover.WORN` and `cover.SPAN`, and
`worn_layers` reads both off the file -- the first from the base colour texture the renderer itself
samples, the second from POSITION.

**Where the rule has no headroom is the other direction.** 0.50 is a long way
above this export's 23.8% and 6.3% because a camisole and shorts leave most of
the body copy transparent. Inner wear that covers the copy instead, a
long-sleeved top or a bodysuit, reads at or above 0.50, falls back to the
first-surface rule, and brings back the defect this module was written for: by
the measurement above, 765 triangles of torso left in place and the cardigan at
171 pixels of 150. That failure is visible rather than silent, because skin
through cloth is what `pierce.py` counts, so the gate would stop it. Fixing it
would need a second signal; lowering the threshold walks back towards the
decals. `SPAN` is the opposite, with room to spare: a decal has to reach half
the tallest skin primitive, and the tallest decal here, eyeliner at 2.2%, is
twenty-three times short of it.

Only triangles with all three corners covered are cut, so a triangle straddling a
hem keeps its skin. Vertices are never removed and never renumbered: the
primitive's index accessor is the only thing rewritten, so JOINTS_0, WEIGHTS_0,
TEXCOORD_0, NORMAL and every morph target still index what they were authored
against. It also means the before and after models have the same vertex array
and therefore the same camera framing, which is what makes the guard below able
to compare two renders pixel for pixel.

## 4. Two guards, pulling opposite ways

Cut too little and the body still comes through, which `pierce.py` counts. Cut
too much and a hole opens where the garment moves off the skin, which nothing
measured before this: the R2 export's neck gap was caught by a person looking at
a screenshot. `cover.holes` is that guard. It renders before and after over the
same frames and views the clipping gate uses and counts the pixels that had paint
and now have background.

**No single threshold satisfies both.** Sweeping the first criterion's margin,
measured 2026-09-10 against that criterion:

| margin | triangles cut | face cut | cardigan @ t=2.82s | holes at rest | holes at the pose |
|---:|---:|---:|---:|---:|---:|
| 3mm | 9,623 | 66 | 125 / 150 | 14 | 22 |
| 5mm | 8,964 | 50 | 142 / 150 | 8 | 16 |
| 8mm | 8,107 | 22 | **258 / 150** | 2 | 9 |

The sweep was stopped there. At 8mm the neck has almost stopped being cut and the
cardigan is already back over its limit, so the two guards cross with neither of
them satisfied. So the margin was replaced by a loop: cut, measure, and restore
the triangles that turned a pixel to background. The cut set only shrinks, so it
terminates; running out of rounds is reported as `converged: False` rather than
passed off.

Two things had to be right for the loop to converge on the right answer, and each
was wrong first:

- **The guard has to read texture alpha, not the flat part map.** Most of both
  inner layers paints nothing at all, and a part map has no alpha to consult. Read
  off the part map, deleting a transparent triangle looks like a hole, the loop
  restores it, and the camisole goes back on the hoodie: 186 pixels, two black
  patches, visible in `cover-0910-patch-before.png`.
- **It has to test containment, not the bounding box.** A box says a triangle
  passes near the pixel; only the barycentric coordinates say it covered it.
  Measured both ways on the export: the box restores 729 triangles against 330,
  leaves 366 triangles in each inner layer against 234, and the cardigan reads
  174 pixels at the failing pose against 48. Both converge in two rounds with no
  holes, so convergence is not what catches this.

## 5. Where it lands

`dressup.prepare` is the order a fresh export goes through: `refit.py` first,
because the body pool it measures shed against is the manifest's skin and
cutting that skin first would hand it a pool with new holes in it, then
`cover.trim` over the 41 frames `motion.sample_poses` yields -- rest plus four
per clip across the ten clips the gate scores. On the export, 409 seconds,
converged in two rounds (8,098 lost pixels and 605 triangles restored in the
first, 0 lost in the second):

| primitive | triangles | cut |
|---|---:|---:|
| `Body (merged).baked(copy).baked[0]` | 4,139 | 560 |
| `Face (merged)(Clone).baked.baked[3]` | 4,232 | 48 |
| `InnerTop.baked[0]` | 5,970 | 5,666 |
| `InnerBottom.baked[0]` | 5,970 | 5,666 |

11,940 triangles of 31,009. `FaceMouth` keeps all 1,696 of its own: under the
first criterion it lost 58, and those 58 are how the jaw went with them.

Zero lost pixels in the second round is the hole guard's own verdict on all 41
frames and all three views: nothing that had paint has background.

The clipping gate on that file, against the same ten clips, with the two changes
`pierce-0910.md` describes also in place:

| part | the export | after the cull | limit |
|---|---:|---:|---:|
| `Outfit_Cardigan` | **755px, 5.03x** | 147px, 0.98x | 150 |
| `Acc_Glasses` | 51px, 0.85x | 51px, 0.85x | 30, waived to 60 |
| `Outfit_Shoes` | 19px, 0.37x | 4px, 0.08x | 52 |

Every clip passes, and the worst of them is `playFingers` at t=1.8s. **The margin
there is three pixels.** It is a pass on the gate's own terms and it is not a
comfortable one; section 6 is what those pixels are and why nothing in this
module reaches them.

The cardigan's worst frame moved from `modelPose` t=2.82s to `playFingers`
t=1.8s. The arm condition alone does not do this: on the untrimmed export it
leaves the cardigan at 5.03x. The cull is what moves it.

`cover-0910-patch-before.png` and `cover-0910-patch-after.png` are the same
frame at the chest, before and after. The rest pose is unchanged to the eye
(`cover-0910-rest-pair.png`, before on the left).

## 6. What the cull cannot reach

The after image still shows scattered dark speckles on the chest where the
export had two solid black patches, and they are the camisole. They are the skin
the loop is required to keep: the 605 triangles the hole guard put back because
deleting them turned a pixel to background at some frame, plus the triangles the
rest-pose criterion never called covered at all.

That is the two guards in direct conflict rather than a tuning failure. A
triangle that the hoodie covers at rest and uncovers when the hem lifts cannot
be both cut and kept, and whichever way it goes one of the two guards is right
about it. What decides it is how the garment fits at those poses, which no
amount of culling reaches, and it is why the remaining margin is three pixels
rather than a hundred. Closing it means fitting this hoodie to this body, which
is the work section 2 declined for the whole class.

Two other things this does not catch, stated rather than measured away: a cut
that reveals another opaque surface instead of the background is invisible to
the hole guard -- that is exactly the defect section 3 describes, and the head
camera in `cover_test` is the only thing watching for it -- and both guards only
ever see the 41 frames they are given.

## 7. The glasses

`Acc_Glasses` reads 51 pixels against a limit of 30 and is not a defect: the
temple arm passes behind the ear with the ear's skin 8.6 to 11.0mm in front of
it. It is unchanged by everything above, because accessories are deliberately
excluded from the cloth set for the same geometry in the other direction:
counting glasses as cover would delete the ear behind them. What it got instead
is a declared, reasoned waiver, in `pierce-0910.md`.

## 8. Shipping it, and the false regression on the way

`public/avatar/vroid-studio-dressup.vrm` is now the output of
`dressup.prepare`. The pre-cull file is `6ae5189:public/avatar/vroid-studio-dressup.vrm`
and both steps are recorded in the manifest's `source.derived_from`.

`cover-0910-ship-rest.png`, `-modelPose.png` and `-dance.png` are the pre-cull
body over the shipped one, each across all four framings the renderer draws by
default plus their silhouettes; `cover-0910-patch-before.png` and `-after.png`
are the chest at the failing frame; `cover-0910-head-pair.png` is the head
camera that the full-body framings cannot resolve, before, after, and the
difference in red. The chest patch is gone in every one, no hole opens at the
neck, the hands or the ankles, and the head camera moves 244 pixels along the
collar's own edge. The 394 that `cover_test` bounds is the same measurement on
the one-pass cut, which is larger because the hole guard has not yet put
anything back.

The cull rewrites each primitive's index accessor IN PLACE. Appending a fresh
one and leaving the old behind is simpler and was what this did first, and it
made the culled body 101,004 bytes LARGER than the export it was cut from:
`glb.rebuild` lays down every bufferView whether anything points at it, so
243,732 bytes of deleted indices shipped to every visitor. In place, the body is
143,284 bytes smaller than the export, and every primitive's index array is
byte-identical to what the appending version produced, so nothing on screen
moved. `test_the_cut_leaves_nothing_behind_in_the_file` counts the accessors
nothing reads, and holds the two the export already carries as the baseline
rather than claiming them.

Overwriting an accessor where it lies is right for this export and wrong for
three other layouts glTF allows, because what is replaced is the accessor's
whole bufferView starting at byte zero. An index accessor with no bufferView at
all means zeros and has nothing to write into; one that starts partway into its
view would read from its own offset into an array laid down at zero; and a view
a second accessor shares loses that accessor's bytes. The guard originally
counted readers of the ACCESSOR, which all three of those pass. Counting users
of the VIEW is the right question and has to be asked of more than the accessor
list: a sparse accessor's index and value blocks each name a view, and an
embedded image is one, so a morph target sharing the view was overwritten with
nothing raised until `_view_users` went looking there too. Both files that
go through this module today have none of them, every index accessor owning its
own view at offset zero, and
`test_the_bodies_that_go_through_this_module_take_the_cheap_path` asserts that
so the extra conditions cannot quietly send the whole export back down the
appending path. They are here because `dressup.py` is the entry for a body
exported by a tool this repo does not control, and the failure mode is a mesh
that reads as garbage with no error raised.

An index-only edit should leave everything else measured on this body alone, and
that was checked rather than assumed, twice:

- All 17 primitives compared attribute by attribute. Every POSITION, NORMAL,
  TEXCOORD_0, JOINTS_0, WEIGHTS_0 and morph target is byte-identical, and so is
  every node transform, so `rigSha` cannot have moved. 31,009 triangles to
  19,069.
- `springsim.ts` run on the old body and on the body that ships wrote
  byte-identical clearance, down to the last digit of every crown and depth,
  differing only in the paths each was told about. `clearance-0910-shipped.log`
  is that run, and it names the sha256 of the file it measured, because an
  earlier run of the same check measured a body produced by a cull rule that was
  replaced before anything shipped.

The first attempt at that second check said the opposite, and the reason is a
defect in this repo rather than in the body. Every `*.simulated.gen.ts` carries
a "Regenerate:" line, and the line it carried did not name `--family`, which
defaults to `vroid-sample-b`. The pans and framings a run measures against come
from `familyClearance(family)`, so following this file's own instructions
measured the dress-up body against another family's pans: `dance`'s crown read
1.7185 against the committed 1.7211 and its waist-up 1.7095 against 1.7008. A
2.6mm move on a body whose vertices had not changed at all is exactly what a
real regression looks like, and the only thing that separated them was running
the old body through the same wrong command and getting the same wrong answer.

`writeClearance` now always names the family, and
`springsim.rigid.test.ts` reads the emitted line. The three files whose command
was wrong were regenerated with their own family named, and every number in all
three came back identical to what was committed: the diffs are two lines each,
the command and `producedBy`. That is also the strongest evidence the cull
changed nothing, since two of the three bodies were not touched at all and the
third is the one that was.

Out of scope, found while running that test and left alone: `npx vitest run
scripts/avatar/springsim.rigid.test.ts` passes every test and still exits 1 on
one `[vitest-worker]: Timeout calling "onTaskUpdate"`. It is not from this work.
Reverting both changes to that file and to `springsim.ts` and running it exactly
as HEAD has it reproduces the same one error and the same exit 1. No workflow
runs vitest, so nothing is red because of it.

`vroid-sample-b.pink.simulated.gen.ts` keeps its old line. Its family is the
default, so the command it carries already regenerates it correctly; the run to
add the flag was stopped after it went 45 minutes without finishing a clip, and
paying that to change one comment line was not worth blocking on.
