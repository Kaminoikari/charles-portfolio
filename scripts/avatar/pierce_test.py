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



@unittest.skipUnless(os.path.exists(SHIPPED), 'needs the shipped body')
class ArmDrivenCloth(unittest.TestCase):
    """A sleeve is arm-driven cloth; the torso panel of the same top is not.

    pierce counts arm skin only against cloth an arm drives. Without that, a
    hand brought in front of the chest is skin in front of a garment by every
    other condition here, and on the dress-up export at `dance` t=23.45s it puts
    the cardigan at 340 pixels against a limit of 150. With the condition, 89.
    """

    @classmethod
    def setUpClass(cls):
        import partmap
        import pose as pose_mod
        import render
        cls.doc, binary = glb.load(SHIPPED)
        cls.views = glb.views_of(cls.doc, binary)
        cls.parts = shipped_parts()
        posed = pose_mod.skinned(cls.doc, cls.views, {}, True)
        keep = render.VIEWS
        render.VIEWS = pierce.VIEWS
        try:
            _, _, cls.labels = partmap.draw(
                cls.doc, cls.views, cls.parts, None, (360, 620), ('front',),
                posed, exclude=pierce.skin_parts(cls.parts), facing=True)
        finally:
            render.VIEWS = keep

    def test_the_buffer_says_which_cloth_an_arm_drives(self):
        who, names, _, _, _, arm = self.labels['front']
        index = {n: i for i, n in enumerate(names)}
        self.assertIn('Outfit_Cardigan', index)
        cardigan = who == index['Outfit_Cardigan']
        self.assertTrue(cardigan.any(), 'the cardigan is not on screen')
        # Its sleeves are arm-driven and its body is not, so this one garment
        # has to answer both ways; a buffer that answered one way for a whole
        # part would be no use to the condition that reads it.
        self.assertTrue((cardigan & arm).any(), 'no part of the cardigan reads '
                                                'as arm-driven')
        self.assertTrue((cardigan & ~arm).any(), 'all of the cardigan reads as '
                                                 'arm-driven')

    def test_a_hand_in_front_of_a_chest_is_not_clipping(self):
        # The frame the condition was written for. The dress-up export's hand
        # comes to rest beside its own cuff at `dance` t=23.45s, so
        # _arm_triangles keeps that arm skin, and the pale hand then sits in
        # front of the hoodie's torso panel. On the body as it ships, counting
        # it reads 340 pixels of 150 allowed; counting only what an arm drives,
        # 89. The assertion is the gate's own limit rather than a number
        # between those two, because a number in the middle stops separating
        # them the moment the body underneath changes: this test asserted
        # `< 400` while the export still had the camisole in it (556 against
        # 323), and cutting the camisole moved the failing side to 340, which
        # would have sailed under it.
        import pose as pose_mod
        from motion import retarget
        export = os.path.join(HERE, '..', '..', 'public', 'avatar',
                              'vroid-studio-dressup.vrm')
        if not os.path.exists(export):
            self.skipTest('needs the dress-up export')
        with open(export.replace('.vrm', '.parts.json'), encoding='utf-8') as handle:
            parts = json.load(handle)['parts']
        doc, binary = glb.load(export)
        views = glb.views_of(doc, binary)
        bones = pose_mod.bones(doc)
        clip = os.path.join(HERE, '..', '..', 'public', 'avatar', 'animations',
                            'dance.vrma')
        rot, _ = retarget(clip, 23.45, doc)
        worst, area = pierce.count(doc, views, parts, size=(360, 620),
                                   posed=pose_mod.skinned(
                                       doc, views,
                                       {bones[b]: q for b, q in rot.items() if b in bones},
                                       True), detail=True)
        n = worst.get('Outfit_Cardigan', 0)
        self.assertLessEqual(n, pierce.limit(area.get('Outfit_Cardigan', 0)),
                             'the hand beside the cuff is being counted against '
                             'the torso panel again')

    def test_it_drops_a_hand_resting_against_a_skirt_on_the_shipped_body(self):
        # The condition does not only act on the body it was written for. On the
        # shipped Milfy body at `modelPose` t=4.7s her hand rests against her own
        # thigh with the skirt's hem in front of the wrist, and the gate scored
        # the hem-against-hand boundary as Outfit_Bottom clipping: 97 pixels in
        # the side view and 39 in the front, 103 across the run that produced
        # evidence/clearance-0906-motion.log. That is the "hand resting on a hip"
        # blind spot pierce.py's docstring already named.
        #
        # This test exists because dropping those pixels LOOSENS the gate on the
        # body every visitor sees, and a loosening with no test is how a gate
        # goes quietly blind. Asserting that the dropped pixels are arm skin
        # whose cloth no arm drives would prove nothing: that is the rule that
        # selected them, so it holds for any input. What is pinned instead is
        # what the rule does NOT determine -- that the skirt goes from over 50
        # pixels to none, and that no other garment is emptied the same way.
        # `test_a_skirt_is_never_arm_driven` holds the other half, that no arm
        # drives that garment.
        import partmap
        import pose as pose_mod
        import render
        from motion import retarget
        parts = shipped_parts()
        doc, binary = glb.load(SHIPPED)
        views = glb.views_of(doc, binary)
        bones = pose_mod.bones(doc)
        clip = os.path.join(HERE, '..', '..', 'public', 'avatar', 'animations',
                            'modelPose.vrma')
        rot, _ = retarget(clip, 4.7, doc)
        posed = pose_mod.skinned(
            doc, views, {bones[b]: q for b, q in rot.items() if b in bones}, True)
        skin = pierce.skin_parts(parts)
        keep = render.VIEWS
        render.VIEWS = pierce.VIEWS
        try:
            _, _, cloth = partmap.draw(doc, views, parts, None, (360, 620),
                                       tuple(pierce.VIEWS), posed,
                                       exclude=skin, facing=True)
            _, _, flesh = partmap.draw(
                doc, views, parts, None, (360, 620), tuple(pierce.VIEWS), posed,
                exclude=tuple(set(parts) - set(skin)),
                drop=pierce._arm_triangles(doc, views, parts, posed), facing=True)
        finally:
            render.VIEWS = keep

        tally = {}
        for view, (who, names, cloth_z, outward, cloth_limb, cloth_arm) in cloth.items():
            index = {n: i for i, n in enumerate(names)}
            skin_z, skin_limb, skin_arm = flesh[view][2], flesh[view][4], flesh[view][5]
            gap = skin_z - cloth_z
            without = ((who >= 0) & (flesh[view][0] >= 0) & (gap > 0)
                       & (gap < pierce.LIMIT) & outward
                       & ((cloth_limb == skin_limb) | (cloth_limb == 0)
                          | (skin_limb == 0)))
            kept = without & (~skin_arm | cloth_arm)
            for part, i in index.items():
                row = tally.setdefault(part, [0, 0])
                row[0] += int((without & (who == i)).sum())
                row[1] += int((kept & (who == i)).sum())
        # Which GARMENT loses its pixels, which the rule above does not decide:
        # it drops arm skin against cloth no arm drives, and a top's torso panel
        # or a sock would satisfy that too. Measured at this frame the skirt
        # loses all 136 of its pixels and the cardigan 11 of its 20, keeping 9.
        skirt_without, skirt_kept = tally.get('Outfit_Bottom', (0, 0))
        self.assertGreater(skirt_without, 50,
                           'this frame no longer exercises the condition, so '
                           'nothing below pinned anything')
        self.assertEqual(skirt_kept, 0,
                         f'{skirt_kept} skirt pixels survive the condition, so '
                         'this is no longer the frame the reason was written for')
        # And no OTHER garment is emptied by it. The skirt may go to nothing
        # because pierce-0910.md says why those pixels are not clipping; a
        # second part quietly going to nothing would be a gate that stopped
        # looking, not a false positive that was explained.
        for part, (was, now) in sorted(tally.items()):
            if part == 'Outfit_Bottom' or not was:
                continue
            self.assertGreater(now, 0,
                               f'{part} lost all {was} of its pixels to the arm '
                               'condition, and only the skirt has a reason to')

    def test_a_skirt_is_never_arm_driven(self):
        who, names, _, _, _, arm = self.labels['front']
        index = {n: i for i, n in enumerate(names)}
        skirt = [n for n in names if 'Skirt' in n or 'Bottom' in n]
        self.assertTrue(skirt, f'no skirt part among {names}')
        for name in skirt:
            mine = who == index[name]
            if mine.any():
                self.assertFalse((mine & arm).any(),
                                 f'{name} reads as arm-driven')

