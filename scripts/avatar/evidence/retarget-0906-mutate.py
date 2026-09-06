#!/usr/bin/env python3
"""Phase 6a mutation receipts (retarget convergence onto three-vrm's
VRMHumanoid; face box and finger skin derived from the mesh). Same harness as
Phase 4's binding-0906-mutate.py, now over TypeScript files too: byte-copy
backup, pattern hit count must be 1, single named test per mutation, byte-copy
restore checked by sha256. A vitest run that comes back GREEN is run once more
before it is believed (memory: vite_dev_serves_stale_modules). Every mutation
is a real way the retarget, the derivation or the wiring could be wrong, and
its test is the one line that would notice."""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
AV = REPO / 'scripts' / 'avatar'
CHAT = REPO / 'src' / 'components' / 'chat'

PY = lambda *tests: ['python3', '-W', 'ignore', '-m', 'unittest', '-q', *tests]  # noqa: E731
VT = lambda file, name: ['npx', 'vitest', 'run', str(file), '-t', name]  # noqa: E731
PAR = 'scripts.avatar.retarget_parity_test.'
RP = CHAT / 'rigProbe.ts'
RPT = CHAT / 'rigProbe.test.ts'

MUTATIONS = [
    ('R1', RP,
     "  const flip = rig.version === '0' ? -1 : 1\n",
     "  const flip = rig.version === '1' ? -1 : 1\n",
     VT(RPT, 'flips the clip for the 0.x body it ships on'),
     'applyMotion: the x/z flip is for a 0.x body, not a 1.0 one (the twin test alone lets this through: both bodies flipped the wrong way still agree up to the half turn)'),
    ('R2', RP,
     "  const flip = rig.version === '0' ? -1 : 1\n",
     "  const flip = -1\n",
     VT(RPT, 'plays a clip on a VRM 1.0 twin without the VRM0 flip'),
     'applyMotion: the flip is conditional at all (the pre-6a code)'),
    ('R3', RP,
     "  rig.root.updateMatrixWorld(true)\n  rig.humanoid.update()\n  rig.scene.updateMatrixWorld(true)\n",
     "  rig.root.updateMatrixWorld(true)\n  rig.scene.updateMatrixWorld(true)\n",
     VT(RPT, 'writes the pose through to the raw nodes'),
     'sync: the normalized pose is written onto the raw nodes through humanoid.update()'),
    # 2026-09-07: deriveFaceBox stopped taking a mesh-NAME pattern and started
    # taking a predicate over mesh indices, so this row's old pattern
    # (skinnedVertices(glb, raw, /^Face/)) no longer exists in the file. Same
    # guard, restated against the code that replaced it: the box is the
    # expression-driven meshes, and widening it to every mesh lets the hair in.
    ('R4', RP,
     "  for (const { p, node } of skinnedVertices(glb, raw, (m) => faces.has(m))) {\n",
     "  for (const { p, node } of skinnedVertices(glb, raw, () => true)) {\n",
     VT(RPT, 'derives the face box from the meshes the expressions move'),
     'deriveFaceBox: the expression-driven meshes only, never the hair'),
    ('R5', RP,
     "    if (node !== headNode) continue\n    box.expandByPoint(p)\n",
     "    box.expandByPoint(p)\n",
     VT(RPT, 'leaves the neck rows out of the face box'),
     'deriveFaceBox: head-dominant vertices only (invisible on the shipped Face mesh, which has none; a synthetic two-vertex mesh shows it)'),
    ('R6', RP,
     "    const name = source.version === '0' || legacyThumbs ? vrm1BoneName(bone) : bone\n",
     "    const name = bone\n",
     VT(RPT, 'names the thumb joints the way three-vrm does'),
     "buildRigFrom: a 0.x body's thumb joints are renamed to three-vrm's 1.0 names"),
    ('R7', RP,
     "  Thumb: ['Metacarpal', 'Proximal', 'Distal'],\n",
     "  Thumb: ['Proximal', 'Intermediate', 'Distal'],\n",
     VT(RPT, 'names the thumb joints the way three-vrm does'),
     'handJoints: the thumb is sampled at Metacarpal/Proximal/Distal'),
    ('R8', RP,
     "const OUTER_PHALANX = /(Index|Middle|Ring|Little)(Intermediate|Distal)$|Thumb(Proximal|Distal)$/\n",
     "const OUTER_PHALANX = /(Index|Middle|Ring|Little)(Proximal|Intermediate|Distal)$|Thumb(Metacarpal|Proximal|Distal)$/\n",
     VT(RPT, 'reads a finger skin radius off the mesh'),
     'deriveFingerSkinRadius: the outer phalanges only, never the palm-reaching base joints'),
    ('R9', RP,
     "          p.addScaledVector(_skinned.copy(rest).applyMatrix4(jointMatrix[jo.data[v * jo.ncomp + k]]), w)\n",
     "          p.addScaledVector(_skinned.copy(rest), w)\n",
     VT(REPO / 'scripts' / 'measure-motions.test.ts', 'reports the face box and the finger skin'),
     "skinnedVertices: vertices are skinned by their joints' rest matrices (a taller body's box scales with it)"),
    ('P5', AV / 'retarget-dump.ts',
     "        if (bone.endsWith('Tip')) continue\n        const raw = rig.humanoid.getRawBoneNode(bone as never)\n",
     "        if (bone.endsWith('Tip') || bone.includes('Thumb')) continue\n        const raw = rig.humanoid.getRawBoneNode(bone as never)\n",
     PY(PAR + 'AgainstThreeVrm.test_vrm1_twin'),
     'retarget_parity_test: the dump has to carry every humanoid bone, or the per-bone loop goes vacuous'),
    ('R10', RP,
     "  return { bones, root, restPosition, humanoid, version: source.version, raw, scene, faceBox }\n",
     "  return { bones, root, restPosition, humanoid, version: '0', raw, scene, faceBox }\n",
     VT(RPT, 'is a VRMHumanoid and knows which VRM version it came from'),
     "buildRigFrom: the rig carries the file's own version"),
    ('M1', REPO / 'scripts' / 'measure-motions.ts',
     "  say(\n    `臉部盒　x ${box.min.x.toFixed(3)}…${box.max.x.toFixed(3)}　y ${box.min.y.toFixed(3)}…${box.max.y.toFixed(3)}` +\n      `　z ${box.min.z.toFixed(3)}…${box.max.z.toFixed(3)}（從 Face 網格推導）`,\n  )\n",
     "",
     VT(REPO / 'scripts' / 'measure-motions.test.ts', 'reports the face box and the finger skin'),
     'measure-motions: the derived face box is printed'),
    ('M2', REPO / 'scripts' / 'measure-motions.ts',
     "  say(`指尖皮厚　${mm(fingerSkin)}（從 Body 網格推導；畫面預留的是 SKIN_ABOVE_JOINT ${mm(SKIN_ABOVE_JOINT)}）`)\n",
     "  say(`指尖皮厚　${mm(SKIN_ABOVE_JOINT)}（從 Body 網格推導；畫面預留的是 SKIN_ABOVE_JOINT ${mm(SKIN_ABOVE_JOINT)}）`)\n",
     VT(REPO / 'scripts' / 'measure-motions.test.ts', 'reports the face box and the finger skin'),
     'measure-motions: the printed finger skin is the derived one, not the 12mm constant'),
    ('V1', CHAT / 'vrmHumanoid.ts',
     "  json.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => nodes[i].add(nodes[c])))\n",
     "\n",
     VT(CHAT / 'vrmHumanoid.test.ts', 'rebuilds the glTF node tree'),
     'buildNodes: the nodes are parented as the file says'),
    ('V2', CHAT / 'vrmHumanoid.ts',
     "      if (n.scale) o.scale.fromArray(n.scale)\n",
     "\n",
     VT(CHAT / 'vrmHumanoid.test.ts', 'honours a matrix node and a scale'),
     'buildNodes: a node scale is applied'),
    ('S1', AV / 'springsim.ts',
     "    applyMotion(rig, motion, t) // normalized → raw → world matrices\n",
     "    resetRig(rig)\n",
     VT(AV / 'springsim.test.ts', 'dance: the tails stay outside'),
     'springsim: each frame is posed through applyMotion (the pinned readings notice a body that never moves)'),
    ('A1', CHAT / 'avatarMode.ts',
     "export const AVATAR_HEAD_BOTTOM_Y = 1.287\n",
     "export const AVATAR_HEAD_BOTTOM_Y = 1.28\n",
     VT(CHAT / 'avatarMode.test.ts', 'takes her chin from the same box'),
     "avatarMode: the head band's chin is held to the derived face box"),
    ('P1', AV / 'motion.py',
     "        delta[humanoid.model_bone_name(model_doc, bone)] = qmul(YAW, qmul(d, qconj(YAW))) if flip else d\n",
     "        delta[humanoid.model_bone_name(model_doc, bone)] = qmul(YAW, qmul(d, qconj(YAW)))\n",
     PY(PAR + 'MotionPyAlone.test_a_vrm1_twin_poses_as_the_shipped_body_turned_round'),
     'motion.retarget: a 1.0 body is not flipped'),
    ('P2', AV / 'motion.py',
     "        delta[humanoid.model_bone_name(model_doc, bone)] = qmul(YAW, qmul(d, qconj(YAW))) if flip else d\n",
     "        delta[humanoid.model_bone_name(model_doc, bone)] = d\n",
     PY(PAR + 'AgainstThreeVrm.test_shipped_vrm0_body'),
     'motion.retarget: a 0.x body IS flipped, as three-vrm flips it'),
    ('P3', AV / 'motion.py',
     "        delta[humanoid.model_bone_name(model_doc, bone)] = qmul(YAW, qmul(d, qconj(YAW))) if flip else d\n",
     "        delta[bone] = qmul(YAW, qmul(d, qconj(YAW))) if flip else d\n",
     PY(PAR + 'MotionPyAlone.test_a_thumb_track_lands_on_the_thumb_it_names'),
     "motion.retarget: the clip's thumb names are translated into the body's"),
    ('P4', AV / 'humanoid.py',
     "    return V1_TO_V0_THUMB.get(clip_bone, clip_bone) if legacy else clip_bone\n",
     "    return V1_TO_V0_THUMB.get(clip_bone, clip_bone)\n",
     PY(PAR + 'AgainstThreeVrm.test_vrm1_twin'),
     'humanoid.model_bone_name: a 1.0 body keeps the 1.0 thumb names'),
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
        shutil.rmtree(path.parent / '__pycache__', ignore_errors=True)
        landed = sha(path) != before
        code, out = run(cmd)
        if code == 0 and cmd[1] == 'vitest':
            code, out = run(cmd)  # once more before believing a green vitest
        lines = '\n'.join(l for l in out.splitlines() if l.strip() and 'node_modules' not in l)
        tail = lines if len(lines) <= 1800 else lines[:600] + '\n[…]\n' + lines[-1200:]
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
