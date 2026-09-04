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

import warnings

import numpy as np
from PIL import Image
from scipy import ndimage

import glb
import skin as skin_mod

REFERENCED_BY_VIEW = ('images',)


def skin_pixels(rgb):
    """Which texels of an RGB array are skin, by the pipeline's one definition.

    Delegates to skin.is_skin rather than restating the predicate: that module
    already had to separate skin from painted clothing to strip the body's
    printed bodice, and a second copy here would be a rule that can drift while
    every test stays green.
    """
    return skin_mod.is_skin(rgb)


def _hue_deg(rgb):
    """Hue in degrees for an (h, w, 3) uint8-valued float array."""
    h, _, _ = np.vectorize(colorsys.rgb_to_hls)(
        rgb[..., 0] / 255.0, rgb[..., 1] / 255.0, rgb[..., 2] / 255.0)
    return h * 360.0


def scalp_pixels(rgb, alpha, hue_centre, window=45.0, min_sat=0.18):
    """The hair-coloured cap VRoid paints into the FACE texture.

    VRoid bakes a scalp in the hair's colour under the hairline so a parting
    shows hair rather than skin. It lives in the face atlas, which means every
    step that treats that atlas as skin also treats the scalp as skin: the
    2026-09-03 build rotated it by the SKIN solve and left a bright violet cap
    under blonde hair, showing through every parting as purple streaks.

    It is separated by hue because that is what actually distinguishes it here:
    the cap sits at the base model's original hair hue (~260 on both the
    untouched export and the pink repaint, neither of which recoloured it),
    while the skin around it is at ~9 and the lips at ~0. A window is used
    rather than a painted region so the mask follows the texture instead of
    being a set of coordinates that expires the next time the atlas changes.
    """
    hue = _hue_deg(rgb)
    _, _, sat = np.vectorize(colorsys.rgb_to_hls)(
        rgb[..., 0] / 255.0, rgb[..., 1] / 255.0, rgb[..., 2] / 255.0)
    off = np.abs(((hue - hue_centre + 180.0) % 360.0) - 180.0)
    return (alpha > 200) & (off <= window) & (sat >= min_sat)


def hair_paint_pixels(rgb, alpha, hue_centre, window=45.0, min_sat=0.18,
                      fringe_to=345.0, fringe_min_sat=0.12):
    """Hair-coloured paint in a SKIN atlas: the core `scalp_pixels` finds, plus
    its anti-aliased edge. Returns (core, fringe), two boolean masks.

    The 2026-09-03 build recoloured the core only. A painted region has an
    edge that blends toward the skin around it, and along that edge the hue
    walks from the cap (261) through magenta to the skin (9), leaving the hue
    window at 306 and only reaching skin at about 345. Those texels were left
    to the SKIN solve, which turned them mauve, and the owner saw them on
    2026-09-04 as purple lines behind the neck and along the hairline.

    The fringe is every opaque texel whose hue sits on that arc (from the far
    side of the window up to `fringe_to`) with enough chroma not to be skin,
    AND which is connected to the core. Connectivity is what keeps the lips and
    the blush out: they are at hue 0-9 and never touch the cap.
    """
    hue = _hue_deg(rgb)
    _, _, sat = np.vectorize(colorsys.rgb_to_hls)(
        rgb[..., 0] / 255.0, rgb[..., 1] / 255.0, rgb[..., 2] / 255.0)
    opaque = alpha > 200
    off = np.abs(((hue - hue_centre + 180.0) % 360.0) - 180.0)
    start = (hue_centre + window) % 360.0
    ahead = (hue - start) % 360.0
    span = (fringe_to - start) % 360.0
    candidate = opaque & (sat >= fringe_min_sat) & ((off <= window) | (ahead <= span))
    core = opaque & (off <= window) & (sat >= min_sat)
    labels, _ = ndimage.label(candidate | core)
    touching = np.unique(labels[core])
    connected = np.isin(labels, touching[touching > 0])
    return core, connected & candidate & ~core


