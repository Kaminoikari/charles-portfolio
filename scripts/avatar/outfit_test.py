"""Focused tests for garment geometry fitting."""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import humanoid  # noqa: E402
import outfit  # noqa: E402


class LoadWiring(unittest.TestCase):
    """outfit.load has to ask bonemap for its anchors. A resolver nobody calls
    (memory: feedback_injection_bypasses_wiring) would leave the fit on
    whatever table happened to be left behind."""
    OUTER = os.path.join(HERE, 'out', 'blender', 'mellow_outer.glb')
    BODY = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')
    OVERRIDE = os.path.join(HERE, 'bonemap', 'mellowheart.json')

    def setUp(self):
        if not (os.path.exists(self.OUTER) and os.path.exists(self.BODY)):
            self.skipTest('mellow_outer.glb 或 mika-pink.vrm 不在')

    def test_load_uses_the_resolver(self):
        doc, binary = glb.load(self.BODY)
        views = glb.views_of(doc, binary)
        # tint={} means no material is copied, so add_material is never called
        # and the test stays about the skeleton.
        bundle = outfit.load(self.OUTER, doc, views, None, {}, override=self.OVERRIDE)
        mapping = bundle['mapping']
        named = set(mapping['names'].values())
        # The generic table would name the forearm; only the vendor file's
        # ignore list keeps it off the anchors, so its absence proves the file
        # reached the resolver and the resolver reached the fit.
        self.assertNotIn('leftLowerArm', named)
        self.assertIn('Lower_arm_L', mapping['unmapped_nodes'])
        self.assertEqual(set(mapping['how'].values()), {'alias'})
        tbones = humanoid.bones(doc)
        self.assertEqual(sorted(bundle['mapped'].values()),
                         sorted(tbones[n] for n in named if n in tbones))
        self.assertEqual(len(mapping['pairs']), 10)


class RingFitTest(unittest.TestCase):
    def setUp(self):
        self.body = np.array([
            [-0.100, 0.60, -0.050], [-0.020, 0.60, 0.050],
            [-0.100, 0.70, 0.050], [-0.020, 0.70, -0.050],
        ])
        self.main_y = np.array([0.60, 0.60, 0.70, 0.70])
        self.main = self.make_item(
            'Leg_belt', 0,
            np.column_stack(([-0.14, 0.00, -0.14, 0.00], self.main_y,
                             [-0.08, -0.08, 0.08, 0.08])),
        )
        self.jewel = self.make_item(
            'Leg_belt', 1,
            np.array([[-0.14, 0.65, 0.00], [-0.13, 0.65, 0.01]]),
        )
        self.items = [self.main, self.jewel]
        self.materials = [{'name': 'Leg_Acc'}, {'name': 'Jewel'}]

    @staticmethod
    def make_item(name, material, pos):
        count = len(pos)
        return {
            'name': name,
            'material': material,
            'targets': {'wide': np.full((count, 3), [0.01, 0.02, 0.03])},
            'piece': {
                'pos': pos.astype(np.float64),
                'nrm': np.tile([1.0, 0.0, 1.0], (count, 1)),
            },
        }

    def fit(self):
        return outfit.fit_ring_to_limb(
            self.items, self.body, self.materials,
            'Leg_belt', 'Leg_Acc', 0.0, 0.001,
        )

    def test_main_ring_matches_limb_diameter_with_clearance(self):
        self.fit()
        actual = np.ptp(self.main['piece']['pos'][:, [0, 2]], axis=0)
        np.testing.assert_allclose(actual, [0.082, 0.102], atol=1e-9)

    def test_companion_primitive_uses_the_same_affine_fit(self):
        jewel_before = self.jewel['piece']['pos'][:, [0, 2]].copy()
        scale, ring_center, limb_center, _ = self.fit()
        expected = jewel_before * scale + limb_center - ring_center * scale
        np.testing.assert_allclose(
            self.jewel['piece']['pos'][:, [0, 2]], expected, atol=1e-9)

    def test_fit_preserves_vertical_positions(self):
        y_before = self.main['piece']['pos'][:, 1].copy()
        self.fit()
        np.testing.assert_array_equal(self.main['piece']['pos'][:, 1], y_before)

    def test_fit_bends_normals_by_the_inverse_scale(self):
        scale, _, _, _ = self.fit()
        expected = np.array([1.0 / scale[0], 0.0, 1.0 / scale[1]])
        expected /= np.linalg.norm(expected)
        np.testing.assert_allclose(
            self.main['piece']['nrm'],
            np.tile(expected, (len(self.main['piece']['nrm']), 1)), atol=1e-9)
        lengths = np.linalg.norm(self.jewel['piece']['nrm'], axis=1)
        np.testing.assert_allclose(lengths, 1.0, atol=1e-9)

    def test_fit_scales_morph_deltas(self):
        delta_before = self.main['targets']['wide'].copy()
        scale, _, _, _ = self.fit()
        expected = delta_before.copy()
        expected[:, [0, 2]] *= scale
        np.testing.assert_allclose(self.main['targets']['wide'], expected, atol=1e-9)


