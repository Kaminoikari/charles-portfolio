#!/usr/bin/env python3
"""Mutation receipts for the two 2026-09-07 generalisations.

    python3 scripts/avatar/evidence/generalise-0907-mutate.py [ID ...]

E-rows: the face box is the box of the meshes the EXPRESSIONS move, not of a
mesh whose name starts with `Face`. R-rows in retarget-0906-mutate.py already
hold the rest of deriveFaceBox; these hold the identification itself.

S-rows: springsim can read a manifest off a body no build wrote one for, so the
crown of mika-pink, the base body and any fixture stops depending on a browser
scan nobody can reproduce.

Same discipline as the earlier harnesses here: byte-copy backup, the pattern
must hit exactly once, sha256-verified restore, and a non-zero exit only counts
as RED when the runner reports a test that actually ran and failed — `vitest -t`
with no match also exits non-zero, which is how a renamed test turns a dead row
into a fake receipt (see the C15 note in mutations-0906-clearance.md).
"""
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
AV = REPO / 'scripts' / 'avatar'
CHAT = REPO / 'src' / 'components' / 'chat'

VT = lambda file, name: ['npx', 'vitest', 'run', str(file), '-t', name]  # noqa: E731
RP = CHAT / 'rigProbe.ts'
RPT = CHAT / 'rigProbe.test.ts'
VH = CHAT / 'vrmHumanoid.ts'
SS = AV / 'springsim.ts'
SDT = AV / 'springsim.derive.test.ts'

MUTATIONS = [
    # ---- the face is what the expressions move -------------------------------
    ('E1', RP,
     "  const faces = expressionMeshes(glb.json)\n",
     "  const faces = new Set(glb.json.meshes.flatMap((m, i) => (m.name?.startsWith('Face') ? [i] : [])))\n",
     VT(RPT, 'finds the face by what the expressions move'),
     'deriveFaceBox identifies the face by the expression binds; the pre-2026-09-07 rule (a mesh CALLED Face) picks a decoy on a body that has one'),
    ('E2', VH,
     "      for (const bind of group.binds ?? []) meshes.add(bind.mesh)\n",
     "      for (const bind of group.binds ?? []) meshes.add(bind.mesh + 1)\n",
     VT(RPT, 'derives the face box from the meshes the expressions move'),
     'expressionMeshes, VRM 0.x: a blendShape bind names a MESH index, and it is that mesh that is the face'),
    ('E3', VH,
     "        for (const bind of e.morphTargetBinds ?? []) {\n          const mesh = json.nodes?.[bind.node]?.mesh\n          if (mesh !== undefined) meshes.add(mesh)\n        }\n",
     "        for (const bind of e.morphTargetBinds ?? []) meshes.add(bind.node)\n",
     VT(RPT, "resolves a 1.0 expression bind through the node it names"),
     'expressionMeshes, VRM 1.0: a bind names a NODE, so it has to be resolved to that node\'s mesh (taking the node index as a mesh index is the silent version of this bug)'),

    # ---- a manifest read off the file ---------------------------------------
    ('S1', SS,
     "const SPRING_DOMINATED = 0.4\n",
     "const SPRING_DOMINATED = 0\n",
     VT(SDT, 'calls moving hair hair, and calls nothing else hair'),
     'SPRING_DOMINATED is a threshold: at 0 every primitive is hair, and the skirt and the coat get simulated as strands'),
    ('S2', SS,
     "const SPRING_DOMINATED = 0.4\n",
     "const SPRING_DOMINATED = 1.01\n",
     VT(SDT, 'calls moving hair hair, and calls nothing else hair'),
     'and it has to be reachable: above 1 nothing is ever hair, which would leave the solver with no strands to move'),
    ('S3', SS,
     "      else add('Body_Skin', name, pi)\n",
     "      else if (faces.has(node.mesh)) add('Body_Skin', name, pi)\n",
     VT(SDT, 'puts every skinned primitive somewhere'),
     'everything that is not hair or face still gets listed, or the crown stops seeing most of the body'),
    ('S4', SS,
     "        role === 'Hair' ? `Hair_${mesh}` : rank === 0 ? role : `${role}_${mesh}`\n",
     "        role === 'Hair' ? `Hair_${mesh}` : `${role}_${mesh}`\n",
     VT(SDT, 'names one Face and one Body_Skin'),
     "runClip asks for the keys `Face` and `Body_Skin` exactly, so one mesh in each role has to take the plain name (on a five-mesh body nothing else would)"),
    ('S5', SS,
     "  return { parts, landmarks: { waist: world.elements[13] }, derived: true }\n",
     "  return { parts, landmarks: { waist: 0 }, derived: true }\n",
     VT(SDT, 'puts the waist within a hand of where the build measured it'),
     'the derived waist is the hips joint in world space, not a placeholder (its consumer is the coat hem band, waist − 4cm)'),
    ('S6', SS,
     "    return deriveManifest(glb)\n",
     "    throw new Error('no manifest')\n",
     VT(SDT, 'simulates a body with no manifest beside it'),
     'a body with no .parts.json beside it is simulated from a derived manifest instead of being refused — the whole point of the change'),
    ('S7', SS,
     "      if (driven / n >= SPRING_DOMINATED) add('Hair', name, pi)\n",
     "      if (spring.size > 0) add('Hair', name, pi)\n",
     VT(SDT, 'calls moving hair hair, and calls nothing else hair'),
     'hair is decided per primitive by how much of IT the springs drive, not by whether the file has springs at all'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def ran_and_failed(out):
    """A vitest run that reports at least one test that ran and failed.

    `vitest -t <name that matches nothing>` exits non-zero with `No test found`,
    which would otherwise be scored RED and hide a dead row.
    """
    return re.search(r'Tests\s+\d+ failed', out) is not None


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
        landed = sha(path) != before
        code, out = run(cmd)
        if code == 0:
            code, out = run(cmd)  # once more before believing a green vitest
        shutil.copy2(backup, path)
        restored = sha(path) == before
        if code == 0:
            verdict = 'GREEN (mutation NOT caught)'
        elif not ran_and_failed(out):
            verdict = 'ABORT: non-zero exit with no failing test that ran'
        else:
            verdict = 'RED'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        lines = '\n'.join(l for l in out.splitlines() if l.strip() and 'node_modules' not in l)
        tail = lines if len(lines) <= 1800 else lines[:600] + '\n[…]\n' + lines[-1200:]
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
