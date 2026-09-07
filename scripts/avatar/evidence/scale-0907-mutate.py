#!/usr/bin/env python3
"""Mutation receipts for the waist search becoming a fraction of the body.

    python3 scripts/avatar/evidence/scale-0907-mutate.py [ID ...]

`build.landmarks` looked for the waist in a fixed band of metres (0.88 to 1.16,
1cm steps, a 12mm slab). The synthetic scaled fixture showed what that costs:
on a 0.8x and on a 1.25x body it returned the SAME 1.020, a height on the chest,
without failing (evidence/scale-0907.log). The band is now four fractions of the
body's own hips-to-shoulder span, chosen so this body's grid is unchanged.

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
BUILD = AV / 'build.py'

UT = ['python3', '-W', 'ignore', '-m', 'unittest', '-v']
ANY_SIZE = 'build_test.Landmarks.test_the_waist_is_found_on_a_body_of_any_size'
THIS_BODY = 'build_test.Landmarks.test_joint_heights_come_from_the_skeleton'
UNMOVED = 'build_test.Landmarks.test_a_taller_body_moves_every_joint_landmark_and_not_the_waist'
WIRED = 'build_test.Wiring.test_the_waist_is_searched_for_on_the_bodys_own_span'

BAND = ("             for y in np.arange(hips_y + span * w['from'], hips_y + span * w['to'],\n"
        "                                span * w['step'])\n")
SLAB = "             if (m := np.abs(p[:, 1] - y) < span * w['slab']).sum() > 12]\n"

MUTATIONS = [
    ('W1', BAND,
     "             for y in np.arange(0.88, 1.16, 0.01)\n",
     ANY_SIZE, 'the band is the body\'s own hips-to-shoulder span, not a fixed range of metres'),
    ('W2', SLAB,
     "             if (m := np.abs(p[:, 1] - y) < 0.012).sum() > 12]\n",
     ANY_SIZE, 'the slab each sample averages over is a length on THIS body, so it scales with it'),
    ('W3', "    span = float(world[bones['leftUpperArm']][1, 3]) - hips_y\n",
     "    span = 0.336868\n",
     ANY_SIZE, 'the span is read off the body rather than being the shipped body\'s span in metres'),
    ('W4', "    'step': 0.029685,   # one sample per 1cm on this body\n",
     "    'step': 0.2,   # one sample per 1cm on this body\n",
     THIS_BODY, 'the grid is fine enough to find the waist on the body the outfit was drawn against'),
    ('W5', "    'from': 0.005219,   # just above the hips joint\n",
     "    'from': 0.5,   # just above the hips joint\n",
     THIS_BODY, 'the search starts low enough to contain the waist'),
    ('W6', BAND,
     "             for y in np.arange(0.88, 1.16, 0.01)\n",
     WIRED, 'and build.py cannot go back to the fixed band while keeping WAIST_SEARCH beside it'),
    ('W7', SLAB,
     "             if (m := np.abs(p[:, 1] - y) < 0.012).sum() > 12]\n",
     WIRED, 'nor to the fixed slab'),
    # W8 was a mutation on the test's own tolerance (one grid step -> 1.0). It
    # came back GREEN, and correctly: LOOSENING a tolerance cannot make its test
    # fail, so that row could never have proved anything. What the test is
    # actually for is that the waist is read off the MESH, and this is the
    # mutation that says so -- take the answer from the skeleton instead, at the
    # very fraction of the span the shipped body's waist sits at, and the body
    # whose bones moved while its mesh stayed still drags its waist along.
    ('W8', "    waist_y = min(torso, key=lambda t: t[1])[0]\n",
     "    waist_y = hips_y + span * 0.243\n",
     UNMOVED, 'the waist is the narrowest slice of the mesh, not a fraction of the skeleton'),
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
        target = BUILD
        hits = target.read_text().count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / target.name
        shutil.copy2(target, backup)
        before = sha(target)
        clear_pycache()
        target.write_text(target.read_text().replace(old, new))
        landed = sha(target) != before
        clear_pycache()
        r = subprocess.run(UT + [test], cwd=AV, capture_output=True, text=True)
        out = r.stdout + r.stderr
        shutil.copy2(backup, target)
        clear_pycache()
        restored = sha(target) == before
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
