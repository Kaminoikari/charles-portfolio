#!/usr/bin/env python3
"""Bodies that must FAIL springsim.test.ts, for its two clothing gates.

    python3 scripts/avatar/evidence/clearance-0906-models.py <out-dir>

  skirt-on-hips.vrm     Outfit_Bottom skinned wholly to the hips: the legs
                        swing through it in the dance (the skirt gate).
  tails-no-colliders.vrm  the twintails' spring group with no collider groups:
                        the tails hang into the coat and swing through it
                        (the coat gate; what the 2026-09-03 file did).

Each gets the manifest copied beside it, because the simulator reads its
parts from there. SPRINGSIM_TEST_MODEL=<file> npx vitest run
scripts/avatar/springsim.test.ts runs the gate on one of them.
"""
import json
import os
import shutil
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import glb  # noqa: E402
import humanoid  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MODEL = os.path.join(REPO, 'public', 'avatar', 'mika-milfy-12.vrm')
MANIFEST = MODEL.replace('.vrm', '.parts.json')


def write_accessor(doc, views, index, array):
    """Overwrite a packed accessor's bytes in place."""
    acc = doc['accessors'][index]
    bv = doc['bufferViews'][acc['bufferView']]
    dtype = glb.DTYPE[acc['componentType']]
    ncomp = glb.NCOMP[acc['type']]
    packed = dtype.itemsize * ncomp
    assert (bv.get('byteStride') or packed) == packed, 'interleaved accessor'
    start = acc.get('byteOffset', 0)
    data = np.ascontiguousarray(array, dtype=dtype).reshape(acc['count'], ncomp).tobytes()
    views[acc['bufferView']][start:start + len(data)] = data


def skirt_on_hips(out):
    doc, binary = glb.load(MODEL)
    views = glb.views_of(doc, binary)
    parts = json.load(open(MANIFEST))['parts']
    p = parts['Outfit_Bottom']
    mesh = next(m for m in doc['meshes'] if m.get('name') == p['mesh'])
    skin = doc['skins'][humanoid.skin_of_mesh(doc, p['mesh'])]
    hips = skin['joints'].index(humanoid.bones(doc)['hips'])
    for i in p['primitives']:
        prim = mesh['primitives'][i]
        J = np.array(glb.read_accessor(doc, views, prim['attributes']['JOINTS_0']))
        W = np.array(glb.read_accessor(doc, views, prim['attributes']['WEIGHTS_0']))
        J[:] = 0
        J[:, 0] = hips
        W[:] = 0
        W[:, 0] = 1
        write_accessor(doc, views, prim['attributes']['JOINTS_0'], J)
        write_accessor(doc, views, prim['attributes']['WEIGHTS_0'], W)
    glb.save(out, doc, glb.rebuild(doc, views))
    shutil.copy2(MANIFEST, out.replace('.vrm', '.parts.json'))


def tails_no_colliders(out):
    doc, binary = glb.load(MODEL)
    sec = doc['extensions']['VRM']['secondaryAnimation']
    cleared = 0
    for g in sec['boneGroups']:
        names = [doc['nodes'][b].get('name', '') for b in g.get('bones', [])]
        if any(n.startswith('HairTail') for n in names):
            g['colliderGroups'] = []
            cleared += 1
    assert cleared == 1, cleared
    glb.save(out, doc, binary)
    shutil.copy2(MANIFEST, out.replace('.vrm', '.parts.json'))


if __name__ == '__main__':
    out_dir = sys.argv[1]
    os.makedirs(out_dir, exist_ok=True)
    skirt_on_hips(os.path.join(out_dir, 'skirt-on-hips.vrm'))
    tails_no_colliders(os.path.join(out_dir, 'tails-no-colliders.vrm'))
    print('wrote', os.listdir(out_dir))
