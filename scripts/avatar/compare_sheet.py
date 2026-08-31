"""Put the render next to the reference it was built from.

Nothing here scores anything. The renders are orthographic and the references
are a phone camera in a VRChat world, so a pixel metric between them would be
measuring lens distortion. What this sheet is for is the judgement a person
makes in one glance: is the silhouette right, are the parts present, is the
colour in the same family.
"""
import os
import sys

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
REFS = os.path.expanduser('~/milfy-refs')

PAIRS = [
    ('front', 'out/final-front.png', 'ingame/07-front-fullbody-pair.png',
     'render: front', 'reference: in-game front'),
    ('back', 'out/final-back.png', 'ingame/06-back-fullbody-pair.png',
     'render: back', 'reference: in-game back'),
    ('quarter', 'out/final-three_quarter.png', 'official/front-back-with-cardigan.jpg',
     'render: three-quarter', 'reference: official front & back'),
    ('face', 'out/final-face.png', 'official/fronthair-type.jpg',
     'render: face', 'reference: official front hair'),
]

PANEL_H = 620
PAD = 18
LABEL_H = 26
BG = (247, 248, 246)
INK = (20, 33, 29)


def fit(img, height):
    w = int(img.width * height / img.height)
    return img.resize((w, height), Image.LANCZOS)


def build(out_path):
    rows = []
    for _, render_rel, ref_rel, lr, rr in PAIRS:
        a = Image.open(os.path.join(BASE, render_rel)).convert('RGB')
        b = Image.open(os.path.join(REFS, ref_rel)).convert('RGB')
        rows.append((fit(a, PANEL_H), fit(b, PANEL_H), lr, rr))

    width = max(a.width + b.width + PAD * 3 for a, b, _, _ in rows)
    height = sum(PANEL_H + LABEL_H + PAD for _ in rows) + PAD
    sheet = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(sheet)

    y = PAD
    for a, b, lr, rr in rows:
        sheet.paste(a, (PAD, y))
        sheet.paste(b, (PAD * 2 + a.width, y))
        draw.text((PAD, y + PANEL_H + 6), lr, fill=INK)
        draw.text((PAD * 2 + a.width, y + PANEL_H + 6), rr, fill=INK)
        y += PANEL_H + LABEL_H + PAD
    sheet.save(out_path)
    return out_path, sheet.size


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'out', 'compare.png')
    path, size = build(out)
    print(f'wrote {path} {size[0]}x{size[1]}')
