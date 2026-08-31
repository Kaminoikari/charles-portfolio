"""Grow new clothing off the body surface instead of modelling it in the air.

A garment authored as free-floating geometry has to be fitted to the body and
then skinned, and both of those are where hand modelling spends its hours. A
garment grown FROM the body skips both: take the vertices of the region it
covers, push them out along their normals, and keep the triangles whose corners
all survived the selection. The result already follows the body, and it already
carries the body's joint indices and weights, so it bends when she bends.

What this cannot do is make a silhouette the body does not have. A flared skirt
stands away from the legs, so it is built as a surface of revolution in
`skirt()` rather than as an offset shell.
"""
import numpy as np

import glb

MODE_TRIANGLES = 4


def body_pool(doc, views, manifest, part='Body_Skin', only=None):
    """Every vertex of a part, merged, with the attributes a garment inherits.

    `only` narrows it to particular primitives of that part. The face needs it:
    VRoid bakes all ten of its primitives onto one shared vertex buffer, so
    reading them all back gives the same 20,540 vertices ten times over, and the
    eyeballs and eyelashes arrive along with the skin.
    """
    info = manifest['parts'][part]
    mesh = next(m for m in doc['meshes'] if m.get('name') == info['mesh'])
    pos, nrm, uv, joints, weights, tris = [], [], [], [], [], []
    base = 0
    for i in (info['primitives'] if only is None else only):
        pr = mesh['primitives'][i]
        a = pr['attributes']
        p = glb.read_accessor(doc, views, a['POSITION']).astype(np.float64)
        n = (glb.read_accessor(doc, views, a['NORMAL']).astype(np.float64)
             if 'NORMAL' in a else np.zeros_like(p))
        t = (glb.read_accessor(doc, views, a['TEXCOORD_0']).astype(np.float64)
             if 'TEXCOORD_0' in a else np.zeros((len(p), 2)))
        j = glb.read_accessor(doc, views, a['JOINTS_0'])
        w = glb.read_accessor(doc, views, a['WEIGHTS_0'])
        idx = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
        pos.append(p); nrm.append(n); uv.append(t); joints.append(j); weights.append(w)
        tris.append(idx + base)
        base += len(p)
    return {
        'pos': np.concatenate(pos), 'nrm': np.concatenate(nrm),
        'uv': np.concatenate(uv), 'joints': np.concatenate(joints),
        'weights': np.concatenate(weights), 'tris': np.concatenate(tris),
    }


def shell(pool, mask, offset, smooth=2):
    """An offset copy of the selected region, as its own vertex set."""
    tris = pool['tris']
    keep = mask[tris].all(axis=1)
    tris = tris[keep]
    if not len(tris):
        raise ValueError('選取範圍內沒有完整的三角形')
    used, remap = np.unique(tris, return_inverse=True)

    n = pool['nrm'][used].copy()

    length = np.linalg.norm(n, axis=1, keepdims=True)
    n = np.divide(n, np.where(length == 0, 1, length))

    # Averaging the offset across neighbours stops the shell from stippling
    # where the body's own normals disagree, which is most of the armpit.
    p = pool['pos'][used].copy()
    if smooth:
        edges = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]])
        pos_of = {v: i for i, v in enumerate(used)}
        adj = [[] for _ in used]
        for a, b in edges:
            adj[pos_of[a]].append(pos_of[b])
            adj[pos_of[b]].append(pos_of[a])
        for _ in range(smooth):
            avg = np.array([n[list(set(nb))].mean(axis=0) if nb else n[i]
                            for i, nb in enumerate(adj)])
            length = np.linalg.norm(avg, axis=1, keepdims=True)
            n = np.divide(avg, np.where(length == 0, 1, length))

    # Weld across the seams, and do it LAST. VRoid splits the body into UV
    # islands and duplicates every vertex along a seam, each copy carrying only
    # its own island's normal; offsetting copies along directions that disagree
    # tears the shell open, which is how bare skin showed at the sole and up
    # both heels. Welding before the smoothing pass does not hold, because that
    # pass averages over the split adjacency and separates them again.
    key = np.round(pool['pos'][used], 5)
    _, seam = np.unique(key, axis=0, return_inverse=True)
    shared = np.zeros((int(seam.max()) + 1, 3))
    np.add.at(shared, seam, n)
    n = shared[seam]
    length = np.linalg.norm(n, axis=1, keepdims=True)
    n = np.divide(n, np.where(length == 0, 1, length))

    return {
        'pos': p + n * offset,
        'nrm': n,
        'uv': pool['uv'][used],
        'joints': pool['joints'][used],
        'weights': pool['weights'][used],
        'tris': remap.reshape(-1, 3),
    }


