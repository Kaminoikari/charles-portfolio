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


OTHER_PREFIX = 'Other_'


def _is_material(value):
    return isinstance(value, str) and value.startswith(mika.MATERIAL_PREFIX)


def _differ(value):
    """The same value, guaranteed not equal, with its shape and role intact.

    Recursive rather than a blanket rule over the top-level type. The blanket
    version this replaces only knew about float, tuple and dict, so `HEAD`
    (a str), `HAND_GARMENTS` (a set), `BLENDER_PARTS` (a list) and `EYE_TARGET`
    (a tuple of ints, which `round(1.0 - v)` skipped because it tested for
    float) all came out as Mika's own values while the docstring said they did
    not.

    A material name keeps being a material name: the second character renames
    the prefix rather than appending to the name, so PALETTE's keys and
    MATERIALS' values still agree with each other and `mats[paint[role]]`
    would still resolve.
    """
    if isinstance(value, str):
        if value.startswith(mika.MATERIAL_PREFIX):
            return OTHER_PREFIX + value[len(mika.MATERIAL_PREFIX):]
        return value + '_other'
    if isinstance(value, bool):
        return not value
    if isinstance(value, float):
        return round(value / 2, 4) if value else 0.5
    if isinstance(value, int):
        return value + 1
    if isinstance(value, tuple):
        return tuple(_differ(v) for v in value)
    if isinstance(value, list):
        return [_differ(v) for v in value]
    if isinstance(value, set):
        return {_differ(v) for v in value}
    if isinstance(value, dict):
        # Keys are renamed only when they are material names. MATERIALS is keyed
        # by role, and a role is the one thing both characters share: rename
        # `cloth` and build() can no longer ask either of them for it.
        return {_differ(k) if _is_material(k) else k: _differ(v)
                for k, v in value.items()}
    raise AssertionError(f'_differ does not handle {type(value).__name__}; '
                         'a contract value of a new shape needs a rule here')


def other_character():
    """A second contract: every name mika declares, none of her values.

    Built from her rather than written out, so a name added to the contract
    cannot be forgotten here and quietly leave that value unexercised. The
    assertion at the end is what makes that claim true rather than merely
    stated.
    """
    other = types.ModuleType('characters.other')
    for name in names_of(mika):
        setattr(other, name, _differ(getattr(mika, name)))
    # SKIN_TARGET is 0-255 rather than 0-1, and these three carry the outline
    # derivation, so they get values chosen to exercise it rather than values
    # chosen only to be unequal. Her skin's channels are far enough apart that
    # the chroma cap binds, which Mika's own never do.
    other.SKIN_TARGET = (200, 100, 100)
    other.OUTLINE_VALUE = 0.5
    other.RIM_COLOR = (0.9, 0.1, 0.2)
    for name in names_of(mika):
        assert getattr(other, name) != getattr(mika, name), \
            f'other_character left {name} as Mika\'s own value'
    return other


