"""make.gate() judged against a base body instead of the number 54.

Phase 3 of the skeleton plan: the per-step gate used to require exactly 54
humanoid bones, which is VRoid's count and nobody else's. It now asks two
questions of the candidate against the base it was built from: did any bone
move or vanish (humanoid.compare), and does the file still declare every bone
the VRM spec requires (humanoid.required_missing). Every test here drives the
real make.gate on JSON-perturbed copies of the shipped base body written to a
temporary directory; the binary chunk is carried over untouched.
"""
import atexit
import copy
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import customise  # noqa: E402
import glb  # noqa: E402
import humanoid  # noqa: E402
import make  # noqa: E402
import partition  # noqa: E402
import pierce  # noqa: E402
import vrm1to0  # noqa: E402
from outfits import mellowheart  # noqa: E402

BODY = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')

# Every partition() here writes a whole VRM, 6.7MB for mika-pink and 14MB for
# the dress-up export read out of git, and this file drives partition dozens of
# times. Left in tempfile's own directory they are never collected, and a
# mutation table that runs this module eight times over filled the disk on
# 2026-09-12: the run died with ENOSPC and left a mutated partition.py behind.
# One root per process, removed when the process ends.
_ROOT = tempfile.mkdtemp(prefix='gate_test.')
atexit.register(shutil.rmtree, _ROOT, True)


def scratch():
    """A fresh directory under this run's own root."""
    return tempfile.mkdtemp(dir=_ROOT)


def partitioned(src):
    """partition() with its refusal turned into an ordinary test error.

    partition() refuses by raising SystemExit, and unittest's setUpClass
    handler catches Exception, which SystemExit is not: one refusal there ends
    the whole run with a traceback and no results at all. That reads as a
    crash rather than as a failing class, and under a mutation it hides which
    tests the mutation actually broke.
    """
    out = scratch()
    try:
        return partition.partition(src, os.path.join(out, 'o.vrm'),
                                   os.path.join(out, 'p.json'))[0]
    except SystemExit as refusal:
        raise AssertionError(
            f'partition 拒絕了 {os.path.basename(src)}：{refusal}') from None


def perturbed(drop=()):
    """A copy of BODY with the named humanoid bones removed from the map."""
    doc, binary = glb.load(BODY)
    bones = doc['extensions']['VRM']['humanoid']['humanBones']
    doc['extensions']['VRM']['humanoid']['humanBones'] = [
        b for b in bones if b['bone'] not in drop]
    path = os.path.join(scratch(), 'body.vrm')
    glb.save(path, doc, binary)
    return path


class Gate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(BODY):
            raise unittest.SkipTest('public/avatar/mika-pink.vrm 不在')
        cls.body = BODY
        cls.no_upper_chest = perturbed(drop=('upperChest',))
        cls.no_left_hand = perturbed(drop=('leftHand',))

    def test_the_base_passes_against_itself(self):
        make.gate('self', self.body, self.body)

    def test_a_base_with_fewer_bones_passes_against_its_own_kind(self):
        # 53 bones on both sides: upperChest is optional in the spec, and a
        # base body without it must not be refused for not being VRoid.
        self.assertEqual(len(humanoid.bones(humanoid.read(self.no_upper_chest))), 53)
        make.gate('53', self.no_upper_chest, self.no_upper_chest)

    def test_a_missing_required_bone_is_named_even_when_the_base_lacks_it_too(self):
        # Base and candidate agree (compare is clean), so only the spec check
        # can see that leftHand is gone.
        with self.assertRaises(SystemExit) as cm:
            make.gate('hand', self.no_left_hand, self.no_left_hand)
        self.assertIn('leftHand', str(cm.exception))

    def test_a_bone_present_on_one_side_only_fails_through_compare(self):
        with self.assertRaises(SystemExit) as cm:
            make.gate('one-sided', self.no_upper_chest, self.body)
        self.assertIn('upperChest', str(cm.exception))