class Waivers(unittest.TestCase):
    """pierce.waivers: a per-body allowance, with the measurement attached."""

    BODY = {'parts': {'Acc_Glasses': {'mesh': 'G', 'primitives': [0]},
                      'Outfit_Cardigan': {'mesh': 'C', 'primitives': [0]}}}

    def test_no_declaration_means_no_waiver(self):
        self.assertEqual(pierce.waivers(self.BODY), {})

    def test_a_declared_waiver_raises_that_part_only(self):
        body = dict(self.BODY, pierce_waivers={'Acc_Glasses':
                                               {'pixels': 60, 'why': 'measured'}})
        self.assertEqual(pierce.waivers(body), {'Acc_Glasses': 60})
        self.assertEqual(pierce.limit(1043, 60), 60)
        self.assertEqual(pierce.limit(1043), 30)

    def test_a_waiver_without_a_reason_stops_the_run(self):
        # Otherwise it is a raised threshold with no evidence behind it, which
        # is the one thing this gate must never quietly accept.
        body = dict(self.BODY, pierce_waivers={'Acc_Glasses': {'pixels': 60}})
        with self.assertRaises(SystemExit):
            pierce.waivers(body)

    def test_a_waiver_for_a_part_this_body_lacks_stops_the_run(self):
        body = dict(self.BODY, pierce_waivers={'Acc_Hat':
                                               {'pixels': 60, 'why': 'measured'}})
        with self.assertRaises(SystemExit):
            pierce.waivers(body)

    def test_the_shipped_body_declares_none(self):
        with open(SHIPPED.replace('.vrm', '.parts.json'), encoding='utf-8') as handle:
            self.assertEqual(pierce.waivers(json.load(handle)), {})

    def test_the_dress_up_export_declares_the_glasses(self):
        export = os.path.join(HERE, '..', '..', 'public', 'avatar',
                              'vroid-studio-dressup.parts.json')
        if not os.path.exists(export):
            self.skipTest('needs the dress-up export')
        with open(export, encoding='utf-8') as handle:
            declared = json.load(handle)
        self.assertEqual(pierce.waivers(declared), {'Acc_Glasses': 60})
        why = declared['pierce_waivers']['Acc_Glasses']['why']
        # The number in the reason has to be the number that was measured, or
        # the receipt drifts away from the declaration it justifies.
        self.assertIn('51 pixels', why)


if __name__ == '__main__':
    unittest.main()
