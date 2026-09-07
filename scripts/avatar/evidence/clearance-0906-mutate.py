#!/usr/bin/env python3
"""Phase 5 mutation receipts (dynamic clipping gates, the crown through the
spring solver, the clearance file). Same harness as Phase 6a's
retarget-0906-mutate.py: byte-copy backup, pattern hit count must be 1, single
named test per mutation, byte-copy restore checked by sha256, a GREEN vitest
run repeated once before it is believed. One check this harness adds: a
non-zero exit only counts as RED if the output shows a test that ran and
failed, because `vitest -t <name that matches nothing>` also exits non-zero and
would otherwise read as a receipt for a guard that was never selected. Two
mutations are bodies rather than
edits (clearance-0906-models.py): the guard is pointed at them through
SPRINGSIM_TEST_MODEL. Every mutation is a real way a gate, a producer or the
transfer could be wrong, and its test is the one line that would notice."""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
AV = REPO / 'scripts' / 'avatar'
CHAT = REPO / 'src' / 'components' / 'chat'
MODELS = Path(tempfile.mkdtemp(prefix='clearance-mut-'))

PY = lambda *tests: ['python3', '-W', 'ignore', '-m', 'unittest', '-q', *tests]  # noqa: E731
VT = lambda file, name: ['npx', 'vitest', 'run', str(file), '-t', name]  # noqa: E731
SS = AV / 'springsim.ts'
SST = AV / 'springsim.test.ts'
CL = CHAT / 'clearance.ts'
CLT = CHAT / 'clearance.test.ts'
RPT = CHAT / 'rigProbe.test.ts'
MM = REPO / 'scripts' / 'measure-motions.ts'
MMT = REPO / 'scripts' / 'measure-motions.test.ts'
ENV = AV / 'envelope.py'
ENVT = 'scripts.avatar.envelope_test.'

