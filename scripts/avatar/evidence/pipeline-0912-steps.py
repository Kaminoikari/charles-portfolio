"""How far make.py's steps get on bodies other than the one they were written on.

Steps 0b, 1, 2 and 3 are driven directly rather than through make.main(), so
that the run stops where the pipeline stops instead of at the first gate, and
so that it writes nothing into the repo. Step 4 onwards needs the Blender
parts, which is a separate question from whether a strange body can be undressed.

    python3 scripts/avatar/evidence/pipeline-0912-steps.py
"""
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import customise   # noqa: E402
import partition   # noqa: E402
import skin        # noqa: E402
import vrm1to0     # noqa: E402
from outfits import mellowheart  # noqa: E402

BODIES = ('AvatarSample_C_webp.vrm', 'Vivi_webp.vrm',
          'Sendagaya_Shibu_webp.vrm', 'Darkness_Shibu_webp.vrm',
          'HairSample_Female_webp.vrm', 'mika-pink.vrm',
          'vrm1-twist-sample.vrm', 'vroid-studio-dressup.vrm')

for name in BODIES:
    src = os.path.join(HERE, '..', '..', '..', 'public', 'avatar', name)
    if not os.path.exists(src):
        print(f'{name}: 不在')
        continue
    scratch = tempfile.mkdtemp()

    def p(filename):
        return os.path.join(scratch, filename)

    print('=' * 66)
    print(name)
    try:
        base = vrm1to0.ensure_vrm0(src, p('base-vrm0.vrm'))
        manifest, _ = partition.partition(base, p('parted.vrm'), p('parts.json'))
        print(f'  1 partition ok  {len(manifest["parts"])} parts: '
              f'{", ".join(sorted(manifest["parts"]))}')
    except SystemExit as stop:
        print(f'  1 partition STOPPED: {str(stop)[:160]}')
        continue
    try:
        drop = customise.replaced(manifest, mellowheart.REPLACES)
        result = customise.apply(p('parted.vrm'), p('stripped.vrm'), p('parts.json'),
                                 drop=drop, manifest_out=p('parts.json'))
        print(f'  2 strip     ok  {result["primitives_removed"]} primitives removed, '
              f'replacing {", ".join(drop)}')
    except SystemExit as stop:
        print(f'  2 strip     STOPPED: {str(stop)[:160]}')
        continue
    try:
        share, _ = skin.apply(p('stripped.vrm'), p('bare.vrm'))
        print(f'  3 skin      ok  repainted {share * 100:.1f}%')
    except Exception as stop:                     # noqa: BLE001 - report, not handle
        print(f'  3 skin      STOPPED: {type(stop).__name__}: {str(stop)[:160]}')
