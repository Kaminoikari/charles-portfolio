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


WAIST_AT = 0.9


def body():
    """A hips-rooted rig with the six bones landmarks() reads, VRM 0.x
    spelling, plus a torso pool whose narrowest ring sits at WAIST_AT.

    That ring is a quarter of the way up the hips-to-shoulder span, where a real
    waist is (0.960 on a body with hips at 0.878 and a shoulder at 1.215). It
    used to sit at the midpoint, which is the one height a band truncated from
    either end still contains -- so a search that started halfway up the torso
    passed (evidence/scale-0907-mutate.py, W5).
    """
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
        r = 0.12 + 0.5 * abs(y - WAIST_AT)
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
        self.assertAlmostEqual(lm['waist'], WAIST_AT, delta=0.011)

    def test_a_taller_body_moves_every_joint_landmark_and_not_the_waist(self):
        doc, pool = body()
        taller = copy.deepcopy(doc)
        taller['nodes'][0]['translation'][1] += 0.1
        a, b = build.landmarks(pool, doc), build.landmarks(pool, taller)
        for key in ('hip', 'knee', 'ankle', 'shoulder', 'neck'):
            self.assertAlmostEqual(b[key] - a[key], 0.1, places=9, msg=key)
        self.assertEqual(b['hand_x'], a['hand_x'])
        # The waist comes from the MESH, which did not move, so it stays on the
        # narrowest ring while every joint rises 10cm. It is not bit-identical
        # any more: since 2026-09-07 the slices are sampled on a grid derived
        # from this body's own hips and shoulder, so raising the hips 10cm
        # re-samples the same unmoved torso and can pick the neighbouring slice.
        # One grid step is the honest tolerance; 10cm is what it must not move.
        step = (a['shoulder'] - a['hip']) * build.WAIST_SEARCH['step']
        for waist in (a['waist'], b['waist']):
            self.assertAlmostEqual(waist, WAIST_AT, delta=step)

    def test_the_waist_is_found_on_a_body_of_any_size(self):
        # The band was a fixed 0.88..1.16 in metres until 2026-09-07, so on a
        # body a fifth shorter the real waist fell underneath it and the search
        # returned a height on the chest without failing (evidence/scale-0907.log
        # measured 1.020 on both a 0.8x and a 1.25x body). A similarity
        # transform of the whole body must move every landmark by exactly the
        # same factor -- that is what makes it the same body at another size.
        doc, pool = body()
        base = build.landmarks(pool, doc)
        for k in (0.5, 0.8, 1.25, 2.0):
            scaled = copy.deepcopy(doc)
            for node in scaled['nodes']:
                node['translation'] = [v * k for v in node['translation']]
            grown = {'pos': pool['pos'] * k}
            got = build.landmarks(grown, scaled)
            for key in ('waist', 'waist_r', 'hip', 'knee', 'ankle', 'shoulder',
                        'neck', 'hand_x', 'foot'):
                self.assertAlmostEqual(got[key] / k, base[key], places=9,
                                       msg=f'{key} at x{k}')


