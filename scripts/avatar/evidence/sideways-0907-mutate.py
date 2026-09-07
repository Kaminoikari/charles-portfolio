#!/usr/bin/env python3
"""Mutation receipts for the sideways skin allowance.

    python3 scripts/avatar/evidence/sideways-0907-mutate.py [ID ...]

Until 2026-09-07 the frame's sideways budget was compared against the bare
silhouette JOINT while the top edge reserved SKIN_ABOVE_JOINT, so a sleeve, a
palm or a thigh could be drawn outside the canvas as long as its bone was
inside. `deriveSilhouetteSkin` reads each silhouette bone's own skin radius off
the mesh and `silhouetteReach` adds it; these rows are what says both halves are
load-bearing.

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
RP = CHAT / 'rigProbe.ts'
RPT = CHAT / 'rigProbe.test.ts'


def t(path, title):
    return ['npx', 'vitest', 'run', str(path), '-t', title]


FRAME = t(RPT, 'stays inside every frame it declares')
RADIUS = t(RPT, 'reads the same finger radius again as one bone of the sideways allowance')
MISSING = t(RPT, 'refuses to measure a reach for a bone it has no skin radius for')

MUTATIONS = [
    # ---- the allowance is actually spent ------------------------------------
    ('S1', RP, '    const pad = skin[bone]\n', '    const pad = 0\n', FRAME,
     "the reach the producer wrote includes each joint's skin, so measuring the bare bone no longer reproduces it"),
    # ---- and it is the mesh's number, measured about the BONE ----------------
    ('S2', RP, '    const child = silhouetteChild(bone)\n', '    const child = null\n', RADIUS,
     'the radius is perpendicular to the bone segment, not a sphere about the joint: a sphere takes in every vertex along the limb'),
    ('S3', RP, '    if (child !== null && child in out && out[child] === 0) out[child] = Math.max(out[child], out[bone])\n', '',
     RADIUS, 'a fingertip owns no vertices and inherits the segment that ends there, so the widest point of an outstretched arm is not bare'),
    # ---- a missing radius is refused, not defaulted --------------------------
    ('S4', RP, "    if (pad === undefined) throw new Error(`silhouetteReach: no skin radius for ${bone}`)\n", '',
     MISSING, 'a bone with no radius stops the measurement instead of silently restoring the bare-joint reach'),
    # ---- the negative control ------------------------------------------------
    ('S5', RP, '  let left = -Infinity\n  let right = -Infinity\n', '  let left = -Infinity\n\n  let right = -Infinity\n',
     FRAME, 'a blank-line edit must NOT redden the frame guard'),
]

GREEN_EXPECTED = {'S5'}


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
        want = 'GREEN' if mid in GREEN_EXPECTED else 'RED'
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
        if not landed:
            got = 'ABORT: the mutation did not change the file'
        rows.append((mid, guard, got if got == want else f'{got} (wanted {want})'))
        print(f'{mid} {got}  restored={restored}')
        sys.stdout.flush()

    print('\n| # | guard | result |')
    print('|---|---|---|')
    for mid, guard, got in rows:
        print(f'| {mid} | {guard} | {got} |')


if __name__ == '__main__':
    main()
