"""Repaint a VRM's textures without touching a single bone.

WHAT THIS CAN AND CANNOT DO. A VRM bakes geometry into the file, so this cannot
give her a garment she does not already wear — no long skirt, no wide sleeves.
What it can do is change what every surface LOOKS like, which is genuinely a
different face and different clothes to look at, and it is the only appearance
change available without VRoid.

The colour lives in the textures, not in the material: every MToon material in
this model carries _Color = [1,1,1,1], so a tint multiplier would only mud the
image. Shifting the texture's own hue keeps all the shading, seams and printed
detail the artist drew and moves only the colour.

THE SKELETON IS ASSERTED, NOT ASSUMED. Rebuilding the binary chunk means every
bufferView offset moves, and a mistake there would corrupt the mesh while still
producing a loadable file. `nodes`, `skins`, `scenes` and the humanoid map are
compared before and after, character for character.
"""
import colorsys
import io
import json
import os
import struct
import sys

from PIL import Image

GLB_MAGIC = 0x46546C67


def load(path):
    raw = open(path, 'rb').read()
    magic, version, _ = struct.unpack('<III', raw[:12])
    assert magic == GLB_MAGIC and version == 2, 'not a glb 2.0'
    jlen, jkind = struct.unpack('<II', raw[12:20])
    doc = json.loads(raw[20:20 + jlen])
    blen, bkind = struct.unpack('<II', raw[20 + jlen:28 + jlen])
    binary = raw[28 + jlen:28 + jlen + blen]
    return doc, binary, jkind, bkind


def skeleton(doc):
    """The parts that must survive untouched, as one comparable string."""
    return json.dumps(
        {
            'nodes': doc['nodes'],
            'skins': doc.get('skins'),
            'scenes': doc['scenes'],
            'scene': doc.get('scene', 0),
            'meshes': doc['meshes'],
            'accessors': doc['accessors'],
            'humanoid': doc['extensions']['VRM']['humanoid'],
        },
        sort_keys=True,
    )


def shift_hue(data, degrees, saturate=1.0, lighten=1.0):
    """Rotate an image's hue, keeping its alpha and its light/dark structure.

    Relative, and that is what makes it safe for a skin texture. A face carries
    blush, lip and shadow that an absolute remap would flatten into one colour,
    and a body texture carries white garment areas that must stay white — a
    rotation leaves them alone, because white has no hue to rotate and no
    saturation to scale.

    `lighten` is a gamma when below 1 and a multiply at or above it: raising a
    mid-tone by multiplying clips everything already near white, which on skin
    reads as a blown-out forehead.
    """
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    r, g, b, a = img.split()
    rgb = Image.merge('RGB', (r, g, b))
    px = rgb.load()
    w, h = rgb.size
    turn = degrees / 360.0
    for y in range(h):
        for x in range(w):
            cr, cg, cb = px[x, y]
            hh, ll, ss = colorsys.rgb_to_hls(cr / 255, cg / 255, cb / 255)
            hh = (hh + turn) % 1.0
            ss = min(1.0, ss * saturate)
            ll = ll ** lighten if lighten < 1 else min(1.0, ll * lighten)
            nr, ng, nb = colorsys.hls_to_rgb(hh, ll, ss)
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255))
    out = Image.merge('RGBA', (*rgb.split(), a))
    buf = io.BytesIO()
    out.save(buf, format='WEBP', quality=90, method=4)
    return buf.getvalue()


def recolour(data, hue, sat, lift):
    """Move an image to an ABSOLUTE hue, keeping its light/dark structure.

    Rotating by a fixed number of degrees is the wrong tool for "make this
    pink": the answer then depends on where the texture started, and two
    garments that began at different hues end up disagreeing. This sets the hue
    outright and scales saturation, then lifts lightness along a curve that
    leaves black near black — a straight multiply on a dark texture washes out
    the drawn shading and the hair reads as a flat sheet.
    """
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    r, g, b, a = img.split()
    rgb = Image.merge('RGB', (r, g, b))
    px = rgb.load()
    w, h = rgb.size
    target = (hue % 360) / 360.0
    for y in range(h):
        for x in range(w):
            cr, cg, cb = px[x, y]
            _, ll, ss = colorsys.rgb_to_hls(cr / 255, cg / 255, cb / 255)
            # lift as a gamma: mid-tones rise most, the darkest lines stay dark
            # so the drawn outlines survive.
            ll = ll ** lift if lift else ll
            nr, ng, nb = colorsys.hls_to_rgb(target, min(1.0, ll), min(1.0, ss * sat))
            px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255))
    out = Image.merge('RGBA', (*rgb.split(), a))
    buf = io.BytesIO()
    out.save(buf, format='WEBP', quality=90, method=4)
    return buf.getvalue()


