"""binding.py decides how a piece is skinned from what it is, not from which
function its author happened to call.

Phase 4 of the skeleton plan. The fixture is a synthetic body -- two thigh
cylinders whose weights blend from the upper leg into the lower leg, a hips
band, a neck, and a head sphere skinned wholly to the head -- so every rule
has a piece that exercises it and one that must not trigger it. The
thresholds were read off the real build (evidence/binding-0906.md):
a skirt's best band below the crotch covers all twelve bearings at an
annulus ratio of 0.65-0.79, while socks and shoes together also cover all
twelve but at 0.16-0.20; head accessories sit on skin that is 1.0 on the
head everywhere, while the vendor's neck ribbon sits on 0.99 upperChest
with a 1% shoulder blend and must stay nearest.
"""
import json
import os
import re
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import binding  # noqa: E402
import customise  # noqa: E402
import garment  # noqa: E402

SHIPPED = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-12.parts.json')

# body-skin slots of the synthetic rig
HIPS, SPINE, CHEST, NECK, HEAD = 0, 1, 2, 3, 4
L_UP, L_LOW, L_FOOT, R_UP, R_LOW, R_FOOT = 5, 6, 7, 8, 9, 10


def rig():
    """A hips-rooted VRM 0.x skeleton, a body mesh on skin 0 and a hair mesh
    on skin 1 whose joint list is the body's reversed, so a slot copied
    across without translation lands on the wrong bone."""
    nodes = [
        {'name': 'Hips', 'translation': [0.0, 0.85, 0.0], 'children': [1, 5, 8]},
        {'name': 'Spine', 'translation': [0.0, 0.15, 0.0], 'children': [2]},
        {'name': 'Chest', 'translation': [0.0, 0.15, 0.0], 'children': [3]},
        {'name': 'Neck', 'translation': [0.0, 0.15, 0.0], 'children': [4]},
        {'name': 'Head', 'translation': [0.0, 0.10, 0.0]},
        {'name': 'LeftUpperLeg', 'translation': [-0.08, 0.0, 0.0], 'children': [6]},
        {'name': 'LeftLowerLeg', 'translation': [0.0, -0.40, 0.0], 'children': [7]},
        {'name': 'LeftFoot', 'translation': [0.0, -0.40, 0.0]},
        {'name': 'RightUpperLeg', 'translation': [0.08, 0.0, 0.0], 'children': [9]},
        {'name': 'RightLowerLeg', 'translation': [0.0, -0.40, 0.0], 'children': [10]},
        {'name': 'RightFoot', 'translation': [0.0, -0.40, 0.0]},
        {'name': 'BodyNode', 'mesh': 0, 'skin': 0},
        {'name': 'HairNode', 'mesh': 1, 'skin': 1},
    ]
    bones = {'hips': 0, 'spine': 1, 'chest': 2, 'neck': 3, 'head': 4,
             'leftUpperLeg': 5, 'leftLowerLeg': 6, 'leftFoot': 7,
             'rightUpperLeg': 8, 'rightLowerLeg': 9, 'rightFoot': 10}
    doc = {
        'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0, 11, 12]}],
        'nodes': nodes,
        'meshes': [{'name': 'Body', 'primitives': []}, {'name': 'Hair', 'primitives': []}],
        'skins': [{'joints': list(range(11))}, {'joints': list(range(10, -1, -1))}],
        'extensions': {'VRM': {'humanoid': {
            'humanBones': [{'bone': b, 'node': n} for b, n in bones.items()]}}},
    }
    pos, joints, weights = [], [], []

    def ring(y, r, cx, count, row):
        for a in np.linspace(0.0, 2 * np.pi, count, endpoint=False):
            pos.append([cx + r * np.cos(a), y, r * np.sin(a)])
            joints.append(row[0])
            weights.append(row[1])

    for cx, up, low in ((-0.08, L_UP, L_LOW), (0.08, R_UP, R_LOW)):
        for y in np.linspace(0.45, 0.85, 9):
            t = (y - 0.45) / 0.40
            ring(y, 0.06, cx, 16, ([up, low, 0, 0], [t, 1.0 - t, 0.0, 0.0]))
    for y in (0.86, 0.90, 0.95):
        ring(y, 0.14, 0.0, 16, ([HIPS, SPINE, 0, 0], [0.7, 0.3, 0.0, 0.0]))
    for y in (1.25, 1.30, 1.35):
        ring(y, 0.05, 0.0, 16, ([NECK, HEAD, 0, 0], [0.6, 0.4, 0.0, 0.0]))
    for lat in np.linspace(-1.2, 1.2, 7):
        ring(1.45 + 0.09 * np.sin(lat), 0.09 * np.cos(lat), 0.0, 16,
             ([HEAD, 0, 0, 0], [1.0, 0.0, 0.0, 0.0]))
    pool = {
        'pos': np.array(pos, dtype=np.float64),
        'nrm': np.zeros((len(pos), 3)),
        'uv': np.zeros((len(pos), 2)),
        'joints': np.array(joints, dtype=np.uint16),
        'weights': np.array(weights, dtype=np.float32),
        'tris': np.zeros((0, 3), dtype=np.int64),
    }
    manifest = {'parts': {'Body_Skin': {'mesh': 'Body'}}}
    lm = {'hip': 0.85, 'knee': 0.45, 'waist': 0.95}
    return doc, pool, manifest, lm


