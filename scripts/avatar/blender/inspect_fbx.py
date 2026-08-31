"""Report what an FBX actually contains, before anything is done to it.

The garment is rigged to a skeleton that is not ours. Everything downstream --
which bone maps to which, how far apart the two rest poses are, whether the
units even agree -- depends on facts that have to be read off the file rather
than assumed from the vendor's screenshots.
"""
import sys

import bpy

PATH = sys.argv[-1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=PATH)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']

print(f'FILE {PATH}')
print(f'  unit scale {bpy.context.scene.unit_settings.scale_length}')
for a in arms:
    bones = a.data.bones
    print(f'  ARMATURE {a.name}  {len(bones)} bones  scale {tuple(round(v, 4) for v in a.scale)}')
    root = [b for b in bones if b.parent is None]
    print(f'    roots: {[b.name for b in root]}')
    for b in list(bones)[:60]:
        h = a.matrix_world @ b.head_local
        print(f'    {b.name:<34} head ({h.x:+.4f},{h.y:+.4f},{h.z:+.4f})')
    if len(bones) > 60:
        print(f'    ... {len(bones) - 60} more')

for m in meshes:
    mats = [s.material.name if s.material else None for s in m.material_slots]
    groups = [g.name for g in m.vertex_groups]
    print(f'  MESH {m.name}  verts {len(m.data.vertices)}  tris {len(m.data.loop_triangles)} '
          f'polys {len(m.data.polygons)}')
    print(f'    materials {mats}')
    print(f'    vertex groups ({len(groups)}): {groups[:24]}{" ..." if len(groups) > 24 else ""}')
    print(f'    shape keys {len(m.data.shape_keys.key_blocks) if m.data.shape_keys else 0}')
