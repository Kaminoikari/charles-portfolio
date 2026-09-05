#!/usr/bin/env python3
"""The three analyses behind evidence/restpose-0905.md, so their numbers can be
re-derived. Run from the repo root:

    git show f828e8a:public/avatar/mika-milfy-10.vrm > /tmp/before.vrm
    python3 scripts/avatar/evidence/restpose-0905-analysis.py /tmp/before.vrm \
        public/avatar/mika-milfy-10.vrm

`before` is the last translation-only build (vertex sha ad8f3adc45f87430),
`after` the Phase 2 build (73cfb472ca1cb1c3). Four sections:

  0. the angle between each vendor segment and ours, for the limb segments
     that turn and the trunk segments that deliberately do not (the numbers
     the design decision in outfit.py's docstring rests on);
  1. per-primitive vertex displacement between the two files (same pipeline,
     same vertex order, so vertices pair by index);
  2. the four renders of both files with ONE framing (the bounds of `after`),
     because render.py frames off the mesh bounds and the 2.8mm the shoe
     dropped re-frames the whole figure by a fraction of a pixel;
  3. the cardigan's (No bra)Breasts_Cow shape key stretch straight out of
     outfit.pieces() -- before hug -- under four anchor/turn variants, to
     separate the anchor set from the rotation as the cause of the tear that
     keeps the vendor file's ignore list in place.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
AVATAR = os.path.dirname(HERE)
sys.path.insert(0, AVATAR)

import glb  # noqa: E402
import outfit  # noqa: E402
import render  # noqa: E402
import verify  # noqa: E402


def prims(path):
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    out = []
    for m in doc['meshes']:
        for i, pr in enumerate(m['primitives']):
            mat = doc['materials'][pr['material']]['name'] if 'material' in pr else '-'
            pos = glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
            out.append((m['name'], i, mat, pos))
    return out


def displacement(before, after):
    print('== 1. per-primitive displacement (after vs before) ==')
    a, b = prims(before), prims(after)
    print(f'primitives before {len(a)} after {len(b)}')
    moved = 0
    for (n1, i1, m1, p1), (n2, i2, m2, p2) in zip(a, b):
        assert (n1, i1, m1) == (n2, i2, m2), (n1, i1, n2, i2)
        if p1.shape != p2.shape:
            print(f'  {n1}#{i1} ({m1}) vertex count {p1.shape[0]} -> {p2.shape[0]}')
            moved += 1
            continue
        d = np.linalg.norm(p1 - p2, axis=1) * 1000
        if d.max() > 0.001:
            moved += 1
            print(f'  {n1}#{i1} ({m1}) max {d.max():6.1f}mm  mean {d.mean():5.1f}mm  '
                  f'moved(>0.5mm) {(d > 0.5).mean() * 100:5.1f}%  n={len(d)}')
    print(f'primitives unchanged: {len(a) - moved}, moved: {moved}')
    lo = min(p.min(axis=0)[1] for *_, p in a) * 1000
    hi = min(p.min(axis=0)[1] for *_, p in b) * 1000
    print(f'lowest vertex y: before {lo:.1f}mm, after {hi:.1f}mm (what re-frames the renders)')
    print()


def same_frame(before, after, out_dir):
    print('== 2. four renders with one framing (bounds of `after`) ==')
    doc, binary = glb.load(after)
    views = glb.views_of(doc, binary)
    pos, *_ = render.gather(doc, views)
    lo, hi = pos.min(axis=0), pos.max(axis=0)
    original = render.project

    def pinned(p, az, el, framing, size, head_y=None):
        if framing == 'head':
            return original(p, az, el, framing, size, head_y)
        a, e = np.radians(az), np.radians(el)
        ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
        rx = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]])
        q = p @ ry.T @ rx.T
        ref = pos @ ry.T @ rx.T
        centre_y = (lo[1] + hi[1]) / 2
        half = (hi[1] - lo[1]) / 2 * 1.06
        centre_x = (ref[:, 0].min() + ref[:, 0].max()) / 2
        w, h = size
        scale = h / (2 * half)
        return np.stack([(q[:, 0] - centre_x) * scale + w / 2,
                         h / 2 - (q[:, 1] - centre_y) * scale, q[:, 2]], axis=1)

    render.project = pinned
    try:
        render.render(before, os.path.join(out_dir, 'sameframe-before'))
        render.render(after, os.path.join(out_dir, 'sameframe-after'))
    finally:
        render.project = original
    for name in ('front', 'back', 'three_quarter', 'face'):
        a = np.asarray(Image.open(os.path.join(out_dir, f'sameframe-before-{name}.png')).convert('RGB')).astype(int)
        b = np.asarray(Image.open(os.path.join(out_dir, f'sameframe-after-{name}.png')).convert('RGB')).astype(int)
        d = np.abs(a - b).sum(axis=2)
        mask = d > 0
        h = mask.shape[0]
        rows = mask.sum(axis=1)
        bands = [int(rows[i * h // 10:(i + 1) * h // 10].sum()) for i in range(10)]
        print(f'  {name}: differing pixels {int(mask.sum())}  (>60) {int((d > 60).sum())}  '
              f'bands top->bottom {bands}')
    print()


def edges(p, tri):
    return np.stack([np.linalg.norm(p[tri[:, 1]] - p[tri[:, 0]], axis=1),
                     np.linalg.norm(p[tri[:, 2]] - p[tri[:, 1]], axis=1),
                     np.linalg.norm(p[tri[:, 0]] - p[tri[:, 2]], axis=1)], axis=1)


def variants(body, cardigan):
    print('== 3. Breasts_Cow stretch off outfit.pieces(), four anchor/turn variants ==')
    doc, binary = glb.load(body)
    views = glb.views_of(doc, binary)
    base = {'aliases': {'Thumb Proximal': 'thumbProximal'}, 'mirror': False}
    key = '(No bra)Breasts_Cow'
    saved = dict(outfit.CHILD_OF)

    def run(label, ignore, child_of=None):
        outfit.CHILD_OF.clear()
        outfit.CHILD_OF.update(saved if child_of is None else child_of)
        try:
            b = outfit.load(cardigan, doc, views, None, {}, override={**base, 'ignore': ignore})
            items = outfit.pieces(b, doc, views)
        finally:
            outfit.CHILD_OF.clear()
            outfit.CHILD_OF.update(saved)
        turned = sum(1 for i, (r, _, _) in b['correction'].items() if i in b['mapped'] and r is not None)
        for it in items:
            if key not in it['targets']:
                continue
            pos, tri, d = it['piece']['pos'], it['piece']['tris'], it['targets'][key]
            re, me = edges(pos, tri).max(1), edges(pos + d, tri).max(1)
            ratio = me / np.maximum(re, 1e-12)
            worst = np.argsort(-ratio)[:3]
            print(f'  {label:<34} scale x{b["scale"]:.3f} anchors {len(b["mapping"]["pairs"]):>2} '
                  f'turned {turned}  max stretch {ratio.max():.2f} at tris {[int(t) for t in worst]} '
                  f'centre {np.round(pos[tri[worst[0]]].mean(0), 3)}')

    run('10 anchors (shipped ignore)', ['Lower_arm_*', 'Hand_*', 'Thumb Proximal_*'])
    run('16 anchors', [])
    run('16 anchors, no turns', [], child_of={})
    run('16 anchors, legs turn only', [],
        child_of={'UpperLeg': 'LowerLeg', 'LowerLeg': 'Foot', 'Foot': 'Toes'})
    print()


def segment_angles(body, files):
    """Angle between each vendor segment (after the fit's half turn) and ours,
    for the segments the design decision rests on: the limb chain that turns
    (CHILD_OF) and the trunk pairs that deliberately do not."""
    print('== 0. segment directions, vendor rig vs ours (degrees) ==')
    import bonemap
    import humanoid
    doc, binary = glb.load(body)
    views = glb.views_of(doc, binary)
    tw = render.world_matrices(doc)
    tb = humanoid.bones(doc)
    trunk = [('hips', 'spine'), ('spine', 'chest'), ('chest', 'leftShoulder'), ('chest', 'rightShoulder'),
             ('leftShoulder', 'leftUpperArm'), ('rightShoulder', 'rightUpperArm')]
    limbs = [(s + a, s + b) for s in ('left', 'right') for a, b in outfit.CHILD_OF.items()]
    for path in files:
        src, sbin = glb.load(path)
        sw = render.world_matrices(src)
        mapping = bonemap.resolve(src, tb, {'aliases': {'Thumb Proximal': 'thumbProximal'}, 'mirror': False})
        by_name = {mapping['names'][i]: i for i, _ in mapping['pairs']}
        pairs = mapping['pairs']
        a, s, yaw = outfit._fit(np.array([sw[i][:3, 3] for i, _ in pairs]),
                                np.array([tw[j][:3, 3] for _, j in pairs]))
        print(f'  {os.path.basename(path)}: anchors {len(pairs)}, solved yaw {yaw:.2f}')
        for parent, child in trunk + limbs:
            if parent not in by_name or child not in by_name or parent not in tb or child not in tb:
                continue
            u = (a @ sw[by_name[child]])[:3, 3] - (a @ sw[by_name[parent]])[:3, 3]
            v = tw[tb[child]][:3, 3] - tw[tb[parent]][:3, 3]
            cos = float(u @ v / (np.linalg.norm(u) * np.linalg.norm(v)))
            kind = 'turns' if (parent, child) in limbs else 'trunk, no turn'
            print(f'    {parent:>14} -> {child:<14} {np.degrees(np.arccos(np.clip(cos, -1, 1))):5.1f}  ({kind})')
    print()


def torn_now(path):
    print(f'== torn triangles in the shipped file {os.path.basename(path)} (verify.torn_shapes limit) ==')
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    mesh = next(m for m in doc['meshes'] if m['name'] == 'Body.baked')
    names = mesh['extras']['targetNames']
    ti = names.index('(No bra)Breasts_Cow')
    for pi, pr in enumerate(mesh['primitives']):
        if not pr.get('targets') or doc['materials'][pr['material']]['name'] != 'Mellow_Outer':
            continue
        pos = glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
        tri = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
        d = glb.read_accessor(doc, views, pr['targets'][ti]['POSITION']).astype(np.float64)
        re, me = edges(pos, tri).max(1), edges(pos + d, tri).max(1)
        ratio = me / np.maximum(re, 1e-12)
        rest_n = np.cross(pos[tri[:, 1]] - pos[tri[:, 0]], pos[tri[:, 2]] - pos[tri[:, 0]])
        keyed = pos + d
        keyed_n = np.cross(keyed[tri[:, 1]] - keyed[tri[:, 0]], keyed[tri[:, 2]] - keyed[tri[:, 0]])
        flipped = int(((rest_n * keyed_n).sum(axis=1) < 0).sum())
        worst = np.argsort(-ratio)[:3]
        print(f'  Body.baked#{pi}: max stretch {ratio.max():.2f} (limit {verify.SHAPE_STRETCH_MAX}), '
              f'flipped faces {flipped}, worst tris {[int(t) for t in worst]} '
              f'centre {np.round(pos[tri[worst[0]]].mean(0), 3)}')
    print()


if __name__ == '__main__':
    before, after = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else '/tmp'
    body = os.path.join(AVATAR, '..', '..', 'public', 'avatar', 'mika-pink.vrm')
    cardigan = os.path.join(AVATAR, 'out', 'blender', 'mellow_outer.glb')
    print(f'before {before} vertex sha {verify.stats(before)["vertex_sha"]}')
    print(f'after  {after} vertex sha {verify.stats(after)["vertex_sha"]}')
    print()
    segment_angles(body, [os.path.join(AVATAR, 'out', 'blender', 'mellow.glb'), cardigan])
    displacement(before, after)
    same_frame(before, after, out_dir)
    torn_now(after)
    variants(body, cardigan)
