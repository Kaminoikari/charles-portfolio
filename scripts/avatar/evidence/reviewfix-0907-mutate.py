#!/usr/bin/env python3
"""Mutation receipts for the guards added answering the 2026-09-07 reviews.

    python3 scripts/avatar/evidence/reviewfix-0907-mutate.py [ID ...]

Both reviewers passed the two load-bearing claims and failed the batch on
defects. Five of those defects were code, and each fix carries a guard here:

  X1 X2  deriveManifest addresses a mesh by name, so an unnamed or repeated
         name is refused rather than invented (`mesh3`) or merged.
  X3     the preview page's ?model= check is the URL parser's, not a list of
         shapes: `/\\evil.example/x.vrm` passed every shape test and resolves
         cross-origin.
  X4     the VRM1->VRM0 thumb rename refuses a file carrying both spellings
         instead of dropping one of the two bones from the comparison.
  X5     a pan whose rounding leaves its own range is an error, not an answer.
  X6     the pan is measured through the fov the clearance file was produced
         under, not the site's current one.

Same discipline as the other harnesses here: byte-copy backup, the pattern must
hit exactly once, sha256-verified restore, __pycache__ cleared around a Python
edit, and a non-zero exit only counts as RED when a named test ran and failed.
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
CHAT = REPO / 'src' / 'components' / 'chat'

VT = lambda file, name: ['npx', 'vitest', 'run', str(file), '-t', name]  # noqa: E731
UT = ['python3', '-W', 'ignore', '-m', 'unittest', '-v']

SS = AV / 'springsim.ts'
LPC = AV / 'live-preview-config.ts'
RIG = AV / 'vrmrig.py'
CL = CHAT / 'clearance.ts'
AM = CHAT / 'avatarMode.ts'

DERIVE = VT(AV / 'springsim.derive.test.ts', 'refuses a body whose skinned meshes it cannot address by name')
PREVIEW = VT(AV / 'live-preview.test.ts', 'refuses a model URL that leaves this site')
THUMBS = UT + ['vrmrig_test.Versions.test_a_file_carrying_both_thumb_spellings_is_refused_not_silently_merged']
ROUNDING = VT(CHAT / 'clearance.test.ts', 'refuses a pan that its own rounding puts outside the range')
FOV = VT(CHAT / 'clearance.test.ts', 'measures the pan against the fov the file was produced under')

MUTATIONS = [
    ('X1', SS, "  const repeated = [...new Set(names.filter((n, i) => n && names.indexOf(n) !== i))]\n",
     "  const repeated: string[] = []\n", DERIVE,
     'two skinned meshes sharing a name are refused; keying both under it reads one mesh\'s primitive indices off the other'),
    ('X2', SS, "  const unnamed = names.filter((n) => !n).length\n",
     "  const unnamed = 0\n", DERIVE,
     'a skinned mesh with no name is refused; an invented name resolves to nothing downstream'),
    ('X3', LPC, "  if (resolved.origin !== here) return refuse\n",
     "  if (asked.startsWith('//') || asked.includes('..')) return refuse\n", PREVIEW,
     "the ?model= check is the URL parser's; the shape list it replaced lets /\\evil.example/x.vrm through"),
    ('X4', RIG, "        if name in out:\n",
     "        if False:\n", THUMBS,
     'a 1.0 file carrying both thumb spellings is refused, not silently merged into one bone'),
    ('X5', CL, "  if (pan < least - 1e-9 || pan > most + 1e-9) {\n",
     "  if (false) {\n", ROUNDING,
     'a pan the rounding pushed outside its own range is refused rather than returned'),
    ('X6', CL, "  const view = avatarViewSpan(file.framings.frames[frame], file.framings.fov)\n",
     "  const view = avatarViewSpan(file.framings.frames[frame])\n", FOV,
     "the span is measured through the file's own fov, not the site's current one"),
    ('X8', LPC, "  if (resolved.pathname.startsWith('//')) return refuse\n", "",
     PREVIEW,
     'the ANSWER is checked too: /.//evil.example/x.vrm is same-origin as a URL object and normalises to an authority the loader parses cross-origin'),
    ('X9', SS, "    hasCoat: coat !== null,\n", "    hasCoat: true,\n",
     VT(AV / 'springsim.derive.test.ts', 'simulates a body with no manifest beside it'),
     'the report says whether there was a cardigan to measure, so the table can print — instead of a 0 nothing produced'),
    # The positive half for X1/X2: a recogniser that refuses every body would
    # satisfy both rows and refuse the body this tool actually runs on.
    ('X7', SS, "  if (unnamed || repeated.length) {\n",
     "  if (true) {\n",
     VT(AV / 'springsim.derive.test.ts', 'names one Face and one Body_Skin'),
     'the shipped body is still accepted; a derivation that refuses everything is not a guard'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def clear_pycache():
    for d in AV.rglob('__pycache__'):
        shutil.rmtree(d, ignore_errors=True)


def ran_and_failed(out):
    if 'vitest' in out or 'Test Files' in out:
        return re.search(r'Tests\s+\d+ failed', out) is not None
    return re.search(r'^(FAILED|ERROR)', out, re.M) is not None and 'Ran 1 test' in out


def run(cmd):
    r = subprocess.run(cmd, cwd=REPO if 'npx' in cmd[0] else AV, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr)


def main():
    only = set(sys.argv[1:])
    rows = []
    for mid, path, old, new, cmd, guard in MUTATIONS:
        if only and mid not in only:
            continue
        src = path.read_text()
        hits = src.count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / path.name
        shutil.copy2(path, backup)
        before = sha(path)
        clear_pycache()
        path.write_text(src.replace(old, new))
        landed = sha(path) != before
        clear_pycache()
        code, out = run(cmd)
        if code == 0:
            code, out = run(cmd)  # once more before believing a green vitest
        shutil.copy2(backup, path)
        clear_pycache()
        restored = sha(path) == before
        if code == 0:
            verdict = 'GREEN (mutation NOT caught)'
        elif not ran_and_failed(out):
            verdict = 'ABORT: non-zero exit with no failing test that ran'
        else:
            verdict = 'RED'
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
    return 0 if all(r[2] == 'RED' for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