def axis_profile(pool, y, segments, half=0.02, cx=0.0, cz=0.0, max_radius=None):
    """Per-bearing distance from the body axis out to the skin, at height `y`.

    A single scalar radius is what put the skirt inside the hips: a body is
    wider across than front-to-back, so one circle fitted to the average cuts
    into the sides. Sampling per bearing lets a ring follow the shape it has to
    clear.

    `max_radius` throws away everything past a distance, which is how the neck is
    read: at collar height a T-posed body also has two arms, and without it the
    profile is the distance to a wrist.
    """
    # The band widens until it finds skin. A VRoid thigh carries its rings about
    # 40mm apart, so a fixed 20mm window is empty at some heights and the ring
    # would have nothing to clear.
    for grow in (1.0, 1.5, 2.5, 4.0):
        m = np.abs(pool['pos'][:, 1] - y) < half * grow
        q = pool['pos'][m]
        dx, dz = q[:, 0] - cx, q[:, 2] - cz
        r = np.hypot(dx, dz)
        if max_radius is not None:
            keep = r < max_radius
            r, dx, dz = r[keep], dx[keep], dz[keep]
        if len(r):
            break
    else:
        raise ValueError(f'y={y} 附近沒有可用的身體頂點')

    bin_of = ((np.arctan2(dz, dx) % (2 * np.pi)) / (2 * np.pi) * segments).astype(int) % segments
    out = np.full(segments, np.nan)
    for s in range(segments):
        sel = r[bin_of == s]
        if len(sel):
            out[s] = sel.max()

    # An empty bearing must not pinch the ring inward, so it borrows from its
    # neighbours; then a short circular blur takes the facets off.
    if np.isnan(out).all():
        raise ValueError(f'y={y} 的環在每個方位都取不到樣本')
    idx = np.arange(segments)
    good = ~np.isnan(out)
    out = np.interp(idx, idx[good], out[good], period=segments)
    k = np.array([0.25, 0.5, 0.25])
    return np.convolve(np.r_[out[-1:], out, out[:1]], k, mode='valid')


