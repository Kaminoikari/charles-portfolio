#!/usr/bin/env python3
"""Old hair labels against body-relative ones, primitive by primitive.

hair_name places a strand with four numbers measured on Mika: below the waist
at y 0.90, in front of the face at z -0.03, above y 1.44 for the back of the
head, and further from the midline than 0.12. Each has a candidate read off
this body instead:

    waist    hips bone                       Mika 0.878 against 0.90
    front    leftEye bone, along forward_z   Mika -0.025 against -0.03
    crown    halfway from the eyes to the    Mika 1.440 against 1.44
             top of the face mesh
    midline  the face mesh's own half-width  Mika 0.092 against 0.12

Printed per body: every strand primitive whose label differs, and a count.
Mika's must be zero or the shipped model changes.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import numpy as np                                            # noqa: E402
import glb                                                    # noqa: E402
import partition                                              # noqa: E402
import pose                                                   # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]


def frame(doc, views):
    return partition.hair_frame(doc, views)


def absolute(material, centroid, ymin):
    """hair_name as it stood at 7a5d52a, with Mika's four numbers written in.

    Carried here rather than called, because the point of this probe is to
    compare the two and the committed one no longer takes this shape.
    """
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


def relative(material, centroid, ymin, f):
    """The committed rule, which reads every number off this body."""
    return partition.hair_name(material, centroid, ymin, f)


def main():
    for path in sorted(ROOT.glob('public/avatar/*.vrm')):
        doc, binary = glb.load(str(path))
        if partition.recognise(doc):
            continue
        views = glb.views_of(doc, binary)
        f = frame(doc, views)
        rest = pose.skinned(doc, views)
        mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
        moved, total = [], 0
        for mesh in doc['meshes']:
            for i, prim in enumerate(mesh['primitives']):
                material = mats[prim['material']]
                if not partition.is_strand(material):
                    continue
                total += 1
                used = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
                p = rest[(mesh.get('name'), i)][used]
                c, ymin = p.mean(axis=0), p[:, 1].min()
                was = absolute(material, c, ymin)
                now = relative(material, c, ymin, f)
                if was != now:
                    moved.append((mesh.get('name'), i, material, c, ymin, was, now))
        print(f'\n{path.name}  {total} strands, {len(moved)} move   '
              f'waist {f["waist"]:.3f} front {f["front"]:+.3f} '
              f'crown {f["crown"]:.3f} midline {f["midline"]:.3f}')
        for mesh, i, material, c, ymin, was, now in moved[:12]:
            print(f'   {mesh}#{i:<3} {material:<28} '
                  f'c ({c[0]:+.3f},{c[1]:.3f},{c[2]:+.3f}) ymin {ymin:.3f}  '
                  f'{was} -> {now}')
        if len(moved) > 12:
            print(f'   ... and {len(moved) - 12} more')


if __name__ == '__main__':
    main()