class PartitionRecognises(unittest.TestCase):
    """The one step that needs a particular body has to say so, not guess.

    partition places the hair strands by where they sit in this body's absolute
    space, which does not survive a change of body, and before recognise()
    nothing said so: a mesh matching neither of the two hardcoded mesh names
    fell through to hair_name for every primitive, so the 2026-09-07 Seed-san
    fixture run wrote a parts.json calling a robot's arm and clothes
    Hair_Twintail_R, Hair_Bangs and Hair_Side_L. It loaded. It read plausibly.
    Every later step would have believed it.
    """

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(BODY):
            raise unittest.SkipTest('public/avatar/mika-pink.vrm 不在')
        cls.doc = glb.load(BODY)[0]

    def body_mesh(self, doc):
        """The mesh carrying this body's SKIN, found the way partition does."""
        mats = [m['name'] for m in doc['materials']]
        return next(m for m in doc['meshes']
                    if any(partition.vroid_category(mats[p['material']])[1] == 'SKIN'
                           for p in m['primitives'])
                    and m not in partition.face_meshes(doc))

    def test_the_body_this_step_was_written_for_is_recognised(self):
        self.assertEqual(partition.recognise(self.doc), [])

    def test_the_face_mesh_is_found_by_its_materials_not_its_name(self):
        # vrm1-twist-sample calls it `Face` and the dress-up export
        # `Face (merged)(Clone).baked.baked`; both used to stop here.
        doc = copy.deepcopy(self.doc)
        for m in partition.face_meshes(doc):
            m['name'] = 'not-a-vroid-mesh-name'
        self.assertEqual(partition.recognise(doc), [])
        self.assertEqual([m.get('name') for m in partition.face_meshes(doc)],
                         ['not-a-vroid-mesh-name'])

    def test_a_body_with_no_face_material_anywhere_is_refused(self):
        doc = copy.deepcopy(self.doc)
        for material in doc['materials']:
            if partition.vroid_category(material['name'])[1] == 'FACE':
                material['name'] = 'plain'
        reasons = partition.recognise(doc)
        self.assertTrue(any('FACE' in r for r in reasons), reasons)
        # And it names what IS there, because that is the useful half to
        # somebody holding a body this step has never seen.
        self.assertTrue(any('Face.baked' in r for r in reasons), reasons)

    def test_two_meshes_carrying_face_materials_are_refused(self):
        # Which one holds the 56 morph targets would then be a coin toss, and
        # the loser gets split like a garment.
        doc = copy.deepcopy(self.doc)
        face = partition.face_meshes(doc)[0]['primitives'][0]['material']
        self.body_mesh(doc)['primitives'][0]['material'] = face
        reasons = partition.recognise(doc)
        self.assertTrue(any('2' in r and 'FACE' in r for r in reasons), reasons)

    def test_a_face_mesh_carrying_no_morph_targets_is_refused(self):
        # Locking Face is about blendShapeMaster binding expressions into it by
        # morph index. A face mesh with no morphs is not that mesh.
        doc = copy.deepcopy(self.doc)
        for prim in partition.face_meshes(doc)[0]['primitives']:
            prim.pop('targets', None)
        reasons = partition.recognise(doc)
        self.assertTrue(any('morph' in r for r in reasons), reasons)

    def test_a_body_mesh_with_a_different_primitive_count_is_recognised(self):
        # The count was the old check, and it asked the wrong question:
        # HairSample_Female exports six body primitives and Sendagaya_Shibu
        # nine, and both are ordinary VRoid bodies whose parts the material
        # grammar names exactly.
        doc = copy.deepcopy(self.doc)
        self.body_mesh(doc)['primitives'] = self.body_mesh(doc)['primitives'][:-1]
        self.assertEqual(partition.recognise(doc), [])

    def test_a_body_material_outside_the_grammar_is_refused_by_name(self):
        # What the count check was reaching for. A Body mesh whose materials
        # are somebody's hand-authored names carries no category token, so
        # there is nothing to read a part name off.
        doc = copy.deepcopy(self.doc)
        mesh = self.body_mesh(doc)
        doc['materials'][mesh['primitives'][5]['material']]['name'] = 'Mellow_Skirt'
        reasons = partition.recognise(doc)
        self.assertTrue(any('Mellow_Skirt' in r for r in reasons), reasons)

    def test_a_hand_authored_material_in_any_mesh_is_refused(self):
        # recognise() used to look at one mesh, so the same name in the hair
        # mesh went unmentioned and hair_name then placed it by geometry.
        doc = copy.deepcopy(self.doc)
        hair = next(m for m in doc['meshes']
                    if m is not self.body_mesh(doc)
                    and m not in partition.face_meshes(doc))
        doc['materials'][hair['primitives'][0]['material']]['name'] = 'Milfy_Ink'
        reasons = partition.recognise(doc)
        self.assertTrue(any('Milfy_Ink' in r for r in reasons), reasons)

    def test_two_meshes_sharing_one_name_is_refused(self):
        # The manifest records a part's mesh BY NAME and pose.skinned keys its
        # rest world the same way, so a repeated name is a part pointing at the
        # wrong geometry and a frame measured off the wrong vertices. With
        # mika-pink's three meshes all called the same thing, pose.skinned
        # returns 77 keys instead of 94 and the face's half-width comes out
        # 0.2309 instead of 0.0918, because the hair's x range answers instead.
        doc = copy.deepcopy(self.doc)
        for m in doc['meshes']:
            m['name'] = 'Merged'
        reasons = partition.recognise(doc)
        self.assertTrue(any('Merged' in r for r in reasons), reasons)

    def test_a_mesh_with_no_name_at_all_is_refused(self):
        doc = copy.deepcopy(self.doc)
        doc['meshes'][-1].pop('name', None)
        self.assertTrue(partition.recognise(doc), 'a nameless mesh was accepted')

    def test_a_body_with_no_eye_bone_is_refused(self):
        # VRM makes the eye bones optional, so the skeleton gate upstream lets
        # a body without them through. Falling back to the head bone reads
        # `left` off numerical noise on the midline: on mika-pink the head sits
        # at x +0.000042, so the whole body reads as facing the other way and
        # 34 of her 77 strands swap hands.
        doc = copy.deepcopy(self.doc)
        bones = doc['extensions']['VRM']['humanoid']['humanBones']
        doc['extensions']['VRM']['humanoid']['humanBones'] = [
            b for b in bones if b['bone'] not in ('leftEye', 'rightEye')]
        reasons = partition.recognise(doc)
        self.assertTrue(any('leftEye' in r for r in reasons), reasons)

    def test_a_material_with_a_token_and_no_part_says_so(self):
        # EYE and FACE are in the grammar and this step has no part name for
        # them, which is a different complaint from a hand-authored name. It
        # used to report both as "carries no category suffix", naming a broken
        # assumption that was not the broken one.
        doc = copy.deepcopy(self.doc)
        face = partition.face_meshes(doc)[0]
        eye = next(p for p in face['primitives']
                   if partition.vroid_category(
                       doc['materials'][p['material']]['name'])[1] == 'EYE')
        doc['meshes'].append({'name': 'stray', 'primitives': [eye]})
        reasons = partition.recognise(doc)
        self.assertTrue(any('EYE' in r and '不帶' not in r for r in reasons), reasons)

    def test_a_hair_strand_is_not_a_material_it_cannot_name(self):
        # body_name answers None for a strand and None for a stranger, and
        # only the second is a reason to refuse; without is_strand every VRoid
        # body on the disk would be turned away by its own hair.
        self.assertEqual(partition.recognise(self.doc), [])
        self.assertTrue(partition.is_strand('F00_000_Hair_00_HAIR_01'))
        self.assertFalse(partition.is_strand('Milfy_Ink'))

    def claiming(self, label, out=None):
        """partition() with every hair strand claiming `label` as its part."""
        out = out or scratch()
        original = partition.hair_name
        partition.hair_name = (label if callable(label)
                               else lambda *a, **kw: label)
        try:
            return partition.partition(BODY, os.path.join(out, 'o.vrm'),
                                       os.path.join(out, 'p.json'))[0]['parts']
        finally:
            partition.hair_name = original

    def test_a_name_two_meshes_claim_goes_to_the_one_reaching_furthest(self):
        # parts are keyed by label and a part belongs to one mesh, so the
        # second mesh to claim a name used to replace the first in silence.
        # hair_name is stubbed only to make the collision; the resolver under
        # test runs for real, inside the real partition() on the real body.
        parts = self.claiming('Body_Skin')
        self.assertEqual(parts['Body_Skin']['mesh'], 'Body.baked')
        self.assertEqual(parts['Body_Skin_2']['mesh'], 'Hair001.baked')
        # Both meshes keep every primitive they claimed: 4 skin primitives on
        # the body, 77 strands on the hair.
        self.assertEqual(len(parts['Body_Skin']['primitives']), 4)
        self.assertEqual(len(parts['Body_Skin_2']['primitives']), 77)

    def test_a_claims_reach_is_measured_on_the_vertices_it_draws(self):
        # Every primitive of a VRoid mesh shares one POSITION accessor: this
        # body's 7 body primitives and its 77 strands are 2 buffers. Read raw,
        # the shoes baked into the body mesh reach 1.51m rather than their own
        # 0.16m and take the name from a claim that really is taller.
        parts = self.claiming('Outfit_Shoes')
        self.assertEqual(parts['Outfit_Shoes']['mesh'], 'Hair001.baked')
        self.assertEqual(parts['Outfit_Shoes_2']['mesh'], 'Body.baked')

    def test_the_number_skips_a_name_the_grammar_already_wrote(self):
        # Body_Skin_2 is a name the grammar can reach on its own, and handing
        # it to a second claim would trade one collision for another.
        half = [0]

        def alternate(*a, **kw):
            half[0] += 1
            return 'Body_Skin' if half[0] % 2 else 'Body_Skin_2'

        parts = self.claiming(alternate)
        self.assertEqual(parts['Body_Skin']['mesh'], 'Body.baked')
        self.assertEqual(
            {n: parts[n]['mesh'] for n in parts if n.startswith('Body_Skin_')},
            {'Body_Skin_2': 'Hair001.baked', 'Body_Skin_3': 'Hair001.baked'})

    def test_a_resolver_that_repeats_a_name_is_refused_rather_than_believed(self):
        # The invariant behind the rename. resolve_clashes owes every claim a
        # name of its own; if two arrive alike the manifest keeps the second
        # and half the geometry the name covers is gone from every step that
        # reads it, with nothing said.
        out = scratch()
        original = partition.resolve_clashes
        partition.resolve_clashes = lambda claims: [c['label'] for c in claims]
        try:
            with self.assertRaises(SystemExit) as caught:
                self.claiming('Body_Skin', out)
        finally:
            partition.resolve_clashes = original
        self.assertIn('Body_Skin', str(caught.exception))
        self.assertFalse(os.path.exists(os.path.join(out, 'o.vrm')))

    def test_the_shipped_body_keeps_the_labels_the_index_table_gave(self):
        # The regression pin. This list is BODY_NAMES as it stood at c5af808,
        # in primitive order; the grammar has to reproduce it exactly or every
        # step downstream of partition is reading different parts.
        mats = [m['name'] for m in self.doc['materials']]
        mesh = self.body_mesh(self.doc)
        self.assertEqual(
            [partition.body_name(mats[p['material']]) for p in mesh['primitives']],
            ['Body_Skin', 'Body_Skin', 'Body_Skin', 'Body_Skin',
             'Outfit_Top', 'Outfit_Bottom', 'Outfit_Shoes'])

    def test_partition_refuses_rather_than_naming_a_stranger(self):
        # A stranger is no longer a body whose MESHES are named differently,
        # which is an ordinary VRoid export; it is one whose materials carry
        # no category token, so there is nothing to read a part name off.
        doc = copy.deepcopy(self.doc)
        for i, material in enumerate(doc['materials']):
            material['name'] = f'hand_authored_{i}'
        path = os.path.join(scratch(), 'stranger.vrm')
        glb.save(path, doc, glb.load(BODY)[1])
        out = os.path.join(scratch(), 'parted.vrm')
        with self.assertRaises(SystemExit) as caught:
            partition.partition(path, out, out + '.json')
        self.assertIn('拒絕命名', str(caught.exception))
        self.assertFalse(os.path.exists(out), 'refused, but wrote a file anyway')


