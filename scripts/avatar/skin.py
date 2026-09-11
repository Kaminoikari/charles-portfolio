"""Take the VRoid outfit off the body texture.

The mesh outfit was deleted, but VRoid also PAINTS clothing into the body's skin
texture: a black crop top, a studded choker, shorts, socks, star decals. Those
pixels survive every geometry change and show through wherever the new garments
do not cover, which is why the hips read as dark grey under an open cardigan.

Skin is separated from everything else by a property that survives shading: on
skin the channels always run red > green > blue by a clear margin, while the
painted garments here are grey, white, purple or black, where the channels are
equal or inverted. Small non-skin islands are kept, because those are the
fingernails and the areolae; only regions big enough to be clothing are removed.

Removed pixels are refilled by a pull-push pyramid: the image is repeatedly
halved, averaging only the pixels that survive, and then rebuilt downwards so a
hole borrows from whichever level is coarse enough to span it. Copying from the
nearest surviving pixel instead, which is the obvious method, fans a bodice-sized
hole into brown streaks radiating from its edge. The pyramid has to run all the
way to one pixel, or a hole wide enough to swallow a whole coarse cell is filled
with black; see pull_push.
"""
import io
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb        # noqa: E402
import humanoid   # noqa: E402
import partition  # noqa: E402

MIN_REGION = 1500     # px at 2048 square; a nail is far smaller than a bodice

# How far a texel may sit from this body's own skin colour, as a distance in
# RGB, and still be skin. It replaced an absolute `r > 105`, which is a fact
# about one body's palette: AvatarSample_A's dark brown top sits at
# [120 92 80] and passes it, so 49,193 texels of garment stayed on the model,
# and Vivi's at [129 100 85] left 155,800.
#
# 130 was chosen from the end-to-end sweep rather than from a colour theory:
# at 110, 130 and 150 alike every one of the sixteen local bodies comes out of
# strip() with no surviving patch of non-skin big enough to be clothing (the
# largest is 940 px against MIN_REGION's 1500), so the choice sits in the
# middle of a flat range and not on a cliff. The two garments are at 227 and
# 165, which is what sets the upper end.
#
# The local sample has no genuinely dark-skinned body: the darkest reference
# here is AvatarSample_B's [206 157 135]. A body much darker than that packs
# its whole palette into a smaller volume, and this radius would be a larger
# share of it; re-measure before trusting it there.
SKIN_RADIUS = 130


def is_skin(rgb, reference):
    """Which texels are this body's skin, given its own skin colour.

    The first three tests are the shading-invariant ones and are unchanged:
    on skin the channels run red > green > blue by a clear margin, while the
    painted garments are grey, white, purple or black, where the channels are
    equal or inverted. The fourth is what a body's own colour answers and an
    absolute threshold cannot, which is how far off that hue a texel may be.
    """
    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    distance = np.sqrt(((rgb.astype(np.float32) - reference) ** 2).sum(axis=-1))
    return ((r > g) & (g >= b) & ((r - b) > 22) & ((r - b) < 170)
            & (distance <= SKIN_RADIUS))


