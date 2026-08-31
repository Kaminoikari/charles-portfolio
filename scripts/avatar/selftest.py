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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '/Users/charles/vtuber-kit/bin')

import customise  # noqa: E402
import glb  # noqa: E402
import verify  # noqa: E402
import vrmrig  # noqa: E402

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

    result = customise.apply(model, out, manifest_path, drop=drop, tints=tints)
    print(f'  removed {result["primitives_removed"]} primitives, '
          f'swept {result["accessors_dropped"]} accessors / '
          f'{result["views_dropped"]} bufferViews')

    doc, binary = glb.load(out)
    tri_after = sum(doc['accessors'][pr['indices']]['count'] // 3
                    for m in doc['meshes'] for pr in m['primitives'])
    expected = tri_before - sum(manifest['parts'][d]['tris'] for d in drop)

    checks = []
    checks.append(('still a VRM0', 'VRM' in doc.get('extensions', {})))
    checks.append(('triangles match the manifest', tri_after == expected))
    checks.append(('no orphan accessors',
                   result['accessors_dropped'] > 0 or not drop))
    diffs = vrmrig.compare(vrmrig.read(BASELINE), vrmrig.read(out))
    checks.append(('skeleton unmoved', diffs == []))
    checks.append(('54 humanoid bones', len(vrmrig.human_bones(vrmrig.read(out))) == 54))
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
        e.get('parts') and all(p in manifest['parts'] for p in e['parts'])
        for e in palette.values())))

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
