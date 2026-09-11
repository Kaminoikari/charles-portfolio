#!/usr/bin/env python3
"""Break one defence of the base-body contract at a time and record what goes red.

Same rules as the other two runners: committed blobs handed in, refuses to start
unless the working files equal them, each pattern must hit exactly once, each
restore asserted byte-for-byte.

This axis has two kinds of defence and both are mutated here. The hair material
names are DERIVED, so their mutations break the derivation; the export's texture
names and the scalp hues are DECLARED, so theirs put a literal back. The last
two are the absolute heights, whose tests live in build_test rather than
bodies_test, which is why this runner runs both modules.

    $ git cat-file blob <sha>:scripts/avatar/build.py > /tmp/build.committed.py
    $ git cat-file blob <sha>:scripts/avatar/bodies/mika_base.py > /tmp/mb.committed.py
    $ python3 scripts/avatar/evidence/mutations-bodies-0911.py \
          /tmp/build.committed.py /tmp/mb.committed.py
"""
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
BUILD = HERE / 'build.py'
BODY = HERE / 'bodies' / 'mika_base.py'
TESTS = ['bodies_test', 'build_test']

MUTATIONS = [
    ('B1', 'the head accessories name their hair material again', BUILD,
     "                    if m['name'] == hair_mats[0])",
     "                    if m['name'] == 'F00_000_Hair_00_HAIR_02')"),

    ('B2', 'a hair texture is spelled inline again', BUILD,
     "    for image in base_body.HAIR_TEXTURES:",
     "    for image in (f'F00_000_Hair_00_0{i}' for i in range(1, 7)):"),

    ('B3', 'the hair material is picked by name rather than by coverage', BUILD,
     "    return sorted(tris, key=lambda n: (-tris[n], n))",
     "    return sorted(tris)"),

    ('B4', 'a material this build added counts as the body\'s own', BUILD,
     "            if name not in known:\n                continue",
     "            if False:\n                continue"),

    ('B5', 'a body whose hair cannot be found is allowed through', BUILD,
     "    if not hair_mats:\n        raise SystemExit(",
     "    if False:\n        raise SystemExit("),

    ('B6', 'only the main hair material keeps its black outline', BUILD,
     "    moved = customise.outline(doc, outline, skip=hair_mats)",
     "    moved = customise.outline(doc, outline, skip=hair_mats[:1])"),

    ('B7', 'the scalp window is read off build.py again', BUILD,
     "        face_rgba[..., :3], face_rgba[..., 3],\n"
     "        base_body.SCALP_HUE, base_body.SCALP_WINDOW,",
     "        face_rgba[..., :3], face_rgba[..., 3],\n"
     "        261.0, 45.0,"),

    ('B8', 'the scalp window is widened until it reaches the skin', BODY,
     "SCALP_HUE, SCALP_WINDOW = 261.0, 45.0",
     "SCALP_HUE, SCALP_WINDOW = 261.0, 300.0"),

    ('B9', 'a button height is typed back in', BUILD,
     "    for y in (edge['button_low'], edge['button_mid'], edge['button_high']):",
     "    for y in (0.945, 1.005, 1.065):"),

    ('B10', 'the torso edges become offsets rather than fractions', BUILD,
     "    return {name: lm['waist'] + span * f for name, f in TORSO_EDGES.items()}",
     "    return {name: 0.96 + 0.2551 * f for name, f in TORSO_EDGES.items()}"),
]


def run():
    p = subprocess.run([sys.executable, '-m', 'unittest', *TESTS],
                       cwd=HERE, capture_output=True, text=True)
    tail = p.stderr.strip().splitlines()
    ran = next((l for l in tail if l.startswith('Ran ')), '?')
    failed = [l for l in tail if l.startswith('FAIL:') or l.startswith('ERROR:')]
    return p.returncode, ran, failed


def main():
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    want = {BUILD: pathlib.Path(sys.argv[1]).read_bytes(),
            BODY: pathlib.Path(sys.argv[2]).read_bytes()}
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
