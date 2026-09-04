"""Turn the base model's back curtain into two tails, geometry and rig together.

The reference wears twintails. This model wore long hair that had been *named*
twintails: partition.py splits the back mass down the middle into
Hair_Twintail_L and Hair_Twintail_R, the ribbons from blender/hairbow.py sit on
top of the split, and from the front it passes. From the back it does not, and
the part map says why -- at waist height those two parts own 3,250 and 3,221
pixels each, side by side with no gap, which is a curtain. Behind it the black
cardigan is fully modelled and completely hidden.

The rig said the same thing more plainly: there is ONE hair chain down the back,
root node 27, six joints from y=1.325 to y=0.768, and it starts at x=-0.026,
which is the middle. No rotation of any existing bone can make two tails out of
one chain in the centre, so this adds two, one under each tie, and moves the
free-hanging vertices and their weights onto them. Not all of them: the 778
vertices that lie on the skull stay where they are and go back onto the head
bone, because hair lying on the scalp does not leave the scalp when it is tied
(see SCALP_GAP).

Three things have to agree afterwards or the model breaks in a way that only
shows in motion:
  - the vertices sit on the new axis,
  - the joints sit on the same axis, so the spring swings where the hair is,
  - each joint's inverse bind matrix is the inverse of its NEW world transform.
Skip the third and the hair renders in the right place at rest and explodes the
moment anything moves.

WHERE THE AXIS GOES is decided by the cardigan, not by the torso. The first
version drifted the tails 125mm outward to clear the bare torso and never
looked at the coat, which hangs 60-170mm behind the skin below the chest; the
tails hung INSIDE it (45% of their vertices at rest, measured 2026-09-04), so
from behind they sank into the coat and from the front they showed through the
gap between the coat and the dress. Hair lies ON a garment, so the axis is now
derived from the coat's outer contour at each height (`waypoints`), and the
same contour fits the spheres the spring collides with (`coat_spheres`), so
the tails stay outside the coat when a clip swings them. The order in build.py
follows from this: the tails are built after the outfit has settled.

The spring's rest direction IS the bind chord, and three-vrm settles a joint
where stiffness x rest direction and gravityPower x down balance, so a tilted
chord under gravity 0.5 sags to about 60% of its tilt in the browser and the
drape designed here would fold back into the coat. The tails therefore run at
gravityPower 0 (seven of the eight VRoid hair springs on the base model do),
which makes the bind pose exactly the pose the browser settles into, and every
rest-pose gate and render in this directory truthful about the tails.
"""
import numpy as np
from scipy.spatial import cKDTree

import glb

# The tie the ribbons are already wrapped around, from blender/hairbow.py. If
# that moves, this moves with it.
TIE_X, TIE_Y, TIE_Z = 0.072, 1.450, 0.086
DROP = 0.690          # tie to tip; the curtain's own lowest vertex is y=0.749
SEGMENTS = 6          # one more than the chain it replaces, same segment length
BLEND = 0.040         # above the tie the scalp is left alone
TAIL_HIT_RADIUS = 0.035
# 外套相關的常數。髮束表面到外套外殼的間隙；擬合球比「外殼＋髮束半徑」再多留的
# 餘量；球沿身高的間距，最高一顆放在肩胛以下（COAT_SPHERE_TOP）：肩線那圈在
# T-pose 是連著袖子的平肩（|x| 0.29），2026-09-04 試過 1.16，圓球被撐到 198mm、
# 把綁點下方第一節頂到離身軸 40cm；而肩胛那段外套離身體的 collider 只有 2-5cm，
# 不放球也差不了多少；
# 輪廓的高度帶與方位角扇區；髮束在方位角上的半寬；T-pose 下 |x| 超過 TORSO_X_MAX
# 的外套頂點是袖子（見 outfit.standoff），不算進軀幹輪廓。
TAIL_COAT_GAP = 0.004
COAT_SPHERE_MARGIN = 0.004
COAT_SPHERE_STEP = 0.06
COAT_SPHERE_TOP = 1.10
COAT_BEAD_RADIUS = 0.07
COAT_BEADS_PER_BAND = 9
COAT_BAND = 0.02
COAT_SECTOR = np.radians(10.0)
# 珠子只鋪馬尾搆得到的那片外套：從身側偏前（-20°，dance 轉身時馬尾會甩過身側，
# 只鋪到 10° 時 springsim 量到它從 φ=-7° 鑽進外套側翼 78mm）到正後方（90°）。
COAT_SECTOR_RANGE = (np.radians(-20.0), np.radians(90.0))
TAIL_SPREAD = np.radians(8.0)
TORSO_X_MAX = 0.30
# 彈簧撞的身體 collider（源模型的 VRoid 組，按節點名挑）。手臂那六組（左右上臂、
# 前臂、手）一起留著：2026-09-04 用 springsim.ts 量 dance，拿掉它們之後外套最深、
# 身體最深、單幀轉角三個數字都不變（evidence/twintail-0904.log R11）；留著是讓
# 髮軸不能整根穿過手臂，這一點沒有單獨的量測。
TAIL_BODY_COLLIDERS = ('J_Bip_C_Head', 'J_Bip_C_Neck', 'J_Bip_C_UpperChest',
                       'J_Bip_C_Spine',
                       'J_Bip_L_UpperArm', 'J_Bip_L_LowerArm', 'J_Bip_L_Hand',
                       'J_Bip_R_UpperArm', 'J_Bip_R_LowerArm', 'J_Bip_R_Hand')
