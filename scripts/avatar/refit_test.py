"""refit.rehome on a synthetic void, and its skeleton reads on the shipped file.

The body here is a line of skin whose weights hand over from the torso joint 0
to the limb joint 1, the way a VRoid armpit does. Two strips of cloth lie over
it: one close enough to be wearing the body, one flared away from it into the
space beside the arm, where a nearest-vertex copy has no body to copy and takes
the limb's weights anyway. The close strip must come through untouched and the
flared one must lose the handover.
"""
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import garment  # noqa: E402
import glb  # noqa: E402
import humanoid  # noqa: E402
import refit  # noqa: E402
import verify  # noqa: E402

SHIPPED = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-12.vrm')


def body():
    """A line of skin along x, handing over from joint 0 to joint 1 over 2cm."""
    x = np.arange(-0.20, 0.20001, 0.005)
    share = np.clip((x + 0.01) / 0.02, 0.0, 1.0)
    pos = np.stack([x, np.zeros_like(x), np.zeros_like(x)], axis=1)
    joints = np.tile(np.array([0, 1, 0, 0], dtype=np.uint16), (len(x), 1))
    weights = np.stack([1 - share, share, np.zeros_like(x), np.zeros_like(x)], axis=1)
    return {'pos': pos, 'joints': joints, 'weights': weights.astype(np.float32)}


def strip(height, spacing=0.02):
    """A two-row strip of cloth `height` above the body line."""
    xs = np.arange(-0.19, 0.20001, spacing)
    pos = []
    for x in xs:
        pos += [[x, height, 0.0], [x, height, 0.02]]
    pos = np.array(pos)
    tris = []
    for c in range(len(xs) - 1):
        a, b, d, e = 2 * c, 2 * c + 1, 2 * c + 2, 2 * c + 3
        tris += [[a, b, d], [b, e, d]]
    return {'pos': pos, 'tris': np.array(tris),
            'joints': np.zeros((len(pos), 4), dtype=np.uint16),
            'weights': np.zeros((len(pos), 4), dtype=np.float32)}


def share_of(piece, joint):
    w = np.zeros(len(piece['pos']))
    for c in range(piece['joints'].shape[1]):
        w += np.where(piece['joints'][:, c] == joint, piece['weights'][:, c], 0.0)
    return w


def worst_edge_jump(piece, joint=1):
    s = share_of(piece, joint)
    e = np.concatenate([piece['tris'][:, [0, 1]], piece['tris'][:, [1, 2]],
                        piece['tris'][:, [2, 0]]])
    return float(np.abs(s[e[:, 0]] - s[e[:, 1]]).max())


def bound(height):
    """A strip at `height`, given the nearest body vertex's weights."""
    pool = body()
    piece = garment.bind(pool, strip(height))
    distance = refit.body_distance(piece['pos'], pool['pos'])
    return pool, piece, distance


class Rehome(unittest.TestCase):
    """The copy is right on cloth that lies on the body and wrong on cloth that
    has left it, so the same operation has to do nothing to the first."""

    def test_the_nearest_copy_puts_the_whole_handover_on_one_edge(self):
        _, piece, _ = bound(0.02)
        self.assertGreater(worst_edge_jump(piece), 0.9)

    def test_flared_cloth_shed_its_limb_share_onto_the_host(self):
        _, piece, distance = bound(0.12)
        refit.rehome(piece, distance, [((1,), 0)])
        # Nothing of the limb is left to hand over out there.
        self.assertLess(float(share_of(piece, 1).max()), 0.05)
        self.assertLess(worst_edge_jump(piece), 0.05)
        np.testing.assert_allclose(piece['weights'].sum(axis=1), 1.0, atol=1e-6)

    def test_cloth_worn_on_the_body_keeps_the_copied_limb_share(self):
        # Per vertex the weights still move, because rehome diffuses; what may
        # not move is how much of the limb the cloth holds in total, which is
        # the thing shedding destroys.
        _, piece, distance = bound(0.02)
        before = float(share_of(piece, 1).sum())
        self.assertEqual(float(refit.shed_field(piece, distance).max()), 0.0)
        refit.rehome(piece, distance, [((1,), 0)])
        self.assertGreater(float(share_of(piece, 1).sum()), 0.99 * before)

    def test_the_ramp_is_read_off_distance_not_height(self):
        # Same cloth, moved along the body and not off it: distance
        # never grows, so nothing shed.
        pool = body()
        piece = garment.bind(pool, strip(0.02))
        piece['pos'][:, 0] += 0.05
        distance = refit.body_distance(piece['pos'], pool['pos'])
        before = float(share_of(piece, 1).sum())
        refit.rehome(piece, distance, [((1,), 0)])
        self.assertGreater(float(share_of(piece, 1).sum()), 0.99 * before)

    def test_shed_field_is_smoothed_across_its_own_edges(self):
        # A raw ramp steps from 0 to 1 between two neighbouring columns; the
        # diffusion has to spread that step, or rehome writes the cliff it was
        # supposed to remove into the weights.
        piece = strip(0.02)
        distance = np.where(piece['pos'][:, 0] < 0.0, 0.0, 1.0)
        raw = refit.shed_field(piece, distance, 0.4, 0.6, passes=0)
        spread = refit.shed_field(piece, distance, 0.4, 0.6, passes=refit.SHED_PASSES)
        e = np.concatenate([piece['tris'][:, [0, 1]], piece['tris'][:, [1, 2]],
                            piece['tris'][:, [2, 0]]])
        step = lambda f: float(np.abs(f[e[:, 0]] - f[e[:, 1]]).max())
        self.assertGreater(step(raw), 0.9)
        self.assertLess(step(spread), 0.35)


