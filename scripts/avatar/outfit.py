"""Fit a garment rigged to somebody else's skeleton onto this one.

The MellowHeart Dream package ships the clothes bound to Milfy's armature. This
model is a VRoid body with different proportions and the opposite handedness, so
the garment cannot simply be parented across: every vertex has to be moved to
where the corresponding bone is HERE, and the garment's own bones -- the skirt
chains, the ribbon, the shoe laces -- have to come with it and be re-parented
under ours.

Two facts were measured off the two files rather than assumed, and both change
the answer:

  Handedness. Milfy's Shoulder.L sits at x=+0.048 and her toes point to +Z;
  ours sit at x=-0.020 with toes at -Z. That is the same half turn about Y that
  separates VRM 1.0 from VRM 0.x, and it is applied before anything else. Skip
  it and the garment fits perfectly -- inside out and back to front.

  Scale. Hip to neck is 0.273 on Milfy and 0.372 here, and the limbs disagree in
  the other direction: her upper leg is 0.053 out from the axis, ours 0.068. One
  uniform scale cannot satisfy both, which is why the fit below is only a
  starting alignment and the per-bone correction after it does the real work.

The transform is therefore in two stages. A global similarity A puts the two
skeletons roughly on top of each other: uniform scale, translation and a yaw
that is solved from the landmarks and then snapped to a half turn (_fit),
fitted over the humanoid bones that exist in both (which bones those are is
bonemap.py's answer, from the vendor's names and the rig's shape). Then each
source bone contributes a rigid correction that carries its neighbourhood the
rest of the way: a translation that lands the bone on ours and, for the limb
bones, the rotation that turns the garment's segment (upper leg to lower leg,
lower leg to foot, and so on down the arms) onto ours. Every vertex moves by
the blend, over the bones it is weighted to, of those corrections.

The rotation comes from segment DIRECTIONS, never from the bone matrices, and
this is the one thing that has to be got right. Writing the correction as
M_target(b) . inverse(A . M_source(b)) is the textbook retarget and it is wrong
across these two rigs, because a bone matrix carries an orientation and the two
rigs do not agree on what a bone's local axes mean: Blender points a bone along
its own length, VRoid leaves every rest rotation at identity. Transferring
through those frames re-plants the cloth in a rotated basis. The ankle socks
came out as white tubes running from the thigh to the ankle, and the shoes
smeared up the shin with them -- the geometry was intact and pointing the wrong
way. A segment direction is a property of the rig's shape, which both rigs
agree on; a bone frame is a property of the exporter.

The trunk (hips up to the head) and the shoulders get no rotation at all. Their
segments run wherever the rigger put the joints, not where the torso surface
points: hips-to-spine differs by about 10 degrees and spine-to-chest by 6
between the vendor rigs and this body (measured 2026-09-05) with neither torso
leaning, and turning the hips by 10 degrees would swing a 0.4m skirt hem 70mm.
A limb segment IS the limb's axis, so its cloth turns. Where the two rigs'
segments already agree, every rotation is identity and the result is bit for
bit the translation field this used to be.

Garment-only bones have no target to land on. They inherit the correction of
the nearest ancestor that does, so a skirt panel is carried by the hips it
hangs from and keeps its shape relative to them, and a sock's own bones turn
with the shin they sit on.
"""
import io

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

import bonemap
import glb
import humanoid
import render

# How far the solved yaw may sit from a half turn before the garment is
# declared authored sideways. Both vendor files solve to a half turn, +-180.00
# (2026-09-05).
YAW_TOLERANCE_DEG = 5.0

# The segment each limb bone starts, as the humanoid part name of its child:
# a bone here turns its cloth by the rotation taking that segment's direction
# in the garment onto ours. Hand, Toes and the fingers have no entry and
# inherit the turn of the bone above them; so does a bone here whose child the
# mapping did not find (the cardigan's upper arm, whose forearm the vendor file
# keeps off the anchors). The shoulder is deliberately absent: it is a trunk
# bone in all but name, its segment running wherever the rigger put the
# clavicle, and like the trunk it inherits nothing but None.
CHILD_OF = {
    'UpperArm': 'LowerArm', 'LowerArm': 'Hand',
    'UpperLeg': 'LowerLeg', 'LowerLeg': 'Foot', 'Foot': 'Toes',
}


