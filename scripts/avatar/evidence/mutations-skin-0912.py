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
    ('S1', ['a_hole_that_swallows', 'no_dark_blotch', 'non_square'],
     'the pyramid stops after nine halvings again',
     [(SRC, *NINE)]),

    ('S2', ['non_square'],
     'half() halves a dimension that is already one',
     [(SRC, *OLD_HALF)]),

    ('S3', ['a_hole_that_swallows', 'non_square'],
     'nine halvings, judged on the body nine was tuned for',
     [(SRC, *NINE), (TEST, *FIXTURE)]),

    # apply() resolves the material itself, so body_image's default is reached
    # only by a caller that omits it, which is what the face-atlas row does.
    ('S4', ['face_atlas'],
     "the body's skin material is one body's name written down again",
     [(SRC, "def body_image(doc, material=None):", "def body_image(doc, material='F00_000_00_Body_00_SKIN'):")]),

    # Dropping the part name lets the FIRST SKIN material win, and on these
    # files that is the face's. So skin_material returns the wrong name, and
    # every row that asks which image the body uses follows it there.
    ('S5', ['face_atlas', 'model_number', 'the_written_down_name_did'],
     'any SKIN material will do, whichever part it belongs to',
     [(SRC,
       "        if partition.vroid_category(material.get('name', '')) == (BODY_PART, 'SKIN'):",
       "        if partition.vroid_category(material.get('name', ''))[1] == 'SKIN':")]),

    ('S6', ['the_body_and_not_what_it_is_wearing', 'clothing_sized_survives'],
     "skin is whatever is bright enough, at one body's brightness",
     [(SRC,
       "    return ((r > g) & (g >= b) & ((r - b) > 22) & ((r - b) < 170)\n"
       "            & (distance <= SKIN_RADIUS))",
       "    return ((r > g) & (g >= b) & ((r - b) > 22) & ((r - b) < 170)\n"
       "            & (r > 105))")]),

    # Vita's arm bones drive a teal sleeve, so the median there is not skin and
    # every real texel falls outside the radius.
    ('S7', ['does_not_come_from_a_sleeve'],
     "the body's colour is read off the whole arm, sleeve and all",
     [(SRC, "             if humanoid.is_hand(bone)}",
             "             if humanoid.is_arm(bone)}")]),

    # No floor means every vertex counts, so the reference becomes the median
    # of the whole atlas: [108 102 108] on AvatarSample_A, 31 from the garment
    # it is supposed to reject.
    ('S8', ['the_body_and_not_what_it_is_wearing'],
     'any vertex will do, however little of it the hand drives',
     [(SRC, "            picked = drawn[(w * on_hand[j]).sum(axis=1)[drawn] >= 0.9]",
             "            picked = drawn[(w * on_hand[j]).sum(axis=1)[drawn] >= 0.0]")]),
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
        # `expect` is what MUST go red: the defences this mutation removes.
        # A mutation often reddens more than that (a stubbed lookup takes a
        # setUpClass down with it), and those are reported without being held
        # against it. The result this table exists to catch is an expected name
        # that stayed green, which means nothing was guarding it.
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
