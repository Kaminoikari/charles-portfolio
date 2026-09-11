"""What each body's skin atlas still holds after strip(), by two measures.

RESIDUE is the share of the atlas THE MESH ACTUALLY SAMPLES that is_skin calls
not-skin. The UV footprint matters: the unused parts of a VRoid atlas are dark
and would swamp the figure. It is rasterised from the UV triangles of every
primitive drawing the Body SKIN material.

Residue is measured with is_skin itself, and that bounds what it can see: a
garment is_skin WRONGLY admits is reported as skin. So there is a second
figure that does not use the predicate at all.

LEFTOVER is the largest run of texels that came through strip() unchanged and
sit further than 120 in RGB from this body's own skin colour, which is read off
the hands through the humanoid map. It is judged against MIN_REGION, strip()'s
own answer to "big enough to be clothing". With is_skin's old absolute
threshold this read 49,193 px on AvatarSample_A and 155,800 on Vivi, both
whole garments, while residue read 0.04% and 0.31%.

    python3 scripts/avatar/evidence/skin-0912-residue.py
"""
import glob
import io
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import glb         # noqa: E402
import partition   # noqa: E402
import skin        # noqa: E402


def body_skin_material(doc):
    """Index and name of the material carrying this body's skin atlas."""
    for index, material in enumerate(doc.get('materials') or []):
        if partition.vroid_category(material.get('name', ''))[:2] == ('Body', 'SKIN'):
            return index, material['name']
    return None, None


def uv_footprint(doc, views, material_index, size):
    """The texels the mesh samples, by rasterising its UV triangles."""
    image = Image.new('1', size, 0)
    draw = ImageDraw.Draw(image)
    width, height = size
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            if prim.get('material') != material_index:
                continue
            uv = glb.read_accessor(doc, views, prim['attributes']['TEXCOORD_0'])
            idx = glb.read_accessor(doc, views, prim['indices']).ravel().astype(np.int64)
            px = np.stack([uv[:, 0] * width, uv[:, 1] * height], axis=1)
            for tri in idx.reshape(-1, 3):
                draw.polygon([tuple(px[tri[0]]), tuple(px[tri[1]]), tuple(px[tri[2]])],
                             fill=1)
    return np.asarray(image, dtype=bool)


# Far enough from this body's own skin to be somebody's clothing. Read only as
# a yardstick for the leftover column; the predicate strip() uses is is_skin.
FAR = 120

print(f"{'body':<30} {'sampled':>8} {'before':>8} {'after':>8} {'repainted':>10}"
      f" {'leftover':>10}")
worst = 0.0
worst_left = 0
for path in sorted(glob.glob(os.path.join(HERE, '..', '..', '..',
                                          'public', 'avatar', '*.vrm'))):
    name = os.path.basename(path)
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    index, material = body_skin_material(doc)
    if index is None:
        print(f'{name:<30} no Body SKIN material')
        continue
    raw = Image.open(io.BytesIO(bytes(
        views[doc['images'][skin.body_image(doc, material=material)]['bufferView']])))
    before = np.asarray(raw.convert('RGB'))
    reference = skin.skin_reference(doc, views, material)
    out, share = skin.strip(raw, reference)
    after = np.asarray(out.convert('RGB'))
    seen = uv_footprint(doc, views, index, raw.size)
    was = float((~skin.is_skin(before, reference) & seen).sum()) / seen.sum()
    now = float((~skin.is_skin(after, reference) & seen).sum()) / seen.sum()
    worst = max(worst, now)

    survived = (before.astype(np.int32) == after.astype(np.int32)).all(axis=2) & seen
    far = survived & (np.sqrt(((after.astype(np.float32) - reference) ** 2)
                              .sum(axis=2)) > FAR)
    labels, found = ndimage.label(far)
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    leftover = int(sizes.max()) if found else 0
    worst_left = max(worst_left, leftover)
    print(f'{name:<30} {seen.mean()*100:7.1f}% {was*100:7.2f}% {now*100:7.2f}% '
          f'{share*100:9.2f}% {leftover:8}px')
print(f'\nworst residue after: {worst*100:.2f}%')
print(f'worst leftover: {worst_left} px, against MIN_REGION {skin.MIN_REGION}')
