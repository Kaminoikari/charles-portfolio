"""scalebody writes the same body at another size.

The pipeline had never been given a body of a different size: the real second
body (Seed-san) came out 0.1% taller than ours, so every absolute length in the
code read the same on both. What has to hold here is that the transform really
is a similarity -- lengths scale, angles and weights do not -- because a fixture
that quietly changed the body's shape would turn every finding it produces into
noise.
"""
import copy
import os
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import glb  # noqa: E402
import scalebody  # noqa: E402

PUBLIC = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'public', 'avatar')


def tiny(path):
    """A minimal VRM 0.x: two joints, one skinned quad, one morph target, one
    spring chain with a collider. Enough for every quantity scalebody touches."""
    doc = {
        'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [
            {'name': 'Hips', 'translation': [0.0, 0.8, 0.0], 'children': [1, 2]},
            {'name': 'Head', 'translation': [0.0, 0.5, 0.1],
             'rotation': [0.0, 0.3826834, 0.0, 0.9238795]},
            {'name': 'Mesh', 'translation': [0.0, 0.0, 0.0], 'mesh': 0, 'skin': 0},
        ],
        'meshes': [], 'accessors': [], 'bufferViews': [], 'skins': [],
    }
    views = []
    pos = np.array([[0.1, 1.0, 0.0], [-0.1, 1.0, 0.0], [0.0, 1.4, 0.05]], dtype='<f4')
    delta = np.array([[0.0, 0.02, 0.0]] * 3, dtype='<f4')
    joints = np.array([[0, 1, 0, 0]] * 3, dtype='<u2')
    weights = np.array([[0.75, 0.25, 0.0, 0.0]] * 3, dtype='<f4')
    ibm = np.zeros((2, 16), dtype='<f4')
    for j, ty in enumerate((0.8, 1.3)):
        m = np.eye(4, dtype='<f4')
        m[3, 1] = -ty                       # column-major: inverse of a translation
        ibm[j] = m.reshape(-1)
    doc['meshes'] = [{'name': 'Body', 'primitives': [{
        'attributes': {
            'POSITION': glb.add_accessor(doc, views, pos, minmax=True),
            'JOINTS_0': glb.add_accessor(doc, views, joints),
            'WEIGHTS_0': glb.add_accessor(doc, views, weights),
        },
        'targets': [{'POSITION': glb.add_accessor(doc, views, delta)}],
    }]}]
    doc['skins'] = [{'joints': [0, 1],
                     'inverseBindMatrices': glb.add_accessor(doc, views, ibm)}]
    doc['extensions'] = {'VRM': {
        'humanoid': {'humanBones': [{'bone': 'hips', 'node': 0},
                                    {'bone': 'head', 'node': 1}]},
        'firstPerson': {'firstPersonBoneOffset': {'x': 0.0, 'y': 0.06, 'z': 0.0}},
        'secondaryAnimation': {
            'boneGroups': [{'bones': [1], 'hitRadius': 0.02, 'stiffiness': 1.5,
                            'dragForce': 0.4, 'gravityPower': 0.2}],
            'colliderGroups': [{'node': 0, 'colliders': [
                {'offset': {'x': 0.0, 'y': 0.1, 'z': 0.0}, 'radius': 0.08}]}],
        },
    }}
    glb.save(path, doc, glb.rebuild(doc, views))
    return doc


def read(path):
    doc, binary = glb.load(path)
    return doc, glb.views_of(doc, binary)


