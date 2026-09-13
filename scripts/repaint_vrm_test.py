"""Pink's skin atlases contain hair as well as skin and clothing."""
import colorsys
import io
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import numpy as np
from PIL import Image

import repaint_vrm

PUBLIC = Path(__file__).resolve().parents[1] / 'public' / 'avatar'
SOURCE = PUBLIC / 'mika-pink.vrm'
FACE = 'F00_000_00_Face_00'
BODY = 'F00_000_00_Body_00'
# Named atlas regions, independently inspected on the original VRoid textures.
HAIR_REGIONS = {
    FACE: [(0, 0, 1024, 700)],
    BODY: [(480, 50, 620, 180), (900, 50, 950, 140),
           (1100, 50, 1140, 140), (1430, 50, 1570, 180),
           (750, 1570, 1300, 2048)],
}


def texture(doc, binary, name):
    image = next(image for image in doc['images'] if image.get('name') == name)
    view = doc['bufferViews'][image['bufferView']]
    offset = view.get('byteOffset', 0)
    return np.asarray(Image.open(io.BytesIO(
        binary[offset:offset + view['byteLength']])).convert('RGBA'))


def purple_mask(rgba):
    rgb = rgba[..., :3] / 255.0
    hue, light, sat = np.vectorize(colorsys.rgb_to_hls)(
        rgb[..., 0], rgb[..., 1], rgb[..., 2])
    return ((rgba[..., 3] > 200) & (hue > 240 / 360) & (hue < 330 / 360)
            & (sat > .15) & (light > .1) & (light < .95))


class PinkHairPaintTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.work = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.work.cleanup)
        cls.output = Path(cls.work.name) / 'pink.vrm'
        cls.before, cls.before_binary, *_ = repaint_vrm.load(SOURCE)
        repaint_vrm.repair_pink_hair_paint(SOURCE, cls.output)
        cls.after, cls.after_binary, *_ = repaint_vrm.load(cls.output)

    def test_shipped_asset_is_the_repaired_output(self):
        shipped = PUBLIC / 'mika-pink-2.vrm'
        self.assertEqual(hashlib.sha256(shipped.read_bytes()).hexdigest(),
                         hashlib.sha256(self.output.read_bytes()).hexdigest())

    def test_pink_build_finishes_with_the_atlas_repair(self):
        events = []
        with mock.patch.object(repaint_vrm, 'repaint', side_effect=lambda *a, **k: events.append('repaint')):
            with mock.patch.object(repaint_vrm.os, 'remove'):
                with mock.patch.object(repaint_vrm, 'repair_pink_hair_paint',
                                       side_effect=lambda *a: events.append(('repair', *a))):
                    repaint_vrm.build_pink('base.vrm', 'pink.vrm', self.work.name)
        self.assertEqual(events, ['repaint', 'repaint', ('repair', 'pink.vrm', 'pink.vrm')])

    def test_no_purple_hair_remains_in_each_head_and_nape_region(self):
        for name, regions in HAIR_REGIONS.items():
            rgba = texture(self.after, self.after_binary, name)
            for left, top, right, bottom in regions:
                with self.subTest(atlas=name, region=(left, top, right, bottom)):
                    count = int(purple_mask(rgba[top:bottom, left:right]).sum())
                    self.assertLessEqual(count, 100)

    def test_each_scalp_patch_matches_the_existing_hair_colour(self):
        hair_pixels = []
        for name in repaint_vrm.HAIR_LAYERS:
            rgba = texture(self.before, self.before_binary, name)
            hair_pixels.append(rgba[..., :3][rgba[..., 3] > 200])
        target = np.median(np.concatenate(hair_pixels), axis=0)
        for name, regions in HAIR_REGIONS.items():
            old = texture(self.before, self.before_binary, name)
            new = texture(self.after, self.after_binary, name)
            for left, top, right, bottom in regions:
                painted = purple_mask(old[top:bottom, left:right])
                actual = np.median(new[top:bottom, left:right, :3][painted], axis=0)
                with self.subTest(atlas=name, region=(left, top, right, bottom)):
                    self.assertLess(float(np.linalg.norm(actual - target)), 12.0)

    def test_face_skin_blush_and_lips_are_identical(self):
        old = texture(self.before, self.before_binary, FACE)
        new = texture(self.after, self.after_binary, FACE)
        np.testing.assert_array_equal(old[250:850, 300:720], new[250:850, 300:720])

    def test_skin_clothing_and_nails_outside_head_regions_are_identical(self):
        for name, regions in HAIR_REGIONS.items():
            old = texture(self.before, self.before_binary, name)
            new = texture(self.after, self.after_binary, name)
            outside = np.ones(old.shape[:2], dtype=bool)
            for left, top, right, bottom in regions:
                outside[top:bottom, left:right] = False
            with self.subTest(atlas=name):
                np.testing.assert_array_equal(old[outside], new[outside])

    def test_all_non_skin_buffer_views_are_identical(self):
        changed_views = {image['bufferView'] for image in self.before['images']
                         if image.get('name') in (FACE, BODY)}
        for index, (old, new) in enumerate(zip(self.before['bufferViews'], self.after['bufferViews'])):
            if index in changed_views:
                continue
            left = self.before_binary[old.get('byteOffset', 0):old.get('byteOffset', 0) + old['byteLength']]
            right = self.after_binary[new.get('byteOffset', 0):new.get('byteOffset', 0) + new['byteLength']]
            with self.subTest(buffer_view=index):
                self.assertEqual(left, right)

    def test_skeleton_meshes_and_expressions_are_identical(self):
        self.assertEqual(repaint_vrm.skeleton(self.before), repaint_vrm.skeleton(self.after))
        self.assertEqual(self.before['extensions'], self.after['extensions'])

    def test_alpha_is_identical(self):
        for name in (FACE, BODY):
            with self.subTest(atlas=name):
                np.testing.assert_array_equal(
                    texture(self.before, self.before_binary, name)[..., 3],
                    texture(self.after, self.after_binary, name)[..., 3])


if __name__ == '__main__':
    unittest.main()
