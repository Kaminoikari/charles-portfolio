"""Can skin be told from clothing without reading a name? Ray parity says yes.

    python3 scripts/avatar/evidence/partname-0907-inside.py <vrm> [<vrm> ...]

partname-0907-probe.py measured the skinning signals and found they separate the
face (morph binds) and the hair (non-humanoid bones under the head) on both
bodies, and do NOT separate skin from a garment: a sleeve and the arm inside it
are skinned to the same humanoid bones and read identically.

The remaining signal is geometric, and the pipeline already owns it: inside.py
fires five rays per point and counts crossings, which is how the garment gate
decides whether a vertex is buried in the body. Here it is turned on the parts
themselves: for every pair of primitives that share space, what share of A's
vertices are inside B?

Skin is the primitive nothing is inside of. If that holds on both bodies, part
naming can stop reading mesh names.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import glb  # noqa: E402
import humanoid  # noqa: E402
import inside as inside_mod  # noqa: E402

SAMPLE = 300  # points per primitive; the answer is a share, not a count


def prims_of(doc, views):
    """Every primitive with its own vertices, indices and dominant-joint names."""
    bone_of = humanoid.node_bone(doc)
    skins = humanoid.mesh_skin(doc)
    out = []
    for mi, mesh in enumerate(doc['meshes']):
        joints = doc['skins'][skins[mi]]['joints'] if mi in skins else []
        for pi, prim in enumerate(mesh['primitives']):
            pos = glb.read_accessor(doc, views, prim['attributes']['POSITION'])
            idx = glb.read_accessor(doc, views, prim['indices']).ravel().astype(np.int64)
            used = np.unique(idx)
            jo = glb.read_accessor(doc, views, prim['attributes']['JOINTS_0'])
            we = glb.read_accessor(doc, views, prim['attributes']['WEIGHTS_0'])
            dominant = jo[np.arange(len(jo)), we.argmax(axis=1)]
            nodes = np.array([joints[j] if j < len(joints) else -1 for j in dominant])
            human = np.array([bone_of.get(int(n)) is not None for n in nodes])
            out.append({
                'label': f'{mesh.get("name", mi)}#{pi}',
                'pos': pos,
                'tris': pos[idx.reshape(-1, 3)],
                'used': used,
                'human_share': float(human[used].mean()),
                'lo': pos[used].min(axis=0),
                'hi': pos[used].max(axis=0),
            })
    return out


def overlaps(a, b, slack=0.01):
    return bool(np.all(a['lo'] - slack <= b['hi']) and np.all(b['lo'] - slack <= a['hi']))


def main(paths):
    rng = np.random.default_rng(20260907)
    for path in paths:
        doc, binary = glb.load(path)
        views = glb.views_of(doc, binary)
        prims = [p for p in prims_of(doc, views) if p['human_share'] > 0.5]
        print(f'\n=== {os.path.basename(path)}   '
              f'{len(prims)} primitives skinned mostly to humanoid bones')
        print('  share of ROW\'s sampled vertices inside COLUMN\'s surface')
        head = '  ' + ' ' * 22 + ''.join(f'{p["label"].split("#")[-1]:>6}' for p in prims)
        print(head)
        for a in prims:
            pick = rng.choice(a['used'], size=min(SAMPLE, len(a['used'])), replace=False)
            pts = a['pos'][pick]
            row = []
            for b in prims:
                if a is b or not overlaps(a, b):
                    row.append('    -')
                    continue
                row.append(f'{inside_mod.inside(pts, b["tris"]).mean():5.0%}')
            print(f'  {a["label"][:20].ljust(22)}' + ''.join(f'{c:>6}' for c in row))


if __name__ == '__main__':
    main(sys.argv[1:])
