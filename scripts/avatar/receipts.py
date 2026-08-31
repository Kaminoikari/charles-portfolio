"""Cross-check RESULT.txt's guard table against the mutation receipts.

Three review rounds in a row were spent on the same defect: the guard table
credits a guard to a receipt that reddens a DIFFERENT check, so the guard has
no proof and the table hides that instead of showing it. Twice it was fixed
one row at a time, which is why it came back. This does the whole table at
once, mechanically.

A guard counts as covered when some receipt section in mutations.md mentions
either the exact string the guard prints when it fails, or the name of the
function/constant that implements it. Matching on the printed label is what
catches the specific error that kept recurring -- crediting verify.py's guard
to a receipt whose output is selftest's differently-worded label for the same
invariant.

    python3 receipts.py <mutations.md>

The receipts file lives outside the repo (it is working evidence, not shipped
code), so its path is required rather than defaulted. Exit 1 lists every guard
with no receipt. Strip this when the guard table in RESULT.txt is generated
from the receipts rather than written by hand.
"""
import re
import sys

# (guard, the line it prints on failure, the identifier that implements it)
GUARDS = [
    ('verify.loud_outlines', 'coloured outlines', 'loud_outlines'),
    ('verify.undeclared_rims', 'materials with no rim colour', 'undeclared_rims'),
    ('verify.unused_materials', 'materials no primitive uses', 'unused_materials'),
    ('verify.misaligned_material_properties',
     'materials out of step with materialProperties',
     'misaligned_material_properties'),
    ('verify.loose_sparse_bounds', 'sparse accessors with wrong min/max',
     'loose_sparse_bounds'),
    ('verify.ragged_targets', 'meshes with uneven morph target counts',
     'ragged_targets'),
    ('verify.torn_shapes', 'grafted shape keys that tear their mesh', 'torn_shapes'),
    ('build.SHAPE_KEY_MIN_MEAN', None, 'SHAPE_KEY_MIN_MEAN'),
    ('selftest: palette -> parts', 'every palette entry names live parts', None),
    ('selftest: palette -> material',
     'every palette entry names a material still in the file', None),
    ('selftest: shape key -> parts', 'every shape key names live parts', None),
    ('selftest: one target count', 'every mesh keeps one morph target count', None),
    ('selftest: no idle material', 'no material is left painting nothing', None),
    ('selftest: materialProperties',
     'materialProperties still line up with materials', None),
    ('selftest: manifest keys displace',
     'shape keys in the manifest still displace', None),
    ('selftest: file keys in manifest',
     'shape keys in the file are all in the manifest', None),
]


def sections(text):
    """mutations.md split into {receipt number: its lines}."""
    out, cur = {}, None
    for line in text.splitlines():
        m = re.match(r'^## (\d+)\.', line)
        if m:
            cur = m.group(1)
        if cur:
            out.setdefault(cur, []).append(line)
    return out


def covered(receipts, label, ident):
    hits = set()
    for num, lines in receipts.items():
        body = '\n'.join(lines)
        if (label and label in body) or (ident and ident in body):
            hits.add(num)
    return sorted(hits, key=int)


def main(mutations_path):
    receipts = sections(open(mutations_path, encoding='utf-8').read())
    naked = []
    for guard, label, ident in GUARDS:
        hits = covered(receipts, label, ident)
        mark = 'ok' if hits else 'NO RECEIPT'
        print(f'  {guard:42s} {str(hits):12s} {mark}')
        if not hits:
            naked.append(guard)
    print(f'\n  {len(GUARDS)} guards, {len(GUARDS) - len(naked)} with a receipt')
    if naked:
        print('  guards with no receipt:')
        for g in naked:
            print(f'    {g}')
        return 1
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('用法：python3 receipts.py <mutations.md>')
    sys.exit(main(sys.argv[1]))
