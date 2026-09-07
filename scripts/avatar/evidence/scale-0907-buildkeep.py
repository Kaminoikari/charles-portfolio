"""One full build of the shipped recipe, kept at the path given. Nothing is published.

    python3 scripts/avatar/evidence/scale-0907-buildkeep.py <dst.vrm>

Same redirection as scale-0907-build.py (make.OUT and make.SHIPPED into scratch,
the scratch publish deleted), but it copies out/mika-milfy.vrm to `dst` first so
the result can be compared vertex by vertex.
"""
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import make  # noqa: E402

AV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(os.path.dirname(os.path.dirname(AV)), 'public', 'avatar')
BASELINE = os.path.join(AV, 'baseline.vrm')


def main():
    dst = sys.argv[1]
    out = tempfile.mkdtemp(prefix='buildkeep-')
    os.makedirs(os.path.join(out, 'blender'), exist_ok=True)
    for name in os.listdir(os.path.join(AV, 'out', 'blender')):
        if name.endswith('.glb'):
            shutil.copy2(os.path.join(AV, 'out', 'blender', name),
                         os.path.join(out, 'blender', name))
    make.OUT = out
    make.BLENDER = None
    make.SHIPPED = 'scratch-buildkeep.vrm'
    published = [os.path.join(PUBLIC, make.SHIPPED),
                 os.path.join(PUBLIC, make.SHIPPED.replace('.vrm', '.parts.json'))]
    try:
        make.main(base=BASELINE)
        shutil.copy2(os.path.join(out, 'mika-milfy.vrm'), dst)
    finally:
        for path in published:
            if os.path.exists(path):
                os.remove(path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