class BadFit(Exception):
    """The garment's landmarks cannot be fitted onto ours; the message says why."""


def _decompose(m):
    """A 4x4 into (translation, xyzw quaternion, scale)."""
    t = m[:3, 3]
    s = np.linalg.norm(m[:3, :3], axis=0)
    s = np.where(s == 0, 1.0, s)
    r = m[:3, :3] / s
    tr = r[0, 0] + r[1, 1] + r[2, 2]
    if tr > 0:
        w = np.sqrt(1 + tr) * 0.5
        q = np.array([(r[2, 1] - r[1, 2]), (r[0, 2] - r[2, 0]), (r[1, 0] - r[0, 1])]) / (4 * w)
    else:
        i = int(np.argmax([r[0, 0], r[1, 1], r[2, 2]]))
        j, k = (i + 1) % 3, (i + 2) % 3
        d = np.sqrt(max(1e-12, 1 + r[i, i] - r[j, j] - r[k, k])) * 2
        q = np.zeros(3)
        q[i] = 0.25 * d
        q[j] = (r[j, i] + r[i, j]) / d
        q[k] = (r[k, i] + r[i, k]) / d
        w = (r[k, j] - r[j, k]) / d
    return t, np.array([q[0], q[1], q[2], w]), s


def _fit(src_pts, dst_pts):
    """Uniform scale, yaw and translation taking source landmarks onto ours.

    Returns (A, scale, yaw_deg). The yaw is SOLVED, as the rotation about Y
    that best turns the centred source landmarks onto the centred target ones
    (Kabsch in the XZ plane), and then SNAPPED to the nearest half turn: a
    garment is authored facing +Z or -Z, so the solved value says which way
    this one faces and nothing more. A solved yaw further than
    YAW_TOLERANCE_DEG from either is a garment authored sideways, and that is
    refused with BadFit rather than fitted. A free three-axis rotation is not
    solved for at all: fitting one to a dozen-odd noisy landmarks introduces a
    small spurious tilt that shows up as the garment leaning.

    The snapped half turn is built as an exact diagonal, not from the solved
    angle's sine and cosine, so a rig that faces the other way gets the same
    bytes the old hard-wired YAW produced.
    """
    p = src_pts - src_pts.mean(axis=0)
    q = dst_pts - dst_pts.mean(axis=0)
    # Rotation about +Y by t maps (x, z) to (x cos t + z sin t, -x sin t + z cos t).
    cos_sum = float((q[:, 0] * p[:, 0] + q[:, 2] * p[:, 2]).sum())
    sin_sum = float((q[:, 0] * p[:, 2] - q[:, 2] * p[:, 0]).sum())
    yaw = float(np.degrees(np.arctan2(sin_sum, cos_sum)))
    k = int(round(yaw / 180.0))
    if abs(yaw - 180.0 * k) > YAW_TOLERANCE_DEG:
        raise BadFit(f'服裝擬合：解出的 yaw {yaw:.1f}° 離 0°/180° 超過 '
                     f'{YAW_TOLERANCE_DEG:g}°，這份服裝檔不是朝 ±Z 作的')
    rot = np.diag([1.0, 1.0, 1.0]) if k % 2 == 0 else np.diag([-1.0, 1.0, -1.0])
    turned = src_pts @ rot.T
    mq, md = turned.mean(axis=0), dst_pts.mean(axis=0)
    num = float(((dst_pts - md) * (turned - mq)).sum())
    den = float(((turned - mq) ** 2).sum())
    s = num / den if den else 1.0
    a = np.eye(4)
    a[:3, :3] = s * rot
    a[:3, 3] = md - s * mq
    return a, s, yaw


def _turn(u, v):
    """The smallest rotation taking direction u onto direction v.

    None when they already agree to within a microradian, which is floating
    point noise from the similarity and not a turn; keeping it None is what
    lets pieces() and add_bones() take the exact translation-only path.
    Opposite directions have no smallest rotation and are refused: a garment
    segment pointing the other way from ours is a mapping error, not a pose.
    """
    u = u / np.linalg.norm(u)
    v = v / np.linalg.norm(v)
    axis = np.cross(u, v)
    sin = float(np.linalg.norm(axis))
    cos = float(u @ v)
    if sin < 1e-6:
        if cos > 0:
            return None
        raise BadFit('segment points the opposite way')
    x, y, z = axis / sin
    k = np.array([[0.0, -z, y], [z, 0.0, -x], [-y, x, 0.0]])
    return np.eye(3) + sin * k + (1.0 - cos) * (k @ k)