class MaterialGrammar(unittest.TestCase):
    """VRoid's material names, read as the grammar VRoid writes them in."""

    def test_the_category_is_the_last_segment(self):
        self.assertEqual(partition.vroid_category('F00_008_01_Tops_01_CLOTH'),
                         ('Tops', 'CLOTH'))

    def test_a_hair_material_carries_a_variant_number_after_the_category(self):
        # The one VRoid name whose category is not the final segment:
        # F00_000_Hair_00_HAIR_01 through _06. CLIP_DECALS reads that same
        # suffix, so a parser that only looked at the last segment would call
        # every hair strand uncategorised.
        self.assertEqual(partition.vroid_category('F00_000_Hair_00_HAIR_03'),
                         ('Hair', 'HAIR'))

    def test_the_vrm1_sample_drops_the_model_prefix(self):
        # vrm1-twist-sample.vrm names its materials Bottoms_01_CLOTH, with no
        # F00_nnn_nn ahead of the part name.
        self.assertEqual(partition.vroid_category('Bottoms_01_CLOTH'),
                         ('Bottoms', 'CLOTH'))

    def test_a_dress_up_export_decorates_the_name(self):
        self.assertEqual(
            partition.vroid_category(
                'N00_004_01_Shoes_01_CLOTH (Instance) (Instance)'),
            ('Shoes', 'CLOTH'))

    def test_a_short_name_whose_token_sits_second_to_last_has_no_part(self):
        # There is no part name in front of it to read, and the bounds check
        # for the second pass has to be one wider than the first or this
        # raises IndexError rather than answering.
        self.assertEqual(partition.vroid_category('Hair_HAIR_01'), (None, None))

    def test_a_name_outside_the_grammar_has_no_category(self):
        self.assertEqual(partition.vroid_category('Milfy_White'), (None, None))
        self.assertIsNone(partition.body_name('Milfy_White'))

    def test_a_garment_this_pipeline_has_never_seen_keeps_vroids_word(self):
        # Sakurada_Fumiriya and both Sendagaya bodies carry one.
        self.assertEqual(
            partition.body_name('M00_001_01_AccessoryNeck_01_CLOTH'),
            'Outfit_AccessoryNeck')

    def test_the_two_kinds_of_hair_are_told_apart_by_their_part_name(self):
        # Which mesh a primitive sits in used to decide this, and it is a fact
        # about the export rather than about the hair: eight of the sixteen
        # local bodies bake HairBack into the body mesh group, vrm1-twist-sample
        # into a mesh called Body, and the strands live somewhere else again.
        self.assertEqual(partition.body_name('F00_000_HairBack_00_HAIR'),
                         'Hair_BodyBack')
        self.assertEqual(partition.body_name('HairBack_00_HAIR'), 'Hair_BodyBack')
        self.assertIsNone(partition.body_name('F00_000_Hair_00_HAIR_01'))
        self.assertTrue(partition.is_strand('F00_000_Hair_00_HAIR_01'))
        self.assertFalse(partition.is_strand('F00_000_HairBack_00_HAIR'))

    def test_a_matcap_part_is_named_as_an_accessory(self):
        # The dress-up export's glasses. Without a name they are a material
        # outside the grammar and the whole body is refused.
        self.assertEqual(
            partition.body_name('Accessory_GlassesHiFrame_01_MATCAP'),
            'Acc_GlassesHiFrame')


