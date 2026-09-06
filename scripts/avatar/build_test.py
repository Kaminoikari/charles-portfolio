"""build.landmarks reads the joint heights off the skeleton, and build() cuts
the outfit at those heights. Until 2026-09-05 the heights were typed in
(`hip, knee, ankle = 0.843, 0.501, 0.118`, `arm_r = 0.54`), read once off the
one VRoid body: a second body would have had its socks cut at this one's
ankle. The doc here is synthetic, so a body of any size can be posed."""
import copy
import os
import re
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402


def body():
    """A hips-rooted rig with the six bones landmarks() reads, VRM 0.x
    spelling, plus a torso pool whose narrowest ring sits at y = 1.0."""
    nodes = [
        {'name': 'Hips', 'translation': [0.0, 0.8, 0.0], 'children': [1, 2, 4, 6]},
        {'name': 'UpperLeg', 'translation': [0.08, 0.0, 0.0], 'children': [3]},
        {'name': 'UpperArm', 'translation': [0.15, 0.4, 0.0], 'children': [5]},
        {'name': 'LowerLeg', 'translation': [0.0, -0.35, 0.0], 'children': [7]},
        {'name': 'Neck', 'translation': [0.0, 0.5, 0.0]},
        {'name': 'Hand', 'translation': [0.4, 0.0, 0.0]},
        {'name': 'Spine', 'translation': [0.0, 0.2, 0.0]},
        {'name': 'Foot', 'translation': [0.0, -0.4, 0.0]},
    ]
    bones = {'hips': 0, 'leftUpperLeg': 1, 'leftUpperArm': 2, 'leftLowerLeg': 3,
             'neck': 4, 'leftHand': 5, 'spine': 6, 'leftFoot': 7}
    doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
           'nodes': nodes,
           'extensions': {'VRM': {'humanoid': {
               'humanBones': [{'bone': b, 'node': n} for b, n in bones.items()]}}}}
    rings = []
    for y in np.arange(0.86, 1.18, 0.01):
        r = 0.12 + 0.5 * abs(y - 1.0)
        for a in np.linspace(0.0, 2 * np.pi, 16, endpoint=False):
            rings.append([r * np.cos(a), y, r * np.sin(a)])
    return doc, {'pos': np.array(rings)}


class Landmarks(unittest.TestCase):
    EXPECTED = {'hip': 0.8, 'knee': 0.45, 'ankle': 0.05, 'shoulder': 1.2,
                'neck': 1.3, 'hand_x': 0.55}

    def test_joint_heights_come_from_the_skeleton(self):
        doc, pool = body()
        lm = build.landmarks(pool, doc)
        for key, value in self.EXPECTED.items():
            self.assertAlmostEqual(lm[key], value, places=9, msg=key)
        self.assertAlmostEqual(lm['waist'], 1.0, delta=0.011)

    def test_a_taller_body_moves_every_joint_landmark_and_not_the_waist(self):
        doc, pool = body()
        taller = copy.deepcopy(doc)
        taller['nodes'][0]['translation'][1] += 0.1
        a, b = build.landmarks(pool, doc), build.landmarks(pool, taller)
        for key in ('hip', 'knee', 'ankle', 'shoulder', 'neck'):
            self.assertAlmostEqual(b[key] - a[key], 0.1, places=9, msg=key)
        self.assertEqual(b['hand_x'], a['hand_x'])
        self.assertEqual(b['waist'], a['waist'])


class Wiring(unittest.TestCase):
    """landmarks() being right proves nothing if build() still types the
    numbers in beside it (memory: feedback_injection_bypasses_wiring)."""

    def test_build_cuts_the_outfit_at_the_derived_landmarks(self):
        with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertRegex(src, r"hip, knee, ankle = lm\['hip'\], lm\['knee'\], lm\['ankle'\]")
        self.assertRegex(src, r"arm_r = lm\['hand_x'\]")
        self.assertRegex(src, r"shoulder_top = lm\['shoulder'\]")
        self.assertRegex(src, r"neck_y = lm\['neck'\] - 0\.007")
        for typed in (r"hip, knee, ankle = 0\.", r"shoulder_top = 1\.", r"\n    neck_y = 1\."):
            self.assertNotRegex(src, typed, 'build() types a landmark height in again')


if __name__ == '__main__':
    unittest.main(verbosity=2)
