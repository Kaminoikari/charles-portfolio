"""Regression checks for the two appearance defects visible in the browser."""
import io
import json
import os
import sys
import unittest

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

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

        v3-v6 的實況：twintail 把 tie 以下的後髮整片收到兩側，枕骨帶
        (y 1.36-1.50) 中央的頭骨 z 0.124 高過髮面 0.120，背視圖裸出鑰匙孔形
        皮膚。修法是 twintail 依離體表距離分流、貼頭皮那層留在原位；本測試對
        「任何 Hair_* 部件的聯集」量，換哪一種實作補上都不會誤紅，髮被拿走或
        沉進頭骨就會紅。覆蓋量本身由
        test_curtain_keeps_a_layer_lying_on_the_skull 釘得更緊。
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
        54%；皇冠質心 z 修正前 -0.032、修正後 -0.052（前移到瀏海坡上）。
        """
        crown = self.part_points('Acc_Crown')
        ear = self.part_points('Hair_Ear_R')
        overlap = max(0.0, min(crown[:, 0].max(), ear[:, 0].max())
                      - max(crown[:, 0].min(), ear[:, 0].min()))
        self.assertLessEqual(overlap / float(np.ptp(ear[:, 0])), 0.60)
        self.assertLessEqual(float(crown[:, 2].mean()), -0.045)

    def curtain(self):
        """兩條雙馬尾的頂點、關節與權重，合併成一份。"""
        pos, joints, weights = [], [], []
        for name in ('Hair_Twintail_L', 'Hair_Twintail_R'):
            part = self.manifest['parts'][name]
            mesh = next(m for m in self.doc['meshes'] if m.get('name') == part['mesh'])
            for primitive in part['primitives']:
                attributes = mesh['primitives'][primitive]['attributes']
                pos.append(glb.read_accessor(self.doc, self.views, attributes['POSITION']))
                joints.append(glb.read_accessor(self.doc, self.views, attributes['JOINTS_0']))
                weights.append(glb.read_accessor(self.doc, self.views, attributes['WEIGHTS_0']))
        return (np.concatenate(pos), np.concatenate(joints), np.concatenate(weights))

    def head_slot(self):
        node = next(bone['node']
                    for bone in self.doc['extensions']['VRM']['humanoid']['humanBones']
                    if bone['bone'] == 'head')
        return self.doc['skins'][0]['joints'].index(node)

    def test_curtain_keeps_a_layer_lying_on_the_skull(self):
        """雙馬尾不能把貼著頭骨那一層一起收到側面去。

        使用者回報「後腦勺像禿頭」「後腦顏色跟其他區塊有落差」。真因是
        twintail.apply 把 tie（y 1.45）以下的後髮無差別收成兩束，連貼在頭皮上
        的那一層一起帶走，枕骨因此從 y[1.40,1.478] 裸出一塊皮膚。真髮的雙馬尾
        是「髮從頭皮往上收到綁點，綁點以下才垂下來」，貼頭皮那段仍然在頭上。

        這裡釘的是那一層還在：枕骨高度帶內、離體表 20mm 以內的髮簾頂點數量。
        拿掉 twintail 的 free 閘門，這些頂點會被拉到兩側，數量塌掉轉紅。
        """
        pos, _, _ = self.curtain()
        skull = self.part_points('Body_Skin')
        band = pos[(pos[:, 1] >= 1.36) & (pos[:, 1] <= 1.50)]
        close = cKDTree(skull).query(band)[0] <= 0.020
        self.assertGreaterEqual(
            int(close.sum()), 600,
            f'枕骨高度帶內只剩 {int(close.sum())} 個貼頭骨的髮簾頂點')

    def tail_slots(self):
        joints = self.doc['skins'][0]['joints']
        return [joints.index(index) for index, node in enumerate(self.doc['nodes'])
                if str(node.get('name', '')).startswith('HairTail') and index in joints]

    def test_scalp_layer_carries_no_tail_weight(self):
        """留在頭皮上的髮不能殘留尾巴骨的權重，否則尾巴一甩它就跟著飛。

        位置與權重是兩道各自獨立的防禦：只凍結位置而不改權重，這片髮在靜止畫
        面上是對的，一播動畫就從頭上被拖走。基底檔裡貼頭層有 36 個頂點掛著舊
        彈簧鏈（最大 8.4%），那條鏈在轉換後就是尾巴鏈，尾尖位移 172mm，8.4%
        等於 14mm 的漂移。twintail 因此把 free<1 的頂點按 free 重新混權重。
        這條只看權重，位置閘門被拿掉時它仍然是綠的，兩條各自對應各自的
        mutation。
        """
        pos, joints, weights = self.curtain()
        skull = self.part_points('Body_Skin')
        on_skull = cKDTree(skull).query(pos)[0] <= 0.020
        tail = (weights * np.isin(joints, self.tail_slots())).sum(axis=1)[on_skull]
        self.assertGreaterEqual(int(on_skull.sum()), 600, '貼頭層本身就不見了')
        self.assertLess(float(tail.max()), 0.005,
                        f'貼頭層還有 {(tail > 0.005).sum()} 個頂點掛在尾巴骨上，'
                        f'最大 {tail.max():.3f}')

    def test_crown_gold_stays_warm_but_not_amber(self):
        """皇冠的兩種對立退化各釘一邊，指標是 factor 的紅藍差。

        太淡（使用者回報「顏色太淡」）：褪色版 (0.997,0.866,0.759) 差 0.24，
        是 numpy 空間解色被 ACES 洗白的結果。太橘（round-4 reviewer 抓到）：
        線性值誤當 sRGB factor 烘焙，(0.999,0.600,0.360) 差 0.64，畫面是飽和
        琥珀。正解過 linear→sRGB 後 Gold 差 0.371、GoldInner 差 0.376——迴圈
        涵蓋兩個材質，門檻其實咬在較低的那個上。帶取 [0.30, 0.45]，兩種退化
        各自轉紅。
        """
        materials = self.textured_materials('Milfy_Gold_ramp')
        self.assertTrue(materials, '找不到 Milfy_Gold_ramp 的材質')
        for material, _ in materials:
            base = material['pbrMetallicRoughness']['baseColorFactor'][:3]
            spread = max(base) - min(base)
            self.assertGreaterEqual(spread, 0.30, f'{material["name"]} 乘色為 {base}')
            self.assertLessEqual(spread, 0.45, f'{material["name"]} 乘色為 {base}')

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
