"""What cover.py has to get right, and the body that proved each one.

Every case here failed on the 2026-09-09 VRoid Studio dress-up export before the
line it guards was written, and the export is the fixture for the ones that need
a real body: it is committed at public/avatar/, it is the only body in the repo
that arrives already dressed, and its defect is visible on screen (a black patch
of camisole on a red hoodie, evidence/cover-0910.md).

The cheap cases use arrays rather than a model. A ray test and an all-three-
corners rule do not need 14MB of VRM to be wrong.
"""
import json
import os
import sys
import unittest

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import cover  # noqa: E402
import glb  # noqa: E402
import pierce  # noqa: E402
import pose as pose_mod  # noqa: E402

MANIFEST = os.path.join(HERE, '..', '..', 'public', 'avatar',
                        'vroid-studio-dressup.parts.json')
# The body under public/avatar has BEEN through this module since 2026-09-10, so
# it is the wrong thing to point these tests at: trimming an already-trimmed body
# cuts nothing, every assertion below passes without the code doing anything, and
# every mutation of it goes green. The fixture is the export as it arrived, which
# git still holds at the commit that added it. Read from there rather than kept
# as a second 14MB copy in the tree, and loud when it is missing: a fixture that
# quietly skips is how a suite starts proving nothing.
EXPORT_BLOB = '6ae5189:public/avatar/vroid-studio-dressup.vrm'
_dressup = []


def dressup_export():
    """The pre-cull export, materialised once per run."""
    if not _dressup:
        import subprocess, tempfile
        out = os.path.join(tempfile.mkdtemp(), 'vroid-studio-dressup-export.vrm')
        with open(out, 'wb') as handle:
            subprocess.run(['git', '-C', os.path.join(HERE, '..', '..'), 'show',
                            EXPORT_BLOB], stdout=handle, check=True)
        _dressup.append(out)
    return _dressup[0]


def square(z, half=1.0):
    """Two triangles making a plane at height z, facing -y."""
    a = np.array([[-half, z, -half], [half, z, -half], [half, z, half],
                  [-half, z, half]])
    return np.stack([a[[0, 1, 2]], a[[0, 2, 3]]])


class Rays(unittest.TestCase):
    """cover._nearest: how far along THIS vertex's own normal the first hit is."""

    def near(self, origin, direction, tris):
        return cover._nearest(np.array([origin]), np.array([direction]), tris)[0]

    def test_a_normal_pointing_at_the_cloth_finds_it(self):
        self.assertAlmostEqual(self.near([0.0, 0.0, 0.0], [0.0, 0.15, 0.0],
                                         square(0.05)), 1 / 3, places=6)

    def test_a_normal_pointing_away_does_not(self):
        # The far side of the torso is the case this rules out: a ball of
        # nearest-vertex distance wide enough to reach a loose hoodie also
        # reaches the garment on the other side of the body.
        self.assertEqual(self.near([0.0, 0.0, 0.0], [0.0, -0.15, 0.0],
                                   square(0.05)), np.inf)

    def test_cloth_beyond_the_ray_is_out_of_reach(self):
        # The direction carries the length: 0.15m of ray cannot see 0.2m away.
        self.assertEqual(self.near([0.0, 0.0, 0.0], [0.0, 0.15, 0.0],
                                   square(0.20)), np.inf)

    def test_a_ray_that_misses_sideways_misses(self):
        self.assertEqual(self.near([5.0, 0.0, 0.0], [0.0, 0.15, 0.0],
                                   square(0.05)), np.inf)

    def test_it_reports_the_nearest_of_several(self):
        # covered() compares a cloth distance against a skin distance, so the
        # value has to be the FIRST surface along the ray and not merely one of
        # them. With only a yes/no here, cloth behind the head read the same as
        # cloth in front of the chest.
        both = np.concatenate([square(0.12), square(0.03)])
        self.assertAlmostEqual(self.near([0.0, 0.0, 0.0], [0.0, 0.15, 0.0], both),
                               0.2, places=6)


