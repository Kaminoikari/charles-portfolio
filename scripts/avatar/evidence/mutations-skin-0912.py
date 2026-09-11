#!/usr/bin/env python3
"""Break one defence of the skin repaint at a time.

Baselines are the committed blobs, handed in as argv[1] (skin.py) and argv[2]
(skin_test.py) and extracted with `git cat-file blob <sha>:<path>`. The run
refuses to start unless the working file already equals it, so an interrupted
run cannot leave a mutation on disk and have the next run call it a baseline
(memory: project_mutation_runner_file_race). Nothing is restored with git: each
mutation writes its bytes, runs the tests, then writes back the exact bytes read
at the start, and the restore is asserted byte-for-byte. __pycache__ is cleared
before every run.

Each row carries WHICH tests it expects to fail, not merely that something
does. S3 is why: it breaks the pyramid and points the fixture at the body nine
levels was tuned for, and the thing worth reading is that the real-body test
drops out of the failure list while the synthetic ones stay in it.

    $ git cat-file blob <sha>:scripts/avatar/skin.py > /tmp/skin.committed.py
    $ git cat-file blob <sha>:scripts/avatar/skin_test.py > /tmp/skin_test.committed.py
    $ python3 scripts/avatar/evidence/mutations-skin-0912.py \\
          /tmp/skin.committed.py /tmp/skin_test.committed.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
SRC = HERE / 'skin.py'
TEST = HERE / 'skin_test.py'
TESTS = 'skin_test'

NINE = ("    while weight.size > 1:",
        "    for _ in range(9):")

OLD_HALF = ("""    h, w = a.shape[:2]
    if h == 1:
        a = a[:, :w - w % 2]
        return (a[:, 0::2] + a[:, 1::2]) / 2.0
    if w == 1:
        a = a[:h - h % 2]
        return (a[0::2] + a[1::2]) / 2.0
    a = a[:h - h % 2, :w - w % 2]""",
            """    h, w = a.shape[:2]
    a = a[:h - h % 2, :w - w % 2]""")

FIXTURE = ("    BODY = os.path.join(AVATARS, 'AvatarSample_A_webp.vrm')",
           "    BODY = os.path.join(AVATARS, 'mika-pink.vrm')")

MUTATIONS = [
    ('S1', ['a_hole_that_swallows', 'looks_like_the_skin', 'non_square'],
     'the pyramid stops after nine halvings again',
     [(SRC, *NINE)]),

    ('S2', ['non_square'],
     'half() halves a dimension that is already one',
     [(SRC, *OLD_HALF)]),

    ('S3', ['a_hole_that_swallows', 'non_square'],
     'nine halvings, judged on the body nine was tuned for',
     [(SRC, *NINE), (TEST, *FIXTURE)]),
]


def run():
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
    p = subprocess.run([sys.executable, '-m', 'unittest', TESTS],
                       cwd=HERE, capture_output=True, text=True)
    tail = p.stderr.strip().splitlines()
    ran = next((l for l in tail if l.startswith('Ran ')), '?')
    failed = [l for l in tail if l.startswith('FAIL:') or l.startswith('ERROR:')]
    return p.returncode, ran, failed


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    want = {SRC: pathlib.Path(sys.argv[1]).read_bytes(),
            TEST: pathlib.Path(sys.argv[2]).read_bytes()}
    for path, committed in want.items():
        if path.read_bytes() != committed:
            raise SystemExit(f'{path.name} differs from the committed blob: refusing '
                             'to start, because this run would restore to a mutated file')

    code, ran, failed = run()
    if code != 0:
        raise SystemExit(f'baseline is not green ({ran}); nothing below would mean anything')
    for path in want:
        sha = subprocess.run(['git', 'hash-object', str(path)],
                             capture_output=True, text=True, check=True).stdout.strip()
        print(f'{path.name:16} blob {sha}')
    print(f'baseline  {ran}  green\n')

    for tag, expect, what, edits in MUTATIONS:
        base = {path: path.read_bytes() for path, _, _ in edits}
        for path, old, new in edits:
            text = base[path].decode()
            hits = text.count(old)
            assert hits == 1, f'{tag}: PATTERN HIT {hits} TIMES in {path.name}'
            path.write_bytes(text.replace(old, new).encode())
        try:
            code, ran, failed = run()
        finally:
            for path, raw in base.items():
                path.write_bytes(raw)
                assert path.read_bytes() == raw, f'{tag}: restore of {path.name} failed'
        got = sorted({frag for frag in expect
                      if any(frag in line for line in failed)}
                     | {line.split('(')[0].split(':')[1].strip()
                        for line in failed
                        if not any(frag in line for frag in expect)})
        verdict = ('as expected' if got == sorted(expect)
                   else f'*** WANTED {sorted(expect)} ***')
        files = ', '.join(sorted({p.name for p, _, _ in edits}))
        print(f'{tag}  {what}  [{files}]\n    {ran}  '
              f'{"RED" if code else "GREEN"}  failing: {got}  {verdict}')
        print()


if __name__ == '__main__':
    main()
