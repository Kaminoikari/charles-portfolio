"""Delete the body that is inside a garment, because a viewer never sees it.

WHY THIS EXISTS. VRoid Studio hides the body under the clothes it knows about,
and a dress-up export arrives with that job half done. The 2026-09-09 export
carries its skin in three meshes: a `Body (merged)` layer Studio DID mask, which
is why only its head, hands and feet survive, and two inner layers Studio never
touched, `InnerTop` and `InnerBottom`. Those two are the same 3,295-vertex torso
body twice over, identical in position, index and UV bytes, and they are NOT
redundant: they carry different base colour textures (96,269 and 106,510 bytes),
one drawing the inner top and the other the inner bottom on the same surface.
Deleting either loses what it draws (evidence/cover-0910.md).

Those unmasked layers are what shows through the hoodie. At rest 1,637 of their
vertices sit inside the cardigan, a median 22.9mm in, and the fit holds; at
t=2.82s of `modelPose` 173 of them are outside it, the worst by 29.9mm, and
the render shows a dark patch of body across the chest. The pixel gate scored
779 pixels against a limit of 150 when the defect was found, and 750 of those
pixels belonged to these two layers; with the arm condition of pierce.py also
in place the same frame reads 755.

WHY NOT FIX THE WEIGHTS. refit.py already re-homed this file's cloth and
`verify.torn_bindings` passes on it: no single primitive tears. What is left is
two primitives that disagree with each other, the body swinging 105mm while the
cloth over it swings 111mm, and chasing that means fitting every garment to
every body it might be worn on. Skin that is inside a garment at rest is skin
nobody can ever see, so removing it removes the whole class instead of this
instance of it.

WHAT IS DELETED AND WHAT IS NOT. Only triangles whose three corners are ALL
inside a garment, judged at rest. A triangle straddling a hem keeps its skin, so
the neckline, the cuffs and the gap between hem and waistband are untouched by
construction. Vertices are never removed and never renumbered: the primitive's
index accessor is the only thing rewritten, so weights, joints, UVs, normals and
every morph target still line up with the vertex array they were authored
against.

THE TWO WAYS THIS CAN BE WRONG, AND THE GUARD FOR EACH. Cut too little and the
body still comes through, which pierce.py counts. Cut too much and a hole opens
where the garment moves off the skin, which nothing measured before this: the
neck gap of the 2026-09-09 R2 export was caught by a human looking at a
screenshot. `holes()` is that guard. It draws the model before and after the cut
over the same clips and views the clipping gate uses, and counts the pixels that
had geometry and now have background. Both guards have to pass, and they pull in
opposite directions, which is what makes the pair worth having.

ACCESSORIES DO NOT COVER. `Acc_` parts are left out of the cloth set on purpose.
Glasses sit 8 to 11mm off the face over the ear, well inside any margin that
would catch a cardigan, and deleting the ear behind them would be a hole the
moment the head turns. A garment is what covers; an accessory is what sits on
top. Pass `cloth_prefixes` if a body ever arrives wearing a scarf that has to
count.
"""
import io
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import humanoid  # noqa: E402
import pierce  # noqa: E402
import pose as pose_mod  # noqa: E402
import render  # noqa: E402

# How far along its own normal a body vertex looks for cloth over it. A ball of
# nearest-vertex distance was tried first and is wrong for a loose garment: this
# hoodie stands 50 to 80mm off the chest, so a 50mm ball reported 106 of the
# camisole's 166 exposed vertices as having no cloth near them, and they stayed
# in and came through the hoodie. 150mm clears a hood and a flared sleeve.
#
# A ray this long DOES reach the far side of a head, and for the body a viewer
# sees, more skin is what stops it: the garment has to be the FIRST surface the
# ray meets, so a ray that leaves through more skin has found cloth on the other
# side of the body and does not count. An earlier version tested only "is there
# cloth within reach", and the mouth's own normals point INTO the skull, so 120
# mouth vertices reported the hood behind the head as cover -- the hood a median
# 117.7mm away, through the whole head -- and the jaw and neck were cut out from
# under the collar. M17 in evidence/cover-0910-mutations.log is that rule put
# back: 2,495 pixels once the camera is on the head, against 394 for this one.
REACH = 0.150    # metres