class BodyPartsFromTheExportGrammar(unittest.TestCase):
    """A body whose primitive order is not this body's, named correctly.

    BODY_NAMES mapped primitive 4, 5 and 6 to Tops, Bottoms and Shoes because
    that is the order THIS body exports them in. Four of the sixteen local
    bodies export SKIN x4, Tops, Shoes, HairBack instead -- Vivi, Vita,
    Victoria_Rubin and Darkness_Shibu -- and all four have exactly seven body
    primitives, so the count check passed them and the index table then called
    their shoes Outfit_Bottom and their back hair Outfit_Shoes.
    """

    OTHER = os.path.join(HERE, '..', '..', 'public', 'avatar', 'Vivi_webp.vrm')

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(cls.OTHER):
            raise unittest.SkipTest('public/avatar/Vivi_webp.vrm 不在')
        cls.manifest = partitioned(cls.OTHER)
        cls.body = {n: p for n, p in cls.manifest['parts'].items()
                    if p['mesh'] == 'Body.baked'}

    def test_the_shoes_part_holds_the_shoes(self):
        # The reproduction: this part held F00_000_HairBack_00_HAIR before.
        self.assertEqual([partition.vroid_category(m)[0]
                          for m in self.body['Outfit_Shoes']['materials']],
                         ['Shoes'])

    def test_a_body_with_no_lower_garment_is_given_no_lower_part(self):
        # It used to be given one, holding the shoes.
        self.assertNotIn('Outfit_Bottom', self.body)

    def test_every_outfit_part_holds_only_cloth(self):
        for name, part in self.body.items():
            if not name.startswith('Outfit_'):
                continue
            for material in part['materials']:
                self.assertEqual(partition.vroid_category(material)[1], 'CLOTH',
                                 f'{name} 收了 {material}')

    def test_the_back_hair_baked_into_the_body_mesh_is_named_as_hair(self):
        self.assertEqual([partition.vroid_category(m)[1]
                          for m in self.body['Hair_BodyBack']['materials']],
                         ['HAIR'])
        self.assertTrue(self.body['Hair_BodyBack']['deletable'])

    def test_the_skin_is_the_skin_and_stays_locked(self):
        self.assertEqual([partition.vroid_category(m)[1]
                          for m in self.body['Body_Skin']['materials']],
                         ['SKIN'])
        self.assertFalse(self.body['Body_Skin']['deletable'])


