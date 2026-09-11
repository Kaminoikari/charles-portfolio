"""The one place this pipeline reads a VRM's humanoid map, version and skins.

Until 2026-09-05 twelve modules (sixteen sites) each rebuilt `{bone: node}` from
`doc['extensions']['VRM']['humanoid']['humanBones']` inline, with no error
handling and no idea that VRM 1.0 spells it differently. A base body exported
as 1.0 would have raised KeyError in whichever module ran first and told the
person nothing. Every reader now comes through here, and humanoid_test.py
holds the rest of the package to that (it greps for the inline form).

`doc` is the glTF JSON dict from either glb.load() or vrmrig.read(); the two
differ only in that vrmrig.read() adds `_name` for error messages.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vrmrig  # noqa: E402

BadRig = vrmrig.BadRig
read = vrmrig.read
compare = vrmrig.compare
REQUIRED = vrmrig.REQUIRED

# The humanoid bones an arm hangs off, by the fragment that names them. Read as
# a substring of the bone name so a vendor's `J_Bip_L_UpperArm` and a VRM 1.0
# `leftUpperArm` both match, and the fingers are in because a hand is an arm as
# far as "is this cloth a sleeve" is concerned. Lives here rather than in the
# gate that first needed it: pierce.py asks which SKIN is arm skin and
# partmap.py asks which CLOTH an arm drives, and one list has to answer both or
# a sleeve stops being a sleeve halfway through the comparison.
ARM_BONES = ('Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'Thumb', 'Index',
             'Middle', 'Ring', 'Little')


# The hand alone, read the same way. skin.py samples the body's own skin colour
# where these bones drive it: a hand is bare on every body this pipeline has
# seen, while a forearm can be inside a sleeve and a torso usually is.
HAND_BONES = ('Hand', 'Thumb', 'Index', 'Middle', 'Ring', 'Little')


def is_arm(name):
    """Does this bone name belong to an arm?"""
    return any(part.lower() in (name or '').lower() for part in ARM_BONES)


def is_hand(name):
    """Does this bone name belong to a hand or a finger?"""
    return any(part.lower() in (name or '').lower() for part in HAND_BONES)


def version(doc):
    """'0' or '1'. See vrmrig.vrm_version."""
    return vrmrig.vrm_version(doc)


def forward_z(doc):
    """-1 for VRM 0.x, +1 for VRM 1.0. See vrmrig.forward_z."""
    return vrmrig.forward_z(doc)


def bones(doc):
    """Humanoid bone name -> node index."""
    return vrmrig.human_bones(doc)


def node_bone(doc):
    """Node index -> humanoid bone name, for the nodes that are humanoid bones."""
    return {n: b for b, n in vrmrig.human_bones(doc).items()}


def required_missing(doc):
    return vrmrig.required_missing(doc)


def expression_names(doc):
    return vrmrig.expression_names(doc)


def springs(doc):
    return vrmrig.spring_bones(doc)


def mtoon(doc):
    """Per-material MToon settings, in `doc['materials']` order, either version.

    Each entry is {'name', 'outlineColor', 'rimColor', 'outlineWidthMode'} with
    colours as [r, g, b] and None where the file states nothing. VRM 0.x keeps
    them in a parallel `materialProperties` array as `_OutlineColor`,
    `_RimColor` and a numeric `_OutlineWidthMode`; VRM 1.0 puts them on the
    material itself under `VRMC_materials_mtoon` as `outlineColorFactor`,
    `parametricRimColorFactor` and a string `outlineWidthMode`. A material with
    no MToon at all (an unlit or PBR one) still gets an entry, with all three
    None, so callers can zip this against `doc['materials']` by index.

    The width mode is normalised to the 1.0 spelling on both versions, and 0.x
    is read positionally, which is exactly the pairing
    `verify.misaligned_material_properties` exists to hold.

    `name` comes from `doc['materials'][i]`, on both versions. The 0.x callers
    that this replaced took it from `materialProperties[i]` instead. The two
    agree on all four 0.x bodies in this repo and can only diverge on a file
    whose two arrays are already misaligned, which is the one thing
    `misaligned_material_properties` fails outright.
    """
    version = vrmrig.vrm_version(doc)
    materials = doc.get('materials') or []
    if version == '0':
        props = ((doc.get('extensions') or {}).get('VRM') or {}).get(
            'materialProperties') or []
        modes = {0: 'none', 1: 'worldCoordinates', 2: 'screenCoordinates'}
        out = []
        for index, material in enumerate(materials):
            prop = props[index] if index < len(props) else {}
            vectors = prop.get('vectorProperties') or {}
            floats = prop.get('floatProperties') or {}
            mode = floats.get('_OutlineWidthMode')
            out.append({
                'name': material.get('name'),
                'outlineColor': _rgb(vectors.get('_OutlineColor')),
                'rimColor': _rgb(vectors.get('_RimColor')),
                'outlineWidthMode': modes.get(mode) if mode is not None else None,
            })
        return out
    out = []
    for material in materials:
        block = (material.get('extensions') or {}).get('VRMC_materials_mtoon')
        if block is None:
            out.append({'name': material.get('name'), 'outlineColor': None,
                        'rimColor': None, 'outlineWidthMode': None})
            continue
        out.append({
            'name': material.get('name'),
            'outlineColor': _rgb(block.get('outlineColorFactor')),
            'rimColor': _rgb(block.get('parametricRimColorFactor')),
            'outlineWidthMode': block.get('outlineWidthMode'),
        })
    return out


def _rgb(value):
    """The first three channels of a colour the file may have written as 3 or 4."""
    return None if value is None else [float(c) for c in value[:3]]


def expression_meshes(doc):
    """Mesh indices any expression drives a morph target on, either version.

    A face's own expressions fold and collapse by design, so every check that
    measures grafted geometry has to know which meshes they are and leave them
    alone. VRM 0.x names the mesh directly in `blendShapeMaster`'s binds; VRM
    1.0 names a NODE in `expressions.{preset,custom}[].morphTargetBinds`, and
    the mesh is what that node draws. Reading only the 0.x path returns an empty
    set on a 1.0 body, which is not "no expressions" but "cannot see them", and
    it made verify.torn_shapes report 45 tears on a correct face.
    """
    ext = doc.get('extensions') or {}
    if vrmrig.vrm_version(doc) == '0':
        master = (ext.get('VRM') or {}).get('blendShapeMaster') or {}
        return {bind['mesh']
                for group in master.get('blendShapeGroups') or ()
                for bind in group.get('binds') or ()
                if 'mesh' in bind}
    expressions = (ext.get('VRMC_vrm') or {}).get('expressions') or {}
    nodes = doc.get('nodes') or []
    meshes = set()
    for section in ('preset', 'custom'):
        for group in (expressions.get(section) or {}).values():
            for bind in group.get('morphTargetBinds') or ():
                index = bind.get('node')
                if index is None or not 0 <= index < len(nodes):
                    continue
                mesh = nodes[index].get('mesh')
                if mesh is not None:
                    meshes.add(mesh)
    return meshes

# The VRM0/VRM1 thumb naming, defined once in vrmrig beside the rest of the
# version differences and re-exported here for the callers that read it off
# this module.
V1_TO_V0_THUMB = vrmrig.V1_TO_V0_THUMB


def model_bone_name(doc, clip_bone):
    """This body's spelling of a .vrma's (VRM 1.0) humanoid bone name.

    Translated for every 0.x body and for a 1.0 body that still carries the
    old thumb spelling, which is when three-vrm renames on import too.
    """
    legacy = version(doc) == '0' or any(b.endswith('ThumbIntermediate') for b in bones(doc))
    return V1_TO_V0_THUMB.get(clip_bone, clip_bone) if legacy else clip_bone


def animation_bones(doc):
    """Humanoid bone name -> node index of a .vrma (VRMC_vrm_animation) file."""
    ext = doc.get('extensions') or {}
    anim = ext.get('VRMC_vrm_animation')
    if anim is None:
        raise BadRig(f'{doc.get("_name", "這個檔")} 裡沒有 VRMC_vrm_animation 擴充，不是 .vrma。')
    bones_ = (anim.get('humanoid') or {}).get('humanBones') or {}
    return {name: b['node'] for name, b in bones_.items()
            if isinstance(b, dict) and 'node' in b}


def rest_world(doc):
    """Node index -> 4x4 numpy world matrix at rest, for every node in the scene.

    render.world_matrices is the walk every module already uses; it is imported
    here rather than at module level because render reads the humanoid map
    through this module, and a top-level import in both directions is a cycle.
    """
    import render
    return render.world_matrices(doc)


def node_world(doc):
    """Node index -> 4x4 world matrix as nested lists, pure Python.

    The same walk as rest_world without numpy or PIL, for callers that run
    inside Blender's own interpreter (bonemap.py under inspect_fbx.py --map).
    """
    return vrmrig.world_matrices(doc)


def mesh_skin(doc):
    """Mesh index -> index of the skin the node drawing it names.

    glTF resolves a skin per NODE. A VRoid export carries three skins over the
    same joint list (face 0, body 1, hair 2), which is why reading the first
    skin for every mesh happened to work until a bone was appended to one skin
    and not the others. A mesh no node draws with a skin is absent here. glTF
    lets two nodes draw one mesh through different skins; every reader here
    wants ONE answer per mesh, so that case is refused rather than resolved
    by whichever node came last.
    """
    out = {}
    for index, node in enumerate(doc.get('nodes') or []):
        if 'mesh' not in node or 'skin' not in node:
            continue
        if out.get(node['mesh'], node['skin']) != node['skin']:
            raise BadRig(f'mesh {node["mesh"]} 被兩個節點用不同的 skin 畫'
                         f'（skin {out[node["mesh"]]} 與 {node["skin"]}，節點 {index}）')
        out[node['mesh']] = node['skin']
    return out


def skin_of_mesh(doc, mesh_name):
    """Index of the skin the mesh called `mesh_name` is drawn with."""
    meshes = doc.get('meshes') or []
    mesh_index = next((i for i, m in enumerate(meshes) if m.get('name') == mesh_name), None)
    if mesh_index is None:
        raise BadRig(f'檔案裡沒有叫 {mesh_name} 的 mesh')
    skin = mesh_skin(doc).get(mesh_index)
    if skin is None:
        raise BadRig(f'沒有任何節點帶著 skin 畫 {mesh_name}，這個 mesh 沒有蒙皮')
    return skin


def body_skin(doc, manifest):
    """Index of the skin the body mesh uses, read through the manifest.

    The manifest names the body mesh; the node that draws that mesh names the
    skin (see mesh_skin).
    """
    try:
        mesh_name = manifest['parts']['Body_Skin']['mesh']
    except (KeyError, TypeError):
        raise BadRig('manifest 裡沒有 parts.Body_Skin.mesh，找不到身體用的是哪個 skin')
    try:
        return skin_of_mesh(doc, mesh_name)
    except BadRig as e:
        raise BadRig(f'{e}，manifest 跟檔案對不上') from e


def all_joints(doc):
    """Every node any skin lists as a joint, first-seen order, no repeats.

    For a file whose skins share one list this IS that list; for one whose
    skins differ it is their union, which is what a fit or a mapping that
    works per joint node rather than per skin slot needs.
    """
    seen, out = set(), []
    for skin in doc.get('skins') or []:
        for j in skin['joints']:
            if j not in seen:
                seen.add(j)
                out.append(j)
    return out


def skins_sharing(doc, skin_index):
    """Indices of every skin whose joint list is exactly skins[skin_index]'s.

    These are the skins a new bone has to be appended to together: VRoid's
    face, body and hair skins all list the same joints, and a mesh on any of
    them indexes JOINTS_0 into its own skin's list.
    """
    skins = doc.get('skins') or []
    if not 0 <= skin_index < len(skins):
        raise BadRig(f'skin {skin_index} 不存在，檔案只有 {len(skins)} 個 skin')
    joints = skins[skin_index]['joints']
    return [i for i, s in enumerate(skins) if s['joints'] == joints]
