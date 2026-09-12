#!/usr/bin/env python3
"""Why hair_frame refuses to fall back to the head bone.

The eye bones are optional in the VRM spec, so a body without them passes the
skeleton gate and reaches hair_frame. Reading `left` and `front` off the head
bone instead looks harmless and is not: the head sits on the midline, so its x
is whatever the exporter's arithmetic left behind, and its z is a head's depth
away from the eyes.

Printed: the head bone's x on every local body, and what happens to Mika's own
strands if `left` is taken from it.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import numpy as np                                            # noqa: E402
import glb                                                    # noqa: E402
import humanoid                                               # noqa: E402
import partition                                              # noqa: E402
import pose                                                   # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BODY = ROOT / 'public/avatar/mika-pink.vrm'


def main():
    positive = 0
    total = 0
    print(f'{"body":<30} {"head.x":>14} {"eye.x":>10} {"head.z - eye.z":>16}')
    for path in sorted(ROOT.glob('public/avatar/*.vrm')):
        doc, _ = glb.load(str(path))
        bones, world = humanoid.bones(doc), humanoid.rest_world(doc)
        if 'head' not in bones or 'leftEye' not in bones:
            continue
        head = np.asarray(world[bones['head']])[:3, 3]
        eye = np.asarray(world[bones['leftEye']])[:3, 3]
        total += 1
        positive += head[0] > 0
        print(f'{path.name:<30} {head[0]:>14.3e} {eye[0]:>+10.4f} '
              f'{(head[2] - eye[2]) * 1000:>13.1f}mm')
    print(f'\nhead.x positive on {positive} of {total}')

    doc, binary = glb.load(str(BODY))
    views = glb.views_of(doc, binary)
    frame, rest = partition.hair_frame(doc, views), pose.skinned(doc, views)
    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
    bones, world = humanoid.bones(doc), humanoid.rest_world(doc)
    head = np.asarray(world[bones['head']])[:3, 3]
    # The two ways the old fallback went wrong: the side it picks, and where it
    # thinks the front of the face is. The fallback did both at once.
    variants = {'left only': dict(frame, left=1.0),
                'front only': dict(frame, front=float(head[2])),
                'the whole fallback': dict(frame, left=1.0, front=float(head[2]))}
    n, moved = 0, {k: 0 for k in variants}
    for mesh in doc['meshes']:
        for i, prim in enumerate(mesh['primitives']):
            material = mats[prim['material']]
            if not partition.is_strand(material):
                continue
            n += 1
            used = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
            p = rest[(mesh.get('name'), i)][used]
            c, ymin = p.mean(axis=0), p[:, 1].min()
            was = partition.hair_name(material, c, ymin, frame)
            for k, f in variants.items():
                moved[k] += was != partition.hair_name(material, c, ymin, f)
    print(f'\n{BODY.name}: reading the frame off the head bone instead of the '
          f'eye, out of {n} strands')
    for k, v in moved.items():
        print(f'   {k:<20} moves {v}')


if __name__ == '__main__':
    main()
