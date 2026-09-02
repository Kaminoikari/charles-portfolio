"""Focused tests for texture colour transforms."""
import io
import os
import sys
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import customise  # noqa: E402


class RetoneTest(unittest.TestCase):
    def test_retone_can_reduce_texture_lightness(self):
        source = np.full((2, 2, 4), [226, 190, 179, 255], dtype=np.uint8)
        encoded = io.BytesIO()
        Image.fromarray(source).save(encoded, format='PNG')
        doc = {'images': [{'name': 'skin', 'bufferView': 0}]}
        views = [bytearray(encoded.getvalue())]

        customise.retone(doc, views, 'skin', (210, 168, 154))

        result = np.asarray(Image.open(io.BytesIO(bytes(views[0]))).convert('RGBA'))
        median = np.median(result[..., :3], axis=(0, 1))
        np.testing.assert_allclose(median, [210, 168, 154], atol=2)


if __name__ == '__main__':
    unittest.main()
