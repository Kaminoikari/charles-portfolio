"""garment.bind's weight smoothing, on a synthetic crease.

The body here is a dense line of skin whose weights hand over from joint 0 to
joint 1 across two centimetres, the way a VRoid armpit does. The cloth is a
coarser strip above it. Copying the nearest skin vertex lands one cloth edge
on either side of the handover and the whole 0->1 jump on that edge; the
smoothing spreads it over neighbours, across a welded seam too.
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import garment  # noqa: E402


def body():
    x = np.arange(-0.20, 0.20001, 0.005)
    share = np.clip((x + 0.01) / 0.02, 0.0, 1.0)      # joint 1's share, 0 -> 1 over 2cm
    pos = np.stack([x, np.zeros_like(x), np.zeros_like(x)], axis=1)
    joints = np.tile(np.array([0, 1, 0, 0], dtype=np.uint16), (len(x), 1))
    weights = np.stack([1 - share, share, np.zeros_like(x), np.zeros_like(x)], axis=1)
    return {'pos': pos, 'joints': joints, 'weights': weights.astype(np.float32)}


def strip(spacing=0.02, offset=0.01, split_at=None):
    """A two-row strip of cloth 2cm above the body, vertices `spacing` apart.

    With the default offset the columns sit at odd centimetres, one on each
    side of the body's handover. `split_at` duplicates the column at that x so
    the strip is two islands sharing positions along a seam, the way a UV
    split leaves a garment.
    """
    xs = np.arange(-0.20 + offset, 0.20001, spacing)
    cols = [(x, False) for x in xs]
    if split_at is not None:
        cols = [(x, True) for x, _ in cols if x < split_at - 1e-9] + \
               [(split_at, True), (split_at, False)] + \
               [(x, False) for x, _ in cols if x > split_at + 1e-9]
    pos = []
    for x, _ in cols:
        pos += [[x, 0.02, 0.0], [x, 0.02, 0.02]]
    pos = np.array(pos)
    tris = []
    for c in range(len(cols) - 1):
        if split_at is not None and cols[c][0] == split_at and cols[c][1] and not cols[c + 1][1]:
            continue                       # the seam: two copies, no triangle between them
        a, b, d, e = 2 * c, 2 * c + 1, 2 * c + 2, 2 * c + 3
        tris += [[a, b, d], [b, e, d]]
    return {'pos': pos, 'tris': np.array(tris), 'uv': np.zeros((len(pos), 2)),
            'nrm': np.zeros((len(pos), 3)),
            'joints': np.zeros((len(pos), 4), dtype=np.uint16),
            'weights': np.zeros((len(pos), 4), dtype=np.float32)}


def share_of_joint1(piece):
    w = np.zeros(len(piece['pos']))
    for c in range(4):
        w += np.where(piece['joints'][:, c] == 1, piece['weights'][:, c], 0.0)
    return w


def worst_edge_jump(piece):
    s = share_of_joint1(piece)
    e = np.concatenate([piece['tris'][:, [0, 1]], piece['tris'][:, [1, 2]], piece['tris'][:, [2, 0]]])
    return float(np.abs(s[e[:, 0]] - s[e[:, 1]]).max())


class Smoothing(unittest.TestCase):
    def test_nearest_copy_puts_the_whole_handover_on_one_cloth_edge(self):
        piece = garment.bind(body(), strip())
        self.assertGreater(worst_edge_jump(piece), 0.9)

    def test_smoothing_spreads_the_handover_over_neighbours(self):
        piece = garment.bind(body(), strip(), smooth=16)
        self.assertLess(worst_edge_jump(piece), 0.35)
        # and it stays a partition of unity on four slots
        self.assertEqual(piece['weights'].shape[1], 4)
        np.testing.assert_allclose(piece['weights'].sum(axis=1), 1.0, atol=1e-6)

    def test_smoothing_crosses_a_welded_seam(self):
        # Islands split exactly on the handover, so the seam column copies
        # 0.5 on both sides. Walking triangle edges alone, each copy is pulled
        # toward its own island (0 on the left, 1 on the right) and the seam
        # opens into a crack; welded, the copies stay one vertex.
        piece = garment.bind(body(), strip(offset=0.0, split_at=0.0), smooth=16)
        s = share_of_joint1(piece)
        copies = np.flatnonzero(np.isclose(piece['pos'][:, 0], 0.0))
        self.assertEqual(len(copies), 4)
        for z in (0.0, 0.02):                 # two positions on the seam, two copies each
            same = copies[np.isclose(piece['pos'][copies, 2], z)]
            self.assertEqual(len(same), 2)
            self.assertLess(float(np.ptp(s[same])), 1e-6)
        self.assertLess(worst_edge_jump(piece), 0.35)

    def test_smooth_zero_is_the_plain_copy(self):
        plain = garment.bind(body(), strip())
        same = garment.bind(body(), strip(), smooth=0)
        np.testing.assert_array_equal(plain['joints'], same['joints'])
        np.testing.assert_array_equal(plain['weights'], same['weights'])

    def test_smoothing_leaves_a_piece_on_one_joint_alone(self):
        # Cloth entirely over joint 0's skin: nothing to blend with.
        piece = strip()
        piece['pos'][:, 0] -= 0.30
        one = body()
        one['pos'][:, 0] -= 0.30
        one['weights'][:] = np.array([1, 0, 0, 0], dtype=np.float32)
        bound = garment.bind(one, piece, smooth=16)
        np.testing.assert_allclose(share_of_joint1(bound), 0.0)
        np.testing.assert_allclose(bound['weights'][:, 0], 1.0)


if __name__ == '__main__':
    unittest.main()