def _part(vrm):
    """('left'|'right', part) for a sided humanoid name, (None, None) otherwise."""
    for side in ('left', 'right'):
        if vrm.startswith(side):
            return side, vrm[len(side):]
    return None, None


def _weighted_joints(src, sviews):
    """Source joints (node indices) some vertex is weighted to above 0.05."""
    sjoints = src['skins'][0]['joints']
    hit = set()
    for mesh in src['meshes']:
        for pr in mesh['primitives']:
            att = pr['attributes']
            j = glb.read_accessor(src, sviews, att['JOINTS_0']).astype(np.int64)
            w = glb.read_accessor(src, sviews, att['WEIGHTS_0']).astype(np.float64)
            hit.update(int(s) for s in np.unique(j[w > 0.05]))
    return {sjoints[s] for s in hit}


def load(path, doc, views, add_material, tint, gain=None, override=None):
    """Read the garment file and return everything needed to attach it.

    `add_material` is build.py's, so colour policy stays in one place; `tint`
    maps the garment's own material names onto ours. `override` is the vendor's
    bonemap file (a path or its parsed dict) for bones the generic table cannot
    name; None means the table and the rig's shape have to be enough.
    """
    src, binary = glb.load(path)
    sviews = glb.views_of(src, binary)
    sworld = render.world_matrices(src)
    snames = {i: n.get('name') for i, n in enumerate(src['nodes'])}
    sjoints = src['skins'][0]['joints']

    tworld = render.world_matrices(doc)
    tbones = humanoid.bones(doc)

    if isinstance(override, str):
        override = bonemap.load_override(override)
    mapping = bonemap.resolve(src, tbones, override)
    bonemap.require(mapping, src, _weighted_joints(src, sviews))
    pairs = mapping['pairs']
    a_mat, scale, yaw = _fit(np.array([sworld[i][:3, 3] for i, _ in pairs]),
                             np.array([tworld[j][:3, 3] for _, j in pairs]))

    sparent = {c: i for i, n in enumerate(src['nodes']) for c in n.get('children', ())}
    mapped = {i: j for i, j in pairs}
    names = mapping['names']

    def nearest_mapped(i):
        while i is not None:
            if i in mapped:
                return i
            i = sparent.get(i)
        return None

    def aligned(i):
        return (a_mat @ sworld[i])[:3, 3]

    # Each mapped bone's turn, parents first so a bone can inherit. None is
    # "no turn" and is kept as None on purpose: see _turn and the module
    # docstring on why the trunk never turns.
    turn = {}
    for i in sorted(mapped, key=lambda i: _depth(i, sparent)):
        side, part = _part(names[i])
        if part is None:
            turn[i] = None
            continue
        inherited = turn.get(nearest_mapped(sparent.get(i)))
        child_name = side + CHILD_OF.get(part, '')
        child = next((c for c in mapped if names[c] == child_name), None) \
            if part in CHILD_OF else None
        if child is None:
            turn[i] = inherited
            continue
        try:
            turn[i] = _turn(aligned(child) - aligned(i),
                            tworld[mapped[child]][:3, 3] - tworld[mapped[i]][:3, 3])
        except BadFit as e:
            raise BadFit(f'服裝擬合：{snames[i]}→{snames[child]}（{names[i]}）{e}') from e

    # (rotation or None, pivot, translation) per source joint: the vertex x
    # moves to rotation . (x - pivot) + pivot + translation. Pivot and
    # translation are the anchor's, so a garment chain rides rigidly with the
    # bone it hangs from.
    correction, residual = {}, []
    for i in sjoints:
        anchor = nearest_mapped(i)
        if anchor is None:
            correction[i] = (None, np.zeros(3), np.zeros(3))
            continue
        pivot = aligned(anchor)
        d = tworld[mapped[anchor]][:3, 3] - pivot
        correction[i] = (turn[anchor], pivot, d)
        if i in mapped:
            landed = aligned(i) + d
            residual.append(np.linalg.norm(landed - tworld[mapped[i]][:3, 3]))

    return {
        'src': src, 'sviews': sviews, 'sworld': sworld, 'snames': snames,
        'sjoints': sjoints, 'sparent': sparent, 'mapped': mapped,
        'mapping': mapping,
        'a': a_mat, 'scale': scale, 'yaw_deg': yaw, 'correction': correction,
        'residual_mm': float(np.max(residual) * 1000) if residual else 0.0,
        'materials': _materials(src, doc, views, sviews, add_material,
                                tint, gain),
    }