def paint_weights(rgb, alpha, core, fringe, ring=6):
    """How much of each fringe texel is paint (1.0) rather than skin (0.0),
    read off the texture BEFORE anything recolours it: the texel projected
    onto the line from the skin just outside the region to the core's median.
    Zero everywhere outside the fringe."""
    region = core | fringe
    around = ndimage.binary_dilation(region, iterations=ring) & ~region & (alpha > 200)
    if not around.any() or not core.any():
        return np.zeros(rgb.shape[:2])
    skin_ref = np.median(rgb[around], axis=0)
    axis = np.median(rgb[core], axis=0) - skin_ref
    w = ((rgb - skin_ref) @ axis) / max(float(axis @ axis), 1e-6)
    return np.clip(w, 0.0, 1.0) * fringe


def image_rgba(doc, views, image_name):
    """The named texture as a float RGBA array, 0-255."""
    for image in doc.get('images', ()):
        if image.get('name') != image_name:
            continue
        im = Image.open(io.BytesIO(bytes(views[image['bufferView']]))).convert('RGBA')
        return np.asarray(im, dtype=np.float64)
    raise SystemExit(f'找不到貼圖 {image_name}')


def median_hue(doc, views, image_names):
    """Median RGB over the opaque pixels of several textures, as one population.

    Used to derive what the scalp cap has to become: whatever the hair textures
    actually ended up as, read back after they were transformed, rather than a
    colour written down beside the transform that would go stale the first time
    the transform moved.
    """
    pool = []
    for name in image_names:
        a = image_rgba(doc, views, name)
        pool.append(a[..., :3][a[..., 3] > 200])
    stacked = np.concatenate(pool, axis=0)
    return np.median(stacked, axis=0)


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


def tone_textured_materials(doc, image_names, rgb, shade=None):
    """Apply one MToon multiplier to every material using named images.

    three-vrm reads the glTF factor while VRM0 renderers read `_Color` and
    `_ShadeColor`. Keeping the factor and `_Color` equal prevents bright live
    lighting from washing a warm texture back toward white. `_ShadeColor` is
    the same value unless `shade` is given: with it equal, MToon draws no
    shading of its own on that surface, which is what a flat skin wants and
    what the hair did NOT want -- with the hair's shade equal to its lit tone
    the whole head read as one flat sheet next to the skin (2026-09-04).
    """
    image_indices = {
        index for index, image in enumerate(doc.get('images', ()))
        if image.get('name') in image_names
    }
    texture_indices = {
        index for index, texture in enumerate(doc.get('textures', ()))
        if texture.get('source') in image_indices
    }
    materials = doc.get('materials', ())
    properties = doc['extensions']['VRM']['materialProperties']
    if len(properties) != len(materials):
        raise SystemExit('materialProperties 與 materials 不同序，不能同步乘色')

    changed = []
    for index, material in enumerate(materials):
        pbr = material.get('pbrMetallicRoughness', {})
        texture_index = pbr.get('baseColorTexture', {}).get('index')
        if texture_index not in texture_indices:
            continue
        alpha = pbr.get('baseColorFactor', [1, 1, 1, 1])[3]
        factor = [*rgb, alpha]
        pbr['baseColorFactor'] = factor
        vectors = properties[index].setdefault('vectorProperties', {})
        vectors['_Color'] = list(factor)
        vectors['_ShadeColor'] = [*shade, alpha] if shade is not None else list(factor)
        changed.append(material.get('name', f'材質 {index}'))
    if not changed:
        raise SystemExit(f'找不到使用指定貼圖的材質：{sorted(image_names)}')
    return changed


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


