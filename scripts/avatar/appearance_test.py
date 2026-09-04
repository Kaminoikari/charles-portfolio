"""Regression checks for the two appearance defects visible in the browser."""
import colorsys
import io
import json
import os
import sys
import unittest

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import build  # noqa: E402
import customise  # noqa: E402
import glb  # noqa: E402
import measure  # noqa: E402
import render  # noqa: E402

# glTF 的 REPEAT；取樣要照每張貼圖自己宣告的 wrap 走。
REPEAT = 10497


BASE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(BASE, '..', '..', 'public', 'avatar', 'mika-milfy-3.vrm')
# 建置的輸入。baseline.vrm 與它位元組相同，但那份不進版控，所以測試讀這一份。
SOURCE_MODEL = os.path.join(BASE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')
MANIFEST = MODEL.replace('.vrm', '.parts.json')
# 2026-09-03 依參考圖重解：膚與髮的貼圖從單邊上限改成雙側帶，因為這一輪的缺陷
# 是「太暖」，而只有下限的斷言對太暖完全沒有意見。帶子釘的是貼圖，實機色由
# colourprobe 量（RESULT.txt「第六版」），兩者的對應關係是 MToon 乘色與打光。
#
# 上一版的常數（膚 SKIN_TARGET (244,190,172)、髮 SAT 0.75／LIFT 0）兩個界線都踩
# 到。寫出來的貼圖中位數是膚 Body (244,190,171)、髮 01 (206,185,159)、髮 02
# (203,183,158)：最亮通道 244／206 低於下限，暖度 73／47／45 高於上限。撞下限的
# mutation 是 M6（膚，log 印 244）與 M8（髮，log 印 01 的 206）；把兩端拆開驗的
# 是 M7（膚，同樣亮但偏橘，暖度 73）與 M9（髮，SAT 拉到 1.20，暖度 43），兩者只
# 撞暖度上限。相反方向——把貼圖洗成純白——暖度是 0，低於
# 下限，這一條是算術，沒有另外建模型去驗。收據 evidence/mutations-0903c.md。
#
# 亮度只留下限：這一輪往上走，而往上的盡頭是引擎自己的天花板（純白反照率在實機
# 上是 (226,229,229)），不必再訂一個上限去猜它。
SKIN_MIN_CHANNEL = 245
SKIN_WARMTH = (22, 48)      # 解出來 39（Body）／28（Face），舊值 72
HAIR_MIN_CHANNEL = 215
HAIR_WARMTH = (14, 30)      # 解出來 24（01）／23（02），舊值 45
# 臉部皮膚（排除頭皮色塊）的亮度 p10–p90 下限。之前這個數是 0.30，量的是整張臉
# 部貼圖，而它的 p10 一直是那塊深紫頭皮 (78, 46, 161)，所以 0.408 這個「對比」講
# 的是頭皮有多暗，不是嘴唇有多清楚。頭皮解到髮色之後同一個量法掉到 0.122，這條就
# 在一個與五官無關的理由下轉紅。
#
# 現在的量法排除頭皮。出貨是 0.102；把 customise.CLIP_BUDGET 改成 0（停用加法位
# 移、強制走 lift 0.58）重建是 0.0431，唇就不見了。0.075 夾在中間，離出貨 1.36
# 倍、離退化 1.74 倍。
FACE_CONTRAST_MIN = 0.075
# 髮的同一件事。壓平色帶的手法決定要付多少：逐欄去趨勢（現行）留下 01 = 0.037、
# 02 = 0.102；換成「整張往中位數收 85%」是 0.014／0.022，收 100% 是 0.000——一張
# 純色髮圖，而它的中位數、暖度、色帶差全部更漂亮，所有以中位數為指標的斷言都會
# 更容易過。0.025 夾在 0.014 與 0.037 之間（下側 1.8 倍、上側 1.5 倍）。再往上會
# 卡死 01，再往下就擋不住整張壓平那一種寫法。
HAIR_CONTRAST_MIN = 0.025
SKIN_FACTOR_MAX = 0.96
HAIR_FACTOR_MAX = 0.92
MATERIAL_FACTOR_MIN_CHROMA = 0.08
# 髮片貼圖沿 v 從髮根走到髮梢，VRoid 把它畫成「根暖梢淡」。枕骨採到 v≈0.09、
# 髮髻與馬尾採到 v≈0.31，兩端差多少就是後腦那塊色差有多明顯。這裡量的是貼圖
# 取樣值：把 HAIR_FLATTEN_BLOCKS 關掉重建，貼頭層暖度 40、自由段 16，差 24，實
# 機上就是使用者看到的那塊橘色補丁；現況是 23 對 23，差 0。上限 12 夾在兩者中
# 間，離壞值有一倍。
HAIR_WARMTH_GAP_MAX = 12.0
# 同一條色帶有暖度與明度兩個面向，_flatten_v 對飽和與明度各去一次趨勢，所以要
# 兩個上限。只留暖度那個的話，拿掉明度那一行仍然全綠（M3），而畫面上枕骨與髮
# 梢差 0.065 的明度，是一條看得見的亮暗帶。拿掉明度那一行量到 0.065，現況
# 0.000，上限取 0.02。
HAIR_LIGHTNESS_GAP_MAX = 0.02
# 臉與身體是兩張貼圖、兩個材質，接縫橫過脖子。retone 把兩者解到同一個 SKIN_TARGET
# 就是為了讓這條縫看不出來，但那個設計本身沒有守衛：把其中一張換個目標重建，所有
# 以「單張貼圖中位數」為指標的斷言都還是綠的。基底模型的縫兩側是 ΔE 15.77（臉
# (228,144,147.5) 對身 (189,112,133)），出貨是 1.04（臉 (251,208,196.5) 對身
# (251,206,194)）。上限 3.0 夾在中間。這兩個數字取的是中位數的**浮點值**，與斷
# 言評估的是同一個量；把中位數截斷成整數再算會得到 0.97 與 15.93，那是另一種
# 量。失敗訊息也印到小數一位，讀者拿訊息重算得到的就是斷言用的那個數。
SEAM_DELTA_E_MAX = 3.0
# 頭皮色塊：VRoid 把一塊髮色頭皮畫進臉的貼圖，讓髮片分岔時露出的是頭髮不是皮
# 膚。它住在膚色貼圖裡，所以每一個「把這張當皮膚處理」的步驟都會順手帶走它：
# 2026-09-03 的建置用膚色解去轉它，金髮底下留下一塊亮紫，從每一道髮縫透出來。
# 量的是這塊色塊的中位數對髮色中位數的 ΔE。壞掉那版是 66.11（頭皮
# (143,51,230) 對髮 (231,214,196)），修好是解到髮色上。上限 12 給算圖與壓縮留
# 餘裕，離壞值有五倍。
NECK_TO_FACE_DELTA_E_MAX = 4.0
# 「在縫上」除了要離另一個網格近，還要離縫的高度近，單位公尺。縫是喉嚨上的一圈，
# 而這兩張皮膚在頭部另有一段互相貼著的幾何，只問距離會把那一段一起算進來。
SEAM_BAND = 0.02
# 頭皮色塊對髮色的 ΔE 上限。出貨 1.23。兩種退化各在帶外：沒解到髮色時它留在原
# 髮色的紫上（ΔE 66），而被別的步驟塗成膚色時是 ΔE 8.85——後者正是 2026-09-03 發
# 生過的事（接縫環的遮罩選錯，把頭皮一起攤平成膚色），而當時門檻 12.0 讓它靜靜地
# 過了。5.0 離出貨 4 倍、離「塗成膚色」1.8 倍。
SCALP_TO_HAIR_DELTA_E_MAX = 5.0
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

    def texture_rgba(self, name):
        image = next(image for image in self.doc['images'] if image.get('name') == name)
        return np.asarray(
            Image.open(io.BytesIO(bytes(self.views[image['bufferView']]))).convert('RGBA'),
            dtype=np.float64,
        )

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

    def assert_texture_band(self, name, min_channel, warmth):
        """貼圖中位數要落在「夠亮」且「暖度在帶內」的雙側帶裡。

        暖度用 R−B。這一輪使用者問的是「膚色跟髮色跟參考圖一樣嗎」，量出來不一
        樣的地方正是暖度：膚在實機上 R−B 43、參考 17。單邊的亮度下限對這件事沒
        有意見，所以帶子必須兩側都有。
        """
        median = self.texture_median(name)
        warm = float(median[0] - median[2])
        self.assertGreaterEqual(float(median.max()), min_channel,
                                f'{name} 中位數 {median}，最亮通道太暗')
        self.assertGreaterEqual(warm, warmth[0],
                                f'{name} 中位數 {median}，暖度 {warm:.0f} 太低（洗白）')
        self.assertLessEqual(warm, warmth[1],
                             f'{name} 中位數 {median}，暖度 {warm:.0f} 太高（偏橘）')

    def test_skin_texture_keeps_visible_tone_under_mtoon_lighting(self):
        self.assert_texture_band('F00_000_00_Body_00', SKIN_MIN_CHANNEL, SKIN_WARMTH)
        self.assert_texture_band('F00_000_00_Face_00', SKIN_MIN_CHANNEL, SKIN_WARMTH)

    def test_scalp_cap_wears_the_hair_colour(self):
        """臉的貼圖裡那塊頭皮要是髮色，不是上一任髮色。

        它從髮縫透出來，所以差多少就有多明顯。壞掉那版是紫的，因為 retone 用膚
        色解轉了整張臉的貼圖，連這塊一起。

        遮罩取自**輸入模型**（public/avatar/mika-pink.vrm，與 baseline.vrm 位元
        組相同），不是出貨檔：修好之後那塊色塊不再落在原髮色的色相窗裡，拿出貨
        檔自己找就找不到它，而「找不到」與「已經修好」在斷言裡不能是同一件事。
        """
        source_doc, source_binary = glb.load(SOURCE_MODEL)
        source_views = glb.views_of(source_doc, source_binary)
        source_face = customise.image_rgba(source_doc, source_views,
                                           'F00_000_00_Face_00')
        scalp = customise.scalp_pixels(source_face[..., :3], source_face[..., 3],
                                       build.SCALP_HUE, build.SCALP_WINDOW)
        self.assertGreater(int(scalp.sum()), 10000, '輸入模型裡找不到頭皮色塊')
        shipped = self.texture_rgba('F00_000_00_Face_00')
        self.assertEqual(shipped.shape[:2], source_face.shape[:2],
                         '兩張貼圖尺寸不同，遮罩對不上')
        cap = np.median(shipped[..., :3][scalp], axis=0)
        hair = self.hair_median()
        gap, _ = measure.delta_e(cap, hair)
        self.assertLessEqual(
            gap, SCALP_TO_HAIR_DELTA_E_MAX,
            f'頭皮 {tuple(round(float(v), 1) for v in cap)}、'
            f'髮色 {tuple(round(float(v), 1) for v in hair)}，ΔE {gap:.2f}')

    def hair_median(self):
        """六張髮圖不透明像素合起來的中位數。"""
        pool = []
        for i in range(1, 7):
            rgba = self.texture_rgba(f'F00_000_Hair_00_0{i}')
            pool.append(rgba[..., :3][rgba[..., 3] > 200])
        return np.median(np.concatenate(pool, axis=0), axis=0)

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

        拔掉權重改綁只紅這一條（收據 evidence/mutations-0903a.md 的 M2）；拔
        掉位置閘門會兩條都紅，因為這條的取樣集合「離體表 20mm 以內」在整片髮
        被搬走之後就塌了。兩道防禦仍各有專屬 mutation，不是互相遮蔽。

        末尾那句正向對照是防空轉：`tail_slots()` 靠節點名前綴找骨頭，前綴一改
        就回空 list，`np.isin(..., [])` 全 False，尾巴權重恆為 0，這條會綠給你
        看。所以同時要求「自由段確實掛在尾巴骨上」。
        """
        pos, joints, weights = self.curtain()
        skull = self.part_points('Body_Skin')
        gap = cKDTree(skull).query(pos)[0]
        slots = self.tail_slots()
        tail = (weights * np.isin(joints, slots)).sum(axis=1)
        on_skull = gap <= 0.020
        self.assertGreaterEqual(int(on_skull.sum()), 600, '貼頭層本身就不見了')
        self.assertLess(float(tail[on_skull].max()), 0.005,
                        f'貼頭層還有 {(tail[on_skull] > 0.005).sum()} 個頂點掛在'
                        f'尾巴骨上，最大 {tail[on_skull].max():.3f}')
        free = gap >= 0.035
        self.assertGreaterEqual(float(np.median(tail[free])), 0.9,
                                f'自由段的尾巴權重中位數只有 '
                                f'{np.median(tail[free]):.3f}，'
                                f'尾巴骨槽位認錯了（找到 {len(slots)} 個）')

    def hair_surface_colour(self, uv):
        """把一組髮片 UV 取樣進髮色貼圖，回傳每個頂點的 RGB。

        取樣要跟著取樣器的 wrap 走。髮片 UV 跑到 u≈1.75，這張圖宣告 REPEAT，
        夾住取樣會取到整條圖的邊緣，量出來的顏色跟畫面上不是同一個東西。
        """
        material = next(m for m in self.doc['materials']
                        if m['name'] == 'F00_000_Hair_00_HAIR_02')
        texture = self.doc['textures'][
            material['pbrMetallicRoughness']['baseColorTexture']['index']]
        image = self.doc['images'][texture['source']]
        rgba = np.asarray(
            Image.open(io.BytesIO(bytes(self.views[image['bufferView']]))).convert('RGB'),
            dtype=np.float64,
        )
        height, width = rgba.shape[:2]
        samplers = self.doc.get('samplers', [])
        index = texture.get('sampler')
        entry = samplers[index] if index is not None and index < len(samplers) else {}
        column = (uv[:, 0] * width).astype(int)
        row = (uv[:, 1] * height).astype(int)
        column = (column % width if entry.get('wrapS', REPEAT) == REPEAT
                  else np.clip(column, 0, width - 1))
        row = (row % height if entry.get('wrapT', REPEAT) == REPEAT
               else np.clip(row, 0, height - 1))
        return rgba[row, column]

    def curtain_uv(self):
        """兩條雙馬尾的頂點與 UV，只取 HAIR_02 那個材質的圖元。"""
        pos, uv = [], []
        for name in ('Hair_Twintail_L', 'Hair_Twintail_R'):
            part = self.manifest['parts'][name]
            mesh = next(m for m in self.doc['meshes'] if m.get('name') == part['mesh'])
            for primitive in part['primitives']:
                entry = mesh['primitives'][primitive]
                if self.doc['materials'][entry['material']]['name'] \
                        != 'F00_000_Hair_00_HAIR_02':
                    continue
                pos.append(glb.read_accessor(self.doc, self.views,
                                             entry['attributes']['POSITION']))
                uv.append(glb.read_accessor(self.doc, self.views,
                                            entry['attributes']['TEXCOORD_0']))
        return np.concatenate(pos), np.concatenate(uv)

    def test_hair_reads_as_one_tone_from_scalp_to_tail(self):
        """後腦跟四周的髮不能是兩種顏色。

        使用者兩次回報「後腦勺的髮色非常不均勻」。真因不在幾何：VRoid 的髮片
        貼圖沿 v 是一條根暖梢淡的漸層，而 Milfy 髮型把髮梢盤成頭頂的髮髻，於
        是同一條漸層的最暖端（枕骨，v≈0.09）和最淡端（髮髻與馬尾，v≈0.31）直
        接貼在一起。customise.hue 原本只用 unify 抹平色相，漸層原封不動地活過
        了旋轉。

        這裡量的是模型自己的取樣結果：貼頭層與自由段各自把 UV 取樣進髮色貼
        圖，比兩者的暖度（R−B）與明度。兩個都要比，因為 _flatten_v 對飽和與明
        度各去一次趨勢，只斷言暖度的話拿掉明度那一行仍然全綠。把
        build.HAIR_FLATTEN_BLOCKS 改成 0 重建，暖度差從 0 跳到 24；只拿掉飽和
        那一行是 14；只拿掉明度那一行暖度只有 8.5（過得了 12），明度差卻從
        0.000 跳到 0.065。收據 evidence/mutations-0903c.md 的 M1／M3／M4——注意
        8.5 是當時另外量的，斷言通過時不印數字，log 裡只有 M3 的 GREEN。

        這條只管「兩端一不一樣」，不管「還剩多少細節」——把整張貼圖壓成純色，它
        會給出 0 並且變綠。那一側由 test_hair_texture_keeps_its_strand_contrast
        擋（M2）。HAIR_LIFT 與 HAIR_SAT 也壓同一條色帶，互相遮蔽，它們各自的
        mutation 落在髮色帶那條測試上（M8／M9／M10）。

        取樣只走 HAIR_02，因為後腦與馬尾都是它畫的（雙馬尾那 14 個圖元全部是
        HAIR_02）。髮色帶與髮絲對比那兩條列舉的也只有 01 與 02。模型上實際用到
        的髮材質有四個：01 佔畫面 7.2%、02 佔 92.4%、04 佔 0.18%、05 佔 0.25%。
        04 取樣到的是近中性灰（整張 alpha>200 的中位數 (231,229,229)，暖度 2，
        在 HAIR_WARMTH [14,30] 之外）、05 取樣到的貼圖像
        素 alpha 全在門檻以下（等於看不見）。在 0.4% 的面積上這不構成畫面缺陷，
        所以刻意不擴大列舉；但守衛釘的是「這兩張」而不是「模型用到的每一張」，
        這件事記在這裡，免得下一輪誤以為髮色整體都被釘住了。

        兩個樣本集用的是與 test_scalp_layer_carries_no_tail_weight 同一組門檻
        （貼頭 20mm、自由 35mm），所以「貼頭層整片不見了」也會在這裡現形，而
        不是安靜地讓兩個樣本集合而為一。
        """
        pos, uv = self.curtain_uv()
        skull = self.part_points('Body_Skin')
        gap = cKDTree(skull).query(pos)[0]
        on_skull = gap <= 0.020
        free = gap >= 0.035
        self.assertGreaterEqual(int(on_skull.sum()), 600, '貼頭層本身就不見了')
        self.assertGreaterEqual(int(free.sum()), 600, '自由段本身就不見了')
        colour = self.hair_surface_colour(uv)
        warmth = colour[:, 0] - colour[:, 2]
        scalp = float(np.median(warmth[on_skull]))
        tail = float(np.median(warmth[free]))
        self.assertLessEqual(
            abs(scalp - tail), HAIR_WARMTH_GAP_MAX,
            f'貼頭層暖度 {scalp:.1f}，自由段 {tail:.1f}，差 {abs(scalp - tail):.1f}')
        light = np.array([colorsys.rgb_to_hls(*(px / 255.0))[1] for px in colour])
        scalp_l = float(np.median(light[on_skull]))
        tail_l = float(np.median(light[free]))
        self.assertLessEqual(
            abs(scalp_l - tail_l), HAIR_LIGHTNESS_GAP_MAX,
            f'貼頭層明度 {scalp_l:.4f}，自由段 {tail_l:.4f}，'
            f'差 {abs(scalp_l - tail_l):.4f}')

    def test_crown_gold_stays_warm_but_not_amber(self):
        """皇冠的兩種對立退化各釘一邊，指標是 factor 的紅藍差。

        太淡（使用者回報「顏色太淡」）：褪色版 (0.997,0.866,0.759) 差 0.24，
        是 numpy 空間解色被 ACES 洗白的結果。太橘（round-4 reviewer 抓到）：
        線性值誤當 sRGB factor 烘焙，(0.999,0.600,0.360) 差 0.64，畫面是飽和
        琥珀。正解過 linear→sRGB 後 Gold 差 0.364、GoldInner 差 0.375（兩個
        數都是從出貨檔的 baseColorFactor 直接讀的），迴圈涵蓋兩個材質，門檻
        其實咬在較低的那個上。帶取 [0.30, 0.45]，兩種退化各自轉紅。
        """
        materials = self.textured_materials('Milfy_Gold_ramp')
        self.assertTrue(materials, '找不到 Milfy_Gold_ramp 的材質')
        for material, _ in materials:
            base = material['pbrMetallicRoughness']['baseColorFactor'][:3]
            spread = max(base) - min(base)
            self.assertGreaterEqual(spread, 0.30, f'{material["name"]} 乘色為 {base}')
            self.assertLessEqual(spread, 0.45, f'{material["name"]} 乘色為 {base}')

    def scalp_mask(self):
        """輸入模型上那塊頭皮色塊，用來把它排除在臉的量測之外。"""
        doc, binary = glb.load(SOURCE_MODEL)
        views = glb.views_of(doc, binary)
        face = customise.image_rgba(doc, views, 'F00_000_00_Face_00')
        return customise.scalp_pixels(face[..., :3], face[..., 3],
                                      build.SCALP_HUE, build.SCALP_WINDOW)

    def test_face_texture_keeps_the_contrast_its_features_live_in(self):
        """臉不能被提亮壓平，否則嘴唇就不再是嘴唇。

        調色要把膚色往參考圖的淡拉，而 retone 的 lift 是「往白拉一個比例」：它
        保順序，但把每一段亮度差都乘上 (1-lift)。解出來的係數等於拿走唇與臉頰之
        間同樣比例的距離，實機上嘴只剩一條幾乎看不見的淡痕，而所有關於膚色的數字
        都是對的——這條測的就是那些數字看不見的東西。retone 因此改成優先用加法位
        移，只有在 _burn 說會燒掉超過 CLIP_BUDGET 時才退回 lift。

        頭皮色塊要排除，而且這一條之前就是栽在這裡：那塊在基底模型上是深紫
        (78, 46, 161)，整張臉的 p10 一直是它，量到的 0.408 從頭到尾都是「這張貼
        圖上有一塊很暗的頭皮」，與嘴唇無關。把頭皮解到髮色之後同一個量法掉到
        0.122，而皮膚自己的 p10–p90 在修前修後都是 0.1235——沒有任何五官被壓平。
        遮罩取自輸入模型，理由與頭皮那條相同。
        """
        spread = self.texture_contrast('F00_000_00_Face_00', ~self.scalp_mask())
        self.assertGreaterEqual(
            spread, FACE_CONTRAST_MIN,
            f'臉的貼圖亮度 p10-p90 只剩 {spread:.3f}，五官被壓平了')

    def test_neck_and_face_are_one_skin(self):
        """露出來的脖子和臉必須是同一個膚色。

        這是使用者 2026-09-03 回報的那一條。VRoid 把整圈喉嚨畫成常駐陰影，因為基
        底模型穿的是高領、那塊永遠看不到；這個角色穿的是圓領，開場第一幀就在畫面
        上。而這台算圖對那塊表面不畫任何自己的陰影——白反照率算圖下臉與脖子都是
        (226, 229, 229)——所以畫上去的那道陰影就是眼睛看到的全部。出貨那版脖子是
        (243, 187, 174)、臉是 (252, 232, 226)，貼圖 ΔE 20.1、畫面 ΔE 14.4。

        兩塊都用骨架界定，不用色彩分類：臉是頭骨以上的臉部皮膚，脖子是頸骨到頭骨
        之間的身體皮膚。色彩分類會隨著調色本身改變它挑中的像素，等於讓受測的那一
        步決定自己被怎麼量。

        把 build.py 的頸部攤平與接縫環兩步拿掉重建，這條轉紅。
        """
        world = render.world_matrices(self.doc)
        bones = {b['bone']: b['node']
                 for b in self.doc['extensions']['VRM']['humanoid']['humanBones']}
        neck_y = float(world[bones['neck']][1, 3])
        head_y = float(world[bones['head']][1, 3])
        face_pos, face_uv = self.skin_seam_side('Face.baked',
                                                'F00_000_00_Face_00_SKIN')
        body_pos, body_uv = self.skin_seam_side('Body.baked',
                                                'F00_000_00_Body_00_SKIN')
        on_face = face_pos[:, 1] > head_y
        on_neck = (body_pos[:, 1] > neck_y) & (body_pos[:, 1] < head_y)
        # 頸骨到頭骨之間只有 93 個身體皮膚頂點，這一段本來就短。50 是「選取塌
        # 掉了」的界線，不是量出來的目標。
        self.assertGreaterEqual(int(on_face.sum()), 50, '取不到臉的頂點')
        self.assertGreaterEqual(int(on_neck.sum()), 50, '取不到脖子的頂點')
        face = np.median(
            self.sample_texture('F00_000_00_Face_00', face_uv[on_face]), axis=0)
        neck = np.median(
            self.sample_texture('F00_000_00_Body_00', body_uv[on_neck]), axis=0)
        gap, _ = measure.delta_e(face, neck)
        self.assertLessEqual(
            gap, NECK_TO_FACE_DELTA_E_MAX,
            f'臉 {tuple(round(float(v), 1) for v in face)}、'
            f'脖子 {tuple(round(float(v), 1) for v in neck)}，ΔE {gap:.2f}')

    def test_neck_seam_keeps_one_skin_tone_across_two_textures(self):
        """臉與身體是兩張貼圖，接縫橫過脖子，兩側不能是兩個膚色。

        customise.retone 把兩張各自解到同一個 SKIN_TARGET，就是為了讓這條縫關
        著。那個設計原本沒有守衛：所有膚色斷言都以「單張貼圖的中位數」為指標，
        把其中一張換個目標重建，每一條都還是綠的，而脖子上會出現一條看得見的
        界線。

        量法不含打光。取兩個網格真正相鄰（距離 2mm 內）的頂點，各自把自己的 UV
        取樣進自己那張貼圖，比兩側的中位數。整片中位數不能用：下巴下方本來就在
        陰影裡，畫面上的深淺差是打光造成的，與貼圖對不對得上無關。

        基底模型是 ΔE 15.77（VRoid 的臉與身體本來就不同調，靠 MToon 與打光遮
        掉），出貨是 1.04。把身體那張的目標換成別的顏色重建，這條轉紅（收據
        evidence/mutations-0903c.md 的 M11）。
        """
        face_pos, face_uv = self.skin_seam_side('Face.baked',
                                                'F00_000_00_Face_00_SKIN')
        body_pos, body_uv = self.skin_seam_side('Body.baked',
                                                'F00_000_00_Body_00_SKIN')
        face_gap = cKDTree(body_pos).query(face_pos)[0]
        body_gap = cKDTree(face_pos).query(body_pos)[0]
        # 高度也要限制，不只是「兩個網格靠得近」。這一條原本只問距離，取到的 88
        # 個臉側頂點橫跨 y 1.295 到 1.517——兩張皮膚在頭部另有一段互相貼著的幾何，
        # 而它不是縫，多半也看不到。真正在喉嚨上的只有 6 個，而整條的數字被那 82
        # 個非縫的點主導：2026-09-03 量到的 4.81 裡，喉嚨那 6 個是 ΔE 1。
        seam_y = float(face_pos[:, 1].min())
        near = lambda p: np.abs(p[:, 1] - seam_y) < SEAM_BAND
        face_on = (face_gap < 0.002) & near(face_pos)
        body_on = (body_gap < 0.002) & near(body_pos)
        self.assertGreaterEqual(int(face_on.sum()), 5, '臉側取不到縫上的頂點')
        self.assertGreaterEqual(int(body_on.sum()), 3, '身側取不到縫上的頂點')
        face_rgb = self.sample_texture('F00_000_00_Face_00', face_uv[face_on])
        body_rgb = self.sample_texture('F00_000_00_Body_00', body_uv[body_on])
        face_med = np.median(face_rgb, axis=0)
        body_med = np.median(body_rgb, axis=0)
        gap, _ = measure.delta_e(face_med, body_med)
        # 中位數印到小數一位，不是取整：ΔE 是拿浮點中位數算的，印截斷過的整數會
        # 讓讀者拿訊息重算得到別的數（1.04 對 0.97），而這個專案已經被「報告的數
        # 字和斷言評估的數字不是同一個」咬過一次。
        self.assertLessEqual(
            gap, SEAM_DELTA_E_MAX,
            f'縫上臉側 {tuple(round(float(v), 1) for v in face_med)}、'
            f'身側 {tuple(round(float(v), 1) for v in body_med)}，ΔE {gap:.2f}')

    def skin_seam_side(self, mesh_name, material_name):
        """一個網格裡用某個材質畫的頂點與 UV。"""
        mesh = next(m for m in self.doc['meshes'] if m.get('name') == mesh_name)
        pos, uv = [], []
        for entry in mesh['primitives']:
            if self.doc['materials'][entry['material']]['name'] != material_name:
                continue
            pos.append(glb.read_accessor(self.doc, self.views,
                                         entry['attributes']['POSITION']))
            uv.append(glb.read_accessor(self.doc, self.views,
                                        entry['attributes']['TEXCOORD_0']))
        self.assertTrue(pos, f'{mesh_name} 上找不到 {material_name}')
        return np.concatenate(pos), np.concatenate(uv)

    def sample_texture(self, image_name, uv):
        """把一組 UV 取樣進指定貼圖，回傳每個頂點的 RGB。"""
        image = next(image for image in self.doc['images']
                     if image.get('name') == image_name)
        rgb = np.asarray(
            Image.open(io.BytesIO(bytes(self.views[image['bufferView']]))).convert('RGB'),
            dtype=np.float64,
        )
        height, width = rgb.shape[:2]
        column = (uv[:, 0] * width).astype(int) % width
        row = (uv[:, 1] * height).astype(int) % height
        return rgb[row, column]

    def texture_contrast(self, name, mask=None):
        """一張貼圖不透明像素的亮度 p10–p90 距離，可再加一層遮罩。"""
        image = next(image for image in self.doc['images']
                     if image.get('name') == name)
        rgba = np.asarray(
            Image.open(io.BytesIO(bytes(self.views[image['bufferView']]))).convert('RGBA'),
            dtype=np.float64,
        ) / 255.0
        rgb, alpha = rgba[..., :3], rgba[..., 3]
        _, lightness, _ = np.vectorize(colorsys.rgb_to_hls)(
            rgb[..., 0], rgb[..., 1], rgb[..., 2])
        keep = alpha > 0.8
        if mask is not None:
            keep = keep & mask
        opaque = lightness[keep]
        self.assertGreater(opaque.size, 1000, f'{name} 幾乎沒有不透明像素')
        return float(np.percentile(opaque, 90) - np.percentile(opaque, 10))

    def test_hair_texture_keeps_its_strand_contrast(self):
        """壓平髮根→髮梢色帶不能連髮絲一起壓平。

        這是 test_face_texture_keeps_the_contrast_its_features_live_in 的同一種
        失效模式，套在頭髮上。色帶差、暖度、中位數三條斷言全部以中位數為指標，
        而把整張貼圖往自己的中位數收，那三個數字只會更漂亮——收到 100% 就是一張
        純色髮圖，色帶差 0.0、暖度不動、亮度不動，一條都不會紅。缺的就是這一條
        下限。

        現行手法是逐欄區塊去趨勢（customise._flatten_v）：色帶沿 v，髮絲沿 u，
        減掉每一列自己的中位數只拿走前者。把 build.HAIR_FLATTEN_BLOCKS 改成 0
        重建，色帶暖度差從 0 回到 24、那一條轉紅而這一條是綠的；改成「整張往中
        位數收 85%」則反過來，色帶那條綠而這一條紅（01 只剩 0.014）。兩條各有專
        屬 mutation，收據 evidence/mutations-0903c.md 的 M1／M2。
        """
        for name in ('F00_000_Hair_00_01', 'F00_000_Hair_00_02'):
            spread = self.texture_contrast(name)
            self.assertGreaterEqual(
                spread, HAIR_CONTRAST_MIN,
                f'{name} 亮度 p10-p90 只剩 {spread:.3f}，髮絲被壓平了')

    def test_hair_texture_keeps_visible_tone_under_mtoon_lighting(self):
        self.assert_texture_band('F00_000_Hair_00_01', HAIR_MIN_CHANNEL, HAIR_WARMTH)
        self.assert_texture_band('F00_000_Hair_00_02', HAIR_MIN_CHANNEL, HAIR_WARMTH)

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
