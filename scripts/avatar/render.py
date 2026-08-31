"""Rasterise a VRM to a PNG without a GPU, a browser, or a scene graph library.

This machine's Playwright runs software WebGL, where rendered frames are
unreliable (see ~/vtuber-kit/bin/vrmrig.py's header). Numbers read out of a file
are reliable, and so is a rasteriser we write ourselves: same camera, same
pixels, every run. That determinism is the whole point — these images get
compared against each other across steps, so a renderer that dithers or
anti-aliases differently between runs would fake a change.

Rest pose only. glTF says a skinned mesh ignores its node transform and lives in
the skin's space, and at bind pose every joint matrix is identity, so POSITION
is already the world position. Posed rendering needs the joint matrices and is
not here yet.
"""
import sys

import numpy as np
from PIL import Image

import glb

# Camera presets: (azimuth degrees around Y, elevation, framing)
#
# Azimuth 0 puts the camera on +Z. This model's toes sit at z = -0.083 against
# an ankle at z = +0.026, so it faces -Z and azimuth 0 photographs its back.
# Measured, not taken from the VRM spec, which says the opposite.
VIEWS = {
    'front': (180.0, 0.0, 'full'),
    'back': (0.0, 0.0, 'full'),
    'three_quarter': (215.0, 0.0, 'full'),
    'face': (180.0, 0.0, 'head'),
}