# 外套珠子掛在哪根骨頭上：取球心高度以下最近的一根。下襬（COAT_LEG_BAND_TOP 以
# 下）的珠子再各掛一份到同側大腿骨：garment.bind 讓外套下襬有一半頂點主要跟著
# 大腿走（2026-09-04 量：髖 439／左腿 427／右腿 427），dance 抬腿時下襬跟著腿
# 甩，只掛髖骨的珠子留在原地，馬尾就從那裡進外套（springsim 量到 78mm，都在
# y≈0.85）。兩份同時存在，靜止時重合、動起來各跟各的，取聯集是保守的一方。
COAT_SPHERE_BONES = ('J_Bip_C_UpperChest', 'J_Bip_C_Chest', 'J_Bip_C_Spine',
                     'J_Bip_C_Hips')
COAT_LEG_BAND_TOP = 0.93
COAT_LEG_BONES = {-1.0: 'J_Bip_L_UpperLeg', 1.0: 'J_Bip_R_UpperLeg'}
# 貼著頭骨那一層不跟著收進尾巴。真髮的雙馬尾是「髮從頭皮往上收到綁點，綁點以
# 下才垂下來」：綁點以下貼在頭皮上的那段仍然在頭上。把整片後髮無差別收到側面
# 會讓枕骨從 y[1.40,1.478] 裸出一塊皮膚，使用者看到的「後腦勺像禿頭」就是它。
# 20mm 是這一層的判準：以它選出的頂點在 y[1.363,1.490] 每一格都高過頭骨（最窄
# 一格 0.1312 對 0.1244），30mm 與 45mm 只多收下擺、枕骨那段一個頂點也沒多。
# 15mm 過渡帶讓髮片從「貼著頭皮」漸變到「收進尾巴」，避免在交界撕開。
SCALP_GAP = 0.020
SCALP_BAND = 0.015


def design(side, t):
    """The bare-torso line: the tie plus an outward drift, a fraction t down.

    This is the floor the coat-derived axis can never go inside of, and the
    direction (azimuth about the body's axis) the tail keeps when the coat
    pushes it further out. The drift was sized for the naked torso: at 85mm the
    two tails still met on the spine -- the left one reached x=+0.030 -- and
    the waist showed nine pixels of cardigan; 125mm on top of the 75mm tie puts
    the inner edge outside the ribs. It says nothing about the coat, which is
    why it is no longer the axis itself (see the module docstring).
    """
    return np.array([side * (TIE_X + 0.125 * t),
                     TIE_Y - DROP * t,
                     TIE_Z + 0.040 * t])


def _azimuth(side, t):
    """Angle of the design line about the body's axis, 0 = straight out to the
    side, pi/2 = straight back. Both sides share it; `side` only mirrors x."""
    d = design(side, t)
    return float(np.arctan2(d[2], abs(d[0])))


class CoatContour:
    """Outermost radius of the cardigan's torso panels, per height band and
    azimuth sector about the body's axis (x=0, z=0). Both sides are folded onto
    one half so the two tails come out symmetric even where the coat is not."""

    def __init__(self, coat_pos):
        pos = np.asarray(coat_pos, dtype=np.float64)
        pos = pos[np.abs(pos[:, 0]) <= TORSO_X_MAX]
        self.band = np.floor(pos[:, 1] / COAT_BAND).astype(int)
        self.sector = np.floor(np.arctan2(pos[:, 2], np.abs(pos[:, 0])) / COAT_SECTOR).astype(int)
        self.radius = np.hypot(pos[:, 0], pos[:, 2])
        self.y = pos[:, 1]
        self.phi = np.arctan2(pos[:, 2], np.abs(pos[:, 0]))
        self.table = {}
        for b, sct, r in zip(self.band, self.sector, self.radius):
            key = (int(b), int(sct))
            best, n = self.table.get(key, (0.0, 0))
            self.table[key] = (max(best, float(r)), n + 1)
        self.y_min, self.y_max = float(pos[:, 1].min()), float(pos[:, 1].max())

    def at(self, y, phi, spread=0.0):
        """Largest coat radius in the band of y, within +-spread of phi.
        nan where the coat has nothing there (fewer than 3 vertices)."""
        band = int(np.floor(y / COAT_BAND))
        lo = int(np.floor((phi - spread) / COAT_SECTOR))
        hi = int(np.floor((phi + spread) / COAT_SECTOR))
        best = np.nan
        for sct in range(lo, hi + 1):
            r, n = self.table.get((band, sct), (0.0, 0))
            if n >= 3 and not (r <= best):
                best = r
        return best


def coat_spheres(contour, hit_radius=TAIL_HIT_RADIUS):
    """Spheres the tails collide with, standing in for the coat's outer shell.

    VRM0 colliders are spheres and the coat's section is an ellipse, widest at
    the sides, so no one sphere per height can hug it: the smallest circle
    enclosing the 15-90 deg arc at the hip stands 86mm proud of the coat where
    the tail hangs (and a circle pinned to the midline, tried first, 60mm
    further still), which floated the tails 40cm off the axis. So the coat is
    beaded instead: per COAT_SPHERE_STEP of height from COAT_SPHERE_TOP down to
    the hem, COAT_BEADS_PER_BAND spheres of COAT_BEAD_RADIUS spaced evenly over
    the sectors a tail can reach, each centred INSIDE the shell so that its
    surface stands (bundle radius - hitRadius + margin) outside the contour:
    three-vrm keeps a JOINT at hitRadius from a collider, but what must stay
    outside the coat is the bundle's surface, which is the bundle's radius
    further in. Between beads the envelope dips by under 7mm at this spacing.

    Returns [(centre y, centre |x|, centre z, radius)] for the +x side; the
    -x side mirrors x. Both sides read the folded contour so the tails stay
    symmetric.
    """
    out = []
    y = COAT_SPHERE_TOP
    half = COAT_SPHERE_STEP * 0.5
    while y >= contour.y_min:
        # The bundle's radius at the band's own height, not the band's maximum:
        # thickness() varies by 3mm over a band, and the maximum was one of
        # three things adding up to hair floating 68mm off the coat.
        bundle = float(thickness((TIE_Y - y) / DROP))
        proud = bundle - hit_radius + COAT_SPHERE_MARGIN
        if proud > COAT_BEAD_RADIUS:
            raise SystemExit('外套珠子的半徑比它要撐出來的量還小，球心會落在外套外面')
        for phi in np.linspace(*COAT_SECTOR_RANGE, COAT_BEADS_PER_BAND):
            r_c = np.nanmax([contour.at(y - half * 0.5, phi, COAT_SECTOR * 0.6),
                             contour.at(y + half * 0.5, phi, COAT_SECTOR * 0.6)])
            if not np.isfinite(r_c):
                continue
            radial = r_c + proud - COAT_BEAD_RADIUS
            out.append((y, float(radial * np.cos(phi)), float(radial * np.sin(phi)),
                        COAT_BEAD_RADIUS))
        y -= COAT_SPHERE_STEP
    return out


