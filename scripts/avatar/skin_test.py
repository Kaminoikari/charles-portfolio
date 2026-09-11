"""The body texture repaint, on bodies other than the one it was written for.

skin.strip() finds the clothing VRoid painted into the skin atlas and fills it
back in from the skin that survived. Both halves carried a constant that was
right about one body: the pull-push pyramid stopped after nine halvings, which
is enough only when no hole swallows a coarse cell whole.
"""
import io
import os
import sys
import tempfile
import unittest

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb        # noqa: E402
import partition  # noqa: E402
import skin       # noqa: E402

AVATARS = os.path.join(HERE, '..', '..', 'public', 'avatar')


def body_atlas(path):
    """(the body's skin atlas as a PIL image, this body's own skin colour)."""
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    name = skin.skin_material(doc)
    index = skin.body_image(doc, material=name)
    image = Image.open(io.BytesIO(bytes(views[doc['images'][index]['bufferView']])))
    return image, skin.skin_reference(doc, views, name)


class TheFillIsMadeOfWhatSurvived(unittest.TestCase):
    """pull_push averages surviving pixels, so its output cannot leave their range.

    A pyramid that stops before one pixel breaks that: a coarse cell no valid
    pixel reaches divides zero by 1e-6, comes out (0, 0, 0), and the upsample
    blends that zero down into every level beneath it.
    """

    def test_a_hole_that_swallows_a_coarse_cell_whole(self):
        # One flat colour, so every honest answer is that same colour. The hole
        # is a quarter of a 1024 image: at the ninth halving that is 2x2 and
        # one of the four cells is entirely inside it.
        rgb = np.full((1024, 1024, 3), (200, 150, 120), dtype=np.uint8)
        valid = np.ones((1024, 1024), dtype=bool)
        valid[:512, :512] = False
        out = skin.pull_push(rgb, valid)
        self.assertGreaterEqual(out.min(), 120 - 1e-3)
        self.assertLessEqual(out.max(), 200 + 1e-3)

    def test_a_non_square_image_leaves_no_column_unreached(self):
        # half() trims an odd row or column, so the pyramid can stop at 1xN
        # rather than 1x1 and a column can still have nothing valid in it.
        rgb = np.full((6, 400, 3), (200, 150, 120), dtype=np.uint8)
        valid = np.ones((6, 400), dtype=bool)
        valid[:, :200] = False
        out = skin.pull_push(rgb, valid)
        self.assertGreaterEqual(out.min(), 120 - 1e-3)
        self.assertLessEqual(out.max(), 200 + 1e-3)


class FindsTheBodyAtlas(unittest.TestCase):
    """Which texture to repaint, on a body whose materials are named otherwise.

    The material name used to be a default argument spelling one body's:
    F00_000_00_Body_00_SKIN is Mika's base, AvatarSample_A's and B's, and
    nobody else's here. apply() raised on the other thirteen before it
    repainted anything.
    """

    def doc(self, name):
        path = os.path.join(AVATARS, name)
        if not os.path.exists(path):
            raise unittest.SkipTest(f'public/avatar/{name} 不在')
        return glb.load(path)[0]

    def test_a_body_whose_material_carries_a_different_model_number(self):
        doc = self.doc('AvatarSample_C_webp.vrm')
        self.assertEqual(skin.skin_material(doc), 'M00_000_00_Body_00_SKIN')

    def test_the_face_atlas_is_not_mistaken_for_the_body(self):
        # The face carries a SKIN material of its own, on its own image.
        doc = self.doc('Darkness_Shibu_webp.vrm')
        face = next(m['name'] for m in doc['materials']
                    if partition.vroid_category(m.get('name', '')) == ('Face', 'SKIN'))
        self.assertNotEqual(skin.skin_material(doc), face)
        self.assertNotEqual(skin.body_image(doc), skin.body_image(doc, material=face))

    def test_the_base_resolves_to_the_image_the_written_down_name_did(self):
        doc = self.doc('mika-pink.vrm')
        self.assertEqual(skin.body_image(doc),
                         skin.body_image(doc, material='F00_000_00_Body_00_SKIN'))

    def test_a_file_with_no_vroid_skin_material_says_so(self):
        with self.assertRaises(ValueError):
            skin.skin_material({'materials': [{'name': 'Milfy_White'}]})


