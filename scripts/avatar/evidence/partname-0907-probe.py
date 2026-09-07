"""What separates a body's parts when you are not allowed to read their names.

    python3 scripts/avatar/evidence/partname-0907-probe.py <vrm> [<vrm> ...]

partition.py names parts from three facts about a VRoid export: a mesh called
`Face.baked`, primitive INDICES inside a mesh called `Body.baked`, and hair
strand positions against absolute world constants. None survives a different
body, and the step refuses rather than inventing names.

Before writing a classifier, this prints the signals a classifier could use, per
primitive, for whatever bodies are handed to it. It reads no mesh or material
name for its judgements -- it prints them only so a person can check the answer:

  morph      does any blendShape group bind a morph target of this mesh (VRM0)
             or any expression (VRM1)? That is what makes a face a face.
  skinned to which humanoid bone group owns most of its vertices, by weight
  offhuman   share of vertices whose dominant joint is NOT a humanoid bone
  underhead  ...and hangs off the head, which is what hair does
  spring     ...and is driven by a spring chain
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import glb  # noqa: E402
import humanoid  # noqa: E402

GROUP = {
    'head': ('head', 'neck'),
    'chest': ('chest', 'upperChest', 'spine', 'leftShoulder', 'rightShoulder'),
    'arm': ('UpperArm', 'LowerArm', 'Hand', 'Index', 'Middle', 'Ring', 'Little', 'Thumb'),
    'hips': ('hips',),
    'leg': ('UpperLeg', 'LowerLeg'),
    'foot': ('Foot', 'Toes'),
}


def group_of(bone):
    for name, keys in GROUP.items():
        if any(bone == k or bone.endswith(k) for k in keys):
            return name
    return bone


def morph_bound_meshes(doc):
    """Mesh indices any expression binds a morph target of."""
    out = set()
    vrm0 = (doc.get('extensions') or {}).get('VRM') or {}
    for g in ((vrm0.get('blendShapeMaster') or {}).get('blendShapeGroups') or []):
        for b in g.get('binds') or []:
            if 'mesh' in b:
                out.add(b['mesh'])
    vrm1 = (doc.get('extensions') or {}).get('VRMC_vrm') or {}
    presets = (vrm1.get('expressions') or {}).get('preset') or {}
    custom = (vrm1.get('expressions') or {}).get('custom') or {}
    nodes = doc.get('nodes') or []
    for e in list(presets.values()) + list(custom.values()):
        for b in e.get('morphTargetBinds') or []:
            node = nodes[b['node']] if 'node' in b and b['node'] < len(nodes) else {}
            if 'mesh' in node:
                out.add(node['mesh'])
    return out


def descends_from(doc, node, ancestor):
    parent = {}
    for i, n in enumerate(doc.get('nodes') or []):
        for c in n.get('children') or []:
            parent[c] = i
    seen = set()
    while node in parent and node not in seen:
        seen.add(node)
        node = parent[node]
        if node == ancestor:
            return True
    return False


def main(paths):
    for path in paths:
        doc, binary = glb.load(path)
        views = glb.views_of(doc, binary)
        bone_of = humanoid.node_bone(doc)
        head_node = humanoid.bones(doc).get('head')
        skins = humanoid.mesh_skin(doc)
        morphed = morph_bound_meshes(doc)
        spring_nodes = set()
        for chain in humanoid.springs(doc).get('groups', []):
            for b in chain.get('bones', []):
                spring_nodes.add(b)
        under_head = {n for n in range(len(doc.get('nodes') or []))
                      if n not in bone_of and head_node is not None
                      and descends_from(doc, n, head_node)}

        print(f'\n=== {os.path.basename(path)}   VRM {humanoid.version(doc)}   '
              f'{len(doc["meshes"])} meshes, morph-bound: '
              f'{sorted(morphed) if morphed else "none"}')
        print('  mesh/prim                    verts     y range        morph  '
              'skinned to      offhuman underhead spring')
        for mi, mesh in enumerate(doc['meshes']):
            joints = doc['skins'][skins[mi]]['joints'] if mi in skins else []
            for pi, prim in enumerate(mesh['primitives']):
                attrs = prim['attributes']
                pos = glb.read_accessor(doc, views, attrs['POSITION'])
                used = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
                p = pos[used]
                jo = glb.read_accessor(doc, views, attrs['JOINTS_0'])[used]
                we = glb.read_accessor(doc, views, attrs['WEIGHTS_0'])[used]
                dominant = jo[np.arange(len(jo)), we.argmax(axis=1)]
                nodes = np.array([joints[j] if j < len(joints) else -1 for j in dominant])
                names = [bone_of.get(int(n)) for n in nodes]
                weight = {}
                for n in names:
                    if n is not None:
                        weight[group_of(n)] = weight.get(group_of(n), 0) + 1
                top = max(weight, key=weight.get) if weight else '-'
                share = weight.get(top, 0) / max(len(names), 1)
                off = sum(1 for n in names if n is None) / max(len(names), 1)
                uh = sum(1 for n in nodes if int(n) in under_head) / max(len(nodes), 1)
                sp = sum(1 for n in nodes if int(n) in spring_nodes) / max(len(nodes), 1)
                label = f'{mesh.get("name", mi)}#{pi}'
                print(f'  {label[:28].ljust(29)}{len(used):6d}  '
                      f'{p[:, 1].min():5.2f}…{p[:, 1].max():5.2f}   '
                      f'{"morph" if mi in morphed else "  -  ":>6}  '
                      f'{top:<10}{share:5.0%}   {off:6.0%}   {uh:6.0%}   {sp:5.0%}')


if __name__ == '__main__':
    main(sys.argv[1:])