class StandoffTest(unittest.TestCase):
    """One vertex per behaviour standoff promises, so each can turn red alone."""

    AMOUNT = 0.010

    def make_piece(self):
        # Indices: 0 outer front panel, 1 its lining twin (normal faces the
        # body), 2 shoulder top (normal straight up), 3/4 sleeve pair at
        # |x|=0.45, 5/6 back panel pair keeping the centroid near the origin,
        # 7 a collar vertex with a MIXED normal (up-and-forward). Vertex 7 is
        # the one that actually pins the y-drop: vertex 2's normal is pure +y,
        # so its horizontal part is zero and it moves nothing whether or not
        # the y component is dropped -- a fixture with only vertex 2 lets the
        # y-drop line be deleted with every test still green (round-4 code
        # review caught exactly that).
        pos = np.array([
            [0.05, 1.00, -0.100],
            [0.05, 1.00, -0.095],
            [0.00, 1.27, 0.000],
            [0.45, 1.20, -0.050],
            [-0.45, 1.20, -0.050],
            [0.05, 1.00, 0.100],
            [-0.15, 1.00, 0.095],
            [0.10, 1.22, -0.090],
        ])
        nrm = np.array([
            [0.0, 0.0, -1.0],
            [0.0, 0.0, 1.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, -1.0],
            [0.0, 0.0, -1.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.8, -0.6],
        ])
        return {'pos': pos.astype(np.float64), 'nrm': nrm.astype(np.float64)}

    def test_lining_moves_with_the_outer_shell(self):
        piece = self.make_piece()
        before = np.array(piece['pos'])
        outfit.standoff(piece, self.AMOUNT)
        outer = piece['pos'][0] - before[0]
        lining = piece['pos'][1] - before[1]
        np.testing.assert_allclose(outer, [0.0, 0.0, -self.AMOUNT], atol=1e-9)
        np.testing.assert_allclose(lining, outer, atol=1e-9)
        gap_before = before[1, 2] - before[0, 2]
        gap_after = piece['pos'][1, 2] - piece['pos'][0, 2]
        self.assertAlmostEqual(gap_after, gap_before, places=9)

    def test_shoulder_top_and_sleeves_stay_put(self):
        piece = self.make_piece()
        before = np.array(piece['pos'])
        outfit.standoff(piece, self.AMOUNT)
        for index in (2, 3, 4):
            np.testing.assert_allclose(piece['pos'][index], before[index],
                                       atol=1e-9)

    def test_push_is_horizontal_everywhere(self):
        piece = self.make_piece()
        before = np.array(piece['pos'])
        outfit.standoff(piece, self.AMOUNT)
        np.testing.assert_allclose(piece['pos'][:, 1], before[:, 1], atol=1e-9)
        # 順帶釘住「頂點 7 真的有被推」：它的 y 不動必須是因為 y 被丟掉，
        # 不是因為它根本沒動（那是頂點 2 的空測試陷阱）。
        moved = piece['pos'][7] - before[7]
        self.assertGreater(abs(float(moved[2])), 1e-4)


