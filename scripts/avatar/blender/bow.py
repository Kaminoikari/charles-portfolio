"""The mint sash: two loops at the waist, a knot, and two tails down the skirt.

Height moved when the outfit did. Against the hand-built one-piece dress the bow
was tied under the bust at y=1.065, measured off the reference sheet: its centre
sat 0.661 of the way up from the sole. The MellowHeart outfit is a bodice and a
skirt with a sash between them, and its seam -- the vendor Belt, y 0.950 to
1.002 -- is where a bow on this body has something to be tied to. Tied under the
bust instead it would float on the bodice with a band 80mm below it doing the
same job. So BOW_Y is the middle of that band.

The bow exists at all because the vendor Belt cannot do goal item 8. It was
measured: a 27mm sash plus a 104x25x13mm flat front plate, no loops, no knot,
no tails. The two together are what the reference shows -- a band with a bow
tied on it.

Why the loops are cones. The first version swept a ribbon around a closed path,
on the reasoning that a ribbon is a strip following a curve. It is, but the
strip was 34mm wide and the path only enclosed 48mm, so the hole shut and both
loops rendered as rounded mint blobs -- and this renderer is unlit, so a fold
inside a blob has nothing to show it. What survives with no light is the
outline. The reference's loops are not rings anyway: each is a flat panel
narrow where it meets the knot and flaring to a straight outer edge, which is a
truncated cone squashed along the viewing axis. That silhouette reads as a tied
loop without needing a single shaded pixel. How narrow the knot end stays is
LOOP_WAIST, measured off the reference.

The two are deliberately unequal. A hand-tied bow never comes out symmetric,
and two identical wedges at mirrored angles read as a manufactured part.

The knot sits in FRONT of both, not between them. Between them it was 21mm
behind the loops' own front surface and simply never visible; now its front
face stands KNOT_PROUD clear of theirs. It is a separate material for the same
reason the cones replaced the ring: with no light, a knot the colour of the
loops it divides is not a knot.

OUTLINE is the DRESSED front surface, sampled off the built model. It has been
wrong once and the way it went wrong is the reason the z placement below is now
derived rather than typed: the previous list said 0.132 to 0.137, measured
before the imported outfit was fitted and hugged, and the bow inherited a 15mm
error on top of its own 14mm standoff, so the whole thing hung 27mm clear of
the sash and touched nothing. Four fixed cameras cannot see that; only a side
view can.

These values are the running maximum of Outfit_Bottom, Acc_Belt_Waist and
Outfit_Top, sampled per triangle over |x| < 40mm on the shipped model. The
running maximum, rather than the surface at each height, is so the bow rides
the silhouette instead of dipping into whichever inner layer happens to be
nearest at one height. build.py re-measures the finished gap and stops the
build if it drifts again -- see the Acc_Ribbon_Waist guard there.
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit  # noqa: E402

OUT = sys.argv[-1]

BOW_Y = 0.976

# (height, distance from the axis to the dressed front surface).
OUTLINE = [(1.02, 0.113), (0.98, 0.119), (0.86, 0.119), (0.82, 0.121),
           (0.78, 0.128)]
# Air left between the back of the bow and the cloth. Small on purpose: the
# bow is tied ON the sash, so anything that reads as a gap is the defect.
CLEAR = 0.002
# The knot is defined by where its two faces have to be, and its depth falls
# out of that. Writing a depth AND an offset is what put a 6mm gap between it
# and the loops in the side view: the loops are shallower at the pinch, where
# the knot actually sits, than at the outer edge the offset was measured from.
# KNOT_PROUD is how far its front stands beyond the loops' front-most point --
# that step, with its darker material, is what makes it read as a knot in a
# renderer with no light. KNOT_EMBED is how far its back sinks into the loops
# at the pinch, so the two never separate.
KNOT_PROUD = 0.012
KNOT_EMBED = 0.003
# What one level of Catmull-Clark leaves of a cube's extent. Measured, not
# derived: scale (20, 18, 30)mm came out 16.8 x 15.1 x 25.2mm.
SUBSURF_SHRINK = 0.84

# How far above the sash's own midline the bow is tied. The reference's bow is
# not centred on the band: the band runs y 0.950 to 1.002 and the loops sit
# mostly above it, on the white bodice, with only their lower edges crossing
# the mint. Tied on the midline instead, the lower half of each loop lands on
# a band of exactly its own colour and stops existing.
BOW_LIFT = 0.016
# Per loop: (how far the wedge reaches from the knot, half-height of its outer
# edge, how far its centreline rises above horizontal). Wearer's left is the
# larger one.
LOOPS = {-1: (0.070, 0.032, math.radians(6.0)),
         1: (0.058, 0.028, math.radians(10.0))}
# Depth as a fraction of the outer edge's half-height. A ribbon loop is cloth,
# so it is nearly flat; leaving it round is what made the first version a ball.
LOOP_FLAT = 0.26
LOOP_SIDES = 14
# The knot end is truncated, not brought to a point: in the reference the loop
# is still about this fraction of its outer height where it disappears into the
# knot, and a wedge run all the way to a point reads as a fin.
LOOP_WAIST = 0.45
# Where the wedges are pinched, as a gap either side of the centreline.
LOOP_PINCH = 0.006


def surface(y):
    """How far forward the cloth is at that height, as a positive distance."""
    if y >= OUTLINE[0][0]:
        return OUTLINE[0][1]
    if y <= OUTLINE[-1][0]:
        return OUTLINE[-1][1]
    for (ya, ra), (yb, rb) in zip(OUTLINE, OUTLINE[1:]):
        if yb <= y <= ya:
            return ra + (rb - ra) * (ya - y) / (ya - yb)


def stand(y, depth):
    """Centre z for something `depth` thick resting on the cloth at height y.

    Everything in this file is placed through here rather than by adding a
    hand-picked offset to the surface. The offsets were what let the bow drift
    off the body without anything noticing: each was individually plausible and
    they accumulated. Asking for a thickness instead means the back of the part
    lands on the cloth by construction.
    """
    return -(surface(y) + CLEAR + depth / 2.0)


kit.reset()
tail_band = kit.profile('tail', 0.026, 0.0030)
# The tails leave the knot narrow and hang wider, the way cloth under its own
# weight does. Constant width is what made them read as two straps.
tail_taper = kit.taper('tail_flare', [0.85, 1.05, 1.25, 1.40])
tail_band.hide_render = tail_taper.hide_render = True

made = []
knot_y = BOW_Y + BOW_LIFT
# Filled in by the loop below: the loops' front-most point, and their front
# surface where the knot meets them. The knot is placed against these rather
# than against the cloth, because what has to read is the step between knot and
# loop, not either one's distance from the dress.
loop_front = 0.0
loop_pinch_front = 0.0

for side, (reach, half, rise) in LOOPS.items():
    bpy.ops.mesh.primitive_cone_add(vertices=LOOP_SIDES,
                                    radius1=half * LOOP_WAIST,
                                    radius2=half, depth=reach)
    loop = bpy.context.object
    loop.name = f'loop{side}'
    # Local +Z runs apex-to-base. Turning about Blender's +Y (the model's own
    # depth axis) swings it into the model's xy plane, so local Y stays the
    # depth axis and scaling it is what flattens the panel.
    loop.scale = (1.0, LOOP_FLAT, 1.0)
    depth = 2.0 * half * LOOP_FLAT
    centre = stand(knot_y, depth)
    loop_front = min(loop_front, centre - depth / 2.0)
    loop_pinch_front = min(loop_pinch_front,
                           centre - half * LOOP_WAIST * LOOP_FLAT)
    kit.place(loop, (side * (LOOP_PINCH + math.cos(rise) * reach / 2.0),
                     knot_y + math.sin(rise) * reach / 2.0, centre),
              rotation=(0.0, side * (math.pi / 2.0 - rise), 0.0))
    made.append(kit.to_mesh(loop))

# The tails leave the knot together and open out as they fall. They have to
# keep opening faster than the taper widens them: run closer than this and the
# two strips touch somewhere down the skirt and merge into one mint slab, which
# is the same colour-on-colour failure the loops had against the band.
TAIL_THICK = 0.0030 * 1.40  # the profile at its widest taper stop
for side, drop in ((-1, 0.790), (1, 0.812)):
    tail = kit.sweep(f'tail{side}', [
        (side * 0.013, knot_y - 0.020, stand(knot_y - 0.020, TAIL_THICK)),
        (side * 0.028, 0.955, stand(0.955, TAIL_THICK)),
        (side * 0.030, 0.875, stand(0.875, TAIL_THICK)),
        (side * 0.042, drop, stand(drop, TAIL_THICK)),
    ], tail_band, tilt=[0.0, side * 0.35, side * 0.15, side * 0.5],
        taper_object=tail_taper)
    made.append(kit.to_mesh(tail))

bpy.ops.mesh.primitive_cube_add(size=1.0)
knot = bpy.context.object
knot.name = 'knot'
knot_back = loop_pinch_front + KNOT_EMBED
knot_face = loop_front - KNOT_PROUD
knot.scale = (0.020, (knot_back - knot_face) / SUBSURF_SHRINK, 0.030)
kit.place(knot, (0.0, knot_y, (knot_back + knot_face) / 2.0))
# One level of subdivision, not two. Two rounded the box into a bead, and the
# reference's knot is a short upright band with flat sides: cloth pulled tight,
# not a button.
made.append(kit.to_mesh(knot, smooth=1))

kit.export(made, OUT)
