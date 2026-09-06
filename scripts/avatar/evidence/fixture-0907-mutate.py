#!/usr/bin/env python3
"""Mutation receipts for partition's body recogniser (Phase 6b, fixture half).

    python3 scripts/avatar/evidence/fixture-0907-mutate.py [ID ...]

Same discipline as the earlier harnesses in this directory: the pattern must
hit exactly once or the row aborts, the file is restored from a byte copy and
the restore is sha-verified, and a non-zero exit only counts as RED when the
output shows a named test that actually ran and failed.

CPython caches bytecode by (path, mtime, size), and two same-length mutations
landing in the same second can run the previous one's bytecode, so __pycache__
is cleared around every edit. See the project memory note on stale modules.
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
PART = AV / 'partition.py'

UT = ['python3', '-m', 'unittest', '-v']

MUTATIONS = [
    ('P1', PART,
     "    reasons = recognise(doc)\n    if reasons:\n",
     "    reasons = recognise(doc)\n    if False:\n",
     'gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger',
     'partition refuses a body it cannot name, instead of labelling its meshes by VRoid rules'),
    ('P2', PART,
     "    if FACE_MESH not in meshes:\n",
     "    if False:\n",
     'gate_test.PartitionRecognises.test_a_body_without_the_face_mesh_is_refused_by_name',
     'the missing Face mesh is one of the reasons, and the reason names the meshes that ARE there'),
    ('P3', PART,
     "    elif len(body['primitives']) != len(BODY_NAMES):\n",
     "    elif False:\n",
     'gate_test.PartitionRecognises.test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused',
     "a mesh named Body.baked with the wrong primitive count is refused (BODY_NAMES is an index table, so a short one silently leaves outfit primitives as Body_Skin and a long one raises deep inside the loop)"),
    ('P4', PART,
     "    body = meshes.get(BODY_MESH)\n    if body is None:\n",
     "    body = meshes.get(BODY_MESH)\n    if False:\n",
     'gate_test.PartitionRecognises.test_partition_refuses_rather_than_naming_a_stranger',
     'a body with no Body.baked at all is refused, not just one with the wrong count'),
    # The positive half. Without it every row above is satisfied by a recogniser
    # that refuses everything, which would refuse the shipped body too.
    ('P5', PART,
     "    meshes = {m.get('name'): m for m in doc['meshes']}\n",
     "    meshes = {}\n",
     'gate_test.PartitionRecognises.test_the_body_this_step_was_written_for_is_recognised',
     'the recogniser accepts the body this step WAS written for; a recogniser that refuses everything is not a guard'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def clear_pycache():
    for d in AV.rglob('__pycache__'):
        shutil.rmtree(d, ignore_errors=True)


def ran_and_failed(out):
    return re.search(r'^(FAILED|ERROR)', out, re.M) is not None and 'Ran 1 test' in out


def main():
    only = set(sys.argv[1:])
    rows = []
    for mid, path, old, new, test, guard in MUTATIONS:
        if only and mid not in only:
            continue
        hits = path.read_text().count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / path.name
        shutil.copy2(path, backup)
        before = sha(path)
        clear_pycache()
        path.write_text(path.read_text().replace(old, new))
        landed = sha(path) != before
        clear_pycache()
        r = subprocess.run(UT + [test], cwd=AV, capture_output=True, text=True)
        out = r.stdout + r.stderr
        shutil.copy2(backup, path)
        clear_pycache()
        restored = sha(path) == before
        got = 'RED' if r.returncode != 0 else 'GREEN'
        want = 'RED'  # every row here, including P5's positive half
        if got == 'RED' and not ran_and_failed(out):
            got = 'ABORT: non-zero exit with no failing test that ran'
        verdict = got if got == want else f'{got} (wanted {want})'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        lines = [l for l in out.splitlines() if l.strip()]
        tail = '\n'.join(lines)[:1600]
        rows.append((mid, guard, verdict, ' '.join(UT + [test]), tail))
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
