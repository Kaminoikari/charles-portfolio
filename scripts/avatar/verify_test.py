"""verify.report() without the number 54, and dangling_joints per skin.

Phase 3 of the skeleton plan. report() used to fail any file that did not
declare exactly 54 humanoid bones; it now fails a file missing a bone the VRM
spec REQUIRES, by name, and leaves the count to the baseline comparison. The
file-level tests perturb the JSON of the shipped model (its binary chunk is
carried over untouched) and run the real report(), so they take a few seconds
each and skip when the shipped model is not on disk.
"""
import atexit
import contextlib
import io
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import verify  # noqa: E402

SHIPPED = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-12.vrm')


# Every copy the helpers in this file write carries the whole binary chunk, so
# one body is twelve megabytes and a mutation pass makes dozens. Left behind,
# they filled 8.63GB of /var/folders by 2026-09-10 and took the disk to 100%, at
# which point every `glb.save` here raises and the run reads like a wall of real
# findings rather than like a full disk. There are four sites: `perturbed`,
# `snapped_weights` and `DanglingJoints.doc` are reached without a test instance
# to hang cleanup on, so their copies go under this one root, removed when the
# process exits; `edited` is a method and frees its own directory as each test
# ends, which matters over a long run. A first pass at this fixed two of the
# four and the evidence claimed all of them, which is what the code reviewers
# caught.
_ROOM = tempfile.mkdtemp(prefix='verify_test-')
atexit.register(shutil.rmtree, _ROOM, True)


def perturbed(drop):
    doc, binary = glb.load(SHIPPED)
    bones = doc['extensions']['VRM']['humanoid']['humanBones']
    doc['extensions']['VRM']['humanoid']['humanBones'] = [
        b for b in bones if b['bone'] not in drop]
    path = os.path.join(tempfile.mkdtemp(dir=_ROOM), 'model.vrm')
    glb.save(path, doc, binary)
    return path


def quiet_report(path, baseline=None):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        ok, _ = verify.report(path, baseline)
    return ok, out.getvalue()


