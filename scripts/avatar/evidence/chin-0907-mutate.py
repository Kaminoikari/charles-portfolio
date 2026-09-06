#!/usr/bin/env python3
"""Mutation receipts for the derived chin (Phase 6b follow-up).

    python3 scripts/avatar/evidence/chin-0907-mutate.py [ID ...]

`proportion.CHIN_Y = 1.272` was the height the head is scaled about, read once
off one VRoid body. It is now the band between that body's neck joint and the
lowest vertex its head bone owns, taken at CHIN_FRACTION.

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
PROP = AV / 'proportion.py'

UT = ['python3', '-W', 'ignore', '-m', 'unittest', '-v']
LANDS = 'proportion_test.ChinTest.test_the_cut_lands_where_it_was_typed_in'
CLEARS = 'proportion_test.ChinTest.test_the_cut_clears_the_head_and_the_neck_joint'
NECK = 'proportion_test.ChinTest.test_a_longer_neck_carries_the_cut_up_with_it'
WIRED = 'proportion_test.WiringTest.test_the_entry_points_derive_the_cut'
FACE = 'proportion_test.ShippedFaceTest.test_face_is_the_input_face_scaled_by_head_factor'

MUTATIONS = [
    ('H1', "CHIN_FRACTION = 0.592\n", "CHIN_FRACTION = 0.5\n", LANDS,
     'the fraction is the one measured on the body the head factor was chosen against, to 0.1mm'),
    ('H2', "    return neck_y + (lowest - neck_y) * CHIN_FRACTION\n",
     "    return neck_y + CHIN_FRACTION\n", LANDS,
     'the cut is that fraction OF THE BAND above the neck joint, not a fraction of a metre'),
    ('H3', "            owned = joints[jo[np.arange(len(jo)), np.argmax(we, axis=1)]] == bones['head']\n",
     "            owned = np.ones(len(pos), bool)\n", CLEARS,
     'the band reaches up to the lowest HEAD-owned vertex; every vertex would put it near the floor, below the neck joint'),
    ('H4', "    neck_y = float(world[bones['neck']][:3, 3][1])\n",
     "    neck_y = 0.0\n", NECK,
     'the band starts at this body\'s neck joint, so a longer neck carries the cut with it'),
    ('H5', "        chin = chin_height(doc, views)\n    owners = collections.Counter(",
     "        chin = 1.272\n    owners = collections.Counter(", WIRED,
     'apply() derives the cut rather than typing the old height in beside the derivation'),
    ('H6', "    p[head, 1] = chin + (p[head, 1] - chin) * factor\n",
     "    p[head, 1] = chin + (p[head, 1] - chin)\n", FACE,
     'the shipped face really is the input face grown about that cut (the receipt that the cut is used at all)'),
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
        hits = PROP.read_text().count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / PROP.name
        shutil.copy2(PROP, backup)
        before = sha(PROP)
        clear_pycache()
        PROP.write_text(PROP.read_text().replace(old, new))
        landed = sha(PROP) != before
        clear_pycache()
        r = subprocess.run(UT + [test], cwd=AV, capture_output=True, text=True)
        out = r.stdout + r.stderr
        shutil.copy2(backup, PROP)
        clear_pycache()
        restored = sha(PROP) == before
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
