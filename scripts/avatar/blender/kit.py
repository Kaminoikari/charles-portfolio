"""Blender-side helpers. Geometry only.

The division of labour is deliberate. Blender is here for the shapes it can make
that a parametric generator cannot: a ribbon lofted along a curve, cloth left to
fall, a surface smoothed by subdivision. It is NOT here to touch the VRM. The
file carries a humanoid map, 56 morph targets, 15 expression groups and eleven
spring-bone chains, and a round trip through any exporter is a chance to lose
them, so the model is never exported from Blender at all.

What leaves Blender is a bare .glb of new meshes: positions, normals, UVs,
triangles. Skin weights are assigned back in weld.py from the body underneath,
by the same nearest-point rule already used for the collar and the bandages, and
the result is attached to the untouched original.

Axes: Blender is Z-up, glTF is Y-up, and the exporter converts. So a point
written here as (x, y, z) arrives in the VRM as (x, z, -y). place() takes VRM
coordinates and does that conversion, so every script can be written against the
measurements taken from the model.
"""
import bpy
import mathutils


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def to_blender(p):
    """A VRM-space point, in Blender's axes."""
    x, y, z = p
    return (x, -z, y)


def place(obj, p, rotation=(0.0, 0.0, 0.0)):
    obj.location = to_blender(p)
    obj.rotation_euler = rotation
    return obj


def profile(name, width, thickness):
    """A flat rectangle to sweep along a curve: the cross-section of a ribbon."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '2D'
    spline = data.splines.new('POLY')
    spline.points.add(3)
    half_w, half_t = width / 2.0, thickness / 2.0
    for i, (u, v) in enumerate([(-half_w, -half_t), (half_w, -half_t),
                                (half_w, half_t), (-half_w, half_t)]):
        spline.points[i].co = (u, v, 0.0, 1.0)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def taper(name, scales):
    """A curve that scales a sweep's bevel along the sweep.

    Blender reads the taper curve's height at the swept curve's own parameter,
    and the taper's x IS that parameter's axis -- not bookkeeping. Measured on
    a straight sweep with scales [1, 1, 4, 4] and a 20x2mm profile: laid out at
    x = 0, 1/3, 2/3, 1 the section measures 2.0, 5.0, 8.0mm thick at the start,
    middle and end, so the scale really is 1.0, 2.5, 4.0; the same four scales
    at x = 0, 0.90, 0.95, 1.0 measure 2.0, 2.0, 8.0, because all the growth is
    crammed into the last tenth of the sweep. So `scales` is laid out evenly
    across 0..1 here, and a caller that wants an uneven ramp has to say so with
    more stops, not by moving the x values.

    A ribbon that hangs wider at the bottom than where it leaves the knot needs
    this, and a constant-width strip is what made the tails read as webbing.
    """
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '2D'
    spline = data.splines.new('POLY')
    spline.points.add(len(scales) - 1)
    step = 1.0 / max(len(scales) - 1, 1)
    for i, s in enumerate(scales):
        spline.points[i].co = (i * step, s, 0.0, 1.0)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def sweep(name, points, bevel, cyclic=False, resolution=8, tilt=None,
          taper_object=None):
    """A Bezier curve through `points` (VRM space), swept with `bevel`."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = resolution
    data.bevel_mode = 'OBJECT'
    data.bevel_object = bevel
    data.taper_object = taper_object
    data.use_fill_caps = True
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = spline.bezier_points[i]
        bp.co = to_blender(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
        if tilt:
            bp.tilt = tilt[i]
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return obj


def to_mesh(obj, smooth=0):
    """Freeze a curve or modifier stack into real geometry."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    if smooth:
        mod = obj.modifiers.new('smooth', 'SUBSURF')
        mod.levels = mod.render_levels = smooth
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # weld.pieces keys on the exported mesh's name, and a primitive added by an
    # operator carries its own data name ('Cube') no matter what the object is
    # called. Anything that wants to be picked out of the .glb by name has to
    # have the name on the data.
    obj.data.name = obj.name
    return obj


def export(objects, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB',
                              use_selection=True, export_yup=True,
                              export_apply=True, export_normals=True)
    total = sum(len(o.data.vertices) for o in objects)
    print(f'KIT exported {len(objects)} object(s), {total} vertices -> {path}')
    return total
