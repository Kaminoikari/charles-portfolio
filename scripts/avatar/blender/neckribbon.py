"""The black ribbon at the collar: a band round the throat, a knot, two ties.

The parametric version put a black bow at y=1.19, down on the chest. The
reference ties it at the collar, on top of the white frill, which is a different
read entirely: it frames the neck instead of decorating the bust.

Measured: the throat is 53mm in radius at y=1.26 and the white collar frill sits
at y=1.229 to 1.255, so the band goes round at y=1.256 with 5mm of clearance. The
ties fall down the front of the chest, moving outward as they go, because the
camisole's own surface reaches z=-0.123 and a tie hanging straight down from the
throat would be inside it.

The first build of this read as a black moustache. The cause was width, not
placement: a 9.5mm strip seen from the front is four pixels of a 700-pixel
render, so the loops showed as an outline and the ties as hairlines. The strips
are now 14mm and the ties run 30mm longer, which is what the reference sheet
shows at this scale -- its tails are about 4% of the body's width, and 9.5mm on
a 300mm shoulder span is 3%.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit  # noqa: E402

OUT = sys.argv[-1]

BAND_Y = 1.256
BAND_R = 0.058

kit.reset()
band = kit.profile('neckband', 0.014, 0.0026)
tie = kit.profile('necktie', 0.0130, 0.0026)
band.hide_render = tie.hide_render = True

made = [kit.to_mesh(kit.sweep('collarband', [
    (0.0, BAND_Y, -BAND_R),
    (BAND_R, BAND_Y + 0.002, 0.0),
    (0.0, BAND_Y + 0.004, BAND_R),
    (-BAND_R, BAND_Y + 0.002, 0.0),
], band, cyclic=True))]

for side in (-1, 1):
    made.append(kit.to_mesh(kit.sweep(f'lobe{side}', [
        (0.0, BAND_Y - 0.004, -BAND_R - 0.002),
        (side * 0.024, BAND_Y + 0.014, -BAND_R - 0.020),
        (side * 0.042, BAND_Y - 0.004, -BAND_R - 0.012),
        (side * 0.023, BAND_Y - 0.022, -BAND_R - 0.020),
    ], band, cyclic=True, tilt=[0.0, side * 0.5, side * 1.2, side * 1.9])))

    made.append(kit.to_mesh(kit.sweep(f'necktie{side}', [
        (side * 0.007, BAND_Y - 0.012, -BAND_R - 0.006),
        (side * 0.013, 1.222, -0.086),
        (side * 0.010, 1.190, -0.112),
        (side * 0.016, 1.150, -0.126),
    ], tie, tilt=[0.0, side * 0.2, side * 0.1, side * 0.3])))

bpy.ops.mesh.primitive_cube_add(size=1.0)
knot = bpy.context.object
knot.name = 'neckknot'
knot.scale = (0.019, 0.012, 0.015)
kit.place(knot, (0.0, BAND_Y - 0.002, -BAND_R - 0.006))
made.append(kit.to_mesh(knot, smooth=2))

kit.export(made, OUT)
