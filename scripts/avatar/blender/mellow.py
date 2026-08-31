"""Convert the MellowHeart Dream FBX into a glTF this pipeline can read.

Blender does one job here and it is the job it is good at: reading a format
numpy cannot and writing one it can. No fitting, no retargeting, no colour --
those happen in mellow.py against the exported file, where the model's own
skeleton is available and the transform can be checked numerically.

Two things have to happen before the export or it fails or lies:

  Shape keys are removed first. They are the vendor's per-avatar body-shape
  corrections, they are meaningless once the garment is refitted to a different
  body, and Blender refuses to apply a Decimate modifier to a mesh that has
  them -- silently leaving the mesh at full density if the error is swallowed.

  The mesh DATA is renamed to match the object. glTF writes the mesh datablock's
  name, and Blender's FBX importer leaves those as whatever the vendor modelled
  under -- the first export came out as Circle.029 and RetopoFlow.008, which is
  unusable as a part name downstream.

  Decimation is per-mesh and unequal, because the budget is. The goal caps the
  finished model at 40,000 triangles; the body, face and hair spend 23,356 of
  that, and the eight pieces taken from this outfit ship 77,490 triangles
  between them. The ratios below are chosen by what survives simplification: a
  shoe is a small compact object with an enormous share of its triangles in
  laces, and a skirt's silhouette is its whole contribution.
"""
import os
import sys

import bpy

FBX = '/Users/charles/Downloads/MellowHeart_Dream1.05/FBX'
OUT = sys.argv[-1]
WHICH = sys.argv[-2]

# mesh -> triangles to aim for, per source file. The two files carry two
# armatures with the same bone names, so they are converted and retargeted
# separately; importing both into one scene would give every bone a duplicate
# and the name-keyed retarget would pick whichever Blender numbered first.
#
# Shoes and Socks were raised to 4,400 and 2,800 during a wrong diagnosis: the
# boots came out shredded and decimation was blamed, when the cause was the
# retarget planting them in a rotated basis. With that fixed they read the same
# at the lower counts, and the freed triangles pay for the cardigan, which the
# goal names as a required feature and hand-modelling had failed to produce.
#
# The boot then wanted some of them back. At 2,600 the decimator flattened the
# toe box and the toes came through it; a bodice and a skirt lose nothing
# visible at 3,300, and a boot at 3,200 keeps its toe.
#
# Then the fringe came back. Keeping the base model's own 1,155-triangle fringe
# instead of a 178-triangle shell cut off the face is worth far more per
# triangle than any of these are: it is the difference between hair and a swim
# cap in the one render that is nothing but the head. The cardigan, the skirt
# and the socks paid for it, and none of them changed on screen.
#
# Then the head did, twice over. The measured bear ears, buns, crown and ahoge
# cost 1,300 triangles against the 1,085 the sphere-and-plate versions took,
# and the cardigan gave up 300 more so the model stays under the 40,000 cap.
# Same reasoning as the fringe: the head is what the close-up renders are of.
#
# Then two of the goal's own checklist items turned out to be sitting unused in
# the same package. Belt was read as a waist band with a bow at the front (goal
# item 8) -- wrongly, see below -- and Leg_belt is a thigh wrap on ONE side only
# (goal item 10, which names the asymmetry); both were being skipped for
# triangles alone, and both were listed as NOT DONE. The bodice, skirt and
# cardigan paid for them.
#
# The first attempt paid too little. A belt and a thigh wrap are thin straps
# with buckles, and COLLAPSE shreds a strap long before it dulls a panel: at
# 700 and 600 the belt melted into a mint smear and the wrap came through as a
# scatter of loose triangles on the thigh.
#
# Then the belt gave most of it back. Measuring the vendor mesh showed it is a
# 27mm sash with a flat front plate and no bow at all, so goal item 8's bow
# comes from blender/bow.py instead and the sash only has to read as a band;
# 650 does that. The bow's own budget came from the belt, the wrap, the cardigan
# and the boot; it cost 1,096 when its loops were lofted ribbons and costs 544
# now that they are cones, and the difference went back into the margin. The
# cardigan is the right place to take from: it renders at a channel standard
# deviation of 1, meaning its triangles buy silhouette and nothing else. The
# boot is not, which is why it gave only 100 and stays clear of the 2,600 where
# its toe box is known to collapse.
SETS = {
    'inner': ('Milfy_Inner.fbx', {
        'Inner': 2450,
        'Skirt': 2450,
        'Shoes': 2800,
        'Socks': 1600,
        'Main_Ribbon': 700,
        'Belt': 650,
        'Leg_belt': 1300,
    }),
    'outer': ('Milfy_Outer.fbx', {
        'Outer': 1600,
    }),
}
SRC = os.path.join(FBX, SETS[WHICH][0])
TARGET = SETS[WHICH][1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)

for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    if obj.name not in TARGET:
        bpy.data.objects.remove(obj, do_unlink=True)

kept = [o for o in bpy.data.objects if o.type == 'MESH']
for obj in kept:
    bpy.context.view_layer.objects.active = obj
    if obj.data.shape_keys:
        obj.shape_key_clear()
    obj.data.calc_loop_triangles()
    before = len(obj.data.loop_triangles)
    want = TARGET[obj.name]
    if want < before:
        mod = obj.modifiers.new('cut', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = want / before
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.name = obj.name
    obj.data.calc_loop_triangles()
    print(f'  {obj.name:<14} {before:>6} -> {len(obj.data.loop_triangles):>6} tris  '
          f'{len(obj.vertex_groups)} groups')

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
    export_morph=False, export_materials='EXPORT', export_texcoords=True,
    export_normals=True,
)
print(f'wrote {OUT}')
