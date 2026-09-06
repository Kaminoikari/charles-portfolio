#!/usr/bin/env python3
"""Probe: run build() once, capture every attached piece, and print the
geometric signals a chooser could read next to the strategy today's code
path actually used (known from the call site, keyed by part name)."""
import json
import os
import sys

import numpy as np
from scipy.spatial import cKDTree

AV = '/Users/charles/portfolio/scripts/avatar'
sys.path.insert(0, AV)
import build  # noqa: E402
import garment  # noqa: E402
import glb  # noqa: E402
import humanoid  # noqa: E402

OUT = os.path.join(AV, 'out')
SCRATCH = os.path.dirname(os.path.abspath(__file__))

captured = []
_attach = garment.attach


def spy(doc, views, mesh_name, piece, material, part_name):
    captured.append((mesh_name, part_name, {k: np.array(v) for k, v in piece.items()
                                            if k in ('pos', 'joints', 'weights', 'tris')}))
    return _attach(doc, views, mesh_name, piece, material, part_name)


garment.attach = spy
build.garment.attach = spy

# Today's strategy per part name, from the MELLOW call sites in build.py.
# Run with dst outside out/ (no mellow, no Blender) the same names are the
# hand-built pieces: Outfit_Top/Cardigan/Socks/Shoes are then shells
# (inherit) and Hair_Bun/Acc_Crown the parametric fallbacks; read the
# `today` column of binding-0906-probe-hand.log with that in mind.
TODAY = {
    'Outfit_Top': 'nearest+16', 'Outfit_Cardigan': 'nearest+16',
    'Outfit_Bottom': 'drape', 'Outfit_Socks': 'nearest', 'Outfit_Shoes': 'nearest',
    'Acc_Ribbon_Neck': 'nearest', 'Acc_Belt_Waist': 'nearest',
    'Acc_Bandage_Thigh': 'nearest',
    'Acc_Ribbon_Waist': 'nearest', 'Acc_Ribbon_Waist#knot': 'nearest',
    'Acc_Ribbon_Hair': 'nearest', 'Acc_Bow_Skirt': 'nearest',
    'Hair_Ear_L': 'single', 'Hair_Ear_L#inner': 'single', 'Hair_Bun_L': 'single',
    'Hair_Ear_R': 'single', 'Hair_Ear_R#inner': 'single', 'Hair_Bun_R': 'single',
    'Acc_Crown': 'single', 'Acc_Crown#inner': 'single',
    'Acc_HairClip_Plaster': 'single', 'Acc_HairClip_Plaster#pad': 'single',
    'Acc_HairClip_Bear': 'single', 'Acc_HairClip_Bear#face': 'single',
    'Acc_HairClip_Bars': 'single',
}

src = os.path.join(OUT, 'proportioned.vrm')
dst = os.path.join(OUT, 'probe-binding.vrm')
build.build(src, dst, os.path.join(OUT, 'parts.json'), os.path.join(SCRATCH, 'probe.parts.json'))

doc, binary = glb.load(src)
views = glb.views_of(doc, binary)
manifest = json.load(open(os.path.join(OUT, 'parts.json')))
pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
skin = doc['skins'][humanoid.body_skin(doc, manifest)]
bones = humanoid.bones(doc)
node_bone = humanoid.node_bone(doc)
lm = build.landmarks(pool, doc)
slot_bone = [node_bone.get(n, doc['nodes'][n].get('name', '?')) for n in skin['joints']]


def side_of(bone):
    if bone.startswith('left'):
        return 'L'
    if bone.startswith('right'):
        return 'R'
    return 'C'


tree = cKDTree(pool['pos'])
dom_pool = pool['joints'][np.arange(len(pool['joints'])), pool['weights'].argmax(axis=1)]

print(f"hip {lm['hip']:.3f} knee {lm['knee']:.3f} waist {lm['waist']:.3f} neck {lm['neck']:.3f}")
hdr = f"{'part':<26}{'n':>6} {'today':<11} {'L':>5}{'R':>5}{'C':>5} {'belowhip':>8} {'dom#':>5} {'wvar':>7} {'diam':>6} {'comp':>5} {'span':>5} {'uni':>4}  lead"
print(hdr)
rows = []
seen = set()
for mesh_name, name, piece in captured:
    key = name
    if key in seen:
        key = name + '*'
    seen.add(key)
    q = piece['pos']
    d, near = tree.query(q)
    dom = dom_pool[near]
    sides = np.array([side_of(slot_bone[j]) for j in dom])
    L, R, C = [(sides == s).mean() for s in 'LRC']
    below = (q[:, 1] < lm['hip']).mean()
    # weight variance among nearest rows, as a dense joint histogram
    slots = len(skin['joints'])
    dense = np.zeros((len(q), slots))
    bj, bw = pool['joints'][near], pool['weights'][near]
    for c in range(bj.shape[1]):
        np.add.at(dense, (np.arange(len(q)), bj[:, c]), bw[:, c])
    wvar = float(dense.var(axis=0).sum())
    ndom = len(set(dom.tolist()))
    diam = float(np.linalg.norm(q.max(axis=0) - q.min(axis=0)))
    # connected components over welded edges
    seam, edges = garment.welded_edges({'pos': q, 'tris': piece['tris']})
    nverts = int(seam.max()) + 1
    parent = list(range(nverts))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    for a, b in edges:
        ra, rb = find(int(a)), find(int(b))
        if ra != rb:
            parent[ra] = rb
    comp = np.array([find(int(s)) for s in seam])
    ncomp = len(set(comp.tolist()))
    # does any single component span both sides (>=20% each)?
    spans = 0
    for c in set(comp.tolist()):
        m = comp == c
        if (sides[m] == 'L').mean() >= 0.2 and (sides[m] == 'R').mean() >= 0.2:
            spans += 1
    # uniform rows on the piece as attached?
    uni = bool((piece['joints'] == piece['joints'][0]).all() and (piece['weights'] == piece['weights'][0]).all())
    share = dense.sum(axis=0) / dense.sum()
    top = np.argsort(-share)[:3]
    lead = ', '.join(f'{slot_bone[j]} {share[j]:.2f}' for j in top)
    print(f"{key:<26}{len(q):>6} {TODAY.get(name, '?'):<11} {L:5.2f}{R:5.2f}{C:5.2f} {below:8.2f} {ndom:5d} {wvar:7.4f} {diam*1000:6.0f} {ncomp:5d} {spans:5d} {'y' if uni else 'n':>4}  {lead}")
