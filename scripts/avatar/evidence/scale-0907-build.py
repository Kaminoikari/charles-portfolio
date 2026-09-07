"""The whole build, on a body 25% larger than the one it was written for.

    python3 scripts/avatar/evidence/scale-0907-build.py [factor]

The landmark derivations are scale-invariant as of 2026-09-07, but nothing had
ever asked the CONTENT steps -- strip, repaint, proportion, fit the purchased
outfit, skin it, health-check it -- to work on a body of another size. Seed-san
could not ask: partition refuses it, by design. A scaled copy of our own base
body can, because it is the same VRoid export at another size.

It runs make.main() itself rather than repeating its sequence here, so what is
exercised is the shipped pipeline in the shipped order. Two module globals are
redirected first:

  make.OUT      a scratch directory, so scripts/avatar/out is left alone
  make.SHIPPED  a scratch filename, and the file is deleted afterwards, so the
                shipped mika-milfy-12.vrm is never written

Blender is switched off and its existing output copied in: the garment .glb
files are fixed-size assets that do not depend on the body, and re-exporting
them would only add ten minutes of the same bytes.
"""
import os
import shutil
import sys
import tempfile
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import make          # noqa: E402
import scalebody     # noqa: E402

AV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(os.path.dirname(os.path.dirname(AV)), 'public', 'avatar')
BASE = os.path.join(PUBLIC, 'mika-pink.vrm')


def main():
    factor = float(sys.argv[1]) if len(sys.argv) > 1 else 1.25
    work = tempfile.mkdtemp(prefix='scale-build-')
    scaled = os.path.join(work, f'base-x{factor}.vrm')
    counts, _ = scalebody.apply(BASE, scaled, factor)
    lo, hi = scalebody.height(scaled)
    olo, ohi = scalebody.height(BASE)
    print(f'base   {os.path.basename(BASE)}  height {ohi - olo:.4f}')
    print(f'scaled x{factor}  height {hi - lo:.4f}  '
          f'({sum(counts.values())} things moved)')
    print()

    out = os.path.join(work, 'out')
    os.makedirs(os.path.join(out, 'blender'), exist_ok=True)
    kept = 0
    for name in os.listdir(os.path.join(AV, 'out', 'blender')):
        if name.endswith('.glb'):
            shutil.copy2(os.path.join(AV, 'out', 'blender', name),
                         os.path.join(out, 'blender', name))
            kept += 1
    print(f'reusing {kept} Blender exports; the garments are fixed-size assets')
    print()

    make.OUT = out
    make.BLENDER = None
    make.SHIPPED = f'scratch-scale-{factor}.vrm'
    published = [os.path.join(PUBLIC, make.SHIPPED),
                 os.path.join(PUBLIC, make.SHIPPED.replace('.vrm', '.parts.json'))]
    try:
        make.main(base=scaled)
        print('\nthe whole pipeline ran on a body of another size.')
        status = 0
    except SystemExit as exc:
        print(f'\nSTOPPED: {exc}')
        traceback.print_exc()
        status = 1
    except Exception:                       # noqa: BLE001 - the point is to see it
        print('\nRAISED:')
        traceback.print_exc()
        status = 1
    finally:
        # Nothing about this run belongs in public/avatar. Only files this run
        # could have created are removed, and only if they exist.
        for path in published:
            if os.path.exists(path):
                os.remove(path)
                print(f'removed {path}')
    return status


if __name__ == '__main__':
    sys.exit(main())
