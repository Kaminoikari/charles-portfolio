"""pose.skinned() and skinned_normals() resolve each mesh's OWN skin.

Phase 3 of the skeleton plan. Both used to read the first skin for every
mesh. A file whose second skin lists its joints in another order -- or lists
other joints -- then poses every mesh on that skin with the wrong bones. The
fixture has two skins over the same two bones in opposite order, one mesh on
each; rotating bone `b` must move the mesh weighted to `b` on BOTH skins.
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import pose  # noqa: E402


class OwnSkin(unittest.TestCase):
    def doc(self):
        # node 0 root at origin, node 1 bone `a` at x=+1, node 2 bone `b` at
        # x=-1; mesh 0 (node 3) on skin 0 = [a, b], mesh 1 (node 4) on skin 1 = [b, a].
        doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0, 3, 4]}],
               'nodes': [{'name': 'root', 'children': [1, 2]},
                         {'name': 'a', 'translation': [1.0, 0.0, 0.0]},
                         {'name': 'b', 'translation': [-1.0, 0.0, 0.0]},
                         {'name': 'm0', 'mesh': 0, 'skin': 0},
                         {'name': 'm1', 'mesh': 1, 'skin': 1}],
               'bufferViews': [], 'accessors': [], 'meshes': [],
               'skins': [{'joints': [1, 2]}, {'joints': [2, 1]}],
               'extensions': {'VRM': {'humanoid': {'humanBones': [
                   {'bone': 'hips', 'node': 0}, {'bone': 'leftHand', 'node': 1},
                   {'bone': 'rightHand', 'node': 2}]}}}}
        views = []
        for s in doc['skins']:
            ibm = []
            for n in s['joints']:
                m = np.eye(4, dtype=np.float32)
                m[:3, 3] = -np.array(doc['nodes'][n]['translation'], np.float32)
                ibm.append(m.T.reshape(16))
            s['inverseBindMatrices'] = glb.add_accessor(doc, views, np.array(ibm, np.float32))
        # Both meshes: one vertex sitting on bone b (x=-1, y=+1), weighted 100%
        # to whichever SLOT holds b in that mesh's skin.
        for mesh_index, slot_of_b in ((0, 1), (1, 0)):
            att = {'POSITION': glb.add_accessor(doc, views, np.array([[-1.0, 1.0, 0.0]], np.float32), 34962),
                   'NORMAL': glb.add_accessor(doc, views, np.array([[0.0, 1.0, 0.0]], np.float32), 34962),
                   'JOINTS_0': glb.add_accessor(doc, views, np.array([[slot_of_b, 0, 0, 0]], np.uint16), 34962),
                   'WEIGHTS_0': glb.add_accessor(doc, views, np.array([[1.0, 0.0, 0.0, 0.0]], np.float32), 34962)}
            doc['meshes'].append({'name': f'M{mesh_index}', 'primitives': [
                {'attributes': att, 'indices': glb.add_accessor(doc, views, np.array([0, 0, 0], np.uint16), 34963)}]})
        return doc, views

    def test_a_mesh_on_the_second_skin_follows_its_own_joint_order(self):
        doc, views = self.doc()
        turn_b = {2: pose.quat([0, 0, 1], 90)}            # bone b a quarter turn about z
        posed = pose.skinned(doc, views, turn_b)
        # Rotating b by +90 about z about its own origin (-1, 0, 0) takes the
        # vertex from (-1, 1, 0) to (-2, 0, 0). Same answer on both skins.
        np.testing.assert_allclose(posed[('M0', 0)][0], [-2.0, 0.0, 0.0], atol=1e-9)
        np.testing.assert_allclose(posed[('M1', 0)][0], [-2.0, 0.0, 0.0], atol=1e-9)

    def test_normals_on_the_second_skin_turn_with_their_own_bone(self):
        doc, views = self.doc()
        turn_b = {2: pose.quat([0, 0, 1], 90)}
        normals = pose.skinned_normals(doc, views, turn_b)
        np.testing.assert_allclose(normals[('M0', 0)][0], [-1.0, 0.0, 0.0], atol=1e-9)
        np.testing.assert_allclose(normals[('M1', 0)][0], [-1.0, 0.0, 0.0], atol=1e-9)


if __name__ == '__main__':
    unittest.main()
