"""Regression check for the twintail hair normals (twintail.apply).

2026-09-04: each twintail showed a dark gap during motion (spin, dance).
First fix (normal_horizontal_scale, since deleted) treated each vertex's
normal as a function of its own (fade, r) -- correct at the two ends of the
transition band, but rolling a flat curtain into a round bundle turns
normals through close to 90 degrees near the seam, which no per-vertex
formula computed from local scale factors alone can reproduce as a
continuous field. Measured on the -6 build (which had already shipped that
first fix): individual vertices still up to 90 degrees off from the normal
their own deformed triangles actually have, on both tails, spanning nearly
the full tail length. Second fix: read the normal off the deformed geometry
itself (twintail.smooth_normals), which cannot disagree with the surface
that is actually there. See scripts/avatar/evidence/twintail-gap-0904.md.
"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import twintail  # noqa: E402


class SmoothNormalsTest(unittest.TestCase):
    def test_flat_quad_normal_matches_its_winding(self):
        # Two triangles forming a unit square in the XZ plane. The direction
        # is whatever cross(p1-p0, p2-p0) gives for this mesh's winding
        # convention -- the point of this test is that reversing the winding
        # (below) reverses it, not a claim about which way is "up".
        positions = np.array([
            [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [0.0, 0.0, 1.0],
        ])
        indices = np.array([0, 2, 1, 0, 3, 2])
        n = twintail.smooth_normals(positions, indices)
        np.testing.assert_allclose(n, np.tile([0.0, 1.0, 0.0], (4, 1)), atol=1e-9)

    def test_reversed_winding_flips_the_normal(self):
        # Mutation: swapping the winding of every triangle must flip every
        # normal. If it didn't, smooth_normals would be reading something
        # other than the triangles it was handed.
        positions = np.array([
            [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0], [0.0, 0.0, 1.0],
        ])
        indices = np.array([0, 1, 2, 0, 2, 3])
        n = twintail.smooth_normals(positions, indices)
        np.testing.assert_allclose(n, np.tile([0.0, -1.0, 0.0], (4, 1)), atol=1e-9)

    def test_averages_across_a_fold(self):
        # A hinge along the Z axis (vertices 0,1): wing A lies flat in the XZ
        # plane (face normal +Y), wing B is folded 90 degrees into the XY
        # plane (face normal +X). The two hinge vertices are shared by both
        # triangles, so their normal has to be SOME combination of both faces
        # -- this is the exact situation a curtain rolled into a round bundle
        # produces continuously along the seam, and it is what no per-vertex
        # formula computed from that vertex's own local scale factors alone
        # (normal_horizontal_scale, since deleted) can reproduce: each face
        # alone is defensible, only the field across both is wrong.
        positions = np.array([
            [0.0, 0.0, 0.0],   # 0: hinge
            [0.0, 0.0, 1.0],   # 1: hinge
            [1.0, 0.0, 0.0],   # 2: wing A tip, in the XZ plane
            [0.0, 1.0, 0.0],   # 3: wing B tip, folded into the XY plane
        ])
        indices = np.array([0, 1, 2, 1, 0, 3])
        n = twintail.smooth_normals(positions, indices)
        expected_hinge = np.array([1.0, 1.0, 0.0]) / np.sqrt(2)
        np.testing.assert_allclose(n[0], expected_hinge, atol=1e-9)
        np.testing.assert_allclose(n[1], expected_hinge, atol=1e-9)
        np.testing.assert_allclose(n[2], [0.0, 1.0, 0.0], atol=1e-9)
        np.testing.assert_allclose(n[3], [1.0, 0.0, 0.0], atol=1e-9)

    def test_a_per_vertex_formula_cannot_match_the_hinge(self):
        # The two faces meeting at the hinge are 90 degrees apart, so no
        # single scale factor applied to a vertex's ORIGINAL (pre-fold)
        # normal can land on the correct averaged answer for both faces at
        # once -- exactly the failure mode the deleted normal_horizontal_scale
        # had (up to 90 degrees off, measured on the shipped -6 build).
        positions = np.array([
            [0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0],
        ])
        indices = np.array([0, 1, 2, 1, 0, 3])
        n = twintail.smooth_normals(positions, indices)
        angle_between_faces = np.degrees(np.arccos(np.clip(
            np.dot([0.0, 1.0, 0.0], [1.0, 0.0, 0.0]), -1, 1)))
        angle_to_either_face = np.degrees(np.arccos(np.clip(
            np.dot(n[0], [0.0, 1.0, 0.0]), -1, 1)))
        self.assertAlmostEqual(angle_between_faces, 90.0)
        self.assertGreater(angle_to_either_face, 30.0)


if __name__ == '__main__':
    unittest.main()
