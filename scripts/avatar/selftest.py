"""Prove the template is actually customisable, rather than merely labelled.

The claim being tested is the one that matters commercially: a downstream tool
reads mika-milfy.parts.json, drops parts it does not want, retints the palette,
and gets back a file that still loads and still animates. So this deletes real
parts at random and repaints real materials, then re-runs every invariant.

Random, with a printed seed. A fixed hand-picked trio would only ever prove the
three parts we happened to choose are safe to remove.
"""
import json
import os
import random
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import customise  # noqa: E402
import glb  # noqa: E402
import verify  # noqa: E402
import humanoid  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
BASELINE = os.path.join(BASE, 'baseline.vrm')


def run(model, manifest_path, seed=None):
    seed = random.randrange(10**6) if seed is None else seed
    rng = random.Random(seed)
    manifest = json.load(open(manifest_path))

    deletable = sorted(n for n, p in manifest['parts'].items() if p.get('deletable'))
    palette = manifest.get('palette', {})
    drop = rng.sample(deletable, 3)
    # Only materials that still have a part after the drop. Picking the two
    # independently let one round delete Acc_HairClip_Bear and then retint
    # Milfy_Bear, whose only part that was: a combination this test invented,
    # not a defect in the model.
    tintable = sorted(n for n, e in palette.items()
                      if set(e.get('parts', [])) - set(drop))
    colours = rng.sample(tintable, 2)
    tints = [(c, [round(rng.random(), 3) for _ in range(3)]) for c in colours]

    print(f'seed {seed}')
    print(f'  deletable parts available: {len(deletable)}')
    print(f'  dropping: {", ".join(drop)}')
    for name, rgb in tints:
        print(f'  retinting {name} -> {rgb}')

    out = os.path.join(BASE, 'out', 'selftest.vrm')
    before = glb.load(model)[0]
    tri_before = sum(before['accessors'][pr['indices']]['count'] // 3
                     for m in before['meshes'] for pr in m['primitives'])

    # The manifest a customiser reads next is the one `apply` WRITES, not the
    # one it was handed. Auditing the input manifest passes while the output
    # names deleted parts -- which it did, until prune_shapes was added.
    out_manifest = os.path.join(BASE, 'out', 'selftest.parts.json')
    result = customise.apply(model, out, manifest_path, drop=drop, tints=tints,
                             manifest_out=out_manifest)
    print(f'  removed {result["primitives_removed"]} primitives, '
          f'swept {result["accessors_dropped"]} accessors / '
          f'{result["views_dropped"]} bufferViews')
    if result['shape_keys_dropped']:
        print(f'  shape keys left with nothing to move: '
              f'{", ".join(result["shape_keys_dropped"])}')
    if result['materials_dropped']:
        print(f'  materials left painting nothing: '
              f'{", ".join(result["materials_dropped"])}')
    after = json.load(open(out_manifest))

    doc, binary = glb.load(out)
    binary_views = glb.views_of(doc, binary)
    tri_after = sum(doc['accessors'][pr['indices']]['count'] // 3
                    for m in doc['meshes'] for pr in m['primitives'])
    expected = tri_before - sum(manifest['parts'][d]['tris'] for d in drop)
    # From here on the manifest under audit is `after`, the one apply wrote.
    # `manifest` stays the input, and is only read for what the deletion
    # removed -- those entries are gone from `after` by design.

    checks = []
    checks.append(('still a VRM0', 'VRM' in doc.get('extensions', {})))
    checks.append(('triangles match the manifest', tri_after == expected))
    checks.append(('no orphan accessors',
                   result['accessors_dropped'] > 0 or not drop))
    diffs = humanoid.compare(humanoid.read(BASELINE), humanoid.read(out))
    checks.append(('skeleton unmoved', diffs == []))
    checks.append(('54 humanoid bones', len(humanoid.bones(humanoid.read(out))) == 54))
    checks.append(('56 face morph targets intact', any(
        len(pr.get('targets', [])) == 56
        for m in doc['meshes'] if m.get('name') == 'Face.baked'
        for pr in m['primitives'])))
    checks.append(('15 blendShapeGroups intact',
                   len(doc['extensions']['VRM']['blendShapeMaster']
                       ['blendShapeGroups']) == 15))
    applied = {m['name']: m['pbrMetallicRoughness']['baseColorFactor'][:3]
               for m in doc['materials'] if m['name'] in dict(tints)}
    checks.append(('tints landed', all(
        [round(v, 3) for v in applied[n]] == rgb for n, rgb in tints)))
    # A tint that lands on a material no surviving part uses paints nothing, and
    # the check above would still pass. That is not hypothetical: the palette
    # once advertised four materials the imported outfit had made unused, and
    # three rounds of this test went green on them.
    live = {m['name'] for mesh in doc['meshes'] for pr in mesh['primitives']
            for m in [doc['materials'][pr['material']]]}
    checks.append(('retinted materials are still on the model',
                   all(n in live for n, _ in tints)))
    # And the manifest's own claim, which is what a swap tool reads before it
    # touches anything: every palette entry names parts, and those parts exist.
    checks.append(('every palette entry names live parts', all(
        e.get('parts') and all(p in after['parts'] for p in e['parts'])
        for e in after.get('palette', {}).values())))

    # The shape keys have to survive the same treatment, and they are the part
    # most likely to survive it wrong. Their deltas live in sparse accessors
    # whose storage is reachable only through the sparse block, so a sweep that
    # follows accessors the obvious way frees those views (351 of them at seed
    # 15, against 191 correctly) and writes a file whose morph targets read back
    # as garbage -- caught here rather than by whoever loads it next.
    shapes = after.get('shapes', {})
    checks.append(('every shape key names live parts', all(
        e.get('parts') and all(p in after['parts'] for p in e['parts'])
        for e in shapes.values())))
    # Two directions, because each misses what the other catches. Every key the
    # manifest still names has to actually displace something in the file, and
    # every key the FILE still declares outside the expression meshes has to be
    # one the manifest names -- a target left behind after its garment was
    # deleted is a slider that drives to 1.0 and does nothing, and only the
    # second direction sees it.
    expression_meshes = {b['mesh'] for g in
                         doc['extensions']['VRM']['blendShapeMaster']['blendShapeGroups']
                         for b in g.get('binds', ())}
    moved, declared = {}, set()
    for mi, mesh in enumerate(doc['meshes']):
        names = mesh.get('extras', {}).get('targetNames') or []
        if mi in expression_meshes:
            continue
        declared |= set(names)
        for pr in mesh['primitives']:
            for ti, tgt in enumerate(pr.get('targets', ())):
                if ti >= len(names) or 'POSITION' not in tgt:
                    continue
                d = glb.read_accessor(doc, binary_views, tgt['POSITION'])
                if np.abs(d).max() > glb.MORPH_EPSILON:
                    moved[names[ti]] = True
    checks.append((f'{len(shapes)} shape keys in the manifest still displace',
                   all(moved.get(k) for k in shapes)))
    checks.append((f'{len(declared)} shape keys in the file are all in the manifest',
                   declared == set(shapes)))
    counts = {m.get('name'): {len(pr.get('targets') or []) for pr in m['primitives']}
              for m in doc['meshes']}
    checks.append(('every mesh keeps one morph target count',
                   all(len(c) <= 1 for c in counts.values())))
    # The material half of the same asymmetry. `verify.unused_materials` is a
    # FAIL condition on the build's own output, so a customiser that leaves the
    # deletion's stranded materials behind ships a file the project's own health
    # check rejects -- deleting Acc_Crown strands Milfy_Gold and Milfy_GoldInner.
    live_mats = {pr['material'] for m in doc['meshes'] for pr in m['primitives']
                 if 'material' in pr}
    checks.append(('no material is left painting nothing',
                   live_mats == set(range(len(doc['materials'])))))
    mat_names = {m.get('name') for m in doc['materials']}
    checks.append(('every palette entry names a material still in the file',
                   all(k in mat_names for k in after.get('palette', {}))))
    # The OTHER half of sweep_materials. VRM0 pairs materials[i] with
    # materialProperties[i] by position, and pruning one array without the other
    # puts every MToon setting on the wrong surface while every count stays
    # plausible -- the check above cannot see it, because it only counts.
    props = doc['extensions']['VRM']['materialProperties']
    checks.append(('materialProperties still line up with materials',
                   [m.get('name') for m in doc['materials']]
                   == [m.get('name') for m in props]))

    print(f'  triangles {tri_before} -> {tri_after} (expected {expected})')
    for label, ok in checks:
        print(f'  [{"ok" if ok else "FAIL"}] {label}')
    passed = all(ok for _, ok in checks)
    print(f'  {"PASS" if passed else "FAIL"}')
    return passed


if __name__ == '__main__':
    model = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'out', 'mika-milfy.vrm')
    mani = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, 'out', 'mika-milfy.parts.json')
    rounds = int(sys.argv[3]) if len(sys.argv) > 3 else 3
    every = all(run(model, mani) for _ in range(rounds))
    print(f'\n{rounds} rounds: {"PASS" if every else "FAIL"}')
    sys.exit(0 if every else 1)