def sphere_reach(spheres, y, phi):
    """How far out, along azimuth phi at height y, the spheres' union extends
    from the body's axis (folded half-plane, x >= 0). -inf where none of them
    cuts that height."""
    reach = -np.inf
    u = (np.cos(phi), np.sin(phi))
    for cy, cx, cz, rho in spheres:
        dy = y - cy
        if abs(dy) >= rho:
            continue
        rc2 = rho * rho - dy * dy
        uc = cx * u[0] + cz * u[1]
        disc = uc * uc - (cx * cx + cz * cz) + rc2
        if disc < 0:
            continue
        reach = max(reach, uc + np.sqrt(disc))
    return reach


def waypoints(side, contour, spheres, hit_radius=TAIL_HIT_RADIUS):
    """The tail's axis as SEGMENTS+1 points, tie first, tip last.

    At each height the tail must clear (a) the coat's outer contour by the
    bundle's radius plus TAIL_COAT_GAP and (b) the collider spheres by
    hitRadius plus the gap, so that at rest no joint sits inside a collider
    (three-vrm resolves such an overlap on its first physics frame as a visible
    snap). Both are evaluated densely along the design line's azimuth, +-
    TAIL_SPREAD because the bundle has width, and a waypoint takes the maximum
    over the two segments it belongs to so that every CHORD, not just its
    ends, clears. The radius is then made monotone downward: hair that has
    been pushed out by the coat hangs plumb below the widest point, it does
    not tuck back in under a hem. The tie itself never moves: the ribbons from
    blender/hairbow.py are wrapped around it.
    """
    ts = np.linspace(0.0, 1.0, 24 * SEGMENTS + 1)
    need = np.full(ts.shape, -np.inf)
    for i, t in enumerate(ts):
        y = TIE_Y - DROP * t
        phi = _azimuth(side, t)
        c = contour.at(y, phi, TAIL_SPREAD)
        if np.isfinite(c):
            need[i] = c + float(thickness(t)) + TAIL_COAT_GAP
        s = max(sphere_reach(spheres, y, phi - TAIL_SPREAD),
                sphere_reach(spheres, y, phi),
                sphere_reach(spheres, y, phi + TAIL_SPREAD))
        if np.isfinite(s):
            need[i] = max(need[i], s + hit_radius + TAIL_COAT_GAP)
    out = []
    radius = 0.0
    for k in range(SEGMENTS + 1):
        t = k / SEGMENTS
        d = design(side, t)
        r = float(np.hypot(d[0], d[2]))
        if k > 0:
            lo, hi = (k - 1) / SEGMENTS - 1e-9, (k + 1) / SEGMENTS + 1e-9
            window = need[(ts >= lo) & (ts <= hi)]
            r = max(r, float(window.max()) if len(window) else r, radius)
        radius = r
        phi = _azimuth(side, t)
        out.append([side * r * np.cos(phi), d[1], r * np.sin(phi)])
    return np.array(out)


def axis(side, t, points=None):
    """Where the tail's centre line is, a fraction t (scalar or array) down:
    the design line when there is no coat, else linear between `waypoints`."""
    t = np.asarray(t, dtype=np.float64)
    if points is None:
        return np.moveaxis(np.asarray(design(side, t)), 0, -1)
    knots = np.linspace(0.0, 1.0, len(points))
    tc = np.clip(t, 0.0, 1.0)
    return np.stack([np.interp(tc, knots, points[:, 0]),
                     TIE_Y - DROP * t,
                     np.interp(tc, knots, points[:, 2])], axis=-1)


def thickness(t):
    """Radius of the bundle. Widest below the tie, tapering to the tip."""
    return 0.042 + 0.034 * np.sin(np.pi * np.clip(t, 0.0, 1.0))


