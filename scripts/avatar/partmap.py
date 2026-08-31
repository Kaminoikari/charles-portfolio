"""Render every part in its own flat colour, so a defect can be named.

Guessing which mesh is showing through a hole wastes rounds. This paints each
part a distinct colour with the same camera the normal render uses, so a
suspicious pixel can be looked up instead of reasoned about.
"""
import colorsys
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import render  # noqa: E402


def build(model, manifest, out_prefix, size=(900, 1550), only=('front',), posed=None):
    doc, binary = glb.load(model)
    views = glb.views_of(doc, binary)
    parts = json.load(open(manifest))['parts']
    made, palette, _ = draw(doc, views, parts, out_prefix, size, only, posed)
    return made, palette


def draw(doc, views, parts, out_prefix=None, size=(900, 1550), only=('front',),
         posed=None, exclude=(), drop=None, facing=False):
    """Render each part in its own flat colour; return the label image too.

    The label image is the point: it says which part owns every pixel, which is
    what turns "does this clip through" from a judgement into a count.

    With `facing`, each label also carries two more per-pixel facts, both drawn
    in the same extra pass so they cost one rasterise between them.

    `outward` is True where the winning triangle's authored normal points at the
    camera and False where we are looking at its back. Callers use it to tell a
    garment the body has burst out of, whose OUTER face ends up behind the skin,
    from a garment we are simply seeing the inside of through an opening it was
    designed to have. It is read off the NORMAL attribute and never off the
    winding, for the reason in the comment beside the rasteriser below.

    `limb` is 0, 1 or 2: which side of the body drives that triangle, from the
    dominant joint's humanoid bone name, with 0 for anything centred or mixed.
    Two surfaces on opposite sides are never evidence about each other. From the
    side view the legs overlap, and the near calf sat 23mm in front of the FAR
    leg's sock -- inside the 30mm window, with that sock's outer face towards
    the camera, so both other conditions passed and a clean frame measured 58
    pixels of clipping at the cuff.
    """
    owner = {}
    for name, info in parts.items():
        for i in info['primitives']:
            owner[(info['mesh'], i)] = name

    pos, uv, tris, _ = render.gather(doc, views, posed)
    names = sorted({n for n in owner.values()})
    palette = {}
    for i, n in enumerate(names):
        # Spread the hues by the golden ratio so neighbours in the list are not
        # neighbours in colour, and alternate value so similar hues still differ.
        h = (i * 0.6180339887) % 1.0
        r, g, b = colorsys.hsv_to_rgb(h, 0.75, 1.0 if i % 2 else 0.65)
        palette[n] = np.array([r * 255, g * 255, b * 255])

    ids, base = [], 0
    for mi, mesh in enumerate(doc['meshes']):
        for pi, pr in enumerate(mesh['primitives']):
            n = len(glb.read_accessor(doc, views, pr['attributes']['POSITION'])) \
                if posed is None or (mesh.get('name'), pi) not in posed \
                else len(posed[(mesh.get('name'), pi)])
            t = len(glb.read_accessor(doc, views, pr['indices'])) // 3
            who = owner.get((mesh.get('name'), pi))
            ids.append(np.full(t, names.index(who) if who in palette else -1))
            base += n
    ids = np.concatenate(ids)

    # Dropping a part's triangles, rather than hiding it afterwards, is what lets
    # the caller ask "what would be on screen if the body were not in the way".
    # `drop` is the same idea at triangle granularity, for callers that need to
    # remove part OF a part. It has to be done here and not by moving vertices:
    # the camera is framed from the full position array, so a caller that pushed
    # unwanted geometry off to one side would silently reframe its own render
    # and the two passes would no longer line up pixel for pixel.
    cut = np.zeros(len(tris), bool)
    if exclude:
        cut |= np.isin(ids, [names.index(n) for n in exclude if n in names])
    if drop is not None:
        cut |= drop
    if cut.any():
        tris, ids = tris[~cut], ids[~cut]

    texmap = {i: (np.array([[list(palette[n]) + [255]]]), False)
              for i, n in enumerate(names)}
    texmap[-1] = (np.array([[[20.0, 20.0, 20.0, 255.0]]]), False)

    if facing:
        normals = np.concatenate([glb.read_accessor(doc, views, pr['attributes']['NORMAL'])
                                  for mesh in doc['meshes']
                                  for pr in mesh['primitives']]).astype(np.float64)
        bone = {b['node']: b['bone'] for b
                in doc['extensions']['VRM']['humanoid']['humanBones']}
        joints = doc['skins'][0]['joints'] if doc.get('skins') else []
        jname = [bone.get(j, doc['nodes'][j].get('name', '')).lower() for j in joints]
        jside = np.array([1 if n.startswith('left') else 2 if n.startswith('right') else 0
                          for n in jname])
        vside = []
        for mesh in doc['meshes']:
            for pr in mesh['primitives']:
                n = len(glb.read_accessor(doc, views, pr['attributes']['POSITION']))
                if 'JOINTS_0' not in pr['attributes'] or not len(jside):
                    vside.append(np.zeros(n, np.int64))
                    continue
                j = glb.read_accessor(doc, views, pr['attributes']['JOINTS_0'])
                w = glb.read_accessor(doc, views, pr['attributes']['WEIGHTS_0']).astype(np.float64)
                vside.append(jside[j[np.arange(len(j)), np.argmax(w, axis=1)]])
        vside = np.concatenate(vside)
        # Six ids: limb * 2 + outward. Spread across the greyscale so that
        # rounding the rasterised value back to an id cannot land on a neighbour.
        extra = {k: (np.array([[[20.0 + 40 * k] * 3 + [255.0]]]), False) for k in range(6)}

    world = render.world_matrices(doc)
    head = {b['bone']: b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']}
    head_y = float(world[head['head']][1, 3])
    made, labels = [], {}
    for name, (az, el, framing) in render.VIEWS.items():
        if only and name not in only:
            continue
        dims = (size[0], size[1]) if framing == 'full' else (size[0], size[0])
        screen = render.project(pos, az, el, framing, dims, head_y)
        # Deliberately no backface culling. The generated garments and the VRoid
        # body do not share a triangle winding, so culling by projected area
        # removes the outer face of some parts and the inner face of others; it
        # tripled the count on a model that renders cleanly.
        colour, alpha, depth = render.rasterise(screen, uv, tris, ids, texmap, dims)
        out = limb = None
        if facing:
            a, e = np.radians(az), np.radians(el)
            ry = np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])
            rx = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]])
            n3 = (normals[tris[:, 0]] + normals[tris[:, 1]] + normals[tris[:, 2]]) @ ry.T @ rx.T
            s3 = vside[tris]
            agree = (s3[:, 0] == s3[:, 1]) & (s3[:, 1] == s3[:, 2])
            t_side = np.where(agree, s3[:, 0], 0)
            fc, fa, _ = render.rasterise(
                screen, uv, tris, (t_side * 2 + (n3[:, 2] > 0)).astype(np.int64),
                extra, dims)
            code = np.clip(np.round((fc[..., 0] - 20.0) / 40.0), 0, 5).astype(np.int8)
            out = (fa > 0) & (code % 2 == 1)
            limb = np.where(fa > 0, code // 2, 0).astype(np.int8)
        who = np.full(colour.shape[:2], -1, dtype=np.int16)
        key = np.round(colour).astype(int)
        for i, n in enumerate(names):
            c = np.round(palette[n]).astype(int)
            hit = (alpha > 0) & (np.abs(key - c).max(axis=2) <= 1)
            who[hit] = i
        labels[name] = ((who, names, depth) if not facing
                        else (who, names, depth, out, limb))
        if out_prefix:
            rgb = colour * alpha[..., None] + 255.0 * (1 - alpha[..., None])
            Image.fromarray(rgb.astype(np.uint8)).save(f'{out_prefix}-{name}.png')
            made.append(f'{out_prefix}-{name}.png')
    return made, palette, labels


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    made, palette = build(os.path.join(base, 'out', 'mika-milfy.vrm'),
                          os.path.join(base, 'out', 'mika-milfy.parts.json'),
                          os.path.join(base, 'out', 'partmap'),
                          only=('front', 'back'))
    for n, c in sorted(palette.items()):
        print(f'  {n:<24} rgb({int(c[0])},{int(c[1])},{int(c[2])})')
    print('wrote', ', '.join(made))