def _flatten_v(channel, opaque, blocks):
    """Remove a channel's vertical trend, column block by column block.

    VRoid paints each hair card as a root-to-tip ramp down the v axis. Pulling
    the whole channel toward its median removes the ramp, but it removes the
    strand-to-strand variation with it -- the same amount, because a value-space
    knob cannot tell the two apart. This can: the ramp runs down v and the strand
    detail runs across u, so subtracting each row's own median takes out the
    first and leaves the second untouched.

    Per column block rather than per whole row, because the strips in one hair
    atlas do not share a trend. Measured on what this function actually receives
    (the hue rotation, saturate and lift already applied), `F00_000_Hair_00_02`
    has strand cards over the left three quarters whose R-B falls 42.6 to 11.7
    down v, and a flat under-layer strip on the right that runs 13.9 to 9.8; one
    row median is dominated by the cards and would carve their ramp, inverted,
    into the strip. The two atlases disagree about this, which is why no single
    whole-row correction can be right for both: in `baseline.vrm`,
    `F00_000_Hair_00_01`'s strip ramps with its cards (93 to 40) while
    `F00_000_Hair_00_02`'s does not (31 to 20).

    Sixteen blocks puts every strip well inside its own, and the result is
    insensitive to the count: at 8, 16 and 32 this atlas's lightness p10-p90 is
    0.100, 0.102 and 0.102 -- an absolute spread, not a fraction of anything --
    and `F00_000_Hair_00_01`'s is 0.039, 0.037 and 0.039. Over the same three the
    cards stop ramping: their R-B at the v=0.75 end reads 23.1, 22.6 and 22.7
    against 22.9, 22.6 and 22.7 at v=0.05 (the un-flattened atlas falls 42.6 to
    11.7 across that span). Built at all three, both guards stay green --
    receipts in evidence/mutations-0903c.md (S8, S32) and
    evidence/colorprobe-0903.md.
    """
    out = channel.copy()
    edges = np.linspace(0, channel.shape[1], blocks + 1).astype(int)
    for start, end in zip(edges[:-1], edges[1:]):
        block, mask = channel[:, start:end], opaque[:, start:end]
        if mask.sum() < 100:
            continue
        whole = float(np.median(block[mask]))
        # `np.errstate` 擋不住這一個：All-NaN slice 是 numpy 用 warnings.warn 發的
        # RuntimeWarning，不是浮點狀態旗標。整列都在遮罩外（髮片之間的空白）是這張
        # 圖的常態，下一行本來就會把它換成 whole，所以這裡明確地把它靜音，而不是留
        # 一個看起來有擋、其實每次建置都照印的 with。
        with warnings.catch_warnings():
            warnings.filterwarnings('ignore', 'All-NaN slice encountered',
                                    RuntimeWarning)
            rows = np.nanmedian(np.where(mask, block, np.nan), axis=1)
        rows = np.where(np.isnan(rows), whole, rows)
        out[:, start:end] = block - rows[:, None] + whole
    return np.clip(out, 0.0, 1.0)