def skirt(pool, waist_y, hem_y, flare, segments=48, rings=6, joint_from=None,
          clear=0.006, envelope=None):
    """A skirt hung off the waist, flaring to the hem and clearing the body.

    Not quite a surface of revolution any more. Every ring is pushed out to at
    least the skin beneath it plus `clear`, because the circular version sat up
    to 5mm inside the hips at the sides, where the body is widest. It was hidden
    under the cardigan at rest and would have surfaced the moment the cardigan
    swung.

    `envelope` widens that further to clear where the legs GO, not just where
    they stand: a rigid skirt has no way to get out of a lifting knee's way, and
    the thigh came through between the hip and mid-thigh on half the clips. See
    envelope.py for the measurement.
    """
    band = np.abs(pool['pos'][:, 1] - waist_y) < 0.02
    if not band.any():
        raise ValueError(f'腰線 y={waist_y} 附近沒有頂點')
    ring = pool['pos'][band]
    cx, cz = ring[:, 0].mean(), ring[:, 2].mean()
    radius = np.percentile(np.hypot(ring[:, 0] - cx, ring[:, 2] - cz), 85)

    if joint_from is None:
        joint_from = int(np.argmin(np.abs(pool['pos'][:, 1] - waist_y)))
    j = pool['joints'][joint_from]
    w = pool['weights'][joint_from]

    # Looser at the waist than at the hem. The waistband is the one part of a
    # skirt a bending torso can reach, and the belly came through the front of it
    # at 6mm; the hem has the whole flare for clearance and needs no help.
    waist_clear, hem_clear = (clear if isinstance(clear, tuple) else (clear, clear))

    pos, uv = [], []
    hem_radii = None
    for r in range(rings + 1):
        t = r / rings
        y = waist_y + (hem_y - waist_y) * t
        clear = waist_clear + (hem_clear - waist_clear) * t
        rad = radius * (1.0 + flare * t * t)
        skin = axis_profile(pool, y, segments, cx=cx, cz=cz, max_radius=0.30)
        swept = None if envelope is None else envelope(y)
        row = []
        for s in range(segments):
            a = 2 * np.pi * s / segments
            rr = max(rad, skin[s] + clear)
            if swept is not None:
                rr = max(rr, float(swept[s * len(swept) // segments]) + clear)
            row.append(rr)
            pos.append([cx + rr * np.cos(a), y, cz + rr * np.sin(a)])
            uv.append([s / segments, t])
        hem_radii = row
    pos = np.array(pos)
    tris = []
    for r in range(rings):
        for s in range(segments):
            s2 = (s + 1) % segments
            a = r * segments + s
            b = r * segments + s2
            c = (r + 1) * segments + s
            d = (r + 1) * segments + s2
            tris += [[a, b, c], [b, d, c]]
    tris = np.array(tris)

    centre = np.array([cx, (waist_y + hem_y) / 2, cz])
    nrm = pos - centre
    nrm[:, 1] = 0
    length = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length == 0, 1, length))

    return {
        'pos': pos, 'nrm': nrm, 'uv': np.array(uv),
        'joints': np.tile(j, (len(pos), 1)),
        'weights': np.tile(w, (len(pos), 1)),
        'tris': tris,
        # What the last row actually settled on, so frill() can hang off the
        # same cloth. A ruffle that recomputes its own radius drifts off the hem
        # the moment the skirt's clearance changes.
        'hem': {'cx': cx, 'cz': cz, 'y': hem_y,
                'radii': np.array(hem_radii), 'joint': j, 'weight': w},
    }


def bind(pool, piece):
    """Give every vertex the skin weights of the body vertex nearest to it.

    A ring bound to one sample point moves exactly as that point moves. The
    collar was bound to a single vertex on the front of the throat, so when the
    head turned the whole band followed the front and the back of it swung into
    the neck: the worst reading in the motion gate, on every clip that moves the
    head. Per-vertex weights let each part of a ring follow the skin it sits on.

    Not for everything. A skirt bound this way would have its hem follow whichever
    leg happened to be nearest and tear in two when the legs part; a skirt is
    supposed to hang off the hips as one piece, so it keeps a single binding.
    """
    d = ((piece['pos'][:, None, :] - pool['pos'][None, :, :]) ** 2).sum(axis=2)
    k = d.argmin(axis=1)
    piece['joints'] = pool['joints'][k]
    piece['weights'] = pool['weights'][k]
    return piece


def ring_at(pool, y, segments=48, clear=0.008, max_radius=0.30, cx=0.0, cz=0.0):
    """A ring that clears the body at height `y`, in the form frill() wants."""
    radii = axis_profile(pool, y, segments, cx=cx, cz=cz, max_radius=max_radius) + clear
    near = int(np.argmin(np.abs(pool['pos'][:, 1] - y)))
    return {'cx': cx, 'cz': cz, 'y': y, 'radii': radii,
            'joint': pool['joints'][near], 'weight': pool['weights'][near]}


def frill(ring, depth, waves=13, amplitude=0.010, flare=0.14, rings=3):
    """A ruffled band hanging off a ring, for a hem or a neckline.

    Both edges move. The radius swells outward as it falls, and the lower edge
    rides up and down with the same wave, so the silhouette reads as gathered
    cloth. A band that only flares gives a smooth cone, which is what the skirt
    already is.
    """
    cx, cz, y0 = ring['cx'], ring['cz'], ring['y']
    radii = np.asarray(ring['radii'], dtype=float)
    segments = len(radii)

    pos, uv = [], []
    for r in range(rings + 1):
        t = r / rings
        for s in range(segments):
            a = 2 * np.pi * s / segments
            wave = np.sin(waves * a)
            rr = radii[s] * (1.0 + flare * t) + amplitude * t * wave
            yy = y0 - depth * t * (0.78 + 0.22 * wave)
            pos.append([cx + rr * np.cos(a), yy, cz + rr * np.sin(a)])
            uv.append([s / segments, t])
    pos = np.array(pos)

    tris = []
    for r in range(rings):
        for s in range(segments):
            s2 = (s + 1) % segments
            a = r * segments + s
            b = r * segments + s2
            c = (r + 1) * segments + s
            d = (r + 1) * segments + s2
            tris += [[a, b, c], [b, d, c]]

    nrm = pos - np.array([cx, y0 - depth / 2, cz])
    nrm[:, 1] *= 0.25
    length = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length == 0, 1, length))
    return {'pos': pos, 'nrm': nrm, 'uv': np.array(uv),
            'joints': np.tile(ring['joint'], (len(pos), 1)),
            'weights': np.tile(ring['weight'], (len(pos), 1)),
            'tris': np.array(tris)}