class Triangles(unittest.TestCase):
    """cover.dead_triangles: all three corners, so a hem keeps its skin."""

    def setUp(self):
        self.doc = {'meshes': [{'name': 'M', 'primitives': [{'indices': 0}]}]}
        self.idx = np.array([[0, 1, 2], [1, 2, 3]], dtype=np.int64)
        self.views = None

    def read(self, doc, views, index):
        return self.idx.reshape(-1)

    def dead(self, covered):
        real, glb.read_accessor = glb.read_accessor, self.read
        try:
            return cover.dead_triangles(self.doc, self.views, None,
                                        {('M', 0): np.array(covered)})[('M', 0)]
        finally:
            glb.read_accessor = real

    def test_all_three_corners_covered_dies(self):
        self.assertTrue(self.dead([True, True, True, True]).all())

    def test_a_triangle_straddling_the_edge_lives(self):
        # Vertex 3 is outside the garment, so the second triangle is the one at
        # the hem and has to stay: half a triangle cannot be deleted, and
        # keeping it is the side that cannot open a hole.
        self.assertEqual(list(self.dead([True, True, True, False])), [True, False])

    def test_one_covered_corner_is_not_enough(self):
        self.assertEqual(list(self.dead([True, False, False, False])), [False, False])


class ClothSet(unittest.TestCase):
    """cover.cloth_parts: what counts as covering."""

    PARTS = {'Outfit_Cardigan': {'mesh': 'A', 'primitives': [0]},
             'Acc_Glasses': {'mesh': 'B', 'primitives': [0]},
             'Outfit_Empty': {'mesh': 'C', 'primitives': []},
             'Body_Skin': {'mesh': 'D', 'primitives': [0]}}

    def test_a_garment_covers(self):
        self.assertIn('Outfit_Cardigan', cover.cloth_parts(self.PARTS))

    def test_an_accessory_does_not(self):
        # Glasses sit 8 to 11mm off the face over the ear (evidence/
        # parts-0909.md); counting them as cover deletes the ear behind them.
        self.assertNotIn('Acc_Glasses', cover.cloth_parts(self.PARTS))

    def test_a_part_with_no_primitives_does_not(self):
        self.assertNotIn('Outfit_Empty', cover.cloth_parts(self.PARTS))

    def test_skin_is_never_cloth(self):
        self.assertNotIn('Body_Skin', cover.cloth_parts(self.PARTS))


class TheFixture(unittest.TestCase):
    """The export these tests cut is the one the shipped body was cut from."""

    def test_the_blob_is_the_body_the_manifest_says_it_came_from(self):
        # Binds the fixture to the provenance claim: parts.json says the served
        # body was made by running this module over that blob, and if the two
        # ever stop being the same file, one of the two is lying.
        import hashlib
        with open(MANIFEST, encoding='utf-8') as handle:
            source = json.load(handle)['source']
        self.assertEqual(source['derived_from']['path'], f'git {EXPORT_BLOB}')
        digest = hashlib.sha256(open(dressup_export(), 'rb').read()).hexdigest()
        self.assertEqual(digest, source['derived_from']['sha256'])

    def test_the_fixture_still_has_skin_under_the_clothes(self):
        # The point of reading it out of git. Pointed at the served body these
        # tests would trim a body with nothing left to trim and pass anyway.
        doc, binary = glb.load(dressup_export())
        views = glb.views_of(doc, binary)
        with open(MANIFEST, encoding='utf-8') as handle:
            parts = json.load(handle)['parts']
        mask = cover.covered(doc, views, parts)
        self.assertGreater(sum(int(m.sum()) for m in mask.values()), 5000,
                           'the fixture has no covered skin, so nothing below '
                           'is measuring a cut')