def smooth_normals(positions, indices):
    """Vertex normals of the mesh `positions`/`indices` actually describe: the
    angle-weighted average of each vertex's adjacent triangle normals (Max
    1999) -- each face's unit normal weighted by the interior angle IT
    SUBTENDS AT THAT VERTEX, not by its area.

    Rolling a flat curtain into a round bundle is not a local scale -- the
    curtain's normals mostly face one way (front/back), the bundle's face
    outward all the way around, so a normal near the seam has to turn by
    close to 90 degrees between neighbouring vertices. No SINGLE per-vertex
    formula computed from that vertex's own (fade, r) can produce that: two
    tries did (normal_horizontal_scale's predecessor, then that function
    itself), and both left every vertex's normal individually defensible
    while the FIELD across vertices was not, which is exactly what an
    outline pass -- built by extruding along the normal and relying on
    neighbours agreeing which way is out -- turns into a folded, self-
    -occluding dark patch. Reading the normal off the deformed triangles
    instead is correct by construction: it cannot disagree with the surface
    that is actually there.

    The first version of this function (shipped as -7) weighted each face by
    AREA instead of angle. That shipped clean on a full dance-clip sweep, but
    the user then reported the two former gap sites as "unnatural bumps" that
    do not read as one piece with the surrounding hair. Root cause: rolling
    the curtain's edge into the tube leaves a few thin "seam" triangles that
    bridge a close vertex cluster to one ~40mm further round the tube --
    Hair_Twintail_L primitive 6 vertex 164 is one, with interior angles of
    70.5/11.7/51.1 degrees across its three adjacent triangles. That sliver's
    OWN corner angle at the vertex (11.7 degrees) says it should barely count
    -- its two long edges make it nearly collinear there -- but its area is
    comparable to its well-formed neighbours, since area grows with how far
    the far cluster is, not with how sharp the corner is. Area-weighting
    therefore let the sliver pull the vertex normal towards its own
    (very different) face direction about as hard as either well-formed
    triangle, producing one bright, hard-edged, off-field normal precisely
    where the geometry pinches -- the "bump". Angle-weighting scores each
    face by the angle it actually occupies at that vertex, so the sliver's
    11.7-degree sliver of the vertex counts for 11.7 degrees, not for its
    full share of the mesh's surface area: a fair vote among the triangles
    that actually meet there, not among however much of the mesh happens to
    be attached to them.
    """
    tris = indices.reshape(-1, 3)
    p0, p1, p2 = positions[tris[:, 0]], positions[tris[:, 1]], positions[tris[:, 2]]
    face = np.cross(p1 - p0, p2 - p0)  # direction = the triangle's winding
    face_len = np.linalg.norm(face, axis=1, keepdims=True)
    unit_face = face / np.maximum(face_len, 1e-12)

    def corner_angle(a, b, c):
        """Interior angle of the triangle at corner `a`, between edges a->b and a->c."""
        u, v = b - a, c - a
        cos = np.sum(u * v, axis=1) / np.maximum(
            np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1), 1e-12)
        return np.arccos(np.clip(cos, -1.0, 1.0))

    weight = [corner_angle(p0, p1, p2), corner_angle(p1, p2, p0), corner_angle(p2, p0, p1)]
    out = np.zeros_like(positions)
    for corner in range(3):
        np.add.at(out, tris[:, corner], unit_face * weight[corner][:, None])
    norm = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.maximum(norm, 1e-9)


def smooth_scalar(values, indices, passes=2):
    """Blend each vertex's scalar value halfway towards its triangle-adjacent
    neighbours' average, `passes` times.

    Written for `free` in apply(): scalp distance is a per-vertex nearest-
    -neighbour query against a point cloud, which has no notion of "these two
    vertices are on the same strand". 2026-09-04, third round: a vertex could
    land at free=0.00 (fully on the scalp) with its topological neighbour, on
    the SAME triangle, at free=0.63 -- both individually correct readings of
    "how far is the nearest scalp point", but nothing requires that reading to
    change smoothly from one triangle corner to the next. SCALP_BAND exists to
    turn that into a gradual transition, and does, in DISTANCE; it says
    nothing about how that distance is laid out over the mesh's own vertices,
    so two vertices ~15mm apart on the actual surface can end up on opposite
    ends of the band anyway, and the position blend downstream (line ~524)
    then places them tens of centimetres apart in the finished tail -- a real
    fold, not a shading artefact, which is why switching normal-averaging
    schemes (smooth_normals) could not remove it. Averaging over the mesh's
    own triangles, the same move smooth_normals makes for normals, can only
    disagree with a vertex's real neighbours by as much as they actually
    disagree with EACH OTHER, not by however sharp scalp.query happened to
    land at that one vertex.
    """
    tris = indices.reshape(-1, 3)
    out = values.astype(np.float64).copy()
    for _ in range(passes):
        acc = np.zeros_like(out)
        cnt = np.zeros_like(out)
        for a, b in ((0, 1), (1, 2), (2, 0)):
            ia, ib = tris[:, a], tris[:, b]
            np.add.at(acc, ia, out[ib])
            np.add.at(cnt, ia, 1.0)
            np.add.at(acc, ib, out[ia])
            np.add.at(cnt, ib, 1.0)
        neighbour_avg = acc / np.maximum(cnt, 1.0)
        out = np.where(cnt > 0, 0.5 * out + 0.5 * neighbour_avg, out)
    return out


def _prims(doc, manifest, part):
    mesh = next(m for m in doc['meshes'] if m.get('name') == manifest[part]['mesh'])
    return [mesh['primitives'][i] for i in manifest[part]['primitives']]


def _overwrite(doc, views, index, array):
    """Replace an accessor's data in place.

    Only safe because every one of these accessors owns its bufferView outright:
    offset 0, no byteStride, length exactly the array. Checked rather than
    assumed, because writing past a shared view would corrupt a neighbour.
    """
    acc = doc['accessors'][index]
    bv = doc['bufferViews'][acc['bufferView']]
    array = np.ascontiguousarray(array)
    if acc.get('byteOffset', 0) or bv.get('byteStride') or bv['byteLength'] != array.nbytes:
        raise SystemExit(f'accessor {index} 不是獨佔的 bufferView，不能就地覆寫')
    views[acc['bufferView']] = bytearray(array.tobytes())
    if 'min' in acc:
        acc['min'] = [float(v) for v in array.min(axis=0)]
        acc['max'] = [float(v) for v in array.max(axis=0)]


