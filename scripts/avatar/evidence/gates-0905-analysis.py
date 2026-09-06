#!/usr/bin/env python3
"""The analyses behind evidence/gates-0905.md, so their numbers can be
re-derived. Run from the repo root:

    git show 9c1faab:public/avatar/mika-milfy-10.vrm > /tmp/before.vrm
    python3 scripts/avatar/evidence/gates-0905-analysis.py /tmp/before.vrm \
        scripts/avatar/out/mika-milfy.vrm [out_dir]

`before` is the Phase 2 build (vertex sha 73cfb472ca1cb1c3), `after` the
Phase 3 build. Three sections:

  0. the joint landmarks build.landmarks now derives from the skeleton of
     out/proportioned.vrm, against the world numbers build() typed in until
     2026-09-05 (`hip, knee, ankle = 0.843, 0.501, 0.118`, `arm_r = 0.54`);
     the difference is the only geometry change Phase 3 makes;
  1. per-primitive vertex displacement between the two files (section 1 of
     restpose-0905-analysis.py, reused);
  2. the four renders with ONE framing (section 2 of the same script).
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
AVATAR = os.path.dirname(HERE)
sys.path.insert(0, AVATAR)

import build  # noqa: E402
import garment  # noqa: E402
import glb  # noqa: E402

spec = importlib.util.spec_from_file_location(
    'restpose_analysis', os.path.join(HERE, 'restpose-0905-analysis.py'))
restpose = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restpose)

TYPED = {'hip': 0.843, 'knee': 0.501, 'ankle': 0.118, 'hand_x': 0.54}


def landmarks():
    print('== 0. derived joint landmarks vs the typed world numbers ==')
    body = os.path.join(AVATAR, 'out', 'proportioned.vrm')
    manifest = json.load(open(os.path.join(AVATAR, 'out', 'parts.json')))
    doc, binary = glb.load(body)
    views = glb.views_of(doc, binary)
    pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
    lm = build.landmarks(pool, doc)
    for key, typed in TYPED.items():
        print(f'  {key:7s} derived {lm[key]:.6f}  typed {typed:.3f}  '
              f'delta {(lm[key] - typed) * 1000:+.3f}mm')
    for key in ('shoulder', 'neck', 'waist'):
        print(f'  {key:7s} derived {lm[key]:.6f}  (new, no typed counterpart)')
    print()


if __name__ == '__main__':
    before, after = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else '/tmp'
    landmarks()
    restpose.displacement(before, after)
    restpose.same_frame(before, after, out_dir)
