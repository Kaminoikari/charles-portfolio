"""Regression checks for the two appearance defects visible in the browser."""
import io
import json
import os
import sys
import unittest

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402


BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(BASE, '..', '..', 'public', 'avatar', 'mika-milfy.vrm')
MANIFEST = MODEL.replace('.vrm', '.parts.json')
# 2026-09-02 隨 SKIN_TARGET (222,178,165)→(244,190,172) 重校：上限給 +4 容差，
# 下限釘住「使用者要求的提亮確實有發生」，回退到舊值 222 會低於下限轉紅。
SKIN_MAX_CHANNEL = 248
SKIN_MIN_CHANNEL = 238
SKIN_MIN_CHROMA = 40
HAIR_MAX_CHANNEL = 208
HAIR_MIN_CHROMA = 40
SKIN_FACTOR_MAX = 0.96
HAIR_FACTOR_MAX = 0.92
MATERIAL_FACTOR_MIN_CHROMA = 0.08
THIGH_BAND_DIAMETER_RATIO_MIN = 1.0
THIGH_BAND_DIAMETER_RATIO_MAX = 1.15


class AppearanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc, binary = glb.load(MODEL)
        cls.views = glb.views_of(cls.doc, binary)
        with open(MANIFEST, encoding='utf-8') as manifest_file:
            cls.manifest = json.load(manifest_file)

    def texture_median(self, name):
        image = next(image for image in self.doc['images'] if image.get('name') == name)
        rgba = np.asarray(
            Image.open(io.BytesIO(bytes(self.views[image['bufferView']]))).convert('RGBA'),
            dtype=np.float64,
        )
        return np.median(rgba[..., :3][rgba[..., 3] > 200], axis=0)

    def part_points(self, name, material_name=None):
        part = self.manifest['parts'][name]
        mesh = next(mesh for mesh in self.doc['meshes'] if mesh.get('name') == part['mesh'])
        return np.concatenate([
            glb.read_accessor(
                self.doc,
                self.views,
                mesh['primitives'][primitive]['attributes']['POSITION'],
            )
            for primitive in part['primitives']
            if material_name is None
            or self.doc['materials'][mesh['primitives'][primitive]['material']]['name']
            == material_name
        ])

    def textured_materials(self, image_prefix):
        image_indices = {
            index for index, image in enumerate(self.doc['images'])
            if image.get('name', '').startswith(image_prefix)
        }
        texture_indices = {
            index for index, texture in enumerate(self.doc['textures'])
            if texture.get('source') in image_indices
        }
        return [
            (material, self.doc['extensions']['VRM']['materialProperties'][index])
            for index, material in enumerate(self.doc['materials'])
            if material.get('pbrMetallicRoughness', {})
            .get('baseColorTexture', {}).get('index') in texture_indices
        ]

    def assert_material_tone(self, image_prefix, max_factor):
        materials = self.textured_materials(image_prefix)
        self.assertTrue(materials, f'找不到 {image_prefix} 的材質')
        for material, properties in materials:
            base = material['pbrMetallicRoughness']['baseColorFactor'][:3]
            vectors = properties['vectorProperties']
            color = vectors['_Color'][:3]
            shade = vectors['_ShadeColor'][:3]
            self.assertEqual(base, color, material['name'])
            self.assertEqual(base, shade, material['name'])
            has_visible_tone = (max(base) <= max_factor
                                and max(base) - min(base)
                                >= MATERIAL_FACTOR_MIN_CHROMA)
            self.assertTrue(has_visible_tone, f'{material["name"]} 乘色為 {base}')

    def test_skin_texture_keeps_visible_tone_under_mtoon_lighting(self):
        median = self.texture_median('F00_000_00_Body_00')
        has_natural_tone = (SKIN_MIN_CHANNEL <= float(median.max()) <= SKIN_MAX_CHANNEL
                            and float(np.ptp(median)) >= SKIN_MIN_CHROMA)
        self.assertTrue(has_natural_tone, f'膚色中位數為 {median}')

    def test_back_skull_is_covered_by_hair(self):
        """後腦骨面凸出髮面就是「禿頭」，這裡釘機制不釘某一片髮的存在。

        v3-v5 的實況：Hair_Back 只剩辮底一圈，枕骨帶 (y 1.36-1.50) 中央的頭骨
        z 0.124 高過髮面 0.120，背視圖從髮際到頭頂裸出鑰匙孔形皮膚。修法是
        Hair_Nape 掃髮帽；本測試對「任何 Hair_* 部件的聯集」量，帽被改名或
        換實作都不會誤紅，帽被拿掉或沉進頭骨就會紅。
        """
        skull = self.part_points('Body_Skin')
        hair = np.concatenate([
            self.part_points(name) for name in self.manifest['parts']
            if name.startswith('Hair_')
        ])
        for y_low in (1.36, 1.40, 1.44, 1.48):
            band = (
                lambda p: p[(p[:, 1] >= y_low) & (p[:, 1] < y_low + 0.04)
                            & (p[:, 2] > 0.0) & (np.abs(p[:, 0]) < 0.03)]
            )
            skull_z = float(band(skull)[:, 2].max())
            hair_z = float(band(hair)[:, 2].max())
            self.assertGreaterEqual(
                hair_z, skull_z + 0.002,
                f'y {y_low:.2f} 帶：髮面 z {hair_z:.3f} 沒有蓋過頭骨 z {skull_z:.3f}')

    def test_crown_rides_the_bangs_not_the_ear(self):
        """使用者指出皇冠壓住右熊耳太多；修正後它騎在瀏海側。

        釘的是相對關係：皇冠對耳盤的前視圖 x 重疊，修正前佔耳寬 84%、修正後
        54%；皇冠質心 z 修正前 -0.032、修正後 -0.057（前移到瀏海坡上）。
        """
        crown = self.part_points('Acc_Crown')
        ear = self.part_points('Hair_Ear_R')
        overlap = max(0.0, min(crown[:, 0].max(), ear[:, 0].max())
                      - max(crown[:, 0].min(), ear[:, 0].min()))
        self.assertLessEqual(overlap / float(np.ptp(ear[:, 0])), 0.60)
        self.assertLessEqual(float(crown[:, 2].mean()), -0.045)

    def test_crown_gold_stays_warm(self):
        """皇冠曾在真引擎的 ACES＋打光下渲染成近白（使用者回報「顏色太淡」）。

        病灶是 factor 的紅藍差太小：褪色前 (0.997,0.866,0.759) 差 0.24，
        解完後 (0.999,0.600,0.360) 差 0.64。門檻取 0.5，回退舊值轉紅。
        """
        materials = self.textured_materials('Milfy_Gold_ramp')
        self.assertTrue(materials, '找不到 Milfy_Gold_ramp 的材質')
        for material, _ in materials:
            base = material['pbrMetallicRoughness']['baseColorFactor'][:3]
            self.assertGreaterEqual(max(base) - min(base), 0.5,
                                    f'{material["name"]} 乘色為 {base}')

    def test_hair_texture_keeps_visible_tone_under_mtoon_lighting(self):
        median = self.texture_median('F00_000_Hair_00_01')
        has_natural_tone = (float(median.max()) <= HAIR_MAX_CHANNEL
                            and float(np.ptp(median)) >= HAIR_MIN_CHROMA)
        self.assertTrue(has_natural_tone, f'髮色中位數為 {median}')

    def test_skin_material_preserves_tone_after_live_exposure(self):
        self.assert_material_tone('F00_000_00_Face_00', SKIN_FACTOR_MAX)
        self.assert_material_tone('F00_000_00_Body_00', SKIN_FACTOR_MAX)

    def test_hair_material_preserves_tone_after_live_exposure(self):
        self.assert_material_tone('F00_000_Hair_00_', HAIR_FACTOR_MAX)

    def test_thigh_band_diameter_matches_the_thigh(self):
        band = self.part_points('Acc_Bandage_Thigh', 'Mellow_Leg_Acc')
        skin = self.part_points('Body_Skin')
        side = np.sign(float(np.median(band[:, 0])))
        same_thigh = (
            (np.sign(skin[:, 0]) == side)
            & (skin[:, 1] >= band[:, 1].min())
            & (skin[:, 1] <= band[:, 1].max())
        )
        thigh = skin[same_thigh]
        band_diameter = np.ptp(band[:, [0, 2]], axis=0)
        thigh_diameter = np.ptp(thigh[:, [0, 2]], axis=0)
        ratio = band_diameter / thigh_diameter
        is_fitted = ((ratio >= THIGH_BAND_DIAMETER_RATIO_MIN)
                     & (ratio <= THIGH_BAND_DIAMETER_RATIO_MAX)).all()
        self.assertTrue(is_fitted, f'腿帶／大腿直徑比為 {ratio}')


if __name__ == '__main__':
    unittest.main()
