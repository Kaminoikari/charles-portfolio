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


def prune_shapes(doc, views, manifest):
    """Drop grafted morph targets the deletion left with nothing to move.

    Returns the names dropped.

    A shape key on this model lives on the garments, not on the body: the six
    vendor keys move `Outfit_Top`, `Acc_Bandage_Thigh` and so on. Delete the
    garment and the key is still declared on every surviving primitive of the
    same mesh, still named in `extras.targetNames`, and now displaces nothing --
    a slider a customiser can find, drive to 1.0, and watch do nothing. That is
    the same silent no-op `SHAPE_KEY_MIN_MEAN` refuses at build time, arriving
    by the other door, and the manifest reports it worse than the file does: its
    `shapes` entry goes on naming a part that no longer exists.

    Meshes any `blendShapeMaster` group binds to are left alone whatever they
    measure. Those are the expression meshes, their targets are driven by name
    from the chat widget, and a face is entitled to an expression that happens
    to move nothing on this body.

    Runs before `sweep`, so the accessors it orphans are collected in the same
    pass rather than riding along as dead weight.
    """
    # `shapes` may be absent -- an older manifest, or a stage of the build that
    # runs before build.py writes the section. That must NOT gate the file-side
    # cleanup: whether a target still moves anything is a fact about the binary,
    # and leaving a dead slider in the VRM because a JSON section was missing is
    # the coupling this function exists to remove.
    shapes = manifest.get('shapes') or {}
    groups = (doc.get('extensions', {}).get('VRM', {})
              .get('blendShapeMaster', {}).get('blendShapeGroups', ()))
    bound = {b['mesh'] for g in groups for b in g.get('binds', ())}

    # Rebuilt from what is measured below, so entries for meshes this function
    # does NOT walk have to be carried over rather than dropped on the floor.
    # On this model there are none -- build.py only records the garment keys --
    # but a manifest that silently loses a section is the harder bug of the two.
    walked = {m.get('name') for mi, m in enumerate(doc['meshes'])
              if mi not in bound and (m.get('extras', {}).get('targetNames'))}
    dropped = []
    manifest['shapes'] = {k: e for k, e in shapes.items()
                          if e.get('mesh') not in walked}
    for mi, mesh in enumerate(doc['meshes']):
        names = mesh.get('extras', {}).get('targetNames') or []
        if not names or mi in bound:
            continue
        survives, moves = [], {}
        for ti, key in enumerate(names):
            where = {}
            for pr in mesh['primitives']:
                targets = pr.get('targets') or []
                if ti >= len(targets) or 'POSITION' not in targets[ti]:
                    continue
                d = glb.read_accessor(doc, views, targets[ti]['POSITION'])
                mag = np.linalg.norm(d.astype(np.float64), axis=1)
                hit = mag > glb.MORPH_EPSILON
                if not hit.any():
                    continue
                part = pr.get('extras', {}).get('part', 'unlabelled')
                prev = where.get(part, (0, 0.0))
                where[part] = (prev[0] + int(hit.sum()),
                               prev[1] + float(mag[hit].sum()) * 1000.0)
            if where:
                survives.append((ti, key))
                moves[key] = where
            else:
                dropped.append(key)

        # Two independent writes, deliberately not chained through each other:
        # the file loses the target, and the manifest is rebuilt from `moves` by
        # NAME. An earlier version derived the manifest key from the position
        # left after the deletion, which made the two impossible to break one at
        # a time -- and a guard you cannot break one at a time is a guard you
        # cannot show is doing anything.
        keep = {ti for ti, _ in survives}
        for ti in reversed(range(len(names))):
            if ti in keep:
                continue
            for pr in mesh['primitives']:
                targets = pr.get('targets') or []
                if ti < len(targets):
                    del targets[ti]
            del names[ti]
        for new_i, (_, key) in enumerate(survives):
            manifest['shapes'][key] = {
                'mesh': mesh.get('name'),
                'index': new_i,
                'parts': {p: {'vertices': n, 'mm': round(total / n, 2)}
                          for p, (n, total) in sorted(moves[key].items())},
            }
    return dropped


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
        acc = doc['accessors'][i]
        bv = acc.get('bufferView')
        if bv is not None:
            live_view.add(bv)
        # A sparse accessor keeps its indices and values in views of their own,
        # reachable only through the sparse block. Collecting the accessor's
        # own bufferView and stopping leaves those two orphaned, and this half
        # and the renumbering half below have to go together. Measured on this
        # model with selftest seed 15 (drops Acc_Ribbon_Hair, Acc_Bandage_Thigh,
        # Hair_Side_L): with both halves removed the sweep frees 351 views
        # instead of 191, writes a file that looks valid, and the next read of
        # any morph target indexes off the end of its own vertex array. With
        # only this half removed the renumbering below raises KeyError during
        # the sweep, which is the loud failure of the two.
        sp = acc.get('sparse')
        if sp:
            live_view.add(sp['indices']['bufferView'])
            live_view.add(sp['values']['bufferView'])
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
        sp = acc.get('sparse')
        if sp:
            sp['indices']['bufferView'] = view_map[sp['indices']['bufferView']]
            sp['values']['bufferView'] = view_map[sp['values']['bufferView']]
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


