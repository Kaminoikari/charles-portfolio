#!/usr/bin/env python3
"""Break one defence of the material-grammar partition at a time.

Baselines are the committed blobs, handed in as argv[1] (partition.py) and
argv[2] (gate_test.py) and extracted with `git cat-file blob <sha>:<path>`. The
run refuses to start unless the working file already equals it, so an
interrupted run cannot leave a mutation on disk and have the next run call it a
baseline (memory: project_mutation_runner_file_race). Nothing is restored with
git: each mutation writes its bytes, runs the tests, then writes back the exact
bytes read at the start, and the restore is asserted byte-for-byte.

__pycache__ is cleared before every run: two mutations of the same length
landing in the same second can otherwise be answered from the previous one's
bytecode (memory: project_vite_dev_serves_stale_modules).

    $ git cat-file blob <sha>:scripts/avatar/partition.py > /tmp/partition.committed.py
    $ git cat-file blob <sha>:scripts/avatar/gate_test.py > /tmp/gate_test.committed.py
    $ python3 scripts/avatar/evidence/mutations-partition-0912.py \\
          /tmp/partition.committed.py /tmp/gate_test.committed.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
SRC = HERE / 'partition.py'
TEST = HERE / 'gate_test.py'
TESTS = 'gate_test'

MUTATIONS = [
    ('P1', "the body's parts come from primitive index again", SRC,
     "            if name == BODY_MESH:\n"
     "                label = body_name(mats[prim['material']])",
     "            if name == BODY_MESH:\n"
     "                label = {0: 'Body_Skin', 1: 'Body_Skin', 2: 'Body_Skin',\n"
     "                         3: 'Body_Skin', 4: 'Outfit_Top',\n"
     "                         5: 'Outfit_Bottom', 6: 'Outfit_Shoes'}[i]"),

    ('P2', 'the category has to be the final segment', SRC,
     "    for i in (-1, -2):",
     "    for i in (-1,):"),

    ('P3', "a dress-up export's decorated name is read as written", SRC,
     "    segments = DECORATION.sub('', material).strip().split('_')",
     "    segments = material.strip().split('_')"),

    ('P4', 'a garment nobody here has seen is filed under the nearest known one',
     SRC,
     "        return OUTFIT_NAMES.get(part, f'Outfit_{part}')",
     "        return OUTFIT_NAMES.get(part, 'Outfit_Top')"),

    ('P5', 'back hair baked into the body mesh takes the hair mesh\'s name', SRC,
     "        return 'Hair_BodyBack'",
     "        return 'Hair_Back'"),

    ('P6', 'recognise stops looking at what the body materials are called', SRC,
     "        if unnamed:\n"
     "            reasons.append(",
     "        if False and unnamed:\n"
     "            reasons.append("),

    ('P7', 'a second mesh may claim a part name the first already has', SRC,
     "            if label in manifest['parts']:",
     "            if False and label in manifest['parts']:",),

    ('P8', 'the shipped body is renamed along with everybody else', SRC,
     "OUTFIT_NAMES = {'Tops': 'Outfit_Top', 'Bottoms': 'Outfit_Bottom'}",
     "OUTFIT_NAMES = {}"),

    ('P9', 'the foreign body under test is the one this step was written for',
     TEST,
     "    OTHER = os.path.join(HERE, '..', '..', 'public', 'avatar', 'Vivi_webp.vrm')",
     "    OTHER = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')"),

    ('P10', 'the bounds check for the second pass is the first pass\'s', SRC,
     "        if len(segments) + i >= 2 and segments[i] in CATEGORIES:",
     "        if len(segments) >= 3 and segments[i] in CATEGORIES:"),
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