def context():
    doc, pool, manifest, lm = rig()
    return binding.context(doc, pool, manifest, lm, drape=(0.93, 0.714))


ROW = ([0, 0, 0, 0], [1.0, 0.0, 0.0, 0.0])


def tube(y0, y1, r, cx=0.0, segments=24, rings=3, arc=2 * np.pi):
    """An open cylinder (or the `arc` radians of one, from the +x side):
    garment.tube caps its ends with a vertex on the axis, and a skirt has no
    vertex on the hips axis."""
    pos = []
    closed = arc >= 2 * np.pi
    for y in np.linspace(y0, y1, rings + 1):
        for a in np.linspace(0.0, arc, segments, endpoint=not closed):
            pos.append([cx + r * np.cos(a), y, r * np.sin(a)])
    tris = []
    for k in range(rings):
        for s in range(segments if closed else segments - 1):
            a, b = k * segments + s, k * segments + (s + 1) % segments
            c, d = a + segments, b + segments
            tris += [[a, b, c], [b, d, c]]
    n = len(pos)
    return {'pos': np.array(pos), 'nrm': np.zeros((n, 3)), 'uv': np.zeros((n, 2)),
            'joints': np.tile(np.array(ROW[0], dtype=np.uint16), (n, 1)),
            'weights': np.tile(np.array(ROW[1], dtype=np.float32), (n, 1)),
            'tris': np.array(tris, dtype=np.int64)}


def ball(centre, r):
    return garment.sphere(list(centre), r, *ROW, lat=6, lon=8)


