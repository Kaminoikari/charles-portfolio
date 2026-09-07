"""How far does a rebuild actually move the shipped body, and which commit moved it?

    python3 scripts/avatar/evidence/scale-0907-shipdiff.py

Three vertex shas disagree (evidence/scale-0907-sha.log): the shipped
mika-milfy-12.vrm, a rebuild at HEAD, and a rebuild at HEAD with only the old
absolute waist band restored. A sha says two files differ; it does not say by
how much, and "how much" is the whole question when the decision is whether the
body has to ship again under a new name.

This rebuilds twice, keeps both files, and reports the largest per-vertex
distance against the shipped body and against each other, per mesh.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

AV = Path('/Users/charles/portfolio/scripts/avatar')
sys.path.insert(0, str(AV))
import glb       # noqa: E402
import verify    # noqa: E402

BUILD = AV / 'build.py'
SHIPPED = AV.parent.parent / 'public' / 'avatar' / 'mika-milfy-12.vrm'

NEW = ("             for y in np.arange(hips_y + span * w['from'], hips_y + span * w['to'],\n"
       "                                span * w['step'])\n"
       "             if (m := np.abs(p[:, 1] - y) < span * w['slab']).sum() > 12]\n")
OLD = ("             for y in np.arange(0.88, 1.16, 0.01)\n"
       "             if (m := np.abs(p[:, 1] - y) < 0.012).sum() > 12]\n")


def positions(path):
    """{(mesh name, primitive index): POSITION array} for every primitive."""
    doc, binary = glb.load(str(path))
    views = glb.views_of(doc, binary)
    out = {}
    for mesh in doc['meshes']:
        for i, pr in enumerate(mesh['primitives']):
            out[(mesh.get('name'), i)] = glb.read_accessor(
                doc, views, pr['attributes']['POSITION']).astype(np.float64)
    return out


def attributes(path):
    """Every attribute of every primitive, not just POSITION.

    verify's vertex sha hashes all of them, so two builds can differ in sha
    while every vertex sits in exactly the same place -- which is what happened
    to the waist change, and reporting the sha alone would have implied the
    geometry moved when it did not.
    """
    doc, binary = glb.load(str(path))
    views = glb.views_of(doc, binary)
    out = {}
    for mesh in doc['meshes']:
        for i, pr in enumerate(mesh['primitives']):
            for key, acc in pr['attributes'].items():
                out[(mesh.get('name'), i, key)] = glb.read_accessor(doc, views, acc)
    return out


def compare_attributes(label, a, b):
    worst = {}
    for k in sorted(set(a) & set(b), key=str):
        x, y = a[k], b[k]
        if x.shape != y.shape:
            print(f'  {label}: {k} changed shape {x.shape} -> {y.shape}')
            continue
        rows = int((x != y).any(axis=1).sum())
        if rows:
            d = float(np.abs(x.astype(np.float64) - y.astype(np.float64)).max())
            n, most, where = worst.get(k[2], (0, 0.0, None))
            worst[k[2]] = (n + rows, max(most, d), k[:2])
    if not worst:
        print(f'  {label}: every attribute of every primitive is byte-identical')
    for key, (n, d, where) in sorted(worst.items()):
        print(f'  {label}: {key} differs on {n} rows, largest |delta| {d:.6g}, e.g. {where}')


def compare(label, a, b):
    worst, where, differing, total = 0.0, None, 0, 0
    for key in sorted(set(a) & set(b), key=lambda k: (str(k[0]), k[1])):
        pa, pb = a[key], b[key]
        total += len(pa)
        if pa.shape != pb.shape:
            print(f'  {label}: {key} changed vertex count {pa.shape} -> {pb.shape}')
            continue
        d = np.linalg.norm(pa - pb, axis=1)
        differing += int((d > 0).sum())
        if d.max() > worst:
            worst, where = float(d.max()), key
    print(f'  {label}: worst {worst * 1e6:.3f} µm at {where}; '
          f'{differing} of {total} vertices differ at all')
    return worst


def main():
    print(f'shipped  {verify.stats(str(SHIPPED))["vertex_sha"]}  {SHIPPED.name}')
    keep = Path(tempfile.mkdtemp(prefix='shipdiff-keep-'))

    head = keep / 'head.vrm'
    subprocess.run([sys.executable, str(AV / 'evidence' / 'scale-0907-buildkeep.py'),
                    str(head)], cwd=AV, check=True)
    print(f'HEAD     {verify.stats(str(head))["vertex_sha"]}')

    backup = keep / 'build.py.bak'
    shutil.copy2(BUILD, backup)
    assert BUILD.read_text().count(NEW) == 1
    BUILD.write_text(BUILD.read_text().replace(NEW, OLD))
    oldband = keep / 'oldband.vrm'
    try:
        subprocess.run([sys.executable, str(AV / 'evidence' / 'scale-0907-buildkeep.py'),
                        str(oldband)], cwd=AV, check=True)
    finally:
        shutil.copy2(backup, BUILD)
    print(f'old band {verify.stats(str(oldband))["vertex_sha"]}')
    print()

    ship, h, o = positions(SHIPPED), positions(head), positions(oldband)
    print('largest per-vertex distance:')
    compare('shipped -> HEAD rebuild        ', ship, h)
    compare('shipped -> old-band rebuild    ', ship, o)
    compare('old-band -> HEAD (waist change)', o, h)

    print()
    print('and since the sha covers every attribute, not only POSITION:')
    compare_attributes('old-band -> HEAD  ', attributes(oldband), attributes(head))
    compare_attributes('shipped  -> HEAD  ', attributes(SHIPPED), attributes(head))
    return 0


if __name__ == '__main__':
    sys.exit(main())
