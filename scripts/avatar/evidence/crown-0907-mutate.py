#!/usr/bin/env python3
"""Mutation receipts for the family's crown becoming the worst of its bodies.

    python3 scripts/avatar/evidence/crown-0907-mutate.py [ID ...]

A crown is a property of the BODY. Three bodies share this family and only one
of them had ever been simulated, because springsim refused a body with no
`.parts.json` until deriveManifest; the other two got a crown transferred onto
them and four hand-swept corrections where that under-read. The VRoid body now
has its own ten clips, and the transfer turns out to be wrong in both
directions: on the body the guards run on (rest crown 1.5820) it over-reads
idleLoop's column by 39.4mm and under-reads playFingers' waist-up by 30.7mm.

Same discipline as the other harnesses here: byte-copy backup, the pattern must
hit exactly once, sha256-verified restore, and a non-zero exit only counts as
RED when a named test ran and failed.
"""
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
CHAT = REPO / 'src/components/chat'
CLEARANCE = CHAT / 'clearance.ts'
FAMILY = CHAT / 'clearance/vroid-sample-b.ts'
PROBE = CHAT / 'rigProbe.test.ts'

VT = ['npx', 'vitest', 'run', '--root', str(REPO)]
INSIDE = (CHAT / 'clearance.test.ts', 'keeps every declared body inside the frame it is filmed in')
WIRED = (CHAT / 'clearance.test.ts', 'carries every simulated body into the crown it hands out')
WAIVER = (CHAT / 'clearance.test.ts', 'lets a waiver raise a frame edge and never lower one')
ONE_GEOM = (CHAT / 'clearance.test.ts', 'is one simulation because the two VRoid bodies are one geometry')
DANCE = (PROBE, 'dance stays inside every frame it declares')
PANS = (PROBE, 'pans by what the measurements leave room for, not by a number dialled in')
REPORT = (REPO / 'scripts/measure-motions.test.ts',
          'lets a waiver raise the top edge it reports against, never lower it')
COMPOSED = (CHAT / 'clearance.test.ts', 'refuses a second body simulated under another composition')
RAMP = (CHAT / 'clearance.test.ts', 'has the pan it needs by the time the crown gets there')

MUTATIONS = [
    ('K1', CLEARANCE,
     "  const own = file.alsoSimulated.map((s) => s.clips[clip].crownScreen[frame] + file.crownFringe)\n",
     "  const own: number[] = []\n",
     WIRED, "a body simulated in its own right raises the family's crown"),
    ('K2', CLEARANCE,
     "  const ceiling = Math.max(view.top, c.waiver?.crownTop ?? -Infinity)",
     "  const ceiling = c.waiver?.crownTop ?? view.top",
     WAIVER, 'a crownTop waiver raises the frame edge and never lowers it'),
    ('K3', FAMILY,
     "export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS, [PINK])",
     "export const CLEARANCE = combineClearance(MEASURED, SIMULATED, DECISIONS)",
     WIRED, "the VRoid body's own simulation is actually wired into the family file"),
    ('K4', CHAT / 'clearance.test.ts',
     "    expect(geometry(base!.url), `${base!.url} is no longer the same mesh as ${pink!.url}`)\n      .toBe(geometry(pink!.url))\n",
     "    expect(geometry(base!.url), `${base!.url} is no longer the same mesh as ${pink!.url}`)\n      .toBe(geometry('/avatar/mika-milfy-12.vrm'))\n",
     ONE_GEOM, 'the geometry hash tells two bodies apart rather than returning the same digest for everything'),
    # K5/K6 moved from avatarMotions.ts to the family file on 2026-09-07: a pan
    # is a property of the BODY, so the second family declares its own nine.
    ('K5', FAMILY,
     "    dance: { waistUp: -0.07, column: 0.14 },",
     "    dance: { waistUp: -0.08, column: 0.13 },",
     PANS, "dance's declared pan is the one panFor derives from the raised crown"),
    ('K6', FAMILY,
     "    playFingers: { column: 0.02 },\n",
     "",
     PANS, 'and playFingers keeps the pan that replaced its waiver'),
    ('K7', REPO / 'scripts/measure-motions.ts',
     "        const crownLimit = Math.max(frame.span.top, waiver?.crownTop ?? -Infinity)",
     "        const crownLimit = waiver?.crownTop ?? frame.span.top",
     REPORT, 'the report reads a waiver as a raise too, not only the two guards'),
    ('K8', CLEARANCE,
     "    if (JSON.stringify(other.framings) !== JSON.stringify(simulated.framings)) {\n",
     "    if (false) {\n",
     COMPOSED, 'a second body simulated under another composition is refused, not averaged in'),
    ('K9', CHAT / 'avatarMode.ts',
     "export const FRAME_PAN_SMOOTHING = 1.6",
     "export const FRAME_PAN_SMOOTHING = 0.16",
     RAMP, 'a camera too slow to arrive before the crown does is caught'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def ran_and_failed(out):
    return re.search(r'Tests\s+\d+ failed', out) is not None


def main():
    only = set(sys.argv[1:])
    rows = []
    for mid, target, old, new, (test_file, test_name) in [(m[0], m[1], m[2], m[3], m[4]) for m in MUTATIONS]:
        guard = next(m[5] for m in MUTATIONS if m[0] == mid)
        if only and mid not in only:
            continue
        hits = target.read_text().count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / target.name
        shutil.copy2(target, backup)
        before = sha(target)
        target.write_text(target.read_text().replace(old, new))
        landed = sha(target) != before
        cmd = VT + [str(test_file.relative_to(REPO)), '-t', test_name]
        r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
        out = r.stdout + r.stderr
        shutil.copy2(backup, target)
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
        tail = '\n'.join(l for l in out.splitlines() if l.strip())[-1600:]
        rows.append((mid, guard, verdict, ' '.join(cmd), tail))
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