# What makes a skin layer inner WEAR on a copy of the body rather than the body
# a viewer sees, in two measurements that both have to hold.
#
# It paints over almost none of itself, because VRoid draws inner wear on a body
# copy whose texture is transparent everywhere the garment it draws is not.
# Measured on the 2026-09-09 export (evidence/opacity-0910.log): `Body_Skin` and
# the face skin are 100%, the two inner layers 23.8% and 6.3%.
#
# And it is body-sized, because a copy of the body is. Transparency alone is not
# enough: eyebrows, eyeliner and eye highlights are alpha masks drawn ON the
# visible face and read 19.2%, 46.7% and 7.7%. Nothing on this body's face has
# cloth within reach, so exempting them costs nothing HERE, but a dress-up
# export with a hood up or a high collar would put a garment inside their 150mm
# and the eyebrows would be deleted with no guard watching: cover.holes sees
# face skin still painting behind them, and pierce.py only ever counts skin
# coming THROUGH cloth. The two inner layers span 79.9% of the body's height and
# no face primitive spans more than 14.8%, so the two groups are a factor of
# five apart and nothing has to be tuned between them.
#
# The distinction decides which surface may hide this one. The body a viewer
# sees can only be hidden by cloth, so cloth has to be the FIRST thing its ray
# meets; the copies underneath are hidden by that body as well, so cloth
# anywhere along the ray is enough. Measured both ways round: holding the
# copies to the first-surface rule leaves 765 triangles of torso in place and
# the cardigan reads 171 pixels of 150, and letting the outer body off it reads
# 2,495 pixels once the camera is on the head (M17 and M19 alike).
#
# Where this rule has no headroom is the OTHER direction, and it is worth
# knowing before the next dress-up export arrives. 0.50 is a long way above
# this export's 23.8% and 6.3% because a camisole and shorts leave most of the
# body copy transparent. Inner wear that covers the copy instead -- a
# long-sleeved top, a bodysuit -- would read at or above 0.50, fall back to the
# first-surface rule, and bring back exactly the defect this module was written
# for: by the measurement above, 765 triangles of torso left in place and the
# cardigan at 171 pixels of 150. The symptom is visible (skin through cloth,
# which pierce.py counts) rather than silent, so the gate would catch it; what
# would be needed is a second signal, not a lower threshold, because lowering
# it walks back towards the decals. SPAN is the opposite: a decal would have to
# reach half the tallest skin primitive to pass, and the tallest decal here,
# eyeliner at 2.2%, is twenty-three times short of that.
WORN = 0.50
SPAN = 0.50

# A pixel counts as painted above this alpha. Half, because the rasteriser
# blends a texture's own edge and a garment's outline is authored with soft
# alpha; anything fainter than half was not what a viewer was looking at.
ALPHA = 0.5

CLOTH_PREFIXES = ('Outfit_',)


def cloth_parts(parts, prefixes=CLOTH_PREFIXES):
    """The manifest's garments, by name, in the manifest's own order."""
    return tuple(n for n in parts
                 if n.startswith(prefixes) and parts[n]['primitives'])


