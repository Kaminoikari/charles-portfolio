"""The numbers the build claims, measured rather than asserted.

Colour, proportion and cost, each answered against a source rather than from
memory: the official sheets' own pixels, the model's own vertices, the clock.

Colour is compared in CIE Lab, not RGB. Two colours 30 apart in RGB can be
indistinguishable or obviously different depending on where they sit, and the
whole point of quoting a number is that it means something; ΔE is roughly "one
unit is the smallest difference a person can see".

Both a total and a chroma-only ΔE are printed, and only the second is fair. The
sheets are lit renders and a baseColorFactor is not, so every material reads
darker than its own pixels in the artwork by however much that lighting adds.
The chroma term drops the lightness axis and is what says whether the HUE is
right. The size of the gap between the two columns is itself the check: it is
10.7 for the near-black cardigan and 5.5 for the near-white skin, which is what
an additive ambient does and not what a wrong colour does.
"""
import os
import subprocess
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.expanduser('~/milfy-refs')
SHEET = 'official/front-back-with-cardigan.jpg'
FACES = 'official/expression-sheet-6.jpg'

# The goal asks for six sample points: hair, skin, iris, top, ribbon, shoes.
# Three of those six still have something to compare against, and the cardigan
# and the crown are added as a fourth and fifth pair, the crown because it was
# rebuilt against a measured reference colour and is worth holding to it. The model wears the
# MellowHeart Dream outfit, and the reference sheets show Milfy's default white
# dress and mint sash -- different garments, so a ΔE between those would be
# measuring the change of clothes. The cardigan survives the swap, because both
# outfits put a black oversized knit in the same place. The five garment
# materials with no counterpart are printed underneath with their chosen colour
# and no verdict.
#
# Each box was placed by cropping the sheet and looking, then checked by the
# spread it reports -- a box inside one flat area of artwork comes back flat,
# and one that does not is straddling two things. Two of the first placements
# failed that check (the skirt box crossed the mint sash at spread 37, the crown
# box sat on hair and forehead at spread 41) and were moved.
SAMPLES = [
    ('髮', 'Milfy_Hair', SHEET, (155, 125, 200, 175), None),
    ('膚', None,         SHEET, (205, 620, 235, 680), 'F00_000_00_Body_00'),
    ('瞳', None,         FACES, (471, 776, 489, 791), 'F00_000_00_EyeIris_00'),
    # The cardigan is the one garment the imported outfit and the reference
    # agree on -- both are a black oversized off-shoulder knit -- so it is the
    # one garment colour there is anything to compare against. The box sits on
    # the front figure's sleeve, away from the fold shadows: spread 4.8.
    ('外套', 'Mellow_Outer', SHEET, (150, 250, 190, 290), None),
    # The crown's lit face. The box is small on purpose: the crown is 60 pixels
    # across on this sheet and the dark inner face shows through the notches, so
    # a wider box measures the two-tone rather than the gold. Spread 22.5,
    # the widest of the five, for that reason.
    ('皇冠', 'Milfy_Gold', SHEET, (250, 66, 266, 80), None),
]

# Named materials whose colour is now a choice rather than a match.
GARMENT = ['Mellow_Inner', 'Mellow_Lace', 'Mellow_Sub_Acc', 'Mellow_Shoes',
           'Mellow_Jewel']

# Read off the sheet by eye against a 64-pixel grid, so each is good to about
# ten pixels, or 1.1% of the figure's height. Quoted to three decimals because
# the arithmetic is exact; believe the first two.
REFERENCE = {'頭頂': 62, '下巴': 222, '肩': 252, '腰': 430,
             '胯': 545, '膝': 730, '踝': 890}
REF_SOLE = 950


def _srgb_to_lab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805],
                  [0.2126, 0.7152, 0.0722],
                  [0.0193, 0.1192, 0.9505]])
    xyz = m @ c
    t = xyz / np.array([0.95047, 1.0, 1.08883])
    f = np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def delta_e(a, b):
    la, lb = _srgb_to_lab(a), _srgb_to_lab(b)
    return float(np.linalg.norm(la - lb)), float(np.linalg.norm(la[1:] - lb[1:]))


def _sheet(rel):
    return np.asarray(Image.open(os.path.join(REFS, rel)).convert('RGB')
                      .resize((1024, 1024), Image.LANCZOS), dtype=np.float64)


