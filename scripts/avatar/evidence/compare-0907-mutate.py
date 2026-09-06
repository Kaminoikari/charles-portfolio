#!/usr/bin/env python3
"""Mutation receipts for comparing a skeleton across the two VRM versions.

    python3 scripts/avatar/evidence/compare-0907-mutate.py [ID ...]

`vrmrig.compare` measured rest positions in each file's own space and by each
file's own bone names, so a 1.0 body and its own 0.x conversion disagreed about
every bone off the centre line (the half turn) and about the thumbs (the two
versions spell the three joints differently). Both are properties of the spec,
not moved bones, and both were reported as 「skeleton moved」 about the converted
Seed-san fixture on 2026-09-07.

Same discipline as the other harnesses here: byte-copy backup, the pattern must
hit exactly once, sha256-verified restore, __pycache__ cleared around the edit,
and a non-zero exit only counts as RED when a named test ran and failed.
"""
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AV = Path('/Users/charles/portfolio/scripts/avatar')
RIG = AV / 'vrmrig.py'

UT = ['python3', '-W', 'ignore', '-m', 'unittest', '-v']
V = 'vrmrig_test.Versions.'
TURNED = V + 'test_the_same_skeleton_written_both_ways_has_not_moved'
THUMBS = V + 'test_the_thumbs_are_compared_joint_for_joint_not_name_for_name'
MOVED = V + 'test_a_bone_that_really_moved_is_still_caught_across_the_versions'
SAME = 'vrmrig_test.Comparison.test_a_millimetre_is_already_a_difference'

MUTATIONS = [
    ('C1', "    return {V1_TO_V0_THUMB.get(bone, bone): (-x, y, -z)\n            for bone, (x, y, z) in positions.items()}\n",
     "    return {V1_TO_V0_THUMB.get(bone, bone): (x, y, z)\n            for bone, (x, y, z) in positions.items()}\n",
     TURNED, 'the half turn between the versions is undone before the distances are taken'),
    ('C2', "    return {V1_TO_V0_THUMB.get(bone, bone): (-x, y, -z)\n            for bone, (x, y, z) in positions.items()}\n",
     "    return {bone: (-x, y, -z)\n            for bone, (x, y, z) in positions.items()}\n",
     THUMBS, "and so is the thumb spelling, or 1.0's Proximal is measured against 0.x's"),
    ('C3', "    if vrm_version(doc) == '0':\n        return positions\n",
     "    if False:\n        return positions\n",
     TURNED, 'only the 1.0 side is turned; turning both leaves them a half turn apart again'),
    ('C4', "    pa = _as_vrm0(a, rest_positions(a))\n",
     "    pa = rest_positions(a)\n",
     TURNED, 'compare() actually routes the baseline through it, not just the file under test'),
    ('C5', "    pb = _as_vrm0(b, rest_positions(b))\n",
     "    pb = rest_positions(b)\n",
     TURNED, 'and the file under test, not just the baseline'),
    # The other half. Without these two, "call every skeleton identical" passes
    # every row above, and the gate every build stands on would be off.
    ('C6', "        d = math.dist(pa[bone], pb[bone])\n",
     "        d = 0.0\n",
     MOVED, 'a bone that really moved is still caught ACROSS the versions'),
    ('C7', "        d = math.dist(pa[bone], pb[bone])\n",
     "        d = 0.0\n",
     SAME, 'and within one version, which is what every build-time gate compares'),
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
    for mid, old, new, test, guard in MUTATIONS:
        if only and mid not in only:
            continue
        hits = RIG.read_text().count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / RIG.name
        shutil.copy2(RIG, backup)
        before = sha(RIG)
        clear_pycache()
        RIG.write_text(RIG.read_text().replace(old, new))
        landed = sha(RIG) != before
        clear_pycache()
        r = subprocess.run(UT + [test], cwd=AV, capture_output=True, text=True)
        out = r.stdout + r.stderr
        shutil.copy2(backup, RIG)
        clear_pycache()
        restored = sha(RIG) == before
        if r.returncode == 0:
            verdict = 'GREEN (mutation NOT caught)'
        elif not ran_and_failed(out):
            verdict = 'ABORT: non-zero exit with no failing test that ran'
        else:
            verdict = 'RED'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        tail = '\n'.join(l for l in out.splitlines() if l.strip())[:1600]
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
