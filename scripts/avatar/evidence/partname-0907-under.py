"""Does this body have skin UNDER its clothes, and are the clothes their own mesh?

    python3 scripts/avatar/evidence/partname-0907-under.py <vrm> [<vrm> ...]

The two properties a base body has to have before the rebuild pipeline can dress
it: a garment that is separable geometry, and a body that still exists beneath
that garment. Neither is a name, so both can be measured on any file.

Three earlier signals did not decide it, each for its own reason, and they are
kept in this directory so the next person does not spend the afternoon again:
skinning (partname-0907-probe) reads a sleeve and the arm inside it identically;
ray parity (partname-0907-inside) needs a closed surface and a garment is an
open shell, so it answered nothing; boundary-edge share (partname-0907-shell)
puts the VRoid coat at 0.5% against its own skin at 1.1%, the wrong way round.

What decides it is the signed distance to the nearest surface. For sampled
points of A, find the nearest triangle of B and the side of B's plane the point
falls on. A is UNDER B where it sits on the inward side within a few
centimetres; that test does not care whether B is closed, which is the mistake
the parity run made.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import glb  # noqa: E402
import humanoid  # noqa: E402

SAMPLE = 400
NEAR = 0.05  # metres: a garment sits within this of the skin it covers


def prims(doc, views):
    bone_of = humanoid.node_bone(doc)
    skins = humanoid.mesh_skin(doc)
    out = []
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
            human = float(np.mean([bone_of.get(int(n)) is not None for n in nodes]))
            if human <= 0.5:
                continue
            used = np.unique(idx)
            out.append({
                'label': f'{mesh.get("name", mi)}#{pi}',
                'pts': pos[used],
                'tri': pos[tris],
                'lo': pos[used].min(axis=0),
                'hi': pos[used].max(axis=0),
            })
    return out


def under(pts, tri):
    """Share of pts sitting on the inward side of tri's nearest face, within NEAR."""
    a, b, c = tri[:, 0], tri[:, 1], tri[:, 2]
    n = np.cross(b - a, c - a)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    keep = ln[:, 0] > 1e-12
    a, n = a[keep], n[keep] / ln[keep]
    centre = tri[keep].mean(axis=1)
    hit = 0
    for chunk in np.array_split(pts, max(1, len(pts) // 64)):
        d = np.linalg.norm(chunk[:, None, :] - centre[None, :, :], axis=2)
        j = d.argmin(axis=1)
        signed = np.einsum('ij,ij->i', chunk - a[j], n[j])
        hit += int(((signed < 0) & (d[np.arange(len(chunk)), j] < NEAR)).sum())
    return hit / max(len(pts), 1)


def main(paths):
    rng = np.random.default_rng(20260907)
    for path in paths:
        doc, binary = glb.load(path)
        p = prims(doc, glb.views_of(doc, binary))
        print(f'\n=== {os.path.basename(path)}   {len(p)} body-skinned primitives')
        print("  share of ROW's points sitting under COLUMN's surface (<=50mm, inward side)")
        print('  ' + ' ' * 22 + ''.join(f'{q["label"].split("#")[-1]:>6}' for q in p))
        pairs = []
        for a in p:
            pts = a['pts'][rng.choice(len(a['pts']), size=min(SAMPLE, len(a['pts'])), replace=False)]
            row = []
            for b in p:
                if a is b or np.any(a['lo'] - 0.05 > b['hi']) or np.any(b['lo'] - 0.05 > a['hi']):
                    row.append('    -')
                    continue
                s = under(pts, b['tri'])
                row.append(f'{s:5.0%}')
                pairs.append((s, a['label'], b['label']))
            print(f'  {a["label"][:20].ljust(22)}' + ''.join(f'{c:>6}' for c in row))
        # The five deepest, because one line is not enough: a face's eyelashes
        # sit under its own skin at 100% and would be the whole headline, while
        # the pair that decides whether this body can be dressed is skin under
        # a garment somewhere below it.
        print('  deepest cover:')
        for s, a, b in sorted(pairs, reverse=True)[:5]:
            print(f'    {a:<22} under {b:<22} {s:5.0%}')


if __name__ == '__main__':
    main(sys.argv[1:])
