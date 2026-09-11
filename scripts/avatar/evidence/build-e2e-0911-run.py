"""Run one tree's build() on the scratch inputs and record what it produced."""
import hashlib, json, os, shutil, sys
tree, out, tag = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, tree)
os.chdir(tree)
import build

dst = os.path.join(out, f'{tag}.vrm')
man = os.path.join(out, f'{tag}.parts.json')
# build() looks for the converted garments beside dst. They come from this
# repo's own scripts/avatar/out/blender, located from THIS file rather than from
# `out` or from `tree`: `tree` may be a git archive of an older commit, which has
# no out/ at all (it is ignored), and an earlier version reached for
# os.path.join(out, '..', 'out', 'blender'), which collapses onto out/blender
# itself whenever the scratch directory happens to be named `out`.
GARMENTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'blender')
if not os.path.exists(os.path.join(out, 'blender')):
    shutil.copytree(GARMENTS, os.path.join(out, 'blender'))
added, size, lm = build.build(os.path.join(out, 'proportioned.vrm'), dst,
                              os.path.join(out, 'parts.json'), man)
print(json.dumps({'tag': tag, 'added': sorted(added), 'size': size,
                  'landmarks': {k: round(float(v), 9) for k, v in lm.items()},
                  'manifest_sha256': hashlib.sha256(open(man, 'rb').read()).hexdigest()},
                 ensure_ascii=False, indent=2, sort_keys=True))
