"""Health check for a VRM produced by this pipeline.

Everything here is read out of the file. Nothing is asserted about a render,
because the check that matters at this stage is whether the binary still says
what it said before — a loader can show you a plausible picture built from a
mesh whose weights have quietly shifted.

Run:  python3 verify.py <candidate.vrm> [baseline.vrm]
With a baseline, the skeleton comparison and the untouched-mesh comparison both
run. Without one, only the self-consistency checks run.

`report()` judges a FINISHED model -- what make.py step 6 hands over, or what a
customiser writes from one. Several of its checks are about decisions build.py
makes at the very end (every material declares a rim colour, no material is
left unused), so the half-built files in out/ fail it by design and always
will: out/parted.vrm has not been near build.py. make.py's own per-step `gate()`
is the one that runs on intermediates, and it asserts the skeleton only.
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


OUTLINE_CHROMA_MAX = 0.04


def loud_outlines(path, limit=OUTLINE_CHROMA_MAX):
    """Materials whose MToon outline colour is a hue rather than a dark neutral.

    The outline is a second draw pass, so an unlit renderer shows none of it and
    no gate built on one can fail because of it. It is also the single most
    visible thing in a browser: the line traces every silhouette and every fold,
    so a saturated one recolours the whole figure. VRoid's inherited wine,
    (0.275, 0.090, 0.125), has chroma 0.185 and reads as rust on pale skin.

    Chroma here is max channel minus min channel, which is what separates "a
    dark neutral line" from "a coloured line" regardless of how dark either is.
    """
    doc, _ = glb.load(path)
    loud = []
    for mat in doc['extensions']['VRM']['materialProperties']:
        rgb = mat.get('vectorProperties', {}).get('_OutlineColor')
        if rgb is None:
            continue
        chroma = max(rgb[:3]) - min(rgb[:3])
        if chroma > limit:
            loud.append((mat['name'], tuple(round(c, 3) for c in rgb[:3]), chroma))
    return loud


def undeclared_rims(path):
    """Materials that state no MToon rim colour, and so inherit the site's.

    The widget that draws this model scales whatever `_RimColor` each material
    was loaded with, and treats black as "unstated" -- three-vrm imports an
    absent `_RimColor` as (0,0,0), verified against mika-pink, which declares
    the property on none of its 19 materials and whose MToons all arrive
    black in the browser. An unstated rim therefore falls back to the
    site's own accent, which is mars orange chosen for a pink-haired body. One
    material added without a rim is one part of this outfit edged in rust while
    the rest is edged in mint, and no unlit gate can see either.
    """
    doc, _ = glb.load(path)
    quiet = []
    for mat in doc['extensions']['VRM']['materialProperties']:
        rgb = mat.get('vectorProperties', {}).get('_RimColor')
        if rgb is None or max(rgb[:3]) <= 0.0:
            quiet.append(mat['name'])
    return quiet


def unused_materials(path):
    """Materials no primitive paints with.

    Two sources, both silent. The base model's own outfit materials survive the
    strip that removes its cloth, and every material this build declares up
    front stays declared even when the branch that would have used it never ran.
    Ten of forty-four were dead before the sweep that now runs at the end of the
    build, and a dead material is not only wasted bytes: it is a name a
    customiser can retint, with nothing on screen changing.
    """
    doc, _ = glb.load(path)
    used = {pr['material'] for mesh in doc['meshes'] for pr in mesh['primitives']
            if 'material' in pr}
    return [m.get('name') for i, m in enumerate(doc['materials']) if i not in used]


def loose_sparse_bounds(path):
    """Sparse accessors whose declared min/max are not what the data resolves to.

    The spec is explicit that a sparse accessor's bounds describe the array
    WITH the substitution applied, and the tempting shortcut is to fold 0.0 in
    unconditionally because most of the array is zero. A primitive every one of
    whose vertices is patched has no zeros left, and then the declared bound is
    a value the data never reaches. Six of this model's targets are fully
    patched, and four of them were wrong that way -- invisible in a render
    (three.js widens morph bounds by the larger magnitude, which stayed right)
    and an outright rejection from glTF-Validator.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    bad = []
    for i, acc in enumerate(doc['accessors']):
        if 'sparse' not in acc or 'min' not in acc:
            continue
        vals = glb.read_accessor(doc, views, i).astype(np.float64)
        lo, hi = vals.min(axis=0), vals.max(axis=0)
        if not (np.allclose(lo, acc['min'], atol=0, rtol=1e-6)
                and np.allclose(hi, acc['max'], atol=0, rtol=1e-6)):
            bad.append((i, list(acc['min']), list(acc['max']),
                        lo.tolist(), hi.tolist()))
    return bad


