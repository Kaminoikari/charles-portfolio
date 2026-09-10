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

Both VRM versions. Every version-specific reading goes through humanoid.py, the
same as everywhere else in this pipeline. Five checks here used to index
`extensions.VRM` themselves. Pointed at a 1.0 file, two of them raised, one
measured the face's own eyelids and reported 45 tears on a correct model, and
two returned an empty list, which reads as a pass
(evidence/verify-vrm1-0910.md). The one check that genuinely has no 1.0 meaning,
`misaligned_material_properties`, says so with NOT_APPLICABLE rather than with
an empty list.
"""
import hashlib
import sys

import numpy as np


import glb  # noqa: E402
import humanoid  # noqa: E402
import pose  # noqa: E402

# How much one edge of a skinned primitive may grow, in millimetres, when a
# single joint turns through the bends below. Absolute, not a ratio: the ratio
# is owned by 1mm edges at the bust that quadruple without anyone seeing it,
# while the tear the owner saw was 11mm edges pulled to 74mm. Calibrated on
# 2026-09-06 (evidence/armpit-0906.md): the body's own skin reaches 17mm, the
# cardigan re-bound nearest with 16 smoothing passes 15mm, at 4 passes 27mm, and the
# nearest-vertex binding it replaced 77mm at the armpit and 52mm at the elbow
# -- the black and mint shards under both arms in the dance.
BIND_GROWTH_MAX_MM = 25.0
# (humanoid bone, axis, degrees). The upper arm is bent both ways because the
# armpit folds differently when the arm rises than when it drops, and the
# idle pose holds it about 60 degrees below the T-pose.
BIND_BENDS = (
    ('leftUpperArm', (0, 0, 1), 60), ('leftUpperArm', (0, 0, 1), -60),
    ('rightUpperArm', (0, 0, 1), 60), ('rightUpperArm', (0, 0, 1), -60),
    ('leftLowerArm', (0, 0, 1), 90), ('rightLowerArm', (0, 0, 1), 90),
)


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
    out['bones'] = len(humanoid.bones(doc))
    out['groups'] = humanoid.expression_names(doc)
    springs = humanoid.springs(doc)
    out['springs'] = len(springs['groups'])
    out['colliders'] = len(springs['colliderGroups'])

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
    the first skin and stops there leaves any mesh on another skin pointing at
    a slot that does not exist. Until 2026-09-05 nothing in this pipeline could
    see it, because it skinned from the first skin everywhere; three.js loads
    the file, reports every humanoid bone, and then throws on
    `skeleton.bones[i].matrixWorld` the first time it draws, which is the whole
    model gone with every local gate green. Every reader now takes the skin
    off the mesh's own node (humanoid.mesh_skin), and this detector stays as
    the file-level proof.
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


class _NotApplicable:
    """What a check returns when the file has nothing for it to look at.

    Distinct from an empty list, and that distinction is the whole point: two of
    the checks here read an `extensions.VRM.<something>` that a VRM 1.0 file
    simply does not have, got `{}`, and returned `[]` -- which reads as "ran,
    found nothing wrong". A gate that cannot see a file has to say so, so
    report() prints N/A and neither passes nor fails on it.
    """

    __slots__ = ()

    def __len__(self):
        return 0

    def __bool__(self):
        return False

    def __iter__(self):
        return iter(())

    def __repr__(self):
        return 'NOT_APPLICABLE'


NOT_APPLICABLE = _NotApplicable()


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

    Both versions, through humanoid.mtoon: 0.x writes `_OutlineColor` into a
    parallel array, 1.0 writes `outlineColorFactor` onto the material. This read
    `extensions.VRM` directly until 2026-09-10 and raised KeyError on every 1.0
    file, three checks into report().

    The width mode is deliberately not consulted, on either version. A material
    whose outline is switched off draws no second pass and so cannot recolour
    anything, but skipping those would take the shipped 0.x reading from 13 loud
    materials to 5 on mika-pink and AvatarSample_B alike. That is a question
    about this threshold, identical on both versions, and it is not this
    function's to answer while it is being taught a second file format
    (verify_test.py pins the decision).
    """
    doc, _ = glb.load(path)
    loud = []
    for mat in humanoid.mtoon(doc):
        rgb = mat['outlineColor']
        if rgb is None:
            continue
        chroma = max(rgb) - min(rgb)
        if chroma > limit:
            loud.append((mat['name'], tuple(round(c, 3) for c in rgb), chroma))
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

    Both versions, through humanoid.mtoon. 1.0's spelling is
    `parametricRimColorFactor`, and it differs from 0.x in one way that matters
    here: VRoid's 1.0 exports state it explicitly as (0,0,0), where the 0.x ones
    leave `_RimColor` out. Both mean the same thing to a renderer and both count
    as undeclared, which is why the test is on the value and not on the key.
    """
    doc, _ = glb.load(path)
    quiet = []
    for mat in humanoid.mtoon(doc):
        rgb = mat['rimColor']
        if rgb is None or max(rgb) <= 0.0:
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

    VRM 1.0 has no second array: MToon lives on the material, so there is
    nothing to fall out of step and this check cannot mean anything there. It
    returns NOT_APPLICABLE rather than an empty list, because an empty list from
    a check that never ran is indistinguishable from a clean result, and that is
    how it read on every 1.0 body before 2026-09-10.
    """
    doc, _ = glb.load(path)
    if humanoid.version(doc) == '1':
        return NOT_APPLICABLE
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
    They are recognised by the file itself: a mesh any expression binds a morph
    target on is an expression mesh, and is skipped whole. That reading is
    `humanoid.expression_meshes`, which takes 0.x's `blendShapeMaster` binds and
    1.0's `morphTargetBinds` through the node they name; reading only the 0.x
    half saw no expressions at all on a 1.0 body and reported 45 tears on a
    correct face. Taking the list off the candidate rather than off `baseline`
    matters too, because `baseline` is optional here (see the module docstring)
    and a version of this that only knew the face when handed one reported 30
    tears on a correct file.
    `baseline` still contributes when given, for a mesh that carried targets
    before this pipeline touched it without being bound to an expression.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    bound = humanoid.expression_meshes(doc)
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


