"""make.gate() judged against a base body instead of the number 54.

Phase 3 of the skeleton plan: the per-step gate used to require exactly 54
humanoid bones, which is VRoid's count and nobody else's. It now asks two
questions of the candidate against the base it was built from: did any bone
move or vanish (humanoid.compare), and does the file still declare every bone
the VRM spec requires (humanoid.required_missing). Every test here drives the
real make.gate on JSON-perturbed copies of the shipped base body written to a
temporary directory; the binary chunk is carried over untouched.
"""
import copy
import os
import re
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import humanoid  # noqa: E402
import make  # noqa: E402
import partition  # noqa: E402

BODY = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')


def perturbed(drop=()):
    """A copy of BODY with the named humanoid bones removed from the map."""
    doc, binary = glb.load(BODY)
    bones = doc['extensions']['VRM']['humanoid']['humanBones']
    doc['extensions']['VRM']['humanoid']['humanBones'] = [
        b for b in bones if b['bone'] not in drop]
    path = os.path.join(tempfile.mkdtemp(), 'body.vrm')
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

    partition names Body's parts by primitive INDEX and the hair by where a
    strand sits in this body's space. Neither survives a change of body, and
    before recognise() nothing said so: a mesh matching neither name fell
    through to hair_name for every primitive, so the 2026-09-07 Seed-san
    fixture run wrote a parts.json calling a robot's arm and clothes
    Hair_Twintail_R, Hair_Bangs and Hair_Side_L. It loaded. It read plausibly.
    Every later step would have believed it.
    """

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(BODY):
            raise unittest.SkipTest('public/avatar/mika-pink.vrm 不在')
        cls.doc = glb.load(BODY)[0]

    def test_the_body_this_step_was_written_for_is_recognised(self):
        self.assertEqual(partition.recognise(self.doc), [])

    def test_a_body_without_the_face_mesh_is_refused_by_name(self):
        doc = copy.deepcopy(self.doc)
        for m in doc['meshes']:
            if m.get('name') == partition.FACE_MESH:
                m['name'] = 'head'
        reasons = partition.recognise(doc)
        self.assertTrue(any(partition.FACE_MESH in r for r in reasons), reasons)
        # And it names what IS there, because that is the useful half to
        # somebody holding a body this step has never seen.
        self.assertTrue(any('head' in r for r in reasons), reasons)

    def test_a_body_mesh_with_a_different_primitive_count_is_recognised(self):
        # The count was the old check, and it asked the wrong question:
        # HairSample_Female exports six body primitives and Sendagaya_Shibu
        # nine, and both are ordinary VRoid bodies whose parts the material
        # grammar names exactly.
        doc = copy.deepcopy(self.doc)
        for m in doc['meshes']:
            if m.get('name') == partition.BODY_MESH:
                m['primitives'] = m['primitives'][:-1]
        self.assertEqual(partition.recognise(doc), [])

    def test_a_body_material_outside_the_grammar_is_refused_by_name(self):
        # What the count check was reaching for. A Body mesh whose materials
        # are somebody's hand-authored names carries no category token, so
        # there is nothing to read a part name off.
        doc = copy.deepcopy(self.doc)
        mesh = next(m for m in doc['meshes']
                    if m.get('name') == partition.BODY_MESH)
        doc['materials'][mesh['primitives'][5]['material']]['name'] = 'Mellow_Skirt'
        reasons = partition.recognise(doc)
        self.assertTrue(any('Mellow_Skirt' in r for r in reasons), reasons)

    def test_two_meshes_cannot_claim_the_same_part_name(self):
        # parts are keyed by label, so the second mesh to claim one used to
        # replace the first in silence. hair_name is stubbed only to create
        # the collision; the guard under test runs for real, inside the real
        # partition() on the real body.
        out = tempfile.mkdtemp()
        original = partition.hair_name
        partition.hair_name = lambda *a, **kw: 'Body_Skin'
        try:
            with self.assertRaises(SystemExit) as caught:
                partition.partition(BODY, os.path.join(out, 'o.vrm'),
                                    os.path.join(out, 'p.json'))
        finally:
            partition.hair_name = original
        self.assertIn('Body_Skin', str(caught.exception))
        self.assertFalse(os.path.exists(os.path.join(out, 'o.vrm')))

    def test_the_shipped_body_keeps_the_labels_the_index_table_gave(self):
        # The regression pin. This list is BODY_NAMES as it stood at c5af808,
        # in primitive order; the grammar has to reproduce it exactly or every
        # step downstream of partition is reading different parts.
        mats = [m['name'] for m in self.doc['materials']]
        mesh = next(m for m in self.doc['meshes']
                    if m.get('name') == partition.BODY_MESH)
        self.assertEqual(
            [partition.body_name(mats[p['material']]) for p in mesh['primitives']],
            ['Body_Skin', 'Body_Skin', 'Body_Skin', 'Body_Skin',
             'Outfit_Top', 'Outfit_Bottom', 'Outfit_Shoes'])

    def test_partition_refuses_rather_than_naming_a_stranger(self):
        doc = copy.deepcopy(self.doc)
        for m in doc['meshes']:
            m['name'] = 'not-a-vroid-mesh'
        path = os.path.join(tempfile.mkdtemp(), 'stranger.vrm')
        glb.save(path, doc, glb.load(BODY)[1])
        out = os.path.join(tempfile.mkdtemp(), 'parted.vrm')
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
        out = tempfile.mkdtemp()
        cls.manifest = partition.partition(cls.OTHER,
                                           os.path.join(out, 'o.vrm'),
                                           os.path.join(out, 'p.json'))[0]
        cls.body = {n: p for n, p in cls.manifest['parts'].items()
                    if p['mesh'] == partition.BODY_MESH}

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