def misaligned_material_properties(path):
    """Where `materials[i]` and the VRM block's `materialProperties[i]` disagree.

    VRM0 pairs the two arrays BY POSITION, so anything that prunes or reorders
    one has to do the same to the other in the same breath. Get it wrong and
    every MToon setting -- base colour, shade, outline, rim, the texture
    references -- lands on the wrong surface, while the file loads, every
    primitive still resolves to a material, and no count anywhere is off.

    This exists because the two writes in `customise.sweep_materials` are a pair
    that no single check was holding: deleting the materialProperties line alone
    left the model with 30 materials against 34 properties and every gate green.
    """
    doc, _ = glb.load(path)
    props = doc.get('extensions', {}).get('VRM', {}).get('materialProperties')
    if props is None:
        return []
    mats = doc.get('materials', [])
    if len(mats) != len(props):
        return [(-1, f'{len(mats)} materials', f'{len(props)} materialProperties')]
    return [(i, m.get('name'), p.get('name'))
            for i, (m, p) in enumerate(zip(mats, props))
            if m.get('name') != p.get('name')]


def ragged_targets(path):
    """Meshes whose primitives disagree about how many morph targets they have.

    glTF requires every primitive of a mesh to declare the same targets in the
    same order, and a file that breaks it is rejected outright by a strict
    loader while a lenient one draws the mesh with the wrong key bound to the
    wrong slider. Grafting a key onto the two garments that carry it and leaving
    the other twenty-one primitives of the same mesh alone is the obvious way to
    write this, and it is exactly the invalid file.
    """
    doc, _ = glb.load(path)
    ragged = []
    for mesh in doc['meshes']:
        counts = {len(pr.get('targets') or []) for pr in mesh['primitives']}
        if len(counts) > 1:
            ragged.append((mesh.get('name'), sorted(counts)))
    return ragged


SHAPE_STRETCH_MAX = 3.0


