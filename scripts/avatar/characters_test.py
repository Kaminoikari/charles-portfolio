"""build.py reads one character's values through its `character` argument.

Moving PALETTE into characters/mika.py proves nothing on its own: build.py could
import that module by name, or re-declare a constant beside it, and every
existing test would stay green because there is still exactly one character and
its numbers did not change. So these tests ask the two questions a second
character would ask. Does handing build a different contract change what it
builds, and is there anywhere left in build.py that a character's value can be
typed in?

The wiring half follows build_test.Wiring: positive assertions that the
derivation is there, negative ones naming the exact shapes it replaced
(memory: feedback_injection_bypasses_wiring).
"""
import ast
import os
import sys
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
from characters import mika  # noqa: E402


def source():
    with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
        return fh.read()


def names_of(module):
    return {n for n in dir(module) if n.isupper()}


def other_character():
    """A second contract: every name mika declares, none of her values.

    Built from her rather than written out, so a name added to the contract
    cannot be forgotten here and quietly leave that value unexercised.
    """
    other = types.ModuleType('characters.other')
    for name in names_of(mika):
        value = getattr(mika, name)
        if isinstance(value, tuple):
            value = tuple(round(1.0 - v, 4) if isinstance(v, float) else v for v in value)
        elif isinstance(value, dict):
            value = {k: ((0.1, 0.2, 0.3), (0.4, 0.5, 0.6)) for k in value}
        elif isinstance(value, float):
            value = round(value / 2, 4)
        setattr(other, name, value)
    # SKIN_TARGET is 0-255 rather than 0-1, so the blanket rule above would put
    # it somewhere outline_colour cannot divide by. Its own value, still not
    # hers.
    other.SKIN_TARGET = (200, 100, 100)
    other.OUTLINE_VALUE = 0.5
    other.RIM_COLOR = (0.9, 0.1, 0.2)
    return other


class Contract(unittest.TestCase):
    def test_build_declares_none_of_the_characters_values(self):
        """The 23 names are gone from build.py, not shadowed beside it."""
        declared = set()
        for node in ast.parse(source()).body:
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for t in targets:
                    for s in ast.walk(t):
                        if isinstance(s, ast.Name) and s.id.isupper():
                            declared.add(s.id)
        clash = sorted(declared & names_of(mika))
        self.assertEqual(clash, [], f'build.py declares a character value again: {clash}')

    def test_build_does_not_import_one_characters_values_by_name(self):
        """`from characters.mika import PALETTE` would pass the test above."""
        for node in ast.walk(ast.parse(source())):
            if isinstance(node, ast.ImportFrom) and (node.module or '').startswith('characters'):
                imported = {a.name for a in node.names}
                self.assertEqual(imported & names_of(mika), set(),
                                 'build.py imports a character value by name')

    def test_the_default_is_a_character_and_not_a_body_of_constants(self):
        self.assertRegex(source(), r'def build\(src, dst, manifest_path, out_manifest, '
                                   r'character=mika\)')

    def test_every_value_in_the_contract_is_read_somewhere(self):
        """A name nothing reads is a value the next character would set blind."""
        src = source()
        unread = sorted(n for n in names_of(mika) if f'character.{n}' not in src)
        # RIM_COLOR is read as `character.RIM_COLOR` in build(); the rest follow
        # the same shape. Anything here is either dead or still hard-coded.
        self.assertEqual(unread, [], f'declared but never read through character: {unread}')


