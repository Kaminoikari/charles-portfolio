"""Regression checks for browser-visible spring bone instability."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402


BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(BASE, '..', '..', 'public', 'avatar', 'mika-milfy.vrm')
class SpringTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc, _ = glb.load(MODEL)
        cls.secondary = cls.doc['extensions']['VRM']['secondaryAnimation']

    def test_twintail_springs_do_not_project_against_head_colliders(self):
        group = next(
            group for group in self.secondary['boneGroups']
            if any(self.doc['nodes'][node].get('name', '').startswith('HairTail')
                   for node in group.get('bones', ()))
        )
        self.assertEqual([], group['colliderGroups'])

    def test_short_hair_does_not_use_unstable_legacy_springs(self):
        legacy_roots = [
            self.doc['nodes'][root].get('name', '')
            for group in self.secondary['boneGroups']
            for root in group.get('bones', ())
            if self.doc['nodes'][root].get('name', '').startswith('HairJoint-')
        ]
        self.assertEqual([], legacy_roots)


if __name__ == '__main__':
    unittest.main()
