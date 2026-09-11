"""What the base body brings, and what build.py is no longer allowed to assume.

Two different answers on this axis, and the split is the point.

The two VRoid hair material names are DERIVED. A name has somewhere stable to be
read from -- the primitives the partition labelled `Hair_*` -- so build.py finds
them rather than spelling them, and the tests below are behavioural: a doc whose
hair is called something else still works, and one with no hair at all is
refused rather than silently skipped.

The four scalp values are MEASURED and live in a body contract. Finding a cap in
an atlas without being told where it is means clustering texels by colour, on a
body where the blush sits 9 degrees from the lips; until that exists, a number
that says which export it came from is the honest form. Those tests are the same
contract-and-wiring shape as characters_test and outfits_test.
"""
import ast
import os
import sys
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
from bodies import mika_base  # noqa: E402

# What build.py spelled before the derivation. A revert brings these back.
FORMER_NAMES = ('HEAD_HAIR', 'OUTLINE_KEEP')


def source():
    with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
        return fh.read()


def names_of(module):
    return {n for n in dir(module) if n.isupper()}


def hair_doc(parts, extra_materials=()):
    """A doc with one mesh, one primitive per (part, material, tris) triple."""
    materials, prims, accessors = [], [], []
    for part, material, tris in parts:
        if material not in materials:
            materials.append(material)
        accessors.append({'count': tris * 3})
        prims.append({'material': materials.index(material),
                      'indices': len(accessors) - 1,
                      'extras': {'part': part}})
    for m in extra_materials:
        if m not in materials:
            materials.append(m)
    return {'meshes': [{'primitives': prims}],
            'materials': [{'name': m} for m in materials],
            'accessors': accessors}


class Derived(unittest.TestCase):
    def test_the_hair_material_is_the_one_covering_most_of_the_hair(self):
        doc = hair_doc([('Hair_Bangs', 'fringe', 1122),
                        ('Hair_Back', 'main', 10020),
                        ('Hair_Side_L', 'trim', 64)])
        known = {'fringe', 'main', 'trim'}
        self.assertEqual(build.body_hair_materials(doc, known), ['main', 'fringe', 'trim'])

    def test_a_body_that_names_its_hair_anything_still_works(self):
        """The whole reason this is derived: the next export spells it its way."""
        doc = hair_doc([('Hair_Back', 'SomeOtherVendor_Hair_Long', 900),
                        ('Hair_Bangs', 'SomeOtherVendor_Hair_Fringe', 100)])
        self.assertEqual(build.body_hair_materials(doc, {'SomeOtherVendor_Hair_Long',
                                                    'SomeOtherVendor_Hair_Fringe'}),
                         ['SomeOtherVendor_Hair_Long', 'SomeOtherVendor_Hair_Fringe'])

    def test_a_material_this_build_added_is_not_the_bodys_own(self):
        """The inner ear is a hair part and brings its own material."""
        doc = hair_doc([('Hair_Back', 'main', 900),
                        ('Hair_Ear_L', 'Milfy_EarInner', 400)])
        self.assertEqual(build.body_hair_materials(doc, {'main'}), ['main'])

    def test_only_hair_parts_count(self):
        doc = hair_doc([('Hair_Back', 'main', 100),
                        ('Outfit_Top', 'cloth', 9000),
                        ('Face', 'skin', 9000)])
        self.assertEqual(build.body_hair_materials(doc, {'main', 'cloth', 'skin'}), ['main'])

    def test_a_tie_is_broken_by_name_so_two_runs_agree(self):
        doc = hair_doc([('Hair_A', 'b_mat', 100), ('Hair_B', 'a_mat', 100)])
        self.assertEqual(build.body_hair_materials(doc, {'a_mat', 'b_mat'}), ['a_mat', 'b_mat'])

    def test_a_body_with_no_hair_parts_gives_nothing_to_fall_back_on(self):
        self.assertEqual(build.body_hair_materials(hair_doc([('Outfit_Top', 'cloth', 9)]),
                                              {'cloth'}), [])

    def test_the_texture_names_all_come_from_the_contract(self):
        """Twenty-two inline occurrences of the text F00_000 on eighteen lines
        until 2026-09-11, spelling the twelve names this contract declares, and
        not one of the twenty-two was a constant, so listing build.py's
        constants did not find any of them. The file held twenty-four in all:
        the other two were HEAD_HAIR and OUTLINE_KEEP, which the inventory did
        find. Counted on the blob at 8de2d67 with `rg -o F00_000 | wc -l` (24),
        `rg -c F00_000` (20), less the two constant lines."""
        self.assertNotIn('F00_000', source(),
                         'build.py spells a VRoid name again')

    def test_the_build_refuses_a_body_whose_hair_it_cannot_find(self):
        """Empty is not a default. Falling through would recolour the hair's
        outline with the skin's, on every hair material at once."""
        self.assertRegex(source(), r'if not hair_mats:\n\s*raise SystemExit\(')

    def test_the_head_accessories_reuse_the_derived_material(self):
        src = source()
        self.assertRegex(src, r"if m\['name'\] == hair_mats\[0\]")
        self.assertRegex(src, r'customise\.outline\(doc, outline, skip=hair_mats\)')

    def test_no_vroid_material_name_is_spelled_in_the_build(self):
        declared = {s.id for node in ast.parse(source()).body
                    if isinstance(node, ast.Assign)
                    for t in node.targets for s in ast.walk(t)
                    if isinstance(s, ast.Name)}
        for name in FORMER_NAMES:
            self.assertNotIn(name, declared, f'build.py declares {name} again')


