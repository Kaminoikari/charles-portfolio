#!/usr/bin/env python3
"""Break one defence of the computed drop list at a time.

Baselines are the committed blobs, handed in as argv[1] (make.py), argv[2]
(customise.py) and argv[3] (outfits/mellowheart.py), extracted with
`git cat-file blob <sha>:<path>`. The run refuses to start unless the working
files already equal them; nothing is restored with git, each mutation writes
back the exact bytes read at the start and the restore is asserted
byte-for-byte. __pycache__ is cleared before every run.

Each row declares WHICH tests must go red. Extra failures are reported without
being held against the row; a named test that stays green is the result this
table exists to catch.

    $ git cat-file blob <sha>:scripts/avatar/make.py > /tmp/make.committed.py
    ...
    $ python3 scripts/avatar/evidence/mutations-replaces-0912.py \\
          /tmp/make.committed.py /tmp/customise.committed.py /tmp/mellow.committed.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
MAKE = HERE / 'make.py'
CUSTOMISE = HERE / 'customise.py'
OUTFIT = HERE / 'outfits' / 'mellowheart.py'
TESTS = ('customise_test', 'outfits_test')

MUTATIONS = [
    ('R1', ['asked_of_the_contract'],
     'make.py holds the five names it used to hold',
     [(MAKE,
       "        drop = customise.replaced(m, mellowheart.REPLACES)",
       "        drop = ['Outfit_Top', 'Outfit_Bottom', 'Outfit_Shoes',\n"
       "                'Acc_HairOrnament', 'Acc_HairClip_Base']")]),

    ('R2', ['a_part_the_manifest_locks'],
     'a part the manifest locks is asked for anyway',
     [(CUSTOMISE,
       "                  if name.startswith(tuple(prefixes))\n"
       "                  and part.get('deletable', True))",
       "                  if name.startswith(tuple(prefixes)))")]),

    # The contract's own value, against the base body it was fitted to.
    ('R3', ['resolve_to_what_the_written_down_list_held'],
     "the outfit replaces garments but leaves the base body's hair clips on",
     [(OUTFIT, "REPLACES = ('Outfit_', 'Acc_')", "REPLACES = ('Outfit_',)")]),

    # A prefix that matches nothing must not be an error, or a body without a
    # lower garment is refused rather than dressed.
    ('R4', ['a_body_without_a_lower_garment', 'never_seen_still_comes_off'],
     'the prefixes are matched as whole names again',
     [(CUSTOMISE,
       "                  if name.startswith(tuple(prefixes))",
       "                  if name in tuple(prefixes)")]),

    # list() rather than dropping sorted() outright: a bare generator would
    # fail every row on its type, which proves nothing about the ordering.
    ('R5', ['the_five_names_make_py_used_to_hold', 'a_body_without_a_lower_garment'],
     'the list comes out in whatever order the manifest happened to store',
     [(CUSTOMISE,
       "    return sorted(name for name, part in manifest['parts'].items()",
       "    return list(name for name, part in manifest['parts'].items()")]),
]


def run():
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
    shutil.rmtree(HERE / 'outfits' / '__pycache__', ignore_errors=True)
    p = subprocess.run([sys.executable, '-m', 'unittest', *TESTS],
                       cwd=HERE, capture_output=True, text=True)
    tail = p.stderr.strip().splitlines()
    ran = next((l for l in tail if l.startswith('Ran ')), '?')
    failed = [l for l in tail if l.startswith('FAIL:') or l.startswith('ERROR:')]
    return p.returncode, ran, failed


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    want = {MAKE: pathlib.Path(sys.argv[1]).read_bytes(),
            CUSTOMISE: pathlib.Path(sys.argv[2]).read_bytes(),
            OUTFIT: pathlib.Path(sys.argv[3]).read_bytes()}
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
        missing = [frag for frag in expect
                   if not any(frag in line for line in failed)]
        extra = [line.split('(')[0].split(':')[1].strip() for line in failed
                 if not any(frag in line for frag in expect)]
        verdict = 'as expected' if not missing else f'*** STILL GREEN: {missing} ***'
        files = ', '.join(sorted({p.name for p, _, _ in edits}))
        print(f'{tag}  {what}  [{files}]\n    {ran}  '
              f'{"RED" if code else "GREEN"}  {verdict}')
        if extra:
            print(f'    also red: {sorted(extra)}')
        print()


if __name__ == '__main__':
    main()