class HairPlacedOnThisBodysSkeleton(unittest.TestCase):
    """The four numbers hair_name measures against, read off the body in hand.

    They were Mika's: below the waist at y 0.90, in front of the face at
    z -0.03, above y 1.44 for the back of the head, further from the midline
    than 0.12. Applied to Sakurada_Fumiriya, whose hips are 27cm higher, "below
    the waist" pointed at her knees.

    The two frames below are measured, not invented: partition.hair_frame reads
    them off those two files. Every case drives the real hair_name.
    """

    # Mika's base, where the four written-down numbers came from.
    MIKA = {'waist': 0.8782, 'front': -0.0246, 'crown': 1.4402,
            'midline': 0.0918, 'forward': -1, 'left': -1.0}
    # Sakurada_Fumiriya, the tallest of the sixteen.
    TALL = {'waist': 1.1470, 'front': -0.0390, 'crown': 1.8083,
            'midline': 0.1085, 'forward': -1, 'left': -1.0}
    # vrm1-twist-sample, a VRM 1.0 export: it faces +Z and its left is +X.
    VRM1 = {'waist': 0.9081, 'front': -0.0033, 'crown': 1.5172,
            'midline': 0.1088, 'forward': 1, 'left': 1.0}

    STRAND = 'F00_000_Hair_00_HAIR_01'
    DECAL = 'F00_000_Hair_00_HAIR_03'

    def test_below_the_waist_is_below_this_bodys_own_hips(self):
        # A strand reaching y 1.05 hangs past Sakurada's hips and stops well
        # above Mika's.
        low = (0.0, 1.30, 0.05)
        self.assertEqual(partition.hair_name(self.STRAND, low, 1.05, self.TALL),
                         'Hair_Twintail_R')
        self.assertNotIn('Twintail',
                         partition.hair_name(self.STRAND, low, 1.05, self.MIKA))

    def test_in_front_of_the_face_is_in_front_of_this_bodys_own_eyes(self):
        # z -0.030 is in front of Mika's eyes at -0.0246 and behind
        # Sakurada's at -0.039.
        c = (0.0, 1.40, -0.030)
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.35, self.MIKA),
                         'Hair_Bangs')
        self.assertNotEqual(partition.hair_name(self.STRAND, c, 1.35, self.TALL),
                            'Hair_Bangs')

    def test_which_way_is_forward_comes_from_the_export(self):
        # vrm1-twist-sample's single strand: z -0.061 against an eye at
        # -0.0033. On a 0.x body that reads as a fringe; on this one the model
        # faces +Z, so it is behind the eyes and is ordinary hair.
        c = (-0.004, 1.368, -0.061)
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.028, self.VRM1),
                         'Hair_Side_R')
        flipped = dict(self.VRM1, forward=-1)
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.028, flipped),
                         'Hair_Bangs')

    def test_the_back_of_the_head_starts_at_this_bodys_own_crown(self):
        # y 1.50 is above Mika's crown at 1.4402 and below Sakurada's at
        # 1.8083.
        c = (-0.06, 1.50, 0.04)
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.45, self.MIKA),
                         'Hair_Back')
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.45, self.TALL),
                         'Hair_Side_L')

    def test_off_the_midline_is_wider_than_this_bodys_own_skull(self):
        # |x| 0.10 is outside Mika's skull at 0.0918 and inside Sakurada's at
        # 0.1085. Only a clip decal is asked the question.
        c = (0.10, 1.40, 0.04)
        self.assertEqual(partition.hair_name(self.DECAL, c, 1.35, self.MIKA),
                         'Acc_HairOrnament')
        self.assertNotEqual(partition.hair_name(self.DECAL, c, 1.35, self.TALL),
                            'Acc_HairOrnament')

    def test_which_side_is_left_comes_from_the_eye_bone(self):
        # The character's left is -X on a 0.x export and +X on a 1.0 one, and
        # the eye bone says which without this having to know the version.
        # z -0.01 is behind the eyes on both frames, so both reach the side.
        c = (0.05, 1.40, -0.01)
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.35, self.MIKA),
                         'Hair_Side_R')
        self.assertEqual(partition.hair_name(self.STRAND, c, 1.35, self.VRM1),
                         'Hair_Side_L')

    def test_the_frame_is_read_off_the_body_and_lands_where_mikas_numbers_were(self):
        if not os.path.exists(BODY):
            raise unittest.SkipTest('public/avatar/mika-pink.vrm 不在')
        doc, binary = glb.load(BODY)
        f = partition.hair_frame(doc, glb.views_of(doc, binary))
        # 0.90, -0.03, 1.44 and 0.12 were the four written-down numbers.
        self.assertAlmostEqual(f['waist'], 0.878, places=3)
        self.assertAlmostEqual(f['front'], -0.025, places=3)
        self.assertAlmostEqual(f['crown'], 1.440, places=3)
        self.assertAlmostEqual(f['midline'], 0.092, places=3)

    def test_not_one_of_mikas_own_strands_changes_hands(self):
        # The regression pin: these counts are what the four written-down
        # numbers produced. 77 strands, and the body-relative frame moves none.
        if not os.path.exists(BODY):
            raise unittest.SkipTest('public/avatar/mika-pink.vrm 不在')
        parts = partitioned(BODY)['parts']
        self.assertEqual(
            {n: len(p['primitives']) for n, p in parts.items()
             if n.startswith(('Hair_', 'Acc_'))},
            {'Acc_HairClip_Base': 13, 'Acc_HairOrnament': 5, 'Hair_Back': 16,
             'Hair_Bangs': 11, 'Hair_Side_L': 9, 'Hair_Side_R': 9,
             'Hair_Twintail_L': 7, 'Hair_Twintail_R': 7})