MAX_TEXTURE = 1024


def _materials(src, doc, views, sviews, add_material, tint, gain=None):
    """Copy the garment's textures across and make one MToon material each.

    The maps are resized and re-encoded on the way through. They ship as seven
    2048-square PNGs, which is 25MB of a 26MB file for an avatar that is served
    over the web and rendered at a few hundred pixels tall; at 1024 in WebP the
    same seven come to under a megabyte and nothing visible changes. Alpha is
    kept -- it is not decoration here, it is what cuts the lace out of its own
    rectangle, and losing it turns the trim into black slabs.

    `gain` re-exposes a base map before it is re-encoded, as `(contrast,
    lift)`: `map * contrast + lift * 255`. It exists because the colour of
    every garment here lives in baseColorFactor and glTF clamps that factor at
    1: a vendor map drawn dark on purpose (the black pleated skirt, the black
    loafer) cannot be tinted white, no matter what factor is asked for, because
    the product never exceeds the map. Re-exposing the map is the only way past
    that ceiling, and it keeps the colour policy intact -- the map still
    carries nothing but shading, it just carries it at a different exposure.

    An offset rather than a plain multiplier, because of what each costs.
    Sampling the skirt's map per triangle over the skirt's own UVs it averages
    74.2 of 255, and the shipped (0.55, 0.83) takes that to 237.3 with 17.9% of
    the samples clipped at white. A multiplier reaches that mean only by
    destroying the map: 6.8% of the map is exactly 0, so scaling has a ceiling
    of 237.8, and the factor that lands on 237.3 drives 93% of the map to
    white. Even the much dimmer 210 costs 5.19x and 43.8% clipped -- half the
    cloth flat, and the pleats are in that half. Both operations clip; the offset clips less than half as much
    for a brighter result, because it moves the whole map instead of
    stretching it away from zero.

    `contrast` is then a second, independent decision: how much of the map's
    own shading rides along. Holding the mean at that same 237.3, a contrast of
    1.0 leaves the map's standard deviation at 15.6 and 0.55 leaves it at 11.1.
    That is the price of a white skirt whose vendor map is nearly black, and it
    is set separately from the brightness rather than falling out of it.

    An exponent was the previous attempt and is worse than either: the exponent
    that lifts a map this dark to white is about 0.09, and x**0.09 is 1.0 for
    anything that is not nearly black, so every trace of shading goes with it.

    Both numbers are fitted against the render. The offset moves the rendered
    value by 255 * baseColorFactor * lift, so one measurement corrects it.
    """
    out = {}
    gain = gain or {}
    for mi, mat in enumerate(src.get('materials', [])):
        name = mat.get('name')
        spec = tint.get(name)
        if spec is None:
            continue
        base, shade = spec
        tex = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        image = None
        if tex is not None:
            source = src['textures'][tex['index']]['source']
            img = src['images'][source]
            im = Image.open(io.BytesIO(bytes(sviews[img['bufferView']]))).convert('RGBA')
            if name in gain:
                contrast, lift = gain[name]
                a = np.asarray(im).astype(np.float64)
                a[..., :3] = np.clip(a[..., :3] * contrast + lift * 255.0,
                                     0.0, 255.0)
                im = Image.fromarray(a.astype(np.uint8), 'RGBA')
            if max(im.size) > MAX_TEXTURE:
                k = MAX_TEXTURE / max(im.size)
                im = im.resize((round(im.width * k), round(im.height * k)),
                               Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, format='WEBP', quality=90, method=4)
            doc.setdefault('images', []).append({
                'name': f'Mellow_{name}',
                'mimeType': 'image/webp',
                'bufferView': glb.add_view(doc, views, buf.getvalue()),
            })
            doc.setdefault('samplers', []).append({'wrapS': 10497, 'wrapT': 10497})
            doc.setdefault('textures', []).append({
                'sampler': len(doc['samplers']) - 1,
                'source': len(doc['images']) - 1,
            })
            image = len(doc['textures']) - 1
        out[mi] = add_material(doc, f'Mellow_{name}', base, shade, texture=image)
    return out


