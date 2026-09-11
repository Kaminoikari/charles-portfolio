#!/usr/bin/env python3
"""Break one defence of the outfit contract at a time and record what goes red.

Same rules as mutations-characters-0911.py: the committed blobs are handed in,
the run refuses to start unless both working files already equal them, each
pattern must hit exactly once, and the restore is asserted byte-for-byte.

Two files rather than one, because this contract has a defence that lives in the
contract itself: the FIT banner marking the five values that are this package on
this body. A mutation that deletes it has to be able to reach it.

    $ git cat-file blob <sha>:scripts/avatar/build.py > /tmp/build.committed.py
    $ git cat-file blob <sha>:scripts/avatar/outfits/mellowheart.py > /tmp/mh.committed.py
    $ python3 scripts/avatar/evidence/mutations-outfits-0911.py \
          /tmp/build.committed.py /tmp/mh.committed.py
"""
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent      # scripts/avatar
BUILD = HERE / 'build.py'
PACK = HERE / 'outfits' / 'mellowheart.py'
TESTS = 'outfits_test'

# (tag, what, which file, pattern, replacement)
MUTATIONS = [
    ('O1', 'build.py declares the package\'s colours of its own again', BUILD,
     "def outfit_files(dst, outfit_pack):",
     "MELLOW_TINT = {}\n\n\ndef outfit_files(dst, outfit_pack):"),

    ('O2', 'build.py imports one package\'s value by name', BUILD,
     "from outfits import mellowheart\n",
     "from outfits import mellowheart\nfrom outfits.mellowheart import TINT  # noqa: F401\n"),

    ('O3', 'outfit_files names the two garment files itself', BUILD,
     "    paths = [os.path.join(os.path.dirname(dst), f) for f in outfit_pack.FILES]",
     "    paths = [os.path.join(os.path.dirname(dst), f)\n"
     "             for f in ('blender/mellow.glb', 'blender/mellow_outer.glb')]"),

    ('O4', 'the imported outfit is coloured from mellowheart directly', BUILD,
     "            bundle = outfit.load(path, doc, views, wear, outfit_pack.TINT,\n"
     "                                 outfit_pack.GAIN, override=outfit_pack.BONEMAP)",
     "            bundle = outfit.load(path, doc, views, wear, mellowheart.TINT,\n"
     "                                 mellowheart.GAIN, override=mellowheart.BONEMAP)"),

    ('O5', 'a clearance is written back into build()', BUILD,
     "            standoff_amount = outfit_pack.STANDOFF.get(name)",
     "            standoff_amount = {'Outfit_Cardigan': 0.010}.get(name)"),

    ('O6', 'the FIT banner is dropped from the contract', PACK,
     "# FIT: this outfit on this body.",
     "# Assorted clearances."),

    ('O8', 'the vendor mesh name is typed back into build()', BUILD,
     "            band_part = outfit_pack.THIGH_BAND_PART\n"
     "            if any(item['name'] == band_part for item in accepted_items):",
     "            band_part = 'Leg_belt'\n"
     "            if any(item['name'] == 'Leg_belt' for item in accepted_items):"),

    ('O9', 'the contract claims a thigh band the package has no part for', PACK,
     "THIGH_BAND_PART = 'Leg_belt'",
     "THIGH_BAND_PART = 'Thigh_Belt'"),

    ('O10', 'the importer stamps a prefix the contract does not declare', PACK,
     "MATERIAL_PREFIX = 'Mellow_'",
     "MATERIAL_PREFIX = 'MellowHeart_'"),

    ('O7', 'the bonemap path forgets it moved a directory deeper', PACK,
     "BONEMAP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),",
     "BONEMAP = os.path.join(os.path.dirname(os.path.abspath(__file__)),"),
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
    want = {BUILD: pathlib.Path(sys.argv[1]).read_bytes(),
            PACK: pathlib.Path(sys.argv[2]).read_bytes()}
    for path, committed in want.items():
        if path.read_bytes() != committed:
            raise SystemExit(f'{path.name} differs from the committed blob: refusing to '
                             'start, because this run would restore to a mutated file')

    code, ran, failed = run()
    if code != 0:
        raise SystemExit(f'baseline is not green ({ran}); nothing below would mean anything')
    for path in want:
        sha = subprocess.run(['git', 'hash-object', str(path)],
                             capture_output=True, text=True, check=True).stdout.strip()
        print(f'{path.name:22} blob {sha}')
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
