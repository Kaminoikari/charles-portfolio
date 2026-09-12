"""Focused tests for texture colour transforms."""
import colorsys
import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import mock_open, patch

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import customise  # noqa: E402


class ApplyPaletteTest(unittest.TestCase):
    """The serialized sidecar must describe the serialized model's colours."""
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.doc = {
            'asset': {'version': '2.0'}, 'accessors': [], 'bufferViews': [],
            'materials': [{'name': 'Cloth', 'pbrMetallicRoughness': {
                'baseColorFactor': [0.8, 0.4, 0.2, 1.0]}}],
            'extensions': {'VRM': {'materialProperties': [{'name': 'Cloth',
                'vectorProperties': {'_Color': [0.8, 0.4, 0.2, 1.0],
                                     '_ShadeColor': [0.4, 0.2, 0.1, 1.0]}}]}},
        }
        views = []
        positions = customise.glb.add_accessor(self.doc, views, np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32))
        indices = customise.glb.add_accessor(self.doc, views, np.array([0, 1, 2], dtype=np.uint16))
        self.doc['meshes'] = [{'name': 'Body', 'primitives': [{'attributes': {'POSITION': positions},
            'indices': indices, 'material': 0, 'extras': {'part': 'ClothPart'}}]}]
        self.source = self.directory / 'source.vrm'
        customise.glb.save(str(self.source), self.doc, customise.glb.rebuild(self.doc, views))
        self.manifest = self.directory / 'source.parts.json'
        data = {'parts': {'ClothPart': {'mesh': 'Body', 'primitives': [0]}},
                'palette': {'Cloth': {'base': [0.8, 0.4, 0.2],
                                     'shade': [0.4, 0.2, 0.1], 'parts': ['ClothPart']}}}
        with self.manifest.open('w') as handle:
            json.dump(data, handle)

    def apply_tint(self):
        model = self.directory / 'result.vrm'
        sidecar = self.directory / 'result.parts.json'
        customise.apply(str(self.source), str(model), str(self.manifest),
                        tints=[('Cloth', [0.2, 0.8, 0.4])], manifest_out=str(sidecar))
        with sidecar.open() as handle:
            manifest = json.load(handle)
        return customise.glb.load(str(model))[0], manifest

    def test_written_palette_base_matches_written_gltf(self):
        model, manifest = self.apply_tint()
        self.assertEqual(manifest['palette']['Cloth']['base'],
                         model['materials'][0]['pbrMetallicRoughness']['baseColorFactor'][:3])

    def test_written_palette_shade_matches_written_vrm(self):
        model, manifest = self.apply_tint()
        self.assertEqual(manifest['palette']['Cloth']['shade'],
                         model['extensions']['VRM']['materialProperties'][0]['vectorProperties']['_ShadeColor'][:3])


