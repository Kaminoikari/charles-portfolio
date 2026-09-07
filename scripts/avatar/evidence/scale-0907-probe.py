"""Which of the pipeline's landmarks follow the body's size, and which are lengths in metres.

    python3 scripts/avatar/evidence/scale-0907-probe.py

The plan's fixture list asks for a second body at least 10% away in height,
because a constant that is secretly a length cannot be distinguished from a
derived landmark while every body it meets is the same size. Seed-san came out
0.1% taller than ours, so that dimension stayed open. `scalebody.py` closes it
synthetically: the same body, the same topology, at 0.8x and 1.25x.

A derivation that describes the body should return exactly k times its base
value on a body scaled by k. This runs each one on all three bodies and prints
the ratio. 1.000000 means it followed the body. Anything else is a constant.

It drives the real entry points -- partition, garment.body_pool, build.landmarks,
build.torso_edges, proportion.chin_height, envelope.heights -- rather than
re-deriving anything here, so what it reports is what make.py would get.
"""
import os
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import build            # noqa: E402
import envelope         # noqa: E402
import garment          # noqa: E402
import glb              # noqa: E402
import partition        # noqa: E402
import proportion       # noqa: E402
import scalebody        # noqa: E402

AV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(os.path.dirname(os.path.dirname(AV)), 'public', 'avatar', 'mika-pink.vrm')
FACTORS = [0.8, 1.25]


def measure(path, work):
    """Every landmark the pipeline derives for one body, through its real entry points."""
    parted = os.path.join(work, 'parted.vrm')
    parts = os.path.join(work, 'parts.json')
    manifest, _ = partition.partition(path, parted, parts)
    doc, binary = glb.load(parted)
    views = glb.views_of(doc, binary)
    pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
    lm = build.landmarks(pool, doc)
    out = {f'landmarks.{k}': float(v) for k, v in lm.items()}
    out.update({f'torso_edges.{k}': float(v) for k, v in build.torso_edges(lm).items()})
    out['proportion.chin_height'] = float(proportion.chin_height(doc, views))
    h = envelope.heights(doc)
    out['envelope.heights[0]'] = float(h[0])
    out['envelope.heights[-1]'] = float(h[-1])
    out['envelope.heights.span'] = float(h[-1] - h[0])
    out['envelope.heights.count'] = float(len(h))
    return out


def main():
    with tempfile.TemporaryDirectory() as work:
        lo, hi = scalebody.height(BASE)
        print(f'base {os.path.basename(BASE)}  height {hi - lo:.4f}')
        base = measure(BASE, work)

        scaled = {}
        for k in FACTORS:
            dst = os.path.join(work, f'scaled-{k}.vrm')
            counts, _ = scalebody.apply(BASE, dst, k)
            slo, shi = scalebody.height(dst)
            got = (shi - slo) / (hi - lo)
            print(f'x{k}: height {shi - slo:.4f} (x{got:.6f}), '
                  f'{sum(counts.values())} things moved')
            assert abs(got - k) < 1e-6, f'the scaler did not scale: asked {k}, got {got}'
            scaled[k] = measure(dst, os.path.join(work, str(k)) if False else work)

        width = max(len(n) for n in base)
        print()
        print(f'{"landmark".ljust(width)}  {"base":>10}  ' +
              '  '.join(f'{("x" + str(k)):>10} {"ratio":>9}' for k in FACTORS))
        verdicts = {}
        for name, b in base.items():
            row = f'{name.ljust(width)}  {b:>10.6f}  '
            follows = True
            for k in FACTORS:
                s = scaled[k][name]
                # A landmark at height 0 (the feet) scales trivially; report the
                # difference instead of a ratio so it cannot read as a pass.
                ratio = s / (b * k) if abs(b) > 1e-9 else float('nan')
                row += f'{s:>10.6f} {ratio:>9.6f}  '
                if not (abs(b) > 1e-9 and abs(ratio - 1.0) < 1e-4):
                    follows = False
            verdicts[name] = follows
            print(row + ('' if follows else '   <<< does NOT follow the body'))

        print()
        bad = [n for n, ok in verdicts.items() if not ok]
        print(f'{len(verdicts) - len(bad)} of {len(verdicts)} follow the body exactly.')
        for n in bad:
            print(f'  carries a length: {n}')
        return 0


if __name__ == '__main__':
    sys.exit(main())