def pieces(bundle, doc, views, joint_slot=None):
    """Every primitive of the garment, moved onto our skeleton.

    `joint_slot` maps a source joint index to our skin's joint index, from
    add_bones(). Pass None when the caller is going to re-bind the piece to this
    model's own body weights instead, which is what build.py does: carrying the
    vendor's rig across made the garment deform by Milfy's weight falloff on our
    body's motion, and the two disagree enough that the hips came through the
    skirt and the ribs through the bodice under half the animation clips.
    """
    src, sviews = bundle['src'], bundle['sviews']
    a, correction, sjoints = bundle['a'], bundle['correction'], bundle['sjoints']
    out = []
    for mesh in src['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            att = pr['attributes']
            pos = glb.read_accessor(src, sviews, att['POSITION']).astype(np.float64)
            nrm = glb.read_accessor(src, sviews, att['NORMAL']).astype(np.float64)
            uv = glb.read_accessor(src, sviews, att['TEXCOORD_0']).astype(np.float64)
            j = glb.read_accessor(src, sviews, att['JOINTS_0']).astype(np.int64)
            w = glb.read_accessor(src, sviews, att['WEIGHTS_0']).astype(np.float64)
            tri = glb.read_accessor(src, sviews, pr['indices']).astype(np.int64).reshape(-1, 3)

            total = w.sum(axis=1, keepdims=True)
            w = w / np.where(total == 0, 1.0, total)

            aligned = pos @ a[:3, :3].T + a[:3, 3]
            an = nrm @ a[:3, :3].T

            # The blended correction. Per vertex the map is affine: x goes to
            # x + sum_k w_k [(R_k - I)(x - p_k) + d_k], whose linear part is
            # I + sum_k w_k (R_k - I). `spin` accumulates that sum, and only
            # once some bone on this primitive actually turns: a bone with no
            # turn adds nothing but its translation, exactly as before, so a
            # garment whose segments all agree with ours takes the old path
            # byte for byte.
            offset = np.zeros_like(aligned)
            spin = None
            for k in range(j.shape[1]):
                wk = w[:, k:k + 1]
                if not wk.any():
                    continue
                for node in np.unique(j[:, k]):
                    sel = (j[:, k] == node) & (wk[:, 0] > 0)
                    if not sel.any():
                        continue
                    rot, pivot, d = correction[sjoints[node]]
                    if rot is None:
                        offset[sel] += wk[sel] * d
                        continue
                    delta = rot - np.eye(3)
                    offset[sel] += wk[sel] * ((aligned[sel] - pivot) @ delta.T + d)
                    if spin is None:
                        spin = np.zeros((len(aligned), 3, 3))
                    spin[sel] += wk[sel][:, :, None] * delta
            moved = aligned + offset
            # Normals go through the same blended linear part and are then
            # re-normalised. Strictly a normal wants the inverse transpose,
            # but a blend of small rotations is orthogonal to within the
            # angle between them, and re-normalising absorbs the rest; dual
            # quaternions would be overkill for segments a few degrees apart.
            if spin is not None:
                an = an + np.einsum('nij,nj->ni', spin, an)
            length = np.linalg.norm(an, axis=1, keepdims=True)
            mn = an / np.where(length == 0, 1.0, length)

            slots = np.zeros_like(j, dtype=np.uint16)
            if joint_slot is not None:
                for k in range(j.shape[1]):
                    for node in np.unique(j[:, k]):
                        slots[j[:, k] == node, k] = joint_slot[sjoints[node]]

            # The vendor's shape keys, carried across as displacement fields
            # rather than as positions. The fit above is affine per vertex --
            # one global matrix, then the blended bone corrections whose
            # linear part is the `spin` above -- so a delta transforms by the
            # linear parts alone and the translations and pivots cancel. What
            # happens downstream of the fit (hug, loosen, drape) is NOT affine
            # and the delta is NOT carried through it: build.py grafts these
            # fields onto the settled garment as they stand, so the key rides
            # on top of wherever the cloth ended up.
            names = mesh.get('extras', {}).get('targetNames') or []
            targets = {}
            for ti, tgt in enumerate(pr.get('targets', ())):
                if 'POSITION' not in tgt:
                    continue
                d = glb.read_accessor(src, sviews, tgt['POSITION']).astype(np.float64)
                key = names[ti] if ti < len(names) else f'{mesh.get("name")}#{ti}'
                d = d @ a[:3, :3].T
                if spin is not None:
                    d = d + np.einsum('nij,nj->ni', spin, d)
                targets[key] = d

            out.append({
                'name': mesh.get('name'), 'prim': pi,
                'material': pr.get('material'),
                'targets': targets,
                'piece': {'pos': moved, 'nrm': mn, 'uv': uv,
                          'joints': slots, 'weights': w.astype(np.float32),
                          'tris': tri},
            })
    return out


def add_bones(bundle, doc, views):
    """Give the garment's own bones a home in our skeleton.

    Returns source-joint -> our skin-joint slot. Bones that already exist here
    (the humanoid ones the mapping found) resolve to the slot they already occupy;
    everything else -- skirt panels, the ribbon, the shoe laces -- is appended as
    a new node under whichever of ours its source parent maps to.
    """
    skin = doc['skins'][0]
    joints = skin['joints']
    tbones = humanoid.bones(doc)
    sjoints, snames = bundle['sjoints'], bundle['snames']
    sparent, sworld = bundle['sparent'], bundle['sworld']
    a, correction, mapped = bundle['a'], bundle['correction'], bundle['mapped']

    ibm = glb.read_accessor(doc, views, skin['inverseBindMatrices']).reshape(-1, 4, 4)
    # Our own world matrices, computed once. Recomputing them per bone turned a
    # 190-bone chain into a quadratic walk of the whole scene tree.
    ours = render.world_matrices(doc)
    world_of, node_of, slot = {}, {}, {}

    # Parents before children, so a chain's local transform can be taken against
    # a parent that already exists.
    order = sorted(sjoints, key=lambda i: _depth(i, sparent))
    for i in order:
        if i in mapped:
            node_of[i] = mapped[i]
            world_of[i] = None                       # ours already, leave it be
            slot[i] = joints.index(mapped[i])
            continue
        w = a @ sworld[i]
        rot, pivot, d = correction[i]
        if rot is not None:
            # The chain rides rigidly with its anchor: turned about the
            # anchor's pivot, then carried by the anchor's translation.
            w[:3, :3] = rot @ w[:3, :3]
            w[:3, 3] = rot @ (w[:3, 3] - pivot) + pivot
        w[:3, 3] += d
        p = sparent.get(i)
        pnode = node_of.get(p)
        if pnode is None:
            pnode = tbones['hips']
        pworld = world_of.get(p)
        if pworld is None:
            pworld = ours[pnode]
        local = np.linalg.inv(pworld) @ w
        t, q, s = _decompose(local)
        node = {'name': f'Mellow_{snames[i]}',
                'translation': [float(v) for v in t],
                'rotation': [float(v) for v in q]}
        if not np.allclose(s, 1.0, atol=1e-4):
            node['scale'] = [float(v) for v in s]
        doc['nodes'].append(node)
        idx = len(doc['nodes']) - 1
        doc['nodes'][pnode].setdefault('children', []).append(idx)
        node_of[i], world_of[i] = idx, w
        joints.append(idx)
        ibm = np.concatenate([ibm, np.linalg.inv(w).T[None]])
        slot[i] = len(joints) - 1

    skin['inverseBindMatrices'] = glb.add_accessor(
        doc, views, ibm.reshape(-1, 16).astype(np.float32))
    return slot


def _depth(i, parent):
    d = 0
    while i in parent:
        i = parent[i]
        d += 1
    return d


def loosen(piece, amount):
    """Push a garment out along its own normals, none at the top, all at the hem.

    A different job from hug, and it exists because hug could not do this one.
    hug moves cloth that is closer to the body than its margin AT REST; the
    skirt at rest clears the thigh by more than 20mm everywhere, so raising the
    margin from 14mm to 20mm moved nothing and the count did not budge. What
    brought the thigh through the front hem was a raised knee in
    modelPose.vrma, and no rest measurement can see that.

    So this is unconditional: the imported skirt is cut for a narrower thigh
    than this one and wants a few more millimetres of room to swing in. Ramped
    by height so the waistband stays where it was fitted -- a uniform push
    loosens the waist too, and a waistband that stands off the body reads as a
    hoop. 5mm at the hem took the worst frame from 261 pixels to 107.
    """
    y = piece['pos'][:, 1]
    span = max(float(y.max() - y.min()), 1e-6)
    t = ((y.max() - y) / span)[:, None]
    piece['pos'] = piece['pos'] + amount * t * piece['nrm']
    return float(amount)


def standoff(piece, amount, torso_x=0.26, sleeve_x=0.32):
    """Push a lined garment horizontally off the body, both shells in parallel.

    loosen cannot serve the cardigan: 13% of its vertices are the teal inner
    lining, whose normals face the body, and a push along the vertex's own
    normal drives that lining INTO the blouse -- the very poke this exists to
    remove. So the direction is the normal with its sign flipped wherever it
    points at the garment's own XZ centroid: a lining vertex then moves the
    same way as the outer-shell vertex it doubles, the pair translates rigidly
    and the knit keeps its thickness.

    The y component is dropped rather than ramped. Shoulder-top normals point
    up, so a horizontal push pins the collar to the shoulders for free -- the
    hoop problem loosen solves with its hem ramp never arises. And the sleeves
    are excluded by a fade over |x|: torso panels reach |x|~0.30 and the
    sleeve tubes live beyond it, and the fade band [torso_x, sleeve_x] is
    deliberately laid ACROSS that boundary rather than after it -- the outer
    4cm of torso panel tapers from full push to none, so the seam where the
    pushed torso meets the untouched sleeve never shows a step. The sleeves
    themselves have no poke to fix, and the sign test is unreliable on a tube
    whose axis passes near the centroid.
    """
    pos = piece['pos']
    nrm = piece['nrm']
    centre = pos.mean(axis=0)
    radial = pos - centre
    outward = nrm[:, 0] * radial[:, 0] + nrm[:, 2] * radial[:, 2]
    # The flip must be smooth, not a hard sign: where a rim curls, neighbouring
    # vertices straddle the boundary, and a hard sign pushes them 2x amount
    # apart -- the health check caught the cardigan's Breasts_Cow shape key
    # stretching such an edge 1.8x and flipping faces. A cosine ramp sends the
    # push to zero at the boundary instead, so no edge ever shears.
    length = np.hypot(radial[:, 0], radial[:, 2]) * np.hypot(nrm[:, 0], nrm[:, 2])
    cosine = outward / np.maximum(length, 1e-9)
    sign = np.clip(cosine / 0.3, -1.0, 1.0)
    horizontal = np.array(nrm)
    horizontal[:, 1] = 0.0
    fade = np.clip((sleeve_x - np.abs(pos[:, 0])) / (sleeve_x - torso_x), 0.0, 1.0)
    piece['pos'] = pos + amount * (sign * fade)[:, None] * horizontal
    return float(amount)


def _cross_section(points):
    """Return the XZ centre and diameter of a point cloud."""
    low = points[:, [0, 2]].min(axis=0)
    high = points[:, [0, 2]].max(axis=0)
    return (low + high) * 0.5, high - low


def _apply_xz_fit(item, scale, translation):
    """Apply one XZ affine fit to geometry, normals, and morph deltas."""
    piece = item['piece']
    piece['pos'][:, [0, 2]] = piece['pos'][:, [0, 2]] * scale + translation

    normal_scale = 1.0 / scale
    piece['nrm'][:, [0, 2]] *= normal_scale
    length = np.linalg.norm(piece['nrm'], axis=1, keepdims=True)
    piece['nrm'] /= np.where(length == 0, 1.0, length)

    for delta in item.get('targets', {}).values():
        delta[:, [0, 2]] *= scale


def fit_ring_to_limb(items, body_pos, source_materials, item_name,
                     ring_material, y_shift, clearance):
    """Resize every primitive of a vendor ring to the limb beneath it.

    `hug` only pushes embedded vertices outward, so an oversized source ring
    remains oversized. The fabric primitive defines the ring diameter while
    every companion primitive, such as a buckle or jewel, receives the same
    affine transform and stays attached. The requested clearance is radial,
    therefore the fitted diameter is the limb diameter plus twice that value.
    """
    ring_items = [item for item in items if item['name'] == item_name]
    main_items = [item for item in ring_items
                  if source_materials[item['material']].get('name') == ring_material]
    if not main_items:
        raise SystemExit(f'{item_name} 找不到主環材質 {ring_material}')

    main_pos = np.concatenate([item['piece']['pos'] for item in main_items])
    shifted_y = main_pos[:, 1] + y_shift
    side = np.sign(float(np.median(main_pos[:, 0])))
    limb_mask = ((np.sign(body_pos[:, 0]) == side)
                 & (body_pos[:, 1] >= shifted_y.min())
                 & (body_pos[:, 1] <= shifted_y.max()))
    limb = body_pos[limb_mask]
    if not len(limb):
        raise SystemExit(f'{item_name} 的高度範圍找不到同側肢體')

    ring_center, ring_diameter = _cross_section(main_pos)
    limb_center, limb_diameter = _cross_section(limb)
    target_diameter = limb_diameter + 2.0 * clearance
    scale = target_diameter / ring_diameter
    translation = limb_center - ring_center * scale
    for item in ring_items:
        _apply_xz_fit(item, scale, translation)
    return scale, ring_center, limb_center, limb_diameter


def hug(piece, body_pos, body_nrm, margin, smooth=2, k=6):
    """Push a garment out until it clears the body, and no further.

    The skeletons line up after the fit; the BODIES do not. Milfy's torso is
    slimmer than this one at the same bone positions, so the bodice landed
    inside the ribcage and rendered as bare skin from the front while showing
    correctly from the back, where nothing was in the way. A uniform scale
    cannot fix that without also making the garment too long.

    Each vertex is tested against the body's local surface -- the inverse-
    distance blend of its k nearest body vertices and their normals -- and moved
    out along that normal only if it sits closer than `margin`. Vertices already
    clear, which is most of a flared skirt, do not move at all.

    Only outward-facing cloth is pushed. A sock is a closed tube and its INNER
    surface is supposed to sit against the leg; pushing that out too turns the
    tube inside out, which is what shredded the boots and stockings on the first
    run -- a 45mm push on a garment whose whole wall is 2mm thick. The test is
    whether the vertex's own normal agrees with the body's underneath it.

    The displacement is smoothed over the garment's own edges afterwards.
    Without it the push follows every ripple in the body's normals and the cloth
    comes out stippled, the same failure the shell builder hit in the armpit.
    """
    tree = cKDTree(body_pos)
    dist, idx = tree.query(piece['pos'], k=k)
    w = 1.0 / np.maximum(dist, 1e-6)
    w /= w.sum(axis=1, keepdims=True)
    near = (body_pos[idx] * w[..., None]).sum(axis=1)
    normal = (body_nrm[idx] * w[..., None]).sum(axis=1)
    length = np.linalg.norm(normal, axis=1, keepdims=True)
    normal = normal / np.where(length == 0, 1.0, length)

    gap = ((piece['pos'] - near) * normal).sum(axis=1)
    push = np.maximum(margin - gap, 0.0)
    push = np.where((piece['nrm'] * normal).sum(axis=1) > 0.0, push, 0.0)

    if smooth:
        tris = piece['tris']
        edges = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
        n = len(piece['pos'])
        count = np.bincount(edges.ravel(), minlength=n).astype(np.float64)
        count[count == 0] = 1.0
        for _ in range(smooth):
            acc = np.zeros(n)
            np.add.at(acc, edges[:, 0], push[edges[:, 1]])
            np.add.at(acc, edges[:, 1], push[edges[:, 0]])
            push = 0.5 * push + 0.5 * (acc / count)

    piece['pos'] = piece['pos'] + normal * push[:, None]
    return float(push.max())