class OnTheDressUpExport(unittest.TestCase):
    """The body the whole module exists for."""

    def test_the_mouth_does_not_read_the_hood_behind_the_head_as_cover(self):
        # The defect this rule exists for. A mouth vertex's own normal points
        # INTO the skull, and 150mm of ray leaves through the back of the head
        # and lands on the hood, a median 117.7mm away. Judged as "is there
        # cloth within reach" the answer is yes, so 120 mouth vertices reported
        # themselves covered -- every one of them facing into the skull -- and
        # the jaw and neck were cut out from under the collar. Nothing
        # downstream catches it: the pixels keep their paint, they just stop
        # being skin, so cover.holes stays silent and only a camera on the head
        # shows the notch.
        doc, binary = glb.load(dressup_export())
        views = glb.views_of(doc, binary)
        with open(MANIFEST, encoding='utf-8') as handle:
            parts = json.load(handle)['parts']
        posed = pose_mod.skinned(doc, views, {}, True)
        norms = pose_mod.skinned_normals(doc, views, {}, True)
        mask = cover.covered(doc, views, parts, posed=posed, norms=norms)

        mouth = parts['Face']['mesh'], 0          # the FaceMouth primitive
        self.assertIn(mouth, mask)
        inward = np.asarray(norms[mouth], dtype=np.float64)
        pos = np.asarray(posed[mouth], dtype=np.float64)
        # There really are vertices whose normal points back through the head,
        # or this test would be asserting something the body cannot produce.
        into_skull = inward[:, 2] < 0
        self.assertGreater(int(into_skull.sum()), 50,
                           'no mouth vertex faces into the skull, so this frame '
                           'does not exercise the rule')
        self.assertFalse(mask[mouth][into_skull].any(),
                         'a mouth vertex facing into the skull reads as covered, '
                         'which is the hood on the far side of the head')

        # The mouth primitive keeps all 1,696 triangles it has. Under the first
        # criterion it lost 58, and those 58 are how the jaw went with them
        # (evidence/mouth-0910.log).
        self.assertEqual(int(cover.dead_triangles(doc, views, parts, mask)[mouth].sum()), 0,
                         'the mouth is being cut again')

    def test_the_cull_leaves_the_face_alone_under_a_head_camera(self):
        """The guard cover.holes cannot be: skin replaced by another surface.

        holes() counts pixels that had paint and now have background, so a cut
        that reveals the hood instead of the background is invisible to it, and
        the full-body framings the rest of this suite uses are too coarse to
        show a notch a few millimetres wide. Under the first criterion -- cloth
        anywhere along the ray, for every layer -- this frame moves 2,495 pixels
        and the collar visibly eats into the neck. Read with a camera on the
        head it is obvious; read anywhere else it is not.
        """
        import tempfile
        import render
        out = os.path.join(tempfile.mkdtemp(), 'cut.vrm')
        cover.apply(dressup_export(), out, MANIFEST)
        keep = render.VIEWS
        render.VIEWS = {'head': (0.0, 0.0, 'head')}
        try:
            shots = []
            for tag, path in (('before', dressup_export()), ('after', out)):
                render.render(path, os.path.join(os.path.dirname(out), tag),
                              size=(700, 700), only=('head',))
                shots.append(np.asarray(Image.open(
                    os.path.join(os.path.dirname(out), f'{tag}-head.png')
                ).convert('RGB')).astype(int))
        finally:
            render.VIEWS = keep
        moved = int((np.abs(shots[0] - shots[1]).max(axis=2) > 6).sum())
        # 394 measured on 2026-09-10, a sliver along the collar's own edge; the
        # body that ships moves 244, because the hole guard has put some of the
        # one-pass cut back by then. The bound sits between 394 and the 2,495
        # every way of losing the rule produces, so it holds the fix without
        # pinning the exact antialiasing of one renderer. Those ways are M17
        # (ignore the body) and M19 (call the outer body inner wear), which read
        # the same 2,495 because for the outer body they are the same rule; the
        # standoffs that were tried instead read 2,481.
        self.assertLess(moved, 800,
                        f'{moved} pixels of the head changed; the cull is eating '
                        'into the face or neck again')

    @classmethod
    def setUpClass(cls):
        cls.doc, binary = glb.load(dressup_export())
        cls.views = glb.views_of(cls.doc, binary)
        with open(MANIFEST, encoding='utf-8') as handle:
            cls.parts = json.load(handle)['parts']
        cls.posed = pose_mod.skinned(cls.doc, cls.views, {}, True)
        cls.norms = pose_mod.skinned_normals(cls.doc, cls.views, {}, True)

    def painting_vertices(self, part):
        """Which of this part's vertices land on an opaque texel.

        VRoid draws inner wear on a copy of the body whose texture is
        transparent everywhere else, so most of these two layers paints nothing
        and only the camisole and the shorts can ever be seen.
        """
        from PIL import Image
        import io
        info = self.parts[part]
        i = info['primitives'][0]
        mesh = next(m for m in self.doc['meshes'] if m.get('name') == info['mesh'])
        prim = mesh['primitives'][i]
        tex = self.doc['materials'][prim['material']]['pbrMetallicRoughness'] \
            ['baseColorTexture']['index']
        image = self.doc['images'][self.doc['textures'][tex]['source']]
        view = self.doc['bufferViews'][image['bufferView']]
        _, binary = glb.load(dressup_export())
        start = view.get('byteOffset', 0)
        alpha = np.asarray(Image.open(io.BytesIO(
            binary[start:start + view['byteLength']])).convert('RGBA'))[:, :, 3]
        uv = np.asarray(glb.read_accessor(self.doc, self.views,
                                          prim['attributes']['TEXCOORD_0']),
                        dtype=np.float64)
        h, w = alpha.shape
        x = np.clip((uv[:, 0] % 1.0 * w).astype(int), 0, w - 1)
        y = np.clip((uv[:, 1] % 1.0 * h).astype(int), 0, h - 1)
        return alpha[y, x] > 127, (info['mesh'], i)

    def test_the_inner_layers_are_wear_and_the_outer_body_is_not(self):
        # The distinction the cull turns on. VRoid draws inner wear on a copy of
        # the body whose texture is transparent everywhere else, so the copy
        # paints over almost none of itself while the body a viewer sees paints
        # over all of it. Read the wrong way round, either the hoodie keeps
        # showing the camisole or the collar eats the neck.
        _, binary = glb.load(dressup_export())
        worn = cover.worn_layers(self.doc, binary, self.views, self.parts)
        for part in ('Body_Skin_Inner_Top', 'Body_Skin_Inner_Bottom'):
            self.assertIn((self.parts[part]['mesh'], 0), worn,
                          f'{part} is inner wear on a body copy and is not '
                          'being read as one')
        self.assertNotIn((self.parts['Body_Skin']['mesh'], 0), worn,
                         'the body a viewer sees is being read as inner wear')
        # Primitives 2, 5 and 6 are the eye highlight, the eyebrows and the
        # eyeliner: alpha masks drawn ON the visible face, which paint over
        # 7.7%, 19.2% and 46.7% of themselves and so pass the transparency half
        # of the test on their own. They are held out by being face-sized. Let
        # them in and a hood or a high collar deletes the eyebrows, with
        # cover.holes blind to it because the face still paints behind them.
        for i in range(len(next(m for m in self.doc['meshes']
                                if m.get('name') == self.parts['Face']['mesh']
                                )['primitives'])):
            self.assertNotIn((self.parts['Face']['mesh'], i), worn,
                             f'face primitive {i} is being read as inner wear')
        self.assertEqual(len(worn), 2,
                         f'{sorted(worn)} read as inner wear; only the two body '
                         'copies are')

    def test_the_body_in_front_of_the_camisole_does_not_protect_it(self):
        """The two layers are judged by a looser rule, and only those two.

        The camisole sits under `Body (merged)` wherever both exist, a median
        0.49mm behind it, so the first surface its ray meets is skin rather than
        cloth. Requiring cloth to come first there leaves 765 triangles of torso
        in place and the cardigan reads 171 pixels against a limit of 150. The
        outer body has to be judged the other way, or the collar takes the neck.
        """
        _, binary = glb.load(dressup_export())
        worn = cover.worn_layers(self.doc, binary, self.views, self.parts)
        strict = cover.dead_triangles(self.doc, self.views, self.parts,
                                      cover.covered(self.doc, self.views, self.parts,
                                                    posed=self.posed, norms=self.norms))
        split = cover.dead_triangles(self.doc, self.views, self.parts,
                                     cover.covered(self.doc, self.views, self.parts,
                                                   posed=self.posed, norms=self.norms,
                                                   worn=worn))
        inner = (self.parts['Body_Skin_Inner_Top']['mesh'], 0)
        gained = int(split[inner].sum()) - int(strict[inner].sum())
        self.assertGreater(gained, 200,
                           f'the looser rule only reaches {gained} more triangles '
                           'of the camisole, so it is not being applied')
        body = (self.parts['Body_Skin']['mesh'], 0)
        self.assertEqual(int(split[body].sum()), int(strict[body].sum()),
                         'the body a viewer sees is being judged by the looser '
                         'rule too, which is what cuts into the neck')

    def test_the_cut_leaves_nothing_behind_in_the_file(self):
        """A deleted triangle must not still be downloaded.

        `glb.rebuild` lays down every bufferView whether or not an accessor
        points at it, so appending a fresh index accessor and leaving the old
        one keeps the deleted indices in the file: on this export that was
        243,732 bytes, and it made the culled body LARGER than the one it was
        cut from. The two orphans the export already carries are not this
        module's and are left alone.
        """
        import tempfile
        out = os.path.join(tempfile.mkdtemp(), 'cut.vrm')
        cover.apply(dressup_export(), out, MANIFEST)
        before = self.orphans(dressup_export())
        after = self.orphans(out)
        self.assertEqual(after[0], before[0],
                         f'the cull left {after[0] - before[0]} accessors that '
                         f'nothing reads, {after[1] - before[1]} bytes of them')
        self.assertLess(os.path.getsize(out), os.path.getsize(dressup_export()),
                        'the culled body is not smaller than the body it was cut '
                        'from, so the deleted triangles are still in the file')

    @staticmethod
    def orphans(path):
        """(how many accessors nothing reads, how many bytes they hold)."""
        doc, _ = glb.load(path)
        dead = [i for i in range(len(doc['accessors']))
                if not cover._readers(doc, i)]
        return len(dead), sum(
            doc['bufferViews'][doc['accessors'][i]['bufferView']]['byteLength']
            for i in dead if 'bufferView' in doc['accessors'][i])

    def test_the_camisole_under_the_hoodie_is_covered(self):
        # The defect in one line. The hoodie stands 50 to 80mm off the chest, so
        # the camisole beneath it is nowhere near any cloth VERTEX; asking along
        # the body's own normal is what finds the hoodie over it. Before this,
        # 106 of these vertices read as having no garment above them at all and
        # came through the hoodie as a black patch.
        mask = cover.covered(self.doc, self.views, self.parts,
                             posed=self.posed, norms=self.norms)
        paints, key = self.painting_vertices('Body_Skin_Inner_Top')
        covered = mask[key][paints]
        self.assertGreater(covered.mean(), 0.9,
                           f'{int((~covered).sum())} of {int(paints.sum())} '
                           'painting vertices of the camisole read as uncovered')

    def test_the_face_is_not_swallowed(self):
        # The hood's collar reaches the neck, and an over-eager cut there is the
        # 2026-09-09 R2 neck gap. The cut is allowed to reach the neck; it is
        # not allowed to take the face with it.
        mask = cover.covered(self.doc, self.views, self.parts,
                             posed=self.posed, norms=self.norms)
        face = self.parts['Face']
        eyes = mask[(face['mesh'], 3)]
        pos = np.asarray(self.posed[(face['mesh'], 3)], dtype=np.float64)
        above = pos[:, 1] > 1.45          # above the collar, whatever it does
        # 1.45m is a height on THIS body, and a shorter body or a renumbered
        # face primitive would select nothing and pass the assertion below on
        # an empty array. 653 of this primitive's 2,266 vertices are up there.
        self.assertGreater(int(above.sum()), 300,
                           f'only {int(above.sum())} vertices sit above 1.45m, '
                           'so the assertion below is looking at nothing')
        self.assertFalse(mask[(face['mesh'], 3)][above].any(),
                         f'{int(eyes[above].sum())} vertices of the face above '
                         'the collar read as covered by a garment')


