#!/usr/bin/env python3
"""Break one defence of the character contract at a time and record what goes red.

Baselines are the committed blobs, handed in as argv[1] (build.py) and argv[2]
(characters/mika.py) and extracted with `git cat-file blob <sha>:<path>`. The run refuses to start
unless the working file already equals it, so an interrupted run cannot leave a
mutation on disk and have the next run call it a baseline (memory:
project_mutation_runner_file_race). Nothing is restored with git: each mutation
writes its bytes, runs the tests, then writes back the exact bytes read at the
start, and the restore is asserted byte-for-byte.

    $ git cat-file blob <sha>:scripts/avatar/build.py > /tmp/build.committed.py
    $ git cat-file blob <sha>:scripts/avatar/characters/mika.py > /tmp/mika.committed.py
    $ python3 scripts/avatar/evidence/mutations-characters-0911.py \\
          /tmp/build.committed.py /tmp/mika.committed.py
"""
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
SRC = HERE / 'build.py'
TESTS = 'characters_test'
CHAR = HERE / 'characters' / 'mika.py'

MUTATIONS = [
    ('C1', 'build.py declares a palette of its own beside the contract', SRC,
     "def outline_colour(character):",
     "PALETTE = {}\n\n\ndef outline_colour(character):"),

    ('C2', 'build.py imports one character\'s value by name', SRC,
     "from characters import mika\n",
     "from characters import mika\nfrom characters.mika import PALETTE  # noqa: F401\n"),

    ('C3', 'add_material defaults the colours it is supposed to be handed', SRC,
     "def add_material(doc, name, base, shade, texture=None, *, outline, rim):",
     "def add_material(doc, name, base, shade, texture=None, *, outline=(0, 0, 0),"
     " rim=(0, 0, 0)):"),

    ('C4', 'outline_colour reads Mika\'s line value instead of the character\'s', SRC,
     "    raw = tuple(c / max(character.SKIN_TARGET) * character.OUTLINE_VALUE\n"
     "                for c in character.SKIN_TARGET)",
     "    raw = tuple(c / max(character.SKIN_TARGET) * 0.20\n"
     "                for c in character.SKIN_TARGET)"),

    # The pattern here named MELLOW_TINT until 2026-09-11, when the outfit axis
    # moved and the call became outfit_pack.TINT. It stopped matching, and
    # because the runner asserts each pattern hits exactly once, it stopped C6
    # and C7 from running at all rather than failing loudly on its own.
    ('C5', 'the imported outfit is dressed by an unbound callback again', SRC,
     "            bundle = outfit.load(path, doc, views, wear, outfit_pack.TINT,",
     "            bundle = outfit.load(path, doc, views, add_material, outfit_pack.TINT,"),

    ('C6', 'bowl_texture checks against a written-down mean again', SRC,
     "        if np.clip(a * k, 0.0, 1.0)[seen].mean() < mean:",
     "        if np.clip(a * k, 0.0, 1.0)[seen].mean() < 0.90:"),

    ('C7', 'build() reads Mika directly and ignores the character it was handed', SRC,
     "    mats = {n: add_material(doc, n, b, s, outline=outline, rim=rim)\n"
     "            for n, (b, s) in character.PALETTE.items()}",
     "    mats = {n: add_material(doc, n, b, s, outline=outline, rim=rim)\n"
     "            for n, (b, s) in mika.PALETTE.items()}"),

    ('C8', 'build.py spells one of her material names again', SRC,
     "    put(cardigan, paint['cardigan'], 'Outfit_Cardigan', origin='shell')",
     "    put(cardigan, 'Milfy_Cardigan', 'Outfit_Cardigan', origin='shell')"),

    ('C9', 'the manifest advertises only the two prefixes this build knew about', SRC,
     "        if not name.startswith((character.MATERIAL_PREFIX,\n"
     "                                outfit_pack.MATERIAL_PREFIX)):",
     "        if not name.startswith(('Milfy_', 'Mellow_')):"),

    ('C10', 'a role points at a material the character does not have', CHAR,
     "    'cloth':      'Milfy_White',",
     "    'cloth':      'Milfy_Blouse',"),
]


def run():
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
            CHAR: pathlib.Path(sys.argv[2]).read_bytes()}
    for path, committed in want.items():
        if path.read_bytes() != committed:
            raise SystemExit(f'{path.name} differs from the committed blob: refusing to '
                             'start, because this run would restore to a mutated file')

    code, ran, failed = run()
    if code != 0:
        raise SystemExit(f'baseline is not green ({ran}); nothing below would mean anything')
    print(f'baseline  {ran}  green\n')

    for tag, what, path, old, new in MUTATIONS:
        base = path.read_bytes()
        text = base.decode()
        hits = text.count(old)
        assert hits == 1, f'{tag}: PATTERN HIT {hits} TIMES in {path.name}'
        path.write_bytes(text.replace(old, new).encode())
        try:
            code, ran, failed = run()
        finally:
            path.write_bytes(base)
            assert path.read_bytes() == base, f'{tag}: restore failed'
        verdict = 'RED' if code != 0 else 'STILL GREEN -- this defence is not tested'
        print(f'{tag}  {what}  [{path.name}]\n    {ran}  {verdict}')
        for f in failed:
            print(f'    {f}')
        print()


if __name__ == '__main__':
    main()
