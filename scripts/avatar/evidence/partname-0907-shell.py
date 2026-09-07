"""Is this primitive a closed body or an open garment shell? Count boundary edges.

    python3 scripts/avatar/evidence/partname-0907-shell.py <vrm> [<vrm> ...]

partname-0907-inside.py asked the wrong question. Ray parity decides whether a
point is inside a CLOSED surface, and a garment is not one: a coat has a neck
hole, two cuffs and a hem, so parity against it is meaningless and the 0% it
returned said nothing about skin and clothing.

The closedness it assumed is itself the signal. inside.py's own docstring says
the body is watertight but for 54 of its 11,625 edges, around the eye and mouth
openings. A garment cannot be: it has to have an opening for every part of the
body that enters it.

So this counts, per primitive, the share of edges belonging to exactly one
triangle, and the openings' total perimeter against the primitive's own size --
a mesh's boundary is a length, and a hem on a small sleeve is not the same
finding as the same length around a whole coat.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import glb  # noqa: E402
import humanoid  # noqa: E402


def boundary(tris_idx, pos):
    """(share of edges on a boundary, boundary length, surface area)."""
    e = np.concatenate([tris_idx[:, [0, 1]], tris_idx[:, [1, 2]], tris_idx[:, [2, 0]]])
    # A seam welded in the file as two coincident vertices is not a hole, so
    # edges are keyed by POSITION rather than by index: two triangles meeting at
    # duplicated corners must count as one shared edge.
    key = np.round(pos, 5)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    e = np.sort(inv[e], axis=1)
    _, counts = np.unique(e, axis=0, return_counts=True)
    open_edges = int((counts == 1).sum())
    a = pos[tris_idx[:, 0]]
    b = pos[tris_idx[:, 1]]
    c = pos[tris_idx[:, 2]]
    area = float(np.linalg.norm(np.cross(b - a, c - a), axis=1).sum() / 2)
    lengths = np.linalg.norm(pos[e[:, 0]] - pos[e[:, 1]], axis=1)
    _, first, counts_all = np.unique(e, axis=0, return_index=True, return_counts=True)
    perim = float(lengths[first][counts_all == 1].sum())
    return open_edges / max(len(counts), 1), perim, area


def main(paths):
    for path in paths:
        doc, binary = glb.load(path)
        views = glb.views_of(doc, binary)
        bone_of = humanoid.node_bone(doc)
        skins = humanoid.mesh_skin(doc)
        print(f'\n=== {os.path.basename(path)}')
        print('  primitive                  tris   open edges   hole rim   area   rim/sqrt(area)')
        for mi, mesh in enumerate(doc['meshes']):
            joints = doc['skins'][skins[mi]]['joints'] if mi in skins else []
            for pi, prim in enumerate(mesh['primitives']):
                pos = glb.read_accessor(doc, views, prim['attributes']['POSITION'])
                idx = glb.read_accessor(doc, views, prim['indices']).ravel().astype(np.int64)
                tris = idx.reshape(-1, 3)
                jo = glb.read_accessor(doc, views, prim['attributes']['JOINTS_0'])
                we = glb.read_accessor(doc, views, prim['attributes']['WEIGHTS_0'])
                dom = jo[np.arange(len(jo)), we.argmax(axis=1)]
                nodes = [joints[j] if j < len(joints) else -1 for j in dom]
                human = np.mean([bone_of.get(int(n)) is not None for n in nodes])
                if human <= 0.5:
                    continue  # hair and cloth-on-own-bones are already separable
                share, perim, area = boundary(tris, pos)
                label = f'{mesh.get("name", mi)}#{pi}'
                print(f'  {label[:24].ljust(26)}{len(tris):6d}   {share:8.1%}   '
                      f'{perim:6.3f}m  {area:6.3f}m2   {perim / max(np.sqrt(area), 1e-9):6.2f}')


if __name__ == '__main__':
    main(sys.argv[1:])
