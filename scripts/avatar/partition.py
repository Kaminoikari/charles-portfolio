"""Turn the three baked meshes into named, independently deletable parts.

VRoid exports a mesh whose primitives all share one vertex buffer: dropping a
primitive drops only its indices, and its vertices stay in the file as orphans
that still count toward the bounding box. So this does not merely label the
primitives, it gives each one its own copy of the vertices it uses. After this,
deleting a part is deleting a primitive, and nothing is left behind.

Face is deliberately NOT split. Its ten primitives carry 56 morph targets each,
and VRM's blendShapeMaster binds those by (mesh index, morph index); re-indexing
them is a way to silently break every expression while the file still loads.

Names come from geometry, not from guesswork: the long strands that fall below
the waist are the twintails, the ones sitting in front of the face at negative Z
are the bangs, and HAIR_06 is the ornament pair the reference does not have.
"""
import json
import sys

import numpy as np

import glb

VERTEX_ATTRS = ('POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1',
                'COLOR_0', 'JOINTS_0', 'WEIGHTS_0')

BODY_NAMES = {0: 'Body_Skin', 1: 'Body_Skin', 2: 'Body_Skin', 3: 'Body_Skin',
              4: 'Outfit_Top', 5: 'Outfit_Bottom', 6: 'Outfit_Shoes'}


# The base model's fringe carries its hair clips as painted decals on separate
# primitives -- crossed bars over the left brow, two outlined stars over the
# right -- rather than as accessory geometry. Naming them apart is what lets the
# fringe itself be kept: the reference wears a different set of clips, and
# dropping the whole fringe to be rid of these left a smooth offset shell over
# the forehead that read as a swim cap.
CLIP_DECALS = ('HAIR_03', 'HAIR_05')


def hair_name(material, centroid, ymin):
    """Which part a hair strand belongs to, from where it sits in space."""
    if material.endswith('HAIR_06'):
        return 'Acc_HairOrnament'
    if ymin < 0.90:                       # falls below the waist
        return 'Hair_Twintail_L' if centroid[0] < 0 else 'Hair_Twintail_R'
    if centroid[2] < -0.03:               # in front of the face (model faces -Z)
        # Only in front of the face: HAIR_03 and HAIR_05 also carry ordinary
        # strands in the back and side hair, which must stay hair.
        return ('Acc_HairClip_Base' if material.endswith(CLIP_DECALS)
                else 'Hair_Bangs')
    if material.endswith(CLIP_DECALS) and abs(centroid[0]) > 0.12:
        # A lone star decal painted on the back hair. This rule runs before
        # proportion, so it sees x=+0.144; the shipped model scales the head
        # by 1.06 and it lands at +0.153. Either way it is further from the
        # midline than the skull itself. twintail.apply moves the strands
        # under it and not this primitive, because it moves parts and this one
        # is labelled Hair_Back, so after the split it hangs in mid-air beside
        # the head -- plainly visible in a three-vrm close-up and in nothing the
        # flat renders frame. The reference has no such star, so it goes to the
        # ornament bin that make.DROP already empties.
        return 'Acc_HairOrnament'
    if centroid[1] > 1.44:
        return 'Hair_Back'
    return 'Hair_Side_L' if centroid[0] < 0 else 'Hair_Side_R'


def split_primitive(doc, views, prim):
    """Give one primitive its own vertices. Returns a new primitive dict."""
    idx = glb.read_accessor(doc, views, prim['indices']).ravel().astype(np.int64)
    used, remap = np.unique(idx, return_inverse=True)
    new = {'mode': prim.get('mode', 4), 'attributes': {}}
    if 'material' in prim:
        new['material'] = prim['material']
    for attr, acc_index in prim['attributes'].items():
        arr = glb.read_accessor(doc, views, acc_index)[used]
        target = 34962
        new['attributes'][attr] = glb.add_accessor(
            doc, views, arr, target=target, minmax=(attr == 'POSITION'))
    tri = remap.astype(np.uint32 if len(used) > 65535 else np.uint16)
    new['indices'] = glb.add_accessor(doc, views, tri, target=34963)
    return new


def partition(src, dst, parts_path):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]

    manifest = {'source': src, 'parts': {}}

    for mesh in doc['meshes']:
        name = mesh.get('name')
        if name == 'Face.baked':
            manifest['parts']['Face'] = {
                'mesh': name,
                'primitives': list(range(len(mesh['primitives']))),
                'tris': sum(doc['accessors'][p['indices']]['count'] // 3
                            for p in mesh['primitives']),
                'materials': sorted({mats[p['material']] for p in mesh['primitives']}),
                'deletable': False,
                'note': 'carries the 56 morph targets; splitting it breaks blendShapeMaster',
            }
            continue

        rebuilt, labels = [], []
        for i, prim in enumerate(mesh['primitives']):
            if name == 'Body.baked':
                label = BODY_NAMES[i]
            else:
                pos = glb.read_accessor(doc, views, prim['attributes']['POSITION'])
                used = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
                p = pos[used]
                label = hair_name(mats[prim['material']], p.mean(axis=0), p[:, 1].min())
            new = split_primitive(doc, views, prim)
            new.setdefault('extras', {})['part'] = label
            rebuilt.append(new)
            labels.append(label)
        mesh['primitives'] = rebuilt

        for label in dict.fromkeys(labels):
            members = [i for i, l in enumerate(labels) if l == label]
            manifest['parts'][label] = {
                'mesh': name,
                'primitives': members,
                'tris': sum(doc['accessors'][rebuilt[i]['indices']]['count'] // 3
                            for i in members),
                'materials': sorted({mats[rebuilt[i]['material']] for i in members}),
                'deletable': not label.startswith('Body_'),
            }

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    json.dump(manifest, open(parts_path, 'w'), indent=2, ensure_ascii=False)
    return manifest, size


if __name__ == '__main__':
    m, size = partition(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f'wrote {sys.argv[2]} ({size} bytes) and {sys.argv[3]}')
    for name, p in sorted(m['parts'].items(), key=lambda kv: -kv[1]['tris']):
        flag = '' if p['deletable'] else '  [locked]'
        print(f'  {name:<20} {len(p["primitives"]):>3} prim  {p["tris"]:>6} tris{flag}')
