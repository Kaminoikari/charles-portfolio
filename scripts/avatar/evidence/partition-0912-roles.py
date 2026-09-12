#!/usr/bin/env python3
"""Would content-derived roles name every body the mesh names name, and more?

Proposed rules, all read off the exporter's own grammar rather than off a mesh
name:

  * the face mesh is the one carrying FACE materials (and it must carry morph
    targets, which is the reason it is locked);
  * HAIR whose part name is HairBack is one baked-in object, Hair_BodyBack;
  * HAIR whose part name is Hair is a strand and still needs geometry;
  * MATCAP is an accessory, Acc_<Part>.

Printed per body: whether exactly one mesh carries FACE, whether that mesh is
the only one with morph targets, every label the rules produce, and any label
two different meshes would both claim. A claim two meshes make was a refusal
when this ran, because the manifest is keyed by label and one part belongs to
one mesh; partition.resolve_clashes now renames instead, and what it does with
these same two clashes is in partition-0912-clashes.log.
"""
import collections
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import glb                                                    # noqa: E402
import partition                                              # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[3]
BODIES = sorted(ROOT.glob('public/avatar/*.vrm')) + \
    sorted((ROOT / 'scripts/avatar/bodies').glob('*.vrm'))


def label(part, category):
    if category == 'SKIN':
        return 'Body_Skin'
    if category == 'CLOTH':
        return partition.OUTFIT_NAMES.get(part, f'Outfit_{part}')
    if category == 'HAIR':
        return 'Hair_BodyBack' if part == 'HairBack' else '<strand>'
    if category == 'MATCAP':
        return f'Acc_{part}'
    return None


def main():
    for path in BODIES:
        doc, _ = glb.load(str(path))
        mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
        faces, morphed, claims, unnamed = [], [], collections.defaultdict(set), []
        for mesh in doc['meshes']:
            cats = set()
            for prim in mesh['primitives']:
                part, cat = partition.vroid_category(mats[prim.get('material', 0)])
                cats.add(cat)
            if any(p.get('targets') for p in mesh['primitives']):
                morphed.append(mesh.get('name'))
            if 'FACE' in cats:
                faces.append(mesh.get('name'))
                continue
            for prim in mesh['primitives']:
                part, cat = partition.vroid_category(mats[prim.get('material', 0)])
                name = label(part, cat)
                if name is None:
                    unnamed.append(mats[prim.get('material', 0)])
                else:
                    claims[name].add(mesh.get('name'))
        clashes = {n: sorted(m) for n, m in claims.items() if len(m) > 1}
        verdict = ('REFUSE' if len(faces) != 1 or unnamed or clashes else 'names')
        print(f'\n{path.name}  [{verdict}]')
        print(f'   face mesh: {faces}   morph-bearing: {morphed}')
        print(f'   labels: {", ".join(sorted(claims))}')
        if unnamed:
            print(f'   UNNAMED {len(unnamed)}: {", ".join(sorted(set(unnamed)))}')
        for n, m in clashes.items():
            print(f'   CLASH {n}: {m}')


if __name__ == '__main__':
    main()
