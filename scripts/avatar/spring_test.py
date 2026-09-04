"""Regression checks for browser-visible spring bone behaviour of the tails."""
import json
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import twintail  # noqa: E402


BASE = os.path.dirname(os.path.abspath(__file__))
# SPRING_TEST_MODEL points the file-level tests at another build: that is how
# their mutations are run (a copy with the colliders emptied, gravity back on,
# a bead pushed into a joint, the spine's body group unwired) and how the
# previous shipped file (git HEAD's mika-milfy-2.vrm, which still carries the
# old joint remap and no colliders) is shown to fail them.
MODEL = os.environ.get('SPRING_TEST_MODEL') or os.path.join(
    BASE, '..', '..', 'public', 'avatar', 'mika-milfy-9.vrm')
class SpringTest(unittest.TestCase):
    """The shipped file's spring wiring for the twintails (twintail.apply).

    Each test names the browser symptom it holds shut. The 2026-09-01 file had
    the tails on NO colliders; they hung inside the cardigan at rest and swung
    through it and the body in every clip (springsim.ts: 123-271mm inside the
    coat, 26-40% of the tail, on all ten clips).
    """

    @classmethod
    def setUpClass(cls):
        cls.doc, binary = glb.load(MODEL)
        cls.views = glb.views_of(cls.doc, binary)
        cls.nodes = cls.doc['nodes']
        cls.secondary = cls.doc['extensions']['VRM']['secondaryAnimation']
        cls.tails = next(
            group for group in cls.secondary['boneGroups']
            if any(cls.nodes[node].get('name', '').startswith('HairTail')
                   for node in group.get('bones', ()))
        )
        cls.manifest = json.load(open(MODEL.replace('.vrm', '.parts.json')))['parts']

    def referenced(self):
        return [self.secondary['colliderGroups'][i] for i in self.tails['colliderGroups']]

    def test_twintails_collide_with_her_body(self):
        """Head, neck, chest, spine and both arms: the VRoid set the curtain had."""
        # Coat beads also sit on the spine and hips, so count only the groups
        # that carry no bead: otherwise losing the spine's body group would
        # still leave its name in the set.
        names = {self.nodes[g['node']]['name'] for g in self.referenced()
                 if not any(abs(c['radius'] - twintail.COAT_BEAD_RADIUS) < 1e-6
                            for c in g['colliders'])}
        self.assertTrue(set(twintail.TAIL_BODY_COLLIDERS) <= names,
                        sorted(set(twintail.TAIL_BODY_COLLIDERS) - names))

    def test_twintails_collide_with_the_cardigan(self):
        """The bead proxy of the coat, on the torso bones AND both upper legs.

        Without the legs the hem beads stay with the hips while the coat's hem
        (half its vertices lead on a leg) swings with the legs: 78mm inside at
        the hem on the dance's turn.
        """
        beads = {}
        for g in self.referenced():
            n = sum(1 for c in g['colliders'] if abs(c['radius'] - twintail.COAT_BEAD_RADIUS) < 1e-6)
            if n:
                beads[self.nodes[g['node']]['name']] = beads.get(self.nodes[g['node']]['name'], 0) + n
        self.assertTrue({'J_Bip_C_Hips', 'J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg'} <= set(beads), beads)
        self.assertGreaterEqual(sum(beads.values()), 2 * 5 * twintail.COAT_BEADS_PER_BAND, beads)

    def test_twintails_run_at_zero_gravity(self):
        """Bind chord = rest direction = settled pose only at gravityPower 0;
        under 0.5 the designed drape sags back into the coat (module docstring)."""
        self.assertEqual(0.0, self.tails.get('gravityPower'))

    def tail_joints(self):
        parent = {c: i for i, n in enumerate(self.nodes) for c in n.get('children', ())}
        out = {}
        for i, n in enumerate(self.nodes):
            if not n.get('name', '').startswith('HairTail'):
                continue
            p, j = np.zeros(3), i
            while True:
                p = p + np.array(self.nodes[j].get('translation', [0, 0, 0]))
                if j not in parent:
                    break
                j = parent[j]
            out[n['name']] = p
        return out

    def test_no_tail_joint_rests_inside_a_collider(self):
        """An overlap at bind is a snap on the first physics frame (and on every
        return): the file itself has to clear, not just the builder's check."""
        joints = self.tail_joints()
        points = [p for name, p in joints.items() if not name.endswith('_0')]
        worst = twintail._assert_rest_clearance(
            self.doc, self.secondary, self.tails['colliderGroups'], points,
            self.tails['hitRadius'])
        self.assertGreaterEqual(worst[0], 0.0, worst)

    def test_tail_hair_is_skinned_to_the_joint_at_its_own_height(self):
        """Every tail vertex leads on the joint whose bone it hangs from.

        The first version remapped the curtain's joints one-for-one onto the new
        chain, which starts 12.5cm higher, so every vertex rode a joint one
        segment above itself: invisible at bind, and the reason a strand could
        be 10cm inside the axis when the tail bent round the coat (dance, 45mm
        into the flank). Linear skinning leads on the NEARER joint, so the lead
        joint sits within half a segment (plus slack) of the vertex's own
        height; the old remap put it 12.5-24cm above.
        """
        joints = self.tail_joints()
        skin = self.doc['skins'][0]
        slot_y = {k: joints[self.nodes[n]['name']][1] for k, n in enumerate(skin['joints'])
                  if self.nodes[n].get('name', '') in joints}
        segment = twintail.DROP / twintail.SEGMENTS
        bad = total = 0
        for part in ('Hair_Twintail_L', 'Hair_Twintail_R'):
            mesh = next(m for m in self.doc['meshes'] if m['name'] == self.manifest[part]['mesh'])
            for pi in self.manifest[part]['primitives']:
                attrs = mesh['primitives'][pi]['attributes']
                pos = glb.read_accessor(self.doc, self.views, attrs['POSITION'])
                jnt = glb.read_accessor(self.doc, self.views, attrs['JOINTS_0'])
                wgt = glb.read_accessor(self.doc, self.views, attrs['WEIGHTS_0'])
                lead = jnt[np.arange(len(jnt)), wgt.argmax(axis=1)]
                for y, slot in zip(pos[:, 1], lead):
                    if int(slot) not in slot_y or y > twintail.TIE_Y - 0.05:
                        continue
                    total += 1
                    if abs(slot_y[int(slot)] - y) > segment * 0.5 + 0.012:
                        bad += 1
        self.assertGreater(total, 1000)
        self.assertEqual(0, bad, f'{bad} of {total} tail vertices lead on a joint not above them')

    def test_short_hair_does_not_use_unstable_legacy_springs(self):
        legacy_roots = [
            self.nodes[root].get('name', '')
            for group in self.secondary['boneGroups']
            for root in group.get('bones', ())
            if self.nodes[root].get('name', '').startswith('HairJoint-')
        ]
        self.assertEqual([], legacy_roots)

    def test_every_collider_group_is_referenced_by_a_spring(self):
        used = {
            index
            for group in self.secondary['boneGroups']
            for index in group.get('colliderGroups', [])
        }
        stranded = [
            (index, self.nodes[group.get('node')].get('name', ''))
            for index, group in enumerate(self.secondary['colliderGroups'])
            if index not in used
        ]
        self.assertEqual([], stranded)

    def test_skirt_spring_still_collides_with_the_legs(self):
        skirt = next(
            group for group in self.secondary['boneGroups']
            if any(self.nodes[node].get('name', '').startswith('J_Sec_L_Skirt')
                   for node in group.get('bones', ()))
        )
        nodes = sorted(
            self.nodes[self.secondary['colliderGroups'][index]['node']]['name']
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
        secondary = doc['extensions']['VRM']['secondaryAnimation']
        for group in secondary['boneGroups']:
            group['colliderGroups'] = [0, 1, 2, 3]
        groups_before = secondary['colliderGroups']
        references_before = [g['colliderGroups'] for g in secondary['boneGroups']]
        removed = twintail.prune_stranded_collider_groups(doc)
        self.assertEqual([], removed)
        # 釘住 early-return：list 物件必須原樣留下，不是等值重建。重建等值列表
        # 也能過等值斷言，但那代表 no-op 路徑其實走了重寫，守衛就沒守到。
        self.assertIs(groups_before, secondary['colliderGroups'])
        for before, group in zip(references_before, secondary['boneGroups']):
            self.assertIs(before, group['colliderGroups'])


if __name__ == '__main__':
    unittest.main()
