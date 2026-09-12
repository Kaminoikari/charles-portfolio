#!/usr/bin/env python3
"""What each mesh in every local body carries, so mesh NAME can stop being the
way Face and Body are found.

Face.baked and Body.baked are VRoid Studio's own names, and two of the sixteen
local bodies did not use them and stopped at partition. This is the measurement
that replaced them: which content-derived signal separates the same three roles.
The answer it gave is the material category grammar stage 0 already reads, with
the morph targets corroborating rather than deciding, because one body
(mika-milfy-12, this pipeline's own output) carries morphs on a second mesh.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import glb                                                    # noqa: E402
import partition                                              # noqa: E402

BODIES = sorted(pathlib.Path(__file__).resolve().parents[3].glob('public/avatar/*.vrm')) \
    + sorted(pathlib.Path(__file__).resolve().parents[2].glob('avatar/bodies/*.vrm'))


def main():
    for path in BODIES:
        doc, binary = glb.load(str(path))
        mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
        print(f'\n{path.name}')
        for mesh in doc['meshes']:
            prims = mesh['primitives']
            morphs = max((len(p.get('targets', ())) for p in prims), default=0)
            cats = []
            for p in prims:
                _, c = partition.vroid_category(mats[p.get('material', 0)])
                cats.append(c or '?')
            tally = {c: cats.count(c) for c in dict.fromkeys(cats)}
            spread = ' '.join(f'{c}x{n}' for c, n in sorted(tally.items()))
            print(f'   {str(mesh.get("name")):<40} {len(prims):>3} prim  '
                  f'{morphs:>3} morph  {spread}')


if __name__ == '__main__':
    main()