class BodyWhoseMeshesAreNotNamedBaked(unittest.TestCase):
    """A VRoid export calling its meshes Body, Face and Hair, named correctly.

    Face.baked and Body.baked are VRoid Studio's own names and this step used
    to require them literally, so vrm1-twist-sample stopped at partition with
    "no mesh named Face.baked". Nothing about it is strange: it is a VRM 1.0
    sample whose material names follow the same grammar, and its back hair is
    baked into the mesh it calls Body, exactly as eight of the .baked bodies
    bake theirs into Body.baked.
    """

    OTHER = os.path.join(HERE, '..', '..', 'public', 'avatar',
                         'vrm1-twist-sample.vrm')

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(cls.OTHER):
            raise unittest.SkipTest('public/avatar/vrm1-twist-sample.vrm 不在')
        cls.doc = glb.load(cls.OTHER)[0]
        cls.manifest = partitioned(cls.OTHER)

    def test_none_of_its_meshes_carry_the_name_this_step_required(self):
        # If this ever fails the fixture stopped being the case under test.
        self.assertEqual(sorted(m.get('name') for m in self.doc['meshes']),
                         ['Body', 'Face', 'Hair'])

    def test_the_face_is_the_mesh_holding_the_morph_targets(self):
        face = self.manifest['parts']['Face']
        self.assertEqual(face['mesh'], 'Face')
        self.assertFalse(face['deletable'])
        mesh = next(m for m in self.doc['meshes'] if m.get('name') == 'Face')
        self.assertTrue(any(p.get('targets') for p in mesh['primitives']))

    def test_the_back_hair_baked_into_the_body_mesh_is_named_as_hair(self):
        # The grammar answers this, so the mesh it sits in is not consulted.
        part = self.manifest['parts']['Hair_BodyBack']
        self.assertEqual(part['mesh'], 'Body')
        self.assertEqual([partition.vroid_category(m)[0]
                          for m in part['materials']], ['HairBack'])

    def test_its_garments_and_skin_are_named_from_the_same_grammar(self):
        self.assertEqual(
            sorted(n for n in self.manifest['parts'] if not n.startswith('Hair_')),
            ['Body_Skin', 'Face', 'Outfit_Bottom', 'Outfit_Shoes', 'Outfit_Top'])
        self.assertFalse(self.manifest['parts']['Body_Skin']['deletable'])

    def test_turning_the_export_around_does_not_move_its_hair(self):
        # vrm1to0 faces a 1.0 body the 0.x way by parenting the scene to a node
        # rotated 180 degrees. Every bone moves and the vertex buffers do not,
        # so a rule comparing a bone against a raw POSITION reads this body's
        # whole head of hair as sitting in front of its eyes, and the pipeline
        # runs that conversion before partition on every 1.0 file it is given.
        doc, binary = glb.load(self.OTHER)
        path = os.path.join(scratch(), 'v0.vrm')
        glb.save(path, vrm1to0.convert(doc)[0], binary)
        self.assertEqual(sorted(partitioned(path)['parts']),
                         sorted(self.manifest['parts']))

    def test_lifting_the_whole_body_does_not_move_its_hair(self):
        # The other half of the same space question. A 180 degree turn leaves
        # every Y alone, so it cannot see the frame's own face measurement
        # being taken from raw POSITION; a translation can. Both halves have to
        # be in the rest world or the crown ends up half a metre below the head
        # it belongs to.
        doc, binary = glb.load(self.OTHER)
        scene = doc['scenes'][doc.get('scene', 0)]
        doc['nodes'].append({'name': 'lift', 'translation': [0, 0.5, 0],
                             'children': list(scene['nodes'])})
        scene['nodes'] = [len(doc['nodes']) - 1]
        path = os.path.join(scratch(), 'lifted.vrm')
        glb.save(path, doc, binary)
        self.assertEqual(sorted(partitioned(path)['parts']),
                         sorted(self.manifest['parts']))

    def test_the_strand_mesh_is_placed_by_geometry(self):
        # Its whole head of hair is one primitive, and it is behind the eyes:
        # this is a VRM 1.0 export, where the model faces +Z, so the strand at
        # z -0.061 sits behind an eye bone at -0.003. Reading front as "smaller
        # z" the way a 0.x body needs called it a fringe.
        strands = {n: p for n, p in self.manifest['parts'].items()
                   if p['mesh'] == 'Hair'}
        self.assertEqual(list(strands), ['Hair_Side_R'])