class Guards(unittest.TestCase):
    """The four ways rehome and apply can go wrong quietly."""

    def test_a_slot_the_chain_lists_twice_is_shed_once(self):
        # A skin may list one node in two slots. Fancy indexing subtracts the
        # repeated column once while moved.sum adds it twice, so without the
        # dedupe the host is handed more than the chain ever held.
        #
        # Held half way up the ramp on purpose: at a shed of 0 or 1 the double
        # count divides out again in the renormalise and the bug is invisible.
        _, once, _ = bound(0.02)
        _, twice, _ = bound(0.02)
        half = np.full(len(once['pos']), 0.5 * (refit.SHED_NEAR_M + refit.SHED_FAR_M))
        refit.rehome(once, half, [((1,), 0)])
        refit.rehome(twice, half, [((1, 1), 0)])
        np.testing.assert_allclose(twice['weights'], once['weights'], atol=1e-6)
        np.testing.assert_allclose(twice['weights'].sum(axis=1), 1.0, atol=1e-6)

    def test_the_written_attributes_stay_four_wide(self):
        # Two joints in the skin and no weight pass to widen them afterwards:
        # a VEC2 JOINTS_0 is not a thing glTF will load.
        _, piece, distance = bound(0.12)
        refit.rehome(piece, distance, [((1,), 0)], weight_passes=0)
        self.assertEqual(piece['joints'].shape[1], 4)
        self.assertEqual(piece['weights'].shape[1], 4)

    def test_a_ramp_with_no_width_is_refused(self):
        _, piece, distance = bound(0.12)
        with self.assertRaises(SystemExit):
            refit.shed_field(piece, distance, near=0.05, far=0.05)

    def test_cloth_whose_skin_holds_no_chain_joint_is_refused(self):
        # Silently writing the file back unchanged reads as success, and a rig
        # with no shoulders passes every existing gate.
        if not os.path.exists(SHIPPED):
            self.skipTest('shipped model not on disk')
        room = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, room, ignore_errors=True)
        with self.assertRaises(SystemExit):
            refit.apply(SHIPPED, os.path.join(room, 'out.vrm'),
                        cloth=(('Body.baked', 22),), body=(('Body.baked', 0),),
                        chains=('jaw',))          # this rig has no jaw bone


class Skeleton(unittest.TestCase):
    """The chain and its host come off the humanoid map and the node tree, not
    off bone names: the two files this runs on spell the host differently
    (upperChest here, chest on a VRoid dress-up export)."""

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(SHIPPED):
            raise unittest.SkipTest('shipped model not on disk')
        cls.doc, cls.binary = glb.load(SHIPPED)

    def test_the_chain_is_every_node_under_the_root(self):
        bones = humanoid.bones(self.doc)
        under = refit.descendants(self.doc, bones['leftShoulder'])
        self.assertIn(bones['leftUpperArm'], under)
        self.assertIn(bones['leftHand'], under)
        self.assertNotIn(bones['rightUpperArm'], under)
        self.assertNotIn(bones['head'], under)

    def test_the_host_is_the_nearest_listed_ancestor(self):
        # Against the humanoid map. Reading the node's name is the thing this
        # test exists to rule out.
        bones = humanoid.bones(self.doc)
        skin = self.doc['skins'][humanoid.skin_of_mesh(self.doc, 'Body.baked')]
        host = refit.host_of(self.doc, bones['leftShoulder'], skin['joints'])
        self.assertEqual(host, bones['upperChest'])

    def test_a_host_outside_the_skin_is_refused(self):
        bones = humanoid.bones(self.doc)
        with self.assertRaises(SystemExit):
            refit.host_of(self.doc, bones['leftShoulder'], [bones['leftShoulder']])


class ShippedFile(unittest.TestCase):
    """Our own build binds its cloth to smooth skin and already passes the
    tear gate; running this over it must not be what breaks it."""

    def test_the_shipped_model_still_passes_the_tear_gate(self):
        if not os.path.exists(SHIPPED):
            self.skipTest('shipped model not on disk')
        room = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, room, ignore_errors=True)
        out = os.path.join(room, 'refit.vrm')
        # The cardigan is Body.baked primitive 22, the skin under it 0-3.
        refit.apply(SHIPPED, out, cloth=(('Body.baked', 22),),
                    body=(('Body.baked', 0), ('Body.baked', 1),
                          ('Body.baked', 2), ('Body.baked', 3)))
        self.assertEqual(verify.torn_bindings(out), [])


class CommandLine(unittest.TestCase):
    """The CLI's only job is turning 'mesh:prim' into the pairs apply takes,
    and the failure it has to name is a mesh given without one."""

    def test_a_pair_splits_on_the_last_colon(self):
        self.assertEqual(refit._pairs('Body.baked:22'), (('Body.baked', 22),))
        self.assertEqual(refit._pairs('a:1,Body (merged).baked:0'),
                         (('a', 1), ('Body (merged).baked', 0)))

    def test_a_mesh_without_a_primitive_is_refused(self):
        for bad in ('Tops.baked', 'Tops.baked:', ':0', 'Tops.baked:x'):
            with self.assertRaises(SystemExit):
                refit._pairs(bad)


if __name__ == '__main__':
    unittest.main()
