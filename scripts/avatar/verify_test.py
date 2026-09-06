"""verify.report() without the number 54, and dangling_joints per skin.

Phase 3 of the skeleton plan. report() used to fail any file that did not
declare exactly 54 humanoid bones; it now fails a file missing a bone the VRM
spec REQUIRES, by name, and leaves the count to the baseline comparison. The
file-level tests perturb the JSON of the shipped model (its binary chunk is
carried over untouched) and run the real report(), so they take a few seconds
each and skip when the shipped model is not on disk.
"""
import contextlib
import io
import os
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import verify  # noqa: E402

SHIPPED = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-11.vrm')


def perturbed(drop):
    doc, binary = glb.load(SHIPPED)
    bones = doc['extensions']['VRM']['humanoid']['humanBones']
    doc['extensions']['VRM']['humanoid']['humanBones'] = [
        b for b in bones if b['bone'] not in drop]
    path = os.path.join(tempfile.mkdtemp(), 'model.vrm')
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
            raise unittest.SkipTest('public/avatar/mika-milfy-11.vrm 不在')

    def test_a_model_without_an_optional_bone_passes(self):
        ok, text = quiet_report(perturbed(('upperChest',)))
        self.assertTrue(ok, text)
        self.assertIn('bones 53', text)

    def test_a_model_missing_a_required_bone_is_named(self):
        ok, text = quiet_report(perturbed(('leftHand',)))
        self.assertFalse(ok)
        self.assertIn('leftHand', text)


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
        path = os.path.join(tempfile.mkdtemp(), 'skins.glb')
        glb.save(path, doc, glb.rebuild(doc, views))
        return path

    def test_a_primitive_is_checked_against_its_own_nodes_skin(self):
        bad = verify.dangling_joints(self.doc())
        self.assertEqual([(b[0], b[1], b[2], b[3], b[4]) for b in bad], [('M', 0, 2, 2, 2)])


if __name__ == '__main__':
    unittest.main()