class Similarity(unittest.TestCase):
    K = 1.25

    def setUp(self):
        self.work = tempfile.mkdtemp()
        self.src = os.path.join(self.work, 'src.vrm')
        self.dst = os.path.join(self.work, 'dst.vrm')
        tiny(self.src)
        scalebody.apply(self.src, self.dst, self.K)
        self.a, self.av = read(self.src)
        self.b, self.bv = read(self.dst)

    def test_every_length_scales(self):
        for i, node in enumerate(self.a['nodes']):
            if 'translation' in node:
                got = self.b['nodes'][i]['translation']
                for axis in range(3):
                    self.assertAlmostEqual(got[axis], node['translation'][axis] * self.K,
                                           places=9, msg=f'node {i} axis {axis}')
        acc = self.a['meshes'][0]['primitives'][0]['attributes']['POSITION']
        np.testing.assert_allclose(glb.read_accessor(self.b, self.bv, acc),
                                   glb.read_accessor(self.a, self.av, acc) * self.K,
                                   rtol=0, atol=1e-6)
        # A morph delta is a difference of two positions in one frame, so it
        # scales exactly as a position does. Missing this is what swallowed the
        # >< eyes when proportion scaled a head without its deltas.
        tgt = self.a['meshes'][0]['primitives'][0]['targets'][0]['POSITION']
        np.testing.assert_allclose(glb.read_accessor(self.b, self.bv, tgt),
                                   glb.read_accessor(self.a, self.av, tgt) * self.K,
                                   rtol=0, atol=1e-6)
        spring = self.b['extensions']['VRM']['secondaryAnimation']
        self.assertAlmostEqual(spring['boneGroups'][0]['hitRadius'], 0.02 * self.K, places=9)
        collider = spring['colliderGroups'][0]['colliders'][0]
        self.assertAlmostEqual(collider['radius'], 0.08 * self.K, places=9)
        self.assertAlmostEqual(collider['offset']['y'], 0.1 * self.K, places=9)
        self.assertAlmostEqual(
            self.b['extensions']['VRM']['firstPerson']['firstPersonBoneOffset']['y'],
            0.06 * self.K, places=9)

    def test_the_inverse_bind_matrices_keep_their_rotation_and_scale_their_offset(self):
        # An IBM is the inverse of a joint's bind world matrix. Scaling every
        # joint's translation by k scales the inverse's translation column by k
        # and leaves its rotation alone -- so skinning still resolves to the
        # scaled rest position rather than tearing the mesh off the skeleton.
        # Reached by iterating rather than by indexing skins[0]: that spelling
        # is what humanoid_test.Wiring forbids across this directory, and a test
        # is not an exception to it (Phase 0, memory: the per-mesh skin rule).
        acc, = [s['inverseBindMatrices'] for s in self.a['skins']]
        before = glb.read_accessor(self.a, self.av, acc)
        after = glb.read_accessor(self.b, self.bv, acc)
        np.testing.assert_allclose(after[:, 12:15], before[:, 12:15] * self.K,
                                   rtol=0, atol=1e-6)
        rest = [c for c in range(16) if c not in (12, 13, 14)]
        np.testing.assert_allclose(after[:, rest], before[:, rest], rtol=0, atol=0)

    def test_what_is_not_a_length_is_left_alone(self):
        # Rotations, skin weights and the dimensionless spring settings. If any
        # of these moved, the "same body at another size" claim would be false
        # and every measurement taken on the fixture would be measuring two
        # changes at once.
        self.assertEqual(self.b['nodes'][1]['rotation'], self.a['nodes'][1]['rotation'])
        for name in ('WEIGHTS_0', 'JOINTS_0'):
            acc = self.a['meshes'][0]['primitives'][0]['attributes'][name]
            np.testing.assert_array_equal(glb.read_accessor(self.b, self.bv, acc),
                                          glb.read_accessor(self.a, self.av, acc))
        group = self.b['extensions']['VRM']['secondaryAnimation']['boneGroups'][0]
        self.assertEqual(group['stiffiness'], 1.5)
        self.assertEqual(group['dragForce'], 0.4)
        # gravityPower is NOT dimensionless, and is left alone anyway: how to
        # scale it depends on how three-vrm integrates it. The fixture is honest
        # for geometry and landmarks and not for how the hair hangs, and that is
        # written into scalebody's docstring. Pinned here so a later change to
        # it has to be deliberate.
        self.assertEqual(group['gravityPower'], 0.2)

    def test_scaling_back_returns_the_body_it_started_from(self):
        back = os.path.join(self.work, 'back.vrm')
        scalebody.apply(self.dst, back, 1.0 / self.K)
        c, cv = read(back)
        acc = self.a['meshes'][0]['primitives'][0]['attributes']['POSITION']
        np.testing.assert_allclose(glb.read_accessor(c, cv, acc),
                                   glb.read_accessor(self.a, self.av, acc),
                                   rtol=0, atol=1e-6)
        for i, node in enumerate(self.a['nodes']):
            if 'translation' in node:
                np.testing.assert_allclose(c['nodes'][i]['translation'],
                                           node['translation'], rtol=0, atol=1e-6)

    def test_the_declared_minmax_follows_the_data(self):
        # A stale min/max is the kind of thing a viewer believes and a reader
        # never checks; three.js culls against it.
        acc = self.a['meshes'][0]['primitives'][0]['attributes']['POSITION']
        data = glb.read_accessor(self.b, self.bv, acc)
        np.testing.assert_allclose(self.b['accessors'][acc]['min'],
                                   data.min(axis=0), rtol=0, atol=1e-6)
        np.testing.assert_allclose(self.b['accessors'][acc]['max'],
                                   data.max(axis=0), rtol=0, atol=1e-6)


class Refusals(unittest.TestCase):
    def test_a_vrm_1_body_is_refused_with_the_door_it_should_have_come_through(self):
        # Every writer in this pipeline writes the 0.x block, and make.py
        # converts at the door (vrm1to0.ensure_vrm0). Silently scaling a 1.0
        # file would leave its VRMC_springBone lengths in the old units.
        work = tempfile.mkdtemp()
        src = os.path.join(work, 'v1.vrm')
        doc = tiny(src)
        one = copy.deepcopy(doc)
        one['extensions'] = {'VRMC_vrm': {
            'specVersion': '1.0',
            'humanoid': {'humanBones': {'hips': {'node': 0}, 'head': {'node': 1}}}}}
        _, binary = glb.load(src)
        glb.save(src, one, binary)
        with self.assertRaises(SystemExit) as caught:
            scalebody.apply(src, os.path.join(work, 'out.vrm'), 1.25)
        self.assertIn('vrm1to0.ensure_vrm0', str(caught.exception))


class OnTheRealBody(unittest.TestCase):
    MODEL = os.path.join(PUBLIC, 'mika-pink.vrm')

    @unittest.skipUnless(os.path.exists(MODEL), 'the base body is not checked out')
    def test_the_shipped_body_comes_out_exactly_k_times_as_tall(self):
        # The synthetic body above proves the arithmetic; this proves it on the
        # file the fixture is actually made from, whose height is what the
        # plan's ">= 10% apart" requirement is about.
        work = tempfile.mkdtemp()
        lo, hi = scalebody.height(self.MODEL)
        for k in (0.8, 1.25):
            dst = os.path.join(work, f's{k}.vrm')
            scalebody.apply(self.MODEL, dst, k)
            slo, shi = scalebody.height(dst)
            self.assertAlmostEqual((shi - slo) / (hi - lo), k, places=6, msg=f'x{k}')
        # And the requirement it exists to satisfy: the real second body is 0.1%
        # away, these are 20% and 25%.
        self.assertGreater(abs(1.25 - 1.0), 0.10)


if __name__ == '__main__':
    unittest.main()