def sweep_materials(doc):
    """Drop materials no primitive uses, and the VRM block that shadows them.

    Returns the names dropped.

    They accumulate two ways and neither announces itself. Stripping the base
    model's own outfit leaves its cloth materials behind with nothing to paint,
    and every material this build declares up front stays declared even when the
    branch that would have used it never ran -- the hand-modelled cardigan, sock
    and ribbon are all still declared for the case where the purchased outfit is
    missing, and are unused every time it is present.

    VRM0 pairs `materials[i]` with `extensions.VRM.materialProperties[i]` by
    POSITION, so the two arrays are pruned together or the file ends up with
    every MToon setting attached to the wrong surface. `blendShapeMaster` can
    also name a material, in `materialValues`; a group naming one that is about
    to go is refused rather than quietly broken.
    """
    used = {pr['material'] for mesh in doc['meshes'] for pr in mesh['primitives']
            if 'material' in pr}
    names = [m.get('name') for m in doc['materials']]
    props = doc['extensions']['VRM']['materialProperties']
    if [m.get('name') for m in props] != names:
        raise SystemExit('materialProperties 與 materials 不同序，不能按位置刪')

    doomed = {i for i in range(len(names)) if i not in used}
    if not doomed:
        return []
    spoken = {mv.get('materialName')
              for g in doc['extensions']['VRM']['blendShapeMaster']['blendShapeGroups']
              for mv in g.get('materialValues', ())}
    clash = sorted({names[i] for i in doomed} & spoken)
    if clash:
        raise SystemExit(f'{clash} 沒有網格用，但 blendShapeGroup 指名了它們')

    keep = [i for i in range(len(names)) if i not in doomed]
    remap = {old: new for new, old in enumerate(keep)}
    doc['materials'] = [doc['materials'][i] for i in keep]
    doc['extensions']['VRM']['materialProperties'] = [props[i] for i in keep]
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            if 'material' in pr:
                pr['material'] = remap[pr['material']]
    return sorted(names[i] for i in doomed)


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


def _set_colour(doc, prop, rgb, skip=()):
    """Write one MToon vector property on every material, report what moved.

    Returns (name, previous rgb or None) per material actually changed, so the
    caller can print what the model was carrying before. Materials already on
    the value are left alone so the report only names real changes.
    """
    moved = []
    for mat in doc['extensions']['VRM']['materialProperties']:
        if mat['name'] in skip:
            continue
        vec = mat.setdefault('vectorProperties', {})
        was = vec.get(prop)
        if was is not None and max(abs(a - b) for a, b in zip(was[:3], rgb)) < 1e-4:
            continue
        vec[prop] = [rgb[0], rgb[1], rgb[2], 1.0 if was is None else was[3]]
        moved.append((mat['name'], None if was is None else tuple(was[:3])))
    return moved