class Choose(unittest.TestCase):
    def test_a_ring_round_both_legs_below_the_crotch_drapes(self):
        d = binding.decide(context(), [tube(0.60, 0.70, 0.17)], origin='param')
        self.assertEqual(d['strategy'], 'drape')
        self.assertIn('legs', d['reason'])

    def test_a_ring_round_each_leg_separately_does_not_drape(self):
        # Together the two rings cover every bearing round the hips axis, as
        # the vendor's socks do; what makes them not a skirt is that the band
        # is two blobs, not one annulus.
        piece = garment.merge([tube(0.60, 0.70, 0.075, cx=-0.08),
                               tube(0.60, 0.70, 0.075, cx=0.08)])
        d = binding.decide(context(), [piece], origin='param')
        self.assertEqual(d['strategy'], 'nearest')

    def test_a_ring_round_both_legs_above_the_crotch_does_not_drape(self):
        d = binding.decide(context(), [tube(0.80, 0.84, 0.17)], origin='param')
        self.assertEqual(d['strategy'], 'nearest')

    def test_a_panel_round_the_back_only_does_not_drape(self):
        # A bustle: the right radius, below the crotch, but half the bearings.
        d = binding.decide(context(), [tube(0.60, 0.70, 0.17, arc=np.pi)], origin='param')
        self.assertEqual(d['strategy'], 'nearest')

    def test_a_small_sphere_on_the_head_binds_rigidly_to_it(self):
        d = binding.decide(context(), [ball((0.0, 1.56, 0.0), 0.01)], origin='param')
        self.assertEqual(d['strategy'], 'single')
        self.assertEqual(d['lead'], {'head': 1.0})
        self.assertIn('head', d['reason'])

    def test_a_small_sphere_beside_a_blended_thigh_copies_the_skin(self):
        # Beside the y=0.65 ring, where every nearest row is half upper leg
        # and half lower leg: one dominant joint, but not wholly on it.
        d = binding.decide(context(), [ball((-0.145, 0.65, 0.0), 0.005)], origin='param')
        self.assertEqual(d['strategy'], 'nearest')

    def test_two_rigid_blobs_on_different_bones_copy_the_skin(self):
        # Each blob sits on skin that is wholly one joint's -- the head, and
        # the top ring of the left thigh -- but not the same joint.
        piece = garment.merge([ball((0.0, 1.56, 0.0), 0.01), ball((-0.15, 0.85, 0.0), 0.005)])
        d = binding.decide(context(), [piece], origin='param')
        self.assertEqual(d['strategy'], 'nearest')

    def test_a_band_round_the_neck_copies_the_nearest_skin(self):
        d = binding.decide(context(), [tube(1.27, 1.33, 0.07)], origin='param')
        self.assertEqual(d['strategy'], 'nearest')
        self.assertEqual(max(d['lead'], key=d['lead'].get), 'neck')

    def test_a_shell_inherits_whatever_the_geometry_says(self):
        d = binding.decide(context(), [tube(0.60, 0.70, 0.17)], origin='shell')
        self.assertEqual(d['strategy'], 'inherit')

    def test_smoothing_is_recorded_on_a_nearest_decision_only(self):
        ctx = context()
        d = binding.decide(ctx, [tube(1.27, 1.33, 0.07)], origin='vendor', smooth=16)
        self.assertEqual(d['smooth'], 16)
        rigid = binding.decide(ctx, [ball((0.0, 1.56, 0.0), 0.01)], origin='vendor', smooth=16)
        self.assertNotIn('smooth', rigid)

    def test_the_decision_is_taken_on_the_union_of_a_part_s_primitives(self):
        # The vendor skirt arrives as two primitives; the upper one on its own
        # stops at the hip joint and would copy the skin.
        ctx = context()
        upper, lower = tube(0.80, 0.86, 0.17), tube(0.60, 0.70, 0.17)
        self.assertEqual(binding.decide(ctx, [upper], origin='vendor')['strategy'], 'nearest')
        self.assertEqual(binding.decide(ctx, [upper, lower], origin='vendor')['strategy'], 'drape')

    def test_an_override_keeps_what_the_chooser_would_have_said(self):
        d = binding.override(context(), [tube(0.60, 0.70, 0.17)], 'nearest', 'pinned for the test')
        self.assertEqual(d['strategy'], 'nearest')
        self.assertEqual(d['chosen'], 'drape')
        self.assertIn('pinned for the test', d['reason'])


