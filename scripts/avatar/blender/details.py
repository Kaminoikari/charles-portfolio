"""The two small black bows on the front of the skirt.

Measured: at y=0.83 the skirt's surface is about 150mm out from the axis, so a
bow sitting at x=±0.085 has to be at z=-0.132 to rest on the cloth rather than
inside it. The loops open sideways and stand slightly proud of the cloth. Twisting them the
way the waist sash is twisted made each one collapse into a crescent, because at
this size the twist eats the whole loop.
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit  # noqa: E402

OUT = sys.argv[-1]

BOW_Y = 0.828

kit.reset()
band = kit.profile('smallbow', 0.020, 0.0026)
band.hide_render = True

made = []
for x, z in ((-0.085, -0.132), (0.085, -0.132)):
    for lobe in (-1, 1):
        made.append(kit.to_mesh(kit.sweep(f'bow{x:.3f}{lobe}', [
            (x, BOW_Y, z),
            (x + lobe * 0.016, BOW_Y + 0.019, z - 0.010),
            (x + lobe * 0.034, BOW_Y, z - 0.014),
            (x + lobe * 0.016, BOW_Y - 0.019, z - 0.010),
        ], band, cyclic=True)))
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    knot = bpy.context.object
    knot.name = f'knot{x:.3f}'
    knot.scale = (0.010, 0.006, 0.009)
    kit.place(knot, (x, BOW_Y, z - 0.004))
    made.append(kit.to_mesh(knot, smooth=1))

kit.export(made, OUT)
