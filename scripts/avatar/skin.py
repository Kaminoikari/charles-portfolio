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
hole into brown streaks radiating from its edge.
"""
import io
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402

MIN_REGION = 1500     # px at 2048 square; a nail is far smaller than a bodice


def is_skin(rgb):
    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    return (r > g) & (g >= b) & ((r - b) > 22) & ((r - b) < 170) & (r > 105)


def half(a):
    """Average 2x2 blocks, trimming an odd last row or column."""
    h, w = a.shape[:2]
    a = a[:h - h % 2, :w - w % 2]
    return (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / 4.0


def pull_push(rgb, valid, levels=9):
    colour = rgb.astype(np.float32) * valid[..., None]
    weight = valid.astype(np.float32)
    pyramid = [(colour, weight)]
    for _ in range(levels):
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


def strip(img):
    """Return (repainted RGBA, fraction of the texture repainted)."""
    arr = np.asarray(img.convert('RGBA')).copy()
    rgb = arr[..., :3]
    skin = is_skin(rgb)

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


def body_image(doc, material='F00_000_00_Body_00_SKIN'):
    """Which image the body's skin material samples.

    Looked up by material name rather than written down as an index. Indices
    move whenever a primitive is added or an orphan swept, and a stale one would
    quietly repaint some other texture with skin.
    """
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


def apply(src, dst):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    image_index = body_image(doc)
    raw = Image.open(io.BytesIO(bytes(views[doc['images'][image_index]['bufferView']])))
    out, share = strip(raw)
    replace(doc, views, image_index, out)
    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    return share, size


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    doc, binary = glb.load(os.path.join(base, 'out', 'mika-milfy.vrm'))
    views = glb.views_of(doc, binary)
    raw = Image.open(io.BytesIO(bytes(views[doc['images'][body_image(doc)]['bufferView']])))
    out, share = strip(raw)
    out.convert('RGB').resize((1024, 1024), Image.LANCZOS).save(
        os.path.join(base, 'out', 'body-tex-stripped.png'))
    print(f'repainted {share * 100:.1f}% of the body texture')