class Report(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(SHIPPED):
            raise unittest.SkipTest('public/avatar/mika-milfy-12.vrm 不在')

    def test_a_model_without_an_optional_bone_passes(self):
        ok, text = quiet_report(perturbed(('upperChest',)))
        self.assertTrue(ok, text)
        self.assertIn('bones 53', text)

    def test_a_model_missing_a_required_bone_is_named(self):
        ok, text = quiet_report(perturbed(('leftHand',)))
        self.assertFalse(ok)
        self.assertIn('leftHand', text)


def snapped_weights(part_name):
    """The shipped file with one part's weights snapped to each vertex's
    dominant joint: the hard handovers a nearest-vertex copy leaves at the
    armpit, everywhere."""
    import json
    doc, binary = glb.load(SHIPPED)
    views = glb.views_of(doc, binary)
    manifest = json.load(open(SHIPPED.replace('.vrm', '.parts.json')))
    info = manifest['parts'][part_name]
    mesh = next(m for m in doc['meshes'] if m['name'] == info['mesh'])
    for pi in info['primitives']:
        acc = doc['accessors'][mesh['primitives'][pi]['attributes']['WEIGHTS_0']]
        assert acc['componentType'] == 5126 and acc['type'] == 'VEC4'
        view = views[acc['bufferView']]
        off = acc.get('byteOffset', 0)
        w = np.frombuffer(bytes(view[off:off + acc['count'] * 16]), dtype='<f4').reshape(-1, 4)
        snapped = np.zeros_like(w)
        np.put_along_axis(snapped, w.argmax(axis=1)[:, None], 1.0, axis=1)
        view[off:off + acc['count'] * 16] = snapped.astype('<f4').tobytes()
    path = os.path.join(tempfile.mkdtemp(dir=_ROOM), 'snapped.vrm')
    glb.save(path, doc, glb.rebuild(doc, views))
    return path


class TornBindings(unittest.TestCase):
    """No garment on the shipped model tears when an arm bends, and one whose
    weights hand over hard between joints is named. The file-level half of
    garment_test.Smoothing: that one proves the smoothing spreads a handover,
    this one proves the shipped build went through it."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(SHIPPED):
            raise unittest.SkipTest('public/avatar/mika-milfy-12.vrm 不在')

    def test_the_shipped_garments_survive_an_arm_bend(self):
        self.assertEqual(verify.torn_bindings(SHIPPED), [])

    def test_hard_handovers_on_the_cardigan_are_named(self):
        bad = verify.torn_bindings(snapped_weights('Outfit_Cardigan'))
        self.assertTrue(bad, 'snapped cardigan weights should tear')
        self.assertEqual({(b[0], b[1]) for b in bad}, {('Body.baked', 22)})
        self.assertGreater(max(b[4] for b in bad), verify.BIND_GROWTH_MAX_MM)

    def test_report_fails_a_torn_binding(self):
        ok, text = quiet_report(snapped_weights('Outfit_Cardigan'))
        self.assertFalse(ok)
        self.assertIn('tear when an arm bends: ', text)
        self.assertIn('Body.baked#22 grows an edge', text)


class DanglingJoints(unittest.TestCase):
    """A primitive is judged against the skin ITS OWN node uses, not the first
    skin in the file. Three skins with different lengths; the mesh on the short
    third skin indexes past it but not past the first."""

    def doc(self):
        doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0, 3]}],
               'nodes': [{'name': 'root', 'children': [1, 2]}, {'name': 'a'}, {'name': 'b'},
                         {'name': 'draw', 'mesh': 0, 'skin': 2}],
               'bufferViews': [], 'accessors': [], 'meshes': [],
               'skins': [{'joints': [0, 1, 2]}, {'joints': [0, 1, 2]}, {'joints': [0, 1]}]}
        views = []
        for s in doc['skins']:
            n = len(s['joints'])
            s['inverseBindMatrices'] = glb.add_accessor(
                doc, views, np.tile(np.eye(4, dtype=np.float32).reshape(1, 16), (n, 1)))
        pos = np.zeros((3, 3), np.float32)
        joints = np.array([[2, 0, 0, 0]] * 3, np.uint16)      # slot 2: fine on skin 0, past skin 2
        att = {'POSITION': glb.add_accessor(doc, views, pos, 34962),
               'JOINTS_0': glb.add_accessor(doc, views, joints, 34962),
               'WEIGHTS_0': glb.add_accessor(doc, views, np.array([[1, 0, 0, 0]] * 3, np.float32), 34962)}
        doc['meshes'].append({'name': 'M', 'primitives': [
            {'attributes': att, 'indices': glb.add_accessor(doc, views, np.array([0, 1, 2], np.uint16), 34963)}]})
        path = os.path.join(tempfile.mkdtemp(dir=_ROOM), 'skins.glb')
        glb.save(path, doc, glb.rebuild(doc, views))
        return path

    def test_a_primitive_is_checked_against_its_own_nodes_skin(self):
        bad = verify.dangling_joints(self.doc())
        self.assertEqual([(b[0], b[1], b[2], b[3], b[4]) for b in bad], [('M', 0, 2, 2, 2)])


class VersionBoundChecks(unittest.TestCase):
    """The five checks that read a VRM 0.x extension, run on a VRM 1.0 body.

    `verify.report` is this project's gate, and until now it could not see a
    1.0 file at all: `loud_outlines` indexed `extensions.VRM` and raised
    KeyError three checks in, which is also why `undeclared_rims` never got far
    enough to raise on the same index. What the other three did is worse than
    raising. `torn_shapes` saw no expressions, so it skipped no mesh and
    reported 45 tears on a correct face; `stranded_collider_groups` and
    `misaligned_material_properties` read an `extensions.VRM.<something>` that
    is not there, got nothing, and returned an empty list, which reads as a
    pass. Everything a 1.0 body was "verified" against went through a wrapper in
    a gitignored build directory instead.

    The fixture is `seed-san.vrm`, the licensed 1.0 body the skeleton work
    already uses (docs/plans/avatar-fixture-seed-san.md): 17 materials of which
    10 carry MToon, 9 springs, 2 collider groups, 18 expressions binding one
    mesh. `alicia-solid.vrm` is its 0.x counterpart, so every check here is
    pinned on both versions rather than moved from one to the other.
    """

    V1 = os.path.join(HERE, 'fixtures', 'seed-san.vrm')
    V0 = os.path.join(HERE, 'fixtures', 'alicia-solid.vrm')

    @classmethod
    def setUpClass(cls):
        for path in (cls.V1, cls.V0):
            if not os.path.exists(path):
                raise unittest.SkipTest(f'{os.path.basename(path)} 不在')

    def edited(self, path, edit):
        """A copy of `path` with `edit(doc)` applied. Binary chunk untouched.

        Removed when the test ends. These copies carry the whole binary chunk,
        so a body is tens of megabytes and a mutation run makes dozens of them;
        the tests in this directory had leaked 8.6GB of them into /var/folders
        by 2026-09-10, and a full disk turns every `glb.save` here into an
        ERROR that reads like a real finding.
        """
        doc, binary = glb.load(path)
        edit(doc)
        room = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, room, True)
        out = os.path.join(room, 'edited.vrm')
        glb.save(out, doc, binary)
        return out

    @staticmethod
    def mtoon(doc, index=0):
        return doc['materials'][index]['extensions']['VRMC_materials_mtoon']

    def test_report_runs_on_a_vrm1_body(self):
        # It raised KeyError('VRM') at loud_outlines before this, so nothing
        # after that line had ever run on a 1.0 file.
        ok, text = quiet_report(self.V1)
        self.assertIn('bones', text)
        # The printed line is its own defence and needs its own assertion. The
        # sentinel makes the CHECK say it did not run; this is report() saying
        # so on the page, which is the half a reader sees. Without this line the
        # branch was held only by `_NotApplicable` having no `__getitem__`, so a
        # later `skew[:5]` raised -- give the sentinel that method and a silent
        # `0` comes back with all 14 tests green.
        self.assertIn('materialProperties: N/A on VRM 1.0', text)

    def test_a_loud_outline_is_found_on_either_version(self):
        # VRM 1.0 spells it VRMC_materials_mtoon.outlineColorFactor; 0.x spells
        # it materialProperties[].vectorProperties._OutlineColor. Same defect,
        # same chroma, so the same planted colour must be found on both.
        planted = [0.6, 0.1, 0.2]

        def v1(doc):
            self.mtoon(doc).update({'outlineColorFactor': planted})

        def v0(doc):
            props = doc['extensions']['VRM']['materialProperties'][0]
            props.setdefault('vectorProperties', {})['_OutlineColor'] = planted + [1]

        # The label is in the message because these two halves fail with the
        # same assertion line and the copy's path is a random temp name, so a
        # mutation log could not otherwise say which version broke.
        for label, path in (('seed-san 1.0', self.edited(self.V1, v1)),
                            ('alicia-solid 0.x', self.edited(self.V0, v0))):
            loud = verify.loud_outlines(path)
            self.assertTrue(any(round(chroma, 3) == 0.5 for _, _, chroma in loud),
                            (label, loud))

    def test_the_width_mode_is_not_consulted_on_either_version(self):
        # Deliberate, and measured before it was decided. A material whose
        # outline width mode is off draws no second pass, so its colour cannot
        # recolour anything, and skipping those would be defensible -- but it
        # would move the SHIPPED 0.x reading from 13 loud materials to 5, on
        # mika-pink and AvatarSample_B alike. That is a question about this
        # check's threshold, the same on both versions, and answering it here
        # would smuggle a loosening in under a coverage fix. So the check reads
        # the colour and nothing else, and this test says so out loud.
        def v1(doc):
            self.mtoon(doc).update({'outlineColorFactor': [0.6, 0.1, 0.2],
                                    'outlineWidthMode': 'none'})

        def v0(doc):
            prop = doc['extensions']['VRM']['materialProperties'][0]
            prop.setdefault('vectorProperties', {})['_OutlineColor'] = [
                0.6, 0.1, 0.2, 1]
            # 0 is the 0.x spelling of 'none'; alicia-solid states 1 here.
            prop.setdefault('floatProperties', {})['_OutlineWidthMode'] = 0

        for label, path in (('seed-san 1.0', self.edited(self.V1, v1)),
                            ('alicia-solid 0.x', self.edited(self.V0, v0))):
            self.assertTrue(any(round(chroma, 3) == 0.5
                                for _, _, chroma in verify.loud_outlines(path)),
                            label)

    def test_a_stated_rim_is_not_called_undeclared_on_a_vrm1_body(self):
        # The counts are the assertion, not "some are quiet". This fixture has
        # 17 materials: 7 carry no MToon at all, 7 more state (0,0,0), and 3
        # state a real colour, so 14 are quiet and the 3 must be absent. A first
        # version of this test asserted only "the planted one dropped out and
        # the list is non-empty", and a mutation that gave EVERY 1.0 material a
        # rim left it green -- the 7 without MToon kept the list non-empty on
        # their own. Planting a colour on a quiet one takes 14 to 13, which no
        # reader that ignores 1.0 can produce.
        doc, _ = glb.load(self.V1)
        self.assertEqual(14, len(verify.undeclared_rims(self.V1)))
        for index in range(len(doc['materials'])):
            block = (doc['materials'][index].get('extensions') or {}).get(
                'VRMC_materials_mtoon') or {}
            if max(block.get('parametricRimColorFactor') or [0]) > 0:
                self.assertNotIn(doc['materials'][index].get('name'),
                                 verify.undeclared_rims(self.V1))
        painted = self.edited(self.V1, lambda d: self.mtoon(d).update(
            {'parametricRimColorFactor': [0.2, 0.9, 0.7]}))
        self.assertEqual(13, len(verify.undeclared_rims(painted)))
        self.assertNotIn(doc['materials'][0].get('name'),
                         verify.undeclared_rims(painted))

    def test_a_stranded_collider_group_is_found_on_a_vrm1_body(self):
        # 1.0 keeps them in VRMC_springBone.colliderGroups, addressed by index
        # from springs[].colliderGroups. Reading only the 0.x path returned []
        # here, which is what a clean file looks like.
        def strand(doc):
            sb = doc['extensions']['VRMC_springBone']
            sb['colliderGroups'].append({'name': 'stranded', 'colliders': []})
        stranded = verify.stranded_collider_groups(self.edited(self.V1, strand))
        self.assertEqual(1, len(stranded), stranded)

    def test_a_clean_vrm1_body_strands_nothing(self):
        self.assertEqual([], verify.stranded_collider_groups(self.V1))

    def test_torn_shapes_skips_the_mesh_a_vrm1_expression_binds(self):
        # The whole point of the check is that a face's own expressions fold and
        # collapse by design. On 1.0 it could not see which mesh they bind, so
        # it measured the face: 45 reported on this fixture, every one on `head`,
        # the single mesh its 18 expressions bind through node 2.
        self.assertEqual([], verify.torn_shapes(self.V1))

    def test_material_property_alignment_says_it_cannot_run_on_vrm1(self):
        # This one has no 1.0 equivalent: 1.0 puts MToon ON the material, so
        # there is no second array to fall out of step with. Returning [] would
        # read as "checked, clean". It has to say it did not run.
        self.assertIs(verify.NOT_APPLICABLE,
                      verify.misaligned_material_properties(self.V1))
        self.assertEqual([], verify.misaligned_material_properties(self.V0))


if __name__ == '__main__':
    unittest.main()