class BodyDrawingItsSkinInThreeLayers(unittest.TestCase):
    """VRoid Studio's dress-up export, whose skin is three meshes.

    It draws the body once, and then an unmasked copy of the torso under each
    garment so the garment has something to sit on. All three read SKIN out of
    the material grammar, so all three claim `Body_Skin`; the sole left behind
    in the body mesh and the shoes claim `Outfit_Shoes`. Two collisions, and
    resolving only the first would stop the body at the second.
    """

    OTHER = os.path.join(HERE, '..', '..', 'public', 'avatar',
                         'vroid-studio-dressup.vrm')
    # The same export before cover.trim cut the covered triangles away, read
    # out of git the way cover_test reads it. It is the one file on which
    # reach and size disagree about which layer is the body.
    EXPORT_BLOB = '6ae5189:public/avatar/vroid-studio-dressup.vrm'
    EXPORT_SHA = ('241a5803504144849c0ecbbfcac8e816fc9fe798907'
                  'af935bd8d372fdf8a805a')

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(cls.OTHER):
            raise unittest.SkipTest('public/avatar/vroid-studio-dressup.vrm 不在')
        cls.doc = glb.load(cls.OTHER)[0]
        cls.manifest = partitioned(cls.OTHER)

    @classmethod
    def export(cls):
        out = os.path.join(scratch(), 'export.vrm')
        with open(out, 'wb') as handle:
            subprocess.run(['git', '-C', os.path.join(HERE, '..', '..'),
                            'show', cls.EXPORT_BLOB], stdout=handle, check=True)
        digest = hashlib.sha256(open(out, 'rb').read()).hexdigest()
        if digest != cls.EXPORT_SHA:
            raise AssertionError(f'{cls.EXPORT_BLOB} is {digest}')
        return out

    def test_four_meshes_carry_skin_and_three_of_them_claim_the_name(self):
        # If this ever fails the fixture stopped being the case under test.
        # Four meshes carry a SKIN material and three claim `Body_Skin`: the
        # face mesh's skin primitive goes into the locked `Face` part before
        # any claim is made, so it never competes for the name.
        mats = [m.get('name', f'#{i}')
                for i, m in enumerate(self.doc['materials'])]
        skin = [mesh.get('name') for mesh in self.doc['meshes']
                for p in mesh['primitives']
                if partition.vroid_category(mats[p['material']])[1] == 'SKIN']
        self.assertEqual(sorted(skin), ['Body (merged).baked(copy).baked',
                                        'Face (merged)(Clone).baked.baked',
                                        'InnerBottom.baked', 'InnerTop.baked'])
        self.assertEqual(
            sorted(p['mesh'] for n, p in self.manifest['parts'].items()
                   if n.startswith('Body_Skin')),
            ['Body (merged).baked(copy).baked', 'InnerBottom.baked',
             'InnerTop.baked'])

    def test_the_label_written_into_the_geometry_is_the_manifests(self):
        # Steps after this one read the part off `extras.part` rather than off
        # the manifest: build.py twice, customise.drop_parts and
        # platform_validation. A trailing claim whose primitives are stamped
        # with the plain name merges three parts into one down there while the
        # manifest still lists three, and the manifest is what gets read when
        # anyone checks.
        out = scratch()
        parted = os.path.join(out, 'parted.vrm')
        manifest = partition.partition(
            self.OTHER, parted, os.path.join(out, 'parts.json'))[0]
        doc = glb.load(parted)[0]
        written = {(mesh.get('name'), i): prim.get('extras', {}).get('part')
                   for mesh in doc['meshes']
                   for i, prim in enumerate(mesh['primitives'])}
        for name, part in manifest['parts'].items():
            if name == 'Face':
                continue        # not split, so its primitives carry no label
            self.assertEqual(
                {written[(part['mesh'], i)] for i in part['primitives']},
                {name}, name)

    def test_the_layer_running_floor_to_crown_keeps_the_plain_skin_name(self):
        parts = self.manifest['parts']
        self.assertEqual(parts['Body_Skin']['mesh'],
                         'Body (merged).baked(copy).baked')
        self.assertEqual(parts['Body_Skin']['tris'], 3579)
        self.assertEqual([parts[n]['tris'] for n in
                          ('Body_Skin_2', 'Body_Skin_3')], [304, 304])

    def test_the_numbers_follow_document_order(self):
        # The two inner layers hold the same 298 vertices at the same
        # coordinates under materials of the same name, so nothing measurable
        # separates them and only a stable tie-break keeps the manifest from
        # changing between runs of the same file.
        order = [m.get('name') for m in self.doc['meshes']]
        self.assertLess(order.index('InnerBottom.baked'),
                        order.index('InnerTop.baked'))
        self.assertEqual(self.manifest['parts']['Body_Skin_2']['mesh'],
                         'InnerBottom.baked')
        self.assertEqual(self.manifest['parts']['Body_Skin_3']['mesh'],
                         'InnerTop.baked')

    def test_all_three_layers_stay_skin_for_the_steps_that_read_them(self):
        # The suffix carries no meaning; the prefix does. A layer read as a
        # garment would be deleted by the strip and would count as clothing
        # showing through in pierce.
        parts = self.manifest['parts']
        for name in ('Body_Skin', 'Body_Skin_2', 'Body_Skin_3'):
            self.assertFalse(parts[name]['deletable'], name)
        self.assertEqual(sorted(pierce.skin_parts(parts)),
                         ['Body_Skin', 'Body_Skin_2', 'Body_Skin_3', 'Face'])

    def test_a_numbered_garment_is_stripped_with_the_one_it_trails(self):
        # The other half of the prefix property, on the side where getting it
        # wrong leaves a garment on the body. An outfit contract names the
        # roles it takes the place of as prefixes, so a trailing name is
        # replaced for the same reason the plain one is.
        drop = customise.replaced(self.manifest, mellowheart.REPLACES)
        self.assertEqual(sorted(n for n in drop if n.startswith('Outfit_Shoes')),
                         ['Outfit_Shoes', 'Outfit_Shoes_2'])

    def test_the_sole_left_in_the_body_mesh_trails_the_shoes(self):
        parts = self.manifest['parts']
        self.assertEqual(parts['Outfit_Shoes']['mesh'], 'Shoes.baked')
        self.assertEqual(parts['Outfit_Shoes_2']['mesh'],
                         'Body (merged).baked(copy).baked')
        self.assertEqual(parts['Outfit_Shoes_2']['tris'], 20)

    def test_reach_rather_than_size_says_which_layer_is_the_body(self):
        # On the export before the cut the two rankings disagree: each inner
        # layer is 5,970 triangles against the body's 4,139, so ranking on
        # size hands Body_Skin to a torso patch with no head and no feet, and
        # humanoid.body_skin, envelope.leg_vertices, garment.body_pool and
        # measure.py all read whatever holds that name as the body.
        parts = partitioned(self.export())['parts']
        self.assertEqual(parts['Body_Skin']['mesh'],
                         'Body (merged).baked(copy).baked')
        self.assertEqual(parts['Body_Skin']['tris'], 4139)
        self.assertEqual([parts[n]['tris'] for n in
                          ('Body_Skin_2', 'Body_Skin_3')], [5970, 5970])


