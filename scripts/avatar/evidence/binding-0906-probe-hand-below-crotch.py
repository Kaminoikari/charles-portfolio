#!/usr/bin/env python3
"""Hand-path pieces below the crotch line that the mellow build skips (bear
face, calf and ankle wraps): their best band's coverage/annulus, and the
chooser's verdict, built exactly as build.py builds them."""
import json, os, sys
import numpy as np
AV = '/Users/charles/portfolio/scripts/avatar'
sys.path.insert(0, AV)
import build, garment, glb, humanoid, binding  # noqa
OUT = os.path.join(AV, 'out')
doc, binary = glb.load(os.path.join(OUT, 'proportioned.vrm')); views = glb.views_of(doc, binary)
manifest = json.load(open(os.path.join(OUT, 'parts.json')))
pool = garment.body_pool(doc, views, manifest, 'Body_Skin'); p = pool['pos']
lm = build.landmarks(pool, doc); hip, knee, ankle = lm['hip'], lm['knee'], lm['ankle']
ctx = binding.context(doc, pool, manifest, lm, drape=(lm['waist'] - 0.02, hip - (hip - knee) * 0.34))
pieces = {}
face_bits = []
for sx in (-1, 1):
    cx = sx * 0.045
    j = np.argmin(np.abs(p[:, 1] - ankle))
    for ex in (-0.017, 0.017):
        face_bits.append(garment.sphere([cx + ex, 0.066, -0.128], 0.0055, pool['joints'][j], pool['weights'][j], lat=5, lon=8))
    face_bits.append(garment.sphere([cx, 0.052, -0.132], 0.0065, pool['joints'][j], pool['weights'][j], lat=5, lon=8, squash=(1.4, 0.9, 0.8)))
pieces['Acc_Bear_Face'] = garment.merge(face_bits)
def wrap(y, side, half_height, thickness=0.012):
    on = np.sign(p[:, 0]) == side
    span = on & (np.abs(p[:, 1] - y) < half_height + 0.012)
    leg = p[span]
    cx, cz = float(np.median(leg[:, 0])), float(np.median(leg[:, 2]))
    radius = np.hypot(leg[:, 0] - cx, leg[:, 2] - cz)
    lower = leg[:, 1] <= y
    r0 = float(radius[lower].max()) if lower.any() else float(radius.max())
    r1 = float(radius[~lower].max()) if (~lower).any() else float(radius.max())
    near = int(np.argmin(np.abs(p[:, 1] - y) + np.abs(p[:, 0] - cx) * 3))
    return garment.tube([cx, y - half_height, cz], [cx, y + half_height, cz], r0 + thickness, r1 + thickness, pool['joints'][near], pool['weights'][near], segments=24, rings=3)
pieces['Acc_Bandage_Thigh'] = wrap(0.652, -1, 0.032)
pieces['Acc_Bandage_Calf'] = wrap(ankle + (knee - ankle) * 0.38, 1, 0.046)
pieces['Acc_Bandage_Ankle'] = wrap(ankle + 0.030, -1, 0.018)
print(f"crotch {ctx['crotch']:.4f}")
for name, piece in pieces.items():
    sig = binding.signals(ctx, [piece]); band = sig['band']
    d = binding.choose(ctx, sig, 'param')
    b = 'no band' if band is None else f'y{band[0]:.3f} cover {band[1]:.2f} annulus {band[2]:.2f}'
    print(f"{name:<20} n={sig['n']:<4} best band: {b:<40} one_joint={sig['one_joint']}  -> {d['strategy']}")