class Contract(unittest.TestCase):
    def test_build_declares_none_of_the_characters_values(self):
        """Every name she declares is gone from build.py, not shadowed beside
        it. The count is deliberately not written here: it changed the same
        day this was written, and a number in a docstring nobody recounts is
        the failure mode this whole round is cleaning up."""
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
                                   r'character=mika,')

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

    def test_the_line_is_as_bright_as_the_character_asked_for(self):
        """Stated as a property of the answer, not by recomputing the formula.

        The version this replaces rebuilt `raw`, `floor` and the rounding in
        the test and compared the two, which is the same arithmetic written
        twice: it agrees with a wrong implementation as readily as a right one.
        The brightest channel of the line IS the character's line value, on
        both characters, whether or not the chroma cap bites.
        """
        for who in (mika, other_character()):
            self.assertAlmostEqual(max(build.outline_colour(who)),
                                   who.OUTLINE_VALUE, places=4)

    def test_a_skin_the_cap_reaches_is_pulled_back_to_exactly_the_cap(self):
        """The other character's skin is (200, 100, 100): far enough apart that
        the cap binds, which Mika's never does. Its spread has to end up at the
        cap, and its hue has to stop following the skin at that point."""
        other = other_character()
        got = build.outline_colour(other)
        self.assertAlmostEqual(max(got) - min(got), build.OUTLINE_CHROMA_MAX,
                               places=4)

    def test_a_skin_the_cap_does_not_reach_keeps_her_skins_ratios(self):
        got = build.outline_colour(mika)
        for channel, skin in zip(got, mika.SKIN_TARGET):
            self.assertAlmostEqual(channel / max(got),
                                   skin / max(mika.SKIN_TARGET), places=3)

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

    def test_the_bowl_is_baked_to_the_brightness_it_is_asked_for(self):
        """The signature taking `mean` proves nothing if the body ignores it.

        bowl_texture binary-searches a scale so the clipped disc averages the
        mean it was handed, and returns what the shader will actually read. Two
        different means have to come back as two different textures, or the
        parameter is decoration over a written-down 0.90.
        """
        def bake(mean):
            doc = {'images': [], 'textures': [], 'bufferViews': []}
            got = build.bowl_texture(doc, [], 'bowl', size=32, mean=mean)
            return got[1]

        low, high = bake(0.55), bake(0.90)
        self.assertLess(low, high)
        # Within a quantisation step of what was asked for, which is the whole
        # reason the function returns the quantised mean rather than its target.
        self.assertAlmostEqual(low, 0.55, delta=1 / 255)
        self.assertAlmostEqual(high, 0.90, delta=1 / 255)

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

    def test_build_spells_none_of_her_material_names(self):
        """Thirty-one literals until this round (`rg -o "'Milfy_[A-Za-z_]*'" | wc -l`
        on the blob at 98b9534), fifteen distinct spellings: eleven of her
        thirteen palette entries, the inner ear's own material, two texture
        names, and the bare prefix in the manifest filter. `put()` looks each one up in `mats`,
        which is built from her PALETTE, so a second character who does not
        reuse her exact names was a KeyError. Same shape of coupling, and same
        shape of guard, as the base body's F00_000 names."""
        self.assertNotIn(mika.MATERIAL_PREFIX, source(),
                         'build.py spells one of her material names again')

    def test_every_role_names_a_material_of_hers(self):
        """Roles are shared between characters; the names behind them are not."""
        for role, name in mika.MATERIALS.items():
            self.assertTrue(name.startswith(mika.MATERIAL_PREFIX), f'{role}: {name}')
        # One deliberate exception: the inner ear's base colour is divided by
        # the bowl texture's mean at build time, so build() makes that material
        # rather than reading it out of PALETTE.
        self.assertEqual(set(mika.MATERIALS.values()) - set(mika.PALETTE),
                         {mika.MATERIALS['ear_inner']})

    def test_the_manifest_palette_is_filtered_by_both_contracts(self):
        """The prefix decides which materials the manifest advertises as
        recolourable. It was a hard-coded pair of strings, so a second
        character's materials would have been dropped from her own manifest."""
        self.assertRegex(source(),
                         r'startswith\(\(character\.MATERIAL_PREFIX,\s*\n'
                         r'\s*outfit_pack\.MATERIAL_PREFIX\)\)')

    def test_the_helpers_take_what_they_need_rather_than_reading_it(self):
        src = source()
        self.assertRegex(src, r"def add_material\(doc, name, base, shade, texture=None, \*, outline, rim\):")
        self.assertRegex(src, r"def bowl_texture\(doc, views, name, size=128, \*, mean\):")
        self.assertRegex(src, r"mean=character\.BOWL_MEAN")
        for typed in (r"\[\*OUTLINE_COLOR, 1\]", r"\[\*RIM_COLOR, 1\]", r"< BOWL_MEAN:"):
            self.assertNotRegex(src, typed, 'a helper reads a character value off the module again')


if __name__ == '__main__':
    unittest.main(verbosity=2)