class Wiring(unittest.TestCase):
    """gate() being right proves nothing if make.main() still hands a step
    BASELINE instead of the `base` it was given (memory:
    feedback_injection_bypasses_wiring). Read the source: inside main(), the
    partition, every gate and the health check take `base`, and BASELINE
    appears only as main's default and the --base default."""

    def test_main_threads_base_through_every_step(self):
        with open(os.path.join(HERE, 'make.py'), encoding='utf-8') as fh:
            src = fh.read()
        body = src[src.index('def main('):src.index("if __name__ == '__main__':")]
        self.assertRegex(body, r"partition\.partition\(base,")
        # A 1.0 base is rewritten as 0.x BEFORE partition, and `base` is
        # rebound to the rewrite, or every later step reads the 1.0 file the
        # writers cannot handle.
        self.assertRegex(body, r"\n\s+base = vrm1to0\.ensure_vrm0\(base,")
        self.assertLess(body.index('vrm1to0.ensure_vrm0(base,'), body.index('partition.partition(base,'))
        self.assertRegex(body, r"verify\.report\(p\('mika-milfy\.vrm'\), base\)")
        calls = re.findall(r"gate\('[^']+', p\('[^']+'\)[^)]*\)", body)
        self.assertEqual(len(calls), 5, calls)
        for call in calls:
            self.assertTrue(call.endswith(', base)'), call)
        self.assertNotIn('BASELINE', body.split('\n', 1)[1], 'a step reads BASELINE directly')


if __name__ == '__main__':
    unittest.main()
