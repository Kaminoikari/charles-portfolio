#!/usr/bin/env python3
"""Break one defence of the character contract at a time and record what goes red.

Baseline is the committed blob, handed in as argv[1] and extracted with
`git cat-file blob <sha>:scripts/avatar/build.py`. The run refuses to start
unless the working file already equals it, so an interrupted run cannot leave a
mutation on disk and have the next run call it a baseline (memory:
project_mutation_runner_file_race). Nothing is restored with git: each mutation
writes its bytes, runs the tests, then writes back the exact bytes read at the
start, and the restore is asserted byte-for-byte.

    $ git cat-file blob <sha>:scripts/avatar/build.py > /tmp/build.committed.py
    $ python3 scripts/avatar/evidence/mutations-characters-0911.py /tmp/build.committed.py
"""
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
SRC = HERE / 'build.py'
TESTS = 'characters_test'

MUTATIONS = [
    ('C1', 'build.py declares a palette of its own beside the contract',
     "def outline_colour(character):",
     "PALETTE = {}\n\n\ndef outline_colour(character):"),

    ('C2', 'build.py imports one character\'s value by name',
     "from characters import mika\n",
     "from characters import mika\nfrom characters.mika import PALETTE  # noqa: F401\n"),

    ('C3', 'add_material defaults the colours it is supposed to be handed',
     "def add_material(doc, name, base, shade, texture=None, *, outline, rim):",
     "def add_material(doc, name, base, shade, texture=None, *, outline=(0, 0, 0),"
     " rim=(0, 0, 0)):"),

    ('C4', 'outline_colour reads Mika\'s line value instead of the character\'s',
     "    raw = tuple(c / max(character.SKIN_TARGET) * character.OUTLINE_VALUE\n"
     "                for c in character.SKIN_TARGET)",
     "    raw = tuple(c / max(character.SKIN_TARGET) * 0.20\n"
     "                for c in character.SKIN_TARGET)"),

    ('C5', 'the imported outfit is dressed by an unbound callback again',
     "            bundle = outfit.load(path, doc, views, wear, MELLOW_TINT,",
     "            bundle = outfit.load(path, doc, views, add_material, MELLOW_TINT,"),

    ('C6', 'bowl_texture checks against a written-down mean again',
     "        if np.clip(a * k, 0.0, 1.0)[seen].mean() < mean:",
     "        if np.clip(a * k, 0.0, 1.0)[seen].mean() < 0.90:"),

    ('C7', 'build() reads Mika directly and ignores the character it was handed',
     "    mats = {n: add_material(doc, n, b, s, outline=outline, rim=rim)\n"
     "            for n, (b, s) in character.PALETTE.items()}",
     "    mats = {n: add_material(doc, n, b, s, outline=outline, rim=rim)\n"
     "            for n, (b, s) in mika.PALETTE.items()}"),
]


def run():
    p = subprocess.run([sys.executable, '-m', 'unittest', TESTS],
                       cwd=HERE, capture_output=True, text=True)
    tail = p.stderr.strip().splitlines()
    ran = next((l for l in tail if l.startswith('Ran ')), '?')
    failed = [l for l in tail if l.startswith('FAIL:') or l.startswith('ERROR:')]
    return p.returncode, ran, failed


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    committed = pathlib.Path(sys.argv[1]).read_bytes()
    base = SRC.read_bytes()
    if base != committed:
        raise SystemExit('build.py differs from the committed blob: refusing to start, '
                         'because this run would restore to a mutated file')

    code, ran, failed = run()
    if code != 0:
        raise SystemExit(f'baseline is not green ({ran}); nothing below would mean anything')
    print(f'baseline  {ran}  green\n')

    text = base.decode()
    for tag, what, old, new in MUTATIONS:
        hits = text.count(old)
        assert hits == 1, f'{tag}: PATTERN HIT {hits} TIMES'
        SRC.write_bytes(text.replace(old, new).encode())
        try:
            code, ran, failed = run()
        finally:
            SRC.write_bytes(base)
            assert SRC.read_bytes() == base, f'{tag}: restore failed'
        verdict = 'RED' if code != 0 else 'STILL GREEN -- this defence is not tested'
        print(f'{tag}  {what}\n    {ran}  {verdict}')
        for f in failed:
            print(f'    {f}')
        print()


if __name__ == '__main__':
    main()
