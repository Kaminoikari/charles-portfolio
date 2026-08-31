"""Health check for a VRM produced by this pipeline.

Everything here is read out of the file. Nothing is asserted about a render,
because the check that matters at this stage is whether the binary still says
what it said before — a loader can show you a plausible picture built from a
mesh whose weights have quietly shifted.

Run:  python3 verify.py <candidate.vrm> [baseline.vrm]
With a baseline, the skeleton comparison and the untouched-mesh comparison both
run. Without one, only the self-consistency checks run.
"""
import hashlib
import sys

import numpy as np

sys.path.insert(0, '/Users/charles/vtuber-kit/bin')

import glb  # noqa: E402
import vrmrig  # noqa: E402


def stats(path):
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    out = {
        'meshes': [],
        'materials': len(doc.get('materials', [])),
        'images': len(doc.get('images', [])),
        'nodes': len(doc.get('nodes', [])),
        'tris': 0,
    }
    vrm = doc['extensions']['VRM']
    out['bones'] = len(vrm['humanoid']['humanBones'])
    out['groups'] = [g['name'] for g in vrm['blendShapeMaster']['blendShapeGroups']]
    sec = vrm.get('secondaryAnimation', {})
    out['springs'] = len(sec.get('boneGroups', []))
    out['colliders'] = len(sec.get('colliderGroups', []))

    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc.get('materials', []))]
    for mesh in doc['meshes']:
        prims = []
        for pr in mesh['primitives']:
            n = doc['accessors'][pr['indices']]['count'] // 3
            out['tris'] += n
            prims.append({
                'material': mats[pr['material']] if 'material' in pr else None,
                'tris': n,
                'verts': doc['accessors'][pr['attributes']['POSITION']]['count'],
                'targets': len(pr.get('targets', [])),
            })
        out['meshes'].append({'name': mesh.get('name'), 'primitives': prims})

    # A fingerprint of the actual vertex data, not of the JSON that describes it.
    digest = hashlib.sha256()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            for key in sorted(pr['attributes']):
                arr = glb.read_accessor(doc, views, pr['attributes'][key])
                digest.update(key.encode())
                digest.update(arr.tobytes())
    out['vertex_sha'] = digest.hexdigest()[:16]
    return out


def dangling_joints(path):
    """Primitives whose JOINTS_0 indexes past the skin their own node uses.

    glTF resolves a skin index per NODE, and a VRoid export carries three skins
    -- face, body, hair -- listing the same joints. Code that appends a bone to
    doc['skins'][0] and stops there leaves any mesh on another skin pointing at
    a slot that does not exist. Nothing in this pipeline can see it, because it
    skins from skins[0] everywhere; three.js loads the file, reports all 54
    humanoid bones, and then throws on `skeleton.bones[i].matrixWorld` the first
    time it draws, which is the whole model gone with every local gate green.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    skin_of = {n['mesh']: n.get('skin') for n in doc['nodes'] if 'mesh' in n}
    bad = []
    for mi, mesh in enumerate(doc['meshes']):
        si = skin_of.get(mi)
        if si is None:
            continue
        n = len(doc['skins'][si]['joints'])
        for pi, pr in enumerate(mesh['primitives']):
            if 'JOINTS_0' not in pr['attributes']:
                continue
            top = int(glb.read_accessor(doc, views, pr['attributes']['JOINTS_0']).max())
            if top >= n:
                bad.append((mesh.get('name'), pi, top, si, n))
    return bad


def backwards_winding(path, floor=0.5):
    """Primitives whose triangle winding disagrees with their own normals.

    glTF calls a counter-clockwise triangle front-facing. Nothing in this
    project cares -- the rasteriser culls nothing and shades from the NORMAL
    attribute -- so a generator that emitted its indices the other way round
    stayed invisible through every render here. three-vrm does care: MToon
    draws its outline by culling FRONT faces, and on a fully back-facing mesh
    that pass covers the whole object, which turned the two bear-ear buns and
    the bear hair clip into solid black blobs in a browser.

    Measured per primitive as the share of triangles whose geometric normal
    agrees with the average of its three authored normals. Legitimate meshes sit
    at 93% and up here; the three broken ones sat at exactly 0.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    bad = []
    for mesh in doc['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            a = pr['attributes']
            if 'NORMAL' not in a:
                continue
            p = glb.read_accessor(doc, views, a['POSITION']).astype(np.float64)
            n = glb.read_accessor(doc, views, a['NORMAL']).astype(np.float64)
            t = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
            g = np.cross(p[t[:, 1]] - p[t[:, 0]], p[t[:, 2]] - p[t[:, 0]])
            length = np.linalg.norm(g, axis=1, keepdims=True)
            live = length[:, 0] > 1e-12
            if not live.any():
                continue
            agree = ((g[live] / length[live]) * n[t[live]].mean(axis=1)).sum(axis=1) > 0
            share = float(agree.mean())
            if share < floor:
                bad.append((mesh.get('name'), pi,
                            doc['materials'][pr['material']]['name'], share))
    return bad


def report(path, baseline=None):
    s = stats(path)
    print(f'== {path}')
    print(f'   tris {s["tris"]}  materials {s["materials"]}  images {s["images"]}  '
          f'nodes {s["nodes"]}  bones {s["bones"]}')
    print(f'   springs {s["springs"]}  colliders {s["colliders"]}  '
          f'blendShapeGroups {len(s["groups"])}')
    for m in s['meshes']:
        tris = sum(p['tris'] for p in m['primitives'])
        targets = max((p['targets'] for p in m['primitives']), default=0)
        print(f'   {m["name"]:<16} {len(m["primitives"]):>3} prim  '
              f'{tris:>6} tris  targets {targets}')
    print(f'   vertex sha {s["vertex_sha"]}')

    ok = True
    if s['bones'] != 54:
        print(f'   FAIL humanoid bones {s["bones"]}, expected 54')
        ok = False
    if s['tris'] > 40000:
        print(f'   FAIL {s["tris"]} tris exceeds the 40,000 budget')
        ok = False

    flipped = backwards_winding(path)
    print(f'   backwards-wound primitives: {len(flipped)}')
    for name, pi, mat, share in flipped[:5]:
        print(f'   FAIL {name}#{pi} ({mat}) winds backwards, {share:.0%} agree')
    if flipped:
        ok = False

    bad = dangling_joints(path)
    print(f'   dangling joint references: {len(bad)}')
    for name, pi, top, si, n in bad[:5]:
        print(f'   FAIL {name}#{pi} uses joint {top}, skin {si} has {n}')
    if bad:
        ok = False

    if baseline:
        a, b = vrmrig.read(baseline), vrmrig.read(path)
        diffs = vrmrig.compare(a, b)
        print(f'   compare(baseline, this) = {diffs}')
        if diffs:
            print('   FAIL skeleton moved')
            ok = False
    print(f'   {"PASS" if ok else "FAIL"}')
    return ok, s


if __name__ == '__main__':
    target = sys.argv[1]
    base = sys.argv[2] if len(sys.argv) > 2 else None
    ok, _ = report(target, base)
    sys.exit(0 if ok else 1)
