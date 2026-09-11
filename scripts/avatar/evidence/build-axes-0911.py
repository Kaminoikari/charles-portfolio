#!/usr/bin/env python3
"""Which axis owns each of build.py's module-level constants.

Step 1 of docs/plans/avatar-build-module-contracts.md. The assignment below is
made by reading each constant's CONSUMER, never its name or its value: a string
match cannot tell SKIN_TARGET (a colour read off one character's reference
sheet) from OUTLINE_CHROMA_MAX (a cap on how colourful any outline may be), and
it reads MELLOW_STANDOFF as outfit-only when its value is that outfit on THIS
body.

Run from the repo root. It asserts two things rather than printing a table.

The FIRST is the classification itself, against the build.py that was classified
(the blob at STEP1, before steps 2-4 moved anything): every constant the AST
finds there is assigned exactly once, and nothing is assigned that the AST does
not find. That keeps the table reproducible after the constants have left.

The SECOND is a living check on today's build.py: everything it still declares
has to be one this table called `pipeline`, or be listed in SINCE with the axis
it was given. A new constant added to build.py turns this red until somebody
decides which axis owns it, which is the drift the table exists to stop. The
moved constants are guarded separately, by the `build declares none of` tests in
characters_test, outfits_test and bodies_test.

    $ python3 scripts/avatar/evidence/build-axes-0911.py
"""
import ast, collections, pathlib, subprocess

STEP1 = '135d33b'          # docs(avatar): decide which axis owns each constant
AXES = {
 'base-body': """HEAD_HAIR OUTLINE_KEEP SCALP_HUE SCALP_WINDOW SCALP_FRINGE_TO
                 SCALP_FRINGE_SAT""".split(),
 'outfit': """MELLOW MELLOW_OUTER MELLOW_BONEMAP MELLOW_PARTS MELLOW_TINT
              MELLOW_GAIN THIGH_BAND_SOURCE_MATERIAL""".split(),
 'outfit x body': """MELLOW_SHIFT MELLOW_LOOSEN MELLOW_STANDOFF
                     MELLOW_BIND_SMOOTH THIGH_BAND_FINAL_CLEARANCE""".split(),
 'character': """HEAD EAR_INNER EAR_INNER_SHADE BOWL_MEAN GOLD_RAMP CROWN_SHIFT
                 CROWN_LIGHT HAND_GARMENTS BLENDER_PARTS HAIR_SHIFT HAIR_SAT
                 HAIR_LIFT HAIR_UNIFY HAIR_MATERIAL_TONE HAIR_SHADE_TONE
                 BROW_SHIFT BROW_SAT SKIN_TARGET SKIN_MATERIAL_TONE
                 OUTLINE_VALUE EYE_TARGET PALETTE RIM_COLOR OUTLINE_COLOR""".split(),
 'pipeline': """TAIL_COAT_INTRUSION_MAX TAIL_COAT_INSIDE_SHARE_MAX
                SHAPE_KEY_MIN_MEAN BOW_GAP_MAX HAIR_FLATTEN_BLOCKS
                OUTLINE_CHROMA_MAX NECK_MARGIN WAIST_SEARCH TORSO_EDGES""".split(),
}
# Constants build.py gained after the table was drawn, with the axis they were
# given. LEG_EDGES is the knee-to-hip counterpart of TORSO_EDGES: the fractions
# are a shape of this body, and the reader is the same clearance code, so it is
# a gate rather than one character's value.
SINCE = {'LEG_EDGES': 'pipeline'}


def constants(source):
    found = set()
    for node in ast.parse(source).body:
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for t in targets:
                for s in ast.walk(t):
                    if isinstance(s, ast.Name) and s.id.isupper():
                        found.add(s.id)
    return found


claimed = [n for names in AXES.values() for n in names]
dupes = [n for n, c in collections.Counter(claimed).items() if c > 1]
assert not dupes, f'assigned to more than one axis: {dupes}'

blob = subprocess.run(['git', 'show', f'{STEP1}:scripts/avatar/build.py'],
                      capture_output=True, text=True, check=True).stdout
actual = constants(blob)
missing = actual - set(claimed)
extra = set(claimed) - actual
assert not missing, f'in build.py at {STEP1} but unclassified: {sorted(missing)}'
assert not extra, f'classified but not in build.py at {STEP1}: {sorted(extra)}'

allowed = set(AXES['pipeline']) | set(SINCE)
today = constants(pathlib.Path('scripts/avatar/build.py').read_text())
unowned = sorted(today - allowed)
assert not unowned, ('build.py declares a constant no axis owns; add it to SINCE '
                     f'with the axis that owns it: {unowned}')
gone = sorted(n for n in SINCE if n not in today)
assert not gone, f'SINCE lists a constant build.py no longer declares: {gone}'

for axis, names in AXES.items():
    print(f'{axis:16} {len(names):>3}')
print(f'{"TOTAL":16} {len(claimed):>3}   (AST found {len(actual)} at {STEP1})')
print(f'\nstill in build.py today: {len(today)}   '
      f'({len(AXES["pipeline"])} pipeline + {len(SINCE)} added since)')