def repaint(src, dst, recipe, absolute=False):
    """`recipe` maps an image NAME to (hue degrees, saturation, lightness)."""
    doc, binary, jkind, bkind = load(src)
    before = skeleton(doc)

    by_name = {}
    for i, im in enumerate(doc['images']):
        by_name.setdefault(im.get('name', ''), []).append(i)
    unknown = [n for n in recipe if n not in by_name]
    assert not unknown, f'沒有這些貼圖：{unknown}（有的是 {sorted(by_name)}）'

    # Pull every bufferView out as bytes, replace the ones being repainted, then
    # lay the whole chunk down again. Rewriting offsets in place is not an
    # option: a repainted image almost never re-encodes to its old length.
    views = []
    for bv in doc['bufferViews']:
        off = bv.get('byteOffset', 0)
        views.append(bytearray(binary[off:off + bv['byteLength']]))

    touched = []
    fn = recolour if absolute else shift_hue
    for name, (deg, sat, lit) in recipe.items():
        for idx in by_name[name]:
            image = doc['images'][idx]
            bvi = image['bufferView']
            views[bvi] = bytearray(fn(bytes(views[bvi]), deg, sat, lit))
            image['mimeType'] = 'image/webp'
            touched.append(name)

    blob = bytearray()
    for i, bv in enumerate(doc['bufferViews']):
        while len(blob) % 4:
            blob.append(0)
        bv['byteOffset'] = len(blob)
        bv['byteLength'] = len(views[i])
        blob += views[i]
    while len(blob) % 4:
        blob.append(0)
    doc['buffers'][0]['byteLength'] = len(blob)

    after = skeleton(doc)
    assert before == after, '骨架或網格被動到了，這個檔不合格'

    js = json.dumps(doc).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    glb = (
        struct.pack('<III', GLB_MAGIC, 2, 12 + 8 + len(js) + 8 + len(blob))
        + struct.pack('<II', len(js), jkind)
        + js
        + struct.pack('<II', len(blob), bkind)
        + bytes(blob)
    )
    open(dst, 'wb').write(glb)
    return dst, touched, len(glb)


# The recipe that produced /avatar/mika-pink.vrm from /avatar/AvatarSample_B_webp.vrm.
#
# Kept here because both files ship, and the second one is only a base to tweak
# from if the numbers that made it are visible. Two passes, and the reason they
# are two is the difference between the functions above: hair and iris are told
# WHICH colour to be (absolute), skin is told how far to MOVE (relative), because
# a face carries blush and lip that an absolute remap flattens into one colour.
#
# HAIR_HUE 350 with saturation x1.9 is not a guess. Her hair started at
# saturation 0.21, so the first attempt (x0.55) made it greyer rather than
# pinker; x1.9 with the lift lands at lightness 0.71 / saturation 0.49, against
# 0.72 / 0.48 measured off the reference picture.
HAIR_LAYERS = [f'F00_000_Hair_00_0{i}' for i in range(1, 7)]

PINK_PASS_1 = {  # absolute=True
    **{layer: (350, 1.9, 0.26) for layer in HAIR_LAYERS},
    'F00_000_00_EyeIris_00': (205, 1.5, 0.75),
}
PINK_PASS_2 = {  # absolute=False
    'F00_000_00_Face_00': (-8, 1.9, 0.55),
    'F00_000_00_Body_00': (-8, 1.9, 0.55),
}