class StripsABodyItWasNotWrittenFor(unittest.TestCase):
    """AvatarSample_A repaints 58.9% of its atlas, against mika-pink's 36.1%.

    Two of the sixteen cells at the old coarsest level were empty on this body,
    and the fill inside the hole came out at a median of [175 148 130] where
    the surviving skin averages [243 215 190]. 12.46% of the atlas the body
    actually samples ended up not skin-coloured.
    """

    BODY = os.path.join(AVATARS, 'AvatarSample_A_webp.vrm')

    @classmethod
    def setUpClass(cls):
        if not os.path.exists(cls.BODY):
            raise unittest.SkipTest('public/avatar/AvatarSample_A_webp.vrm 不在')
        raw, cls.reference = body_atlas(cls.BODY)
        cls.before = np.asarray(raw.convert('RGB')).astype(np.int32)
        out, cls.share = skin.strip(raw, cls.reference)
        cls.after = np.asarray(out.convert('RGB')).astype(np.int32)

    def test_apply_repaints_a_body_this_step_was_not_written_for(self):
        # The whole entry point, on a body whose skin material apply() could
        # not name until it read the category off it.
        out = os.path.join(tempfile.mkdtemp(), 'bare.vrm')
        share, size = skin.apply(os.path.join(AVATARS, 'AvatarSample_C_webp.vrm'), out)
        self.assertGreater(share, 0.3)
        self.assertTrue(os.path.exists(out))

    def test_the_repaint_looks_like_the_skin_it_was_taken_from(self):
        changed = (self.before != self.after).any(axis=2)
        # A sentinel against the test passing because strip() did nothing, not
        # a fact about this body: the lowest of the sixteen local bodies that
        # repaints anything substantial is mika-pink at 36.1%.
        self.assertGreater(changed.mean(), 0.3, 'nothing was repainted')
        kept = self.before[~changed].mean(axis=0)
        painted = np.median(self.after[changed], axis=0)
        self.assertLess(np.abs(painted - kept).max(), 30,
                        f'repainted {painted} against surviving {kept}')


class ReadsThisBodysOwnSkinColour(unittest.TestCase):
    """is_skin's `r > 105` was one body's palette written down.

    AvatarSample_A's dark brown top sits at [120 92 80] and passes it, so
    49,193 texels of garment stayed on the model; Vivi's at [129 100 85] left
    155,800. Neither shows up in the residue figure, because that figure asks
    is_skin whether a texel is skin and these are exactly what it gets wrong.
    So the test below asks a question that does not go through the predicate:
    how big is the largest patch that came through strip() untouched and is
    nowhere near this body's own colour.
    """

    # Far enough from a body's own skin to belong to somebody's clothing.
    FAR = 120

    DRESSED = ('AvatarSample_A_webp.vrm', 'Vivi_webp.vrm')
    GARMENTS = {'AvatarSample_A_webp.vrm': (122, 94, 81),
                'Vivi_webp.vrm': (129, 100, 85)}

    def read(self, name):
        path = os.path.join(AVATARS, name)
        if not os.path.exists(path):
            raise unittest.SkipTest(f'public/avatar/{name} 不在')
        doc, binary = glb.load(path)
        views = glb.views_of(doc, binary)
        material = skin.skin_material(doc)
        index = skin.body_image(doc, material=material)
        image = Image.open(io.BytesIO(bytes(views[doc['images'][index]['bufferView']])))
        return image, skin.skin_reference(doc, views, material)

    def test_the_reference_is_the_body_and_not_what_it_is_wearing(self):
        for name, garment in self.GARMENTS.items():
            _, reference = self.read(name)
            patch = np.full((4, 4, 3), garment, dtype=np.uint8)
            self.assertFalse(skin.is_skin(patch, reference).any(),
                             f'{name}: {garment} passed as skin')
            own = np.full((4, 4, 3), reference.round().astype(np.uint8))
            self.assertTrue(skin.is_skin(own, reference).all(),
                            f'{name}: the body\'s own colour did not pass')

    def test_the_reference_does_not_come_from_a_sleeve(self):
        # Vita is the local counterexample to reading the colour off the whole
        # arm rather than the hand: its arm bones drive a teal sleeve, and the
        # median there is [87 168 159] against the hand's [232 177 158], 145
        # apart. A reference that is not skin puts every real texel outside the
        # radius, so strip() repaints the entire atlas and leaves nothing to
        # borrow from.
        image, reference = self.read('Vita_webp.vrm')
        _, share = skin.strip(image, reference)
        self.assertLess(share, 0.9,
                        'strip repainted nearly everything, which means the '
                        "reference is not this body's skin")

    def test_nothing_clothing_sized_survives_on_a_body_it_left_dressed(self):
        for name in self.DRESSED:
            image, reference = self.read(name)
            before = np.asarray(image.convert('RGB')).astype(np.int32)
            after = np.asarray(skin.strip(image, reference)[0]
                               .convert('RGB')).astype(np.int32)
            # The whole atlas, not only the part the mesh samples: that is the
            # stricter reading of the two and it needs no UV rasterising here.
            survived = (before == after).all(axis=2)
            far = survived & (np.sqrt(((after - reference) ** 2).sum(axis=2))
                              > self.FAR)
            labels, found = ndimage.label(far)
            sizes = np.bincount(labels.ravel())
            sizes[0] = 0
            biggest = int(sizes.max()) if found else 0
            self.assertLess(biggest, skin.MIN_REGION,
                            f'{name}: {biggest} px of something not skin survived')


if __name__ == '__main__':
    unittest.main()