def _nearest(points, dirs, tris, chunk=48):
    """How far along each ray the first triangle is, else inf.

    Moller-Trumbore, the same arithmetic inside.py uses to count crossings,
    with one direction per point instead of one shared by all of them: each
    body vertex asks about the cloth over ITSELF, and its own normal is the
    only direction that means that.

    The DISTANCE rather than a yes/no, because "is there cloth along this ray"
    cannot tell cloth in front from cloth on the far side of the body. `t` is a
    fraction of the ray, so multiply by its length for metres. 1e-5 of it is the
    only thing skipped, so a ray ignores the surface it starts from without
    ignoring what lies beyond it.

    There was an `after` parameter here that skipped every hit within a given
    distance and kept looking. It existed for the standoff rule, which was
    measured and rejected -- it damaged the neck exactly as the first criterion
    did, 2,481 pixels at both 2mm and 10mm (evidence/cover-0910.md section 3) --
    and nothing has passed it since, so it is gone rather than left as a seam
    the docstring describes and no caller uses.
    """
    v0, e1, e2 = tris[:, 0], tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]
    out = np.full(len(points), np.inf)
    for s in range(0, len(points), chunk):
        p, d = points[s:s + chunk], dirs[s:s + chunk]
        pv = np.cross(d[:, None, :], e2[None, :, :])
        det = np.einsum('ptj,tj->pt', pv, e1)
        live = np.abs(det) > 1e-12
        inv = np.where(live, 1.0 / np.where(live, det, 1.0), 0.0)
        tv = p[:, None, :] - v0[None, :, :]
        u = np.einsum('ptj,ptj->pt', tv, pv) * inv
        qv = np.cross(tv, e1[None, :, :])
        v = np.einsum('ptj,pj->pt', qv, d) * inv
        t = np.einsum('ptj,tj->pt', qv, e2) * inv
        hit = live & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 1e-5) & (t <= 1.0)
        out[s:s + chunk] = np.where(hit, t, np.inf).min(axis=1)
    return out


def _painting(doc, binary, views, prim):
    """The fraction of this primitive's vertices that land on an opaque texel.

    Read off the base colour texture the renderer itself samples, because that
    is what decides whether the geometry paints anything. A layer that paints
    over almost none of itself is wear drawn on a copy of the body rather than
    the body.
    """
    tex = doc['materials'][prim['material']].get('pbrMetallicRoughness', {}) \
        .get('baseColorTexture')
    if not tex:
        return 1.0
    image = doc['images'][doc['textures'][tex['index']]['source']]
    view = doc['bufferViews'][image['bufferView']]
    start = view.get('byteOffset', 0)
    alpha = np.asarray(Image.open(io.BytesIO(
        binary[start:start + view['byteLength']])).convert('RGBA'))[:, :, 3]
    uv = np.asarray(glb.read_accessor(doc, views, prim['attributes']['TEXCOORD_0']),
                    dtype=np.float64)
    h, w = alpha.shape
    x = np.clip((uv[:, 0] % 1.0 * w).astype(int), 0, w - 1)
    y = np.clip((uv[:, 1] % 1.0 * h).astype(int), 0, h - 1)
    return float((alpha[y, x] > 127).mean())


def _span(doc, views, prim):
    """How far this primitive reaches vertically, in the file's own units."""
    pos = np.asarray(glb.read_accessor(doc, views, prim['attributes']['POSITION']),
                     dtype=np.float64)
    return float(pos[:, 1].max() - pos[:, 1].min()) if len(pos) else 0.0


def worn_layers(doc, binary, views, parts, threshold=WORN, span=SPAN):
    """Which skin primitives are wear on a body copy rather than the body.

    Both conditions, for the reason the constants above give: mostly
    transparent AND body-sized. Either one alone lets an alpha-masked face
    decal out of the rule that protects the face.
    """
    prims = [(parts[n]['mesh'], i,
              next(m for m in doc['meshes']
                   if m.get('name') == parts[n]['mesh'])['primitives'][i])
             for n in pierce.skin_parts(parts) for i in parts[n]['primitives']]
    tallest = max((_span(doc, views, p) for _, _, p in prims), default=0.0)
    out = set()
    for mesh_name, i, prim in prims:
        if (_painting(doc, binary, views, prim) < threshold
                and tallest > 0 and _span(doc, views, prim) / tallest >= span):
            out.add((mesh_name, i))
    return out


def _triangles_of(doc, views, parts, names, posed):
    """Every triangle of the named parts, as corner positions, in one array."""
    out = []
    for name in names:
        info = parts[name]
        mesh = next(m for m in doc['meshes'] if m.get('name') == info['mesh'])
        for i in info['primitives']:
            idx = np.asarray(glb.read_accessor(doc, views,
                                               mesh['primitives'][i]['indices']),
                             dtype=np.int64).reshape(-1, 3)
            out.append(np.asarray(posed[(info['mesh'], i)], dtype=np.float64)[idx])
    return np.concatenate(out) if out else np.zeros((0, 3, 3))


