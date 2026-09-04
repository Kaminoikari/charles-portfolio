"""proportion.apply scales the head; the head's morph targets must scale with it.

2026-09-04: the owner saw the Milfy body's excited face (the `Extra` >< eyes)
render as two black tips instead of the pink body's full ><. The face was 6%
larger than the base's and every expression delta was still the base's: the
plane the >< is drawn on is pushed forward by an absolute 30.8mm, which cleared
the base skin by a millimetre and fell a millimetre short of the larger one.

The file-level test reads the shipped body against the build's input
(public/avatar/mika-pink.vrm, byte-identical to baseline.vrm) and demands that
every Face.baked morph delta on a head vertex is exactly HEAD_FACTOR times the
input's. PROPORTION_TEST_MODEL points it at another build: the previous
shipped file (-3, deltas unscaled) is its red baseline.
"""
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glb  # noqa: E402
import proportion  # noqa: E402
from make import HEAD_FACTOR  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get('PROPORTION_TEST_MODEL') or os.path.join(
    BASE, '..', '..', 'public', 'avatar', 'mika-milfy-6.vrm')
SOURCE_MODEL = os.path.join(BASE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')


def _face_targets(path):
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    mesh = next(m for m in doc['meshes'] if m['name'].startswith('Face'))
    pr = mesh['primitives'][0]
    pos = glb.read_accessor(doc, views, pr['attributes']['POSITION']).astype(np.float64)
    deltas = [glb.read_accessor(doc, views, t['POSITION']).astype(np.float64)
              for t in pr['targets']]
    return pos, deltas


class RescaleTest(unittest.TestCase):
    def test_rescale_grows_the_head_about_the_chin_and_leaves_the_body(self):
        pos = np.array([[0.1, 1.5, -0.1], [0.1, 1.0, -0.1]])
        out = proportion.rescale(pos, 2.0, chin=1.272)
        np.testing.assert_allclose(out[0], [0.2, 1.272 + 0.228 * 2, -0.2])
        np.testing.assert_allclose(out[1], pos[1])

    def test_rescale_deltas_scales_head_rows_only_on_all_three_axes(self):
        # The shipped face sits entirely above the chin, so this synthetic
        # pair is the only place the body row of the mask is ever exercised.
        pos = np.array([[0.1, 1.5, -0.1], [0.1, 1.0, -0.1]])
        delta = np.array([[0.01, -0.02, 0.03], [0.01, -0.02, 0.03]])
        out = proportion.rescale_deltas(delta, pos, 2.0, chin=1.272)
        np.testing.assert_allclose(out[0], [0.02, -0.04, 0.06])
        np.testing.assert_allclose(out[1], delta[1])
        np.testing.assert_allclose(delta[0], [0.01, -0.02, 0.03], err_msg='input mutated')


class ShippedFaceTest(unittest.TestCase):
    """The shipped body's expressions against the input's, delta by delta."""

    @classmethod
    def setUpClass(cls):
        cls.pos_src, cls.deltas_src = _face_targets(SOURCE_MODEL)
        cls.pos_out, cls.deltas_out = _face_targets(MODEL)

    def test_face_is_the_input_face_scaled_by_head_factor(self):
        head = self.pos_src[:, 1] >= proportion.CHIN_Y
        self.assertTrue(head.all(), 'the whole face sits above the chin')
        expect = proportion.rescale(self.pos_src, HEAD_FACTOR)
        # Later steps repaint the face and move nothing on it.
        np.testing.assert_allclose(self.pos_out, expect, atol=1e-4)

    def test_every_face_morph_delta_scales_with_the_head(self):
        """Vector for vector, not length for length: a permuted or negated
        axis has the input's length and would still be wrong."""
        self.assertEqual(len(self.deltas_src), len(self.deltas_out))
        worst = 0.0
        for ti, (a, b) in enumerate(zip(self.deltas_src, self.deltas_out)):
            if not (np.linalg.norm(a, axis=1) > 1e-6).any():
                continue
            worst = max(worst, float(np.abs(b - a * HEAD_FACTOR).max()) * 1000)
        self.assertLess(worst, 0.01,
                        f'a face morph delta is not HEAD_FACTOR x the input (off by {worst:.4f}mm)')

    def test_extra_pushes_the_eye_plane_as_far_proud_of_the_skin_as_the_input_does(self):
        """The one expression the bug showed on, measured the way it fails.

        `Extra` binds targets 25 (eyes close) and 55 (the EyeExtra plane comes
        forward). Along the front view, the plane's clearance over the skin
        must be the input's clearance scaled, within half a millimetre, or the
        >< sinks into the face again.
        """
        def clearance(pos, deltas, doc_path):
            doc, binary = glb.load(doc_path)
            views = glb.views_of(doc, binary)
            mesh = next(m for m in doc['meshes'] if m['name'].startswith('Face'))
            # Every primitive of Face.baked indexes the same position buffer,
            # and the skin is two primitives (face and the back of the head).
            def tris(material):
                return np.concatenate([
                    glb.read_accessor(doc, views, pr['indices']).reshape(-1, 3).astype(int)
                    for pr in mesh['primitives']
                    if doc['materials'][pr['material']]['name'] == material])
            full = pos + deltas[25] + deltas[55]
            ex = np.unique(tris('F00_000_00_EyeExtra_01_EYE'))
            skin_tris = tris('F00_000_00_Face_00_SKIN')
            a, b, c = full[skin_tris[:, 0]], full[skin_tris[:, 1]], full[skin_tris[:, 2]]
            front = np.cross(b - a, c - a)[:, 2] < 0          # facing a camera in front (VRM0 faces -z)
            a, b, c = a[front], b[front], c[front]
            out = []
            for p in full[ex]:
                v0, v1, v2 = c[:, :2] - a[:, :2], b[:, :2] - a[:, :2], p[:2] - a[:, :2]
                d00, d01, d11 = (v0 * v0).sum(1), (v0 * v1).sum(1), (v1 * v1).sum(1)
                d20, d21 = (v2 * v0).sum(1), (v2 * v1).sum(1)
                den = d00 * d11 - d01 * d01
                ok = np.abs(den) > 1e-14
                u = np.where(ok, (d11 * d20 - d01 * d21) / np.where(ok, den, 1), -1)
                v = np.where(ok, (d00 * d21 - d01 * d20) / np.where(ok, den, 1), -1)
                hit = ok & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9)
                if hit.any():
                    z = a[hit][:, 2] + u[hit] * (c[hit][:, 2] - a[hit][:, 2]) + v[hit] * (b[hit][:, 2] - a[hit][:, 2])
                    out.append(z.min() - p[2])                 # + = plane in front of the skin
            assert len(out) == len(ex), f'{len(ex) - len(out)} EyeExtra vertices are not under the skin at all'
            return np.median(out) * 1000
        src = clearance(self.pos_src, self.deltas_src, SOURCE_MODEL)
        out = clearance(self.pos_out, self.deltas_out, MODEL)
        self.assertAlmostEqual(out, src * HEAD_FACTOR, delta=0.5,
                               msg=f'>< clearance {out:+.2f}mm, input {src:+.2f}mm x {HEAD_FACTOR}')


if __name__ == '__main__':
    unittest.main()