class Nearest(unittest.TestCase):
    def test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions(self):
        # A VRoid body duplicates every vertex along a UV seam. On exact ties
        # the dense argmin takes the lowest index and a k-d tree takes
        # whichever leaf it visited first: on this pool the two disagree on
        # 248 of 800 queries unless the ties are resolved.
        rng = np.random.default_rng(0)
        base = rng.random((3000, 3))
        pool = np.concatenate([base, base[rng.permutation(3000)[:1500]]])
        q = pool[rng.permutation(len(pool))[:800]] + rng.normal(0, 1e-9, (800, 3))
        dense = ((q[:, None, :] - pool[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
        np.testing.assert_array_equal(binding.nearest(binding.tree_of(pool), pool, q), dense)


class Apply(unittest.TestCase):
    def test_nearest_copies_the_rows_and_translates_slots_into_the_target_skin(self):
        ctx = context()
        piece = tube(1.27, 1.33, 0.07)
        d = binding.decide(ctx, [piece], origin='param')
        on_body = binding.apply(ctx, dict(piece), d, mesh='Body')
        near = binding.nearest(ctx['tree'], ctx['pool']['pos'], piece['pos'])
        np.testing.assert_array_equal(on_body['joints'], ctx['pool']['joints'][near])
        np.testing.assert_array_equal(on_body['weights'], ctx['pool']['weights'][near])
        on_hair = binding.apply(ctx, dict(piece), d, mesh='Hair')
        live = on_hair['weights'] > 0
        np.testing.assert_array_equal(on_hair['joints'][live], 10 - on_body['joints'][live])
        np.testing.assert_array_equal(on_hair['weights'], on_body['weights'])

    def test_single_tiles_the_joint_in_the_target_skin(self):
        ctx = context()
        piece = ball((0.0, 1.56, 0.0), 0.01)
        d = binding.decide(ctx, [piece], origin='param')
        on_body = binding.apply(ctx, dict(piece), d, mesh='Body')
        np.testing.assert_array_equal(on_body['joints'], np.tile([HEAD, 0, 0, 0], (len(piece['pos']), 1)))
        np.testing.assert_array_equal(on_body['weights'], np.tile([1.0, 0.0, 0.0, 0.0], (len(piece['pos']), 1)))
        on_hair = binding.apply(ctx, dict(piece), d, mesh='Hair')
        self.assertEqual(set(on_hair['joints'][:, 0].tolist()), {10 - HEAD})

    def test_drape_hands_the_hem_to_the_legs_and_leaves_the_top_to_the_skin(self):
        ctx = context()
        # The upper ring sits above the fade's top (0.93), where a draped
        # vertex keeps the skin's own rows; the lower one is the hem.
        piece = garment.merge([tube(0.60, 0.70, 0.17), tube(0.94, 0.97, 0.17)])
        d = binding.decide(ctx, [piece], origin='param')
        out = binding.apply(ctx, dict(piece), d, mesh='Body')
        q = piece['pos']
        near = binding.nearest(ctx['tree'], ctx['pool']['pos'], q)

        def weight_on(i, slot):
            return float(out['weights'][i][out['joints'][i] == slot].sum())

        top = int(np.argmax(q[:, 1]))
        np.testing.assert_allclose(out['weights'][top].sum(), 1.0, atol=1e-6)
        self.assertEqual(sorted(out['joints'][top][out['weights'][top] > 0].tolist()),
                         sorted(ctx['pool']['joints'][near[top]][ctx['pool']['weights'][near[top]] > 0].tolist()))
        right = int(np.argmin(np.abs(q[:, 1] - 0.60) + np.abs(q[:, 0] - 0.17)))
        self.assertGreaterEqual(weight_on(right, R_UP), 0.75)
        self.assertEqual(weight_on(right, L_UP), 0.0)
        left = int(np.argmin(np.abs(q[:, 1] - 0.60) + np.abs(q[:, 0] + 0.17)))
        self.assertGreaterEqual(weight_on(left, L_UP), 0.75)
        front = int(np.argmin(np.abs(q[:, 1] - 0.60) + np.abs(q[:, 0]) + np.abs(q[:, 2] + 0.17)))
        self.assertGreaterEqual(weight_on(front, L_UP), 0.3)
        self.assertGreaterEqual(weight_on(front, R_UP), 0.3)

    def test_inherit_leaves_the_rows_the_piece_came_with(self):
        ctx = context()
        piece = tube(0.60, 0.70, 0.17)
        piece['joints'] = np.tile([SPINE, 0, 0, 0], (len(piece['pos']), 1)).astype(np.uint16)
        d = binding.decide(ctx, [piece], origin='shell')
        out = binding.apply(ctx, dict(piece), d, mesh='Body')
        np.testing.assert_array_equal(out['joints'], piece['joints'])
        np.testing.assert_array_equal(out['weights'], piece['weights'])


class Manifest(unittest.TestCase):
    def test_customise_remap_keeps_the_binding_field(self):
        doc = {'meshes': [{'name': 'Body.baked', 'primitives': [
            {'extras': {'part': 'Acc_A'}}, {'extras': {'part': 'Acc_B'}}]}]}
        manifest = {'parts': {
            'Acc_A': {'mesh': 'Body.baked', 'primitives': [1], 'binding': {'strategy': 'single', 'reason': 'x'}},
            'Acc_B': {'mesh': 'Body.baked', 'primitives': [2], 'binding': {'strategy': 'drape', 'reason': 'y'}},
        }, 'palette': {}}
        customise.remap(doc, manifest)
        self.assertEqual(manifest['parts']['Acc_A']['primitives'], [0])
        self.assertEqual(manifest['parts']['Acc_A']['binding']['strategy'], 'single')
        self.assertEqual(manifest['parts']['Acc_B']['binding']['strategy'], 'drape')

    def test_partition_labels_every_part_as_skinned_by_the_export(self):
        with open(os.path.join(HERE, 'partition.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertEqual(len(re.findall(r"'binding': dict\(binding\.EXPORTED\)", src)), 2)
        self.assertEqual(binding.EXPORTED['strategy'], 'inherit')


class Wiring(unittest.TestCase):
    """The chooser being right proves nothing if build() still calls
    garment.bind beside it (memory: feedback_injection_bypasses_wiring)."""

    def test_build_routes_every_piece_through_put_and_binding(self):
        with open(os.path.join(HERE, 'build.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertNotIn('garment.bind(', src)
        self.assertNotIn('def drape(', src)
        self.assertNotIn('np.tile(hj', src)
        self.assertRegex(src, r"\n    def put\(piece, material, name, mesh='Body\.baked', tag=None,\n\s+bind='auto'")
        self.assertRegex(src, r"\n\s+bound = binding\.apply\(ctx, ")
        self.assertRegex(src, r"\n\s+bindings\[name\] = decision")
        self.assertRegex(src, r"\n\s+e\['binding'\] = bindings\.get\(label\)")

    def test_weld_attach_takes_the_same_path(self):
        with open(os.path.join(HERE, 'weld.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertNotIn('garment.bind(', src)
        self.assertRegex(src, r"binding\.apply\(")

    def test_selftest_audits_the_field_on_the_written_manifest(self):
        with open(os.path.join(HERE, 'selftest.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertRegex(src, r"'binding' in e and e\['binding'\]\.get\('strategy'\)")

    def test_twintail_owns_the_field_for_the_parts_it_reweights(self):
        with open(os.path.join(HERE, 'twintail.py'), encoding='utf-8') as fh:
            src = fh.read()
        self.assertRegex(src, r"\n    for part in parts:\n        manifest\[part\]\['binding'\] = dict\(CHAIN\)\n    return report\n")


class Shipped(unittest.TestCase):
    """File-level: the strategies the shipped manifest declares."""
    EXPECTED = {
        'Outfit_Bottom': 'drape',
        'Outfit_Cardigan': 'nearest', 'Outfit_Top': 'nearest', 'Acc_Belt_Waist': 'nearest',
        'Outfit_Socks': 'nearest', 'Outfit_Shoes': 'nearest', 'Acc_Bandage_Thigh': 'nearest',
        'Acc_Ribbon_Neck': 'nearest', 'Acc_Ribbon_Waist': 'nearest',
        'Acc_HairClip_Plaster': 'single', 'Acc_HairClip_Bear': 'single',
        'Acc_HairClip_Bars': 'single', 'Hair_Bun_L': 'single', 'Hair_Bun_R': 'single',
        'Hair_Ear_L': 'single', 'Acc_Crown': 'single', 'Acc_Ribbon_Hair': 'single',
        'Body_Skin': 'inherit', 'Face': 'inherit', 'Hair_Bangs': 'inherit',
        'Hair_Twintail_L': 'chain', 'Hair_Twintail_R': 'chain',
    }

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(SHIPPED):
            raise unittest.SkipTest('shipped manifest not on disk')
        cls.parts = json.load(open(SHIPPED))['parts']

    def test_every_part_declares_a_strategy_and_a_reason(self):
        for name, e in self.parts.items():
            self.assertIn('binding', e, name)
            self.assertIn(e['binding']['strategy'], binding.STRATEGIES + ('chain',), name)
            self.assertTrue(e['binding'].get('reason'), name)

    def test_the_declared_strategies_are_the_ones_the_build_used(self):
        for name, strategy in self.EXPECTED.items():
            self.assertEqual(self.parts[name]['binding']['strategy'], strategy, name)

    def test_smoothing_is_declared_where_the_build_smooths(self):
        self.assertEqual(self.parts['Outfit_Cardigan']['binding']['smooth'], 16)
        self.assertEqual(self.parts['Outfit_Top']['binding']['smooth'], 16)
        self.assertNotIn('smooth', self.parts['Outfit_Socks']['binding'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