def world_matrices(doc):
    """node index -> 4x4 world matrix, walking the scene tree."""
    nodes = doc['nodes']
    scene = doc['scenes'][doc.get('scene', 0)]
    out = {}
    stack = [(i, np.eye(4)) for i in scene.get('nodes', [])]
    while stack:
        idx, parent = stack.pop()
        n = nodes[idx]
        if 'matrix' in n:
            local = np.array(n['matrix'], dtype=np.float64).reshape(4, 4).T
        else:
            t = np.array(n.get('translation', [0, 0, 0]), dtype=np.float64)
            r = np.array(n.get('rotation', [0, 0, 0, 1]), dtype=np.float64)
            s = np.array(n.get('scale', [1, 1, 1]), dtype=np.float64)
            x, y, z, w = r
            rot = np.array([
                [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
            ])
            local = np.eye(4)
            local[:3, :3] = rot * s
            local[:3, 3] = t
        m = parent @ local
        out[idx] = m
        for c in n.get('children', ()):
            stack.append((c, m))
    return out


def gather(doc, views, posed=None):
    """Every drawable triangle as (positions, uvs, tri_indices, material_ids).

    `posed` maps (mesh name, primitive index) -> skinned positions, as produced
    by pose.skinned(). Passing it renders the clip's pose instead of rest.
    """
    world = world_matrices(doc)
    node_of_mesh = {}
    for i, n in enumerate(doc['nodes']):
        if 'mesh' in n:
            node_of_mesh.setdefault(n['mesh'], i)

    pos_parts, uv_parts, tri_parts, mat_parts = [], [], [], []
    base = 0
    for mi, mesh in enumerate(doc['meshes']):
        for pi, pr in enumerate(mesh['primitives']):
            if posed is not None and (mesh.get('name'), pi) in posed:
                p = posed[(mesh.get('name'), pi)]
            else:
                p = glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
            if posed is None and 'skin' not in doc['nodes'][node_of_mesh.get(mi, 0)]:
                m = world.get(node_of_mesh.get(mi, 0), np.eye(4))
                p = (m[:3, :3] @ p.T).T + m[:3, 3]
            if 'TEXCOORD_0' in pr['attributes']:
                uv = glb.read_accessor(doc, views, pr['attributes']['TEXCOORD_0']).astype(np.float64)
            else:
                uv = np.zeros((len(p), 2))
            idx = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
            pos_parts.append(p)
            uv_parts.append(uv)
            tri_parts.append(idx + base)
            mat_parts.append(np.full(len(idx), pr.get('material', -1), dtype=np.int64))
            base += len(p)
    return (np.concatenate(pos_parts), np.concatenate(uv_parts),
            np.concatenate(tri_parts), np.concatenate(mat_parts))


def textures(doc, views):
    """material index -> (RGBA array, has_alpha) or None."""
    cache, out = {}, {}
    for mi, mat in enumerate(doc.get('materials', [])):
        pbr = mat.get('pbrMetallicRoughness', {})
        tex = pbr.get('baseColorTexture', {}).get('index')
        if tex is None:
            f = pbr.get('baseColorFactor', [0.8, 0.8, 0.8, 1.0])
            out[mi] = (np.array([[[c * 255 for c in f]]], dtype=np.float64), False)
            continue
        src = doc['textures'][tex].get('source')
        if src is None:
            out[mi] = None
            continue
        if src not in cache:
            bv = doc['images'][src]['bufferView']
            import io
            im = Image.open(io.BytesIO(bytes(views[bv]))).convert('RGBA')
            cache[src] = np.asarray(im, dtype=np.float64)
        img = cache[src]
        # glTF 的 base colour 是 factor 乘上貼圖，不是二選一。忽略 factor 這件
        # 事在純色材質上看不出來（那條路徑本來就只有 factor），但只要有材質把
        # 灰階貼圖當花紋、顏色放在 factor 裡——匯入的服裝與新的內耳都是這樣做
        # ——算圖就會畫出沒上色的版本，而 three-vrm 畫的是上了色的。用這種算圖
        # 判斷顏色等於在看另一個模型。
        f = pbr.get('baseColorFactor')
        if f and any(abs(c - 1.0) > 1e-6 for c in f):
            img = img * np.array(f, dtype=np.float64)
        out[mi] = (img, True)
    return out


def project(pos, azimuth, elevation, framing, size, head_y=None):
    """Orthographic projection. Orthographic keeps ratios measurable, which is
    the reason these renders exist; a perspective camera would bake in the very
    distortion we are trying to correct for in the reference photos.

    `head_y` is the head bone's height. Framing the face off the mesh bounding
    box instead would follow the hair: an ahoge or a tall bun moves the crop and
    the same camera stops meaning the same thing between two versions.
    """
    a, e = np.radians(azimuth), np.radians(elevation)
    ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
    rx = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]])
    p = pos @ ry.T @ rx.T

    lo, hi = pos.min(axis=0), pos.max(axis=0)
    if framing == 'head':
        # Sit the crop on the head bone, then raise it enough to hold what is
        # ON the head. Framed at +0.045 with a 0.14 half-height it cut the bear
        # buns and the crown off the top and spent the bottom third on the
        # collar, which is the wrong picture to be comparing against a reference
        # sheet of faces.
        centre_y = (head_y if head_y is not None else hi[1] - 0.13) + 0.115
        half = 0.175
        centre_x = 0.0
    else:
        centre_y = (lo[1] + hi[1]) / 2
        half = (hi[1] - lo[1]) / 2 * 1.06
        centre_x = (p[:, 0].min() + p[:, 0].max()) / 2

    W, H = size
    scale = H / (2 * half)
    sx = (p[:, 0] - centre_x) * scale + W / 2
    sy = H / 2 - (p[:, 1] - centre_y) * scale
    return np.stack([sx, sy, p[:, 2]], axis=1)