def _chain(doc, head, side, name, points=None):
    """Append a joint chain under the head, following axis().

    Returns (node indices, their world positions). The world positions are
    returned rather than looked up afterwards, and that is the whole point: the
    first version derived them by walking the parent map, which had been built
    before these nodes existed, so every one of them resolved to its own local
    translation as though it sat at the scene root. The inverse bind matrices
    came out wrong by the head's height, the rest pose still rendered correctly
    because a rest render reads POSITION and never skins, and the hair shot
    vertically off the top of the frame the moment any clip played.

    Every node is a pure translation with no rotation, which is what the chain it
    replaces was, and it keeps the inverse bind matrix a plain negated position
    instead of a matrix inversion.
    """
    made, worlds, prev = [], [], None
    for k in range(SEGMENTS + 1):
        world = axis(side, k / SEGMENTS, points)
        local = world - (prev if prev is not None else head)
        doc['nodes'].append({'name': f'{name}{k}',
                             'translation': [float(v) for v in local]})
        idx = len(doc['nodes']) - 1
        if made:
            doc['nodes'][made[-1]].setdefault('children', []).append(idx)
        made.append(idx)
        worlds.append(world)
        prev = world
    return made, worlds


def apply(doc, views, manifest, scalp_pos, coat_pos=None,
          parts=('Hair_Twintail_L', 'Hair_Twintail_R')):
    """Rebuild the back hair as two tails. Returns what it moved, per part.

    `scalp_pos` is the body's own vertices. The curtain's innermost layer lies
    ON the skull, and hair that lies on the skull stays there when it is tied
    into tails: only what hangs free is gathered. Without that split the whole
    sheet leaves the occiput and the skull shows through from behind. The split
    has to happen here rather than be patched afterwards, because a copy left
    behind would be the same triangles twice, bound to two different bones, and
    they would come apart the moment a tail swings.

    `coat_pos` is the cardigan's settled TORSO vertices (outer shell and
    lining, T-pose, sleeves already removed by the caller: in T-pose a sleeve
    cap reaches azimuth 25-40 deg at radius 0.22-0.27 right where a tail passes
    the shoulder, and in the browser that sleeve hangs at her side). With it
    the axis and the spring colliders are derived from the coat (see the module
    docstring); without it the tails fall back to the bare-torso design line
    and collide with the body only.
    """
    nodes = doc['nodes']
    skin = doc['skins'][0]
    joints = skin['joints']

    head_node = next(b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']
                     if b['bone'] == 'head')
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', ())}

    def world_of(i):
        p = np.zeros(3)
        while True:
            n = nodes[i]
            if n.get('rotation') and list(n['rotation']) != [0, 0, 0, 1]:
                raise SystemExit(f'節點 {i} 有旋轉，這裡的平移假設不成立')
            p = p + np.array(n.get('translation', [0, 0, 0]), dtype=np.float64)
            if i not in parent:
                return p
            i = parent[i]

    head_world = world_of(head_node)
    head_slot = joints.index(head_node)
    scalp = cKDTree(scalp_pos)

    # The chain being replaced, as skin-joint indices, deepest last.
    old = [27]
    while nodes[old[-1]].get('children'):
        old.append(nodes[old[-1]]['children'][0])
    old_slots = [joints.index(n) for n in old]

    ibm = glb.read_accessor(doc, views, skin['inverseBindMatrices']).reshape(-1, 4, 4)
    report = {}

    contour = CoatContour(coat_pos) if coat_pos is not None else None
    spheres = coat_spheres(contour) if contour is not None else []
    if spheres:
        ys = sorted({round(cy, 3) for cy, _, _, _ in spheres}, reverse=True)
        print(f'   外套珠子 {len(spheres)} 顆/側，半徑 {spheres[0][3] * 1000:.0f}mm，'
              f'高度 {ys[0]:.2f}→{ys[-1]:.2f}，每層 {len(spheres) // len(ys)} 顆')

    for part in parts:
        prims = _prims(doc, manifest, part)
        pos = [glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
               for pr in prims]
        side = float(np.sign(np.mean(np.vstack(pos)[:, 0])))
        points = waypoints(side, contour, spheres) if contour is not None else None

        chain, chain_world = _chain(doc, head_world, side,
                                    f'HairTail{"L" if side < 0 else "R"}_', points)
        doc['nodes'][head_node].setdefault('children', []).append(chain[0])
        new_slots = []
        for i, world in zip(chain, chain_world):
            joints.append(i)
            m = np.eye(4)
            m[:3, 3] = -world
            ibm = np.concatenate([ibm, m.T[None]])      # glTF matrices are column-major
            new_slots.append(len(joints) - 1)

        # Where the curtain's own centre is at each height, so the tail is built
        # from the cloth that was actually there rather than from the mesh origin.
        every = np.vstack(pos)
        below = every[every[:, 1] <= TIE_Y]
        edges = np.linspace(below[:, 1].min(), TIE_Y, 24)
        mids = 0.5 * (edges[:-1] + edges[1:])
        centre = np.array([below[(below[:, 1] >= a) & (below[:, 1] < b)][:, [0, 2]].mean(axis=0)
                           if ((below[:, 1] >= a) & (below[:, 1] < b)).sum() else [np.nan, np.nan]
                           for a, b in zip(edges[:-1], edges[1:])])
        for c in range(2):                               # carry the last good value
            good = ~np.isnan(centre[:, c])
            centre[:, c] = np.interp(mids, mids[good], centre[good, c])
        # The 90th percentile of the distance to the centre, not the mean. The
        # mean was the second mistake: a flat sheet 300mm across has a mean
        # radius of about 90mm, which is roughly the radius a tail should have,
        # so the scale came out near 1 and the sheet stayed a sheet. What has to
        # come down is the sheet's REACH, and that is its outer edge.
        spread = np.array([np.percentile(np.linalg.norm(
            below[(below[:, 1] >= a) & (below[:, 1] < b)][:, [0, 2]]
            - centre[k], axis=1), 90)
            if ((below[:, 1] >= a) & (below[:, 1] < b)).sum() else np.nan
            for k, (a, b) in enumerate(zip(edges[:-1], edges[1:]))])
        spread = np.interp(mids, mids[~np.isnan(spread)], spread[~np.isnan(spread)])

        moved = 0.0
        for pr, p in zip(prims, pos):
            if pr.get('mode', 4) != 4 or 'indices' not in pr:
                raise SystemExit(f'{part} 的圖元不是索引三角形，無法從實際幾何算法向量')
            idx = glb.read_accessor(doc, views, pr['indices']).astype(np.int64)

            t = np.clip((TIE_Y - p[:, 1]) / DROP, 0.0, 1.0)
            fade = np.clip((TIE_Y + BLEND - p[:, 1]) / BLEND, 0.0, 1.0)
            # 貼著頭骨的那一層留在原位：free 0 是完全不動、1 是完全收進尾巴。
            # scalp.query 是逐頂點各自對點雲最近鄰查詢，不知道「這兩點在同一根
            # 髮束上」，鄰接頂點可能落在 SCALP_BAND 的兩端（見 smooth_scalar）；
            # 拓樸平滑讓 free 場跟著網格本身的鄰接關係走，不是逐點各判各的。
            free_raw = np.clip((scalp.query(p)[0] - SCALP_GAP) / SCALP_BAND, 0.0, 1.0)
            free = smooth_scalar(free_raw, idx)
            fade = fade * free
            cx = np.interp(p[:, 1], mids, centre[:, 0])
            cz = np.interp(p[:, 1], mids, centre[:, 1])
            sp = np.maximum(np.interp(p[:, 1], mids, spread), 1e-4)
            r = np.minimum(thickness(t) / sp, 1.0)
            # The same axis the joints sit on. This used to be a second copy
            # of the formula, which is exactly how the joints and the cloth
            # would have parted ways the first time only one of them changed.
            a = axis(side, t, points)

            out = p.copy()
            out[:, 0] = a[:, 0] + (p[:, 0] - cx) * r
            out[:, 2] = a[:, 2] + (p[:, 2] - cz) * r
            out = p + (out - p) * fade[:, None]
            moved = max(moved, float(np.abs(out - p).max()))
            _overwrite(doc, views, pr['attributes']['POSITION'], out.astype(np.float32))

            if 'NORMAL' in pr['attributes']:
                # See smooth_normals(): reads the normal off the deformed
                # triangles instead of computing each vertex's from its own
                # (fade, r) -- the latter twice produced a normal FIELD that
                # disagreed with itself badly enough to fold the MToon
                # outline shell into a dark gap (evidence/twintail-gap-0904.md).
                n = smooth_normals(out.astype(np.float64), idx)
                _overwrite(doc, views, pr['attributes']['NORMAL'], n.astype(np.float32))

            j = glb.read_accessor(doc, views, pr['attributes']['JOINTS_0']).copy()
            for a_slot, b_slot in zip(old_slots, new_slots):
                j[j == a_slot] = b_slot
            # 收進尾巴的頂點依它在新鏈上的高度重配權重，不沿用「舊第 k 節→新第
            # k 節」的對應。舊髮簾的鏈從 y=1.325 起算，新鏈從綁點 1.45 起算，逐節
            # 對應讓每個頂點都綁到比自己高一節（12.5cm）的關節：靜止時是 bind
            # pose 看不出來，尾巴一彎髮絲就繞著錯的支點轉。2026-09-04 springsim
            # 在 dance 轉身那幀量到：關節都被外套珠子擋在 r=0.32，一個靜止在
            # y=1.039 的頂點卻 95% 綁在 y=1.22 的第 2 節，被帶到 r=0.195、鑽進
            # 外套側翼 45mm。這裡改成線性蒙皮：在第 k 段的頂點按段內位置分給第
            # k、k+1 節，尾尖以下全給末節；頭皮那份（1-free）仍給頭骨。
            moved_rows = np.nonzero(fade > 0)[0]
            if len(moved_rows):
                w = glb.read_accessor(doc, views, pr['attributes']['WEIGHTS_0']).astype(np.float32).copy()
                tv = t[moved_rows]
                seg = np.clip(np.floor(tv * SEGMENTS), 0, SEGMENTS - 1).astype(int)
                frac = np.clip(tv * SEGMENTS - seg, 0.0, 1.0)
                slots = np.array(new_slots)
                # 權重跟位置/法向量共用同一個平滑值 `free` 會漏權重：一個自己的
                # 原始距離判定「就貼在頭皮上」（free_raw==0，appearance_test 的
                # on_skull 也是同一條 SCALP_GAP 界線）的頂點，會從隔壁高 free 的
                # 鄰居借到骨架權重（縫出現過的 0.28），bind pose 看不出來，尾巴
                # 一甩就露餡（見 test_scalp_layer_carries_no_tail_weight 的
                # 「後腦禿頭」事故記錄）。但整段都改回未平滑的 free_raw 會在貼皮
                # 層跟尾巴層的交界處重新造出鋸齒：那正是 smooth_scalar 當初要解
                # 的同一種「網格相鄰、查詢各自為政」問題，只是這次發生在權重場
                # 而不是位置場。折衷：只在「自己的原始距離就是 0」這一條線上鎖
                # 死為 0（滿足上面那條測試的界線），線外（free_raw>0，哪怕只
                # 大一點點）仍吃平滑值，跟位置/法向量用同一份連續場。
                weight_free = np.where(free_raw > 0.0, free, 0.0)
                fr = weight_free[moved_rows].astype(np.float32)
                j[moved_rows] = 0
                w[moved_rows] = 0.0
                j[moved_rows, 0], w[moved_rows, 0] = slots[seg], fr * (1.0 - frac)
                j[moved_rows, 1], w[moved_rows, 1] = slots[seg + 1], fr * frac
                j[moved_rows, 2], w[moved_rows, 2] = head_slot, 1.0 - fr
                w[moved_rows] /= np.maximum(w[moved_rows].sum(axis=1, keepdims=True), 1e-9)
                _overwrite(doc, views, pr['attributes']['WEIGHTS_0'], w)
            # 綁點以上沒被搬動、但貼著頭皮的頂點也要留在頭骨的權重上，否則尾巴
            # 一甩它就跟著飛。過渡帶按 free 混合：尾巴那份權重乘 free，缺的補成
            # 頭骨影響，塞進該頂點權重最小的那一格（VRoid 的髮很少用滿四格）。
            held = (free < 1.0) & (fade <= 0)
            if held.any():
                w = glb.read_accessor(doc, views, pr['attributes']['WEIGHTS_0']).copy()
                w = w.astype(np.float32)
                rows = np.nonzero(held)[0]
                w[rows] *= free[rows, None]
                slot = np.argmin(w[rows], axis=1)
                # 借來放頭骨影響的那一格必須是空的。這個模型的髮沒有一個頂點
                # 用滿四格（被借走那格的權重最大值是 0.0），但那是這份資料的
                # 性質不是保證：換一份用滿四格的髮，靜默覆寫會吃掉一個真的骨
                # 頭影響，畫面上是一小塊髮跟錯關節。寧可在這裡停下來。
                # 門檻量的是乘過 free 之後的值，所以 free 極小時一個真實影響
                # 可能低於 1e-6 而過關；那一段的頂點本來就要 100% 綁頭骨，被
                # 覆寫的影響也已經被 free 縮到看不見。
                taken = w[rows, slot]
                if float(taken.max()) > 1e-6:
                    raise SystemExit(
                        f'{part} 有頂點四格權重全滿（最小格 {taken.max():.4f}），'
                        '無處安放頭骨影響')
                j[rows, slot] = head_slot
                w[rows, slot] += 1.0 - free[rows]
                w[rows] /= np.maximum(w[rows].sum(axis=1, keepdims=True), 1e-9)
                _overwrite(doc, views, pr['attributes']['WEIGHTS_0'], w)
            _overwrite(doc, views, pr['attributes']['JOINTS_0'], j)

        report[part] = {'side': side, 'moved_mm': moved * 1000, 'chain': chain,
                        'points': points if points is not None else axis(side, np.linspace(0, 1, SEGMENTS + 1))}

    skin['inverseBindMatrices'] = glb.add_accessor(
        doc, views, ibm.reshape(-1, 16).astype(np.float32))

    # Every skin, not just skins[0]. The VRoid export carries three -- face,
    # body and hair -- over the same joint list, and the hair mesh is on the
    # third. Appending the tail bones to the first alone left the rewritten
    # JOINTS_0 pointing at slots 125..136 of a 125-slot skin. Nothing in this
    # pipeline noticed, because it skins from skins[0] throughout; three.js
    # loaded the file, reported all 54 humanoid bones, and then threw reading
    # `skeleton.bones[i].matrixWorld` the moment it drew a frame -- the model
    # was unusable in a browser and every gate here was green.
    for other in doc['skins']:
        if other is skin or other['joints'] == joints:
            continue
        if other['joints'] != joints[:len(other['joints'])]:
            raise SystemExit('skin 的關節列表不是共用前綴，新骨鏈無法安全附加')
        other['joints'] = list(joints)
        other['inverseBindMatrices'] = skin['inverseBindMatrices']

    # The spring that drove the single centre chain now drives the two tails.
    secondary = doc['extensions']['VRM']['secondaryAnimation']
    name_of = {i: n.get('name', '') for i, n in enumerate(nodes)}
    body_groups = [i for i, g in enumerate(secondary.get('colliderGroups', []))
                   if name_of.get(g.get('node')) in TAIL_BODY_COLLIDERS]
    coat_groups = _coat_collider_groups(doc, secondary, spheres)
    tail_points = [w for p in report for w in report[p]['points'][1:]]
    for group in secondary['boneGroups']:
        if old[0] in group.get('bones', []):
            group['bones'] = [report[p]['chain'][0] for p in report]
            # The source curtain used a 96mm collision radius. The two rebuilt
            # tails are much narrower, and keeping that radius places their
            # first two segments inside the head colliders at rest. three-vrm
            # resolves the overlap on its first physics frame as a visible
            # snap, then repeats it whenever a motion brings the head back
            # across the collider boundary.
            group['hitRadius'] = TAIL_HIT_RADIUS
            # Bind chord = rest direction = settled pose, only at zero gravity;
            # see the module docstring for the sag arithmetic.
            group['gravityPower'] = 0.0
            # The body's own VRoid colliders plus the coat spheres. The 2026-09-01
            # version emptied this list on an eyeballed "27° single-frame jumps";
            # springsim.ts measured 16.7° WITHOUT colliders on the shipped file,
            # so that number was the dance, not the colliders.
            group['colliderGroups'] = body_groups + coat_groups
            group['comment'] = 'Twintails'
    _assert_rest_clearance(doc, secondary, group_indices=body_groups + coat_groups,
                           points=tail_points, hit_radius=TAIL_HIT_RADIUS)

    # The remaining VRoid HairJoint chains only drive small upper-hair tufts.
    # During quick mocap they overshoot by roughly 29 degrees in one 60 Hz
    # frame, producing the visible twitch. The rebuilt HairTail chains retain
    # secondary motion, while these short tufts follow the head rigidly.
    secondary['boneGroups'] = [
        group for group in secondary['boneGroups']
        if not any(
            doc['nodes'][root].get('name', '').startswith('HairJoint-')
            for root in group.get('bones', ())
        )
    ]
    prune_stranded_collider_groups(doc)
    return report