class TorsoEdges(unittest.TestCase):
    """The three garment edges on the torso, which were absolute heights until
    2026-09-07. The body they were measured on has its waist at 0.960000 and
    its left upper-arm joint at 1.215111 (build.landmarks on out/bare.rerun.vrm,
    2026-09-07)."""

    MEASURED = {'waist': 0.960000, 'shoulder': 1.215111}
    DRAWN_AT = {'bandeau_top': 1.181, 'strap_bottom': 1.168, 'sleeve_bottom': 1.155}

    def test_the_edges_land_where_the_outfit_was_drawn(self):
        # The fractions are only meaningful if they still put the edges where
        # the reference sheet has them on the body it was drawn against. 0.1mm,
        # which is the tolerance at which the vertex masks were checked to be
        # identical.
        got = build.torso_edges(self.MEASURED)
        for name, y in self.DRAWN_AT.items():
            self.assertAlmostEqual(got[name], y, delta=0.0001, msg=name)

    def test_a_longer_torso_moves_every_edge(self):
        # The whole point: raise the shoulder without moving the waist and the
        # bandeau, the straps and the sleeve all ride up with the ribs they sit
        # on, each by its own share of the 10cm.
        short = self.MEASURED
        tall = {'waist': short['waist'], 'shoulder': short['shoulder'] + 0.1}
        a, b = build.torso_edges(short), build.torso_edges(tall)
        for name, f in build.TORSO_EDGES.items():
            self.assertAlmostEqual(b[name] - a[name], 0.1 * f, places=9, msg=name)
        # And they stay in the order the garment needs: sleeve under strap
        # under bandeau, on either body.
        for edges in (a, b):
            self.assertLess(edges['sleeve_bottom'], edges['strap_bottom'])
            self.assertLess(edges['strap_bottom'], edges['bandeau_top'])
        # A body with longer legs and the same torso: waist and shoulder both
        # 5cm up, so every edge is 5cm up and not a millimetre more. Raising
        # only the shoulder cannot tell a waist-to-shoulder span from a
        # shoulder-to-floor one -- both grow by the same 10cm -- and this is
        # the case that can.
        lifted = {k: v + 0.05 for k, v in short.items()}
        c = build.torso_edges(lifted)
        for name in build.TORSO_EDGES:
            self.assertAlmostEqual(c[name] - a[name], 0.05, places=9, msg=name)


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

    def test_the_waist_is_searched_for_on_the_bodys_own_span(self):
        with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertRegex(src, r"span = float\(world\[bones\['leftUpperArm'\]\]\[1, 3\]\) - hips_y")
        self.assertRegex(src, r"np\.arange\(hips_y \+ span \* w\['from'\], hips_y \+ span \* w\['to'\]")
        self.assertRegex(src, r"np\.abs\(p\[:, 1\] - y\) < span \* w\['slab'\]")
        # The band this replaced. A revert that leaves WAIST_SEARCH declared but
        # searches the old fixed range again would pass every behaviour test on
        # this one body.
        for typed in (r"np\.arange\(0\.88", r"- y\) < 0\.012"):
            self.assertNotRegex(src, typed, 'the waist is searched for in metres again')

    def test_build_cuts_the_torso_edges_at_the_derived_fractions(self):
        with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertRegex(src, r"edge = torso_edges\(lm\)")
        for name in ('bandeau_top', 'strap_bottom', 'sleeve_bottom'):
            self.assertRegex(src, r"edge\['%s'\]" % name)
        self.assertRegex(src, r"p\[:, 1\] < lm\['neck'\]")
        # The heights these replaced, so a revert cannot pass by leaving the
        # derivation in place beside a typed-in comparison.
        for typed in (r"p\[:, 1\] < 1\.181", r"p\[:, 1\] > 1\.168",
                      r"p\[:, 1\] < 1\.252", r"p\[:, 1\] > 1\.155"):
            self.assertNotRegex(src, typed, 'build() types a torso edge in again')


    def test_the_last_absolute_heights_are_derived_too(self):
        """The five that survived 2026-09-07 because they were inside build().

        A number typed inside a function is not a constant, so listing build.py's
        constants found none of these. `wrap('Acc_Bandage_Thigh', 0.652, ...)`
        sat two lines above two siblings that already read the ankle and knee.
        """
        with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertRegex(src, r"leg = leg_edges\(lm\)")
        self.assertRegex(src, r"edge\['chest_probe'\]")
        self.assertRegex(src, r"edge\['button_low'\], edge\['button_mid'\], edge\['button_high'\]")
        self.assertRegex(src, r"edge\['bust_frill'\]")
        self.assertRegex(src, r"wrap\('Acc_Bandage_Thigh', leg\['thigh_band'\]")
        for typed in (r"p\[:, 1\] - 1\.02", r"for y in \(0\.945", r"ring_at\(pool, 1\.176",
                      r"'Acc_Bandage_Thigh', 0\.652"):
            self.assertNotRegex(src, typed, 'build() types an absolute height in again')

    def test_a_taller_body_moves_the_new_heights_with_it(self):
        """Fractions, not offsets: stretch the body and they stretch with it."""
        doc, pool = body()
        lm = build.landmarks(pool, doc)
        tall = dict(lm, waist=lm['waist'] * 1.25, shoulder=lm['shoulder'] * 1.25,
                    knee=lm['knee'] * 1.25, hip=lm['hip'] * 1.25)
        for name, got in build.torso_edges(tall).items():
            self.assertAlmostEqual(got, build.torso_edges(lm)[name] * 1.25, places=9,
                                   msg=f'{name} did not scale with the torso')
        for name, got in build.leg_edges(tall).items():
            self.assertAlmostEqual(got, build.leg_edges(lm)[name] * 1.25, places=9,
                                   msg=f'{name} did not scale with the leg')


if __name__ == '__main__':
    unittest.main(verbosity=2)