class Swapping(unittest.TestCase):
    def test_the_outline_follows_the_character_it_is_derived_from(self):
        self.assertNotEqual(build.outline_colour(mika),
                            build.outline_colour(other_character()))

    def test_the_outline_is_her_skins_hue_at_her_own_line_value(self):
        other = other_character()
        got = build.outline_colour(other)
        raw = tuple(c / max(other.SKIN_TARGET) * other.OUTLINE_VALUE
                    for c in other.SKIN_TARGET)
        floor = max(raw) - build.OUTLINE_CHROMA_MAX
        self.assertEqual(got, tuple(round(max(c, floor), 4) for c in raw))

    def test_the_chroma_cap_stays_with_the_pipeline(self):
        """The cap belongs to build.py, and it is the cap that moves the colour.

        It has to be tightened rather than loosened to see it, and the reason is
        worth writing down: the floor is `max(raw) - cap`, so a bigger cap is a
        lower floor and binds on nothing. On Mika the cap does not bind at all
        today. Her skin (252, 222, 214) spreads 0.0302 across the channels at
        OUTLINE_VALUE 0.20, under the 0.038 allowed, so her line is her skin's
        hue untouched. The cap is there for a skin with more colour in it, which
        is exactly the kind of guard that goes unexercised until a second
        character arrives.
        """
        self.assertNotIn('OUTLINE_CHROMA_MAX', names_of(mika))
        raw = tuple(c / max(mika.SKIN_TARGET) * mika.OUTLINE_VALUE
                    for c in mika.SKIN_TARGET)
        self.assertLess(max(raw) - min(raw), build.OUTLINE_CHROMA_MAX,
                        'the cap now binds on Mika; this test no longer says what it says')
        before = build.outline_colour(mika)
        saved, build.OUTLINE_CHROMA_MAX = build.OUTLINE_CHROMA_MAX, 0.005
        try:
            self.assertNotEqual(build.outline_colour(mika), before)
        finally:
            build.OUTLINE_CHROMA_MAX = saved

    def test_a_material_carries_the_colours_it_is_handed(self):
        doc = {'materials': [], 'extensions': {'VRM': {'materialProperties': []}}}
        build.add_material(doc, 'X', (0.1, 0.2, 0.3), (0.0, 0.0, 0.0),
                           outline=(0.7, 0.6, 0.5), rim=(0.4, 0.3, 0.2))
        vec = doc['extensions']['VRM']['materialProperties'][0]['vectorProperties']
        self.assertEqual(vec['_OutlineColor'], [0.7, 0.6, 0.5, 1])
        self.assertEqual(vec['_RimColor'], [0.4, 0.3, 0.2, 1])

    def test_a_material_cannot_be_made_without_saying_whose_it_is(self):
        """No default, because outfit.load is handed this as a callback."""
        doc = {'materials': [], 'extensions': {'VRM': {'materialProperties': []}}}
        with self.assertRaises(TypeError):
            build.add_material(doc, 'X', (0.1, 0.2, 0.3), (0.0, 0.0, 0.0))


class Wiring(unittest.TestCase):
    """The contract has to be reachable from build(), not just importable."""

    def test_the_palette_is_read_off_the_character(self):
        src = source()
        self.assertRegex(src, r"for n, \(b, s\) in character\.PALETTE\.items\(\)")
        self.assertNotRegex(src, r"in PALETTE\.items\(\)",
                            'build() reads a palette of its own again')

    def test_the_imported_outfit_is_dressed_by_the_same_character(self):
        """outfit.load's callback carries the colours, so a vendor garment
        cannot end up with a different character's edge light."""
        src = source()
        self.assertRegex(src, r"wear = functools\.partial\(add_material, outline=outline, rim=rim\)")
        self.assertRegex(src, r"outfit\.load\(path, doc, views, wear,")
        self.assertNotRegex(src, r"outfit\.load\(path, doc, views, add_material,",
                            'the callback is handed over unbound again')

    def test_the_helpers_take_what_they_need_rather_than_reading_it(self):
        src = source()
        self.assertRegex(src, r"def add_material\(doc, name, base, shade, texture=None, \*, outline, rim\):")
        self.assertRegex(src, r"def bowl_texture\(doc, views, name, size=128, \*, mean\):")
        self.assertRegex(src, r"mean=character\.BOWL_MEAN")
        for typed in (r"\[\*OUTLINE_COLOR, 1\]", r"\[\*RIM_COLOR, 1\]", r"< BOWL_MEAN:"):
            self.assertNotRegex(src, typed, 'a helper reads a character value off the module again')


if __name__ == '__main__':
    unittest.main(verbosity=2)