class TintTest(unittest.TestCase):
    def setUp(self):
        self.vectors = {'_Color': [0.8, 0.4, 0.2, 0.7],
                        '_ShadeColor': [0.4, 0.1, 0.15, 0.6]}
        self.doc = {
            'materials': [{'name': 'Cloth', 'pbrMetallicRoughness': {
                'baseColorFactor': [0.8, 0.4, 0.2, 0.7]}}],
            'extensions': {'VRM': {'materialProperties': [
                {'name': 'Cloth', 'vectorProperties': self.vectors}]}},
            'meshes': [], 'accessors': [], 'bufferViews': [],
        }
        self.rgb = (0.2, 0.8, 0.4)

    def test_tint_synchronises_vrm0_lit_colour_and_preserves_alpha(self):
        customise.tint(self.doc, 'Cloth', self.rgb)

        self.assertEqual(self.vectors['_Color'], [0.2, 0.8, 0.4, 0.7])

    def test_tint_preserves_each_shade_to_lit_ratio_and_shade_alpha(self):
        customise.tint(self.doc, 'Cloth', self.rgb)

        np.testing.assert_allclose(self.vectors['_ShadeColor'], [0.1, 0.2, 0.3, 0.6])

    def test_tint_uses_neutral_shading_for_an_originally_black_channel(self):
        self.vectors['_Color'][0] = 0.0
        self.vectors['_ShadeColor'][0] = 0.0

        customise.tint(self.doc, 'Cloth', self.rgb)

        self.assertEqual(self.vectors['_ShadeColor'][0], self.rgb[0])

    def test_tint_keeps_plain_gltf_supported(self):
        del self.doc['extensions']

        customise.tint(self.doc, 'Cloth', self.rgb)

        self.assertEqual(self.doc['materials'][0]['pbrMetallicRoughness']
                         ['baseColorFactor'], [0.2, 0.8, 0.4, 0.7])

    def test_tint_refuses_a_misaligned_vrm0_material_table(self):
        self.doc['extensions']['VRM']['materialProperties'] = []

        with self.assertRaisesRegex(SystemExit, 'materialProperties'):
            customise.tint(self.doc, 'Cloth', self.rgb)

    def test_apply_saves_the_vrm0_tint_from_the_requested_recipe(self):
        with patch.object(customise.glb, 'load', return_value=(self.doc, b'')), \
                patch('builtins.open', mock_open(read_data='{"parts": {}}')), \
                patch.object(customise.glb, 'save', return_value=0) as save:
            customise.apply('source.vrm', 'result.vrm', 'parts.json',
                            tints=[('Cloth', self.rgb)])

        written = save.call_args.args[1]
        self.assertEqual(written['extensions']['VRM']['materialProperties'][0]
                         ['vectorProperties']['_Color'], [0.2, 0.8, 0.4, 0.7])


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
    (hue 0) 跟腮紅不接壤，兩者只靠色相窗分不開（見 bodies.mika_base.SCALP_FRINGE_TO 的
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


class ReplacedTest(unittest.TestCase):
    """Which of the base body's parts an outfit takes off, resolved per body.

    make.py held five names, which are the five Mika's base has. drop_parts
    rejects a name the manifest does not have, deliberately, so a typo cannot
    quietly leave a garment on; that same refusal stopped step 2 dead on every
    body but hers. AvatarSample_C has three of the five, Vivi two, and
    Sendagaya_Shibu four including Outfit_AccessoryNeck, which this pipeline had
    never seen.
    """

    def manifest(self, **parts):
        return {'parts': {name: {'deletable': deletable}
                          for name, deletable in parts.items()}}

    def test_the_five_names_make_py_used_to_hold(self):
        m = self.manifest(Body_Skin=False, Face=False, Outfit_Top=True,
                          Outfit_Bottom=True, Outfit_Shoes=True,
                          Acc_HairOrnament=True, Acc_HairClip_Base=True,
                          Hair_Bangs=True, Hair_Back=True)
        self.assertEqual(customise.replaced(m, ('Outfit_', 'Acc_')),
                         ['Acc_HairClip_Base', 'Acc_HairOrnament',
                          'Outfit_Bottom', 'Outfit_Shoes', 'Outfit_Top'])

    def test_a_body_without_a_lower_garment_is_not_asked_for_one(self):
        # Vivi's Body.baked carries Tops and Shoes and no Bottoms at all.
        m = self.manifest(Body_Skin=False, Outfit_Top=True, Outfit_Shoes=True)
        self.assertEqual(customise.replaced(m, ('Outfit_', 'Acc_')),
                         ['Outfit_Shoes', 'Outfit_Top'])

    def test_a_garment_this_pipeline_has_never_seen_still_comes_off(self):
        m = self.manifest(Body_Skin=False, Outfit_AccessoryNeck=True)
        self.assertEqual(customise.replaced(m, ('Outfit_',)),
                         ['Outfit_AccessoryNeck'])

    def test_a_part_the_manifest_locks_is_never_asked_for(self):
        # drop_parts raises on a locked part, so handing it one turns a body
        # this step could have dressed into a refusal.
        m = self.manifest(Outfit_Top=True, Outfit_Skin=False)
        self.assertEqual(customise.replaced(m, ('Outfit_',)), ['Outfit_Top'])

    def test_hair_and_face_are_left_alone(self):
        m = self.manifest(Face=False, Hair_Bangs=True, Hair_BodyBack=True,
                          Outfit_Top=True)
        self.assertEqual(customise.replaced(m, ('Outfit_', 'Acc_')), ['Outfit_Top'])


if __name__ == '__main__':
    unittest.main()