def _bone_world(doc, name):
    """(node index, rest world position) of the node called `name`."""
    nodes = doc['nodes']
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', ())}
    index = next(k for k, n in enumerate(nodes) if n.get('name') == name)
    i, p = index, np.zeros(3)
    while True:
        p = p + np.array(nodes[i].get('translation', [0, 0, 0]), dtype=np.float64)
        if i not in parent:
            return index, p
        i = parent[i]


def _coat_collider_groups(doc, secondary, spheres):
    """Append the coat spheres as VRM0 collider groups, one per carrying bone.

    A VRM0 collider offset is in the bone's local frame with z NEGATED: three-
    vrm's VRM0 importer flips only z ("z is opposite in VRM0.0"), and the base
    model's own colliders confirm it (the head sphere is stored at z=-0.013 and
    lands behind the head joint). Every bone here rests at identity rotation,
    so the local frame is a pure translation. Returns the new group indices.
    """
    if not spheres:
        return []
    bones = {name: _bone_world(doc, name)
             for name in COAT_SPHERE_BONES + tuple(COAT_LEG_BONES.values())}
    per_bone = {}

    def hang(name, side, cy, cx, cz, rho):
        w = bones[name][1]
        per_bone.setdefault(name, []).append({
            'offset': {'x': float(side * cx - w[0]), 'y': float(cy - w[1]),
                       'z': float(-(cz - w[2]))},
            'radius': float(rho)})

    for cy, cx, cz, rho in spheres:
        below = [n for n in COAT_SPHERE_BONES if bones[n][1][1] <= cy + 1e-6]
        name = (max(below, key=lambda n: bones[n][1][1]) if below
                else min(COAT_SPHERE_BONES, key=lambda n: bones[n][1][1]))
        for side in (-1.0, 1.0):
            hang(name, side, cy, cx, cz, rho)
            if cy <= COAT_LEG_BAND_TOP:
                # Near the back centre the hem is pulled by either leg.
                legs = ([COAT_LEG_BONES[side]] if cx > cz * 0.27
                        else list(COAT_LEG_BONES.values()))
                for leg in legs:
                    hang(leg, side, cy, cx, cz, rho)
    groups = secondary.setdefault('colliderGroups', [])
    made = []
    for name, colliders in per_bone.items():
        groups.append({'node': bones[name][0], 'colliders': colliders})
        made.append(len(groups) - 1)
    return made


