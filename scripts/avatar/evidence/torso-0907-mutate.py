#!/usr/bin/env python3
"""Mutation receipts for build.py's three torso edges (Phase 6b).

    python3 scripts/avatar/evidence/torso-0907-mutate.py [ID ...]

The bandeau's top, the shoulder straps' bottom and the cardigan sleeve's bottom
were absolute heights (1.181, 1.168, 1.155) read once off one VRoid body. They
are now fractions of that body's own waist-to-shoulder span, and the straps end
at its neck joint. Two things have to hold: the fractions still put the edges
where the outfit was drawn, and build() actually uses them rather than keeping
the numbers beside the derivation.

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
DRAWN = 'build_test.TorsoEdges.test_the_edges_land_where_the_outfit_was_drawn'
TALLER = 'build_test.TorsoEdges.test_a_longer_torso_moves_every_edge'
WIRED = 'build_test.Wiring.test_build_cuts_the_torso_edges_at_the_derived_fractions'

MUTATIONS = [
    ('B1', "    torso = (p[:, 1] < edge['bandeau_top'])",
     "    torso = (p[:, 1] < 1.181)",
     WIRED, "build() cuts the bandeau at the derived edge, not at the height it used to type in"),
    ('B2', "    strap = ((p[:, 1] > edge['strap_bottom']) & (p[:, 1] < lm['neck'])\n",
     "    strap = ((p[:, 1] > 1.168) & (p[:, 1] < 1.252)\n",
     WIRED, "and the straps at the derived edge and the neck joint"),
    ('B3', "              & (p[:, 1] > edge['sleeve_bottom']) & (p[:, 1] < shoulder_top + 0.02))\n",
     "              & (p[:, 1] > 1.155) & (p[:, 1] < shoulder_top + 0.02))\n",
     WIRED, "and the sleeve at the derived edge"),
    ('B4', "    'bandeau_top': 0.866,",
     "    'bandeau_top': 0.9,",
     DRAWN, "the fractions are the ones measured on the body the outfit was drawn against, to 0.1mm"),
    ('B5', "    return {name: lm['waist'] + span * f for name, f in TORSO_EDGES.items()}\n",
     "    return {name: lm['waist'] + f for name, f in TORSO_EDGES.items()}\n",
     DRAWN, "an edge is a fraction OF THE SPAN above the waist, not a fraction of a metre"),
    ('B6', "    span = lm['shoulder'] - lm['waist']\n",
     "    span = lm['shoulder']\n",
     TALLER, "the span is waist-to-shoulder, so a body that is taller only below the waist does not move the edges"),
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
        hits = BUILD.read_text().count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / BUILD.name
        shutil.copy2(BUILD, backup)
        before = sha(BUILD)
        clear_pycache()
        BUILD.write_text(BUILD.read_text().replace(old, new))
        landed = sha(BUILD) != before
        clear_pycache()
        r = subprocess.run(UT + [test], cwd=AV, capture_output=True, text=True)
        out = r.stdout + r.stderr
        shutil.copy2(backup, BUILD)
        clear_pycache()
        restored = sha(BUILD) == before
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
