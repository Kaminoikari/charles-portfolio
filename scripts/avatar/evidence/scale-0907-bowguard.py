#!/usr/bin/env python3
"""What the bow guard says when it has something to say, with and without it.

    python3 scripts/avatar/evidence/scale-0907-bowguard.py

build() measures how far the bow sits from the belt and refuses a stale
blender/bow.py OUTLINE. On a 1.25x body the two stop overlapping in height
altogether, and until 2026-09-07 that made the guard raise numpy's
`ValueError: zero-size array to reduction operation minimum` from inside
`.min()` -- an unreadable crash at the one moment the guard had most to say.

This is a before/after pair rather than a unit test, and is labelled as one: the
check lives in the middle of a full build, so the only way to drive it is to run
that build. Each run takes a few minutes.

Same restore discipline as the unit-test harnesses here: byte-copy backup, the
pattern must hit exactly once, sha256-verified restore.
"""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AV = Path('/Users/charles/portfolio/scripts/avatar')
BUILD = AV / 'build.py'
RUN = [sys.executable, str(AV / 'evidence' / 'scale-0907-build.py'), '1.25']

GUARD = """            if not len(tied):
                raise SystemExit(
                    f'蝴蝶結沒有任何頂點落在腰封的高度帶 {lo:.3f}–{hi:.3f}，'
                    f'它自己在 {bow[:, 1].min():.3f}–{bow[:, 1].max():.3f}：'
                    'blender/bow.py 的 OUTLINE 與現在的衣服對不上了')
"""


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(label):
    r = subprocess.run(RUN, cwd=AV, capture_output=True, text=True)
    out = r.stdout + r.stderr
    last = [l for l in out.splitlines() if l.strip()][-1]
    print(f'--- {label} (exit {r.returncode})')
    print(f'    {last}')
    return out


def main():
    hits = BUILD.read_text().count(GUARD)
    if hits != 1:
        print(f'ABORT: guard pattern hit {hits} times, not 1')
        return 1

    with_guard = run('with the guard')

    backup = Path(tempfile.mkdtemp()) / BUILD.name
    shutil.copy2(BUILD, backup)
    before = sha(BUILD)
    BUILD.write_text(BUILD.read_text().replace(GUARD, ''))
    landed = sha(BUILD) != before
    try:
        without = run('with the guard removed')
    finally:
        shutil.copy2(backup, BUILD)
    restored = sha(BUILD) == before

    said_it = '蝴蝶結沒有任何頂點落在腰封的高度帶' in with_guard
    crashed = 'ValueError: zero-size array' in without
    print()
    print(f'  mutation landed: {landed}   restored: {restored}')
    print(f'  guarded run names both height bands: {said_it}')
    print(f'  unguarded run dies in numpy .min():  {crashed}')
    ok = landed and restored and said_it and crashed
    print(f'\n  {"RED (the guard is what turns the crash into a diagnosis)" if ok else "NOT PROVEN"}')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