def tube(centre_a, centre_b, radius_a, radius_b, joint, weight,
         segments=20, rings=3, axis='y'):
    """A capped cylinder between two points, for bandages and ribbons."""
    a = np.asarray(centre_a, dtype=np.float64)
    b = np.asarray(centre_b, dtype=np.float64)
    d = b - a
    length = np.linalg.norm(d)
    d = d / length
    up = np.array([0.0, 0.0, 1.0]) if abs(d[1]) > 0.9 else np.array([0.0, 1.0, 0.0])
    u = np.cross(d, up); u /= np.linalg.norm(u)
    v = np.cross(d, u)

    pos, uv = [], []
    for r in range(rings + 1):
        t = r / rings
        c = a + d * (length * t)
        rad = radius_a + (radius_b - radius_a) * t
        for s in range(segments):
            ang = 2 * np.pi * s / segments
            pos.append(c + u * (rad * np.cos(ang)) + v * (rad * np.sin(ang)))
            uv.append([s / segments, t])
    pos = np.array(pos)
    tris = []
    for r in range(rings):
        for s in range(segments):
            s2 = (s + 1) % segments
            i0 = r * segments + s; i1 = r * segments + s2
            i2 = (r + 1) * segments + s; i3 = (r + 1) * segments + s2
            tris += [[i0, i2, i1], [i1, i2, i3]]
    tris = np.array(tris)
    axis_pts = a + np.outer(np.linspace(0, length, rings + 1), d)
    nrm = pos - np.repeat(axis_pts, segments, axis=0)
    length_n = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length_n == 0, 1, length_n))
    return {
        'pos': pos, 'nrm': nrm, 'uv': np.array(uv),
        'joints': np.tile(joint, (len(pos), 1)),
        'weights': np.tile(weight, (len(pos), 1)),
        'tris': tris,
    }


def sphere(centre, radius, joint, weight, lat=12, lon=16, squash=(1.0, 1.0, 1.0)):
    """A UV sphere, for bear-ear buns and pompoms.

    The winding is counter-clockwise seen from outside, which glTF takes as the
    front face. It was the other way round for a long time and nothing here
    could see it: this project's rasteriser culls nothing and shades from the
    NORMAL attribute, which was outward and correct. three-vrm draws MToon's
    outline pass by culling FRONT faces and, with every triangle back-facing,
    that pass covered the whole sphere -- the bear-ear buns and the bear hair
    clip rendered as solid black blobs in a browser while every render here
    showed them white.
    """
    pos, uv = [], []
    for i in range(lat + 1):
        theta = np.pi * i / lat
        for j in range(lon):
            phi = 2 * np.pi * j / lon
            pos.append([
                centre[0] + radius * squash[0] * np.sin(theta) * np.cos(phi),
                centre[1] + radius * squash[1] * np.cos(theta),
                centre[2] + radius * squash[2] * np.sin(theta) * np.sin(phi),
            ])
            uv.append([j / lon, i / lat])
    pos = np.array(pos)
    tris = []
    for i in range(lat):
        for j in range(lon):
            j2 = (j + 1) % lon
            a = i * lon + j; b = i * lon + j2
            c = (i + 1) * lon + j; d = (i + 1) * lon + j2
            tris += [[a, b, c], [b, d, c]]
    tris = np.array(tris)
    nrm = pos - np.asarray(centre)
    length = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length == 0, 1, length))
    return {
        'pos': pos, 'nrm': nrm, 'uv': np.array(uv),
        'joints': np.tile(joint, (len(pos), 1)),
        'weights': np.tile(weight, (len(pos), 1)),
        'tris': tris,
    }


