#!/usr/bin/env python3
"""Where hair_name's four numbers sit on each body's own skeleton.

hair_name places a strand with four absolute world coordinates measured on
Mika: below the waist at y 0.90, in front of the face at z -0.03, above y 1.44
for the back of the head, and further from the midline than 0.12. This prints,
for every body this step can name, the humanoid bones those numbers could be
expressed against, so a body-relative restatement is chosen from measurements
rather than from arithmetic on one body.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import numpy as np                                            # noqa: E402
import glb                                                    # noqa: E402
import humanoid                                               # noqa: E402
import partition                                              # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BONES = ('hips', 'spine', 'chest', 'neck', 'head', 'leftEye', 'leftShoulder')


def frame(doc):
    bones = humanoid.bones(doc)
    world = humanoid.rest_world(doc)
    out = {}
    for name in BONES:
        node = bones.get(name)
        if node is not None:
            out[name] = np.asarray(world[node])[:3, 3]
    return out


def main():
    print(f'{"body":<28} {"hips.y":>7} {"neck.y":>7} {"head.y":>7} '
          f'{"head.z":>7} {"eye.z":>7} {"shldr.x":>7}  hair y/z extent')
    for path in sorted(ROOT.glob('public/avatar/*.vrm')):
        doc, binary = glb.load(str(path))
        if partition.recognise(doc):
            continue
        views = glb.views_of(doc, binary)
        f = frame(doc)
        mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
        pts = []
        for mesh in doc['meshes']:
            for prim in mesh['primitives']:
                if not partition.is_strand(mats[prim['material']]):
                    continue
                pos = glb.read_accessor(doc, views, prim['attributes']['POSITION'])
                used = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
                pts.append(pos[used])
        p = np.concatenate(pts) if pts else np.zeros((1, 3))
        row = ' '.join(f'{f.get(b, [np.nan]*3)[i]:>7.3f}'
                       for b, i in (('hips', 1), ('neck', 1), ('head', 1),
                                    ('head', 2), ('leftEye', 2), ('leftShoulder', 0)))
        print(f'{path.name:<28} {row}  '
              f'y {p[:, 1].min():.3f}..{p[:, 1].max():.3f}  '
              f'z {p[:, 2].min():+.3f}..{p[:, 2].max():+.3f}  '
              f'x ±{np.abs(p[:, 0]).max():.3f}')


if __name__ == '__main__':
    main()
