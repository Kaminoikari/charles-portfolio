"""The body texture repaint, on bodies other than the one it was written for.

skin.strip() finds the clothing VRoid painted into the skin atlas and fills it
back in from the skin that survived. Both halves carried a constant that was
right about one body: the pull-push pyramid stopped after nine halvings, which
is enough only when no hole swallows a coarse cell whole.
"""
import io
import os
import sys
import unittest

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb        # noqa: E402
import partition  # noqa: E402
import skin       # noqa: E402

AVATARS = os.path.join(HERE, '..', '..', 'public', 'avatar')


def body_atlas(path):
    """(the body's skin atlas as a PIL image, its material name)."""
    doc, binary = glb.load(path)
    views = glb.views_of(doc, binary)
    name = next(m['name'] for m in doc['materials']
                if partition.vroid_category(m.get('name', ''))[:2] == ('Body', 'SKIN'))
    index = skin.body_image(doc, material=name)
    return Image.open(io.BytesIO(bytes(views[doc['images'][index]['bufferView']]))), name


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
        raw, _ = body_atlas(cls.BODY)
        cls.before = np.asarray(raw.convert('RGB')).astype(np.int32)
        out, cls.share = skin.strip(raw)
        cls.after = np.asarray(out.convert('RGB')).astype(np.int32)

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


if __name__ == '__main__':
    unittest.main()
