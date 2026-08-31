"""Delete parts and change colours on a partitioned VRM, then prove it still loads.

Deleting a primitive is the easy half. The half that decides whether the file is
actually clean is the sweep afterwards: an accessor nobody references, and the
bufferView behind it, have to go, and every surviving index that pointed past
them has to be renumbered. Skip that and the file still opens, still renders,
and still carries the deleted garment's vertices in its bounding box and its
download size.

Colour works two ways because this model's colour lives in two places. Parts
added by this pipeline carry a flat baseColorFactor and can be retinted by
writing three numbers. VRoid's own materials keep their colour in the texture
(every MToon _Color here is [1,1,1,1], so a tint would only mud the image), and
those are rotated in hue instead — the same move scripts/repaint_vrm.py made to
turn the base model pink.
"""
import colorsys
import io
import json
import sys

import numpy as np
from PIL import Image

import glb

REFERENCED_BY_VIEW = ('images',)


def drop_parts(doc, views, manifest, names):
    """Remove named parts, located by their label rather than by index.

    The manifest also records primitive indices, and using those was a real bug:
    any earlier deletion shifts every index after it, so a later delete removes
    its neighbours instead. The label written into `extras.part` moves with the
    primitive, which is the whole reason it is written there.
    """
    wanted = set(names)
    unknown = wanted - set(manifest['parts'])
    if unknown:
        raise SystemExit(f'清單裡沒有這些部件：{sorted(unknown)}')
    locked = [n for n in wanted if not manifest['parts'][n].get('deletable', True)]
    if locked:
        raise SystemExit(f'{", ".join(sorted(locked))} 標記為不可刪除')

    removed = 0
    for mesh in doc['meshes']:
        keep = [p for p in mesh['primitives']
                if p.get('extras', {}).get('part') not in wanted]
        removed += len(mesh['primitives']) - len(keep)
        mesh['primitives'] = keep
    return removed


def sweep(doc, views):
    """Drop unreferenced accessors and bufferViews, renumbering what survives."""
    live_acc, live_view = set(), set()
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            live_acc.update(pr['attributes'].values())
            if 'indices' in pr:
                live_acc.add(pr['indices'])
            for t in pr.get('targets', ()):
                live_acc.update(t.values())
    for skin in doc.get('skins', ()):
        if 'inverseBindMatrices' in skin:
            live_acc.add(skin['inverseBindMatrices'])
    for anim in doc.get('animations', ()):
        for s in anim.get('samplers', ()):
            live_acc.update((s['input'], s['output']))

    for i in live_acc:
        bv = doc['accessors'][i].get('bufferView')
        if bv is not None:
            live_view.add(bv)
    for group in REFERENCED_BY_VIEW:
        for item in doc.get(group, ()):
            if 'bufferView' in item:
                live_view.add(item['bufferView'])

    acc_map = {}
    kept_acc = []
    for i, acc in enumerate(doc['accessors']):
        if i in live_acc:
            acc_map[i] = len(kept_acc)
            kept_acc.append(acc)
    view_map = {}
    kept_views, kept_view_defs = [], []
    for i, bv in enumerate(doc['bufferViews']):
        if i in live_view:
            view_map[i] = len(kept_view_defs)
            kept_view_defs.append(bv)
            kept_views.append(views[i])

    for acc in kept_acc:
        if 'bufferView' in acc:
            acc['bufferView'] = view_map[acc['bufferView']]
    for group in REFERENCED_BY_VIEW:
        for item in doc.get(group, ()):
            if 'bufferView' in item:
                item['bufferView'] = view_map[item['bufferView']]
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            pr['attributes'] = {k: acc_map[v] for k, v in pr['attributes'].items()}
            if 'indices' in pr:
                pr['indices'] = acc_map[pr['indices']]
            pr['targets'] = [{k: acc_map[v] for k, v in t.items()}
                             for t in pr.get('targets', ())] or pr.get('targets', [])
            if not pr['targets']:
                pr.pop('targets', None)
    for skin in doc.get('skins', ()):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = acc_map[skin['inverseBindMatrices']]
    for anim in doc.get('animations', ()):
        for s in anim.get('samplers', ()):
            s['input'], s['output'] = acc_map[s['input']], acc_map[s['output']]

    dropped = (len(doc['accessors']) - len(kept_acc),
               len(doc['bufferViews']) - len(kept_view_defs))
    doc['accessors'] = kept_acc
    doc['bufferViews'] = kept_view_defs
    return kept_views, dropped