def _texture_mean(doc, views, index):
    """A texture's mean brightness as a fraction of white, by texture index.

    Used to fold a shading map into the factor it multiplies, so a material
    that keeps its colour in the factor is compared as it renders.
    """
    import io
    source = doc['textures'][index].get('source')
    if source is None:
        return 1.0
    a = np.asarray(Image.open(io.BytesIO(bytes(views[doc['images'][source]['bufferView']])))
                   .convert('RGB'), dtype=np.float64)
    return float(a.mean() / 255.0)


def _texture_median(doc, views, name, window=None):
    """A texture's own colour, from the body of the image.

    `window` narrows it by brightness. The iris needs that: half its area is a
    near-black pupil and a white catchlight, and a median over all of it
    describes neither.
    """
    import io
    for image in doc.get('images', ()):
        if image.get('name') != name:
            continue
        a = np.asarray(Image.open(io.BytesIO(bytes(views[image['bufferView']])))
                       .convert('RGBA'), dtype=np.float64)
        px = a[..., :3][a[..., 3] > 200]
        if window is not None:
            keep = (px.mean(axis=1) > window[0]) & (px.mean(axis=1) < window[1])
            if keep.sum() > 100:
                px = px[keep]
        return np.median(px, axis=0)
    return None


def colours(model):
    doc, binary = glb.load(model)
    views = glb.views_of(doc, binary)
    # A factor times its texture, not the factor alone. This is what the
    # renderer and three-vrm both do, so it is what the material's colour on
    # screen actually is. It moves one number the wrong way and that is not a
    # regression to hide: Mellow_Outer's map is real dark cloth rather than a
    # shading ramp, so folding it in gives (8,8,9), and a chroma ΔE on a colour
    # with almost no chroma left is noise. Its lightness ΔE is the number to
    # read there. Two materials now put
    # their shading in a generated greyscale map and their colour in the factor,
    # and reading the factor by itself reports a colour nothing on screen has:
    # the crown's went from ΔE 3.8 to 8.3 the moment it grew a texture, with no
    # change to a single pixel.
    factor = {}
    for m in doc.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        if not pbr.get('baseColorFactor'):
            continue
        rgb = np.array(pbr['baseColorFactor'][:3]) * 255
        tex = pbr.get('baseColorTexture', {}).get('index')
        if tex is not None:
            rgb = rgb * _texture_mean(doc, views, tex)
        factor[m.get('name')] = rgb

    rows = []
    for label, material, sheet, (x0, y0, x1, y1), texture in SAMPLES:
        patch = _sheet(sheet)[y0:y1, x0:x1].reshape(-1, 3)
        if texture == 'F00_000_00_EyeIris_00':
            patch = patch[(patch.mean(axis=1) > 60) & (patch.mean(axis=1) < 215)]
        ref = np.median(patch, axis=0)
        got = (factor.get(material) if material else
               _texture_median(doc, views, texture,
                               (60, 215) if 'Iris' in (texture or '') else None))
        d = (None, None) if got is None else delta_e(ref, got)
        rows.append((label, material or texture, ref, got, d[0], d[1],
                     float(patch.std(axis=0).mean())))
    return rows


