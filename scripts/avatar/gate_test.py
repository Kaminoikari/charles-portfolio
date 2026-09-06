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

    def test_a_body_whose_body_mesh_has_a_different_primitive_count_is_refused(self):
        # The subtler half. A mesh CALLED Body.baked with eight primitives is
        # not this body: BODY_NAMES stops at index 6, so primitive 7 would
        # raise a KeyError deep inside the loop, and one with six would name
        # only part of the outfit and silently leave the rest as Body_Skin.
        doc = copy.deepcopy(self.doc)
        for m in doc['meshes']:
            if m.get('name') == partition.BODY_MESH:
                m['primitives'] = m['primitives'][:-1]
        reasons = partition.recognise(doc)
        self.assertTrue(any('BODY_NAMES' in r for r in reasons), reasons)

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