def _greyscale(doc, views, texture_index, tolerance=12):
    """Whether a texture carries no colour of its own, so a factor can set it.

    Measured, not assumed by name. The VRoid maps are painted artwork and their
    hue cannot be replaced by a multiply; the imported outfit ships greyscale
    pattern maps and the vendor colours them in a shader, which is the same job
    a baseColorFactor does. Both arrive as a baseColorTexture, so the only
    honest way to tell them apart is to look at the pixels.
    """
    src = doc['textures'][texture_index].get('source')
    if src is None:
        return False
    view = doc['images'][src].get('bufferView')
    if view is None:
        return False
    img = Image.open(io.BytesIO(bytes(views[view]))).convert('RGB')
    a = np.asarray(img.resize((64, 64), Image.BILINEAR), dtype=np.float64)
    return float(np.mean(a.max(axis=2) - a.min(axis=2))) <= tolerance


def tint(doc, material_name, rgb, views=None):
    """Set a flat material's base colour. Only works where colour is a factor."""
    hit = 0
    for mat in doc.get('materials', ()):
        if mat.get('name') != material_name:
            continue
        pbr = mat.setdefault('pbrMetallicRoughness', {})
        tex = pbr.get('baseColorTexture', {}).get('index')
        if tex is not None and not (views is not None and _greyscale(doc, views, tex)):
            raise SystemExit(f'{material_name} 的顏色在貼圖裡，要用 hue 而不是 tint')
        alpha = pbr.get('baseColorFactor', [1, 1, 1, 1])[3]
        pbr['baseColorFactor'] = [rgb[0], rgb[1], rgb[2], alpha]
        for ext in mat.get('extensions', {}).values():
            if isinstance(ext, dict) and 'color' in ext:
                ext['color'] = [rgb[0], rgb[1], rgb[2], alpha]
        hit += 1
    if not hit:
        raise SystemExit(f'找不到材質 {material_name}')
    return hit


def hue(doc, views, image_name, degrees, saturate=1.0, lighten=1.0, lift=0.0,
        unify=None):
    """Rotate a texture's hue, keeping its shading and its alpha.

    `lift` pulls lightness toward white by a fraction rather than scaling
    it. Scaling is what a first pass reaches for and it is wrong here: the
    factor needed to bring the hair up to the reference (about 1.2) drives
    every highlight past 1.0, and a hair texture is mostly highlight, so the
    strands flatten into a white sheet. l + (1-l)*lift never clips and keeps
    the ordering between shadow and highlight intact.

    `unify` is an angle in degrees. Pixels further than that from the texture's
    own median hue are moved onto the median before the rotation. The base
    model's hair carries deliberate accent streaks -- 1.7% of one map sits at
    hue 105 against a body at 348 -- and a single rotation cannot serve both:
    turning the pink to sand turns the teal to lavender, and two lavender locks
    down the middle of the fringe are the first thing the eye finds. The
    reference hair is one tone throughout.
    """
    hit = 0
    for image in doc.get('images', ()):
        if image.get('name') != image_name:
            continue
        bv = image['bufferView']
        im = Image.open(io.BytesIO(bytes(views[bv]))).convert('RGBA')
        arr = np.asarray(im, dtype=np.float64) / 255.0
        rgb, a = arr[..., :3], arr[..., 3]
        h, l, s = np.vectorize(colorsys.rgb_to_hls)(rgb[..., 0], rgb[..., 1], rgb[..., 2])
        if unify is not None:
            solid = (a > 0.8) & (s > 0.05)
            if solid.any():
                mid = float(np.median(h[solid]))
                off = np.abs(((h - mid + 0.5) % 1.0) - 0.5) * 360.0
                h = np.where(solid & (off > unify), mid, h)
        h = (h + degrees / 360.0) % 1.0
        s = np.clip(s * saturate, 0, 1)
        l = np.clip(l * lighten, 0, 1)
        l = np.clip(l + (1.0 - l) * lift, 0, 1)
        r, g, b = np.vectorize(colorsys.hls_to_rgb)(h, l, s)
        out = np.stack([r, g, b, a], axis=-1)
        buf = io.BytesIO()
        Image.fromarray((out * 255).astype(np.uint8)).save(buf, format='WEBP', lossless=True)
        views[bv] = bytearray(buf.getvalue())
        image['mimeType'] = 'image/webp'
        hit += 1
    if not hit:
        raise SystemExit(f'找不到貼圖 {image_name}')
    return hit