def _assert_rest_clearance(doc, secondary, group_indices, points, hit_radius):
    """No tail joint may rest inside a collider it is asked to avoid.

    three-vrm tests a joint's CHILD position against hitRadius plus the
    collider's radius; an overlap at bind is resolved on the first physics
    frame as a snap and again every time a motion crosses back. Checked here,
    where the geometry is decided, rather than discovered in a browser.
    """
    nodes = doc['nodes']
    worst = (np.inf, None)
    for gi in group_indices:
        g = secondary['colliderGroups'][gi]
        _, bone = _bone_world(doc, nodes[g['node']]['name'])
        for c in g['colliders']:
            centre = bone + np.array([c['offset']['x'], c['offset']['y'], -c['offset']['z']])
            for pt in points:
                gap = float(np.linalg.norm(np.asarray(pt) - centre)) - (c['radius'] + hit_radius)
                if gap < worst[0]:
                    worst = (gap, nodes[g['node']]['name'])
    if worst[0] < 0:
        raise SystemExit(f'雙馬尾關節靜止時就埋在 {worst[1]} 的 collider 裡 '
                         f'{-worst[0] * 1000:.1f}mm，彈簧第一幀就會跳')
    return worst


def coat_intrusion(doc, views, manifest, coat_pos,
                   parts=('Hair_Twintail_L', 'Hair_Twintail_R')):
    """How far the tails' vertices sit inside the coat's outer contour, at rest.

    The same cross-section test springsim.ts runs on the moving model: a hair
    vertex is inside by however much its radius about the body's axis falls
    short of the coat's outermost radius in its height band and azimuth
    sector. Returns (deepest mm, share of vertices 5mm or more inside).
    """
    contour = CoatContour(coat_pos)
    depths = []
    for part in parts:
        for pr in _prims(doc, manifest, part):
            p = glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
            for x, y, z in p:
                c = contour.at(y, float(np.arctan2(z, abs(x))))
                depths.append((c - float(np.hypot(x, z))) if np.isfinite(c) else -np.inf)
    depths = np.array(depths)
    return float(depths.max() * 1000.0), float((depths >= 0.005).mean())


def prune_stranded_collider_groups(doc):
    """Drop collider groups no spring references, remapping the survivors.

    The two edits above orphan most of the source model's collider set: the
    tails stop referencing the head and arm groups, and the removed HairJoint
    springs take their references with them. Bone groups address collider
    groups BY INDEX, so the survivors' references must be rewritten in the
    same pass that compacts the list -- dropping without remapping would point
    the skirt at whatever slid into positions 10 and 11.
    """
    secondary = doc['extensions']['VRM']['secondaryAnimation']
    groups = secondary.get('colliderGroups', [])
    used = sorted({index
                   for group in secondary.get('boneGroups', [])
                   for index in group.get('colliderGroups', [])})
    if len(used) == len(groups):
        return []
    remap = {old_index: new_index for new_index, old_index in enumerate(used)}
    removed = [(index, doc['nodes'][groups[index].get('node')].get('name', ''))
               for index in range(len(groups)) if index not in remap]
    secondary['colliderGroups'] = [groups[index] for index in used]
    for group in secondary.get('boneGroups', []):
        group['colliderGroups'] = [remap[index]
                                   for index in group.get('colliderGroups', [])]
    return removed
