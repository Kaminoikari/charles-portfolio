#!/usr/bin/env python3
"""Which axis owns each of build.py's module-level constants.

Step 1 of docs/plans/avatar-build-module-contracts.md. The assignment below is
made by reading each constant's CONSUMER, never its name or its value: a string
match cannot tell SKIN_TARGET (a colour read off one character's reference
sheet) from OUTLINE_CHROMA_MAX (a cap on how colourful any outline may be), and
it reads MELLOW_STANDOFF as outfit-only when its value is that outfit on THIS
body.

Run from the repo root. It asserts the partition rather than printing one: every
constant the AST finds is assigned exactly once, and nothing is assigned that
the AST does not find. That is what stops the table drifting from the file as
constants are added or moved out.

    $ python3 scripts/avatar/evidence/build-axes-0911.py
"""
import ast, pathlib, collections
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
tree = ast.parse(pathlib.Path('scripts/avatar/build.py').read_text())
actual = set()
for node in tree.body:
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        for t in (node.targets if isinstance(node, ast.Assign) else [node.target]):
            for s in ast.walk(t):
                if isinstance(s, ast.Name) and s.id.isupper(): actual.add(s.id)

claimed = [n for names in AXES.values() for n in names]
dupes = [n for n, c in collections.Counter(claimed).items() if c > 1]
assert not dupes, f'assigned to more than one axis: {dupes}'
missing = actual - set(claimed)
extra = set(claimed) - actual
assert not missing, f'in build.py but unclassified: {sorted(missing)}'
assert not extra, f'classified but not in build.py: {sorted(extra)}'
for axis, names in AXES.items():
    print(f'{axis:16} {len(names):>3}')
print(f'{"TOTAL":16} {len(claimed):>3}   (AST found {len(actual)})')
