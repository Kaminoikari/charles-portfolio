#!/usr/bin/env python3
"""What CLIP_DECALS costs on bodies it was not measured on.

HAIR_03 and HAIR_05 are Mika's base model's painted hair clips, and the rule
that reads them is the one thing left in partition that is measured on her
rather than on the body in hand. On another body those two material variants
are ordinary strands, and any of them sitting in front of the eyes is binned as
an accessory and then deleted with the outfit, because mellowheart.REPLACES
empties the Acc_ prefix.

Printed per body: how many strands the rule claims, before and after the frame
became body-relative, and the triangle counts of both groups, because triangle
count is the obvious candidate for telling a decal from a strand and it does
not separate them.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import numpy as np                                            # noqa: E402
import glb                                                    # noqa: E402
import partition                                              # noqa: E402
import pose                                                   # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]


def absolute(material, centroid, ymin):
    """hair_name as it stood at 7a5d52a, with Mika's four numbers written in."""
    if material.endswith('HAIR_06'):
        return 'Acc_HairOrnament'
    if ymin < 0.90:
        return 'Hair_Twintail_L' if centroid[0] < 0 else 'Hair_Twintail_R'
    if centroid[2] < -0.03:
        return ('Acc_HairClip_Base' if material.endswith(partition.CLIP_DECALS)
                else 'Hair_Bangs')
    if material.endswith(partition.CLIP_DECALS) and abs(centroid[0]) > 0.12:
        return 'Acc_HairOrnament'
    if centroid[1] > 1.44:
        return 'Hair_Back'
    return 'Hair_Side_L' if centroid[0] < 0 else 'Hair_Side_R'


def main():
    print(f'{"body":<28} {"strands":>7} {"Acc before":>10} {"Acc after":>9}   '
          f'{"clip tris":>18}   {"strand tris":>18}')
    for path in sorted(ROOT.glob('public/avatar/*.vrm')):
        doc, binary = glb.load(str(path))
        if partition.recognise(doc):
            continue
        views = glb.views_of(doc, binary)
        frame, rest = partition.hair_frame(doc, views), pose.skinned(doc, views)
        mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
        n, before, after, clip, strand = 0, 0, 0, [], []
        for mesh in doc['meshes']:
            for i, prim in enumerate(mesh['primitives']):
                material = mats[prim['material']]
                if not partition.is_strand(material):
                    continue
                n += 1
                idx = glb.read_accessor(doc, views, prim['indices']).ravel()
                p = rest[(mesh.get('name'), i)][np.unique(idx)]
                c, ymin = p.mean(axis=0), p[:, 1].min()
                was = absolute(material, c, ymin)
                now = partition.hair_name(material, c, ymin, frame)
                before += was.startswith('Acc_')
                after += now.startswith('Acc_')
                (clip if now.startswith('Acc_') else strand).append(len(idx) // 3)
        span = (lambda v: f'{min(v)}..{max(v)} ({len(v)})' if v else '-')
        print(f'{path.name:<28} {n:>7} {before:>10} {after:>9}   '
              f'{span(clip):>18}   {span(strand):>18}')


if __name__ == '__main__':
    main()