def half(a):
    """Average 2x2 blocks, trimming an odd last row or column.

    A dimension already at 1 is carried through rather than halved, so the
    pyramid reaches a single pixel on an image that is not square. Halving both
    dimensions unconditionally takes a 6x400 image to 3x200, then 1x100, and
    then to 0x50, which is an empty array; stopping at 1x100 instead leaves a
    coarsest level with columns nothing valid reaches, which is the same defect
    pull_push exists to avoid.
    """
    h, w = a.shape[:2]
    if h == 1:
        a = a[:, :w - w % 2]
        return (a[:, 0::2] + a[:, 1::2]) / 2.0
    if w == 1:
        a = a[:h - h % 2]
        return (a[0::2] + a[1::2]) / 2.0
    a = a[:h - h % 2, :w - w % 2]
    return (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / 4.0


def pull_push(rgb, valid):
    """Fill everything outside `valid` by averaging what is inside it.

    The pyramid runs until it is one pixel wide. It used to stop after nine
    halvings, which on a 2048 atlas is 4x4, and a cell no valid pixel reaches
    at the coarsest level divides zero by 1e-6 and comes out (0, 0, 0). The
    upsample then blends that zero down through every level, so the hole
    beneath it is filled dark: on AvatarSample_A two of the sixteen cells are
    empty, and the fill inside the hole ran to a median of [175 148 130] with a
    darkest point of [49 41 36], where the valid pixels average [243 215 190].
    Measured as a share of the atlas the body samples, 12.46% of it came out
    not skin-coloured on AvatarSample_A and 14.05% on AvatarSample_C. Nine
    levels was enough for the body this was written on, whose largest hole
    swallows no coarse cell whole.

    Running to one pixel makes the coarsest level the average of every valid
    pixel in the image, so there is always something to borrow from: the same
    fill then has a median of [244 208 180], within ten of that average. half()
    is what guarantees one pixel is reachable on an image that is not square.
    """
    colour = rgb.astype(np.float32) * valid[..., None]
    weight = valid.astype(np.float32)
    pyramid = [(colour, weight)]
    while weight.size > 1:
        colour, weight = half(colour), half(weight)
        pyramid.append((colour, weight))

    out = pyramid[-1][0] / np.maximum(pyramid[-1][1], 1e-6)[..., None]
    for colour, weight in reversed(pyramid[:-1]):
        zoom = (colour.shape[0] / out.shape[0], colour.shape[1] / out.shape[1], 1)
        coarse = ndimage.zoom(out, zoom, order=1)
        here = colour / np.maximum(weight, 1e-6)[..., None]
        a = np.clip(weight, 0.0, 1.0)[..., None]
        out = here * a + coarse * (1 - a)
    return out


def strip(img, reference):
    """Return (repainted RGBA, fraction of the texture repainted).

    `reference` is this body's own skin colour; skin_reference() reads it off
    the file.
    """
    arr = np.asarray(img.convert('RGBA')).copy()
    rgb = arr[..., :3]
    skin = is_skin(rgb, reference)

    # Only sizeable blocks of non-skin are clothing.
    lab, n = ndimage.label(~skin)
    if n:
        sizes = np.bincount(lab.ravel())
        big = np.zeros(sizes.shape, dtype=bool)
        big[1:] = sizes[1:] >= MIN_REGION
        clothing = big[lab]
    else:
        clothing = np.zeros_like(skin)

    if not clothing.any():
        return Image.fromarray(arr), 0.0

    # Thin decals hanging off a garment go with it: the chains, the star decals
    # and the printed logo are each too small to be called clothing on their own,
    # but they are not skin and they sit on the bodice. Fingernails and areolae
    # are far from any garment block and survive.
    clothing |= ndimage.binary_dilation(clothing, iterations=20) & ~skin
    # Then a few pixels more, to take the anti-aliased outline. Left in place it
    # traces every garment's silhouette onto the bare skin like a pencil line.
    clothing = ndimage.binary_dilation(clothing, iterations=4)

    filled = pull_push(rgb, ~clothing)
    wide = ndimage.binary_dilation(clothing, iterations=2)
    arr[..., :3][wide] = np.clip(filled[wide], 0, 255).astype(np.uint8)
    arr[..., 3][clothing] = 255
    return Image.fromarray(arr), float(clothing.mean())


def replace(doc, views, image_index, img):
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    views[doc['images'][image_index]['bufferView']] = bytearray(buf.getvalue())
    doc['images'][image_index]['mimeType'] = 'image/png'


# VRoid's part name for the body's own skin, as spelled in the material name.
# The face carries a SKIN material too, on its own atlas.
BODY_PART = 'Body'


def skin_material(doc):
    """The name of the material carrying this body's skin atlas.

    It used to be the caller's default argument, spelling one body's material:
    `F00_000_00_Body_00_SKIN` is Mika's base and AvatarSample_A's and B's, and
    on the other thirteen local bodies apply() raised before it repainted
    anything. VRoid writes the category into every material name, so the answer
    is readable off the file (see partition.vroid_category).

    The first match wins, which matters on a dress-up export: those carry the
    body's skin material again, decorated, on each inner layer.
    """
    for material in doc.get('materials') or []:
        if partition.vroid_category(material.get('name', '')) == (BODY_PART, 'SKIN'):
            return material['name']
    raise ValueError(f'這個檔案沒有 VRoid 的 {BODY_PART}/SKIN 材質，'
                     f'找不到身體的皮膚貼圖')


def body_image(doc, material=None):
    """Which image the body's skin material samples.

    Looked up by material name rather than written down as an index. Indices
    move whenever a primitive is added or an orphan swept, and a stale one would
    quietly repaint some other texture with skin.
    """
    material = material or skin_material(doc)
    for m in doc.get('materials', []):
        if m.get('name') != material:
            continue
        tex = m.get('pbrMetallicRoughness', {}).get('baseColorTexture', {}).get('index')
        if tex is None:
            break
        src = doc['textures'][tex].get('source')
        if src is not None:
            return src
    raise ValueError(f'找不到 {material} 的 baseColorTexture')


def skin_reference(doc, views, material=None):
    """This body's own skin colour, taken where the humanoid map says hands.

    A hand is bare on every body this pipeline has seen, which a torso is not
    and a forearm need not be, so it is the one place a body's skin colour can
    be read without first knowing what it is wearing. Vertices are taken when
    at least nine tenths of their skin weight is on hand or finger bones, and
    the atlas is sampled at their UVs; the answer is the MEDIAN, because a
    vertex sits on the edge of its UV island and a good number of them land on
    the outline drawn around it.

    All sixteen local bodies yield 1428 such vertices, VRoid's hands being one
    mesh over and over, and each median reads as that body's own tone:
    [254 231 205] for AvatarSample_A, [206 157 135] for AvatarSample_B.
    """
    material = material or skin_material(doc)
    index = next(i for i, m in enumerate(doc['materials'])
                 if m.get('name') == material)
    image = np.asarray(Image.open(io.BytesIO(bytes(
        views[doc['images'][body_image(doc, material=material)]['bufferView']]
    ))).convert('RGB'))
    height, width = image.shape[:2]
    hands = {node for bone, node in humanoid.bones(doc).items()
             if humanoid.is_hand(bone)}
    skins = humanoid.mesh_skin(doc)
    samples = []
    for mesh_index, mesh in enumerate(doc['meshes']):
        skin_index = skins.get(mesh_index)
        if skin_index is None:
            continue
        joints = doc['skins'][skin_index]['joints']
        on_hand = np.array([j < len(joints) and joints[j] in hands
                            for j in range(len(joints))])
        for prim in mesh['primitives']:
            if prim.get('material') != index:
                continue
            j = glb.read_accessor(doc, views, prim['attributes']['JOINTS_0'])
            w = glb.read_accessor(doc, views, prim['attributes']['WEIGHTS_0'])
            w = w.astype(np.float32)
            if w.max() > 1.5:                 # normalised byte weights
                w = w / 255.0
            uv = glb.read_accessor(doc, views, prim['attributes']['TEXCOORD_0'])
            drawn = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
            picked = drawn[(w * on_hand[j]).sum(axis=1)[drawn] >= 0.9]
            if picked.size:
                samples.append(image[
                    np.clip((uv[picked, 1] * height).astype(int), 0, height - 1),
                    np.clip((uv[picked, 0] * width).astype(int), 0, width - 1)])
    if not samples:
        raise ValueError('這具身體的手部骨頭沒有帶到任何皮膚頂點，量不出膚色參考')
    return np.median(np.concatenate(samples).astype(np.float32), axis=0)


def apply(src, dst):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    material = skin_material(doc)
    image_index = body_image(doc, material=material)
    raw = Image.open(io.BytesIO(bytes(views[doc['images'][image_index]['bufferView']])))
    out, share = strip(raw, skin_reference(doc, views, material))
    replace(doc, views, image_index, out)
    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    return share, size


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    doc, binary = glb.load(os.path.join(base, 'out', 'mika-milfy.vrm'))
    views = glb.views_of(doc, binary)
    material = skin_material(doc)
    raw = Image.open(io.BytesIO(bytes(
        views[doc['images'][body_image(doc, material=material)]['bufferView']])))
    out, share = strip(raw, skin_reference(doc, views, material))
    out.convert('RGB').resize((1024, 1024), Image.LANCZOS).save(
        os.path.join(base, 'out', 'body-tex-stripped.png'))
    print(f'repainted {share * 100:.1f}% of the body texture')
