#!/usr/bin/env python3
"""Break one defence of the body-relative hair frame at a time.

Baseline is the committed blob of partition.py, handed in as argv[1] and
extracted with `git cat-file blob <sha>:scripts/avatar/partition.py`. The run
refuses to start unless the working file already equals it; nothing is restored
with git, each mutation writes back the exact bytes read at the start and the
restore is asserted byte-for-byte. __pycache__ is cleared before every run.

Each row declares WHICH tests must go red. Extra failures are reported without
being held against the row; a named test that stays green is the result this
table exists to catch.

    $ git cat-file blob <sha>:scripts/avatar/partition.py > /tmp/partition.committed.py
    $ python3 scripts/avatar/evidence/mutations-hairframe-0912.py /tmp/partition.committed.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent
TARGET = HERE / 'partition.py'
TESTS = ('gate_test',)

MUTATIONS = [
    ('H1', ['below_the_waist_is_below_this_bodys_own_hips'],
     "the waist is Mika's y 0.90 on every body",
     "    if ymin < frame['waist']:             # falls below the waist",
     '    if ymin < 0.90:'),

    ('H2', ['in_front_of_the_face_is_in_front_of_this_bodys_own_eyes'],
     "the front of the face is Mika's z -0.03 on every body",
     "    if (centroid[2] - frame['front']) * frame['forward'] > 0:   "
     "# in front of the eyes",
     '    if centroid[2] < -0.03:'),

    ('H3', ['which_way_is_forward_comes_from_the_export',
            'turning_the_export_around_does_not_move_its_hair'],
     'forward is always -Z, the way a 0.x export has it',
     "    if (centroid[2] - frame['front']) * frame['forward'] > 0:",
     "    if centroid[2] < frame['front']:"),

    ('H4', ['the_back_of_the_head_starts_at_this_bodys_own_crown'],
     "the back of the head starts at Mika's y 1.44 on every body",
     "    if centroid[1] > frame['crown']:", '    if centroid[1] > 1.44:'),

    ('H5', ['off_the_midline_is_wider_than_this_bodys_own_skull'],
     "off the midline is Mika's 0.12 on every body",
     "    if material.endswith(CLIP_DECALS) and abs(centroid[0]) > frame['midline']:",
     '    if material.endswith(CLIP_DECALS) and abs(centroid[0]) > 0.12:'),

    ('H6', ['which_side_is_left_comes_from_the_eye_bone'],
     "left is -X, the way a 0.x export has it",
     "    side = 'L' if centroid[0] * frame['left'] > 0 else 'R'",
     "    side = 'L' if centroid[0] < 0 else 'R'"),

    ('H7', ['turning_the_export_around_does_not_move_its_hair',
            'lifting_the_whole_body_does_not_move_its_hair'],
     'a strand is measured where its vertex buffer says, not in the rest world',
     "                p = rest[(name, index)][used]",
     "                p = glb.read_accessor(\n"
     "                    doc, views, prim['attributes']['POSITION'])[used]"),

    ('H8', ['lifting_the_whole_body_does_not_move_its_hair'],
     'the frame measures the face where its vertex buffer says',
     "    rest, head = pose.skinned(doc, views), face_meshes(doc)[0]\n"
     "    face = np.concatenate([\n"
     "        rest[(head.get('name'), i)][\n"
     "            np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())]\n"
     "        for i, prim in enumerate(head['primitives'])])",
     "    head = face_meshes(doc)[0]\n"
     "    face = np.concatenate([\n"
     "        glb.read_accessor(doc, views, prim['attributes']['POSITION'])[\n"
     "            np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())]\n"
     "        for prim in head['primitives']])"),
]


def run():
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
    p = subprocess.run([sys.executable, '-m', 'unittest', *TESTS],
                       cwd=HERE, capture_output=True, text=True)
    tail = p.stderr.strip().splitlines()
    ran = next((l for l in tail if l.startswith('Ran ')), '?')
    failed = [l for l in tail if l.startswith('FAIL:') or l.startswith('ERROR:')]
    return p.returncode, ran, failed


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    committed = pathlib.Path(sys.argv[1]).read_bytes()
    if TARGET.read_bytes() != committed:
        raise SystemExit('partition.py differs from the committed blob: refusing to '
                         'start, because this run would restore to a mutated file')

    code, ran, failed = run()
    if code != 0:
        raise SystemExit(f'baseline is not green ({ran}); nothing below would mean anything')
    sha = subprocess.run(['git', 'hash-object', str(TARGET)],
                         capture_output=True, text=True, check=True).stdout.strip()
    print(f'partition.py  blob {sha}\nbaseline  {ran}  green\n')

    for tag, expect, what, old, new in MUTATIONS:
        base = TARGET.read_bytes()
        text = base.decode()
        hits = text.count(old)
        assert hits == 1, f'{tag}: PATTERN HIT {hits} TIMES'
        TARGET.write_bytes(text.replace(old, new).encode())
        try:
            code, ran, failed = run()
        finally:
            TARGET.write_bytes(base)
            assert TARGET.read_bytes() == base, f'{tag}: restore failed'
        missing = [frag for frag in expect
                   if not any(frag in line for line in failed)]
        # A class whose setUpClass errors reports one line naming the class,
        # not one per test, so an expectation has to be able to name either.
        extra = sorted({line.split(':', 1)[1].strip() for line in failed
                        if not any(frag in line for frag in expect)})
        verdict = 'as expected' if not missing else f'*** STILL GREEN: {missing} ***'
        print(f'{tag}  {what}\n    {ran}  {"RED" if code else "GREEN"}  {verdict}')
        if extra:
            print(f'    also red: {extra}')
        print()


if __name__ == '__main__':
    main()
