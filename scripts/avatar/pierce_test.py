"""Which parts pierce.py reads as skin, and that count() actually asks.

The pixel clipping gate compares a garment's silhouette against the skin
behind it, so it has to know which parts are skin. Until 2026-09-09 that was
the fixed pair ('Body_Skin', 'Face'), which is right only for a body whose
skin is one mesh. The VRoid Studio dress-up export draws its skin as three:
the body layer plus the InnerTop and InnerBottom the outfit sits on. Under the
fixed pair the extra two read as garments, and the skin behind them reads as
showing through.

The shipped Milfy body is the fixture because its manifest is the truth. Its
skin IS one mesh, so the split is made here by renaming, which is a naming a
manifest is allowed to use: springsim's deriveManifest writes exactly this
shape for a body whose skin spans meshes.
"""
import copy
import json
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import pierce  # noqa: E402

SHIPPED = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-12.vrm')


def shipped_parts():
    with open(SHIPPED.replace('.vrm', '.parts.json'), encoding='utf-8') as handle:
        return json.load(handle)['parts']


class Names(unittest.TestCase):
    def test_the_canonical_pair_is_skin(self):
        self.assertEqual(pierce.skin_parts(shipped_parts()), ('Face', 'Body_Skin'))

    def test_a_skin_split_over_meshes_is_all_skin(self):
        # deriveManifest gives the biggest mesh of a role the canonical name and
        # trails the rest as `<role>_<mesh>`; a hand-written manifest for a
        # third-party export follows it.
        parts = dict(shipped_parts())
        parts['Body_Skin_InnerTop'] = parts['Body_Skin']
        parts['Face_Extra'] = parts['Face']
        self.assertEqual(set(pierce.skin_parts(parts)),
                         {'Face', 'Body_Skin', 'Body_Skin_InnerTop', 'Face_Extra'})

    def test_a_garment_is_never_skin(self):
        # `Outfit_Socks` shares no prefix with either role, and a part that
        # merely contains one is not it either.
        parts = dict(shipped_parts())
        parts['Acc_Face_Sticker'] = parts['Face']
        self.assertNotIn('Acc_Face_Sticker', pierce.skin_parts(parts))
        self.assertNotIn('Outfit_Socks', pierce.skin_parts(parts))


class Wiring(unittest.TestCase):
    """count() has to ask, not just the helper.

    Renaming three of Body_Skin's four primitives into their own part changes
    nothing about the body, so the gate must return the same counts. With the
    names fixed at two, those three primitives fall out of the skin map and
    into the cloth map, and the numbers move.
    """
    @classmethod
    def setUpClass(cls):
        cls.doc, binary = glb.load(SHIPPED)
        cls.views = glb.views_of(cls.doc, binary)

    def count(self, parts):
        return pierce.count(self.doc, self.views, parts, size=(210, 360), detail=True)

    def test_the_bare_arm_mask_reads_the_same_skin(self):
        # _arm_triangles has its own copy of the question, and the pixel counts
        # do not carry it: with the skin split and the names fixed at two, the
        # mask over Milfy differs by whole triangles while count() comes back
        # identical, so the check below is where that call site is held.
        whole = shipped_parts()
        split = copy.deepcopy(whole)
        primitives = split['Body_Skin']['primitives']
        split['Body_Skin_Rest'] = dict(split['Body_Skin'], primitives=primitives[1:])
        split['Body_Skin'] = dict(split['Body_Skin'], primitives=primitives[:1])
        before = pierce._arm_triangles(self.doc, self.views, whole)
        after = pierce._arm_triangles(self.doc, self.views, split)
        self.assertEqual(len(before), len(after))
        for one, other in zip(before, after):
            self.assertTrue(np.array_equal(np.asarray(one), np.asarray(other)))
        # Not vacuous: the mask marks bare arm skin, and this body has some.
        self.assertGreater(sum(int(np.asarray(m).sum()) for m in before), 0)

    def test_splitting_the_skin_into_two_parts_changes_no_count(self):
        whole = shipped_parts()
        split = copy.deepcopy(whole)
        primitives = split['Body_Skin']['primitives']
        self.assertGreater(len(primitives), 1, 'the fixture needs a splittable skin')
        split['Body_Skin_Rest'] = dict(split['Body_Skin'], primitives=primitives[1:])
        split['Body_Skin'] = dict(split['Body_Skin'], primitives=primitives[:1])

        worst, area = self.count(whole)
        worst_split, area_split = self.count(split)
        self.assertEqual(worst_split, worst)
        self.assertEqual(area_split, area)
        # And the fixture is not vacuous: the garments do cover pixels, so a
        # skin map that lost three quarters of its primitives would show up.
        self.assertGreater(sum(area.values()), 0)


if __name__ == '__main__':
    unittest.main()
