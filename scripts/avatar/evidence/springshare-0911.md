# Nine of thirteen bodies could not be simulated at all, and the four that could were measured on 118 copies of the same hair

2026-09-11. With the nearest-vertex query made fast (`springsim-grid-0911.md`),
the thirteen new VRoid bodies were queued to be measured. Nine of them failed in
three seconds with `Error: manifest has no Hair_* part`. Chasing that found one
wrong assumption underneath two different symptoms, and it reached the shipped
clearance too.

## 1. The assumption

glTF lets several primitives of one mesh share a single vertex buffer and differ
only in which triangles they draw and which material they draw them with. Both
of springsim's readers took a primitive's attribute accessor to BE that
primitive's vertices, which is true only on the other layout, one buffer per
primitive.

Every VRoid export in this repo is the first layout, and every body `build.py`
produced is almost entirely the second. Measured on the files:

| body | hair mesh | primitives | distinct POSITION accessors |
|---|---|---|---|
| `AvatarSample_B_webp.vrm` | `Hair001.baked` | 77 | 1 |
| `AvatarSample_C_webp.vrm` | `Hair001.baked` | 118 | 1 |
| `Vivi_webp.vrm` | `Hair001.baked` | 78 | 1 |
| `Sendagaya_Shino_webp.vrm` | `Hair001.baked` | 48 | 1 |
| `mika-milfy-12.vrm` | `Hair001.baked` | 72 | 72 |

That is why it went unnoticed. On `mika-milfy-12`, which is the body the shipped
clearance was measured on, 25 of its 26 parts have one accessor per primitive
and read the same either way. Only its `Face` shares a buffer.

## 2. Two symptoms

**`deriveManifest` could not see hair.** It classifies a primitive as moving
hair when at least `SPRING_DOMINATED` (0.4) of its vertices are driven by a
spring bone. Reading the whole buffer gives every primitive of a mesh the SAME
number, the mesh-wide average of strands and static scalp together, so a mesh
can only go entirely one way:

| body | share, every primitive | derived hair parts |
|---|---|---|
| `Vivi_webp.vrm` | 35.3% | 0 |
| `Vita_webp.vrm` | 35.0% | 0 |
| `AvatarSample_C_webp.vrm` | 44.3% | 1, holding the whole mesh |
| `mika-milfy-12.vrm` | 83.4–88.1% on 14 of 65 | 1, holding those 14 |

Under the threshold the body has no hair and the simulator refuses to run, which
is the nine failures. Over it the whole mesh becomes hair, scalp included.

**`gather` stacked the buffer once per primitive.** Same clip, same body,
counting how many of the vertices it returned sit at a position an earlier one
already had:

| body | part | primitives | gathered | distinct positions | duplicated |
|---|---|---|---|---|---|
| `AvatarSample_B` | Hair | 77 | 729,652 | 6,974 | 99.0% |
| `AvatarSample_B` | Body_Skin | 7 | 57,386 | 6,831 | 88.1% |
| `AvatarSample_B` | Face | 10 | 20,540 | 1,838 | 91.1% |
| `mika-milfy-12` | Hair | 14 | 6,214 | 4,343 | 30.1% |
| `mika-milfy-12` | Face | 10 | 20,540 | 1,838 | 91.1% |

`mika-milfy-12`'s hair at 30.1% is the normal kind of duplication, a vertex
split along a UV seam into two with the same position and different normals.
Those are real and must stay. The 99.0% is the same accessor read 77 times.

## 3. What it is now

A part is the vertices its primitives DRAW: the union of the unique indices in
each primitive's own index list, grouped by attribute accessor, each collected
once. A primitive with no `indices` is non-indexed and draws its buffer in
order, so all of it counts. `deriveManifest` takes its share over the same set.

This is the one definition that is right on both layouts, and it is stricter
than "read the accessor once" would have been: two parts can hold different
primitives of one buffer, and each has to get only its own.