class RestPose(unittest.TestCase):
    """Phase 2 of the skeleton plan: the fit SOLVES its yaw instead of asserting
    it, and every limb bone turns the cloth weighted to it from the garment's
    segment direction onto ours. Ten-bone synthetic pair: hips, spine, neck,
    a left shoulder and upper arm, both upper and lower legs, one foot (the
    eight without the shoulder pair are the smallest rig bonemap.require
    accepts). The garment rig is written to a real glb so outfit.load reads it
    through the same door as the vendor files, and its bones carry non-identity
    rest rotations on purpose: the textbook bone-matrix retarget the module
    docstring warns about would turn the cloth by those, and (a) is what stops
    anyone reintroducing it."""

    THIGH, SHIN = 0.343, 0.38
    LEFT_X = -0.068           # the body's left is -x, as on the VRoid target

    def points(self, splay_deg=0.0, lean_deg=0.0, chain=False, droop_deg=0.0):
        """Bone world positions in the TARGET frame, insertion-ordered.
        `droop_deg` lowers the shoulder-to-upper-arm segment, the one a
        shoulder WOULD turn on if it were a limb bone."""
        s, c = np.sin(np.radians(splay_deg)), np.cos(np.radians(splay_deg))
        ls, lc = np.sin(np.radians(lean_deg)), np.cos(np.radians(lean_deg))
        ds, dc = np.sin(np.radians(droop_deg)), np.cos(np.radians(droop_deg))
        hips = np.array([0.0, 0.88, 0.0])
        spine = hips + 0.10 * np.array([0.0, lc, -ls])
        neck = spine + 0.27 * np.array([0.0, lc, -ls])
        lul = np.array([self.LEFT_X, 0.843, 0.0])
        lll = lul + np.array([0.0, -self.THIGH, 0.0])
        shin_dir = np.array([-s, -c, 0.0])
        lf = lll + self.SHIN * shin_dir
        rul = np.array([-self.LEFT_X, 0.843, 0.0])
        rll = rul + np.array([0.0, -self.THIGH, 0.0])
        shoulder = spine + np.array([-0.02, 0.246, 0.0])
        upper_arm = shoulder + 0.061 * np.array([-dc, -ds, 0.0])
        pts = {'hips': hips, 'spine': spine, 'neck': neck,
               'leftShoulder': shoulder, 'leftUpperArm': upper_arm,
               'leftUpperLeg': lul, 'leftLowerLeg': lll, 'leftFoot': lf,
               'rightUpperLeg': rul, 'rightLowerLeg': rll}
        if chain:
            pts['cloth'] = lll + 0.5 * self.SHIN * shin_dir
        return pts, shin_dir

    PARENT = {'spine': 'hips', 'neck': 'spine', 'leftShoulder': 'spine',
              'leftUpperArm': 'leftShoulder', 'leftUpperLeg': 'hips',
              'leftLowerLeg': 'leftUpperLeg', 'leftFoot': 'leftLowerLeg',
              'rightUpperLeg': 'hips', 'rightLowerLeg': 'rightUpperLeg',
              'cloth': 'leftLowerLeg'}
    SOURCE_NAMES = {'hips': 'Hips', 'spine': 'Spine', 'neck': 'Neck',
                    'leftShoulder': 'Shoulder.L', 'leftUpperArm': 'UpperArm.L',
                    'leftUpperLeg': 'UpperLeg.L', 'leftLowerLeg': 'LowerLeg.L',
                    'leftFoot': 'Foot.L', 'rightUpperLeg': 'UpperLeg.R',
                    'rightLowerLeg': 'LowerLeg.R', 'cloth': 'Cloth_1.L'}

    @staticmethod
    def ry(deg):
        s, c = np.sin(np.radians(deg)), np.cos(np.radians(deg))
        return np.array([[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]])

    def target(self):
        """A VRM 0.x body: identity rest rotations, translation-only nodes,
        one skin over every node (add_bones needs one)."""
        pts, _ = self.points()
        names = list(pts)
        nodes, bones = [], {}
        for i, n in enumerate(names):
            p = self.PARENT.get(n)
            local = pts[n] - (pts[p] if p else 0.0)
            nodes.append({'name': n, 'translation': [float(v) for v in local]})
            bones[n] = i
        for i, n in enumerate(names):
            p = self.PARENT.get(n)
            if p:
                nodes[names.index(p)].setdefault('children', []).append(i)
        doc = {'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes,
               'bufferViews': [], 'accessors': [],
               'extensions': {'VRM': {'humanoid': {'humanBones': [
                   {'bone': b, 'node': n} for b, n in bones.items()]}}}}
        views = []
        ibm = np.tile(np.eye(4), (len(names), 1, 1))
        for i, n in enumerate(names):
            ibm[i][:3, 3] = -pts[n]
        doc['skins'] = [{'joints': list(range(len(names))),
                         'inverseBindMatrices': glb.add_accessor(
                             doc, views, ibm.transpose(0, 2, 1).reshape(-1, 16).astype(np.float32))}]
        return doc, views

    def garment(self, splay_deg=0.0, lean_deg=0.0, yaw_deg=180.0, chain=True,
                rest_rotation=True, droop_deg=0.0):
        """Write the garment glb and return its path plus the frame data the
        assertions need (source shin direction in source world)."""
        import tempfile
        pts, shin_dir = self.points(splay_deg, lean_deg, chain, droop_deg)
        yaw = self.ry(yaw_deg)
        world = {n: yaw @ p for n, p in pts.items()}
        shin_src = yaw @ shin_dir
        names = list(pts)
        # Every source bone is turned a quarter turn about its own Z so the
        # rig's frames disagree with ours the way a Blender export does.
        qz = [0.0, 0.0, float(np.sin(np.pi / 4)), float(np.cos(np.pi / 4))] \
            if rest_rotation else [0.0, 0.0, 0.0, 1.0]
        rz = np.array([[0.0, -1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 1.0]]) \
            if rest_rotation else np.eye(3)
        rot_world = {}
        nodes = []
        for n in names:
            p = self.PARENT.get(n)
            prot = rot_world[p] if p else np.eye(3)
            rot_world[n] = prot @ rz
            local = prot.T @ (world[n] - (world[p] if p else 0.0))
            nodes.append({'name': self.SOURCE_NAMES[n],
                          'translation': [float(v) for v in local],
                          'rotation': qz})
        for i, n in enumerate(names):
            p = self.PARENT.get(n)
            if p:
                nodes[names.index(p)].setdefault('children', []).append(i)
        slot = {n: i for i, n in enumerate(names)}

        doc = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
               'nodes': nodes, 'bufferViews': [], 'accessors': [], 'meshes': [],
               'skins': [{'joints': list(range(len(names)))}]}
        views = []
        ibm = np.zeros((len(names), 4, 4))
        for i, n in enumerate(names):
            m = np.eye(4)
            m[:3, :3], m[:3, 3] = rot_world[n], world[n]
            ibm[i] = np.linalg.inv(m)
        doc['skins'][0]['inverseBindMatrices'] = glb.add_accessor(
            doc, views, ibm.transpose(0, 2, 1).reshape(-1, 16).astype(np.float32))

        def primitive(pos, nrm, joint, delta=None):
            n = len(pos)
            att = {
                'POSITION': glb.add_accessor(doc, views, pos.astype(np.float32), 34962),
                'NORMAL': glb.add_accessor(doc, views, nrm.astype(np.float32), 34962),
                'TEXCOORD_0': glb.add_accessor(doc, views, np.zeros((n, 2), np.float32), 34962),
                'JOINTS_0': glb.add_accessor(
                    doc, views, np.tile([joint, 0, 0, 0], (n, 1)).astype(np.uint16), 34962),
                'WEIGHTS_0': glb.add_accessor(
                    doc, views, np.tile([1.0, 0.0, 0.0, 0.0], (n, 1)).astype(np.float32), 34962),
            }
            tri = np.array([[i, (i + 1) % n, (i + 2) % n] for i in range(n)], np.uint16)
            pr = {'attributes': att,
                  'indices': glb.add_accessor(doc, views, tri.reshape(-1), 34963)}
            if delta is not None:
                pr['targets'] = [{'POSITION': glb.add_accessor(
                    doc, views, delta.astype(np.float32), 34962)}]
            return pr

        # Sock: five vertices ON the shin axis (t = 0..1) and eight around it
        # at mid-shin, radius 0.03, normals radial. Morph target 'along' pushes
        # every vertex 10mm down the shin.
        lll = world['leftLowerLeg']
        side = np.cross(shin_src, [0.0, 0.0, 1.0])
        side /= np.linalg.norm(side)
        fwd = np.cross(shin_src, side)
        axis = np.array([lll + t * self.SHIN * shin_src for t in np.linspace(0.0, 1.0, 5)])
        ring_n = np.array([np.cos(a) * side + np.sin(a) * fwd
                           for a in np.linspace(0.0, 2 * np.pi, 8, endpoint=False)])
        ring = lll + 0.5 * self.SHIN * shin_src + 0.03 * ring_n
        pos = np.concatenate([axis, ring])
        nrm = np.concatenate([np.tile(side, (5, 1)), ring_n])
        sock = primitive(pos, nrm, slot['leftLowerLeg'],
                         delta=np.tile(0.01 * shin_src, (len(pos), 1)))
        doc['meshes'].append({'name': 'Sock', 'primitives': [sock],
                              'extras': {'targetNames': ['along']}})
        if chain:
            frill = np.array([lll + t * self.SHIN * shin_src for t in (0.5, 0.75, 1.0)])
            doc['meshes'].append({'name': 'Frill', 'primitives': [
                primitive(frill, np.tile(side, (3, 1)), slot['cloth'])]})
        # Shoe: on the shin axis below the ankle, weighted to Foot.L, whose
        # own segment (to the toes) the mapping never sees -- the foot has to
        # inherit the shin's turn for the shoe to stay in line with it.
        shoe = np.array([lll + t * self.SHIN * shin_src for t in (1.0, 1.1, 1.2)])
        doc['meshes'].append({'name': 'Shoe', 'primitives': [
            primitive(shoe, np.tile(side, (3, 1)), slot['leftFoot'])]})
        # Skirt: a ring around the hips, weighted to Hips.
        hips = world['hips']
        skirt_n = np.array([[np.cos(a), 0.0, np.sin(a)]
                            for a in np.linspace(0.0, 2 * np.pi, 6, endpoint=False)])
        skirt = hips + np.array([0.0, -0.2, 0.0]) + 0.15 * skirt_n
        doc['meshes'].append({'name': 'Skirt', 'primitives': [
            primitive(skirt, skirt_n, slot['hips'])]})
        # Collar: three vertices over the shoulder, weighted to Shoulder.L.
        collar = world['leftShoulder'] + np.array([[0.0, 0.03, 0.0], [-0.03, 0.03, 0.0], [0.0, 0.03, 0.03]])
        doc['meshes'].append({'name': 'Collar', 'primitives': [
            primitive(collar, np.tile([0.0, 1.0, 0.0], (3, 1)), slot['leftShoulder'])]})

        path = os.path.join(tempfile.mkdtemp(), 'garment.glb')
        glb.save(path, doc, glb.rebuild(doc, views))
        return path, {'world': world, 'shin_src': shin_src, 'slot': slot,
                      'pos': {'sock': pos, 'skirt': skirt, 'collar': collar}}

    def fit(self, path):
        doc, views = self.target()
        bundle = outfit.load(path, doc, views, None, {})
        items = {it['name']: it for it in outfit.pieces(bundle, doc, views)}
        return doc, views, bundle, items

    @staticmethod
    def dist_to_line(points, a, direction):
        d = direction / np.linalg.norm(direction)
        rel = points - a
        return np.linalg.norm(rel - np.outer(rel @ d, d), axis=1)

    def target_shin(self):
        pts, shin_dir = self.points()
        return pts['leftLowerLeg'], shin_dir

    # (a) --------------------------------------------------------------
    def test_an_identical_rig_gets_no_rotation_and_the_translation_field_bit_for_bit(self):
        path, ref = self.garment()
        doc, views, bundle, items = self.fit(path)
        self.assertAlmostEqual(abs(bundle['yaw_deg']), 180.0, places=6)
        for i, (rot, _, _) in bundle['correction'].items():
            self.assertIsNone(rot, f'bone {bundle["snames"][i]} got a rotation on an identical rig')
        a = bundle['a']
        aligned = ref['pos']['sock'].astype(np.float32).astype(np.float64) @ a[:3, :3].T + a[:3, 3]
        _, _, d = bundle['correction'][ref['slot']['leftLowerLeg']]
        np.testing.assert_array_equal(items['Sock']['piece']['pos'], aligned + d)

    # (b) --------------------------------------------------------------
    def test_a_splayed_shin_lands_on_our_shin_line(self):
        path, _ = self.garment(splay_deg=10.0)
        _, _, _, items = self.fit(path)
        origin, direction = self.target_shin()
        axis = items['Sock']['piece']['pos'][:5]
        off = self.dist_to_line(axis, origin, direction)
        self.assertLess(off.max(), 0.001, f'shin axis off our shin line by {off.max() * 1000:.1f}mm')

    # (c) --------------------------------------------------------------
    def test_the_fit_solves_its_yaw_and_refuses_a_quarter_turn(self):
        pts, _ = self.points()
        dst = np.array(list(pts.values()))
        for yaw in (0.0, 180.0, -180.0):
            src = dst @ self.ry(yaw).T
            a, scale, solved = outfit._fit(src, dst)
            off_half = abs(solved) % 180.0
            self.assertLess(min(off_half, 180.0 - off_half), 1e-6, f'yaw {yaw} solved {solved}')
            self.assertAlmostEqual(scale, 1.0, places=9)
            np.testing.assert_allclose((a @ np.append(src[0], 1.0))[:3], dst[0], atol=1e-9,
                                       err_msg=f'hips not landed at yaw {yaw}')
            # The half turn is an exact diagonal, not sin/cos of the solved
            # angle: sin(pi) is 1.2e-16 and would leak into every vertex.
            half = np.diag([1.0, 1.0, 1.0]) if yaw == 0.0 else np.diag([-1.0, 1.0, -1.0])
            np.testing.assert_array_equal(a[:3, :3], scale * half, err_msg=f'yaw {yaw}')
        with self.assertRaises(outfit.BadFit) as cm:
            outfit._fit(dst @ self.ry(90.0).T, dst)
        self.assertIn('90', str(cm.exception))

    def test_a_segment_pointing_the_opposite_way_is_refused(self):
        u = np.array([0.0, -1.0, 0.0])
        self.assertIsNone(outfit._turn(u, u))
        with self.assertRaises(outfit.BadFit):
            outfit._turn(u, -u)

    # (d) --------------------------------------------------------------
    def test_normals_on_a_turned_segment_turn_with_it(self):
        path, _ = self.garment(splay_deg=10.0)
        _, _, _, items = self.fit(path)
        _, direction = self.target_shin()
        ring = items['Sock']['piece']['nrm'][5:]
        along = np.abs(ring @ direction)
        self.assertLess(along.max(), 1e-6, f'ring normals lean {np.degrees(np.arcsin(along.max())):.2f} deg along our shin')
        np.testing.assert_allclose(np.linalg.norm(ring, axis=1), 1.0, atol=1e-9)

    # (e) --------------------------------------------------------------
    def test_morph_deltas_on_a_turned_segment_turn_with_it(self):
        path, _ = self.garment(splay_deg=10.0)
        _, _, _, items = self.fit(path)
        _, direction = self.target_shin()
        delta = items['Sock']['targets']['along']
        unit = delta / np.linalg.norm(delta, axis=1, keepdims=True)
        across = np.linalg.norm(np.cross(unit, direction), axis=1)
        self.assertLess(across.max(), 1e-6, f'deltas lean {np.degrees(np.arcsin(across.max())):.2f} deg off our shin')

    # (f) --------------------------------------------------------------
    def test_a_garment_chain_bone_inherits_its_anchors_rotation_in_pieces(self):
        path, _ = self.garment(splay_deg=10.0)
        _, _, _, items = self.fit(path)
        origin, direction = self.target_shin()
        off = self.dist_to_line(items['Frill']['piece']['pos'], origin, direction)
        self.assertLess(off.max(), 0.001, f'frill off our shin line by {off.max() * 1000:.1f}mm')

    def test_a_garment_chain_bone_inherits_its_anchors_rotation_in_add_bones(self):
        path, ref = self.garment(splay_deg=10.0)
        doc, views, bundle, _ = self.fit(path)
        slot = outfit.add_bones(bundle, doc, views)
        world = humanoid.rest_world(doc)
        node = doc['skins'][0]['joints'][slot[ref['slot']['cloth']]]
        self.assertEqual(doc['nodes'][node]['name'], 'Mellow_Cloth_1.L')
        origin, direction = self.target_shin()
        off = self.dist_to_line(world[node][:3, 3][None], origin, direction)[0]
        self.assertLess(off, 0.001, f'chain bone off our shin line by {off * 1000:.1f}mm')

    # (h) --------------------------------------------------------------
    def test_a_bone_whose_segment_is_not_mapped_inherits_the_turn_above_it(self):
        path, ref = self.garment(splay_deg=10.0)
        _, _, bundle, items = self.fit(path)
        shin_rot = bundle['correction'][ref['slot']['leftLowerLeg']][0]
        foot_rot = bundle['correction'][ref['slot']['leftFoot']][0]
        self.assertIsNotNone(shin_rot)
        np.testing.assert_array_equal(foot_rot, shin_rot)
        origin, direction = self.target_shin()
        off = self.dist_to_line(items['Shoe']['piece']['pos'], origin, direction)
        self.assertLess(off.max(), 0.001, f'shoe off our shin line by {off.max() * 1000:.1f}mm')

    # (g) --------------------------------------------------------------
    def test_trunk_bones_stay_translation_only(self):
        path, ref = self.garment(lean_deg=10.0)
        _, _, bundle, items = self.fit(path)
        for name in ('hips', 'spine', 'neck'):
            rot, _, _ = bundle['correction'][ref['slot'][name]]
            self.assertIsNone(rot, f'{name} was rotated; the trunk is translation-only by design')
        a = bundle['a']
        aligned = ref['pos']['skirt'].astype(np.float32).astype(np.float64) @ a[:3, :3].T + a[:3, 3]
        _, _, d = bundle['correction'][ref['slot']['hips']]
        np.testing.assert_array_equal(items['Skirt']['piece']['pos'], aligned + d)

    # (j) --------------------------------------------------------------
    def test_the_shoulder_stays_translation_only_even_when_its_segment_differs(self):
        path, ref = self.garment(droop_deg=10.0)
        _, _, bundle, items = self.fit(path)
        for name in ('leftShoulder', 'leftUpperArm'):
            rot, _, _ = bundle['correction'][ref['slot'][name]]
            self.assertIsNone(rot, f'{name} was rotated; the shoulder is a trunk bone in all but name')
        a = bundle['a']
        aligned = ref['pos']['collar'].astype(np.float32).astype(np.float64) @ a[:3, :3].T + a[:3, 3]
        _, _, d = bundle['correction'][ref['slot']['leftShoulder']]
        np.testing.assert_array_equal(items['Collar']['piece']['pos'], aligned + d)


if __name__ == '__main__':
    unittest.main()
