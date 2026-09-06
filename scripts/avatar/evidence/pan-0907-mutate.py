#!/usr/bin/env python3
"""Mutation receipts for deriving a clip's pan (Phase 6b).

    python3 scripts/avatar/evidence/pan-0907-mutate.py [ID ...]

The dance's two pans were declared in avatarMotions and derived in a comment
beside them, so a second family had to redo that derivation by hand off the same
paragraph. clearance.panFor derives them from the clearance file, and
rigProbe.test.ts holds every declared pan to it.

Same discipline as the other harnesses here: byte-copy backup, the pattern must
hit exactly once, sha256-verified restore, and a non-zero exit only counts as
RED when a named test ran and failed -- `vitest -t` with no match also exits
non-zero.
"""
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
CHAT = REPO / 'src' / 'components' / 'chat'
CL = CHAT / 'clearance.ts'
AM = CHAT / 'avatarMotions.ts'
RPT = CHAT / 'rigProbe.test.ts'

TEST = ['npx', 'vitest', 'run', str(RPT), '-t', 'pans by what the measurements leave room for']
FITS = ['npx', 'vitest', 'run', str(RPT), '-t', 'stays inside every frame it declares']

MUTATIONS = [
    ('N1', CL, "  const ceiling = c.waiver?.crownTop ?? view.top\n",
     "  const ceiling = view.top\n", TEST,
     'a crownTop waiver is the ceiling the clip has to clear, so the five clips that carry one are not given a camera move nobody asked for'),
    ('N2', CL, "  if (least <= 0 && 0 <= most) return 0\n", "",
     TEST, 'a clip that fits where it stands is given no pan at all'),
    ('N3', CL, "    least: crownWorst(file, clip, restCrownY, frames) - ceiling,\n",
     "    least: crownBound(file, clip, frame, restCrownY) - ceiling,\n", TEST,
     "the crown a pan is solved against is the clip's worst over the frames it plays in, not the frame being panned (the waist-up pan is composed on the column's reading)"),
    ('N4', CL, "    most: c.hipsLow - view.bottom,\n", "    most: Infinity,\n",
     TEST, 'the far end of the range is where her lowest hips leave the bottom edge'),
    ('N5', CL, "  const step = policy === 'least' ? Math.ceil : Math.round\n",
     "  const step = policy === 'least' ? Math.floor : Math.round\n", TEST,
     "the least-lift pan rounds UP to the centimetre, or the rounding puts the crown back outside"),
    ('N6', AM, "  waistUp: 'centre',\n  column: 'least',\n",
     "  waistUp: 'centre',\n  column: 'centre',\n", TEST,
     "the column takes the least lift that clears her hair; centring it would spend 9cm of her legs"),
    # The positive half: the guard has to bind the DECLARED number, not just
    # agree with itself. Without this, deleting the assertion passes every row.
    ('N7', AM, "    pan: { waistUp: -0.08, column: 0.13 },\n",
     "    pan: { waistUp: -0.09, column: 0.13 },\n", TEST,
     'a declared pan that disagrees with the derivation is caught'),
    # And the pan still has to earn its place, which is a different test.
    ('N8', AM, "    pan: { waistUp: -0.08, column: 0.13 },\n",
     "    pan: { waistUp: -0.08, column: 0.13, },\n", FITS,
     'the frame-fit guard still runs against the panned frames (a formatting-only edit must NOT redden it)'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def ran_and_failed(out):
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
        want = 'GREEN' if mid == 'N8' else 'RED'
        src = path.read_text()
        hits = src.count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / path.name
        shutil.copy2(path, backup)
        before = sha(path)
        path.write_text(src.replace(old, new))
        landed = sha(path) != before
        code, out = run(cmd)
        if code == 0:
            code, out = run(cmd)  # once more before believing a green vitest
        shutil.copy2(backup, path)
        restored = sha(path) == before
        if code == 0:
            got = 'GREEN'
        elif not ran_and_failed(out):
            got = 'ABORT: non-zero exit with no failing test that ran'
        else:
            got = 'RED'
        verdict = got if got == want else f'{got} (wanted {want})'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        lines = '\n'.join(l for l in out.splitlines() if l.strip() and 'node_modules' not in l)
        tail = lines if len(lines) <= 1600 else lines[:500] + '\n[…]\n' + lines[-1100:]
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
    return 0 if all(r[2] in ('RED', 'GREEN') for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