class TheLoop(unittest.TestCase):
    """trim(): cut, measure, put back what the measurement objects to."""

    @classmethod
    def setUpClass(cls):
        import tempfile
        from motion import retarget
        cls.tmp = tempfile.mkdtemp()
        doc, binary = glb.load(dressup_export())
        views = glb.views_of(doc, binary)
        bones = pose_mod.bones(doc)
        clip = os.path.join(HERE, '..', '..', 'public', 'avatar', 'animations',
                            'modelPose.vrma')
        rot, _ = retarget(clip, 2.82, doc)
        cls.pose = {bones[b]: q for b, q in rot.items() if b in bones}
        cls.out = os.path.join(cls.tmp, 'trimmed.vrm')
        cls.report = cover.trim(dressup_export(), cls.out, MANIFEST,
                                poses=(None, cls.pose), rounds=12)
        with open(MANIFEST, encoding='utf-8') as handle:
            cls.parts = json.load(handle)['parts']

    def cardigan(self, rot):
        doc, binary = glb.load(self.out)
        views = glb.views_of(doc, binary)
        worst, area = pierce.count(doc, views, self.parts,
                                   posed=pose_mod.skinned(doc, views, rot, True),
                                   size=(360, 620), detail=True)
        return (worst.get('Outfit_Cardigan', 0),
                pierce.limit(area.get('Outfit_Cardigan', 0)))

    def test_it_converges(self):
        self.assertTrue(self.report['converged'], self.report['rounds'])

    def test_the_hoodie_stops_showing_the_body(self):
        # 779 pixels against a limit of 150 before this ran, on the frame the
        # black patch is visible in.
        count, limit = self.cardigan(self.pose)
        self.assertLessEqual(count, limit, f'{count} pixels of body through the '
                                           f'cardigan, limit {limit:.0f}')

    def test_it_did_not_make_the_rest_pose_worse(self):
        count, limit = self.cardigan({})
        self.assertLessEqual(count, limit)

    def test_nothing_turned_into_background(self):
        # The other side of the pair. Cutting skin a garment covers changes
        # nothing on screen; the pixel only goes to background when the cut went
        # past the cloth, which is what the neck did on the first pass and what
        # the loop put back.
        lost = cover.holes(dressup_export(), self.out, MANIFEST, poses=(None, self.pose))
        self.assertEqual({view: n for view, (n, _) in lost.items()},
                         {view: 0 for view in lost})

    def test_the_hole_guard_reports_every_view(self):
        # An empty result reads as "no holes" exactly as easily as "no views
        # were drawn", and those are opposite verdicts.
        lost = cover.holes(dressup_export(), self.out, MANIFEST, poses=(None,))
        self.assertEqual(set(lost), set(pierce.VIEWS))

    def test_a_transparent_layer_does_not_count_as_painted(self):
        # What separates the opacity guard from the flat part map. VRoid's inner
        # wear is a body copy whose texture is transparent everywhere but the
        # garment, so the part map -- which has no alpha and colours every
        # triangle -- claims thousands of pixels the render never paints. Read
        # off the part map, deleting those triangles looks like a hole and the
        # black camisole goes back on top of the hoodie.
        import partmap
        import render
        doc, binary = glb.load(dressup_export())
        views = glb.views_of(doc, binary)
        posed = pose_mod.skinned(doc, views, {}, True)
        painted = cover._drawn(doc, views, self.parts, posed, (360, 620),
                               ('side',))['side']
        keep = render.VIEWS
        render.VIEWS = pierce.VIEWS
        try:
            _, _, labels = partmap.draw(doc, views, self.parts, None, (360, 620),
                                        ('side',), posed)
        finally:
            render.VIEWS = keep
        flat = labels['side'][0] >= 0
        self.assertLess(int(painted.sum()), int(flat.sum()),
                        'the opacity guard claims as many pixels as the flat '
                        'part map, so it is not reading texture alpha')

    def test_running_out_of_rounds_is_reported_not_swallowed(self):
        out = os.path.join(self.tmp, 'onepass.vrm')
        report = cover.trim(dressup_export(), out, MANIFEST, poses=(None, self.pose),
                            rounds=1)
        self.assertFalse(report['converged'])
        self.assertGreater(report['rounds'][0]['lost'], 0)


