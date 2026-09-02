"""Regression checks for browser-visible spring bone instability."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import twintail  # noqa: E402


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

    def test_every_collider_group_is_referenced_by_a_spring(self):
        used = {
            index
            for group in self.secondary['boneGroups']
            for index in group.get('colliderGroups', [])
        }
        stranded = [
            (index, self.doc['nodes'][group.get('node')].get('name', ''))
            for index, group in enumerate(self.secondary['colliderGroups'])
            if index not in used
        ]
        self.assertEqual([], stranded)

    def test_skirt_spring_still_collides_with_the_legs(self):
        skirt = next(
            group for group in self.secondary['boneGroups']
            if any(self.doc['nodes'][node].get('name', '').startswith('J_Sec_L_Skirt')
                   for node in group.get('bones', ()))
        )
        nodes = sorted(
            self.doc['nodes'][self.secondary['colliderGroups'][index]['node']]['name']
            for index in skirt['colliderGroups']
        )
        self.assertEqual(['J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg'], nodes)


class PruneTest(unittest.TestCase):
    """twintail.prune_stranded_collider_groups on a synthetic document."""

    def make_doc(self):
        return {
            'nodes': [{'name': f'N{i}'} for i in range(4)],
            'extensions': {'VRM': {'secondaryAnimation': {
                'boneGroups': [
                    {'comment': 'A', 'colliderGroups': [2]},
                    {'comment': 'B', 'colliderGroups': [3, 2]},
                ],
                'colliderGroups': [
                    {'node': 0}, {'node': 1}, {'node': 2}, {'node': 3},
                ],
            }}},
        }

    def test_stranded_groups_are_removed_and_named(self):
        doc = self.make_doc()
        removed = twintail.prune_stranded_collider_groups(doc)
        self.assertEqual([(0, 'N0'), (1, 'N1')], removed)
        kept = doc['extensions']['VRM']['secondaryAnimation']['colliderGroups']
        self.assertEqual([{'node': 2}, {'node': 3}], kept)

    def test_surviving_references_are_remapped_to_the_same_groups(self):
        doc = self.make_doc()
        before = doc['extensions']['VRM']['secondaryAnimation']
        targets = [[before['colliderGroups'][i]['node'] for i in g['colliderGroups']]
                   for g in before['boneGroups']]
        twintail.prune_stranded_collider_groups(doc)
        after = doc['extensions']['VRM']['secondaryAnimation']
        self.assertEqual(
            targets,
            [[after['colliderGroups'][i]['node'] for i in g['colliderGroups']]
             for g in after['boneGroups']])

    def test_nothing_changes_when_every_group_is_used(self):
        doc = self.make_doc()
        for group in doc['extensions']['VRM']['secondaryAnimation']['boneGroups']:
            group['colliderGroups'] = [0, 1, 2, 3]
        removed = twintail.prune_stranded_collider_groups(doc)
        self.assertEqual([], removed)
        self.assertEqual(
            4, len(doc['extensions']['VRM']['secondaryAnimation']['colliderGroups']))


if __name__ == '__main__':
    unittest.main()
