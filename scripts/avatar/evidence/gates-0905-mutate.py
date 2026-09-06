#!/usr/bin/env python3
"""Phase 3 mutation receipts (gates, skins[0], --base, landmarks). Same harness
as mutate_phase2.py: byte-copy backup, pattern hit count must be 1, single
named test, __pycache__ removed after the write, byte-copy restore with
sha256 check."""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
AV = REPO / 'scripts' / 'avatar'

PY = lambda *tests: ['python3', '-W', 'ignore', '-m', 'unittest', '-q', *tests]  # noqa: E731
GATE = 'scripts.avatar.gate_test.Gate.'
VREP = 'scripts.avatar.verify_test.Report.'
VDANG = 'scripts.avatar.verify_test.DanglingJoints.'
SELF = 'scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.'
POSE = 'scripts.avatar.pose_test.OwnSkin.'
WIRE = 'scripts.avatar.humanoid_test.Wiring.'
REST = 'scripts.avatar.outfit_test.RestPose.'
BLD = 'scripts.avatar.build_test.'

MUTATIONS = [
    ('G1', AV / 'make.py',
     "    if diffs or missing:\n",
     "    if diffs or missing or len(humanoid.bones(doc)) != 54:\n",
     PY(GATE + 'test_a_base_with_fewer_bones_passes_against_its_own_kind'),
     'make.gate: the VRoid bone count is not demanded (a 53-bone body passes against its own kind)'),
    ('G2', AV / 'make.py',
     "    missing = humanoid.required_missing(doc)\n    print(f'  gate",
     "    missing = []\n    print(f'  gate",
     PY(GATE + 'test_a_missing_required_bone_is_named_even_when_the_base_lacks_it_too'),
     "make.gate: a bone the VRM spec requires is demanded even when the base lacks it too"),
    ('G3', AV / 'make.py',
     "    diffs = humanoid.compare(humanoid.read(base), doc)\n",
     "    diffs = []\n",
     PY(GATE + 'test_a_bone_present_on_one_side_only_fails_through_compare'),
     'make.gate: a bone on one side only fails through compare()'),
    ('G4', AV / 'verify.py',
     "    missing = humanoid.required_missing(humanoid.read(path))\n",
     "    missing = []\n",
     PY(VREP + 'test_a_model_missing_a_required_bone_is_named'),
     'verify.report: a missing required bone fails the health check and is named'),
    ('G5', AV / 'verify.py',
     "    if missing:\n        print(f'   FAIL humanoid bones",
     "    if missing or s['bones'] != 54:\n        print(f'   FAIL humanoid bones",
     PY(VREP + 'test_a_model_without_an_optional_bone_passes'),
     'verify.report: no bone count (a body without upperChest passes)'),
    ('G6', AV / 'verify.py',
     "    skin_of = {n['mesh']: n.get('skin') for n in doc['nodes'] if 'mesh' in n}\n",
     "    skin_of = {n['mesh']: 0 for n in doc['nodes'] if 'mesh' in n}\n",
     PY(VDANG + 'test_a_primitive_is_checked_against_its_own_nodes_skin'),
     "verify.dangling_joints: a primitive is checked against ITS node's skin"),
    ('G7', AV / 'selftest.py',
     "    n_bones = len(humanoid.bones(before))\n",
     "    n_bones = 54\n",
     PY(SELF + 'test_the_perturbed_model_passes_its_own_customisation_self_test'),
     'selftest: the bone count is read off the input model'),
    ('G8', AV / 'selftest.py',
     "    n_groups = len(before['extensions']['VRM']['blendShapeMaster']['blendShapeGroups'])\n",
     "    n_groups = 15\n",
     PY(SELF + 'test_the_perturbed_model_passes_its_own_customisation_self_test'),
     'selftest: the blendShapeGroup count is read off the input model'),
    ('G9', AV / 'selftest.py',
     "    n_targets = max((len(pr.get('targets', []))\n",
     "    n_targets = 56 or max((len(pr.get('targets', []))\n",
     PY(SELF + 'test_the_perturbed_model_passes_its_own_customisation_self_test'),
     'selftest: the face morph target count is read off the input model'),
    ('G10', AV / 'selftest.py',
     "    diffs = humanoid.compare(before, humanoid.read(out))\n",
     "    diffs = humanoid.compare(humanoid.read(os.path.join(BASE, 'baseline.vrm')), humanoid.read(out))\n",
     PY(SELF + 'test_the_perturbed_model_passes_its_own_customisation_self_test'),
     'selftest: the skeleton is compared against the input model, not baseline.vrm'),
    ('G11', AV / 'pose.py',
     "            mats = by_skin[skin_of[mi]]\n            j = glb.read_accessor",
     "            mats = by_skin[0]\n            j = glb.read_accessor",
     PY(POSE + 'test_a_mesh_on_the_second_skin_follows_its_own_joint_order'),
     "pose.skinned: a mesh is posed with ITS node's skin"),
    ('G12', AV / 'pose.py',
     "                mats = by_skin[skin_of[mi]]\n",
     "                mats = by_skin[0]\n",
     PY(POSE + 'test_normals_on_the_second_skin_turn_with_their_own_bone'),
     "pose.skinned_normals: normals are turned with ITS node's skin"),
    ('G13', AV / 'humanoid.py',
     "        out[node['mesh']] = node['skin']\n",
     "        out[node['mesh']] = 0\n",
     PY(POSE + 'test_a_mesh_on_the_second_skin_follows_its_own_joint_order'),
     'humanoid.mesh_skin: the skin index is the one the node names'),
    ('G14', AV / 'envelope.py',
     "    joints = doc['skins'][humanoid.skin_of_mesh(doc, parts[part]['mesh'])]['joints']\n",
     "    joints = doc['skins'][0]['joints']\n",
     PY(WIRE + 'test_no_module_reads_the_first_skin_for_every_mesh'),
     'wiring: a module reading skins[0] for a mesh is caught by the source scan'),
    ('G15', AV / 'outfit.py',
     "    for si in sharing:\n        other = doc['skins'][si]\n        if other is skin:\n            continue\n"
     "        other['joints'] = list(joints)\n        other['inverseBindMatrices'] = skin['inverseBindMatrices']\n",
     "",
     PY(REST + 'test_add_bones_grows_every_skin_that_shares_the_joint_list'),
     'outfit.add_bones: every skin sharing the joint list is grown alongside'),
    ('G16', AV / 'build.py',
     "        'hip': float(at('leftUpperLeg')[1]),\n",
     "        'hip': 0.843,\n",
     PY(BLD + 'Landmarks.test_joint_heights_come_from_the_skeleton'),
     'build.landmarks: the hip height comes from the skeleton'),
    ('G18', AV / 'humanoid.py',
     "    for skin in doc.get('skins') or []:\n        for j in skin['joints']:\n",
     "    for skin in (doc.get('skins') or [])[:1]:\n        for j in skin['joints']:\n",
     PY('scripts.avatar.humanoid_test.Facade.test_all_joints_is_the_union_in_first_seen_order'),
     'humanoid.all_joints: the union of every skin, not the first skin alone'),
    ('G19', AV / 'make.py',
     "        m, _ = partition.partition(base, p('parted.vrm'), p('parts.json'))\n",
     "        m, _ = partition.partition(BASELINE, p('parted.vrm'), p('parts.json'))\n",
     PY('scripts.avatar.gate_test.Wiring.test_main_threads_base_through_every_step'),
     'make.main: every step takes the --base body, not BASELINE'),
    ('G20', AV / 'humanoid.py',
     "        if out.get(node['mesh'], node['skin']) != node['skin']:\n",
     "        if False:\n",
     PY('scripts.avatar.humanoid_test.Facade.test_mesh_skin_follows_the_node_and_refuses_two_answers'),
     'humanoid.mesh_skin: two nodes drawing one mesh through different skins is refused'),
    ('G21', AV / 'build.py',
     "    shoulder_top = lm['shoulder']                  # the upper-arm joint's height\n",
     "    shoulder_top = 1.215                           # the upper-arm joint's height\n",
     PY(BLD + 'Wiring.test_build_cuts_the_outfit_at_the_derived_landmarks'),
     'build(): the cardigan shoulder line is the derived landmark, not a typed height'),
    ('G22', AV / 'build.py',
     "    neck_y = lm['neck'] - 0.007\n",
     "    neck_y = 1.243\n",
     PY(BLD + 'Wiring.test_build_cuts_the_outfit_at_the_derived_landmarks'),
     'build(): the collar height is an offset from the derived neck landmark'),
    ('G17', AV / 'build.py',
     "    hip, knee, ankle = lm['hip'], lm['knee'], lm['ankle']\n",
     "    hip, knee, ankle = 0.843, 0.501, 0.118\n",
     PY(BLD + 'Wiring.test_build_cuts_the_outfit_at_the_derived_landmarks'),
     'build(): the outfit is cut at the derived landmarks, not typed heights'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(cmd):
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr)


def main():
    only = set(sys.argv[1:])
    rows = []
    for mid, path, old, new, cmd, guard in MUTATIONS:
        if only and mid not in only:
            continue
        backup = Path(tempfile.mkdtemp()) / path.name
        shutil.copy2(path, backup)
        before = sha(path)
        src = path.read_text()
        hits = src.count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        path.write_text(src.replace(old, new))
        # Equal-size mutations landing within one second share mtime+size and
        # CPython reuses the previous .pyc (memory: vite_dev_serves_stale_modules).
        shutil.rmtree(path.parent / '__pycache__', ignore_errors=True)
        landed = sha(path) != before
        code, out = run(cmd)
        tail = '\n'.join(l for l in out.splitlines() if l.strip())[-1200:]
        shutil.copy2(backup, path)
        shutil.rmtree(path.parent / '__pycache__', ignore_errors=True)
        restored = sha(path) == before
        verdict = 'RED' if code != 0 else 'GREEN (mutation NOT caught)'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        rows.append((mid, guard, verdict, ' '.join(map(str, cmd)), tail))
        print(f'{mid} {verdict}  restored={restored}')
    print()
    print('| # | guard | result |')
    print('|---|---|---|')
    for r in rows:
        print(f'| {r[0]} | {r[1]} | {r[2]} |')
    print()
    for r in rows:
        if len(r) > 3:
            print(f'### {r[0]}\n```\n$ {r[3]}\n{r[4]}\n```\n')
    return 0 if all(r[2] == 'RED' for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
