#!/usr/bin/env python3
"""Receipts for the static clipping gates (pierce.py, inside.py, motion.py).

    python3 scripts/avatar/evidence/clearance-0906-clipping.py

These gates are scripts with a PASS/FAIL, not unit tests, so their receipt is
the same experiment motion.py's own calibration comment describes, re-run on
today's build: the build output as it is (control), then each garment sunk
25mm into the body along its normals, and the shoe shrunk to nine tenths about
its own centre. A gate that cannot tell the mutated file from the control is
not a gate. Everything is done in memory on the build's own inputs
(out/mika-milfy.vrm and its manifest, the same files the gates read).

The multipliers are NOT expected to equal the ones in that comment (bodice 38,
socks 20, skirt 11, cardigan 8, boot 2.83). Those were measured on the build
of 2026-08, and the garments have been rebuilt several times since (the ahoge
removed, the cardigan and shirt weights diffused for the armpit tear), which
changes both the pierced pixel count and the area the limit is derived from.
What has to hold, and what this prints a verdict on, is the separation: every
control at or under its limit, every mutation over it.
"""
import glob
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

import glb  # noqa: E402
import inside  # noqa: E402
import motion  # noqa: E402
import pierce  # noqa: E402

AV = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MODEL = os.path.join(AV, 'out', 'mika-milfy.vrm')
MANIFEST = os.path.join(AV, 'out', 'mika-milfy.parts.json')
CLIPS = sorted(glob.glob(os.path.join(AV, '..', '..', 'public', 'avatar', 'animations', '*.vrma')))
SINK = 0.025
SHRINK = 0.9


def write_accessor(doc, views, index, array):
    acc = doc['accessors'][index]
    bv = doc['bufferViews'][acc['bufferView']]
    dtype = glb.DTYPE[acc['componentType']]
    ncomp = glb.NCOMP[acc['type']]
    packed = dtype.itemsize * ncomp
    assert (bv.get('byteStride') or packed) == packed, 'interleaved accessor'
    start = acc.get('byteOffset', 0)
    data = np.ascontiguousarray(array, dtype=dtype).reshape(acc['count'], ncomp).tobytes()
    views[acc['bufferView']][start:start + len(data)] = data


def fresh():
    doc, binary = glb.load(MODEL)
    return doc, glb.views_of(doc, binary), json.load(open(MANIFEST))['parts']


def prims_of(doc, parts, name):
    mesh = next(m for m in doc['meshes'] if m.get('name') == parts[name]['mesh'])
    return [mesh['primitives'][i] for i in parts[name]['primitives']]


def sink(doc, views, parts, name, metres):
    """Move a garment INTO the body along its own normals."""
    for prim in prims_of(doc, parts, name):
        P = np.array(glb.read_accessor(doc, views, prim['attributes']['POSITION']))
        N = glb.read_accessor(doc, views, prim['attributes']['NORMAL'])
        write_accessor(doc, views, prim['attributes']['POSITION'], P - metres * N)


def shrink(doc, views, parts, name, factor):
    """Scale a garment about its own centroid: a boot a size too small."""
    prims = prims_of(doc, parts, name)
    allp = np.concatenate([glb.read_accessor(doc, views, p['attributes']['POSITION']) for p in prims])
    c = allp.mean(axis=0)
    for prim in prims:
        P = np.array(glb.read_accessor(doc, views, prim['attributes']['POSITION']))
        write_accessor(doc, views, prim['attributes']['POSITION'], c + (P - c) * factor)


def rest_ratio(doc, views, parts, name):
    """pierce.py at rest: skin pixels through the garment, over that garment's own limit."""
    r, a = pierce.count(doc, views, parts, detail=True)
    return r.get(name, 0) / max(pierce.limit(a.get(name, 0)), 1), r.get(name, 0)


def inside_count(doc, views, parts, name):
    n, total, deep = inside.measure(doc, views, parts, [name])[name]
    return n, total, deep


def motion_ratio(doc, views, parts, name, clips, samples=4):
    """motion.check's per-part worst ratio, on the given clips."""
    import tempfile
    tmp = os.path.join(tempfile.mkdtemp(), 'm.vrm')
    glb.save(tmp, doc, glb.rebuild(doc, views))
    rows, worst = motion.check(tmp, MANIFEST, clips, samples=samples)
    return worst.get(name, (0, 0, 0, 0, '', 0))


def main():
    print('control and mutations, at rest (pierce.py) and inside the body (inside.py):')
    print('| garment | mutation | pierce ratio (px) | inside n/total (deepest mm) |')
    print('|---|---|---|---|')
    ok = True
    cases = [('Outfit_Top', 'sink 25mm'), ('Outfit_Socks', 'sink 25mm'), ('Outfit_Bottom', 'sink 25mm'),
             ('Outfit_Cardigan', 'sink 25mm'), ('Outfit_Shoes', 'shrink 0.9')]
    for name, how in cases:
        doc, views, parts = fresh()
        c_ratio, c_px = rest_ratio(doc, views, parts, name)
        c_in = inside_count(doc, views, parts, name)
        doc, views, parts = fresh()
        if how.startswith('sink'):
            sink(doc, views, parts, name, SINK)
        else:
            shrink(doc, views, parts, name, SHRINK)
        m_ratio, m_px = rest_ratio(doc, views, parts, name)
        m_in = inside_count(doc, views, parts, name)
        print(f'| {name} | control | {c_ratio:.2f} ({c_px}) | {c_in[0]}/{c_in[1]} ({c_in[2]}) |')
        print(f'| {name} | {how} | {m_ratio:.2f} ({m_px}) | {m_in[0]}/{m_in[1]} ({m_in[2]}) |')
        gate_ok = c_ratio <= 1.0 < m_ratio
        ok &= gate_ok
        print(f'|  | pierce gate | {"control PASS, mutation FAIL" if gate_ok else "!!! does not separate"} | |')
    print()
    print('motion.py (the ten clips, 4 frames each, 3 views), the bodice sunk 25mm:')
    t0 = time.time()
    doc, views, parts = fresh()
    c = motion_ratio(doc, views, parts, 'Outfit_Top', CLIPS)
    doc, views, parts = fresh()
    sink(doc, views, parts, 'Outfit_Top', SINK)
    m = motion_ratio(doc, views, parts, 'Outfit_Top', CLIPS)
    print(f'  control  worst {c[0]:.2f}x ({c[1]} px of {c[2]:.0f}, {c[4]} t={c[5]}s)')
    print(f'  sunk     worst {m[0]:.2f}x ({m[1]} px of {m[2]:.0f}, {m[4]} t={m[5]}s)')
    gate_ok = c[0] <= 1.0 < m[0]
    ok &= gate_ok
    print(f'  motion gate: {"control PASS, mutation FAIL" if gate_ok else "!!! does not separate"}  ({time.time() - t0:.0f}s)')
    print()
    print('ALL SEPARATE' if ok else 'SOME GATE DOES NOT SEPARATE')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
