#!/usr/bin/env python3
"""Mutate clearance.ts one defence at a time and record which tests go red.

The baseline is the committed file: each run writes the mutated bytes, runs the
targeted tests, then writes back the exact bytes read at the start. Nothing is
restored with git, so an interrupted run leaves a file this script can see is
dirty (the pattern will not be found).
"""
import subprocess, sys, pathlib

SRC = pathlib.Path('src/components/chat/clearance.ts')
TESTS = 'src/components/chat/clearance.test.ts'

MUTATIONS = [
    ('P1', 'panHolds stops checking that the pan clears the crown',
     "  if (declared < least - RECORDED) {\n    return `${clip} in ${frame} pans ${mm(declared)}, and its crown needs ${mm(least)} to clear the top edge`\n  }\n",
     ""),
    ('P2', 'panHolds stops checking that her hips stay on the bottom edge',
     "  if (declared > most + RECORDED) {\n    return `${clip} in ${frame} pans ${mm(declared)}, and its hips leave the bottom edge past ${mm(most)}`\n  }\n",
     ""),
    ('P3', 'panHolds stops checking the pan against the policy point',
     "  if (Math.abs(declared - target) > 0.01 + RECORDED) {",
     "  if (false) {"),
    ('P4', 'panHolds demands the policy point exactly, as the old equality did',
     "  if (Math.abs(declared - target) > 0.01 + RECORDED) {",
     "  if (declared !== target) {"),
    ('P5', 'a range boundary is read exactly instead of to four places',
     "const RECORDED = 5e-5",
     "const RECORDED = 0"),
]

def run() -> tuple[int, str]:
    p = subprocess.run(['npx', 'vitest', 'run', TESTS, '--reporter=basic'],
                       capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr

base = SRC.read_bytes()
rows = []
for tag, what, old, new in MUTATIONS:
    text = base.decode()
    hits = text.count(old)
    if hits != 1:
        print(f'{tag}: PATTERN HIT {hits} TIMES -- aborting, the file is not the committed one')
        sys.exit(1)
    SRC.write_bytes(text.replace(old, new).encode())
    try:
        code, out = run()
    finally:
        SRC.write_bytes(base)
    assert SRC.read_bytes() == base, f'{tag}: restore failed'
    red = [l.strip() for l in out.splitlines() if l.strip().startswith('×') or ' FAIL ' in l]
    names = sorted({l.split('>')[-1].strip() for l in red if '>' in l})
    rows.append((tag, what, 'RED' if code != 0 else 'GREEN', names))
    print(f'{tag}  {"RED" if code else "GREEN"}  {what}')
    for n in names:
        print(f'      {n}')

print()
print('| id | mutation | result | which test caught it |')
print('|---|---|---|---|')
for tag, what, res, names in rows:
    print(f'| {tag} | {what} | {res} | {"; ".join(names) or "-"} |')
sys.exit(0 if all(r[2] == 'RED' for r in rows) else 1)