def rasterise(screen, uv, tris, mats, texmap, size):
    """Returns (colour, alpha, depth). Depth is the camera-space z of whatever
    won each pixel, larger being nearer, and -1e9 where nothing was drawn."""
    W, H = size
    colour = np.zeros((H, W, 3), dtype=np.float64)
    alpha = np.zeros((H, W), dtype=np.float64)
    depth = np.full((H, W), -1e9)

    v0, v1, v2 = screen[tris[:, 0]], screen[tris[:, 1]], screen[tris[:, 2]]
    area = ((v1[:, 0] - v0[:, 0]) * (v2[:, 1] - v0[:, 1])
            - (v2[:, 0] - v0[:, 0]) * (v1[:, 1] - v0[:, 1]))
    keep = np.abs(area) > 1e-9
    order = np.argsort(-np.maximum.reduce([v0[:, 2], v1[:, 2], v2[:, 2]]))

    for t in order:
        if not keep[t]:
            continue
        a, b, c = v0[t], v1[t], v2[t]
        x0 = max(int(np.floor(min(a[0], b[0], c[0]))), 0)
        x1 = min(int(np.ceil(max(a[0], b[0], c[0]))) + 1, W)
        y0 = max(int(np.floor(min(a[1], b[1], c[1]))), 0)
        y1 = min(int(np.ceil(max(a[1], b[1], c[1]))) + 1, H)
        if x1 <= x0 or y1 <= y0:
            continue
        xs = np.arange(x0, x1) + 0.5
        ys = np.arange(y0, y1) + 0.5
        gx, gy = np.meshgrid(xs, ys)
        d = area[t]
        w0 = ((b[0] - a[0]) * (gy - a[1]) - (gx - a[0]) * (b[1] - a[1])) / d
        w1 = ((gx - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (gy - a[1])) / d
        w2 = 1.0 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            continue
        z = w2 * a[2] + w1 * b[2] + w0 * c[2]
        sub = depth[y0:y1, x0:x1]
        win = inside & (z > sub)
        if not win.any():
            continue

        tex = texmap.get(int(mats[t]))
        if tex is None:
            rgba = np.array([200.0, 200.0, 200.0, 255.0])
            px = np.broadcast_to(rgba, win.shape + (4,))
        else:
            img, sampled = tex
            if not sampled:
                px = np.broadcast_to(img[0, 0], win.shape + (4,))
            else:
                ta, tb, tc = uv[tris[t, 0]], uv[tris[t, 1]], uv[tris[t, 2]]
                u = w2 * ta[0] + w1 * tb[0] + w0 * tc[0]
                v = w2 * ta[1] + w1 * tb[1] + w0 * tc[1]
                ih, iw = img.shape[:2]
                ui = np.clip((u * iw).astype(int), 0, iw - 1)
                vi = np.clip((v * ih).astype(int), 0, ih - 1)
                px = img[vi, ui]

        op = px[..., 3] / 255.0
        take = win & (op > 0.5)
        if not take.any():
            continue
        colour[y0:y1, x0:x1][take] = px[..., :3][take]
        alpha[y0:y1, x0:x1][take] = 1.0
        depth[y0:y1, x0:x1][take] = z[take]

    return colour, alpha, depth


def render(path, out_prefix, size=(700, 1200), only=None, posed=None):
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    pos, uv, tris, mats = gather(doc, views, posed)
    texmap = textures(doc, views)
    world = world_matrices(doc)
    head = {b['bone']: b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']}
    head_y = float(world[head['head']][1, 3]) if 'head' in head else None
    made = []
    for name, (az, el, framing) in VIEWS.items():
        if only and name not in only:
            continue
        dims = (size[0], size[1]) if framing == 'full' else (size[0], size[0])
        screen = project(pos, az, el, framing, dims, head_y)
        colour, alpha, _ = rasterise(screen, uv, tris, mats, texmap, dims)
        rgb = colour * alpha[..., None] + 255.0 * (1 - alpha[..., None])
        Image.fromarray(rgb.astype(np.uint8)).save(f'{out_prefix}-{name}.png')
        Image.fromarray((alpha * 255).astype(np.uint8)).save(f'{out_prefix}-{name}-mask.png')
        made.append(f'{out_prefix}-{name}.png')
    return made


if __name__ == '__main__':
    src = sys.argv[1]
    prefix = sys.argv[2]
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    for f in render(src, prefix, only=only):
        print('  wrote', f)
