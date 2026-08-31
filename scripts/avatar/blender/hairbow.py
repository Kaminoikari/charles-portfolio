"""The mint ribbons tying the twintails, one on each side of the head.

Measured off the model: the top 50mm of each twintail centres on x=±0.047,
y=1.463, z=+0.092, just below the buns, which start at y=1.483. Putting the tie
at z=+0.03 instead, which is where the ear is, hung the whole ribbon down the
side of the face. The loops open forward and
back rather than outward, because on the side of a head there is nowhere outward
to go: an outward loop is inside the skull within 20mm.

Each side is a wrap around the gathered hair, two loops, and a short tail.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit  # noqa: E402

# These sit on the side of the head and are perhaps forty pixels across in the
# comparison renders. At the default sweep resolution they cost 1,928 triangles
# to draw a shape that is a few pixels wide; halving it changes nothing anyone
# can see. (This was once about paying for the boots out of a triangle budget.
# The budget is gone as of 2026-08-31 and the value stays anyway, because
# spending 1,928 triangles on forty pixels was never the good part.)
RES = 4

OUT = sys.argv[-1]

TIE_Y = 1.450
TIE_X = 0.072
TIE_Z = 0.086
WRAP_R = 0.030

kit.reset()
band = kit.profile('hairband', 0.019, 0.0030)
thin = kit.profile('hairtail', 0.016, 0.0028)
band.hide_render = thin.hide_render = True

made = []
for side in (-1, 1):
    x = side * TIE_X
    # the wrap: a ring round the gathered hair
    made.append(kit.to_mesh(kit.sweep(f'wrap{side}', [
        (x, TIE_Y + WRAP_R * 0.55, TIE_Z),
        (x, TIE_Y, TIE_Z + WRAP_R),
        (x, TIE_Y - WRAP_R * 0.55, TIE_Z),
        (x, TIE_Y, TIE_Z - WRAP_R),
    ], band, cyclic=True, resolution=RES)))

    for lobe, reach in (('fwd', -1), ('back', 1)):
        made.append(kit.to_mesh(kit.sweep(f'lobe{side}{lobe}', [
            (x, TIE_Y, TIE_Z + reach * 0.016),
            (x + side * 0.010, TIE_Y + 0.019, TIE_Z + reach * 0.036),
            (x + side * 0.004, TIE_Y, TIE_Z + reach * 0.050),
            (x + side * 0.010, TIE_Y - 0.019, TIE_Z + reach * 0.036),
        ], band, cyclic=True, resolution=RES, tilt=[0.0, reach * 0.5, reach * 1.1, reach * 1.7])))

    made.append(kit.to_mesh(kit.sweep(f'hairtail{side}', [
        (x, TIE_Y - 0.012, TIE_Z + 0.002),
        (x + side * 0.010, TIE_Y - 0.040, TIE_Z - 0.014),
        (x + side * 0.004, TIE_Y - 0.068, TIE_Z + 0.002),
        (x + side * 0.014, TIE_Y - 0.096, TIE_Z - 0.014),
    ], thin, resolution=RES, tilt=[0.0, side * 0.3, side * 0.1, side * 0.45])))

kit.export(made, OUT)
