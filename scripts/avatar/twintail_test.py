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
that is actually there.

Third round, same day: the second fix's area-weighted averaging shipped
clean on a full dance-clip sweep, but a thin "seam" triangle bridging two
vertex clusters has an area comparable to its well-formed neighbours despite
a much smaller angle at the shared vertex, so it pulled the vertex normal
towards its own face almost as hard as either -- a bright, hard-edged
"bump" at both former gap sites. Fixed by weighting each face by the angle
it subtends at the vertex (Max 1999) instead of by area. See
scripts/avatar/evidence/twintail-gap-0904.md.
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

    def test_a_thin_sliver_triangle_does_not_skew_the_shared_vertex(self):
        # 2026-09-04, third round: area-weighting (the first version of
        # smooth_normals, shipped as -7) produced a visible "bump" at the
        # exact sites the second round had just fixed. Root cause: a thin
        # "seam" triangle bridging a close vertex cluster to a far one has a
        # SMALL angle at the shared vertex but, because its far edge is
        # long, an area comparable to its well-formed neighbours -- so
        # area-weighting let it pull the normal almost as hard as either of
        # them. This reproduces that shape: two well-formed triangles at V
        # (90 degrees at V each) agree the normal is (0,-1,0); a third,
        # sliver triangle at V (interior angle ~9 degrees, chosen to mirror
        # the real defect's 11.7 degrees) has 3x the area of either and
        # faces a different direction entirely.
        positions = np.array([
            [0.0, 0.0, 0.0],     # 0: V, the shared vertex
            [1.0, 0.0, 0.0],     # 1: P1
            [0.0, 0.0, 1.0],     # 2: P2
            [-1.0, 0.0, 0.0],    # 3: P3
            [-20.0, -3.0, -1.0],  # 4: F, far end of the sliver
        ])
        indices = np.array([0, 1, 2, 0, 2, 3, 0, 3, 4])
        n = twintail.smooth_normals(positions, indices)
        angle_off = np.degrees(np.arccos(np.clip(np.dot(n[0], [0.0, -1.0, 0.0]), -1, 1)))
        # Pure area-weighting on this exact geometry computes 45.0 degrees
        # off -- confirmed by hand and by temporarily reverting this
        # function to area-weighting, which turns this assertion red.
        self.assertLess(angle_off, 5.0)

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


class SmoothScalarTest(unittest.TestCase):
    def test_an_odd_one_out_moves_towards_its_topological_neighbours(self):
        # A fan of 4 triangles around hub vertex 0: the hub reads 0.0, all
        # four rim vertices read 1.0 -- the shape of the actual defect (free
        # 2026-09-04: one vertex reading free=0.00 next to a same-strand
        # neighbour reading free=0.63, both individually correct scalp-
        # distance readings that a narrow SCALP_BAND was supposed to blend
        # smoothly but does not, because the query has no notion of mesh
        # adjacency). One pass should land the hub and rim vertices at the
        # values hand-derived from the accumulation (each rim vertex shares
        # ITS OWN edge to the hub with two adjacent fan triangles, so the hub
        # counts twice in a rim vertex's neighbour average).
        positions = np.zeros((5, 3))
        values = np.array([0.0, 1.0, 1.0, 1.0, 1.0])
        indices = np.array([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1])
        out = twintail.smooth_scalar(values, indices, passes=1)
        np.testing.assert_allclose(out, [0.5, 0.75, 0.75, 0.75, 0.75])

    def test_more_passes_keep_converging_towards_the_neighbourhood(self):
        # Mutation target: a version that ignores `passes` (always doing
        # exactly one blend) would return the same array both times.
        positions = np.zeros((5, 3))
        values = np.array([0.0, 1.0, 1.0, 1.0, 1.0])
        indices = np.array([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1])
        one = twintail.smooth_scalar(values, indices, passes=1)
        two = twintail.smooth_scalar(values, indices, passes=2)
        self.assertGreater(two[0], one[0])
        self.assertLess(two[1], one[1])

    def test_a_value_with_no_triangles_is_left_alone(self):
        # `values` can be longer than what `indices` references (a primitive
        # can carry vertices no triangle uses). Averaging with a divide-by-
        # zero neighbour count would incorrectly drag such a vertex to 0.
        positions = np.zeros((4, 3))
        values = np.array([1.0, 1.0, 1.0, 0.4])
        indices = np.array([0, 1, 2])  # vertex 3 is untouched
        out = twintail.smooth_scalar(values, indices, passes=1)
        self.assertEqual(out[3], 0.4)


if __name__ == '__main__':
    unittest.main()
