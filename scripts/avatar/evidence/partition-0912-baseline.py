#!/usr/bin/env python3
"""The regression pin, as a number rather than as a sentence.

Every stage of this plan claims Mika's base body comes out of partition
unchanged. This prints what it actually comes out as, so the claim has a
receipt instead of a commit message.

The three values it prints are the ones stage 0 recorded: the VRM's sha256, its
size, and the sha256 of the parts.json beside it.
"""
import hashlib
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import make                                                   # noqa: E402
import partition                                              # noqa: E402

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


if __name__ == '__main__':
    main()