def bow(centre, width, height, tail_len, joint, weight, tail_dir=(0, -1, 0)):
    """Two squashed lobes, a knot, and two tails. Reads as a ribbon at a glance,
    which is all a bow needs to do at this scale."""
    cx, cy, cz = centre
    pieces = [sphere([cx, cy, cz], height * 0.42, joint, weight, lat=6, lon=10)]
    for side in (-1, 1):
        pieces.append(sphere(
            [cx + side * width * 0.5, cy, cz], height,
            joint, weight, lat=8, lon=12,
            squash=(width / height * 0.55, 1.0, 0.42)))
    d = np.asarray(tail_dir, dtype=np.float64)
    d = d / np.linalg.norm(d)
    for side in (-1, 1):
        start = np.array([cx + side * width * 0.13, cy - height * 0.2, cz])
        pieces.append(tube(start, start + d * tail_len + np.array([side * width * 0.22, 0, 0]),
                           height * 0.30, height * 0.34, joint, weight,
                           segments=8, rings=2))
    return merge(pieces)


def collar(pool, y, thickness, flare, segments=40, rings=3, neck_radius=0.12,
           clear=0.004):
    """A small frill standing out around the neck.

    `neck_radius` is not decoration. At the neck's height a T-posed body also has
    two arms, and a radius taken from that whole band is the distance to a wrist:
    the frill comes out as a bar spanning the image. Everything past that
    distance is therefore dropped.

    The band it does keep is read per bearing and the ring is pushed clear of it.
    Taking one median instead gave a base ring of 39mm around a 50mm neck, so the
    choker's own bottom rim was inside the throat.
    """
    band = np.abs(pool['pos'][:, 1] - y) < 0.020
    ring = pool['pos'][band]
    ring = ring[np.hypot(ring[:, 0], ring[:, 2]) < neck_radius]
    if not len(ring):
        raise ValueError(f'頸線 y={y} 附近（r<{neck_radius}）沒有頂點')
    cx, cz = ring[:, 0].mean(), ring[:, 2].mean()
    radius = float(np.median(np.hypot(ring[:, 0] - cx, ring[:, 2] - cz)))
    near = int(np.argmin(np.abs(pool['pos'][:, 1] - y)))
    j, w = pool['joints'][near], pool['weights'][near]

    pos, uv = [], []
    for r in range(rings + 1):
        t = r / rings
        yy = y + thickness * t
        rad = radius * (1.0 + flare * t)
        skin = axis_profile(pool, yy, segments, half=0.008, cx=cx, cz=cz,
                            max_radius=neck_radius)
        # A gentle scallop so the edge is not a perfect circle.
        for s in range(segments):
            a = 2 * np.pi * s / segments
            wobble = 1.0 + 0.05 * t * np.sin(a * 8)
            rr = max(rad, skin[s] + clear) * wobble
            pos.append([cx + rr * np.cos(a), yy, cz + rr * np.sin(a)])
            uv.append([s / segments, t])
    pos = np.array(pos)
    tris = []
    for r in range(rings):
        for s in range(segments):
            s2 = (s + 1) % segments
            a = r * segments + s; b = r * segments + s2
            c = (r + 1) * segments + s; d = (r + 1) * segments + s2
            tris += [[a, b, c], [b, d, c]]
    nrm = pos - np.array([cx, y + thickness / 2, cz])
    nrm[:, 1] *= 0.2
    length = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length == 0, 1, length))
    return {'pos': pos, 'nrm': nrm, 'uv': np.array(uv),
            'joints': np.tile(j, (len(pos), 1)),
            'weights': np.tile(w, (len(pos), 1)), 'tris': np.array(tris)}