It also excludes buffer vertices that no triangle references. Those exist:
`vroid-studio-dressup`'s `Body_Skin` buffers 2,795 and draws 2,420, and its
`Body_Skin_Inner_Top` buffers 3,295 and draws 298.

**One consequence needed a second fix.** Once the share is per primitive, a
VRoid hair mesh splits: the strands become `Hair`, the static scalp falls to the
`Body_Skin` role. On `mika-pink` that put 40 primitives in that role against the
body mesh's 7, and the canonical `Body_Skin` name was awarded on primitive
count, so the shell that `bodyDepthMm` is measured against became static hair.
Moving strands lie flat against the scalp, so all ten clips read 50mm, the
saturation cap, which is the simulator's way of saying "at least 50". A mesh
that supplies moving hair is now barred from being the body; its leftovers keep
their own name, so they are still skinned and the crown still sees them.

## 4. What it did to the committed measurements

Every committed `*.simulated.gen.ts` regenerated with the command in its own
header and diffed against the tree, ignoring the provenance lines. Full output
in `springsim-grid-0911.log` section 7.

| file | body | result |
|---|---|---|
| `vroid-sample-b.simulated.gen.ts` | `mika-milfy-12.vrm` | **identical** |
| `vrm1-twist-sample.simulated.gen.ts` | `vrm1-twist-sample.vrm` | **identical** |
| `vroid-sample-b.pink.simulated.gen.ts` | `mika-pink.vrm` | 2 of 10 clips |
| `vroid-studio-dressup.simulated.gen.ts` | `vroid-studio-dressup.vrm` | 10 of 10 |

The family the site actually serves is unchanged, to the digit. Nothing but
`bodyDepthMm` moved in the two that did change: no crown, no skirt, no coat, no
jump.

`mika-pink` lost its two worst readings, 29.6 to 28.1 and 48.1 to 26.1. The
48.1 was most of the way to the cap.

`vroid-studio-dressup` went the other way, 9.6 to 16.2 and so on across all ten.
That direction is forced rather than surprising. Its `Body_Skin` had 375 undrawn
vertices in it, at real positions scattered through the body,
x[-0.533, 0.529] y[0.015, 1.409] z[-0.098, 0.100], reaching to y = 1.409 against
the drawn part's 1.593: base-body geometry left under the clothing by the
dress-up export. They were in the collision shell, standing in as its surface.
Taking candidates AWAY from a nearest-vertex query can only increase the
distance it returns, so a shell with phantom vertices in it reads shallower, and
every one of those ten numbers moved the way that predicts. Both changed files
are regenerated in this commit.

## 5. What holds it

`springsim.parts.test.ts`, six tests against three committed bodies chosen
because they are the three layouts: `AvatarSample_B_webp.vrm` shares one buffer
across a mesh, `vroid-studio-dressup.vrm` has undrawn vertices, and
`mika-milfy-12.vrm` gives each primitive its own buffer. The first two tests pin
the fixture's layout as well as the behaviour, so a fixture swapped for one laid
out the other way says so instead of quietly becoming a duplicate of the third.

Six mutations, six red, in `mutations-springshare-0911.log`.

One of them stayed green on its first draft and is written up there rather than
dropped: reverting the share to the whole buffer changed nothing observable,
because the test asserting it used `AvatarSample_B`, whose mesh-wide average is
ABOVE the threshold, so the mesh went entirely to hair either way and the
assertion "some part is called Body_Skin" was satisfied by the body mesh. The
discriminating fact on that same body is that the hair mesh must SPLIT between
roles, and the tightened test pins that its two roles account for all 77
primitives between them. The mutation is red now.

Seven of the nine bodies that could not be simulated now can, so eleven of the
thirteen derive moving hair. The two that still do not are honest rather than
broken: `masc_vroid_webp.vrm` declares 0 spring bones and `fem_vroid_webp.vrm`
declares 1 with 2 joints, so neither has hair that moves to measure.

Full suite: 32 files, 674 tests, all passing, exit 0, in one run.
