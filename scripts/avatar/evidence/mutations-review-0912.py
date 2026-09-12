#!/usr/bin/env python3
"""Break one defence added by the review fix at a time.

Baselines are the committed blobs of partition.py and pose.py, handed in as
argv[1] and argv[2] and extracted with `git cat-file blob <sha>:<path>`. The run
refuses to start unless the working files already equal them; nothing is
restored with git, each mutation writes back the exact bytes read at the start
and the restore is asserted byte-for-byte. __pycache__ is cleared before every
run.

Each row declares WHICH tests must go red. Extra failures are reported without
being held against the row; a named test that stays green is the result this
table exists to catch.

    $ git cat-file blob <sha>:scripts/avatar/partition.py > /tmp/p.py
    $ git cat-file blob <sha>:scripts/avatar/pose.py > /tmp/q.py
    $ python3 scripts/avatar/evidence/mutations-review-0912.py /tmp/p.py /tmp/q.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent
PARTITION = HERE / 'partition.py'
POSE = HERE / 'pose.py'
TESTS = ('gate_test', 'pose_test')

MUTATIONS = [
    ('V1', ['a_body_with_no_eye_bone_is_refused'],
     'a body with no eye bone is let through to the frame',
     [(PARTITION,
       "    if 'leftEye' not in humanoid.bones(doc):\n"
       "        reasons.append('沒有 leftEye 骨，髮絲的左右與臉前判準無從量起'\n"
       "                       '（VRM 規格裡眼睛骨是選配的，所以上游的骨架關卡放行）')\n",
       '')]),

    ('V2', ['two_meshes_sharing_one_name_is_refused',
            'a_mesh_with_no_name_at_all_is_refused'],
     'mesh names may repeat or be missing',
     [(PARTITION,
       "    if len(set(named)) != len(named) or any(n is None for n in named):",
       '    if False:')]),

    ('V3', ['it_is_where_the_node_puts_it'],
     "an unskinned primitive is left at its vertex buffer's own coordinates",
     [(POSE,
       "                node = node_of_mesh.get(mi)\n"
       "                hom = np.concatenate([p, np.ones((len(p), 1))], axis=1)\n"
       "                out[(mesh.get('name'), pi)] = (\n"
       "                    p if node is None\n"
       "                    else (hom @ np.asarray(world[node], dtype=np.float64).T)[:, :3])\n",
       "                out[(mesh.get('name'), pi)] = p\n")]),

    ('V4', ['a_material_with_a_token_and_no_part_says_so'],
     'both kinds of unnamable material are reported as carrying no token',
     [(PARTITION,
       "    tokenless = [m for m in unnamed if vroid_category(m)[1] is None]\n"
       "    placeless = [m for m in unnamed if vroid_category(m)[1] is not None]",
       '    tokenless = list(unnamed)\n    placeless = []')]),
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
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    want = {PARTITION: pathlib.Path(sys.argv[1]).read_bytes(),
            POSE: pathlib.Path(sys.argv[2]).read_bytes()}
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
        extra = sorted({line.split(':', 1)[1].strip() for line in failed
                        if not any(frag in line for frag in expect)})
        verdict = 'as expected' if not missing else f'*** STILL GREEN: {missing} ***'
        files = ', '.join(sorted({p.name for p, _, _ in edits}))
        print(f'{tag}  {what}  [{files}]\n    {ran}  '
              f'{"RED" if code else "GREEN"}  {verdict}')
        if extra:
            print(f'    also red: {extra}')
        print()


if __name__ == '__main__':
    main()