def torn_bindings(path, limit=BIND_GROWTH_MAX_MM, bends=BIND_BENDS):
    """Primitives whose skin weights tear the mesh when one arm joint turns.

    A garment bound by copying the nearest body vertex's weights looks right at
    rest and is wrong wherever the body creases: at the armpit the nearest skin
    to one cloth vertex is the ribs and to its neighbour the upper arm, so the
    weights jump from all-chest to all-arm across a single edge. Lower the arm
    60 degrees and an 11mm edge is pulled to 74mm on the cardigan shipped on
    2026-09-05, rendering as folded black outline shells and lining lit mint by
    the fill light. Every gate and every contract camera is blind to it,
    because they all see the T-pose.

    Real linear blend skinning (pose.skinned), one joint bent at a time, every
    skinned primitive measured, the worst edge's growth in millimetres. A part
    that does not hang from the bent joint keeps its edges where they were and
    never trips this.
    """
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    bones = humanoid.bones(doc)
    rest = pose.skinned(doc, views)
    edges = {}
    for mesh in doc['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            if 'JOINTS_0' not in pr['attributes']:
                continue
            tri = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
            e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
            edges[(mesh.get('name'), pi)] = np.unique(np.sort(e, axis=1), axis=0)
    bad = []
    for bone, axis, degrees in bends:
        if bone not in bones:
            continue
        posed = pose.skinned(doc, views, {bones[bone]: pose.quat(axis, degrees)})
        for key, e in edges.items():
            p0, p1 = rest[key], posed[key]
            l0 = np.linalg.norm(p0[e[:, 0]] - p0[e[:, 1]], axis=1)
            l1 = np.linalg.norm(p1[e[:, 0]] - p1[e[:, 1]], axis=1)
            growth = float((l1 - l0).max()) * 1000.0
            if growth > limit:
                bad.append((key[0], key[1], bone, degrees, growth))
    return bad


def stranded_collider_groups(path):
    """Collider groups no bone group references.

    Bone groups address collider groups by index, so a stranded group is not
    just dead weight: any later edit that compacts the list without remapping
    silently repoints every surviving spring. The builder prunes these in
    twintail.prune_stranded_collider_groups; this detector holds the shipped
    file to that, the same pairing as every other write-plus-guard here.

    Both versions, through humanoid.springs, which normalises 0.x's
    `secondaryAnimation` and 1.0's `VRMC_springBone` into one shape. Reading
    only the 0.x path returned [] on a 1.0 file, and [] is what a clean file
    looks like.

    The name in each finding is the node the group's colliders hang off. A 1.0
    group need not hang off one node, and the normalised shape carries no name
    of its own for it, so those report an empty name and are identified by the
    index beside it, which is what addresses them in the file anyway.
    """
    doc, _ = glb.load(path)
    springs = humanoid.springs(doc)
    used = {index
            for group in springs['groups']
            for index in group['colliderGroups']}
    stranded = []
    for index, group in enumerate(springs['colliderGroups']):
        if index in used:
            continue
        node = group.get('node')
        name = doc['nodes'][node].get('name', '') if node is not None else ''
        stranded.append((index, name))
    return stranded


def report(path, baseline=None):
    s = stats(path)
    print(f'== {path}')
    print(f'   tris {s["tris"]}  materials {s["materials"]}  images {s["images"]}  '
          f'nodes {s["nodes"]}  bones {s["bones"]}')
    # Not `blendShapeGroups`: that is the 0.x name for them and this line prints
    # for 1.0 files too, where they are `VRMC_vrm.expressions`. Same slip as the
    # `_RimColor` in the rim FAIL below, found by a reviewer on the same pass.
    print(f'   springs {s["springs"]}  colliders {s["colliders"]}  '
          f'expressions {len(s["groups"])}')
    for m in s['meshes']:
        tris = sum(p['tris'] for p in m['primitives'])
        targets = max((p['targets'] for p in m['primitives']), default=0)
        print(f'   {m["name"]:<16} {len(m["primitives"]):>3} prim  '
              f'{tris:>6} tris  targets {targets}')
    print(f'   vertex sha {s["vertex_sha"]}')

    ok = True
    # No bone count. There was an `== 54` here until 2026-09-05, VRoid's count
    # and nobody else's; what a finished file must have is every bone the VRM
    # spec requires, and what it must not have lost is judged against the
    # baseline below.
    missing = humanoid.required_missing(humanoid.read(path))
    if missing:
        print(f'   FAIL humanoid bones {s["bones"]}, missing required '
              f'{", ".join(missing)}')
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
    if skew is NOT_APPLICABLE:
        # Said rather than counted. VRM 1.0 keeps MToon on the material, so
        # there is no parallel array to fall out of step, and printing 0 here
        # would claim a check that did not happen.
        print('   materials out of step with materialProperties: N/A on VRM 1.0')
    else:
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

    ripped = torn_bindings(path)
    print(f'   skinned primitives that tear when an arm bends: {len(ripped)}')
    for mname, pi, bone, degrees, growth in ripped[:5]:
        print(f'   FAIL {mname}#{pi} grows an edge by {growth:.0f}mm with '
              f'{bone} at {degrees:+d} degrees (limit {BIND_GROWTH_MAX_MM:.0f}mm)')
    if ripped:
        ok = False

    quiet = undeclared_rims(path)
    print(f'   materials with no rim colour: {len(quiet)}')
    for name in quiet[:5]:
        # Not `_RimColor`: that is the 0.x spelling, and this line prints for
        # 1.0 files too, where it is `parametricRimColorFactor`.
        print(f'   FAIL {name} states no rim colour, so it takes the site accent')
    if quiet:
        ok = False

    bad = dangling_joints(path)
    print(f'   dangling joint references: {len(bad)}')
    for name, pi, top, si, n in bad[:5]:
        print(f'   FAIL {name}#{pi} uses joint {top}, skin {si} has {n}')
    if bad:
        ok = False

    stranded = stranded_collider_groups(path)
    print(f'   collider groups no spring uses: {len(stranded)}')
    for index, node in stranded[:5]:
        print(f'   FAIL colliderGroups[{index}] ({node}) is referenced by no bone group')
    if stranded:
        ok = False

    if baseline:
        a, b = humanoid.read(baseline), humanoid.read(path)
        diffs = humanoid.compare(a, b)
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