class WritingTheIndicesBackInPlace(unittest.TestCase):
    """cover._rewrite_indices: where the surviving indices may be put back.

    It replaces the accessor's whole bufferView starting at byte zero, which is
    right for a VRoid export and wrong for five layouts glTF also allows: an
    accessor a second primitive reads, one with no bufferView at all, one that
    starts partway into its view, a view a second accessor shares, and a view a
    sparse block reads without any accessor naming it at top level.
    `dressup.py` is the entry for a body exported by a tool this repo does not
    control, so each is built here rather than waited for.

    Every case asserts the same observable thing rather than which branch ran:
    the primitive reads back the triangles it was handed, and whatever else
    pointed into that view still reads what it held. The first test is the
    ordinary layout, which has to keep being written in place or the file grows
    by every triangle deleted from it; the last is the two bodies that go
    through this module today, neither of which may fall onto the slow path.
    """

    # Flat, the way `_write` hands them over: `kept.reshape(-1)`.
    KEPT = np.array([3, 4, 5], dtype=np.uint32)
    NEIGHBOUR = np.array([7, 8, 9, 10, 11, 12], dtype=np.uint32)

    def doc_with(self, **acc):
        """One mesh, one primitive, indices laid out however `acc` says."""
        indices = np.array([[0, 1, 2], [3, 4, 5]], dtype=np.uint32).tobytes()
        views = [bytearray(indices)]
        doc = {
            'bufferViews': [{'buffer': 0, 'byteOffset': 0,
                             'byteLength': len(indices)}],
            'accessors': [dict({'bufferView': 0, 'componentType': 5125,
                                'count': 6, 'type': 'SCALAR'}, **acc)],
            'meshes': [{'primitives': [{'attributes': {}, 'indices': 0}]}],
        }
        return doc, views

    def rewrite(self, doc, views):
        cover._rewrite_indices(doc, views, doc['meshes'][0]['primitives'][0],
                               self.KEPT)
        glb.rebuild(doc, views)
        read = glb.read_accessor(doc, views,
                                 doc['meshes'][0]['primitives'][0]['indices'])
        return read.reshape(-1)

    def test_the_ordinary_layout_is_written_where_it_was(self):
        """The case that has to keep working, or the file grows again."""
        doc, views = self.doc_with()
        before = len(doc['accessors'])
        self.assertTrue(cover._in_place_safe(doc, 0))
        got = self.rewrite(doc, views)
        np.testing.assert_array_equal(got, self.KEPT)
        self.assertEqual(len(doc['accessors']), before,
                         'the ordinary layout appended an accessor instead of '
                         'writing in place, so the deleted indices stay in the '
                         'file')

    def test_an_accessor_a_second_primitive_also_reads_is_not_overwritten(self):
        doc, views = self.doc_with()
        doc['meshes'][0]['primitives'].append({'attributes': {}, 'indices': 0})
        self.assertFalse(cover._in_place_safe(doc, 0))
        got = self.rewrite(doc, views)
        np.testing.assert_array_equal(got, self.KEPT)
        other = glb.read_accessor(doc, views,
                                  doc['meshes'][0]['primitives'][1]['indices'])
        np.testing.assert_array_equal(
            other.reshape(-1), np.arange(6, dtype=np.uint32),
            'the second primitive lost the triangles it was drawing')

    def test_an_accessor_with_no_view_of_its_own_is_not_written_through(self):
        """glTF: an accessor with no bufferView means all zeros. There is no
        view to write into, and reaching for one is an error rather than a
        silently wrong array."""
        doc, views = self.doc_with()
        doc['accessors'][0].pop('bufferView')
        self.assertFalse(cover._in_place_safe(doc, 0))
        got = self.rewrite(doc, views)
        np.testing.assert_array_equal(got, self.KEPT)

    def test_an_accessor_that_starts_partway_into_its_view_is_not_overwritten(self):
        """The new indices would be written at byte zero and read from 24."""
        doc, views = self.doc_with(byteOffset=24)
        views[0] = bytearray(bytes(self.NEIGHBOUR.tobytes()) + bytes(views[0]))
        doc['bufferViews'][0]['byteLength'] = len(views[0])
        self.assertFalse(cover._in_place_safe(doc, 0))
        got = self.rewrite(doc, views)
        np.testing.assert_array_equal(got, self.KEPT)

    def test_a_view_a_second_accessor_shares_is_not_overwritten(self):
        """Both start in the same view and only the second is partway in, so
        this is the condition that has to catch it: the first accessor passes
        the byteOffset test."""
        doc, views = self.doc_with()
        views[0] = bytearray(bytes(views[0]) + bytes(self.NEIGHBOUR.tobytes()))
        doc['bufferViews'][0]['byteLength'] = len(views[0])
        doc['accessors'].append({'bufferView': 0, 'byteOffset': 24,
                                 'componentType': 5125, 'count': 6,
                                 'type': 'SCALAR'})
        self.assertEqual(doc['accessors'][0].get('byteOffset', 0), 0)
        self.assertFalse(cover._in_place_safe(doc, 0))
        got = self.rewrite(doc, views)
        np.testing.assert_array_equal(got, self.KEPT)
        np.testing.assert_array_equal(
            glb.read_accessor(doc, views, 1).reshape(-1),
            self.NEIGHBOUR,
            'the accessor sharing the view lost its data')

    def test_a_view_a_sparse_block_reads_is_not_overwritten(self):
        """A sparse morph target reaches its bytes through
        `sparse.values.bufferView`, which no accessor names at top level. A
        check that walks only `accessor['bufferView']` sees one user, writes
        through it, and turns the morph deltas into whatever the new indices
        happen to be with nothing raised.
        """
        doc, views = self.doc_with()
        deltas = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6], dtype=np.float32)
        views[0] = bytearray(bytes(views[0]) + bytes(deltas.tobytes()))
        doc['bufferViews'][0]['byteLength'] = len(views[0])
        views.append(bytearray(np.array([0, 1], dtype=np.uint32).tobytes()))
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': 0,
                                   'byteLength': len(views[1])})
        doc['accessors'].append({
            'componentType': 5126, 'count': 4, 'type': 'VEC3',
            'sparse': {'count': 2,
                       'indices': {'bufferView': 1, 'byteOffset': 0,
                                   'componentType': 5125},
                       'values': {'bufferView': 0, 'byteOffset': 24}}})
        doc['meshes'][0]['primitives'][0]['targets'] = [{'POSITION': 1}]
        before = glb.read_accessor(doc, views, 1).copy()
        self.assertFalse(cover._in_place_safe(doc, 0))
        got = self.rewrite(doc, views)
        np.testing.assert_array_equal(got, self.KEPT)
        np.testing.assert_allclose(
            glb.read_accessor(doc, views, 1), before, rtol=0, atol=0,
            err_msg='the sparse morph target read someone else\'s bytes')

    def test_the_bodies_that_go_through_this_module_take_the_cheap_path(self):
        """The three conditions added in review must not have quietly turned
        the whole export onto the appending path, which is what they cost when
        they fire, and would put the deleted indices back in the file.
        """
        shipped = os.path.join(HERE, '..', '..', 'public', 'avatar',
                               'vroid-studio-dressup.vrm')
        for path in (dressup_export(), shipped):
            doc, _ = glb.load(path)
            unsafe = [p['indices'] for mesh in doc['meshes']
                      for p in mesh['primitives'] if 'indices' in p
                      and not cover._in_place_safe(doc, p['indices'])]
            self.assertEqual(unsafe, [], f'{os.path.basename(path)} has index '
                             'accessors this module would have to append past')


if __name__ == '__main__':
    unittest.main()