def torn_shapes(path, baseline=None, limit=SHAPE_STRETCH_MAX):
    """Morph targets this build grafted that tear their own mesh at 1.0.

    A shape key is a displacement per vertex with no constraint tying it to its
    neighbours, so a delta field with an isolated spike in it opens the mesh
    into long thin triangles. That is not hypothetical here: deriving these keys
    by settling the keyed shape through hug and subtracting produced exactly
    that, because hug is discontinuous and a vertex flipping from "clear" to
    "pushed" jumps by the whole clearance margin while its neighbours do not.

    Two measures, because they catch different halves: the longest edge growing
    past `limit` is a tear, and a face normal reversing is an inside-out fold.
    Both are read off the geometry rather than off a render -- an over-exposed
    screenshot of a white bodice looks shattered whatever the mesh is doing, and
    one of those cost an afternoon.

    Only the grafted keys. The base model's 56 face expressions fail both
    measures by design -- a closing eyelid IS a fold and its edges DO collapse
    -- and they have played correctly since long before this pipeline existed.
    They are recognised by the file itself: a mesh any `blendShapeMaster` group
    binds to is an expression mesh, and is skipped whole. Reading that out of
    the candidate rather than out of `baseline` matters, because `baseline` is
    optional here (see the module docstring) and a version of this that only
    knew the face when handed one reported 30 tears on a correct file.
    `baseline` still contributes when given, for a mesh that carried targets
    before this pipeline touched it without being bound to an expression.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    groups = (doc.get('extensions', {}).get('VRM', {})
              .get('blendShapeMaster', {}).get('blendShapeGroups', ()))
    bound = {b['mesh'] for g in groups for b in g.get('binds', ())}
    inherited = {m.get('name') for i, m in enumerate(doc['meshes']) if i in bound}
    if baseline:
        base, _ = glb.load(baseline)
        inherited |= {m.get('name') for m in base['meshes']
                      if any(pr.get('targets') for pr in m['primitives'])}
    bad = []
    for mesh in doc['meshes']:
        if mesh.get('name') in inherited:
            continue
        names = mesh.get('extras', {}).get('targetNames') or []
        for pi, pr in enumerate(mesh['primitives']):
            targets = pr.get('targets') or []
            if not targets:
                continue
            pos = glb.read_accessor(doc, views, pr['attributes']['POSITION'])
            pos = pos.astype(np.float64)
            tri = glb.read_accessor(doc, views, pr['indices'])
            tri = tri.astype(np.int64).reshape(-1, 3)

            def measure(p):
                e = np.stack([np.linalg.norm(p[tri[:, 1]] - p[tri[:, 0]], axis=1),
                              np.linalg.norm(p[tri[:, 2]] - p[tri[:, 1]], axis=1),
                              np.linalg.norm(p[tri[:, 0]] - p[tri[:, 2]], axis=1)],
                             axis=1).max(axis=1)
                n = np.cross(p[tri[:, 1]] - p[tri[:, 0]], p[tri[:, 2]] - p[tri[:, 0]])
                return e, n

            rest_e, rest_n = measure(pos)
            for ti, tgt in enumerate(targets):
                if 'POSITION' not in tgt:
                    continue
                d = glb.read_accessor(doc, views, tgt['POSITION']).astype(np.float64)
                if not np.abs(d).any():
                    continue
                keyed_e, keyed_n = measure(pos + d)
                stretch = float(((keyed_e + 1e-9) / (rest_e + 1e-9)).max())
                flipped = int(((rest_n * keyed_n).sum(axis=1) < 0).sum())
                if stretch > limit or flipped:
                    name = names[ti] if ti < len(names) else str(ti)
                    bad.append((mesh.get('name'), pi, name, stretch, flipped))
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
    # No triangle ceiling. There was a 40,000 cap here until 2026-08-31; it was
    # a project constraint rather than a limit any consumer imposes, and while
    # it stood every new accessory had to be paid for by decimating something
    # already on the model. The count is still printed above, because a number
    # that moves without anyone asking it to is worth seeing.

    flipped = backwards_winding(path)
    print(f'   backwards-wound primitives: {len(flipped)}')
    for name, pi, mat, share in flipped[:5]:
        print(f'   FAIL {name}#{pi} ({mat}) winds backwards, {share:.0%} agree')
    if flipped:
        ok = False

    loud = loud_outlines(path)
    print(f'   coloured outlines: {len(loud)}')
    for name, rgb, chroma in loud[:5]:
        print(f'   FAIL {name} outline {rgb} chroma {chroma:.3f} '
              f'exceeds {OUTLINE_CHROMA_MAX}')
    if loud:
        ok = False

    idle = unused_materials(path)
    print(f'   materials no primitive uses: {len(idle)}')
    for name in idle[:5]:
        print(f'   FAIL {name} is declared but painted on nothing')
    if idle:
        ok = False

    skew = misaligned_material_properties(path)
    print(f'   materials out of step with materialProperties: {len(skew)}')
    for i, a, b in skew[:5]:
        print(f'   FAIL index {i}: material {a!r} vs materialProperty {b!r}')
    if skew:
        ok = False

    loose = loose_sparse_bounds(path)
    print(f'   sparse accessors with wrong min/max: {len(loose)}')
    for i, dmin, dmax, amin, amax in loose[:5]:
        print(f'   FAIL accessor {i} declares {dmin}..{dmax}, resolves to '
              f'{amin}..{amax}')
    if loose:
        ok = False

    ragged = ragged_targets(path)
    print(f'   meshes with uneven morph target counts: {len(ragged)}')
    for mname, counts in ragged[:5]:
        print(f'   FAIL {mname} primitives declare {counts} targets')
    if ragged:
        ok = False

    torn = torn_shapes(path, baseline)
    print(f'   grafted shape keys that tear their mesh: {len(torn)}')
    for mname, pi, key, stretch, flipped in torn[:5]:
        print(f'   FAIL {mname}#{pi} "{key}" stretches an edge {stretch:.1f}x '
              f'and flips {flipped} faces')
    if torn:
        ok = False

    quiet = undeclared_rims(path)
    print(f'   materials with no rim colour: {len(quiet)}')
    for name in quiet[:5]:
        print(f'   FAIL {name} states no _RimColor, so it takes the site accent')
    if quiet:
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
