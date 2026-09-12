"""build.py reads one garment package through its `outfit_pack` argument.

Same two questions as characters_test, asked of the other axis. Does handing
build a different package change what it does, and is there anywhere left in
build.py where the package's vocabulary can be typed in?

There is a third question here that the character axis does not have. Five of
these values are the package ON a body rather than the package itself, they are
keyed by our part names rather than the vendor's, and that makes them look
reusable when they are not. The FIT banner in the contract is what says so, and
one test below asserts the banner is still there, because a section that quietly
loses its label is a section the next person merges into the rest.
"""
import ast
import os
import sys
import tempfile
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
import customise  # noqa: E402
import partition  # noqa: E402
from outfits import mellowheart  # noqa: E402

# The names build.py used before the move. A revert would bring these back, and
# they are exactly what the AST checks below look for.
FORMER = {'MELLOW', 'MELLOW_OUTER', 'MELLOW_BONEMAP', 'MELLOW_PARTS', 'MELLOW_SHIFT',
          'MELLOW_LOOSEN', 'MELLOW_STANDOFF', 'MELLOW_BIND_SMOOTH', 'MELLOW_TINT',
          'MELLOW_GAIN', 'THIGH_BAND_SOURCE_MATERIAL', 'THIGH_BAND_FINAL_CLEARANCE'}


def source():
    with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
        return fh.read()


def names_of(module):
    return {n for n in dir(module) if n.isupper()}


def declared_in_build():
    declared = set()
    for node in ast.parse(source()).body:
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for t in targets:
                for s in ast.walk(t):
                    if isinstance(s, ast.Name) and s.id.isupper():
                        declared.add(s.id)
    return declared


class Contract(unittest.TestCase):
    def test_build_declares_none_of_the_packages_values(self):
        clash = sorted(declared_in_build() & (names_of(mellowheart) | FORMER))
        self.assertEqual(clash, [], f'build.py declares a package value again: {clash}')

    def test_build_does_not_import_one_packages_values_by_name(self):
        for node in ast.walk(ast.parse(source())):
            if isinstance(node, ast.ImportFrom) and (node.module or '').startswith('outfits'):
                imported = {a.name for a in node.names}
                self.assertEqual(imported & names_of(mellowheart), set(),
                                 'build.py imports a package value by name')

    def test_build_takes_the_package_as_an_argument(self):
        self.assertRegex(source(), r'\n          outfit_pack=mellowheart, ')

    def test_every_value_in_the_contract_is_read_somewhere(self):
        """Read through the contract by SOME consumer, not only by build().

        build() puts garments on. Which of the BASE BODY's own parts come off
        is decided three steps earlier, in make.py, and REPLACES is the outfit
        answering that: it is a fact about the outfit and it has no business
        being read by build(). The defence this test exists for is unchanged,
        which is that a value nobody reads is a value that can drift.
        """
        with open(os.path.join(HERE, 'make.py'), encoding='utf-8') as fh:
            make_src = fh.read()
        readers = ((source(), 'outfit_pack.{}'), (make_src, 'mellowheart.{}'))
        unread = sorted(n for n in names_of(mellowheart)
                        if not any(pattern.format(n) in text
                                   for text, pattern in readers))
        self.assertEqual(unread, [], f'declared but never read: {unread}')

    def test_what_comes_off_the_base_body_is_asked_of_the_contract(self):
        """make.py held five part names, which are the five Mika's base has.

        A written-down list is right about one body and refused on every other,
        because drop_parts rejects a name the manifest does not have. Read the
        source: step 2 resolves the prefixes against the manifest step 1 just
        produced, and no part name is typed into make.py at all.
        """
        with open(os.path.join(HERE, 'make.py'), encoding='utf-8') as fh:
            make_src = fh.read()
        self.assertRegex(make_src,
                         r'drop = customise\.replaced\(m, mellowheart\.REPLACES\)')
        for name in ('Outfit_Top', 'Outfit_Bottom', 'Outfit_Shoes',
                     'Acc_HairOrnament'):
            self.assertNotIn(f"'{name}'", make_src,
                             f'make.py names {name} again')

    def test_the_fit_section_is_still_labelled_as_one_body(self):
        """Five of these are the package on THIS body, and only a banner says so."""
        with open(os.path.join(HERE, 'outfits', 'mellowheart.py'), encoding='utf-8') as fh:
            text = fh.read()
        self.assertIn('FIT: this outfit on this body.', text)
        banner = text.index('FIT: this outfit on this body.')
        for name in ('SHIFT', 'LOOSEN', 'STANDOFF', 'BIND_SMOOTH',
                     'THIGH_BAND_FINAL_CLEARANCE'):
            self.assertGreater(text.index(f'\n{name} = '), banner,
                               f'{name} has drifted above the FIT banner')

    def test_the_thigh_band_names_a_part_the_package_declares(self):
        """build() asks by name whether the thigh band came in, and the name was
        typed into build.py four times. The failure mode is silent: a package
        without that mesh does not raise, the whole limb fit just never runs."""
        self.assertIn(mellowheart.THIGH_BAND_PART, mellowheart.PARTS)
        self.assertNotIn(f"'{mellowheart.THIGH_BAND_PART}'", source(),
                         'build.py spells the vendor mesh name again')

    def test_the_prefix_the_importer_stamps_is_the_one_the_contract_declares(self):
        """outfit.py renames every material, image and bone node it brings in,
        and build() decides which materials the manifest advertises by that same
        prefix. The two were independent literals in two files. Moving
        outfit.py's is outside this contract's scope, so this pins them together
        instead: change either one and this goes red.
        """
        with open(os.path.join(HERE, 'outfit.py'), encoding='utf-8') as fh:
            importer = fh.read()
        stamped = mellowheart.MATERIAL_PREFIX
        self.assertEqual(importer.count(f"f'{stamped}{{name}}'"), 2)
        self.assertEqual(importer.count(f"f'{stamped}{{snames[i]}}'"), 1)

    def test_the_prefixes_resolve_to_what_the_written_down_list_held(self):
        """The contract value, against the real manifest rather than a mock.

        Two prefixes are a smaller thing to get wrong than five names, and this
        is the end that says they are the RIGHT two: partition the base body
        this outfit was fitted to, and what comes off has to be what came off
        before.
        """
        base = os.path.join(HERE, 'baseline.vrm')
        if not os.path.exists(base):
            self.skipTest('scripts/avatar/baseline.vrm 不在')
        scratch = tempfile.mkdtemp()
        manifest, _ = partition.partition(base,
                                          os.path.join(scratch, 'parted.vrm'),
                                          os.path.join(scratch, 'parts.json'))
        self.assertEqual(customise.replaced(manifest, mellowheart.REPLACES),
                         ['Acc_HairClip_Base', 'Acc_HairOrnament',
                          'Outfit_Bottom', 'Outfit_Shoes', 'Outfit_Top'])

    def test_the_bonemap_resolves_from_the_contracts_own_location(self):
        """It is built from __file__, which moved a directory deeper."""
        self.assertTrue(os.path.exists(mellowheart.BONEMAP), mellowheart.BONEMAP)


