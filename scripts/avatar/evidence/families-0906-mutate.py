#!/usr/bin/env python3
"""Phase 6b mutation receipts (the rig-family layer in the variant registry).

    python3 scripts/avatar/evidence/families-0906-mutate.py [ID ...]

Same harness as Phase 5's clearance-0906-mutate.py, with two changes.

  * Restores run in REVERSE order, defensively. Ascending is correct only while
    every mutation touches each file once; a mutation listing one file twice
    would have its first edit restored and then overwritten by the backup taken
    after it. Nothing here or in Phase 5 does that — G6 is the only multi-file
    row and its two edits are two different files — so this changes no result
    in either receipt. It is a property of the harness, not a fix for a bug
    these mutations hit.
  * A row may declare `expect='GREEN'`. One guard here is unreachable on the
    shipped data (no family excludes a clip the pool offers), so its receipt is
    a pair: the setup alone must stay GREEN, and the setup plus the defect must
    go RED. A single RED would not say which of the two did the work.

Two properties of this layer are deliberately NOT here, because no vitest
mutation can turn them red, and they are not held the same way:

  * `AvatarVariant.family` is a required field. `family?:` does not compile —
    tsc gives TS2322 in familyOf and TS2538 twice in avatarVariants.test.ts.
    The type checker refuses it, so there is no run for vitest to judge.
  * `motionsFor` takes a required family parameter. A default DOES compile
    clean and redden nothing, which is why the signature itself is the guard.

What catches the consequences at runtime is G2 (a body with no family) and
G7/G8 (the engine naming a family instead of asking the body).
They were drafted as G1 and G5, which is why the ids below skip those two; the
remaining ids keep the numbers they were written under rather than closing the
gap, so this note and the receipt describe the same rows.

A non-zero exit still only counts as RED when the output shows a named test
that ran and failed, because `vitest -t <no match>` also exits non-zero.
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
CHAT = REPO / 'src' / 'components' / 'chat'

VT = lambda file, name: ['npx', 'vitest', 'run', str(file), '-t', name]  # noqa: E731
AV = CHAT / 'avatarVariants.ts'
AVT = CHAT / 'avatarVariants.test.ts'
AM = CHAT / 'avatarMotions.ts'
ENG = CHAT / 'avatarGuideEngine.ts'
ENGT = CHAT / 'avatarGuideEngine.variant.test.ts'
RPT = CHAT / 'rigProbe.test.ts'
DEC = CHAT / 'clearance' / 'vroid-sample-b.ts'
CW = CHAT / 'ChatWidget.tsx'
CWT = CHAT / 'ChatWidget.test.tsx'
LP = REPO / 'scripts' / 'avatar' / 'live-preview.ts'
LPT = REPO / 'scripts' / 'avatar' / 'live-preview.test.ts'

# Setup, not a defect: give the one declared family an exclusion that the idle
# pool actually contains, so the "excluded clips are not offered" branch is
# reachable. On its own this must stay GREEN.
EXCLUDE_SQUAT = (
  "  excluded: {\n",
  "  excluded: {\n    squat: 'setup for evidence/families-0906-mutate.py G6; not a real exclusion',\n",
)

# (id, paths, olds, news, cmd, guard, expect)
MUTATIONS = [
    ('G2', AV,
     "  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm', family: 'vroid-sample-b', offered: true },\n",
     "  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm', offered: true } as AvatarVariant,\n",
     VT(AVT, 'declares a family for every variant'),
     'every declared body names a family (dropping one leaves it looking up undefined)'),
    ('G3', AV,
     "export const AVATAR_FAMILIES: Record<AvatarFamilyId, ClearanceFile> = {\n  'vroid-sample-b': VROID_SAMPLE_B,\n  'vrm1-twist-sample': VRM1_TWIST_SAMPLE,\n}\n",
     "export const AVATAR_FAMILIES: Record<string, ClearanceFile> = {\n  'vroid-sample-b': VROID_SAMPLE_B,\n  'vrm1-twist-sample': VRM1_TWIST_SAMPLE,\n  'nobody-uses-this': VROID_SAMPLE_B,\n}\n",
     VT(AVT, 'declares a family for every variant'),
     'a family nothing declares is refused (that is how a clearance file outlives the body it was measured on)'),
    ('G4', AV,
     "  'vroid-sample-b': VROID_SAMPLE_B,\n",
     "  'vroid-sample-b': { ...VROID_SAMPLE_B, family: 'someone-else' },\n",
     VT(AVT, 'has each family naming itself in the clearance it points at'),
     "a family key pointing at another family's measurements is refused"),
    ('G6-setup', DEC, EXCLUDE_SQUAT[0], EXCLUDE_SQUAT[1],
     VT(RPT, 'offers every idle clip somewhere'),
     'SETUP ONLY: the family excludes a pool clip. The guard must still pass — motionsFor drops it, so it is correctly unreachable',
     'GREEN'),
    ('G6', (DEC, AM),
     (EXCLUDE_SQUAT[0],
      "    (name) => AVATAR_MOTIONS[name].placements.includes(frame) && !(name in excluded),\n"),
     (EXCLUDE_SQUAT[1],
      "    (name) => AVATAR_MOTIONS[name].placements.includes(frame),\n"),
     VT(RPT, 'offers every idle clip somewhere'),
     "motionsFor drops the clips this family excludes (setup as G6-setup, plus the filter removed: the clip is offered on a body that cannot wear it)"),
    ('G7', ENG,
     "    shownFamily = family\n",
     "\n",
     VT(ENGT, 'takes the new body onto its own family'),
     'installVrm records the family of the body it installs, so a swap changes the clip pool with the body'),
    ('G8', ENG,
     "      shownFamily ? motionsFor(asked, shownFamily).filter((name) => motionClips.has(name)) : [],\n",
     "      motionsFor(asked, 'vroid-sample-b').filter((name) => motionClips.has(name)),\n",
     VT(ENGT, 'takes the new body onto its own family'),
     'the engine asks the loaded body for its family instead of naming one'),
    # ---- added 2026-09-07, after code review found three wired-but-unpinned
    # places: the widget's call site, the order the family is settled in, and
    # the preview tool's declaration.
    ('G9', CW,
     "  const offered = motionsFor(placement, familyOf(variantShown))\n",
     "  const offered = motionsFor(placement, familyOf(variantWanted))\n",
     VT(CWT, 'reads the family off variantShown'),
     "the strip asks the body ON SCREEN, not the one still downloading (both return the same ten clips today, so only a source guard separates them)"),
    ('G10', ENG,
     "    const family = familyFor(url)\n    if (!family) {\n",
     "    const family = familyFor(url) as AvatarFamilyId\n    if (false) {\n",
     VT(ENGT, 'settles the family before it releases'),
     'loadVariant refuses a body no family can vouch for, instead of carrying a null past uninstallVrm'),
    ('G11', ENG,
     "    shownFamily = family\n",
     "    shownFamily = familyFor(url) as AvatarFamilyId\n",
     VT(ENGT, 'settles the family before it releases'),
     'installVrm is HANDED the settled family; looking it up again there is the ordering bug returning (a null would reach shownFamily after the old body is gone)'),
    ('G12', LP,
     "  MIKA_MILFY_FAMILY,\n)\n",
     ")\n",
     VT(LPT, 'tells the engine which rig the previewed build came off'),
     'the preview tool declares its family, so an undeclared fresh build still previews'),
    ('G13', ENG,
     "familyOfUrl(url) ?? declaredFamily ?? null\n",
     "declaredFamily ?? familyOfUrl(url)\n",
     VT(ENGT, 'lets the registry outrank a caller-declared family'),
     'declaredFamily is a fallback, never an override: written the other way it applies one family\'s clearances to a declared body of another, and with one family declared, which is what the registry held when this ran, nothing else could tell the two orders apart'),
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
    for m in MUTATIONS:
        mid, path, old, new, cmd, guard = m[:6]
        want = m[6] if len(m) > 6 else 'RED'
        if only and mid not in only:
            continue
        edits = list(zip(path, old, new)) if isinstance(path, tuple) else [(path, old, new)]
        tmpdir = Path(tempfile.mkdtemp())
        aborted = None
        for i, (p, o, _n) in enumerate(edits):
            hits = p.read_text().count(o)
            if hits != 1:
                aborted = f'ABORT: pattern {i + 1} hit {hits} times, not 1'
                break
        if aborted:
            rows.append((mid, guard, aborted))
            print(f'{mid} {aborted}')
            continue
        backups, before = {}, {}
        for i, (p, o, n) in enumerate(edits):
            backups[i] = tmpdir / f'{i}-{p.name}'
            shutil.copy2(p, backups[i])
            before[i] = sha(p)
            p.write_text(p.read_text().replace(o, n))
        landed = any(sha(p) != before[i] for i, (p, _o, _n) in enumerate(edits))
        code, out = run(cmd)
        if code == 0:
            code, out = run(cmd)  # once more before believing a green vitest
        # Reverse: the earliest backup is the pristine file and must land last.
        for i in reversed(range(len(edits))):
            shutil.copy2(backups[i], edits[i][0])
        restored = all(sha(p) == before[i] for i, (p, _o, _n) in enumerate(edits))
        got = 'RED' if code != 0 else 'GREEN'
        if got == 'RED' and not ran_and_failed(out):
            got = 'ABORT: non-zero exit with no failing test (the guard was not selected)'
        verdict = got if got == want else f'{got} (wanted {want})'
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
    return 0 if all(r[2] in ('RED', 'GREEN') for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
