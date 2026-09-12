#!/usr/bin/env python3
"""Which bodies partition names once two meshes may claim one part name.

Before this, a name claimed by two meshes was a refusal: the manifest keys
parts by name, so the second mesh would have replaced the first in silence.
vroid-studio-dressup stopped there on two names at once, `Body_Skin` and
`Outfit_Shoes`. resolve_clashes gives the plain name to the claim reaching
furthest vertically and numbers the rest.

Printed per body: refused or named, and every claim on a name more than one
mesh wanted, with the reach that decided it.

    python3 scripts/avatar/evidence/partition-0912-clashes.py
"""
import collections
import os
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import glb                                                    # noqa: E402
import partition                                              # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BODIES = sorted(ROOT.glob('public/avatar/*.vrm')) + \
    sorted((ROOT / 'scripts/avatar/bodies').glob('*.vrm'))


def main():
    out = tempfile.mkdtemp()
    named = 0
    for path in BODIES:
        print(f'\n{path.name}')
        # resolve_clashes is called inside partition(); wrap it to record what
        # it was asked, so the reach that decided each name is on the record
        # rather than re-derived here.
        seen = []
        real = partition.resolve_clashes

        def spy(claims, _real=real, _seen=seen):
            names = _real(claims)
            _seen.append((claims, names))
            return names

        partition.resolve_clashes = spy
        try:
            manifest, _ = partition.partition(
                str(path), os.path.join(out, 'o.vrm'), os.path.join(out, 'p.json'))
        except SystemExit as refusal:
            print('   REFUSED')
            for line in str(refusal).splitlines():
                if line.strip().startswith('-'):
                    print(f'   {line.strip()}')
            continue
        finally:
            partition.resolve_clashes = real
        named += 1
        claims, names = seen[-1]
        wanted = collections.Counter(c['label'] for c in claims)
        print(f'   named, {len(manifest["parts"])} parts')
        for label, count in wanted.items():
            if count == 1:
                continue
            print(f'   CLASH {label} wanted by {count}')
            for claim, name in zip(claims, names):
                if claim['label'] != label:
                    continue
                mesh = next(m for m, p in manifest['parts'].items() if m == name)
                print(f'      reach {claim["extent"]:.4f} m  -> {name}'
                      f'  ({manifest["parts"][mesh]["mesh"]}, '
                      f'{manifest["parts"][mesh]["tris"]} tris)')
    print(f'\n{named} of {len(BODIES)} named')


if __name__ == '__main__':
    main()