# (id, file-or-None, old, new, cmd, guard[, env])
MUTATIONS = [
    ('C1', SS,
     "    if (crown > report.crownY) {\n      report.crownY = crown\n      report.crownT = t\n    }\n",
     "\n",
     VT(SST, 'the hop throws her hair well above its resting crown'),
     'springsim: the world crown is recorded per frame'),
    ('C2', SS,
     "      if (h > report.crownScreen[f]) report.crownScreen[f] = h\n",
     "\n",
     VT(SST, 'the hop throws her hair well above its resting crown'),
     "springsim: the crown is also projected through each frame's camera"),
    ('C3', SS,
     "  const forwardZ = rig.version === '0' ? -1 : 1\n  const frameNames = Object.keys(FRAMES) as MotionFrame[]\n",
     "  const forwardZ = -1\n  const frameNames = Object.keys(FRAMES) as MotionFrame[]\n",
     VT(SST, 'a 1.0 export of the same body simulates the same'),
     'springsim: the camera stands on the side the body faces, by version'),
    ('C4', SS,
     "        if (rooted.get(h)?.has(i)) continue\n",
     "\n",
     VT(SST, 'spin: the tails stay outside the cardigan and out of her body'),
     'springsim: hair inside the skin at rest (the roots) is left out of the body gate, or every clip reads the cap'),
    ('C5', None, None, None,
     VT(SST, 'the legs stay under the skirt'),
     'springsim.test: a skirt skinned wholly to the hips fails the skirt gate',
     {'SPRINGSIM_TEST_MODEL': str(MODELS / 'skirt-on-hips.vrm')}),
    ('C6', None, None, None,
     VT(SST, 'dance: the tails stay outside the cardigan'),
     'springsim.test: twintails with no colliders fail the coat gate (what the 2026-09-03 file did)',
     {'SPRINGSIM_TEST_MODEL': str(MODELS / 'tails-no-colliders.vrm')}),
    ('C7', CL,
     "  return Math.max(transfer, file.crownSeen[clip]?.[frame] ?? -Infinity, ...own)\n",
     "  return Math.max(transfer, ...own)\n",
     VT(CLT, 'transfers a clip crown onto another body'),
     'crownBound: a browser sweep that drew the crown higher wins'),
    ('C8', CL,
     "  return c.crownScreen[frame] - file.restCrownY + restCrownY + file.crownFringe\n",
     "  return c.crownScreen[frame] - file.restCrownY + restCrownY\n",
     VT(RPT, 'squat stays inside every frame it declares'),
     "crownOn: the browser's fringe is added (squat's crownTop waiver stops being needed without it)"),
    ('C9', CL,
     "  return c.crownScreen[frame] - file.restCrownY + restCrownY + file.crownFringe\n",
     "  return c.crownScreen[frame] + file.crownFringe\n",
     VT(MMT, 'reports the derived crown against the top edge'),
     "crownOn: the crown is moved onto the measured body by its own resting crown (a taller body's crown rises with it)"),
    ('C10', CL,
     "  if (measured.rigSha !== simulated.rigSha) {\n",
     "  if (false) {\n",
     VT(CLT, 'pairs two producers only on the same rig'),
     'combineClearance: two producers on different rigs are refused'),
    ('C11', CL,
     "  if (!Number.isFinite(decisions.crownFringe)) {\n",
     "  if (false) {\n",
     VT(CLT, 'refuses a missing browser fringe'),
     'combineClearance: a missing crownFringe is refused rather than defaulted'),
    ('C12', AV / 'clearance.ts',
     "  return createHash('sha256').update(rigOf(json)).digest('hex')\n",
     "  return 'e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45'\n",
     VT(CLT, 'measure-motions --write records the rig it measured'),
     "rigSha: the producer writes the sha of the body it read, not the family's (the test's body is a scaled copy with another rig)"),
    ('C13', MM,
     "      if (clearance) {\n        const crown = crownBound(clearance, name, placement, restCrown)\n",
     "      if (false) {\n        const crown = crownBound(clearance, name, placement, restCrown)\n",
     VT(MMT, 'reports the derived crown against the top edge'),
     'measure-motions: the crown row is printed against each frame'),
    ('C14', CHAT / 'avatarMode.ts',
     "export const AVATAR_FRAMING_COLUMN: AvatarFraming = { distance: 2.441, lookAtY: 1.016 }\n",
     "export const AVATAR_FRAMING_COLUMN: AvatarFraming = { distance: 2.441, lookAtY: 1.02 }\n",
     VT(RPT, 'was simulated under the composition the engine uses today'),
     'rigProbe.test: a composition change without a re-run of springsim --clearance is caught'),
    ('C15',
     # All THREE of the family's produced halves, not two. Since 9f47b0e the
     # crown is the worst of the family's bodies, so combineClearance compares
     # each alsoSimulated body's rigSha against the primary simulation's and
     # throws at import when they disagree -- which shaded this row: the test
     # never ran, and a `-t` that selects nothing exits non-zero and would have
     # read as a RED. Moving all three together leaves that check satisfied and
     # lets the guard this row is about be the one that fails.
     (CHAT / 'clearance' / 'vroid-sample-b.measured.gen.ts',
      CHAT / 'clearance' / 'vroid-sample-b.simulated.gen.ts',
      CHAT / 'clearance' / 'vroid-sample-b.pink.simulated.gen.ts'),
     ('  "rigSha": "e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45",\n',
      '  "rigSha": "e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45",\n',
      '  "rigSha": "e2aad79ec6667a5529934359339a6a08a29f73fe8a51f5cc6d4d702e137c1b45",\n'),
     ('  "rigSha": "0000000000000000000000000000000000000000000000000000000000000000",\n',
      '  "rigSha": "0000000000000000000000000000000000000000000000000000000000000000",\n',
      '  "rigSha": "0000000000000000000000000000000000000000000000000000000000000000",\n'),
     # Phase 6b renamed this test (the rig is now held against the variant's own
     # FAMILY, not against one global clearance file). The selector follows the
     # rename: a `-t` that matches nothing exits non-zero and would have been
     # read as a RED that never ran.
     VT(CHAT / 'avatarVariants.test.ts', 'gives every variant the rig its own family was measured on'),
     'avatarVariants.test: every declared body is the rig its family names (both produced halves moved together, because a sha changed in one is refused by combineClearance first — C10)'),
    ('C16', CHAT / 'clearance' / 'vroid-sample-b.ts',
     "    spin: { crownTop: 1.62 },\n",
     "    spin: { crownTop: 1.62 },\n    akimbo: { crownTop: 1.62 },\n",
     VT(RPT, 'akimbo stays inside every frame it declares'),
     'rigProbe.test: a crownTop waiver the clip does not need fails'),
    ('C17', SS,
     "    if (skirtDepth > report.skirtDepthMm) {\n      report.skirtDepthMm = skirtDepth\n      report.skirtWorstT = t\n    }\n",
     "\n",
     VT(SST, 'a 1.0 export of the same body simulates the same'),
     'springsim: the skirt depth is recorded (the twin comparison reads -Infinity against -Infinity otherwise: NaN)'),
    ('C19', CHAT / 'clearance' / 'vroid-sample-b.ts',
     "    scratchHead: { column: 1.6068 },\n",
     "\n",
     VT(RPT, 'scratchHead stays inside every frame it declares'),
     "crownSeen: a browser sweep above the derived crown is recorded (drop it and scratchHead's crownTop waiver stops being needed, which is itself a failure)"),
    ('C18', SS,
     "    if (bodyDepth > report.bodyDepthMm) {\n      report.bodyDepthMm = bodyDepth\n      report.bodyWorstT = t\n    }\n",
     "\n",
     VT(SST, 'dance: the tails stay outside the cardigan'),
     "springsim: the body depth is recorded (dance's line pins the measure's cap, so it notices the reading vanishing as well as shrinking)"),
    ('F1', CHAT / 'rigProbe.ts',
     "  for (let k = 0; k / SAMPLE_HZ <= duration; k++) timeSet.add(Math.round((k / SAMPLE_HZ) * 1e6) / 1e6)\n",
     "\n",
     VT(MMT, 'recognises the face waiver dance already ships with'),
     "sampleTimes: the clip is walked at 60 Hz as well as at its keys (keys only, the dance's deepest fingertip reads 0.3004 instead of 0.1975 and the waiver is a third too loose)"),
    ('E1', ENV,
     "    return np.round(np.arange(round(knee, 2), hip + ABOVE_HIP, STEP), 3)\n",
     "    return np.round(np.arange(0.60, 1.01, STEP), 3)\n",
     PY(ENVT + 'Heights'),
     'envelope.heights: the heights are read off the body, not typed in (and the committed envelope was swept over them)'),
    ('E2', ENV,
     "                doc, views, {bones[b]: q for b, q in rot.items() if b in bones}, True)\n",
     "                doc, views, {}, True)\n",
     PY(ENVT + 'Sweep'),
     'envelope.sweep: the legs are posed by the clips, not left at rest'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def ran_and_failed(cmd, out):
    """Did a named test run and fail, as opposed to nothing being selected?"""
    if cmd[1] == 'vitest':
        return re.search(r'Tests\s+\d+ failed', out) is not None
    m = re.search(r'^Ran (\d+) tests?', out, re.M)
    return m is not None and int(m.group(1)) > 0 and 'FAILED' in out


def run(cmd, env=None):
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True,
                       env={**os.environ, **(env or {})})
    return r.returncode, (r.stdout + r.stderr)


def main():
    only = set(sys.argv[1:])
    subprocess.run(['python3', str(AV / 'evidence' / 'clearance-0906-models.py'), str(MODELS)], check=True)
    rows = []
    for m in MUTATIONS:
        mid, path, old, new, cmd, guard = m[:6]
        env = m[6] if len(m) > 6 else None
        if only and mid not in only:
            continue
        if path is None:
            code, out = run(cmd, env)
            if code == 0 and cmd[1] == 'vitest':
                code, out = run(cmd, env)
            landed = restored = True
        else:
            # One mutation may need several files edited together: C15's wrong
            # rig has to appear in BOTH produced halves, because a sha in only
            # one of them is refused by combineClearance (C10) before the guard
            # it is aimed at ever loads.
            edits = list(zip(path, old, new)) if isinstance(path, tuple) else [(path, old, new)]
            tmpdir = Path(tempfile.mkdtemp())
            backups, before, aborted = {}, {}, None
            for i, (p, o, _n) in enumerate(edits):
                hits = p.read_text().count(o)
                if hits != 1:
                    aborted = f'ABORT: pattern {i + 1} hit {hits} times, not 1'
                    break
            if aborted:
                rows.append((mid, guard, aborted))
                print(f'{mid} {aborted}')
                continue
            for i, (p, o, n) in enumerate(edits):
                backups[i] = tmpdir / f'{i}-{p.name}'
                shutil.copy2(p, backups[i])
                before[i] = sha(p)
                p.write_text(p.read_text().replace(o, n))
                shutil.rmtree(p.parent / '__pycache__', ignore_errors=True)
            landed = all(sha(p) != before[i] for i, (p, _o, _n) in enumerate(edits))
            code, out = run(cmd, env)
            if code == 0 and cmd[1] == 'vitest':
                code, out = run(cmd, env)  # once more before believing a green vitest
            for i, (p, _o, _n) in enumerate(edits):
                shutil.copy2(backups[i], p)
                shutil.rmtree(p.parent / '__pycache__', ignore_errors=True)
            restored = all(sha(p) == before[i] for i, (p, _o, _n) in enumerate(edits))
        lines = '\n'.join(l for l in out.splitlines() if l.strip() and 'node_modules' not in l)
        tail = lines if len(lines) <= 1800 else lines[:600] + '\n[…]\n' + lines[-1200:]
        verdict = 'RED' if code != 0 else 'GREEN (mutation NOT caught)'
        # A non-zero exit is only a receipt if a named test actually ran and
        # failed. `vitest -t` that matches nothing, and a unittest path that
        # resolves to nothing, both exit non-zero and would read as RED.
        if code != 0 and not ran_and_failed(cmd, out):
            verdict = 'ABORT: non-zero exit with no failing test (the guard was not selected)'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        shown = ' '.join(map(str, cmd)) + (f'  [{" ".join(f"{k}={v}" for k, v in env.items())}]' if env else '')
        rows.append((mid, guard, verdict, shown, tail))
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