def retone(doc, views, image_name, target, mid=None):
    """Move a texture's overall skin tone onto `target`, and report what it did.

    The parameters are solved from the texture rather than written down, because
    the face and the body are two images with two different medians (hue 358 and
    hue 9 here) and the one thing that must not happen is for them to land on
    different tones: the seam runs across the neck, in plain view. Solving both
    against the same target makes a mismatch impossible by construction.

    Only the median is moved. Everything the texture says relative to that -- the
    blush, the lips, the shading under the chin -- keeps its offset, which is why
    the lift is the pull-toward-white kind and not a multiply.

    `mid` is a (low, high) brightness window narrowing which pixels define the
    tone. An iris texture needs it: half its area is a near-black pupil and a
    white catchlight, and a median taken over all of it describes neither the
    colour a person sees nor anything else.
    """
    med = None
    for image in doc.get('images', ()):
        if image.get('name') != image_name:
            continue
        im = Image.open(io.BytesIO(bytes(views[image['bufferView']]))).convert('RGBA')
        a = np.asarray(im, dtype=np.float64)
        px = a[..., :3][a[..., 3] > 200]
        if mid is not None:
            keep = (px.mean(axis=1) > mid[0]) & (px.mean(axis=1) < mid[1])
            if keep.sum() > 100:
                px = px[keep]
        med = np.median(px, axis=0) / 255.0
        break
    if med is None:
        raise SystemExit(f'找不到貼圖 {image_name}')

    h0, l0, s0 = colorsys.rgb_to_hls(*med)
    h1, l1, s1 = colorsys.rgb_to_hls(*(np.asarray(target, dtype=np.float64) / 255.0))
    degrees = ((h1 - h0 + 0.5) % 1.0 - 0.5) * 360.0
    saturate = 0.0 if s0 <= 0 else s1 / s0
    lift = 0.0 if l0 >= 1 else np.clip((l1 - l0) / (1.0 - l0), 0.0, 1.0)
    hue(doc, views, image_name, degrees, saturate, lift=float(lift))
    return degrees, saturate, float(lift)


def remap(doc, manifest, dropped=()):
    """Renumber the manifest after a deletion, in place.

    A primitive index is a position, not an identity: delete one and everything
    after it in the same mesh shifts down by one. The manifest was written before
    the deletion, so every part later in that mesh now points at its neighbour.
    It cost a build to find out, because the parts dropped until now all lived in
    Body.baked while the parts that read them lived in Hair001.baked, and across
    two meshes the bug cannot fire.

    The `extras.part` label travels with the primitive, so re-scanning restores
    the mapping. A mesh nothing was deleted from is left alone, which is how the
    face survives: it is never split and carries no labels. Parts named in
    `dropped` leave the manifest entirely: they are gone from the file, and an
    entry with no primitives behind it is worse than no entry at all.
    """
    for name in dropped:
        manifest['parts'].pop(name, None)

    found = {}
    for mesh in doc['meshes']:
        for i, pr in enumerate(mesh['primitives']):
            label = pr.get('extras', {}).get('part')
            if label is None:
                continue
            e = found.setdefault(label, {'mesh': mesh.get('name'), 'primitives': []})
            e['primitives'].append(i)

    touched = {info['mesh'] for name, info in manifest['parts'].items()
               if name in found and info['primitives'] != found[name]['primitives']}
    for name, info in manifest['parts'].items():
        if name in found:
            info['mesh'] = found[name]['mesh']
            info['primitives'] = found[name]['primitives']
        elif info['mesh'] in touched:
            raise ValueError(f'{name} 在被改動的網格 {info["mesh"]} 上卻沒有 extras.part 標籤，'
                             f'索引無法重建')
    return manifest


def apply(src, dst, manifest_path, drop=(), tints=(), hues=(), manifest_out=None):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    manifest = json.load(open(manifest_path))

    n = drop_parts(doc, views, manifest, drop) if drop else 0
    for name, rgb in tints:
        tint(doc, name, rgb, views)
    for name, deg in hues:
        hue(doc, views, name, deg)
    views, dropped = sweep(doc, views)

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    if manifest_out:
        remap(doc, manifest, drop)
        json.dump(manifest, open(manifest_out, 'w'), indent=1)
    return {'primitives_removed': n, 'accessors_dropped': dropped[0],
            'views_dropped': dropped[1], 'bytes': size}


if __name__ == '__main__':
    src, dst, mani = sys.argv[1], sys.argv[2], sys.argv[3]
    names = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else []
    print(apply(src, dst, mani, drop=names))