def hue(doc, views, image_name, degrees, saturate=1.0, lighten=1.0, lift=0.0,
        unify=None, flatten=0, offset=0.0, where=None):
    """Rotate a texture's hue, keeping its shading and its alpha.

    `where` is a boolean mask limiting which texels are written; the rest keep
    what they had. It exists because the face atlas holds two different
    materials' worth of colour -- skin, and the hair-coloured scalp cap -- and
    one transform cannot serve both. Without it the only way to move one was to
    move the whole image, which is the shape of the 2026-09-03 purple scalp.

    `lift` pulls lightness toward white by a fraction rather than scaling
    it. Scaling is what a first pass reaches for and it is wrong here: the
    factor needed to bring the hair up to the reference (about 1.2) drives
    every highlight past 1.0, and a hair texture is mostly highlight, so the
    strands flatten into a white sheet. l + (1-l)*lift never clips and keeps
    the ordering between shadow and highlight intact.

    `offset` adds to lightness instead. It keeps the ORDERING like lift does and
    also keeps the SPACING, which lift does not: lift multiplies every gap by
    (1-lift), so a face texture lifted by 0.63 loses 63% of the distance between
    the lips and the cheek and the mouth stops reading as a mouth. The price is
    that an offset can clip, so the caller has to check the histogram first --
    `retone` does, and falls back to lift when too much of the texture would
    burn out. Use one or the other, not both.

    `unify` is an angle in degrees. Pixels further than that from the texture's
    own median hue are moved onto the median before the rotation. The base
    model's hair carries deliberate accent streaks -- 1.7% of one map sits at
    hue 105 against a body at 348 -- and a single rotation cannot serve both:
    turning the pink to sand turns the teal to lavender, and two lavender locks
    down the middle of the fringe are the first thing the eye finds. The
    reference hair is one tone throughout.

    `flatten` carries the same idea to the ramp down the v axis, as a number of
    column blocks passed to `_flatten_v`; 0 leaves the texture alone. VRoid
    paints each hair card warm and saturated where it leaves the scalp and pale
    at its end, and `unify` only levels the hue, so that ramp survives a rotation
    intact. It is invisible on the base model, whose tips hang past the
    shoulders, and unmissable on this one, which coils the tips into buns at the
    crown: the palest and the warmest ends of one ramp end up side by side across
    the back of the head. The reference asset has no ramp at all, root and tip
    are the same ash, so removing it is not a stylisation, it is the thing being
    copied.
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
        h0, l0, s0 = h, l, s
        h = (h + degrees / 360.0) % 1.0
        s = np.clip(s * saturate, 0, 1)
        l = np.clip(l * lighten, 0, 1)
        l = np.clip(l + (1.0 - l) * lift, 0, 1)
        l = np.clip(l + offset, 0, 1)
        if where is not None:
            h = np.where(where, h, h0)
            s = np.where(where, s, s0)
            l = np.where(where, l, l0)
        if flatten:
            opaque = a > 0.8
            if not opaque.any():
                raise SystemExit(f'{image_name} 全透明，flatten 無從取中位數')
            s = _flatten_v(s, opaque, flatten)
            l = _flatten_v(l, opaque, flatten)
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


# 加法位移允許燒掉的比例，以及「本來就白」的界線。臉的貼圖有一整片眼白、牙齒與
# 高光坐在 0.98 以上，把它們算進預算等於在懲罰位移做對了的事，所以只數原本低於
# ALREADY_WHITE、位移後才越過 1.0 的像素。
#
# 2026-09-03 這一版解出來：臉位移 +0.147 燒掉 0.33%，身體位移 +0.116 燒掉
# 0.01%。同一步改走 lift 的話係數是 0.630 與 0.573，臉的貼圖亮度 p10–p90 會從
# 0.410 掉到 0.151，唇就不見了。1% 的預算比實測值寬三倍（換一張貼圖不至於翻
# 盤），又遠低於「整片都在燒」的量級。
CLIP_BUDGET = 0.01
# How many times retone re-measures and corrects, and how close (in 0-255) the
# masked median has to land before it stops.
#
ALREADY_WHITE = 0.98


def _burn(doc, views, image_name, offset):
    """位移之後才被夾在 1.0、而且原本不算白的不透明像素比例。"""
    for image in doc.get('images', ()):
        if image.get('name') != image_name:
            continue
        arr = np.asarray(
            Image.open(io.BytesIO(bytes(views[image['bufferView']]))).convert('RGBA'),
            dtype=np.float64) / 255.0
        rgb, a = arr[..., :3], arr[..., 3]
        _, l, _ = np.vectorize(colorsys.rgb_to_hls)(rgb[..., 0], rgb[..., 1], rgb[..., 2])
        opaque = a > 0.8
        if not opaque.any():
            return 1.0
        lit = l[opaque]
        return float(np.mean((lit < ALREADY_WHITE) & (lit + offset > 1.0)))
    raise SystemExit(f'找不到貼圖 {image_name}')


def retone(doc, views, image_name, target, mid=None, stat=None, where=None):
    """Move a texture's overall skin tone onto `target`, and report what it did.

    `stat` is a boolean mask of the texels that DEFINE the tone, and `where` of
    the texels the solve is applied to. Both default to every opaque texel.
    They exist because the face atlas holds two materials' worth of colour: the
    skin, and the hair-coloured scalp cap VRoid paints into it, which until
    2026-09-03 was rotated along with the skin and came out purple. The cap is
    now solved onto the hair colour through these two masks, and kept out of
    the skin's sample and the skin's transform.

    This is for ONE texture. The two skin atlases go through `retone_together`,
    which solves them as a single population; solving each against the target on
    its own is what put the face and the neck on different tones (see there).

    The parameters are solved from the texture rather than written down, so a
    change of source texture moves the solve with it.

    Only the median is moved. Everything the texture says relative to that -- the
    blush, the lips, the shading under the chin -- keeps its ordering. A darker
    target scales lightness down, because a non-negative lift cannot reach a tone
    below the source median.

    A lighter target is where the choice is. Keeping the ordering turned out not
    to be enough: `lift` also multiplies every lightness GAP by (1-lift), and the
    2026-09-03 solve needed 0.63 on the face, which took 63% of the distance
    between the lips and the cheek with it. On screen the mouth stopped reading
    as a mouth while every number about the skin was correct. So a lighter target
    now prefers an additive offset, which moves the median by exactly as much and
    changes no gap at all, and only falls back to lift when `_burn` says the
    offset would clip more than CLIP_BUDGET of the texture.

    `mid` is a (low, high) brightness window narrowing which pixels define the
    tone. An iris texture needs it: half its area is a near-black pupil and a
    white catchlight, and a median taken over all of it describes neither the
    colour a person sees nor anything else.
    """
    return _solve_and_apply(doc, views, [image_name], target, mid=mid,
                           stats={image_name: stat}, wheres={image_name: where})


def retone_together(doc, views, image_names, target, stats=None, wheres=None):
    """Solve ONE tone transform across several textures and apply it to all of them.

    Solving each atlas separately is what put a visible line across Mika's neck.
    The face atlas and the body atlas hold two halves of one skin, but their
    medians are not the same colour -- the face's carries the lips, the brows and
    the blush -- so aiming each median at a single target hands the two halves two
    different transforms, and the difference lands exactly on the seam.

    It is worse than a seam, because an additive lightness offset does not move
    chroma, it SHRINKS it: in HLS a colour at lightness l can hold at most
    2(1-l) of chroma, so an offset that takes the face's brightest, most visible
    skin to l = 0.99 leaves it room for 5 values of red over blue no matter what
    saturation asks for. On 2026-09-03 that is what shipped -- the visible face
    measured (232, 231, 229) against a neck at (231, 209, 202), a flat grey face
    on a warm body, and the source it was built from had (231, 210, 204) there.

    One transform for both halves cannot do that. Whatever agreement VRoid
    painted between the two atlases survives, because the same rotation, the same
    saturation and the same offset land on both.
    """
    return _solve_and_apply(doc, views, list(image_names), target,
                            stats=stats, wheres=wheres)


def _solve_and_apply(doc, views, image_names, target, mid=None, stats=None,
                     wheres=None):
    """Shared body of `retone` and `retone_together`."""
    stats = stats or {}
    wheres = wheres or {}
    px = []
    for name in image_names:
        a = image_rgba(doc, views, name)
        keep = a[..., 3] > 200
        stat = stats.get(name)
        if stat is not None:
            keep = keep & stat
        if not keep.any():
            raise SystemExit(f'{name} 的取樣遮罩是空的')
        sample = a[..., :3][keep]
        if mid is not None:
            window = (sample.mean(axis=1) > mid[0]) & (sample.mean(axis=1) < mid[1])
            if window.sum() > 100:
                sample = sample[window]
        px.append(sample)
    med = np.median(np.concatenate(px), axis=0) / 255.0

    h0, l0, s0 = colorsys.rgb_to_hls(*med)
    h1, l1, s1 = colorsys.rgb_to_hls(*(np.asarray(target, dtype=np.float64) / 255.0))
    degrees = ((h1 - h0 + 0.5) % 1.0 - 0.5) * 360.0
    saturate = 0.0 if s0 <= 0 else s1 / s0
    lighten = 1.0 if l0 <= l1 else l1 / max(l0, 1e-9)
    lift = (0.0 if l0 >= l1 or l0 >= 1
            else float(np.clip((l1 - l0) / (1.0 - l0), 0.0, 1.0)))
    offset = 0.0
    if lift and max(_burn(doc, views, n, l1 - l0) for n in image_names) <= CLIP_BUDGET:
        offset, lift = float(l1 - l0), 0.0
    for name in image_names:
        hue(doc, views, name, degrees, saturate, lighten=float(lighten),
            lift=lift, offset=offset, where=wheres.get(name))
    return degrees, saturate, float(lighten), lift, offset


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


def uv_mask(shape, uv, triangles, feather=0.0117):
    """A texel mask covering the UV triangles listed, with a feathered edge.

    The mask is rasterised from the model rather than picked out by colour,
    because the thing it has to select -- the band of neck that VRoid paints as
    permanent shadow -- is defined by where it sits on the body, not by what
    colour it happens to be. A colour rule would also catch the shading under
    the nose and inside the ears.

    `feather` is a radius as a FRACTION OF THE ATLAS WIDTH. A hard edge in UV
    space is a hard edge on the model, and a tone correction that stops dead in
    the middle of a shoulder draws a line there; the returned weight ramps from 1
    inside to 0 that far out, so the correction fades instead. It is a fraction
    rather than a texel count so that two atlases at two resolutions fade over
    the same piece of model.
    """
    height, width = shape
    hit = np.zeros((height, width), dtype=bool)
    px = np.stack([uv[:, 0] * width, uv[:, 1] * height], axis=-1)
    for tri in triangles:
        p = px[tri]
        x0 = max(int(np.floor(p[:, 0].min())), 0)
        x1 = min(int(np.ceil(p[:, 0].max())) + 1, width)
        y0 = max(int(np.floor(p[:, 1].min())), 0)
        y1 = min(int(np.ceil(p[:, 1].max())) + 1, height)
        if x1 <= x0 or y1 <= y0:
            continue
        ys, xs = np.mgrid[y0:y1, x0:x1]
        ax, ay = p[0]
        bx, by = p[1]
        cx, cy = p[2]
        det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(det) < 1e-12:
            # A triangle with no area in UV covers no texels. Filling its
            # bounding box instead is what the first version did, and a single
            # degenerate triangle whose three vertices sit at opposite corners
            # of the atlas then paints most of the atlas: the seam ring came out
            # at 248,963 texels, 152,969 of them the scalp cap, which it repainted
            # in skin and quietly undid the fix for the purple hair.
            continue
        u = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / det
        w = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / det
        inside = (u >= -0.001) & (w >= -0.001) & (u + w <= 1.001)
        hit[ys[inside], xs[inside]] = True
    if not feather:
        return hit.astype(np.float64)
    # `feather` is a fraction of the atlas width for the same reason the blur is:
    # two atlases at two resolutions have to fade over the same piece of model.
    radius = max(int(round(feather * width)), 1)
    grown = ndimage.binary_dilation(hit, iterations=radius)
    near = ndimage.distance_transform_edt(~hit)
    weight = np.clip(1.0 - near / float(radius), 0.0, 1.0)
    return np.where(hit, 1.0, np.where(grown, weight, 0.0))


# Both are FRACTIONS OF THE ATLAS WIDTH, not texel counts. The face atlas is
# 1024 wide and the body's is 2048, so a radius written in texels covers twice
# as much of the model on one as on the other -- and this correction has to land
# on the same physical band of neck in both, or the seam between them opens
# exactly where the two radii disagree. That is what left the seam at delta-E
# 4.7 when these were 96 and 24 texels flat.
NECK_BLUR = 96.0 / 2048.0
NECK_FEATHER = 24.0 / 2048.0


def lift_region(doc, views, image_name, weight, target, blur=NECK_BLUR):
    """Flatten the painted shading out of one weighted region, onto `target`.

    Three attempts stand behind this one, and each failed for a reason worth
    keeping. Matching the region's MEDIAN moved nothing (-0.004 of lightness on
    the face atlas): the band is mostly ordinary skin with a narrow ring of
    painted shadow inside it, so the median describes the skin. A FLOOR on
    lightness left the seam at delta-E 4.9, because raising a dark texel's
    lightness caps its chroma at 2(1-l) without saying what that chroma is. A
    PROPORTIONAL pull toward the target left it at 5.2, because the two atlases
    paint the same ring at different saturations and a proportional move takes
    each of them the same fraction of a different distance.

    What actually has to go is a low-frequency field: VRoid paints the throat
    dark, broadly, because the base model's collar hides it, and MToon draws no
    shading of its own on that surface. So subtract the region's own local
    average and put `target` back in its place. Detail finer than `blur` texels
    survives untouched, the broad shadow does not, and both atlases end with the
    same low-frequency tone -- which is what closes the seam across the throat,
    since the seam's two sides are then two halves of one flat field.

    The average is a normalised convolution over `weight`, so texels outside the
    region never leak into it, and the correction is scaled by `weight` so it
    fades out at the edge instead of drawing a line there.

    Returns (how far the darkest decile moved, texels at full weight).
    """
    a = image_rgba(doc, views, image_name)
    solid = (a[..., 3] > 200) & (weight > 0.5)
    if solid.sum() < 100:
        raise SystemExit(f'{image_name} 的區域遮罩只剩 {int(solid.sum())} 個像素')
    goal = np.asarray(target, dtype=np.float64) / 255.0

    for image in doc.get('images', ()):
        if image.get('name') != image_name:
            continue
        bv = image['bufferView']
        arr = np.asarray(
            Image.open(io.BytesIO(bytes(views[bv]))).convert('RGBA'),
            dtype=np.float64) / 255.0
        rgb, alpha = arr[..., :3], alpha_of(arr)
        _, l0, _ = np.vectorize(colorsys.rgb_to_hls)(rgb[..., 0], rgb[..., 1], rgb[..., 2])
        before = float(np.percentile(l0[solid], 10))
        m = (weight > 0.0) & (arr[..., 3] > 0.8)
        sigma = blur * rgb.shape[1]
        norm = ndimage.gaussian_filter(m.astype(np.float64), sigma)
        low = np.stack([ndimage.gaussian_filter(rgb[..., c] * m, sigma) /
                        np.maximum(norm, 1e-6) for c in range(3)], axis=-1)
        out = np.clip(rgb + weight[..., None] * (goal - low), 0.0, 1.0)
        _, l1, _ = np.vectorize(colorsys.rgb_to_hls)(out[..., 0], out[..., 1], out[..., 2])
        buf = io.BytesIO()
        Image.fromarray((np.concatenate([out, alpha[..., None]], axis=-1) * 255
                         ).astype(np.uint8)).save(buf, format='WEBP', lossless=True)
        views[bv] = bytearray(buf.getvalue())
        image['mimeType'] = 'image/webp'
        return float(np.percentile(l1[solid], 10)) - before, int(solid.sum())
    raise SystemExit(f'找不到貼圖 {image_name}')


def _put_rgba(doc, views, image_name, rgba):
    """Write a 0-255 float RGBA array back over the named texture."""
    for image in doc.get('images', ()):
        if image.get('name') != image_name:
            continue
        buf = io.BytesIO()
        Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8)).save(
            buf, format='WEBP', lossless=True)
        views[image['bufferView']] = bytearray(buf.getvalue())
        image['mimeType'] = 'image/webp'
        return
    raise SystemExit(f'找不到貼圖 {image_name}')


def blend_fringe(doc, views, image_name, core, fringe, weight):
    """Give the edge of a recoloured paint region its own colour, LAST.

    The core was solved onto the hair and the skin around it onto the skin
    target; the fringe belongs to neither and was excluded from both. Each
    fringe texel becomes `weight` of the nearest solved core texel plus the
    rest of the nearest solved skin texel, so the edge blends the same two
    colours it blended in the source, in the same proportion, and never a
    third one. Run after every other pass over this atlas, or the pass after
    it will move the edge again.
    """
    a = image_rgba(doc, views, image_name)
    rgb, alpha = a[..., :3], a[..., 3]
    _, core_idx = ndimage.distance_transform_edt(~core, return_indices=True)
    skin = (alpha > 200) & ~(core | fringe)
    _, skin_idx = ndimage.distance_transform_edt(~skin, return_indices=True)
    ys, xs = np.nonzero(fringe)
    paint = rgb[core_idx[0][ys, xs], core_idx[1][ys, xs]]
    bare = rgb[skin_idx[0][ys, xs], skin_idx[1][ys, xs]]
    w = weight[ys, xs][:, None]
    rgb[ys, xs] = w * paint + (1.0 - w) * bare
    _put_rgba(doc, views, image_name, a)
    return int(len(ys))


def fill_from_surroundings(doc, views, image_name, mask, blur=1.5):
    """Replace masked texels with the skin around them.

    Each masked texel takes the nearest unmasked opaque texel, then the copy is
    blurred inside the mask so a strip a dozen texels wide does not carry a
    seam down its middle. For paint that has no business being there at all:
    the base hairstyle's nape strands in the body atlas, under a hairstyle
    that covers the nape with its own hair.
    """
    a = image_rgba(doc, views, image_name)
    rgb, alpha = a[..., :3], a[..., 3]
    skin = (alpha > 200) & ~mask
    _, idx = ndimage.distance_transform_edt(~skin, return_indices=True)
    filled = rgb.copy()
    filled[mask] = rgb[idx[0][mask], idx[1][mask]]
    soft = np.stack([ndimage.gaussian_filter(filled[..., c], blur) for c in range(3)], axis=-1)
    rgb[mask] = soft[mask]
    _put_rgba(doc, views, image_name, a)
    return int(mask.sum())


def alpha_of(arr):
    return arr[..., 3]
