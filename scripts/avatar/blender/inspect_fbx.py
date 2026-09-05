"""Report what an FBX actually contains, before anything is done to it.

The garment is rigged to a skeleton that is not ours. Everything downstream --
which bone maps to which, how far apart the two rest poses are, whether the
units even agree -- depends on facts that have to be read off the file rather
than assumed from the vendor's screenshots.
"""
import os
import sys

import bpy

PATH = sys.argv[-1]
# `--map` prints which humanoid bone each armature bone would be taken for,
# through the same resolver the build uses (bonemap.py), before any glb exists.
WANT_MAP = '--map' in sys.argv

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
    if WANT_MAP:
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        import bonemap
        # A glTF-shaped node tree straight from the armature, so the resolver
        # sees the same names and rest positions the export will carry.
        order = list(bones)
        index = {b.name: i + 1 for i, b in enumerate(order)}
        nodes = [{'name': a.name, 'children': [index[b.name] for b in root]}]
        for b in order:
            h = a.matrix_world @ b.head_local
            ph = (a.matrix_world @ b.parent.head_local) if b.parent else h * 0
            # Blender is Z-up; the resolver reads height off Y as glTF does.
            node = {'name': b.name,
                    'translation': bonemap.from_blender([h.x - ph.x, h.y - ph.y, h.z - ph.z])}
            if b.children:
                node['children'] = [index[c.name] for c in b.children]
            nodes.append(node)
        doc = {'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes,
               'skins': [{'joints': list(range(1, len(nodes)))}]}
        target = {name: i for i, name in enumerate(bonemap.VRM_NAMES)}
        mapping = bonemap.resolve(doc, target)
        world = bonemap.humanoid.node_world(doc)
        hips = next((i for i, n in mapping['names'].items() if n == 'hips'), None)
        print('  MAP (bonemap.resolve, generic table + shape, no vendor override)')
        if hips is not None:
            print(f'  axis check: hips world y {world[hips][1][3]:+.3f} (Blender z -> glTF y; height must be here)')
        print(bonemap.table(mapping, doc))

for m in meshes:
    mats = [s.material.name if s.material else None for s in m.material_slots]
    groups = [g.name for g in m.vertex_groups]
    print(f'  MESH {m.name}  verts {len(m.data.vertices)}  tris {len(m.data.loop_triangles)} '
          f'polys {len(m.data.polygons)}')
    print(f'    materials {mats}')
    print(f'    vertex groups ({len(groups)}): {groups[:24]}{" ..." if len(groups) > 24 else ""}')
    print(f'    shape keys {len(m.data.shape_keys.key_blocks) if m.data.shape_keys else 0}')