def landmarks(model):
    """Seven heights off the model's own geometry, as a fraction of its height.

    Taken from the silhouette, not from bones, because that is what the
    reference sheet shows. A hip BONE sits well above the crotch and comparing
    the two would report a difference that is not there.
    """
    doc, binary = glb.load(model)
    views = glb.views_of(doc, binary)
    seen, pts = set(), []
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            a = pr['attributes']['POSITION']
            if a in seen:
                continue
            seen.add(a)
            pts.append(glb.read_accessor(doc, views, a).astype(np.float64))
    every = np.vstack(pts)
    sole, crown = float(every[:, 1].min()), float(every[:, 1].max())

    import json
    parts = json.load(open(model.replace('.vrm', '.parts.json')))['parts']

    def part_points(name):
        info = parts[name]
        mesh = next(m for m in doc['meshes'] if m.get('name') == info['mesh'])
        return np.vstack([glb.read_accessor(
            doc, views, mesh['primitives'][i]['attributes']['POSITION']).astype(np.float64)
            for i in info['primitives']])

    face = part_points('Face')
    body = part_points('Body_Skin')
    chin = float(face[np.abs(face[:, 0]) < 0.012][:, 1].min())

    # Shoulder: where the body first reaches most of its widest half-span.
    heights = np.linspace(1.10, 1.30, 60)
    span = np.array([np.abs(body[np.abs(body[:, 1] - h) < 0.006][:, 0]).max()
                     if (np.abs(body[:, 1] - h) < 0.006).sum() else 0.0 for h in heights])
    shoulder = float(heights[int(np.argmax(span))])

    # Waist: the narrowest torso ring between the bust and the hips.
    heights = np.linspace(0.90, 1.10, 60)
    span = np.array([np.abs(body[(np.abs(body[:, 1] - h) < 0.006)
                                 & (np.abs(body[:, 2]) < 0.30)][:, 0]).max()
                     if (np.abs(body[:, 1] - h) < 0.006).sum() else 9.0 for h in heights])
    waist = float(heights[int(np.argmin(span))])

    # Crotch: the lowest height at which the legs are still one mass.
    #
    # The band has to be wide enough to catch something. VRoid rings the leg
    # about every 40mm, so a +/-5mm slice is empty at most heights and the first
    # version of this loop stopped at the first gap in the SAMPLING and reported
    # the crotch 0.12 of a body-height too high, above the hip bone. The band is
    # now +/-20mm and a height only counts once it has vertices to speak for it.
    # The test is the distance from the axis to the nearest vertex: it is exactly
    # zero everywhere the two thighs still share a surface and steps to 8.7mm at
    # the height they part. A fixed 25mm threshold, tried second, never fired --
    # the inner thighs stay inside 25mm of centre well past the crotch.
    crotch = 0.0
    for h in np.linspace(0.95, 0.55, 200):
        band = body[np.abs(body[:, 1] - h) < 0.020]
        if len(band) < 20:
            continue
        if float(np.abs(band[:, 0]).min()) > 0.004:
            crotch = float(h)
            break

    bones = {b['bone']: b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']}
    import render
    world = render.world_matrices(doc)
    knee = float(world[bones['leftLowerLeg']][1, 3])
    ankle = float(world[bones['leftFoot']][1, 3])

    mine = {'頭頂': crown, '下巴': chin, '肩': shoulder, '腰': waist,
            '胯': crotch, '膝': knee, '踝': ankle}
    return {k: (v - sole) / (crown - sole) for k, v in mine.items()}, sole, crown


if __name__ == '__main__':
    model = os.path.join(BASE, 'out', 'mika-milfy.vrm')

    print('顏色：官方參考圖取樣 vs 模型（CIE76 ΔE，1 約等於肉眼可辨的最小差）')
    worst = 0.0
    for label, source, ref, got, d, dc, spread in colours(model):
        r = f'({ref[0]:3.0f},{ref[1]:3.0f},{ref[2]:3.0f})'
        g = '-' if got is None else f'({got[0]:3.0f},{got[1]:3.0f},{got[2]:3.0f})'
        print(f'  {label:<3} {source:<22} 參考 {r}  模型 {g}  '
              f'ΔE {d:5.1f}  去亮度 {dc:5.1f}  取樣區內色差 {spread:4.1f}')
        worst = max(worst, dc or 0.0)
    print(f'  {len(SAMPLES)} 個取樣點最差去亮度 ΔE {worst:.1f}')

    print('\n服裝材質（換裝後參考圖無對應，只記錄選色）')
    doc, _ = glb.load(model)
    factors = {m.get('name'): m['pbrMetallicRoughness']['baseColorFactor']
               for m in doc.get('materials', [])
               if m.get('pbrMetallicRoughness', {}).get('baseColorFactor')}
    for name in GARMENT:
        f = factors.get(name)
        if f:
            print(f'  {name:<18} ({f[0] * 255:3.0f},{f[1] * 255:3.0f},{f[2] * 255:3.0f})')

    print('\n關鍵點高度比例（0 = 腳底，1 = 頭頂）')
    ratios, sole, crown = landmarks(model)
    gap = 0.0
    for name, y in REFERENCE.items():
        want = (REF_SOLE - y) / (REF_SOLE - REFERENCE['頭頂'])
        got = ratios[name]
        gap = max(gap, abs(got - want))
        print(f'  {name:<4} 參考 {want:6.3f}   模型 {got:6.3f}   差 {got - want:+6.3f}')
    print(f'  七點最大差 {gap:.3f}（參考值以 64px 網格目視讀出，約 ±0.011）')
    print(f'  全高 {crown - sole:.4f} m')

    if '--time' in sys.argv:
        print('\n每步耗時')
        t0 = time.time()
        out = subprocess.run([sys.executable, 'make.py'], cwd=BASE,
                             capture_output=True, text=True)
        title = None
        for line in out.stdout.splitlines():
            if line[:2] in ('0.', '1.', '2.', '3.', '4.', '5.', '6.'):
                title = line.strip()
            elif line.strip().startswith('(') and title:
                print(f'  {title:<44} {line.strip()}')
                title = None
        print(f'  總計 {time.time() - t0:.1f}s')
