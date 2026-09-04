"""Focused tests for texture colour transforms."""
import colorsys
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


def _fill(canvas, y0, y1, x0, x1, hue, sat, light=0.5):
    r, g, b = colorsys.hls_to_rgb(hue / 360.0, light, sat)
    canvas[y0:y1, x0:x1] = [r * 255, g * 255, b * 255]


class HairPaintPixelsTest(unittest.TestCase):
    """釘住 hair_paint_pixels 的邊緣（fringe）判定：色相對了還不夠，要跟核心

    連通。這是紫線修復的機制本身：Face 圖裡真正的頭皮蓋邊緣跟核心接壤，唇
    (hue 0) 跟腮紅不接壤，兩者只靠色相窗分不開（見 build.SCALP_FRINGE_TO 的
    說明），是連通性把後者留在原地。
    """

    def test_fringe_arc_only_counts_when_touching_the_core(self):
        hue_centre, window = 261.0, 45.0
        fringe_to, fringe_min_sat = 345.0, 0.12
        canvas = np.full((20, 30, 3), 0.0)
        alpha = np.full((20, 30), 255.0)
        # 核心：色相窗內、飽和夠高。
        _fill(canvas, 0, 10, 0, 10, hue_centre, 0.5)
        # 與核心相鄰的邊緣弧：色相在窗外、fringe_to 以內，緊貼著核心的右側。
        _fill(canvas, 0, 10, 10, 20, 330.0, 0.30)
        # 同樣的邊緣弧色相，但跟核心隔開一段背景（中性、低飽和），是一座孤島。
        canvas[10:20, :, :] = [128.0, 128.0, 128.0]  # the moat: low-saturation gray
        _fill(canvas, 15, 20, 20, 25, 330.0, 0.30)

        core, fringe = customise.hair_paint_pixels(
            canvas, alpha, hue_centre, window,
            fringe_to=fringe_to, fringe_min_sat=fringe_min_sat)

        self.assertEqual(int(core.sum()), 100, '核心區塊沒有被完整抓到')
        self.assertEqual(int(fringe.sum()), 100,
                         f'邊緣應該只有跟核心相連的那 100 px，量到 {int(fringe.sum())}')
        self.assertTrue(fringe[0:10, 10:20].all(), '相連的邊緣弧沒有全部算進去')
        self.assertFalse(fringe[15:20, 20:25].any(), '孤島邊緣弧不該被算進去')


class PaintWeightsTest(unittest.TestCase):
    """釘住 paint_weights 真的在算「這個邊緣像素比較像髮還是比較像膚」，不是回

    傳一個常數。build.blend_fringe 拿這個權重決定頭皮蓋邊緣的每個像素該混多
    少髮色、多少膚色；權重恆為 0 會讓 blend_fringe 把整圈邊緣寫成純膚色（等
    於沒有混色），而 test_skin_atlases_carry_no_hair_paint 量的是「有沒有紫」
    不是「混色比例對不對」，量不到這件事——收據見
    evidence/mutations-0904-blonde.md 記的第三方防線缺口。
    """

    def test_weight_tracks_position_between_skin_and_core_colour(self):
        skin = np.array([200.0, 150.0, 140.0])
        hair = np.array([230.0, 100.0, 220.0])
        canvas = np.tile(skin, (20, 20, 1))
        alpha = np.full((20, 20), 255.0)
        core = np.zeros((20, 20), dtype=bool)
        core[2:5, 2:5] = True
        canvas[core] = hair
        fringe = np.zeros((20, 20), dtype=bool)
        # 三個邊緣像素，各自寫成沿「膚→髮」那條線不同比例的混色，跟核心不相鄰
        # 也沒關係：paint_weights 只吃 core／fringe 兩個遮罩，連通性是
        # hair_paint_pixels 那一步的事。
        spots = {(10, 5): 0.0, (10, 10): 0.5, (10, 15): 1.0}
        for (y, x), w in spots.items():
            fringe[y, x] = True
            canvas[y, x] = skin + w * (hair - skin)

        weight = customise.paint_weights(canvas, alpha, core, fringe, ring=6)

        for (y, x), w in spots.items():
            self.assertAlmostEqual(
                float(weight[y, x]), w, places=2,
                msg=f'({y},{x}) 應該是膚／髮混色比例 {w}，量到 {weight[y, x]:.3f}')
        outside = ~fringe
        self.assertTrue(np.all(weight[outside] == 0), '邊緣以外的權重應該恆為 0')


if __name__ == '__main__':
    unittest.main()
