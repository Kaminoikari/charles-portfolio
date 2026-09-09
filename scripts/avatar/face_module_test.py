"""Contract tests for the neutral-tangent jaw deformation prototype."""
import copy
import unittest
from unittest.mock import patch

import numpy as np

import face_module
import glb


class JawFieldTest(unittest.TestCase):
    def setUp(self):
        self.positions = np.array([[.08, .0, 0], [.08, .5, 0], [.08, 1., 0], [.08, 1.2, 0]])

    def test_identity_keeps_positions(self):
        out, _ = face_module.field(self.positions, 1., 0., 1.)
        np.testing.assert_array_equal(out, self.positions)

    def test_jaw_moves_but_boundaries_and_upper_face_stay(self):
        out, _ = face_module.field(self.positions, 1.12, 0., 1.)
        np.testing.assert_allclose(out[[0, 2, 3]], self.positions[[0, 2, 3]])
        self.assertAlmostEqual(out[1, 0], .0896)

    def test_frozen_affine_field_preserves_blended_position_deltas(self):
        out, matrices = face_module.field(self.positions, .88, 0., 1.)
        first = np.ones_like(out) * .01
        second = np.ones_like(out) * -.003
        actual = out + face_module.transform_delta(first, matrices) + face_module.transform_delta(second, matrices)
        expected = out + face_module.transform_delta(first + second, matrices)
        np.testing.assert_allclose(actual, expected)

    def test_normals_are_unit_and_perpendicular_to_transformed_tangent(self):
        positions = np.array([[.08, .25, 0]])
        _, matrices = face_module.field(positions, 1.12, 0., 1.)
        normal = np.array([[1., 0., 0.]])
        transformed = face_module.transform_normals(normal, matrices)
        tangent = face_module.transform_delta(np.array([[0., 1., 0.]]), matrices)
        self.assertAlmostEqual(float((transformed * tangent).sum()), 0.)
        self.assertAlmostEqual(float(np.linalg.norm(transformed)), 1.)

    def test_invalid_parameters_are_rejected(self):
        for value in (True, float('nan'), float('inf'), .87, 1.13, '1.0'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                face_module.validate_parameters({'jaw_width': value})

    def test_unknown_parameters_are_rejected(self):
        with self.assertRaises(ValueError):
            face_module.validate_parameters({'jaw_width': 1., 'head_scale': 2.})


class ApplyTest(unittest.TestCase):
    def setUp(self):
        self.doc = {'accessors': [], 'bufferViews': [], 'meshes': []}
        self.views = []
        self.positions = np.array([[.08, 0, 0], [.08, .5, 0], [.08, 1.2, 0]], dtype='<f4')
        self.normals = np.tile([1., 0., 0.], (3, 1)).astype('<f4')
        self.delta = np.tile([.01, .02, 0.], (3, 1)).astype('<f4')
        self.normal_delta = np.tile([-.1, .2, 0.], (3, 1)).astype('<f4')
        add = lambda values: glb.add_accessor(self.doc, self.views, values)
        self.position_index = add(self.positions)
        attributes = {'POSITION': self.position_index, 'NORMAL': add(self.normals)}
        target = {'POSITION': add(self.delta), 'NORMAL': add(self.normal_delta)}
        self.doc['meshes'] = [
            {'name': 'Face.baked', 'primitives': [
                {'attributes': dict(attributes), 'targets': [dict(target)], 'indices': 91},
                {'attributes': dict(attributes), 'targets': [dict(target)], 'indices': 92}]},
            {'name': 'Body', 'primitives': [{'attributes': dict(attributes)}]},
        ]
        self.manifest = {'parts': {'Face': {'mesh': 'Face.baked'}}}
        eye = np.eye(4)
        eye[1, 3] = 1.
        self.addCleanup(patch.stopall)
        patch.object(face_module.humanoid, 'rest_world', return_value={4: eye, 5: eye}).start()
        patch.object(face_module.humanoid, 'bones', return_value={'leftEye': 4, 'rightEye': 5}).start()

    def test_apply_writes_shared_face_positions_once(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.12})
        primitives = self.doc['meshes'][0]['primitives']
        self.assertEqual(primitives[0]['attributes'], primitives[1]['attributes'])
        actual = glb.read_accessor(self.doc, self.views, primitives[0]['attributes']['POSITION'])
        self.assertAlmostEqual(float(actual[1, 0]), .0896)

    def test_apply_leaves_other_mesh_payload_unchanged(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.12})
        original = glb.read_accessor(self.doc, self.views, self.position_index)
        np.testing.assert_array_equal(original, self.positions)

    def test_apply_serialises_correct_position_morph(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.12})
        index = self.doc['meshes'][0]['primitives'][0]['targets'][0]['POSITION']
        actual = glb.read_accessor(self.doc, self.views, index)
        expected = self.delta.copy()
        expected[1, 0] *= 1.12
        np.testing.assert_allclose(actual, expected, atol=1e-8)

    def test_apply_serialises_correct_normal_endpoint(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': .88})
        primitive = self.doc['meshes'][0]['primitives'][0]
        normal = glb.read_accessor(self.doc, self.views, primitive['attributes']['NORMAL'])
        delta = glb.read_accessor(self.doc, self.views, primitive['targets'][0]['NORMAL'])
        expected = self.normals + self.normal_delta
        expected[1, 0] /= .88
        expected /= np.linalg.norm(expected, axis=1, keepdims=True)
        np.testing.assert_allclose(normal + delta, expected, atol=1e-7)

    def test_identity_does_not_rewrite_any_payload(self):
        original = copy.deepcopy((self.doc, self.views))
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.})
        self.assertEqual((self.doc, self.views), original)

    def test_conflicting_shared_layout_is_rejected_before_mutation(self):
        self.doc['meshes'][0]['primitives'][1]['attributes']['POSITION'] = 99
        original = copy.deepcopy((self.doc, self.views))
        with self.assertRaises(ValueError):
            face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.12})
        self.assertEqual((self.doc, self.views), original)


if __name__ == '__main__':
    unittest.main()