class Measured(unittest.TestCase):
    def test_build_declares_none_of_the_bodys_values(self):
        declared = {s.id for node in ast.parse(source()).body
                    if isinstance(node, ast.Assign)
                    for t in node.targets for s in ast.walk(t)
                    if isinstance(s, ast.Name) and s.id.isupper()}
        clash = sorted(declared & names_of(mika_base))
        self.assertEqual(clash, [], f'build.py declares a body value again: {clash}')

    def test_build_does_not_import_one_bodys_values_by_name(self):
        for node in ast.walk(ast.parse(source())):
            if isinstance(node, ast.ImportFrom) and (node.module or '').startswith('bodies'):
                self.assertEqual({a.name for a in node.names} & names_of(mika_base), set(),
                                 'build.py imports a body value by name')

    def test_build_takes_the_body_as_an_argument(self):
        self.assertRegex(source(), r'base_body=mika_base\):')

    def test_every_value_in_the_contract_is_read_somewhere(self):
        src = source()
        unread = sorted(n for n in names_of(mika_base) if f'base_body.{n}' not in src)
        self.assertEqual(unread, [], f'declared but never read through base_body: {unread}')

    def test_the_scalp_window_reaches_both_exports_and_neither_the_skin(self):
        """The window's whole job, restated as arithmetic rather than prose.

        The cap measured 265 on the untouched export and 257 after the pink
        repaint; the skin sits at 9 and the lips at 0. A window that misses
        either cap leaves a purple parting, and one that reaches the skin
        recolours a face.
        """
        lo = mika_base.SCALP_HUE - mika_base.SCALP_WINDOW
        hi = mika_base.SCALP_HUE + mika_base.SCALP_WINDOW
        for cap in (265.0, 257.0):
            self.assertTrue(lo <= cap <= hi, f'the window misses a cap at {cap}')
        for skin in (9.0, 0.0):
            self.assertFalse(lo <= skin <= hi, f'the window reaches the skin at {skin}')

    def test_the_fringe_arc_ends_before_the_blush_and_the_lips(self):
        """It walks from the cap through magenta toward skin and stops short."""
        self.assertGreater(mika_base.SCALP_FRINGE_TO,
                           mika_base.SCALP_HUE + mika_base.SCALP_WINDOW)
        self.assertLess(mika_base.SCALP_FRINGE_TO, 360.0)


class Wiring(unittest.TestCase):
    def test_the_scalp_solve_reads_the_body_for_both_atlases(self):
        src = source()
        self.assertEqual(src.count('base_body.SCALP_HUE, base_body.SCALP_WINDOW'), 2,
                         'the face and the body atlas must read the same window')
        for typed in (r'SCALP_HUE, SCALP_WINDOW,', r'fringe_to=SCALP_FRINGE_TO'):
            self.assertNotRegex(src, typed, 'build() reads a scalp value off itself again')


if __name__ == '__main__':
    unittest.main(verbosity=2)
