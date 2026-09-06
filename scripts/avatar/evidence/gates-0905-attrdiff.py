#!/usr/bin/env python3
"""Attribute-by-attribute diff of two builds: attrdiff.py <a.vrm> <b.vrm>.
Reports every primitive attribute, morph target and index buffer that differs,
plus skins/nodes equality and the vertex sha of both."""
import sys

import numpy as np

sys.path.insert(0, '/Users/charles/portfolio/scripts/avatar')
import glb  # noqa: E402
import verify  # noqa: E402


def load(p):
    doc, b = glb.load(p)
    return doc, glb.views_of(doc, b)


def main(a, b):
    print(f'vertex sha a={verify.stats(a)["vertex_sha"]} b={verify.stats(b)["vertex_sha"]}')
    (da, va), (db, vb) = load(a), load(b)
    worst = {}
    for (ma, mb) in zip(da['meshes'], db['meshes']):
        for pi, (pa, pb) in enumerate(zip(ma['primitives'], mb['primitives'])):
            for att in pa['attributes']:
                x = glb.read_accessor(da, va, pa['attributes'][att])
                y = glb.read_accessor(db, vb, pb['attributes'][att])
                if x.shape != y.shape:
                    worst.setdefault(att, []).append(('SHAPE', ma['name'], pi, x.shape, y.shape))
                    continue
                d = np.abs(x.astype(np.float64) - y.astype(np.float64))
                if d.max() > 0:
                    changed = int((x != y).any(axis=1).sum()) if x.ndim == 2 else int((x != y).sum())
                    worst.setdefault(att, []).append((float(d.max()), ma['name'], pi, changed))
            for ti, (ta, tb) in enumerate(zip(pa.get('targets', []), pb.get('targets', []))):
                for att in ta:
                    x = glb.read_accessor(da, va, ta[att])
                    y = glb.read_accessor(db, vb, tb[att])
                    d = np.abs(x.astype(np.float64) - y.astype(np.float64)).max() if x.shape == y.shape else -1
                    if d != 0:
                        worst.setdefault('target:' + att, []).append((float(d), ma['name'], pi, ti))
            ia = glb.read_accessor(da, va, pa['indices'])
            ib = glb.read_accessor(db, vb, pb['indices'])
            if ia.shape != ib.shape or (ia != ib).any():
                same = (sorted(map(tuple, np.sort(ia.reshape(-1, 3), axis=1)))
                        == sorted(map(tuple, np.sort(ib.reshape(-1, 3), axis=1)))) if ia.shape == ib.shape else False
                worst.setdefault('indices', []).append((ma['name'], pi, f'same triangle set ignoring order: {same}'))
    for att, rows in worst.items():
        rows.sort(key=str, reverse=True)
        print(f'{att} changed primitives: {len(rows)}')
        for r in rows[:8]:
            print('   ', r)
    if not worst:
        print('NO ATTRIBUTE, TARGET OR INDEX DIFFERS')
    print('nodes equal', da['nodes'] == db['nodes'], '; skins equal', da['skins'] == db['skins'])


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
