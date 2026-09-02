"""Focused tests for garment geometry fitting."""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import outfit  # noqa: E402


class RingFitTest(unittest.TestCase):
    def setUp(self):
        self.body = np.array([
            [-0.100, 0.60, -0.050], [-0.020, 0.60, 0.050],
            [-0.100, 0.70, 0.050], [-0.020, 0.70, -0.050],
        ])
        self.main_y = np.array([0.60, 0.60, 0.70, 0.70])
        self.main = self.make_item(
            'Leg_belt', 0,
            np.column_stack(([-0.14, 0.00, -0.14, 0.00], self.main_y,
                             [-0.08, -0.08, 0.08, 0.08])),
        )
        self.jewel = self.make_item(
            'Leg_belt', 1,
            np.array([[-0.14, 0.65, 0.00], [-0.13, 0.65, 0.01]]),
        )
        self.items = [self.main, self.jewel]
        self.materials = [{'name': 'Leg_Acc'}, {'name': 'Jewel'}]

    @staticmethod
    def make_item(name, material, pos):
        count = len(pos)
        return {
            'name': name,
            'material': material,
            'targets': {'wide': np.full((count, 3), [0.01, 0.02, 0.03])},
            'piece': {
                'pos': pos.astype(np.float64),
                'nrm': np.tile([1.0, 0.0, 1.0], (count, 1)),
            },
        }

    def fit(self):
        return outfit.fit_ring_to_limb(
            self.items, self.body, self.materials,
            'Leg_belt', 'Leg_Acc', 0.0, 0.001,
        )

    def test_main_ring_matches_limb_diameter_with_clearance(self):
        self.fit()
        actual = np.ptp(self.main['piece']['pos'][:, [0, 2]], axis=0)
        np.testing.assert_allclose(actual, [0.082, 0.102], atol=1e-9)

    def test_companion_primitive_uses_the_same_affine_fit(self):
        jewel_before = self.jewel['piece']['pos'][:, [0, 2]].copy()
        scale, ring_center, limb_center, _ = self.fit()
        expected = jewel_before * scale + limb_center - ring_center * scale
        np.testing.assert_allclose(
            self.jewel['piece']['pos'][:, [0, 2]], expected, atol=1e-9)

    def test_fit_preserves_vertical_positions(self):
        y_before = self.main['piece']['pos'][:, 1].copy()
        self.fit()
        np.testing.assert_array_equal(self.main['piece']['pos'][:, 1], y_before)

    def test_fit_bends_normals_by_the_inverse_scale(self):
        scale, _, _, _ = self.fit()
        expected = np.array([1.0 / scale[0], 0.0, 1.0 / scale[1]])
        expected /= np.linalg.norm(expected)
        np.testing.assert_allclose(
            self.main['piece']['nrm'],
            np.tile(expected, (len(self.main['piece']['nrm']), 1)), atol=1e-9)
        lengths = np.linalg.norm(self.jewel['piece']['nrm'], axis=1)
        np.testing.assert_allclose(lengths, 1.0, atol=1e-9)

    def test_fit_scales_morph_deltas(self):
        delta_before = self.main['targets']['wide'].copy()
        scale, _, _, _ = self.fit()
        expected = delta_before.copy()
        expected[:, [0, 2]] *= scale
        np.testing.assert_allclose(self.main['targets']['wide'], expected, atol=1e-9)

if __name__ == '__main__':
    unittest.main()
