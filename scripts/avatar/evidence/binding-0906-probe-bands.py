#!/usr/bin/env python3
"""Annulus ratio (min r / max r around the hips axis) in the best 1cm band
below the crotch line, for the captured vendor pieces and the hand-built
skirt/frill; the unique nearest row of the head pieces."""
import json, os, sys
import numpy as np
from scipy.spatial import cKDTree
AV = '/Users/charles/portfolio/scripts/avatar'
sys.path.insert(0, AV)
import build, garment, glb, humanoid, envelope  # noqa
OUT = os.path.join(AV, 'out'); SCRATCH = os.path.dirname(os.path.abspath(__file__))
z = np.load(os.path.join(SCRATCH, 'captured.npz'))
items = {}
for k in z.files:
    i, m, n, a = k.split('|'); items.setdefault((int(i), m, n), {})[a] = z[k]
src = os.path.join(OUT, 'proportioned.vrm')
doc, binary = glb.load(src); views = glb.views_of(doc, binary)
manifest = json.load(open(os.path.join(OUT, 'parts.json')))
pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
skin = doc['skins'][humanoid.body_skin(doc, manifest)]
bones = humanoid.bones(doc); node_bone = humanoid.node_bone(doc)
lm = build.landmarks(pool, doc)
world = humanoid.rest_world(doc)
hx, hy, hz = world[bones['hips']][:3, 3]
hip, knee = lm['hip'], lm['knee']
crotch = hip - 0.25 * (hip - knee)
tree = cKDTree(pool['pos'])
groups = {}
for (i, m, n), p in sorted(items.items()):
    groups.setdefault(n, []).append(p['pos'])
env = envelope.load(os.path.join(OUT, 'leg-envelope.json'))
waist_y, hem_y = lm['waist'] - 0.02, hip - (hip - knee) * 0.34
hem = garment.skirt(pool, waist_y, hem_y, flare=1.25, clear=(0.018, 0.006), envelope=lambda y: envelope.radii_at(env, y))
groups['HAND_Outfit_Bottom'] = [hem['pos']]
groups['HAND_Acc_Frill_Hem'] = [garment.frill(hem['hem'], depth=0.034, waves=15)['pos']]
socks = (pool['pos'][:, 1] < knee + 0.040) & (pool['pos'][:, 1] > lm['ankle'] - 0.010)
groups['HAND_Outfit_Socks'] = [garment.shell(pool, socks, 0.006)['pos']]
feet = pool['pos'][:, 1] < lm['ankle'] + 0.035
groups['HAND_Outfit_Shoes'] = [garment.shell(pool, feet, 0.014)['pos']]
print(f'crotch {crotch:.3f}')
print(f"{'part':<24}{'n':>6} {'miny':>6}  bands below crotch: y cover ratio (best three by cover*ratio)")
for n, ps in groups.items():
    q = np.concatenate(ps)
    y0 = q[:, 1].min()
    bands = []
    for yb in np.arange(y0, min(crotch, q[:, 1].max()), 0.01):
        band = (q[:, 1] >= yb) & (q[:, 1] < yb + 0.01)
        if band.sum() < 6:
            continue
        dx, dz = q[band, 0] - hx, q[band, 2] - hz
        ang = np.arctan2(dz, dx)
        sec = np.floor((ang + np.pi) / (2 * np.pi / 12)).astype(int) % 12
        cov = len(set(sec.tolist())) / 12
        r = np.hypot(dx, dz)
        ratio = float(r.min() / r.max())
        bands.append((cov * ratio, yb, cov, ratio, float(r.min()), float(r.max())))
    bands.sort(reverse=True)
    desc = '  '.join(f'y{b[1]:.3f} c{b[2]:.2f} q{b[3]:.2f} r{b[4]*1000:.0f}-{b[5]*1000:.0f}' for b in bands[:3])
    print(f"{n:<24}{len(q):>6} {y0:6.3f}  {desc}")
print('--- head pieces: unique nearest row')
for n, ps in groups.items():
    if not n.startswith(('Hair_', 'Acc_Crown', 'Acc_HairClip', 'Acc_Ribbon_Hair')):
        continue
    q = np.concatenate(ps)
    _, near = tree.query(q)
    rows = {tuple(pool['joints'][c].tolist() + [round(float(x), 6) for x in pool['weights'][c]]) for c in near}
    print(n, rows, 'head slot', skin['joints'].index(bones['head']))