def box(centre, half, joint, weight, rot_z=0.0):
    """An axis-aligned block, optionally rolled about Z. Hair clips and plasters."""
    cx, cy, cz = centre
    hx, hy, hz = half
    corners = np.array([[sx, sy, sz] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)],
                       dtype=np.float64) * np.array([hx, hy, hz])
    if rot_z:
        c, s = np.cos(rot_z), np.sin(rot_z)
        r = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
        corners = corners @ r.T
    pos = corners + np.array([cx, cy, cz])
    # 0:-- - 1:--+ 2:-+- 3:-++ 4:+-- 5:+-+ 6:++- 7:+++
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
             (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    tris = []
    for a, b, c_, d in quads:
        tris += [[a, b, c_], [a, c_, d]]
    tris = np.array(tris)
    nrm = pos - np.array([cx, cy, cz])
    length = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length == 0, 1, length))
    uv = np.zeros((len(pos), 2))
    return {'pos': pos, 'nrm': nrm, 'uv': uv,
            'joints': np.tile(joint, (len(pos), 1)),
            'weights': np.tile(weight, (len(pos), 1)), 'tris': tris}


def crown(centre, radius, height, points, joint, weight, tilt=0.0):
    """A ring of spikes. Small, and read entirely by its silhouette."""
    cx, cy, cz = centre
    pieces = []
    band_lo, band_hi = cy, cy + height * 0.34
    pos, tris = [], []
    seg = points * 4
    for r, yy in ((0, band_lo), (1, band_hi)):
        for s in range(seg):
            a = 2 * np.pi * s / seg + tilt
            pos.append([cx + radius * np.cos(a), yy, cz + radius * np.sin(a)])
    for s in range(seg):
        s2 = (s + 1) % seg
        tris += [[s, seg + s, s2], [s2, seg + s, seg + s2]]
    for k in range(points):
        a = 2 * np.pi * k / points + tilt
        tip = len(pos)
        pos.append([cx + radius * 0.86 * np.cos(a), cy + height, cz + radius * 0.86 * np.sin(a)])
        left = seg + int(round(k * seg / points)) % seg
        right = seg + (int(round(k * seg / points)) + 1) % seg
        tris.append([left, tip, right])
    pos = np.array(pos, dtype=np.float64)
    tris = np.array(tris)
    nrm = pos - np.array([cx, cy + height * 0.4, cz])
    length = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = np.divide(nrm, np.where(length == 0, 1, length))
    return {'pos': pos, 'nrm': nrm, 'uv': np.zeros((len(pos), 2)),
            'joints': np.tile(joint, (len(pos), 1)),
            'weights': np.tile(weight, (len(pos), 1)), 'tris': tris}


def merge(pieces):
    """Concatenate several piece dicts into one."""
    out = {k: [] for k in ('pos', 'nrm', 'uv', 'joints', 'weights', 'tris')}
    base = 0
    for p in pieces:
        for k in ('pos', 'nrm', 'uv', 'joints', 'weights'):
            out[k].append(p[k])
        out['tris'].append(p['tris'] + base)
        base += len(p['pos'])
    return {k: np.concatenate(v) for k, v in out.items()}


def attach(doc, views, mesh_name, piece, material, part_name):
    """Write a piece into a mesh as a new named primitive."""
    mesh = next(m for m in doc['meshes'] if m.get('name') == mesh_name)
    a = {
        'POSITION': glb.add_accessor(doc, views, piece['pos'].astype('<f4'),
                                     target=34962, minmax=True),
        'NORMAL': glb.add_accessor(doc, views, piece['nrm'].astype('<f4'), target=34962),
        'TEXCOORD_0': glb.add_accessor(doc, views, piece['uv'].astype('<f4'), target=34962),
        'JOINTS_0': glb.add_accessor(doc, views, piece['joints'].astype('<u2'), target=34962),
        'WEIGHTS_0': glb.add_accessor(doc, views, piece['weights'].astype('<f4'), target=34962),
    }
    n = len(piece['pos'])
    # Flatten. glTF requires an index accessor to be SCALAR; handing it the
    # (N, 3) array declares VEC3 with a count three times too small. The bytes
    # are identical either way, which is what makes it easy to miss — a lenient
    # loader draws the mesh correctly and a strict one rejects the file.
    tri = piece['tris'].astype(np.uint32 if n > 65535 else np.uint16).ravel()
    prim = {
        'mode': MODE_TRIANGLES,
        'attributes': a,
        'indices': glb.add_accessor(doc, views, tri, target=34963),
        'material': material,
        'extras': {'part': part_name},
    }
    mesh['primitives'].append(prim)
    return len(mesh['primitives']) - 1