def _cloth_triangles(doc, views, parts, prefixes, posed):
    """Every garment triangle, as corner positions, in one array."""
    return _triangles_of(doc, views, parts, cloth_parts(parts, prefixes), posed)


def covered(doc, views, parts, reach=REACH, prefixes=CLOTH_PREFIXES,
            posed=None, norms=None, worn=()):
    """(mesh, primitive) -> a bool per vertex: is there a garment over this skin?

    Asked as a ray along the vertex's own outward normal, which is the question
    a viewer standing in front of that piece of skin would ask. The first
    version measured the distance to the nearest cloth VERTEX and took the sign
    from that vertex's normal, and it failed on exactly the case this exists
    for: a garment that stands away from the body. The hoodie is 50 to 80mm off
    the chest, so a 50mm ball found no cloth at all over the camisole beneath
    it, and a ball wide enough to reach it also reaches the far side of the
    torso, where the sign means nothing.

    For the body a viewer sees, the garment has to be the FIRST surface the ray
    meets. A ray long enough to clear a hood is long enough to cross a head, and
    a vertex inside the mouth has a normal pointing into the skull, so "is there
    cloth within reach" said yes for 120 mouth vertices that were reading the
    hood BEHIND the head. The jaw and the neck went with them and the collar ate
    into the neck: 2,495 pixels once the camera is on the head, and the hole
    guard is blind to it because the pixels kept their paint, they just stopped
    being skin. Casting the same ray at the body and keeping only the vertices
    whose cloth is nearer than any more skin is what tells the two apart.

    `worn` is the set of primitives that rule does NOT apply to, from
    `worn_layers`: layers that paint over almost none of themselves are inner
    wear on a copy of the body, and the body itself is in front of them wherever
    both exist, so cloth anywhere along the ray hides them. Holding them to the
    first-surface rule as well leaves 765 triangles of torso in place and the
    cardigan reads 171 pixels of 150; the two layers are the whole reason the
    hoodie showed anything.

    Judged at rest, which is where the garment's fit is the author's own. A pose
    can carry cloth off the skin and the vertex it uncovers has to still be
    there; `trim` is what puts those back.
    """
    posed = pose_mod.skinned(doc, views, {}, True) if posed is None else posed
    norms = pose_mod.skinned_normals(doc, views, {}, True) if norms is None else norms

    tris = _cloth_triangles(doc, views, parts, prefixes, posed)
    if not len(tris):
        return {}
    skin = pierce.skin_parts(parts)
    body = _triangles_of(doc, views, parts, skin, posed)

    out = {}
    for name in skin:
        info = parts[name]
        for i in info['primitives']:
            pos = np.asarray(posed[(info['mesh'], i)], dtype=np.float64)
            n = np.asarray(norms[(info['mesh'], i)], dtype=np.float64)
            length = np.linalg.norm(n, axis=1, keepdims=True)
            n = np.divide(n, length, out=np.zeros_like(n), where=length > 1e-9)
            ray = n * reach
            near = _nearest(pos, ray, tris)
            out[(info['mesh'], i)] = (near < np.inf if (info['mesh'], i) in worn
                                      else near < _nearest(pos, ray, body))
    return out


def dead_triangles(doc, views, parts, mask):
    """(mesh, primitive) -> a bool per triangle: all three corners covered.

    All three, so the triangle that straddles a hem stays. Half a triangle
    cannot be deleted, and keeping it is the side that cannot open a hole.
    """
    out = {}
    for (mesh_name, i), vert in mask.items():
        mesh = next(m for m in doc['meshes'] if m.get('name') == mesh_name)
        idx = np.asarray(glb.read_accessor(doc, views, mesh['primitives'][i]['indices']),
                         dtype=np.int64).reshape(-1, 3)
        out[(mesh_name, i)] = vert[idx].all(axis=1)
    return out