def outline(doc, rgb, skip=()):
    """Put every MToon outline on one colour, and report the ones that moved.

    A VRM carries its outline colours over from whatever model it started as,
    and an unlit renderer cannot see them: the outline is a second draw pass
    over inflated back faces, so a numpy render of the mesh shows none of it and
    neither does any gate built on one. The base model's are VRoid's wine,
    (0.275, 0.090, 0.125), drawn to sit on salmon-pink skin. On a near-white
    body that same line reads as rust, and it traces the whole figure.

    `skip` names materials that keep their own line -- the hair's is black on
    purpose, and black is not a paler version of anything.
    """
    return _set_colour(doc, '_OutlineColor', rgb, skip)


def rim(doc, rgb):
    """Declare the MToon parametric rim colour, which the base model omits.

    Neither the base VRM nor its repaints carry `_RimColor` at all, and the site
    that draws them fills the gap with one hard-coded site accent for every body
    (avatarGuideEngine.ts). That accent is mars orange, chosen against pink hair
    and salmon skin; on this body it edges a near-white blouse and a near-black
    cardigan in rust. The colour belongs to the body, so the body states it, and
    the site scales whatever it finds rather than choosing it.

    Only the colour. How hard the rim burns and how tight it sits are the site's
    to decide -- it swells while she answers, which is a behaviour of the widget
    and not a property of the outfit.
    """
    return _set_colour(doc, '_RimColor', rgb)


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

    The manifest's `shapes` section is NOT this function's to fix. A shape key
    can outlive a deletion on one garment and die on another, so deciding its
    fate needs the binary; prune_shapes does it earlier in `apply`, where the
    views are still open, and this function must not undo that.
    """
    for name in dropped:
        manifest['parts'].pop(name, None)

    # The palette is a list of parts per material, and a deletion shortens some
    # of those lists. A material every one of whose parts is gone leaves the
    # manifest: a customiser reading it would offer a colour that lands on
    # nothing. (This is the palette half of what prune_shapes does for the
    # shape keys; the selftest check that audits the WRITTEN manifest went red
    # here the first time it was pointed at the right file.)
    for pal in manifest.get('palette', {}).values():
        pal['parts'] = [p for p in pal.get('parts', ()) if p in manifest['parts']]
    manifest['palette'] = {n: e for n, e in manifest.get('palette', {}).items()
                           if e['parts']}

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
    # Before the sweep: a key the deletion emptied has to lose its accessors in
    # the same pass, and prune_shapes rewrites manifest['shapes'] whether or not
    # the manifest is written out, because the file it edits is the file that
    # ships either way.
    orphan_keys = prune_shapes(doc, views, manifest) if drop else []
    for name, rgb in tints:
        tint(doc, name, rgb, views)
    for name, deg in hues:
        hue(doc, views, name, deg)
    # And the materials the deletion stranded, for the same reason: the build
    # sweeps its own dead materials at the end and `verify.unused_materials` is
    # a FAIL condition, so a customiser that skips this ships a file its own
    # health check rejects. Deleting Acc_Crown leaves Milfy_Gold and
    # Milfy_GoldInner painting nothing.
    idle_materials = sweep_materials(doc) if drop else []
    views, dropped = sweep(doc, views)

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    if manifest_out:
        remap(doc, manifest, drop)
        json.dump(manifest, open(manifest_out, 'w'), indent=1)
    return {'primitives_removed': n, 'accessors_dropped': dropped[0],
            'views_dropped': dropped[1], 'bytes': size,
            'shape_keys_dropped': orphan_keys,
            'materials_dropped': idle_materials}


if __name__ == '__main__':
    src, dst, mani = sys.argv[1], sys.argv[2], sys.argv[3]
    names = sys.argv[4].split(',') if len(sys.argv) > 4 and sys.argv[4] else []
    print(apply(src, dst, mani, drop=names))
