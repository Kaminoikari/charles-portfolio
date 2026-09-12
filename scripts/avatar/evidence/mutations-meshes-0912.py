#!/usr/bin/env python3
"""Break one defence of the content-derived mesh roles at a time.

Baseline is the committed blob of partition.py, handed in as argv[1] and
extracted with `git cat-file blob <sha>:scripts/avatar/partition.py`. The run
refuses to start unless the working file already equals it; nothing is restored
with git, each mutation writes back the exact bytes read at the start and the
restore is asserted byte-for-byte. __pycache__ is cleared before every run.

Each row declares WHICH tests must go red. Extra failures are reported without
being held against the row; a named test that stays green is the result this
table exists to catch.

    $ git cat-file blob <sha>:scripts/avatar/partition.py > /tmp/partition.committed.py
    $ python3 scripts/avatar/evidence/mutations-meshes-0912.py /tmp/partition.committed.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent
TARGET = HERE / 'partition.py'
TESTS = ('gate_test',)

MUTATIONS = [
    ('M1', ['found_by_its_materials_not_its_name',
            'BodyWhoseMeshesAreNotNamedBaked'],
     'the face is the mesh literally called Face.baked again',
     "    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]\n"
     "    return [mesh for mesh in doc['meshes']\n"
     "            if any(vroid_category(mats[p['material']])[1] == FACE_CATEGORY\n"
     "                   for p in mesh['primitives'])]",
     "    return [mesh for mesh in doc['meshes'] if mesh.get('name') == 'Face.baked']"),

    ('M2', ['two_meshes_carrying_face_materials_are_refused'],
     'any number of face meshes will do, as long as there is one',
     '    if len(faces) != 1:', '    if len(faces) < 1:'),

    ('M3', ['a_face_mesh_carrying_no_morph_targets_is_refused'],
     'the face mesh is not asked for the morph targets it is locked for',
     "    elif not any(p.get('targets') for p in faces[0]['primitives']):",
     '    elif False:'),

    ('M4', ['a_hand_authored_material_in_any_mesh_is_refused'],
     'only the mesh called Body.baked is checked for names it cannot read',
     "                      for mesh in doc['meshes'] if id(mesh) not in ids",
     "                      for mesh in doc['meshes']\n"
     "                      if mesh.get('name') == 'Body.baked'"),

    ('M5', ['the_body_this_step_was_written_for_is_recognised',
            'a_hair_strand_is_not_a_material_it_cannot_name',
            'BodyPartsFromTheExportGrammar'],
     'a hair strand counts as a material the grammar cannot place',
     "                      if body_name(mats[p['material']]) is None\n"
     "                      and not is_strand(mats[p['material']])})",
     "                      if body_name(mats[p['material']]) is None})"),

    ('M6', ['the_two_kinds_of_hair_are_told_apart_by_their_part_name',
            'BodyPartsFromTheExportGrammar'],
     'every HAIR material is the one baked-in back-hair object again',
     "        return 'Hair_BodyBack' if part == HAIR_OBJECT else None",
     "        return 'Hair_BodyBack'"),

    ('M7', ['a_matcap_part_is_named_as_an_accessory'],
     'a MATCAP accessory has no name, so its body is refused',
     "    if category == 'MATCAP':", '    if False:'),

    ('M8', ['BodyWhoseMeshesAreNotNamedBaked'],
     'the grammar is consulted only inside a mesh called Body.baked',
     "            material = mats[prim['material']]\n"
     "            label = body_name(material)\n"
     "            if label is None:",
     "            material = mats[prim['material']]\n"
     "            label = body_name(material) if name == 'Body.baked' else None\n"
     "            if label is None:"),
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