# A skin atlas also holds the original hair paint. Match connected regions to
# the face cap's measured colour so purple shirt prints and nails stay intact.
# The smallest nape strip has 606 pixels; compression speckles have fewer than
# 400. Both nape-core medians are within 19 RGB units of the cap; the
# neighbouring nail region is 97 units away.
HAIR_PAINT_MIN_AREA = 400
HAIR_PAINT_RGB_DISTANCE = 55.0
SKIN_ATLASES = ('F00_000_00_Face_00', 'F00_000_00_Body_00')


def _hair_regions(rgba, reference=None):
    import numpy as np
    from scipy import ndimage
    import customise
    from bodies import mika_base

    core, fringe = customise.hair_paint_pixels(
        rgba[..., :3], rgba[..., 3], mika_base.SCALP_HUE,
        mika_base.SCALP_WINDOW, fringe_to=mika_base.SCALP_FRINGE_TO,
        fringe_min_sat=mika_base.SCALP_FRINGE_SAT)
    labels, _ = ndimage.label(core | fringe)
    if reference is None:
        largest = np.argmax(np.bincount(labels[core]))
        reference = np.median(rgba[..., :3][core & (labels == largest)], axis=0)
    selected = np.zeros(core.shape, dtype=bool)
    for label, region in enumerate(ndimage.find_objects(labels), start=1):
        if region is None:
            continue
        component = labels[region] == label
        if int(component.sum()) < HAIR_PAINT_MIN_AREA:
            continue
        median = np.median(rgba[region][..., :3][component & core[region]], axis=0)
        if np.linalg.norm(median - reference) <= HAIR_PAINT_RGB_DISTANCE:
            selected[region] |= component
    return core & selected, fringe & selected, reference


def repair_pink_hair_paint(src, dst):
    """Repair both scalp atlases, preserving every other decoded texel and view.

    Reuse the Milfy paint/fringe solver without its garment removal or geometry
    passes. Pink keeps the nape hair paint, recoloured to the existing hair.
    """
    import numpy as np
    avatar_scripts = os.path.join(os.path.dirname(__file__), 'avatar')
    if avatar_scripts not in sys.path:
        sys.path.insert(0, avatar_scripts)
    import customise
    import glb

    doc, binary, *_ = load(src)
    before = skeleton(doc)
    views = glb.views_of(doc, binary)
    hair = customise.median_hue(doc, views, HAIR_LAYERS)
    reference = None
    for name in SKIN_ATLASES:
        original = customise.image_rgba(doc, views, name)
        core, fringe, reference = _hair_regions(original, reference)
        if not core.any():
            raise ValueError(f'{name}: missing original scalp paint')
        weight = customise.paint_weights(original[..., :3], original[..., 3], core, fringe)
        customise.retone(doc, views, name, tuple(hair), stat=core, where=core)
        customise.blend_fringe(doc, views, name, core, fringe, weight)
        repaired = customise.image_rgba(doc, views, name)
        # HLS round trips can lose 1 RGB unit even outside `where`. Preserve
        # those pixels explicitly before lossless encoding the repaired atlas.
        repaired[~(core | fringe)] = original[~(core | fringe)]
        repaired[..., 3] = original[..., 3]
        customise._put_rgba(doc, views, name, np.rint(repaired))
    assert before == skeleton(doc), '骨架或網格被動到了，這個檔不合格'
    size = glb.save(dst, doc, glb.rebuild(doc, views))
    return str(dst), list(SKIN_ATLASES), size


def build_pink(src, dst, workdir):
    """Rebuild pink, including hair paint embedded in the skin atlases."""
    step = os.path.join(workdir, 'repaint-step1.vrm')
    repaint(src, step, PINK_PASS_1, absolute=True)
    repaint(step, dst, PINK_PASS_2, absolute=False)
    os.remove(step)
    return repair_pink_hair_paint(dst, dst)


if __name__ == '__main__':
    if sys.argv[1] == 'pink-repair':
        print(repair_pink_hair_paint(sys.argv[2], sys.argv[3]))
    elif sys.argv[1] == 'pink':
        print(build_pink(sys.argv[2], sys.argv[3], os.path.dirname(sys.argv[3]) or '.'))
    else:
        print(repaint(sys.argv[1], sys.argv[2], json.loads(sys.argv[3])))
