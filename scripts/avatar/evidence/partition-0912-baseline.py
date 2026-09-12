#!/usr/bin/env python3
"""The regression pin, as a number rather than as a sentence.

Every stage of this plan claims Mika's base body comes out of partition
unchanged. This prints what it actually comes out as, so the claim has a
receipt instead of a commit message: the VRM's sha256, its size, and the
sha256 of the parts.json beside it, which are the three values stage 0
recorded.

It also prints the hair frame at full precision, because the plan and the code
comments quote it to four decimal places and the per-body log rounds to three,
and it prints what a repeated mesh name does to that frame, which is the
measurement recognise()'s uniqueness check rests on.
"""
import copy
import hashlib
import pathlib
import sys
import tempfile

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import glb                                                    # noqa: E402
import make                                                   # noqa: E402
import partition                                              # noqa: E402
import pose                                                   # noqa: E402

STAGE_0 = {
    'vrm': '1d4e3a37d33d91d08b7f26c1edf82332a405ebc0a936ce80ad1936533896e8dd',
    'bytes': 6739132,
    'parts': '79aa95bd5956f2ff',      # the prefix the plan quotes
}


def main():
    out = pathlib.Path(tempfile.mkdtemp())
    manifest, size = partition.partition(
        make.BASELINE, str(out / 'parted.vrm'), str(out / 'parts.json'))
    vrm = hashlib.sha256((out / 'parted.vrm').read_bytes()).hexdigest()
    parts = hashlib.sha256((out / 'parts.json').read_bytes()).hexdigest()
    print(f'source     {make.BASELINE}')
    print(f'parted.vrm sha256 {vrm}')
    print(f'           bytes  {size}')
    print(f'parts.json sha256 {parts}')
    print(f'           parts  {len(manifest["parts"])}: '
          f'{", ".join(sorted(manifest["parts"]))}')
    print()
    print(f'stage 0 recorded  {STAGE_0["vrm"]} / {STAGE_0["bytes"]} bytes / '
          f'{STAGE_0["parts"]}...')
    ok = (vrm == STAGE_0['vrm'] and size == STAGE_0['bytes']
          and parts.startswith(STAGE_0['parts']))
    print('IDENTICAL' if ok else '*** CHANGED ***')

    doc, binary = glb.load(make.BASELINE)
    views = glb.views_of(doc, binary)
    frame = partition.hair_frame(doc, views)
    print()
    print('hair frame, full precision')
    for key in ('waist', 'front', 'crown', 'midline'):
        print(f'   {key:<8} {frame[key]!r}')
    print(f'   {"forward":<8} {frame["forward"]}')
    print(f'   {"left":<8} {frame["left"]}')

    # What recognise()'s mesh-name check is for. pose.skinned keys by name, so
    # collapsing the three names to one takes the face's own vertices out of
    # the frame and lets the hair answer instead.
    clashed = copy.deepcopy(doc)
    for mesh in clashed['meshes']:
        mesh['name'] = 'Merged'
    keys, collapsed = len(pose.skinned(doc, views)), pose.skinned(clashed, views)
    wrong = partition.hair_frame(clashed, glb.views_of(clashed, binary))
    print()
    print(f'with every mesh renamed to one name, and the check removed:')
    print(f'   pose.skinned keys  {keys} -> {len(collapsed)}')
    print(f'   midline            {frame["midline"]:.4f} -> {wrong["midline"]:.4f}')
    print(f'   crown              {frame["crown"]:.4f} -> {wrong["crown"]:.4f}')
    print(f'   refused            {bool(partition.recognise(clashed))}')


if __name__ == '__main__':
    main()
