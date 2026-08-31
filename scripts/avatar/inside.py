"""Is a garment vertex inside the body? Decided by ray parity, not by normals.

The metric this replaces measured depth along the nearest body vertex's own
normal, and it cannot be trusted where the body is concave. Under the collar the
deepest reading was 29.7mm at a distance of exactly 29.7mm, which means the
displacement was anti-parallel to the normal: the collarbone's normal points up
and forward, so the hollow beneath it reads as "inside" no matter what is there.

Parity has no such blind spot. Fire a ray from the point and count how many times
it crosses the body surface; an odd count means it started inside. The body is
not perfectly watertight (54 of its 11,625 edges belong to one triangle only,
around the eye and mouth openings), so a single ray can be wrong if it happens to
leave through a hole. Five directions with a majority vote makes that harmless
unless a point sees three holes at once, which the sockets are far too small to
arrange.

Being inside the body is not by itself a defect. A collar is a ring and a shoe is
a cup, so their inner walls sit inside the neck and the foot on purpose and can
never be seen. What shows on screen is an OUTWARD-facing piece of cloth buried in
skin, because then the skin is the outer surface and pokes through. So a buried
point counts only when its own normal agrees with the body normal beside it,
which is exactly the outer-wall case and excludes every lining.

Reported depth is the distance to the nearest body VERTEX, which overstates the
true depth to the surface. It is a magnitude, not a measurement; the count of
vertices judged inside is the number that decides the gate.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import pose as pose_mod  # noqa: E402

# Fixed directions, deliberately off-axis so no ray runs along a seam or lies in
# the plane of the many axis-aligned triangles a modelled body contains.
DIRS = np.array([
    [0.3574, 0.8623, 0.3585],
    [-0.7896, 0.2265, 0.5703],
    [0.5121, -0.4372, 0.7392],
    [-0.2814, -0.6631, -0.6935],
    [0.6912, 0.4118, -0.5942],
])
DIRS /= np.linalg.norm(DIRS, axis=1, keepdims=True)
CHUNK = 160


def triangles(doc, views, parts, name, posed):
    mesh = parts[name]['mesh']
    src = next(m for m in doc['meshes'] if m.get('name') == mesh)
    out = []
    for i in parts[name]['primitives']:
        p = posed[(mesh, i)]
        idx = glb.read_accessor(doc, views, src['primitives'][i]['indices'])
        out.append(p[idx.astype(np.int64).reshape(-1, 3)])
    return np.concatenate(out)


def crossings(points, tris, d):
    """How many times a ray from each point along `d` pierces the surface.

    Moller-Trumbore, batched over points and triangles at once.
    """
    v0, e1, e2 = tris[:, 0], tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]
    pv = np.cross(np.broadcast_to(d, e2.shape), e2)
    det = np.einsum('ij,ij->i', e1, pv)
    live = np.abs(det) > 1e-12
    v0, e1, e2, pv, det = v0[live], e1[live], e2[live], pv[live], det[live]
    inv = 1.0 / det

    counts = np.empty(len(points), dtype=np.int32)
    for s in range(0, len(points), CHUNK):
        blk = points[s:s + CHUNK]
        tv = blk[:, None, :] - v0[None, :, :]
        u = np.einsum('ptj,tj->pt', tv, pv) * inv
        qv = np.cross(tv, e1[None, :, :])
        v = np.einsum('ptj,j->pt', qv, d) * inv
        t = np.einsum('ptj,tj->pt', qv, e2) * inv
        hit = (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-6)
        counts[s:s + CHUNK] = hit.sum(axis=1)
    return counts


def inside(points, tris):
    votes = np.zeros(len(points), dtype=np.int32)
    for d in DIRS:
        votes += (crossings(points, tris, d) % 2).astype(np.int32)
    return votes > len(DIRS) // 2


def measure(doc, views, parts, garments, rotations=None, replace=True,
            body='Body_Skin', cap=300):
    posed = pose_mod.skinned(doc, views, rotations or {}, replace)
    norms = pose_mod.skinned_normals(doc, views, rotations or {}, replace)
    tris = triangles(doc, views, parts, body, posed)
    verts = np.concatenate([posed[(parts[body]['mesh'], i)]
                            for i in parts[body]['primitives']])
    bnorm = np.concatenate([norms[(parts[body]['mesh'], i)]
                            for i in parts[body]['primitives']])

    report = {}
    for name in garments:
        info = parts.get(name)
        if not info or not info['primitives']:
            continue
        step = None
        pts, pn = [], []
        for i in info['primitives']:
            pts.append(posed[(info['mesh'], i)])
            pn.append(norms[(info['mesh'], i)])
        pts, pn = np.concatenate(pts), np.concatenate(pn)
        step = max(1, len(pts) // cap)
        pts, pn = pts[::step], pn[::step]

        bad = inside(pts, tris)
        n, deep = 0, 0.0
        if bad.any():
            d = np.linalg.norm(verts[None, :, :] - pts[bad][:, None, :], axis=2)
            k = d.argmin(axis=1)
            facing = np.einsum('ij,ij->i', pn[bad], bnorm[k]) > 0
            n = int(facing.sum())
            if n:
                deep = float(d.min(axis=1)[facing].max()) * 1000
        report[name] = (n, len(pts), round(deep, 1))
    return report


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    doc, binary = glb.load(os.path.join(base, 'out', 'mika-milfy.vrm'))
    views = glb.views_of(doc, binary)
    parts = json.load(open(os.path.join(base, 'out', 'mika-milfy.parts.json')))['parts']
    garments = [n for n in parts
                if n.startswith(('Outfit_', 'Acc_')) and parts[n]['primitives']]
    print('at rest:')
    for name, (n, total, deep) in sorted(measure(doc, views, parts, garments).items()):
        mark = '' if not n else f'   <-- {deep}mm at the deepest'
        print(f'  {name:<24} {n:>3}/{total} vertices inside the body{mark}')
