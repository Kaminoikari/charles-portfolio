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


def body_skin(doc, manifest):
    """Index of the skin the body mesh uses, read through the manifest.

    A VRoid export carries three skins over the same joint list and puts the
    body on the SECOND one (face 0, body 1, hair 2). `doc['skins'][0]` is the
    face's skin, which happens to list the same joints, which is why the
    assumption never showed until a bone was appended to one skin and not the
    others. The manifest names the body mesh; the node that draws that mesh
    names the skin.
    """
    try:
        mesh_name = manifest['parts']['Body_Skin']['mesh']
    except (KeyError, TypeError):
        raise BadRig('manifest 裡沒有 parts.Body_Skin.mesh，找不到身體用的是哪個 skin')
    meshes = doc.get('meshes') or []
    mesh_index = next((i for i, m in enumerate(meshes) if m.get('name') == mesh_name), None)
    if mesh_index is None:
        raise BadRig(f'檔案裡沒有叫 {mesh_name} 的 mesh，manifest 跟檔案對不上')
    for node in doc.get('nodes') or []:
        if node.get('mesh') == mesh_index and 'skin' in node:
            return node['skin']
    raise BadRig(f'沒有任何節點帶著 skin 畫 {mesh_name}，這個身體沒有蒙皮')


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
