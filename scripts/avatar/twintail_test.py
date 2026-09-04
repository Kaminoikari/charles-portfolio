"""Regression check for the twintail hair-normal Jacobian (twintail.apply).

2026-09-04: each twintail showed a dark gap at the tie/scalp boundary, worst
when the tail swung mid-turn or mid-dance. Root cause: the normal transform
used `where(fade > 0, 1/r, 1)`, which only matches the true horizontal
Jacobian of the position blend at fade=1. Everywhere strictly between 0 and 1
-- most of SCALP_GAP/SCALP_BAND and BLEND, exactly the tie/scalp boundary --
that overstated the scale, swinging normals far enough off-surface to fold the
MToon outline shell over itself. See normal_horizontal_scale()'s docstring for
the derivation and scripts/avatar/evidence/twintail-gap-0904.md for the
weight-debug/no-outline probes that isolated it to the outline pass, not a
missing triangle.
"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import twintail  # noqa: E402


class NormalHorizontalScaleTest(unittest.TestCase):
    def test_matches_old_formula_at_the_two_ends(self):
        # fade=0 (untouched scalp hair) and fade=1 (fully in the tail) are the
        # only two points the old `where(fade>0, 1/r, 1)` ever got right.
        r = np.array([0.15, 0.4, 1.0])
        np.testing.assert_allclose(twintail.normal_horizontal_scale(0.0, r), 1.0)
        np.testing.assert_allclose(twintail.normal_horizontal_scale(1.0, r), r)

    def test_interpolates_through_the_transition_band(self):
        # A vertex barely inside the transition (fade=0.1) with a thin tip
        # (r=0.2) has barely moved: the true scale is close to 1, not close
        # to r. This is exactly the case the old formula got wrong -- it saw
        # fade > 0 and jumped straight to 1/r.
        s = twintail.normal_horizontal_scale(0.1, 0.2)
        self.assertAlmostEqual(s, 1.0 - 0.1 * 0.8)
        self.assertGreater(s, 0.9)

    def test_monotone_between_the_ends(self):
        r = 0.3
        fades = np.linspace(0.0, 1.0, 11)
        s = twintail.normal_horizontal_scale(fades, r)
        self.assertTrue(np.all(np.diff(s) <= 0))
        self.assertAlmostEqual(s[0], 1.0)
        self.assertAlmostEqual(s[-1], r)

    def test_old_binary_formula_would_fail_the_transition_case(self):
        # Pins the mutation: reverting to `where(fade>0, r, 1)` (the pre-fix
        # normal_horizontal_scale) makes this same case wrong by a wide
        # margin, which is the failure this test exists to catch.
        def old(fade, r):
            return np.where(np.asarray(fade) > 0, r, 1.0)

        fixed = twintail.normal_horizontal_scale(0.1, 0.2)
        broken = old(0.1, 0.2)
        self.assertGreater(abs(fixed - broken), 0.5)


if __name__ == '__main__':
    unittest.main()