class Swapping(unittest.TestCase):
    def pack(self, files):
        other = types.ModuleType('outfits.other')
        for name in names_of(mellowheart):
            setattr(other, name, getattr(mellowheart, name))
        other.FILES = files
        return other

    def test_the_build_looks_for_the_files_the_package_declares(self):
        here = os.path.join(HERE, 'outfits_test.py')       # a file that exists
        found = build.outfit_files(here, self.pack(('outfits_test.py',)))
        self.assertEqual(found, [here])

    def test_a_package_naming_other_files_finds_other_files(self):
        self.assertEqual(build.outfit_files(os.path.join(HERE, 'x'),
                                            self.pack(('no_such_garment.glb',))), [])

    def test_a_file_the_package_declares_but_blender_did_not_make_is_skipped(self):
        """Missing ones are skipped rather than raised on, so a machine without
        Blender still builds a body out of the hand-made stand-ins."""
        found = build.outfit_files(os.path.join(HERE, 'outfits_test.py'),
                                   self.pack(('outfits_test.py', 'no_such_garment.glb')))
        self.assertEqual(found, [os.path.join(HERE, 'outfits_test.py')])


class Wiring(unittest.TestCase):
    def test_the_imported_outfit_is_coloured_by_the_package(self):
        src = source()
        self.assertRegex(src, r'outfit\.load\(path, doc, views, wear, outfit_pack\.TINT,')
        self.assertRegex(src, r'outfit_pack\.GAIN, override=outfit_pack\.BONEMAP\)')
        for typed in (r'wear, MELLOW_TINT', r'override=MELLOW_BONEMAP'):
            self.assertNotRegex(src, typed, 'build() reads the package off itself again')

    def test_the_clearances_are_read_off_the_package(self):
        src = source()
        for name in ('PARTS', 'SHIFT', 'LOOSEN', 'STANDOFF', 'BIND_SMOOTH'):
            self.assertRegex(src, r'outfit_pack\.%s\b' % name)
        for typed in (r'MELLOW_PARTS\.get', r'MELLOW_SHIFT\.get', r'MELLOW_LOOSEN\.get',
                      r'MELLOW_STANDOFF\.get', r'MELLOW_BIND_SMOOTH\.get'):
            self.assertNotRegex(src, typed, 'a clearance is read off the module again')

    def test_the_files_come_from_the_package_and_not_from_two_names(self):
        src = source()
        self.assertRegex(src, r'for f in outfit_pack\.FILES\]')
        self.assertRegex(src, r'mellow_files = outfit_files\(dst, outfit_pack\)')
        self.assertNotRegex(src, r'for f in \(MELLOW, MELLOW_OUTER\)',
                            'build() names the two files itself again')


if __name__ == '__main__':
    unittest.main(verbosity=2)
