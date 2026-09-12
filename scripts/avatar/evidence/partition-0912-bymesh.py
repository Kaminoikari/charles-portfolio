#!/usr/bin/env python3
"""Run the real partition() on every local body, now that mesh names are gone.

Prints the refusal reasons for the bodies it still turns away and the parts it
writes for the rest, so the count of bodies this step can name is measured
rather than claimed.
"""
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import partition                                              # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BODIES = sorted(ROOT.glob('public/avatar/*.vrm'))


def main():
    named = 0
    for path in BODIES:
        out = tempfile.mkdtemp()
        try:
            m, _ = partition.partition(str(path), f'{out}/o.vrm', f'{out}/p.json')
        except SystemExit as refusal:
            print(f'{path.name:<30} REFUSED')
            for line in str(refusal).splitlines():
                print(f'      {line.strip()}')
            continue
        named += 1
        parts = sorted(m['parts'])
        print(f'{path.name:<30} {len(parts):>2} parts  {", ".join(parts)}')
    print(f'\n{named} of {len(BODIES)} named')


if __name__ == '__main__':
    main()
