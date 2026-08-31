"""Convert the MellowHeart Dream FBX into a glTF this pipeline can read.

Blender does one job here and it is the job it is good at: reading a format
numpy cannot and writing one it can. No fitting, no retargeting, no colour --
those happen in outfit.py against the exported file, where the model's own
skeleton is available and the transform can be checked numerically.

The vendor's geometry ships through at full density. There was a 40,000
triangle cap and a per-mesh Decimate table here until 2026-08-31; the cap was a
project constraint rather than a limit of any consumer, and it was lifted. What
it cost while it stood is worth recording, because it is the reason to be slow
about reintroducing one: COLLAPSE shreds a thin strap long before it dulls a
panel, so the 27mm sash melted into a smear at 700 triangles and the boot's toe
box flattened at 2,600, and every new accessory had to be paid for by taking
triangles off something already on the model.

Two things still have to happen before the export or it fails or lies:

  The mesh DATA is renamed to match the object. glTF writes the mesh datablock's
  name, and Blender's FBX importer leaves those as whatever the vendor modelled
  under -- the first export came out as Circle.029 and RetopoFlow.008, which is
  unusable as a part name downstream.

  Shape keys are exported, which is only possible because nothing decimates any
  more: Blender refuses to apply a Decimate modifier to a mesh that has them,
  silently leaving the mesh at full density if the error is swallowed. Six of
  the eight pieces carry them, eleven keys under seven names. All but one are
  the vendor's per-avatar body-shape corrections, and their deltas are in the
  vendor's basis: they mean nothing until outfit.py has put them through the
  same fit as the garment itself. The exception, `Side adjustment`, is a key the
  vendor named and never authored -- every delta in it is exactly zero -- and
  build.py drops it rather than ship a slider that does nothing.
"""
import os
import sys

import bpy

FBX = '/Users/charles/Downloads/MellowHeart_Dream1.05/FBX'
OUT = sys.argv[-1]
WHICH = sys.argv[-2]

# The meshes taken from each source file. The two files carry two armatures
# with the same bone names, so they are converted and retargeted separately;
# importing both into one scene would give every bone a duplicate and the
# name-keyed retarget would pick whichever Blender numbered first.
#
# This is a keep-list, not a budget. Five of the vendor's thirteen meshes are
# left behind because the reference does not show them, not because they cost
# anything: Pouch, Underwear, Outer_Pin, Outer_Ribbon and Outer_tag. Adding one
# is a decision about what Milfy wears, so it belongs to the goal's appearance
# checklist rather than to this file.
SETS = {
    'inner': ('Milfy_Inner.fbx', ('Inner', 'Skirt', 'Shoes', 'Socks',
                                  'Main_Ribbon', 'Belt', 'Leg_belt')),
    'outer': ('Milfy_Outer.fbx', ('Outer',)),
}
SRC = os.path.join(FBX, SETS[WHICH][0])
KEEP = SETS[WHICH][1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)

for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    if obj.name not in KEEP:
        bpy.data.objects.remove(obj, do_unlink=True)

missing = set(KEEP) - {o.name for o in bpy.data.objects if o.type == 'MESH'}
if missing:
    raise SystemExit(f'{SETS[WHICH][0]} 裡沒有 {sorted(missing)}，'
                     '廠商改了網格名就會靜默漏件')

for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    obj.data.name = obj.name
    obj.data.calc_loop_triangles()
    sk = obj.data.shape_keys
    keys = [] if sk is None else [k.name for k in sk.key_blocks if k != sk.reference_key]
    print(f'  {obj.name:<14} {len(obj.data.loop_triangles):>6} tris  '
          f'{len(obj.vertex_groups)} groups  {len(keys)} shape keys'
          + (f' {keys}' if keys else ''))

# The vendor colours this outfit in the Unity shader: every base texture is a
# greyscale pattern and the hue comes from a mask. Wiring the base map in gives
# the plaid, the lace and the sole tread; the colour is applied downstream as a
# baseColorFactor on named materials, which is where this project keeps colour.
TEXTURE = {
    'Inner': 'Inner_1.png', 'Inner_Sub': 'Inner_sub_1.png',
    # Lace_2 rather than Lace_1. The pack ships two and they are not two
    # patterns, they are the same pattern at two exposures: sampling per
    # triangle over the sock's own UVs, Lace_1 averages 33 of 255 and Lace_2
    # averages 214. Lace is the frill
    # on the sock cuff and the trim on the boot, both white in the reference,
    # and no baseColorFactor can lift a map that dark -- the factor multiplies.
    'Lace': 'Lace_2.png', 'Shoes': 'Shoes_1.png',
    'Sub_Acc': 'Sub_acc_1.png', 'Jewel': 'Jewel_1.png',
    'Underwear': 'Underwear_1.png', 'Outer': 'Outer_1.png',
}

# object -> {vendor material: (our name, base map)}. A garment that has to be a
# different colour from another garment sharing its material needs its own
# material, because colour here is a baseColorFactor and a factor is per
# material. The skirt is the case that forces it: the bodice and the skirt are
# both drawn on the Inner atlas, the bodice half is white and the skirt half is
# a near-black plaid, and the reference's skirt is plain white. Inner_1_2 is
# the pack's plain (unpatterned) variant of the same atlas, so the skirt takes
# that copy and the bodice keeps Inner_1.
#
# Sub_acc_5 for the two belts for the same reason as Lace_2: sampling per
# triangle over the belt's own UVs, Sub_acc_1 averages 57 of 255 and Sub_acc_5
# averages 112.
SPLIT = {
    'Skirt': {'Inner': ('Skirt_Cloth', 'Inner_1_2.png')},
    'Belt': {'Sub_Acc': ('Belt_Acc', 'Sub_acc_5.png')},
    'Leg_belt': {'Sub_Acc': ('Leg_Acc', 'Sub_acc_5.png')},
}
for obj_name, spec in SPLIT.items():
    obj = bpy.data.objects.get(obj_name)
    if obj is None:
        continue
    for slot in obj.material_slots:
        if slot.material is not None and slot.material.name in spec:
            our, png = spec[slot.material.name]
            copied = slot.material.copy()
            copied.name = our
            if copied.name != our:
                raise SystemExit(f'{our} 這個材質名已經有人用了，改名後變成 '
                                 f'{copied.name}，下游是按名字上色的')
            slot.material = copied
            TEXTURE[our] = png
BASE = '/Users/charles/Downloads/MellowHeart_Dream1.05/Texture/Base'
for mat in bpy.data.materials:
    png = TEXTURE.get(mat.name)
    if not png:
        continue
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf is None:
        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL'), None) \
            or nodes.new('ShaderNodeOutputMaterial')
        links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(os.path.join(BASE, png))
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    print(f'  material {mat.name} <- {png}')

bpy.ops.object.select_all(action='SELECT')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True,
    export_yup=True, export_apply=False, export_skins=True,
    export_morph=True, export_materials='EXPORT', export_texcoords=True,
    export_normals=True,
)
print(f'wrote {OUT}')