def _triangle_spans(doc, views, posed=None):
    """(mesh, primitive) -> the slice of the global triangle order it owns.

    render.gather concatenates every primitive in mesh order and offsets each
    one's indices by the vertices before it, and partmap labels triangles in
    that same walk. Anything that wants to name a triangle the rasteriser drew
    has to repeat the walk exactly, so it is written once here.
    """
    spans, base, tri = {}, 0, 0
    for mesh in doc['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            key = (mesh.get('name'), pi)
            n = (len(posed[key]) if posed is not None and key in posed
                 else len(glb.read_accessor(doc, views, pr['attributes']['POSITION'])))
            count = len(glb.read_accessor(doc, views, pr['indices'])) // 3
            spans[key] = (tri, tri + count, base)
            base += n
            tri += count
    return spans


def _owners(doc, views, parts, posed, size, views_wanted, lost, cut):
    """Every cut triangle that covers a pixel which lost its paint.

    A deleted triangle cannot be rasterised, so the only way to ask which one
    used to own a pixel is to put its corners back on screen and test them.
    Bounding boxes find the candidates and barycentric coordinates decide, and
    the coordinates are the part that matters: accepting the box alone puts back
    triangles that merely pass near the pixel. Measured on the export both ways,
    2026-09-10: the box restores 729 triangles against 330, leaves 366 in each
    inner layer against 234, and the cardigan reads 174 pixels at the failing
    pose against 48. Both converge in two rounds with no holes, so convergence
    is not what catches this and the cut is the only thing that shows it.

    Restoring EVERY covering triangle rather than the nearest of them was
    measured too, against the criterion of 2026-09-10: both reached the same cut
    and the same holes, and this one got there in two rounds against five.
    Picking the nearest bought nothing, so the variant is gone.
    """
    pos, _, tris, _ = render.gather(doc, views, posed)
    world = render.world_matrices(doc)
    head_y = float(world[humanoid.bones(doc)['head']][1, 3])
    spans = _triangle_spans(doc, views, posed)

    # One flat mask over the global triangle order, so a triangle can be looked
    # up by the index the rasteriser would have used.
    is_cut = np.zeros(len(tris), bool)
    for key, (lo, hi, _) in spans.items():
        if key in cut:
            is_cut[lo:hi] = cut[key]

    back = {key: np.zeros(hi - lo, bool) for key, (lo, hi, _) in spans.items()}
    for view in views_wanted:
        if not lost[view].any():
            continue
        az, el, framing = pierce.VIEWS[view]
        dims = (size[0], size[1]) if framing == 'full' else (size[0], size[0])
        screen = render.project(pos, az, el, framing, dims, head_y)
        corners = screen[tris]
        cand = np.nonzero(is_cut)[0]
        if not len(cand):
            continue
        ys, xs = np.nonzero(lost[view])
        px, py = xs + 0.5, ys + 0.5

        a, b, c = corners[cand, 0], corners[cand, 1], corners[cand, 2]
        area = ((b[:, 0] - a[:, 0]) * (c[:, 1] - a[:, 1])
                - (c[:, 0] - a[:, 0]) * (b[:, 1] - a[:, 1]))
        live = np.abs(area) > 1e-9
        owed = np.zeros(len(tris), bool)
        for n, t in enumerate(cand):
            if not live[n]:
                continue
            x0, x1 = min(a[n, 0], b[n, 0], c[n, 0]), max(a[n, 0], b[n, 0], c[n, 0])
            y0, y1 = min(a[n, 1], b[n, 1], c[n, 1]), max(a[n, 1], b[n, 1], c[n, 1])
            near = np.nonzero((px >= x0 - 1) & (px <= x1 + 1)
                              & (py >= y0 - 1) & (py <= y1 + 1))[0]
            if not len(near):
                continue
            qx, qy = px[near], py[near]
            w0 = ((b[n, 0] - a[n, 0]) * (qy - a[n, 1])
                  - (qx - a[n, 0]) * (b[n, 1] - a[n, 1])) / area[n]
            w1 = ((c[n, 0] - b[n, 0]) * (qy - b[n, 1])
                  - (qx - b[n, 0]) * (c[n, 1] - b[n, 1])) / area[n]
            w2 = ((a[n, 0] - c[n, 0]) * (qy - c[n, 1])
                  - (qx - c[n, 0]) * (a[n, 1] - c[n, 1])) / area[n]
            owed[t] = ((w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)).any()
        for key, (lo, hi, _) in spans.items():
            if key in cut:
                back[key] |= owed[lo:hi] & cut[key]
    return back


def _readers(doc, accessor):
    """How many places in the document point at this accessor."""
    n = 0
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            n += prim.get('indices') == accessor
            n += sum(a == accessor for a in prim['attributes'].values())
            for target in prim.get('targets', []):
                n += sum(a == accessor for a in target.values())
    for skin in doc.get('skins', []):
        n += skin.get('inverseBindMatrices') == accessor
    for anim in doc.get('animations', []):
        for sampler in anim['samplers']:
            n += sampler['input'] == accessor
            n += sampler['output'] == accessor
    return n


def _view_users(doc, view):
    """How many things in the document read bytes out of this bufferView.

    Not the same question as `_readers`, which counts references to an
    ACCESSOR. A bufferView can be reached without any accessor naming it at
    top level: a sparse accessor points its index and value blocks at views of
    their own, and an embedded image is a view. Counting only
    `accessor['bufferView']` and overwriting on the strength of it turns a
    morph target's sparse values into whatever the new indices happen to be,
    with nothing raised, which is what this whole check exists to prevent.
    """
    n = 0
    for acc in doc['accessors']:
        n += acc.get('bufferView') == view
        sparse = acc.get('sparse')
        if sparse:
            n += sparse['indices'].get('bufferView') == view
            n += sparse['values'].get('bufferView') == view
    for image in doc.get('images', []):
        n += image.get('bufferView') == view
    return n


def _in_place_safe(doc, accessor):
    """Whether this accessor's bytes can be overwritten where they lie.

    `_rewrite_indices` replaces the accessor's WHOLE bufferView with the
    surviving indices, starting at byte zero. Four things have to hold for
    that to be the same array the accessor described, and only the first is
    about the accessor's own readers:

    * nothing else in the document reads the accessor,
    * it has a bufferView at all (glTF lets an accessor omit one and mean
      all-zeros, and there is no view to write into),
    * it starts at the beginning of that view rather than partway in,
    * nothing else reads bytes out of the view, whose contents would be
      dropped. `_view_users` is what answers that, and it has to look past the
      accessor list: a sparse block or an embedded image reaches a view without
      any accessor naming it at top level.

    glTF allows all three of the others and `dressup.py` is the entry for a
    body exported by a tool this repo does not control. Measured on both files
    that go through it today, the 2026-09-09 export and the body that ships:
    zero non-zero `byteOffset`s, no view with a second user of any kind, every
    index accessor its own. So the three extra conditions change nothing here
    and stop a foreign export losing an accessor with no error.

    Failing any of them is not fatal. The caller appends instead, which costs
    the file the bytes it was costing before this function existed.
    """
    if _readers(doc, accessor) != 1:
        return False
    acc = doc['accessors'][accessor]
    view = acc.get('bufferView')
    if view is None:
        return False
    if acc.get('byteOffset', 0):
        return False
    return _view_users(doc, view) == 1


def _rewrite_indices(doc, views, prim, kept):
    """Put the surviving indices back where the old ones were.

    Appending a fresh accessor would be simpler and it is what this did first.
    It leaves the old accessor and its bufferView behind, and `glb.rebuild`
    lays every view down again whether or not anything points at it, so the
    file GROWS by the indices that were just deleted: 243,732 bytes on the
    2026-09-09 export, downloaded by every visitor to hold triangles no longer
    drawn.

    Writing in place is only safe under `_in_place_safe`, which is checked
    rather than assumed.
    """
    accessor = prim['indices']
    if not _in_place_safe(doc, accessor):
        prim['indices'] = glb.add_accessor(doc, views, kept.astype(np.uint32),
                                           target=34963)
        return
    acc = doc['accessors'][accessor]
    data = np.ascontiguousarray(kept.astype(np.uint32))
    views[acc['bufferView']] = bytearray(data.tobytes())
    acc['componentType'] = glb.COMPONENT[data.dtype.newbyteorder('<')]
    acc['count'] = int(len(data))
    acc['type'] = 'SCALAR'
    acc.pop('min', None)
    acc.pop('max', None)


def _write(src_doc, src_views, dst, cut):
    """Write the model with `cut`'s triangles removed from their primitives."""
    report = []
    for (mesh_name, i), drop in sorted(cut.items()):
        if not drop.any():
            continue
        mesh = next(m for m in src_doc['meshes'] if m.get('name') == mesh_name)
        prim = mesh['primitives'][i]
        idx = np.asarray(glb.read_accessor(src_doc, src_views, prim['indices']),
                         dtype=np.int64).reshape(-1, 3)
        kept = idx[~drop]
        _rewrite_indices(src_doc, src_views, prim, kept.reshape(-1))
        report.append({'primitive': f'{mesh_name}[{i}]',
                       'triangles': int(len(idx)), 'cut': int(drop.sum()),
                       'left': int(len(kept))})
    size = glb.save(dst, src_doc, glb.rebuild(src_doc, src_views))
    return report, size


def trim(src, dst, manifest, poses=(None,), size=(360, 620),
         views_wanted=tuple(pierce.VIEWS), reach=REACH,
         prefixes=CLOTH_PREFIXES, rounds=4):
    """Cut the covered skin, then put back whatever the hole guard catches.

    One pass of `covered()` is a rest-pose judgement, and a rest pose cannot see
    that a hem lifts off the waist 2.82 seconds into a clip. Rather than pick a
    margin generous enough to survive every pose -- there is none, measured
    2026-09-10 against the FIRST criterion this module had, a ball of
    nearest-vertex distance: at 8mm the neck has almost stopped being cut and
    the cardigan is already back over its limit at 258 pixels against 150 -- the
    cut is made and then measured, and the triangles that turned a pixel to
    background are restored. The cut set only ever
    shrinks, so the loop terminates; `rounds` is a guard against a body that
    oscillates, and a run that uses it up is reported rather than passed off as
    converged.

    Restoring is why this is a loop and not a threshold. Over the 41 frames the
    gate scores, the 2026-09-09 export's first pass turns 8,098 pixels to
    background and 605 triangles come back to close them, after which nothing is
    lost at all, so nothing here has to know that a hood has a collar or that a
    hoodie has a hem (evidence/cover-0910.md section 5).
    """
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    parts = json.load(open(manifest, encoding='utf-8'))['parts']

    posed = [pose_mod.skinned(doc, views, rot or {}, True) for rot in poses]
    rest = pose_mod.skinned(doc, views, {}, True)
    cut = dead_triangles(doc, views, parts,
                         covered(doc, views, parts, reach, prefixes, posed=rest,
                                 worn=worn_layers(doc, binary, views, parts)))
    first = {f'{m}[{i}]': int(drop.sum()) for (m, i), drop in sorted(cut.items())}
    before = [_drawn(doc, views, parts, p, size, views_wanted) for p in posed]

    history, report, written = [], [], 0
    for step in range(rounds):
        write_doc, write_binary = glb.load(src)
        write_views = glb.views_of(write_doc, write_binary)
        report, written = _write(write_doc, write_views, dst, cut)

        after_doc, after_binary = glb.load(dst)
        after_views = glb.views_of(after_doc, after_binary)
        lost_total, restored = 0, 0
        for n, rot in enumerate(poses):
            after = _drawn(after_doc, after_views, parts,
                           pose_mod.skinned(after_doc, after_views, rot or {}, True),
                           size, views_wanted)
            lost = {v: before[n][v] & ~after[v] for v in views_wanted}
            lost_total += sum(int(m.sum()) for m in lost.values())
            if not any(m.any() for m in lost.values()):
                continue
            for key, back in _owners(doc, views, parts, posed[n], size,
                                     views_wanted, lost, cut).items():
                if key not in cut:
                    continue
                restored += int((cut[key] & back).sum())
                cut[key] = cut[key] & ~back
        history.append({'round': step, 'lost': lost_total, 'restored': restored})
        if not lost_total:
            return {'path': dst, 'bytes': written, 'cut': report,
                    'rounds': history, 'converged': True, 'first_cut': first}
    return {'path': dst, 'bytes': written, 'cut': report, 'rounds': history,
            'converged': False, 'first_cut': first}


def apply(src, dst, manifest, reach=REACH, prefixes=CLOTH_PREFIXES):
    """Cut the covered skin out of `src` in one pass and write it to `dst`.

    The rest-pose judgement on its own, with no hole guard behind it. `trim` is
    what a fresh export goes through; this is here for measuring what one pass
    of the criterion does, which is how the loop below was shown to be needed.
    """
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    parts = json.load(open(manifest, encoding='utf-8'))['parts']
    cut = dead_triangles(doc, views, parts,
                         covered(doc, views, parts, reach, prefixes,
                                 worn=worn_layers(doc, binary, views, parts)))
    report, size = _write(doc, views, dst, cut)
    return {'path': dst, 'bytes': size, 'cut': report}


def _drawn(doc, views, parts, posed, size, views_wanted):
    """Per view, a bool image: is this pixel painted?

    Opacity comes from the textured render, not from the flat part map, and the
    difference decides what this guard is worth. VRoid draws inner wear on a
    copy of the body mesh whose texture is transparent everywhere except the
    garment itself, so most of `InnerTop` and `InnerBottom` paints nothing at
    all. A flat part map has no alpha to consult and reports every one of those
    triangles as drawn, which makes deleting them look like a hole and puts the
    black camisole back on top of the hoodie. Reading alpha off the real
    textures is what tells geometry that paints from geometry that does not.
    """
    pos, uv, tris, mats = render.gather(doc, views, posed)
    texmap = render.textures(doc, views)
    world = render.world_matrices(doc)
    head = humanoid.bones(doc)
    head_y = float(world[head['head']][1, 3]) if 'head' in head else None

    out = {}
    for view in views_wanted:
        az, el, framing = pierce.VIEWS[view]
        dims = (size[0], size[1]) if framing == 'full' else (size[0], size[0])
        screen = render.project(pos, az, el, framing, dims, head_y)
        _, alpha, _ = render.rasterise(screen, uv, tris, mats, texmap, dims)
        out[view] = alpha > ALPHA
    return out


def holes(before, after, manifest, poses=(None,), size=(360, 620),
          views_wanted=tuple(pierce.VIEWS)):
    """Pixels that had geometry in `before` and have background in `after`.

    The over-cut guard. Cutting skin that a garment covers changes nothing on
    screen, because the garment is what the camera was seeing there anyway; the
    pixel only turns to background when the cut went past the cloth. Run over
    the poses the clipping gate uses, since a hole a pose opens is exactly the
    one a rest-pose judgement cannot see.

    `poses` is a sequence of rotation dicts, `None` meaning the rest pose.

    Every view is reported, zero included. Returning only the views that lost
    something reads as a pass when the render produced nothing at all, and those
    are opposite verdicts.
    """
    doc_b, bin_b = glb.load(before)
    doc_a, bin_a = glb.load(after)
    views_b, views_a = glb.views_of(doc_b, bin_b), glb.views_of(doc_a, bin_a)
    parts = json.load(open(manifest, encoding='utf-8'))['parts']

    worst = {view: (0, None) for view in views_wanted}
    for n, rot in enumerate(poses):
        drawn_b = _drawn(doc_b, views_b, parts,
                         pose_mod.skinned(doc_b, views_b, rot or {}, True),
                         size, views_wanted)
        drawn_a = _drawn(doc_a, views_a, parts,
                         pose_mod.skinned(doc_a, views_a, rot or {}, True),
                         size, views_wanted)
        for view in drawn_b:
            lost = int((drawn_b[view] & ~drawn_a[view]).sum())
            if lost > worst[view][0]:
                worst[view] = (lost, n)
    return worst


if __name__ == '__main__':
    if len(sys.argv) < 4:
        raise SystemExit('cover.py <export.vrm> <trimmed.vrm> <parts.json>')
    print(apply(sys.argv[1], sys.argv[2], sys.argv[3]))
