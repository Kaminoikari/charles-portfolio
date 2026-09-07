"""Does the derived waist band move the shipped body's outfit? Measured, not assumed.

    python3 scripts/avatar/evidence/scale-0907-drift.py

The waist search became fractions of the body's own hips->shoulder span on
2026-09-07 (build.WAIST_SEARCH). The fractions were chosen so this body's sample
grid is unchanged, which is a claim about a float grid and therefore has to be
measured: this prints the waist both ways and counts the vertices that change
side of each of the three torso edges the outfit is cut at.
"""
import os
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import build       # noqa: E402
import garment     # noqa: E402
import glb         # noqa: E402
import humanoid    # noqa: E402
import partition   # noqa: E402

AV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(os.path.dirname(os.path.dirname(AV)), 'public', 'avatar', 'mika-pink.vrm')

with tempfile.TemporaryDirectory() as work:
    parted, parts = os.path.join(work, 'p.vrm'), os.path.join(work, 'p.json')
    manifest, _ = partition.partition(BASE, parted, parts)
    doc, binary = glb.load(parted)
    views = glb.views_of(doc, binary)
    pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
    p = pool['pos']
    world, bones = humanoid.rest_world(doc), humanoid.bones(doc)
    neck = float(world[bones['neck']][1, 3])

    # The band as it was written until 2026-09-07.
    old_list = [(y, np.percentile(np.hypot(p[m][:, 0], p[m][:, 2]), 85))
                for y in np.arange(0.88, 1.16, 0.01)
                if (m := np.abs(p[:, 1] - y) < 0.012).sum() > 12]
    old_waist = min(old_list, key=lambda t: t[1])[0]
    new = build.landmarks(pool, doc)

    print(f'waist   was {old_waist:.9f}   now {new["waist"]:.9f}   '
          f'delta {(new["waist"] - old_waist) * 1e6:+.3f} µm')
    print(f'samples was {len(old_list)} slices in the band, now {len(old_list)} '
          f'(the grid is the same grid)')
    print()

    def edges(waist):
        span = new['shoulder'] - waist
        return {n: waist + span * f for n, f in build.TORSO_EDGES.items()}

    oe, ne = edges(old_waist), edges(new['waist'])
    for n in build.TORSO_EDGES:
        print(f'  {n:<14} {oe[n]:.9f} -> {ne[n]:.9f}  {(ne[n] - oe[n]) * 1e6:+.3f} µm')
    print()

    def masks(waist, e):
        return {
            'torso': (p[:, 1] < e['bandeau_top']) & (p[:, 1] > waist - 0.055)
                     & (np.abs(p[:, 0]) < 0.105),
            'strap': (p[:, 1] > e['strap_bottom']) & (p[:, 1] < neck),
            'sleeve': p[:, 1] > e['sleeve_bottom'],
        }

    a, b = masks(old_waist, oe), masks(new['waist'], ne)
    for n in a:
        print(f'  {n:<7} was {a[n].sum():5d}  now {b[n].sum():5d}  '
              f'vertices differing: {(a[n] ^ b[n]).sum()}')
