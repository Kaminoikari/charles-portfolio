#!/usr/bin/env python3
"""Run ONE mutation of rigProbe.test.ts against ONE family, unbuffered.

Baseline is the committed blob at bb31fd0, read fresh each run and written back
byte-for-byte afterwards. Refuses to start on a file that is not that blob, so a
run killed halfway cannot be mistaken for a clean baseline.
"""
import subprocess, sys, pathlib, re

SRC = pathlib.Path('src/components/chat/rigProbe.test.ts')
COMMITTED = pathlib.Path(sys.argv[1])       # the blob, extracted with git cat-file
tag, family = sys.argv[2], sys.argv[3]
old, new = sys.argv[4], sys.argv[5]

base = COMMITTED.read_bytes()
if SRC.read_bytes() != base:
    print(f'{tag}: WORKING FILE IS NOT THE COMMITTED BLOB -- restore it first')
    sys.exit(2)

def run() -> tuple[int, str]:
    p = subprocess.run(
        ['npx', 'vitest', 'run', str(SRC), '-t', f"bundled motions on '{family}'"],
        capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr

def counts(out: str) -> tuple[int, int]:
    m = re.search(r'Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| \d+ skipped)?', out)
    if not m:
        return (-1, -1)
    return (int(m.group(1) or 0), int(m.group(2)))

code, out = run()
failed, passed = counts(out)
print(f'{tag} baseline  {family}: {passed} passed, {failed} failed')
if passed <= 0:
    print(f'{tag}: THE -t FILTER SELECTED NOTHING -- a RED from here would be a false one')
    sys.exit(3)
if failed != 0:
    print(f'{tag}: baseline is not green, cannot attribute a RED to the mutation')
    sys.exit(4)

text = base.decode()
hits = text.count(old)
if hits != 1:
    print(f'{tag}: PATTERN HIT {hits} TIMES -- aborting')
    sys.exit(1)
SRC.write_bytes(text.replace(old, new).encode())
try:
    code, out = run()
finally:
    SRC.write_bytes(base)
assert SRC.read_bytes() == base, f'{tag}: restore failed'
failed, passed = counts(out)
names = sorted(set(re.findall(r"\u00d7 bundled motions on '" + re.escape(family) + r"' > ([^\n]+?)(?:\s+\d+ms)?$", out, re.M)))
print(f'{tag} mutated   {family}: {passed} passed, {failed} failed -> {"RED" if failed else "GREEN"}')
for n in names:
    print(f'      {n}')
sys.exit(0 if failed else 1)
