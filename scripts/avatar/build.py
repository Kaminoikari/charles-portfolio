"""Build the Milfy-referenced outfit onto the partitioned base.

Every measurement here is a fraction of this body's own landmarks, read out of
the file rather than typed as a world coordinate: the waist is where the torso
is narrowest, the hem sits between hip and knee. Hard-coding heights would make
the script correct for exactly one body, and the point of a template is that the
next body gets the same garment without a rewrite.

Colour lives in PALETTE and nowhere else. Each entry becomes one flat MToon
material, which is what makes "change one material, change the whole colourway"
true rather than aspirational.
"""
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

import customise
import envelope
import garment
import glb
import outfit
import render
import twintail
import weld

# 頭上的獸耳、髮髻、皇冠、呆毛都在這一個檔裡，見 blender/head.py。
HEAD = 'blender/head.glb'
# 耳圈、髮髻與呆毛吃 VRoid 自己的髮絲貼圖，不用平色材質：髮色的色相旋轉作用
# 在貼圖上，走同一個材質才會被一起帶到，而且新部件才有髮絲明暗。內耳不在這條
# 路上，理由見下面 EAR_INNER。
HEAD_HAIR = 'F00_000_Hair_00_HAIR_02'
# 內耳。純色版在算圖裡量到的通道標準差是 (1.0, 0.7, 6.1)，參考圖同一塊是
# (21.9, 16.3, 15.7)——一塊完全沒有明暗的粉色圓片，正是「和原圖差距很大」的
# 那個手感。所以它改成髮絲花紋乘上這個顏色。花紋是自己烘的一張內耳明暗
# 圖（見 bowl_texture），不是共用髮絲貼圖：共用會讓 manifest 說謊，因為
# palette 對每個 Milfy_* 材質都宣告一個底色、換裝工具應該設得動，而一個係數
# 乘在有色貼圖上得不到它被設定的那個顏色——customise.tint 正是為這件事擋下
# 它的，selftest 也確實抓到了。
EAR_INNER = (0.886, 0.820, 0.808)
EAR_INNER_SHADE = (0.779, 0.721, 0.711)
# 內耳貼圖歸一化後的均值。要 >= EAR_INNER 最大的通道，否則係數被夾掉。
BOWL_MEAN = 0.90
# 皇冠的環帶是圓的，平色會讓它讀成一片剪紙——正面算圖裡整頂冠的通道標準差
# 是 0.00，真實 MToon 打光下也只有 3.8。參考的金自己就有 74 階的明暗分界。
# 這道由暗到亮的斜坡由每個面自己的法線鋪上去（uv_facet），背對光的那些面才
# 會暗下來。
GOLD_RAMP = (0.74, 1.0, 1.0)
# 皇冠往中線與瀏海方向的剛體平移，套在 sink 之前；為什麼移、量怎麼來的，見
# sink 呼叫處的註解。y 的 -10mm 是因為前移後皇冠落在外凸的瀏海面上，sink
# 只會往下落（這次落了 0mm），不往上也不往內：不給 y 它就整頂浮在髮頂，
# 參考圖上冠緣是半埋進髮際的。
CROWN_SHIFT = (-0.025, -0.010, -0.020)
# 上面那道斜坡的光向，前上方偏模型左。整條管線的算圖是無光照的（見
# render.rasterise），明暗一律烘進貼圖或 UV，所以這裡也一樣。
CROWN_LIGHT = (-0.30, 0.62, -0.73)

# The imported outfit, if it has been converted. Every garment this file builds
# by hand is a stand-in for it, so when the file is there they step aside:
# wearing both would put two skirts and two bodices on the same body, each
# hugging the same skin and z-fighting the other. Hair, head accessories, body
# and face are unaffected -- the package does not ship those.
# Two files, because the package ships the bodice set and the cardigan as
# separate FBXs with separate armatures; see blender/mellow.py.
MELLOW = 'blender/mellow.glb'
MELLOW_OUTER = 'blender/mellow_outer.glb'
# mesh -> (our part name, how far it must clear the body). The clearances are
# what each garment is: a boot hugs the calf, a bodice sits on a layer of air,
# a skirt hangs off the hips and mostly does not touch at all.
# Socks were 4mm and grazed the inner ankle by 2mm at rest, and the boot at the
# same 4mm let the toes through its toe box; both are hugging garments, but not
# through the skin. 8mm left the ankles still grazing by 1.1mm, which is under
# the eye but not under the gate once it counts small parts by their own area. The skirt stays at 14mm: what it needed was not a bigger
# rest clearance but room to swing, which is MELLOW_LOOSEN below.
# Belt 進 Acc_Belt_Waist 而不是 Acc_Ribbon_Waist：量過廠商的 Belt 網格，它是
# 一條 27mm 高的腰封加一片 104x25x13mm 的正面裝飾板，沒有任何前突的結或環，
# 當不了 goal 第 8 項的「腰帶蝴蝶結」。蝴蝶結由 blender/bow.py 生成，兩者合起
# 來是一條腰封加一個繫在上面的蝴蝶結，正好是參考圖的構造。
# Belt 的 20mm 是要它坐在裙腰帶上而不是坐在身體上：裙子自己留 14mm，比裙子再
# 外推 6mm 才是一條繫在裙外的腰帶。Leg_belt 綁在裸露的大腿上，和襪子同量級。
MELLOW_PARTS = {'Inner': ('Outfit_Top', 0.010), 'Skirt': ('Outfit_Bottom', 0.014),
                'Socks': ('Outfit_Socks', 0.010), 'Shoes': ('Outfit_Shoes', 0.009),
                'Main_Ribbon': ('Acc_Ribbon_Neck', 0.012),
                'Belt': ('Acc_Belt_Waist', 0.020),
                'Leg_belt': ('Acc_Bandage_Thigh', 0.003),
                'Outer': ('Outfit_Cardigan', 0.020)}
# 沿 y 平移，套在擬合之後、貼身之前。大腿繃帶是唯一需要的一件：廠商把它放在
# Milfy 自己的大腿中段，本模型過了 proportion 之後裙襬落在 y=0.693，繃帶原位
# 0.668-0.729 有六成埋在裙子裡，正面只露出 25mm 的一條。往下 45mm 讓它整條落
# 在裸露的大腿上，也就是參考圖上它該在的位置。
MELLOW_SHIFT = {'Acc_Bandage_Thigh': -0.045}
THIGH_BAND_SOURCE_MATERIAL = 'Leg_Acc'
THIGH_BAND_FINAL_CLEARANCE = 0.004
# Extra room a garment needs for the poses rather than for the rest pose, ramped
# from nothing at its top to this at its hem. See outfit.loosen.
MELLOW_LOOSEN = {'Outfit_Bottom': 0.005}
# 外套的動作間隙。跟 loosen 是同一類需求（rest 量不到、動作才拖出來的穿模），
# 但機制不能共用：外套有 13% 頂點是法線朝內的 teal 內裡 shell，沿自身法線外推
# 會把內裡推「進」襯衫，modelPose 兩側胸口的鋸齒 teal 三角就是內裡刺穿襯衫。
# 所以走 outfit.standoff：法線帶符號（內裡翻向，與外層平行同向移動，厚度不變）、
# 只取水平分量（肩頂法線朝上，自然當錨點，領口不浮）、|x| 羽化排除袖管（袖子
# 沒有病灶；軀幹片延伸到 |x|≈0.30，羽化帶 0.26-0.32 刻意跨在軀幹與袖管的交界
# 上，讓被推的軀幹片在接縫前就漸縮到零，不在肩袖交界留下階梯）。10mm 是
# akimbo 腰際手掌穿出與 modelPose 胸口內裡兩處都蓋掉的量，疊在 hug 的 20mm
# rest 間隙之上。
MELLOW_STANDOFF = {'Outfit_Cardigan': 0.010}
# 雙馬尾對外套的守衛（量法見 twintail.coat_intrusion）。乾淨的建置量到
# -59mm／0%（最靠裡的髮頂點也在輪廓外 59mm），舊出貨檔 -2 是 50.7mm／25.8%。
# 5mm 與 springsim.test.ts 的 REST_COAT_MAX_MM 是同一個數字，量法不同（這裡量
# bind mesh、世界座標、x 對折、不切前方；springsim 量彈簧安定後的蒙皮網格、脊椎
# 座標系、-10° 前切）；1% 是髮絲取 90 百分位粗細之後允許零星幾根探進輪廓。
TAIL_COAT_INTRUSION_MAX = 5.0
TAIL_COAT_INSIDE_SHARE_MAX = 0.01

# And a key is only shipped if the vertices it moves go somewhere a person could
# see: the mean displacement over its moved vertices, on at least one garment,
# has to clear this.
#
# `Side adjustment` fails it because it is empty in the FBX itself, every delta
# exactly zero -- a named key the vendor shipped without ever authoring. Keeping
# it would advertise a slider that does nothing, which is the silent no-op this
# pipeline keeps guarding against.
SHAPE_KEY_MIN_MEAN = 0.001
# Its base maps are greyscale -- the vendor colours them in a Unity shader from
# a mask -- so the colour is ours to choose and it stays on named materials.
MELLOW_TINT = {
    'Inner':      ((0.957, 0.945, 0.925), (0.855, 0.835, 0.820)),
    'Inner_Sub':  ((0.957, 0.945, 0.925), (0.855, 0.835, 0.820)),
    'Lace':       ((0.957, 0.945, 0.925), (0.855, 0.835, 0.820)),
    'Skirt_Cloth': ((0.957, 0.945, 0.925), (0.855, 0.835, 0.820)),
    'Shoes':      ((0.949, 0.937, 0.918), (0.848, 0.828, 0.812)),
    'Sub_Acc':    ((0.518, 0.784, 0.776), (0.386, 0.638, 0.647)),
    'Belt_Acc':   ((0.518, 0.784, 0.776), (0.386, 0.638, 0.647)),
    'Leg_Acc':    ((0.949, 0.937, 0.918), (0.848, 0.828, 0.812)),
    # 同一個金抄成兩份只動一份就會分岔，所以跟著 Milfy_Gold 一起動。數值與
    # PALETTE 的 Milfy_Gold 不同字面：那邊過 ramp 貼圖（factor 要除 0.87 均
    # 值），這裡無 ramp 直寫 factor；兩邊同源於真引擎頁解出的同一組線性值，
    # 一樣要先 linear→sRGB（換算見 PALETTE 的 Milfy_Gold 註解）。
    'Jewel':      ((1.0, 0.798, 0.634), (0.975, 0.741, 0.568)),
    'Underwear':  ((0.957, 0.945, 0.925), (0.855, 0.835, 0.820)),
    'Outer':      ((0.341, 0.333, 0.361), (0.231, 0.224, 0.247)),
}
# 底圖的曝光，見 outfit._materials。不是指數，是「乘一個對比再加一個偏移」。
# 廠商把黑外套、黑百褶裙、黑樂福鞋的明暗直接畫進底圖（外套那張逐三角取樣，在
# 自己的 UV 上均值只有 69／255），而顏色在本專案是 baseColorFactor，係數是乘
# 法又被 glTF 夾在 1 以下：底圖多暗，成品就多暗，白色的裙子和鞋子在原樣的底圖
# 上做不出來。每組兩個數字都是照著算圖量出來的，不是猜的。
MELLOW_GAIN = {
    'Skirt_Cloth': (0.55, 0.83),
    'Shoes': (0.55, 0.83),
    'Outer': (0.55, 0.64),
    'Belt_Acc': (0.55, 0.68),
    'Leg_Acc': (0.55, 0.62),
    'Jewel': (0.55, 0.45),
}
# What the hand-built outfit contributes. Suppressed wholesale when the imported
# one is present; the head and hair lists below are not in here on purpose.
HAND_GARMENTS = {
    'Outfit_Top', 'Outfit_Bottom', 'Outfit_Cardigan', 'Outfit_Shoes',
    'Outfit_Socks', 'Acc_Frill_Bust', 'Acc_Frill_Hem', 'Acc_Collar',
    'Acc_Buttons', 'Acc_Bow_Skirt', 'Acc_Ribbon_Neck',
    'Acc_Bear_Face', 'Acc_Bandage_Thigh', 'Acc_Bandage_Calf',
    'Acc_Bandage_Ankle',
}

# Parts lofted in Blender, by file stem. Missing files are skipped, so the build
# still runs where Blender is not installed.
# 蝴蝶結在腰封高度那一段，離腰封的最近距離上限。
BOW_GAP_MAX = 8.0

# 第四欄是同一個匯出檔裡要換材質的網格：{網格名: (材質, 標籤)}。腰間蝴蝶結的
# 結是唯一一個。它和兩片環同檔，因為它的位置是從環推出來的；它不能同色，因為
# 這個算圖器沒有光，同色的結在兩片同色的環中間就不存在。
BLENDER_PARTS = [
    ('bow', 'Milfy_Mint', 'Acc_Ribbon_Waist',
     {'knot': ('Milfy_MintDark', 'Acc_Ribbon_Waist#knot')}),
    ('hairbow', 'Milfy_Mint', 'Acc_Ribbon_Hair', {}),
    ('neckribbon', 'Milfy_Ribbon', 'Acc_Ribbon_Neck', {}),
    ('details', 'Milfy_Ribbon', 'Acc_Bow_Skirt', {}),
]

# 髮色貼圖的旋鈕：色相旋轉、飽和縮放、往白拉，以及把 VRoid 的髮根→髮梢色帶逐欄
# 去趨勢時要切成幾個欄區塊（見 customise.hue 的 `flatten` 與 `_flatten_v`）。
#
# 2026-09-03 依參考圖重解。前五版留著 LIFT 0.0 與 SAT 0.75，理由寫的是「瀏覽器
# 的環境光與 ACES 會再提亮一次，所以資產這邊保留暖米底與髮絲對比」——量過之後那
# 個理由不成立：那一組常數在生產打光下的實機髮色是 (200,185,169)，去掉亮度軸的
# ΔE 4.52，而參考圖的髮是 (245,231,223)。提亮沒有發生。現況 1.51。
#
# 這三個旋鈕壓的都是同一條色帶，會互相遮蔽；改動任何一個之前，先看
# evidence/mutations-0903c.md 哪一個 mutation 釘住哪一個。特別是 LIFT 與 SAT 同
# 時也會壓掉髮絲對比（每一段亮度差乘 (1-LIFT)：HAIR_01 的貼圖亮度 p10–p90 由
# 0.1490 掉到 0.0843），逐欄去趨勢再拿掉沿 v 的那一部分（0.0843 → 0.0373）。兩
# 段各自量得出來，數字在 evidence/colorprobe-0903.md。
#
# 2026-09-04 改金髮（使用者：「只修髮不修膚的話，我希望髮色改成金髮」）。前一版
# 把髮解到參考圖的灰米色均值 (245,231,223)，代價是 LIFT 0.42 把髮絲對比壓到
# 0.037、_ShadeColor 又與 _Color 同值，實機上髮是一片 ±15 的平米色 (208,197,187)
# 貼在膚色 (222,210,204) 旁邊，兩者讀成同一種材質。金髮的色相從粉紅 350 轉到
# 45，飽和留九成，提亮降到 0.25 讓髮絲回來；亮暗兩個乘色在真引擎頁上解（見
# HAIR_SHADE_TONE）。
HAIR_SHIFT, HAIR_SAT, HAIR_LIFT = 55.0, 0.9, 0.25
HAIR_FLATTEN_BLOCKS = 16
# 亮部與陰影兩個乘色，在 live-preview.html?mikadebug=1 上以 material.color／
# shadeColorFactor 直寫收斂，頁上線性值經 linear→sRGB 後才寫進這裡（同
# PALETTE 的 Milfy_Gold 那條規則，少一次轉換就是二次 gamma）。陰影對亮部的比值
# 取參考圖馬尾陰影 (170,149,144) 對亮部 (254,249,245) 的線性比 (0.59,0.46,0.33)：
# 髮要靠明暗範圍與膚分開，均值不夠。
HAIR_MATERIAL_TONE = (1.0, 0.8295, 0.4962)
HAIR_SHADE_TONE = (0.7918, 0.585, 0.2923)
# Accent streaks further than this from the hair's own hue are folded onto it
# before the rotation; see customise.hue.
HAIR_UNIFY = 60.0
BROW_SHIFT, BROW_SAT = 140.0, 0.35

# The hue the scalp cap sits at BEFORE anything here touches it. VRoid paints a
# hair-coloured cap into the face atlas so a parting shows hair and not skin,
# and neither the untouched export nor the pink repaint moved it: it is still
# the original purple, 265 on the export and 257 on the repaint. A window either
# side catches both without reaching the skin at 9 or the lips at 0.
SCALP_HUE, SCALP_WINDOW = 261.0, 45.0
# The cap's anti-aliased edge. Along it the hue walks from the cap (261)
# through magenta to the skin (9): it leaves the window at 306 and only reaches
# skin at about 345. Recolouring the window alone left that edge to the SKIN
# solve, which turned it mauve -- the purple lines behind the neck and along the
# hairline the owner reported on 2026-09-04, still there after the 09-03 fix.
# Texels on the arc with chroma above SCALP_FRINGE_SAT that touch the cap are
# the fringe; the lips (0) and the blush (9) sit past the end and never touch it.
SCALP_FRINGE_TO, SCALP_FRINGE_SAT = 345.0, 0.12

# The neck band, in metres of overshoot past the neck and head bones. The
# overshoot exists so the feather ramps down on skin that is still neck rather
# than stopping dead on the collarbone. It is geometry, not colour, so it
# survives a change of palette. The feather width itself lives in customise,
# where it is a fraction of each atlas's own width.
NECK_MARGIN = 0.03

# Both skin textures are solved onto one warm base so the neck seam stays
# closed. 臉和身體共用這一個目標，頸縫才不會開。
#
# 2026-09-03 由 (244,190,172) 重解，因為使用者問「膚色跟髮色都跟參考圖一樣嗎」，
# 量出來不一樣：那一組常數在生產打光下的實機膚色是 (222,193,179)，暖度（R−B）
# 43，去掉亮度軸的 ΔE 8.62；參考圖的裸膚是 (253,239,236)，暖度 17。現況 1.24。
#
# 亮度追不上，而且追不上的原因量得出來：colourprobe.html 的 ?ceiling=1 把膚色那
# 組材質換成純白 albedo（貼圖拿掉、色乘 1,1,1、陰影色也白）在同一組光下再算一
# 次，量到 (226,229,229)、L* 90.7，而參考是 L* 95.4。這個引擎對任何材質的上限就
# 低於參考圖的膚色亮度，不是這一組常數能補的。那個量測從出貨檔本身算得出來，不
# 依賴另外保留一份白模建置。收據在 evidence/colorprobe-0903.md，敘述在
# RESULT.txt「第六版之二」。
SKIN_TARGET = (252, 222, 214)
SKIN_MATERIAL_TONE = (0.96, 0.90, 0.87)

# The outline colour, derived from the skin rather than written down. The base
# model's is VRoid's wine (0.275, 0.090, 0.125), drawn to sit on Mika's salmon
# pink; on Milfy's near-white skin the same line renders rust, and it traces the
# whole figure. An unlit renderer draws no outline pass at all, so every gate
# and all four contract cameras are blind to it -- the same class of defect as
# the floating bow, and it needs the same kind of guard, which is in verify.py.
# Taking the hue from SKIN_TARGET and dropping it to OUTLINE_VALUE keeps one
# definition: move the skin and the line moves with it.
OUTLINE_VALUE = 0.20
OUTLINE_CHROMA_MAX = 0.038
_outline_raw = tuple(c / max(SKIN_TARGET) * OUTLINE_VALUE for c in SKIN_TARGET)
_outline_floor = max(_outline_raw) - OUTLINE_CHROMA_MAX
OUTLINE_COLOR = tuple(round(max(c, _outline_floor), 4) for c in _outline_raw)
# The hair's line is black and stays black: black is not a paler version of a
# hue, and rotating it toward the skin would just make it brown.
OUTLINE_KEEP = tuple(f'F00_000_Hair_00_HAIR_0{i}' for i in range(1, 7))

# The base model's eyes are blue; the reference's are a warm neutral grey, hue
# 350 at a tenth the saturation. Read off the official expression sheet's irises
# with the pupil and the catchlight excluded, then put back through the render's
# light the same way the skin was.
EYE_TARGET = (145, 121, 121)

# Read off the reference sheets. Shade is the MToon shadow colour: a toon model
# with shade == base looks flat, and with shade too dark looks bruised, so each
# one is the base pulled toward its own hue rather than toward black.
PALETTE = {
    'Milfy_White':    ((0.957, 0.945, 0.925), (0.855, 0.835, 0.820)),
    'Milfy_Cardigan': ((0.129, 0.129, 0.145), (0.086, 0.086, 0.102)),
    'Milfy_Mint':     ((0.518, 0.784, 0.776), (0.386, 0.638, 0.647)),
    # 腰間蝴蝶結的結。0.72 倍薄荷，也就是把緞帶自己的暗面當成結的固有色——在
    # 有光的參考圖裡結和環本來就是同一塊布，分得出來靠的是它被夾住的那圈陰影。
    # 這個算圖器不打光，所以那圈陰影只能烘進顏色裡。
    'Milfy_MintDark': ((0.373, 0.564, 0.559), (0.278, 0.459, 0.466)),
    'Milfy_Ribbon':   ((0.110, 0.110, 0.125), (0.071, 0.071, 0.086)),
    'Milfy_Bandage':  ((0.949, 0.933, 0.902), (0.851, 0.831, 0.800)),
    # Its own entry rather than sharing Milfy_Bandage, even though the two start
    # the same white. The template's promise is that one material is one
    # garment's colour; sharing would mean recolouring the socks also recoloured
    # the three bandages, which is a surprise the manifest does not warn about.
    'Milfy_Sock':     ((0.949, 0.933, 0.902), (0.851, 0.831, 0.800)),
    # 2026-09-02 整組換成真引擎頁解出的值：numpy 量測看不見打光層，先前照
    # 參考表 (228,202,175) 解的 (0.867,0.753,0.660) 在 ACES＋正式打光下渲染成
    # 近白，使用者反映皇冠太淡。在 live-preview.html?mikadebug=1 上以
    # setRGB 直寫 material.color 收斂，烘完在同一頁複測三次讀值都是
    # (225,208,187)（方法、遮罩與參考截圖的分佈見 RESULT.txt「第五版」第 1
    # 點）。座標系是這裡最容易錯的一步：setRGB 寫的是「線性」值，而 glTF
    # loader 把 baseColorFactor 當 sRGB 轉線性讀，所以解出的線性值必須先過
    # linear→sRGB 再進 PALETTE。第一次烘焙把線性值直接當 factor 存，二次
    # gamma 讓皇冠變成過飽和的琥珀橙（畫面 (230,174,114)，reviewer 抓到）。
    # lit 另乘回 ramp 均值 0.87；r 取 0.869
    # 而不是 0.870，給「除以均值後不得超過 1.0」的守衛留浮點餘裕。
    'Milfy_Gold':     ((0.869, 0.694, 0.552), (0.975, 0.741, 0.568)),
    'Milfy_Hair':     ((0.929, 0.882, 0.855), (0.818, 0.760, 0.727)),
    'Milfy_Bear':     ((0.965, 0.953, 0.937), (0.867, 0.847, 0.827)),
    # 內耳。參考圖上內耳 (227,209,206) 對髮色 (240,227,225) 的比值，套到本
    # 模型上色後髮絲貼圖最亮處 (233,228,223) 算出來的，不是目測挑的粉色。
    # 皇冠齒縫裡露出來的內側面。原本按參考圖暗亮面比值從 Milfy_Gold 推導；
    # 2026-09-02 改隨 Milfy_Gold 一起在真引擎頁上解，兩者各自乘同一組提暖係數
    # （Gold 的 r 被 1.0 夾住、這裡沒有，比值在 r 上因此偏離舊構造）。空間換
    # 算與 Milfy_Gold 同一條規則：頁上線性值先 linear→sRGB，lit 再乘 0.87。
    'Milfy_GoldInner': ((0.790, 0.595, 0.464), (0.845, 0.630, 0.487)),
    # OK 繃與橫槓髮夾。取樣要取本模型這個配色的那張參考圖：
    # official/front-back-with-cardigan.jpg 上 OK 繃是 (204,225,226) 的淡薄荷、
    # 橫槓是接近炭黑的 (95,93,98)。ingame/01 是冰白配色的另一個版本，那張上面
    # OK 繃是淡藍、橫槓是藍灰——照那張取樣會把整個頭飾的色調帶到另一個配色去，
    # 這正是上一輪犯的錯。先前 OK 繃借用 Milfy_Mint (132,200,198) 則是太濃。
    'Milfy_Plaster':  ((0.800, 0.882, 0.886), (0.686, 0.780, 0.788)),
    'Milfy_Ink':      ((0.373, 0.365, 0.384), (0.286, 0.278, 0.298)),
}

# The parametric rim colour, which is her own mint rather than a new number.
# The site draws every body with one hard-coded accent (mars orange, in
# avatarGuideEngine.ts) because no VRM it has loaded ever declared `_RimColor`;
# on a near-white blouse and a near-black cardigan that accent is the rust glow
# along every fold. Reading it off PALETTE keeps the sash, the hair bow and the
# rim on one value: retint the mint and the edge light follows.
RIM_COLOR = PALETTE['Milfy_Mint'][0]


def add_material(doc, name, base, shade, texture=None):
    """One MToon material, in both the glTF and the VRM tables.

    `texture` is a glTF texture index, used by the imported outfit: its maps are
    greyscale pattern and the colour arrives as the factor multiplying them, so
    the same named-material colour policy covers textured pieces too.
    """
    doc['materials'].append({
        'name': name,
        'pbrMetallicRoughness': {
            'baseColorFactor': [*base, 1.0],
            'metallicFactor': 0, 'roughnessFactor': 0.9,
            **({'baseColorTexture': {'index': texture}} if texture is not None else {}),
        },
        'emissiveFactor': [0, 0, 0],
        'doubleSided': True,
        'alphaMode': 'OPAQUE',
        'extensions': {'KHR_materials_unlit': {}},
    })
    doc['extensions']['VRM']['materialProperties'].append({
        'name': name,
        'renderQueue': 2000,
        'shader': 'VRM/MToon',
        'floatProperties': {
            '_Cutoff': 0.5, '_BumpScale': 1, '_ReceiveShadowRate': 1,
            '_ShadingGradeRate': 1, '_ShadeShift': -1, '_ShadeToony': 1,
            '_LightColorAttenuation': 0, '_IndirectLightIntensity': 0.1,
            '_OutlineWidth': 0.08, '_OutlineScaledMaxDistance': 1,
            '_OutlineLightingMix': 1, '_DebugMode': 0, '_BlendMode': 0,
            '_OutlineWidthMode': 1, '_OutlineColorMode': 1, '_CullMode': 0,
            '_OutlineCullMode': 1, '_SrcBlend': 1, '_DstBlend': 0, '_ZWrite': 1,
        },
        'textureProperties': ({'_MainTex': texture, '_ShadeTexture': texture}
                              if texture is not None else {}),
        'vectorProperties': {
            '_Color': [*base, 1.0], '_ShadeColor': [*shade, 1.0],
            '_MainTex': [0, 0, 1, 1], '_ShadeTexture': [0, 0, 1, 1],
            '_OutlineColor': [*OUTLINE_COLOR, 1],
            '_RimColor': [*RIM_COLOR, 1],
        },
        'keywordMap': {'MTOON_OUTLINE_COLOR_MIXED': True},
        'tagMap': {'RenderType': 'Opaque'},
    })
    return len(doc['materials']) - 1


def graft_shapes(doc, views, mesh_name, shapes):
    """Write per-primitive shape keys onto a mesh, padding the primitives without.

    Returns the key names in the order they were written.

    glTF's rule is that every primitive of a mesh declares the SAME targets in
    the SAME order, and the outfit shares Body.baked with the body itself and
    with every accessory grafted onto it. So a key that moves only the skirt
    still has to exist on the boots, on the torso and on the waist bow. Those
    get a sparse accessor holding one zero, which is the smallest thing the spec
    allows -- an empty sparse block is invalid.

    The names go in `mesh.extras.targetNames`, which is where glTF puts them and
    where three.js reads `morphTargetDictionary` from. They are deliberately NOT
    added to VRM's blendShapeMaster: that list is the expression system, driven
    by name from the chat widget, and a body-shape slider appearing there would
    read as a face this model can pull.
    """
    mesh = next(m for m in doc['meshes'] if m.get('name') == mesh_name)
    if any(pr.get('targets') for pr in mesh['primitives']):
        raise SystemExit(f'{mesh_name} 已經有 morph target，再加會弄亂既有的順序')
    # A key that moves nothing anywhere is dropped rather than shipped. The
    # vendor's `Side adjustment` is one: it is a named key with every delta at
    # zero, in the FBX itself, so keeping it would advertise a slider that does
    # nothing -- the exact silent no-op this pipeline keeps guarding against.
    effect = {}
    for keys in shapes.values():
        for name, (hit, delta) in keys.items():
            mean = (float(np.linalg.norm(delta, axis=1).mean())
                    if len(hit) else 0.0)
            effect[name] = max(effect.get(name, 0.0), mean)
    weak = sorted((n, e) for n, e in effect.items() if e < SHAPE_KEY_MIN_MEAN)
    if weak:
        print('   丟掉動不了東西的 shape key：' + '，'.join(
            f'{n} 平均 {e * 1000:.2f}mm' for n, e in weak))
    names = sorted(n for n, e in effect.items() if e >= SHAPE_KEY_MIN_MEAN)
    for pi, pr in enumerate(mesh['primitives']):
        count = doc['accessors'][pr['attributes']['POSITION']]['count']
        keys = shapes.get(pi, {})
        pr['targets'] = []
        for name in names:
            hit, delta = keys.get(name, (np.zeros(0, np.int64), np.zeros((0, 3))))
            pr['targets'].append({
                'POSITION': glb.add_sparse_accessor(doc, views, count, hit, delta),
            })
    mesh.setdefault('extras', {})['targetNames'] = names
    return names


def bowl_texture(doc, views, name, size=128):
    """The inner ear's own shading, baked: a rim shadow and a soft edge.

    The first version cropped the hair map for its strands. It gave the bowl
    pixels that move, but moving in the wrong way -- vertical strands printed
    flat across a 25mm dish, when what makes a dish read as a dish is the
    crescent of shadow the rim casts across its upper half. That crescent is
    what the reference has and what a flat renderer will never derive on its
    own, so it is painted here.

    Returns (texture index, mean brightness as a fraction of white) so the
    caller can divide its target colour by the mean and have the piece render
    at the colour it asked for.
    """
    y, x = np.mgrid[0:size, 0:size] / (size - 1.0)
    dx, dy = (x - 0.5) * 2.0, (y - 0.5) * 2.0
    r = np.hypot(dx, dy)
    # uv_bowl puts the bowl's top at row 0, so the rim shadow lives there.
    rim = np.clip((0.42 - y) / 0.42, 0.0, 1.0) ** 1.4
    edge = np.clip((r - 0.55) / 0.45, 0.0, 1.0) ** 1.6
    strand = 0.030 * np.sin(x * np.pi * 7.0) * np.clip(1.0 - r, 0.0, 1.0)
    a = np.clip(1.0 - 0.46 * rim - 0.24 * edge + strand, 0.0, 1.0)
    # 深度先畫足，再整張縮放到 BOWL_MEAN，不是反過來。第一版把深度直接寫死在
    # 係數裡：加深一分，均值就掉一分，呼叫端拿 EAR_INNER 去除均值就會超過 1、
    # 被 glTF 夾掉，於是能畫多深由「不許超過 1」決定，而不是由參考圖的調變量
    # 決定。縮放之後這兩件事分開了——均值固定在這裡，深淺由上面的係數自己說了
    # 算，代價只是最亮的一小塊會頂到白。
    # 用二分找縮放倍率，不是直接除以均值再夾。夾在 1.0 這一步本身會把均值拉
    # 回來，所以「除以均值」得到的成品均值一定小於目標，呼叫端除下去就超過 1
    # ——第一次改深就是這樣讓建置在守衛那裡停掉的。夾完之後的均值對倍率是單
    # 調的，二分四十次即可。
    # 圓盤半徑 0.9 不是 1.0：uv_bowl 把碗鋪成 0.5 ± 0.45 * d/radius，模型讀到的
    # 最外一圈就落在 r = 0.9。用 r <= 1.0 取平均會把外面那一圈從來沒被讀到的暗
    # 邊算進來，均值偏低、呼叫端除出來的係數偏高，成品比 EAR_INNER 指定的顏色
    # 亮 4.3%——docstring 說「取樣區才算」，但當時算的不是取樣區。
    seen = r <= 0.9
    lo_k, hi_k = 0.0, 10.0
    for _ in range(40):
        k = (lo_k + hi_k) / 2.0
        if np.clip(a * k, 0.0, 1.0)[seen].mean() < BOWL_MEAN:
            lo_k = k
        else:
            hi_k = k
    a = np.clip(a * k, 0.0, 1.0) * 255.0
    quantised = a.astype(np.uint8).astype(np.float64)
    # The mean is taken over the disc the bowl actually samples, not the whole
    # square, and that disc is r <= 0.9 because that is what uv_bowl reaches.
    # The corners are painted but never read, and letting them into the mean
    # makes the caller divide by a darkness nothing on the model receives.
    # `seen` is set above, where the same disc decides the scale.
    im = Image.fromarray(a.astype(np.uint8), 'L').convert('RGBA')
    buf = io.BytesIO()
    im.save(buf, format='WEBP', quality=95, method=4)
    doc['images'].append({'name': name, 'mimeType': 'image/webp',
                          'bufferView': glb.add_view(doc, views, buf.getvalue())})
    doc.setdefault('samplers', []).append({'wrapS': 33071, 'wrapT': 33071})
    doc['textures'].append({'sampler': len(doc['samplers']) - 1,
                            'source': len(doc['images']) - 1})
    # 回傳量化後的均值，不是二分求出來的那個目標值。著色器讀到的是 uint8 的
    # 那份，兩者差 0.002；差在安全的方向（回傳偏小 → 係數偏大），但呼叫端拿
    # 它去算「除下去會不會超過 1」，那個判斷該用著色器真正會讀到的數。
    return len(doc['textures']) - 1, float(quantised[seen].mean() / 255.0)


def ramp_texture(doc, views, name, lo, hi, height=64, gamma=1.0):
    """A one-dimensional dark-to-light ramp, as its own texture.

    Same reason as bowl_texture: the colour stays in the factor so the manifest
    keeps telling the truth about what a swap tool can set, and the texture
    carries nothing but shading.

    `gamma` below 1 bends the ramp towards its bright end. That is not a
    cosmetic knob: the factor is the palette colour divided by this image's
    mean, and glTF clamps a factor above 1, so widening the ramp by lowering
    `lo` alone drags the mean under the palette's brightest channel and the
    colour silently goes dark. Bending the curve buys the same tonal range back
    at an unchanged mean -- 0.60..1.0 at gamma 0.45 has the same mean as
    0.78..1.0 straight, and nearly twice the swing between a lit facet and a
    turned-away one.
    """
    v = (lo + (hi - lo) * np.linspace(0.0, 1.0, height) ** gamma)[:, None]
    a = np.repeat(np.clip(v * 255.0, 0, 255), 8, axis=1)
    im = Image.fromarray(a.astype(np.uint8), 'L').convert('RGBA')
    buf = io.BytesIO()
    im.save(buf, format='WEBP', quality=95, method=4)
    doc['images'].append({'name': name, 'mimeType': 'image/webp',
                          'bufferView': glb.add_view(doc, views, buf.getvalue())})
    doc.setdefault('samplers', []).append({'wrapS': 33071, 'wrapT': 33071})
    doc['textures'].append({'sampler': len(doc['samplers']) - 1,
                            'source': len(doc['images']) - 1})
    return len(doc['textures']) - 1, float(a.mean() / 255.0)


def sink(pieces, surface, embed=0.006, radius=0.020, limit=0.032):
    """Drop an accessory onto the hair it rests on, as one rigid move.

    Placed at a fixed height a crown floats. The skull is not flat, so its rim
    stands clear at some azimuths, and what shows in the gap is the open
    underside of the band, which is the one thing that says "not attached" at a
    glance. The gap that first motivated this ran 2.7mm to 27.9mm with a median
    of 12.9mm; the build prints the drop it actually measures on each run, so
    read that line rather than this sentence for the current number.

    The whole piece translates; the first version moved the low vertices only
    and that stretched the band 29mm taller, turning a crown into a bucket. The
    fall is the median gap over the lowest ring, so one rim point sitting over a
    parting cannot drive it, and `limit` caps it so a bad surface read cannot
    bury the spikes. Every piece in `pieces` gets the same translation, which is
    what keeps the two shells of the band aligned.
    """
    pos = np.concatenate([p['pos'] for p in pieces])
    rim = pos[pos[:, 1] < pos[:, 1].min() + 0.008]
    gaps = []
    for v in rim:
        near = surface[(np.abs(surface[:, 0] - v[0]) < radius)
                       & (np.abs(surface[:, 2] - v[2]) < radius)]
        if len(near) >= 4:
            gaps.append(v[1] - (float(np.percentile(near[:, 1], 90)) - embed))
    if not gaps:
        return pieces, 0.0
    fall = float(np.clip(np.median(gaps), 0.0, limit))
    return ([dict(p, pos=p['pos'] - np.array([0.0, fall, 0.0])) for p in pieces],
            fall)


def landmarks(pool):
    """Body heights this outfit is measured against, found from the mesh."""
    p = pool['pos']
    torso = [(y, np.percentile(np.hypot(p[m][:, 0], p[m][:, 2]), 85))
             for y in np.arange(0.88, 1.16, 0.01)
             if (m := np.abs(p[:, 1] - y) < 0.012).sum() > 12]
    waist_y = min(torso, key=lambda t: t[1])[0]
    return {
        'waist': waist_y,
        'waist_r': dict(torso)[waist_y],
        'foot': p[:, 1].min(),
    }


def build(src, dst, manifest_path, out_manifest):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    manifest = json.load(open(manifest_path))

    # 背面的長髮要分成兩束，但要等外套穿好之後（見下方 twintail.apply 的呼叫）：
    # 馬尾掛在外套外面，軸線與彈簧的 collider 都是從外套貼合後的外殼推導的。
    # 之後任何從頭髮頂點讀座標的程式碼都要看到分好的版本；目前只有頭飾那段
    # （crown_y 讀 Hair_Back），它在更後面。
    mats = {n: add_material(doc, n, b, s) for n, (b, s) in PALETTE.items()}
    pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
    lm = landmarks(pool)
    p, added = pool['pos'], {}

    skin = doc['skins'][0]
    bones = {b['bone']: b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']}

    hip, knee, ankle = 0.843, 0.501, 0.118
    arm_r = 0.54                                   # hand x at rest, both sides

    mellow_files = [os.path.join(os.path.dirname(dst), f)
                    for f in (MELLOW, MELLOW_OUTER)]
    mellow_files = [f for f in mellow_files if os.path.exists(f)]
    mellow = bool(mellow_files)

    def put(piece, material, name, mesh='Body.baked', tag=None):
        if mellow and name in HAND_GARMENTS:
            return
        garment.attach(doc, views, mesh, piece,
                       material if isinstance(material, int) else mats[material],
                       name)
        added[tag or name] = (len(piece['tris']), mesh)

    # --- top: a bandeau, not a vest. Its upper edge stops at the frill's own
    #     height, which is what makes the frill read as the top of a garment
    #     rather than a white plank laid across the chest. Running the cloth up
    #     to the collarbone instead left the frill trapped between two white
    #     surfaces with nothing to be the edge of. ---
    torso = (p[:, 1] < 1.181) & (p[:, 1] > lm['waist'] - 0.055) & (np.abs(p[:, 0]) < 0.105)
    # Two straps over the shoulders, part of the top rather than a separate
    # accessory: the reference shows them crossing the bare shoulder ABOVE the
    # cardigan, which is the detail that makes the cardigan read as worn off the
    # shoulder instead of merely starting low. They are shelled off the body in
    # the same pass as the bodice so they wrap the trapezius instead of floating
    # over it, and they are 36mm wide, which is the width the sheet shows
    # against a 210mm shoulder span.
    strap = ((p[:, 1] > 1.168) & (p[:, 1] < 1.252)
             & (np.abs(p[:, 0]) > 0.052) & (np.abs(p[:, 0]) < 0.088))
    put(garment.shell(pool, torso | strap, 0.012), 'Milfy_White', 'Outfit_Top')

    # --- cardigan: off the shoulder. Three things make that read, and all three
    #     are subtractions: it starts below the shoulder line, it leaves the
    #     front centre open, and the sleeve begins out on the upper arm rather
    #     than at the joint. The offset is the thickness of the knit: too thin
    #     and a turning shoulder comes up through the sleeve's top edge, too
    #     thick and the sleeve is a black rod round a 30mm arm. ---
    shoulder_top = 1.215
    wrist = arm_r * 0.84                           # stop before the hand
    sleeve = ((np.abs(p[:, 0]) > 0.105) & (np.abs(p[:, 0]) < wrist)
              & (p[:, 1] > 1.155) & (p[:, 1] < shoulder_top + 0.02))
    torso_back = ((p[:, 1] < shoulder_top - 0.045) & (p[:, 1] > lm['waist'] - 0.105)
                  & (np.abs(p[:, 0]) < 0.155)
                  & ~((p[:, 2] < -0.015) & (np.abs(p[:, 0]) < 0.052)))
    cardigan = garment.shell(pool, sleeve | torso_back, 0.021)
    put(cardigan, 'Milfy_Cardigan', 'Outfit_Cardigan')

    # 前襟上的三顆鈕扣，位置從外套自己的頂點讀出來，不是猜的。第一次用固定
    # 座標 z=-0.108，結果整排被抹胸擋住：抹胸的前表面在 z=-0.123，比外套還
    # 前面，鈕扣就埋在兩層布中間了。
    cp = cardigan['pos']
    buttons = []
    near_chest = int(np.argmin(np.abs(p[:, 1] - 1.02)))
    for y in (0.945, 1.005, 1.065):
        band = cp[(np.abs(cp[:, 1] - y) < 0.022) & (cp[:, 0] < -0.020)
                  & (cp[:, 0] > -0.080) & (cp[:, 2] < 0)]
        if not len(band):
            continue
        edge = band[int(np.argmin(band[:, 2]))]
        buttons.append(garment.sphere(
            [float(edge[0]), y, float(edge[2]) - 0.005], 0.0070,
            pool['joints'][near_chest], pool['weights'][near_chest],
            lat=5, lon=8, squash=(1.0, 1.0, 0.55)))
    if buttons:
        put(garment.bind(pool, garment.merge(buttons)), 'Milfy_Bear', 'Acc_Buttons')

    # --- neck frill and its ribbon, and the sash bow at the waist. These two
    #     carry most of the character's read at a glance. ---
    neck_y = 1.243
    near_neck = int(np.argmin(np.abs(p[:, 1] - neck_y)))
    put(garment.bind(pool, garment.collar(pool, neck_y - 0.014, 0.026, 0.62)),
        'Milfy_White', 'Acc_Collar')
    # 頸部黑緞帶改由 Blender 生成，見 blender/neckribbon.py。參數化版本把蝴蝶結
    # 放在 y=1.19 的胸口，參考圖是繫在領口白色蕾絲上，兩者讀起來是不同的東西。

    # 腰間的薄荷緞帶在 blender/bow.py：兩片錐形的環、一個結、兩條放樣的帶尾。
    # 這裡走過兩次錯路，成因相同——這個算圖器不打光，讀得到的只有輪廓。參數化
    # 版本是兩顆壓扁的球；改成沿封閉路徑放樣的緞帶環之後，帶子寬過環圍出來的
    # 洞，洞閉起來又變回兩顆球。錐形是有腰身的，掐緊的那一端在輪廓上就看得見。
    bl_dir = os.path.join(os.path.dirname(dst), 'blender')
    bow_pos = []
    for stem, material, part_name, split in BLENDER_PARTS:
        path = os.path.join(bl_dir, f'{stem}.glb')
        piece = weld.part(path, skip=tuple(split))
        if piece is None:
            continue
        put(garment.bind(pool, piece), material, part_name)
        if part_name == 'Acc_Ribbon_Waist':
            bow_pos.append(piece['pos'])
        for sub_name, (sub_material, tag) in split.items():
            sub = weld.part(path, only=(sub_name,))
            put(garment.bind(pool, sub), sub_material, part_name, tag=tag)
            if part_name == 'Acc_Ribbon_Waist':
                bow_pos.append(sub['pos'])

    # --- bottom: flared skirt off the waist, hem between hip and knee, and the
    #     ruffle that hangs off it. The reference's hem is gathered cloth, and a
    #     plain cone reads as a costume prop next to it. ---
    env = envelope.load(os.path.join(os.path.dirname(dst), 'leg-envelope.json'))
    waist_y, hem_y = lm['waist'] - 0.02, hip - (hip - knee) * 0.34
    hem = garment.skirt(pool, waist_y, hem_y, flare=1.25, clear=(0.018, 0.006),
                        envelope=lambda y: envelope.radii_at(env, y))

    def drape(piece):
        """Weight a skirt so it follows the body at the top and the legs below.

        Three failures got it here. Bound rigidly to the waist, the thigh walked
        straight through the front when the hip bent. Weighting it to the two
        upper legs fixed most of that and left the waistband pierced by the
        belly, because the waistband was on `hips` while the abdomen above it is
        driven by the spine: bend at the waist and the stomach swings forward
        while the band stays behind. Widening the band twice did nothing, since
        the gap was never the problem.

        So the top of the skirt simply borrows the body's own weights from the
        skin beneath it, whatever they happen to be, and the leg weights fade in
        going down. The known cost stays: a wide stride stretches the cloth
        between the legs, because there is no bone in the middle to hold it up.
        """
        js = doc['skins'][0]['joints']
        left_j = js.index(bones['leftUpperLeg'])
        right_j = js.index(bones['rightUpperLeg'])
        q = piece['pos']
        near = ((q[:, None, :] - pool['pos'][None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
        base_j, base_w = pool['joints'][near], pool['weights'][near]

        drop = np.clip((waist_y - q[:, 1]) / max(waist_y - hem_y, 1e-6), 0.0, 1.0)
        follow = 0.75 * drop ** 1.5
        sx = np.clip(q[:, 0] / 0.12, -1.0, 1.0)
        left = (1.0 - sx) / 2.0

        joints = np.zeros((len(q), 4), dtype=np.uint16)
        weights = np.zeros((len(q), 4), dtype=np.float32)
        for i in range(len(q)):
            acc = {}
            for c in range(base_j.shape[1]):
                w = float(base_w[i, c]) * (1.0 - follow[i])
                if w > 0:
                    acc[int(base_j[i, c])] = acc.get(int(base_j[i, c]), 0.0) + w
            for j, w in ((left_j, follow[i] * left[i]),
                         (right_j, follow[i] * (1.0 - left[i]))):
                if w > 0:
                    acc[j] = acc.get(j, 0.0) + w
            top = sorted(acc.items(), key=lambda kv: -kv[1])[:4]
            total = sum(w for _, w in top) or 1.0
            for c, (j, w) in enumerate(top):
                joints[i, c] = j
                weights[i, c] = w / total
        piece['joints'], piece['weights'] = joints, weights
        return piece

    put(drape(hem), 'Milfy_White', 'Outfit_Bottom')
    put(drape(garment.frill(hem['hem'], depth=0.034, waves=15)),
        'Milfy_White', 'Acc_Frill_Hem')

    # --- the camisole's own frill, across the bust above the cardigan line ---
    put(garment.bind(pool,
                     garment.frill(garment.ring_at(pool, 1.176, max_radius=0.135,
                                                   clear=0.017),
                                   depth=0.024, waves=11, amplitude=0.006,
                                   flare=0.10)),
        'Milfy_White', 'Acc_Frill_Bust')

    # --- socks. The goal names an Outfit_Socks slot with the cuff above the
    #     knee, and the reference sheet disagrees with it: a vertical scan down
    #     the front figure's leg from the shorts hem at y=590 to the slipper at
    #     y=900 is one continuous skin tone with no cuff edge anywhere. Both are
    #     served by building the slot and letting it be deleted -- that is what a
    #     part template is for -- so the sock is here, sized off the leg, and
    #     listed as deletable like every other garment.
    #
    #     Sized from the leg's own rings rather than a cylinder: a VRoid calf is
    #     nowhere near round, and an offset shell follows the ankle taper that a
    #     tube cannot. The cuff sits 40mm above the knee joint, which is what
    #     "over the knee" means on a leg this length.
    cuff_y = knee + 0.040
    socks = ((p[:, 1] < cuff_y) & (p[:, 1] > ankle - 0.010))
    put(garment.shell(pool, socks, 0.006), 'Milfy_Sock', 'Outfit_Socks')

    # --- slippers: a rounded shell over each foot, plus two ears ---
    feet = p[:, 1] < ankle + 0.035
    shoes = [garment.shell(pool, feet, 0.014)]
    # Each ear is placed on its OWN slipper and weighted to that foot. Fixed
    # coordinates put all four at one height beside the ankles, 19mm clear of the
    # shoe, and bound every one of them to a single vertex: they rendered as four
    # loose balls floating next to the left leg and followed it around.
    for sx in (-1, 1):
        idx = np.where(feet & (np.sign(p[:, 0]) == sx))[0]
        top = float(p[idx][:, 1].max())
        near = idx[int(np.argmin(np.abs(p[idx][:, 1] - top)))]
        cx = float(np.median(p[idx][:, 0]))
        cz = float(np.median(p[idx][:, 2]))
        for ex in (-0.016, 0.016):
            shoes.append(garment.sphere(
                [cx + ex, top + 0.009, cz - 0.012], 0.013,
                pool['joints'][near], pool['weights'][near], lat=6, lon=8))
    put(garment.merge(shoes), 'Milfy_Bear', 'Outfit_Shoes')

    # 拖鞋的熊臉。兩顆眼睛與一個鼻子，貼在鞋頭外表面上。
    face_bits = []
    for sx in (-1, 1):
        cx = sx * 0.045
        for ex in (-0.017, 0.017):
            face_bits.append(garment.sphere(
                [cx + ex, 0.066, -0.128], 0.0055,
                pool['joints'][np.argmin(np.abs(p[:, 1] - ankle))],
                pool['weights'][np.argmin(np.abs(p[:, 1] - ankle))], lat=5, lon=8))
        face_bits.append(garment.sphere(
            [cx, 0.052, -0.132], 0.0065,
            pool['joints'][np.argmin(np.abs(p[:, 1] - ankle))],
            pool['weights'][np.argmin(np.abs(p[:, 1] - ankle))],
            lat=5, lon=8, squash=(1.4, 0.9, 0.8)))
    put(garment.bind(pool, garment.merge(face_bits)), 'Milfy_Ribbon', 'Acc_Bear_Face')

    # --- bandages. Three of them, asymmetric, as the reference wears them: one
    #     high on the left thigh, one up the right shin, one at the left ankle.
    #     Mirroring any of them would be wrong. ---
    def wrap(name, y, side, half_height, thickness=0.012):
        """A band round one limb, sized by everything it has to cover.

        Both earlier versions sized it from a single ring of the mesh, and both
        failed the same way. A VRoid shin carries its rings 40mm apart and some
        of them are five vertices of a UV island: the calf wrap came out 37mm
        too small and vanished inside the leg from every angle but the front.
        Measuring across the tube's whole height cannot miss the leg, and taking
        the widest radius in each half keeps the taper without letting either end
        end up inside.

        The offset is 12mm, not the 5mm that looks right on a bare leg: the sock
        is a 6mm shell over the same limb, and at 5mm the calf and ankle wraps
        ended up inside it -- present in the file, invisible in every view.

        The centre is one median for the whole span, not one per end. Measuring
        each end separately sounds better and is not: the nearest rings to the
        two ends can sit 40mm apart with different centres, and the wrap came out
        as a wedge leaning off the shin.
        """
        on = np.sign(p[:, 0]) == side
        span = on & (np.abs(p[:, 1] - y) < half_height + 0.012)
        leg = p[span]
        cx, cz = float(np.median(leg[:, 0])), float(np.median(leg[:, 2]))
        radius = np.hypot(leg[:, 0] - cx, leg[:, 2] - cz)
        lower = leg[:, 1] <= y
        r0 = float(radius[lower].max()) if lower.any() else float(radius.max())
        r1 = float(radius[~lower].max()) if (~lower).any() else float(radius.max())

        near = int(np.argmin(np.abs(p[:, 1] - y) + np.abs(p[:, 0] - cx) * 3))
        put(garment.bind(pool,
                         garment.tube([cx, y - half_height, cz],
                                      [cx, y + half_height, cz],
                                      r0 + thickness, r1 + thickness,
                                      pool['joints'][near], pool['weights'][near],
                                      segments=24, rings=3)),
            'Milfy_Bandage', name)

    wrap('Acc_Bandage_Thigh', 0.652, -1, 0.032)
    wrap('Acc_Bandage_Calf', ankle + (knee - ankle) * 0.38, 1, 0.046)
    wrap('Acc_Bandage_Ankle', ankle + 0.030, -1, 0.018)

    # --- the imported outfit. Everything it needs was measured off the two
    #     files; see outfit.py for why it is a global fit plus a per-bone
    #     correction rather than a single transform. ---
    coat_pos = []
    if mellow:
        pushed = {}
        belt_pos = []
        # part name -> {key: (vertex indices, deltas)}, filled as each garment
        # settles. Written into the mesh after the loop, because glTF wants
        # every primitive of a mesh to declare the same targets and that is only
        # knowable once every garment has been through.
        shapes = {}

        def settle(piece, clear, shift, loosen_amount, standoff_amount):
            """Run the whole placement chain on a copy, return the positions.

            The chain is shift, then hug, then loosen, then standoff; everything
            after it -- bind, drape -- assigns weights and moves nothing. It is
            a function rather than four inline statements so that the one thing
            which must NOT go through it, the shape key deltas below, is visibly
            not going through it.
            """
            work = dict(piece)
            work['pos'] = np.array(piece['pos'])
            if shift:
                work['pos'][:, 1] += shift
            moved = outfit.hug(work, pool['pos'], pool['nrm'], clear)
            if loosen_amount is not None:
                outfit.loosen(work, loosen_amount)
            if standoff_amount is not None:
                outfit.standoff(work, standoff_amount)
            return work['pos'], moved

        for path in mellow_files:
            bundle = outfit.load(path, doc, views, add_material, MELLOW_TINT,
                                 MELLOW_GAIN)
            print(f'   服裝擬合 {os.path.basename(path)}：縮放 x{bundle["scale"]:.3f}，'
                  f'對位骨最大殘差 {bundle["residual_mm"]:.2f}mm')
            items = outfit.pieces(bundle, doc, views)
            accepted = []
            for item in items:
                spec = MELLOW_PARTS.get(item['name'])
                if spec is None:
                    continue
                name, clear = spec
                shift = MELLOW_SHIFT.get(name, 0.0)
                loosen_amount = MELLOW_LOOSEN.get(name)
                standoff_amount = MELLOW_STANDOFF.get(name)
                settled, moved = settle(item['piece'], clear, shift,
                                        loosen_amount, standoff_amount)
                item['piece']['pos'] = settled
                pushed[name] = max(pushed.get(name, 0.0), moved)
                accepted.append((item, name))

            accepted_items = [item for item, _ in accepted]
            if any(item['name'] == 'Leg_belt' for item in accepted_items):
                band_name, band_clear = MELLOW_PARTS['Leg_belt']
                band_scale, _, _, thigh_diameter = outfit.fit_ring_to_limb(
                    accepted_items,
                    pool['pos'],
                    bundle['src']['materials'],
                    'Leg_belt',
                    THIGH_BAND_SOURCE_MATERIAL,
                    0.0,
                    band_clear,
                )
                print('   大腿腿帶截面縮放 '
                      f'x={band_scale[0]:.3f} z={band_scale[1]:.3f}，'
                      f'大腿直徑 {thigh_diameter[0] * 1000:.0f}x'
                      f'{thigh_diameter[1] * 1000:.0f}mm')
                for band_item in accepted_items:
                    if band_item['name'] != 'Leg_belt':
                        continue
                    final_move = outfit.hug(
                        band_item['piece'], pool['pos'], pool['nrm'],
                        THIGH_BAND_FINAL_CLEARANCE)
                    pushed[band_name] = max(pushed.get(band_name, 0.0), final_move)

            for item, name in accepted:

                # The vendor's shape keys ride ON TOP of the settled garment,
                # as the displacement fields they are. Re-settling the keyed
                # shape and subtracting was tried first and tears the mesh: hug
                # is discontinuous -- `max(margin - gap, 0)` behind a normal-
                # agreement gate -- so a vertex that flips from "clear" to
                # "pushed" jumps by the whole margin while its neighbours do
                # not, and the difference of two hugs is a field full of spikes.
                # It showed as long thin triangles fanning off the neck ribbon
                # under Breast_small, and numerically as a 7.41mm maximum on a
                # key whose mean was 0.23mm.
                keyed_deltas = {}
                for key, delta in item.get('targets', {}).items():
                    hit = np.flatnonzero(
                        np.abs(delta).max(axis=1) > glb.MORPH_EPSILON)
                    keyed_deltas[key] = (hit, delta[hit])
                # Re-bound to this body's own weights, and the skirt draped on
                # top of that, exactly as the hand-built one was. The vendor's
                # rig is discarded here on purpose: it is correct for Milfy and
                # wrong for this body, and the failure it causes is invisible
                # at rest.
                bound = garment.bind(pool, item['piece'])
                if name == 'Acc_Belt_Waist':
                    belt_pos.append(bound['pos'])
                if name == 'Outfit_Cardigan':
                    # 只留軀幹片：權重主要落在手臂／肩／手的是袖子。T-pose 的
                    # 袖口在馬尾經過肩膀的方位角上伸到半徑 0.22-0.27，瀏覽器裡
                    # 那截袖子卻是垂在身側的，算進輪廓會把馬尾第一節頂到 40cm 外。
                    lead = bound['joints'][np.arange(len(bound['joints'])),
                                           bound['weights'].argmax(axis=1)]
                    lead_name = np.array([doc['nodes'][skin['joints'][j]].get('name', '')
                                          for j in lead])
                    torso = np.array([not any(k in n for k in ('Arm', 'Hand', 'Shoulder'))
                                      for n in lead_name])
                    coat_pos.append(bound['pos'][torso])
                if name == 'Outfit_Bottom':
                    bound = drape(bound)
                at = garment.attach(doc, views, 'Body.baked', bound,
                                    bundle['materials'][item['material']], name)
                if keyed_deltas:
                    shapes[at] = keyed_deltas
                added[f'{name}#{item["prim"]}'] = (len(bound['tris']), 'Body.baked')
        print('   貼身外推最大位移：' + '，'.join(
            f'{k} {v * 1000:.0f}mm' for k, v in sorted(pushed.items())))
        # 蝴蝶結是唯一一個「戴在別的衣服上」的部件，它的 z 寫在 blender/bow.py
        # 的 OUTLINE 裡，而 OUTLINE 是量出來的常數。衣服一改，那個常數就過期，
        # 而四個約定機位都看不出來——實際發生過：整組蝴蝶結離腰封 27mm，正面
        # 看毫無異狀，側面才看得到。所以這裡拿完成後的衣面重量一次。
        if bow_pos and belt_pos:
            bow = np.concatenate(bow_pos)
            belt = np.concatenate(belt_pos)
            # 只量腰封高度那一段，不是整組。整組取最小值會被垂到裙擺的帶尾
            # 掩蓋：帶尾總有一點貼著裙子，於是「環與結浮在腰封前方」這個真正
            # 的缺陷永遠測不到。第 8 項要的是「繫在腰封上」，量的就該是繫的
            # 那一段。
            lo, hi = belt[:, 1].min(), belt[:, 1].max()
            tied = bow[(bow[:, 1] >= lo) & (bow[:, 1] <= hi)]
            near = cKDTree(belt).query(tied, k=1)[0].min() * 1000.0
            print(f'   蝴蝶結對腰封最近距離 {near:.0f}mm')
            if near > BOW_GAP_MAX:
                raise SystemExit(
                    f'蝴蝶結離腰封 {near:.0f}mm，超過 {BOW_GAP_MAX:.0f}mm：'
                    'blender/bow.py 的 OUTLINE 與現在的衣服對不上了')

        if shapes:
            names = graft_shapes(doc, views, 'Body.baked', shapes)
            moved = {k: [0, 0.0] for k in names}
            for keys in shapes.values():
                for k, (hit, delta) in keys.items():
                    if k not in moved:
                        continue
                    moved[k][0] += len(hit)
                    if len(delta):
                        moved[k][1] += float(np.linalg.norm(delta, axis=1).sum()) * 1000.0
            # Mean over the vertices it moves, not the maximum. A maximum is
            # one vertex and flatters a key that barely moves: Waist_slim's
            # 14,393 moved vertices average 0.56mm and peak at 2.01mm, and it is
            # the 0.56 that says a waist slider does almost nothing on this
            # body while the 2.01 suggests it does something. A key usually
            # lands on several garments, so the norms and the counts are summed
            # separately and divided once here -- a max over the per-garment
            # means would be neither statistic, printed under the word 平均.
            print('   服裝 shape key：' + '，'.join(
                f'{k} {moved[k][0]} 點/平均 '
                f'{(moved[k][1] / moved[k][0]) if moved[k][0] else 0.0:.1f}mm'
                for k in names))

    # --- the twintails, now that the coat they hang over has settled. ---
    coat = np.concatenate(coat_pos) if coat_pos else None
    tails = twintail.apply(doc, views, manifest['parts'], pool['pos'], coat_pos=coat)
    for name, r in tails.items():
        w = r['points']
        print(f'   {name} 位移最大 {r["moved_mm"]:.1f}mm，新骨鏈 {len(r["chain"])} 節，'
              f'軸線離身軸 {np.hypot(w[0, 0], w[0, 2]) * 1000:.0f}→'
              f'{np.hypot(w[-1, 0], w[-1, 2]) * 1000:.0f}mm')
    if coat is not None:
        # 髮束表面對外套外殼的間隙是設計出來的（TAIL_COAT_GAP），這裡量的是
        # 「還有多少髮頂點在外套輪廓裡面」。髮束的粗細取 90 百分位，所以一成的
        # 髮絲本來就會伸出設計半徑之外，允許幾毫米；但 2026-09-04 修之前是
        # 176mm／45%，門檻擋的是那個量級。
        deepest, share = twintail.coat_intrusion(doc, views, manifest['parts'], coat)
        print(f'   雙馬尾在外套輪廓內最深 {deepest:.0f}mm，≥5mm 的頂點佔 {share * 100:.1f}%')
        if deepest > TAIL_COAT_INTRUSION_MAX or share > TAIL_COAT_INSIDE_SHARE_MAX:
            raise SystemExit(
                f'雙馬尾陷進外套：最深 {deepest:.0f}mm（上限 {TAIL_COAT_INTRUSION_MAX:.0f}）、'
                f'≥5mm 佔 {share * 100:.1f}%（上限 {TAIL_COAT_INSIDE_SHARE_MAX * 100:.0f}%）；'
                'twintail.waypoints 與現在的外套對不上了')

    # --- head: bear ears, buns, crown, ahoge, clips. Bound rigidly to the
    #     head joint, which is what an accessory sitting on the skull does. ---
    hj = np.array([skin['joints'].index(bones['head']), 0, 0, 0], dtype=np.uint16)
    hw = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)

    hair = garment.body_pool(doc, views, manifest, 'Hair_Back')
    crown_y = float(np.percentile(hair['pos'][:, 1], 99))
    skull_r = 0.085

    def rigid(piece, uv=None):
        piece = dict(piece)
        n = len(piece['pos'])
        piece['joints'] = np.tile(hj, (n, 1))
        piece['weights'] = np.tile(hw, (n, 1))
        if uv is not None:
            piece['uv'] = uv
        return piece

    # UV for the pieces whose shading comes from a texture rather than a flat
    # factor. The VRoid hair map is a vertical ramp: v around 0.05 is the warm
    # sand of a root, v around 0.74 is its palest. So an ear ring runs sand at
    # the crease against the inner ear and pale at its outer rim, a bun darkens
    # towards its top, and a strand runs root to tip. u is given some lateral
    # travel so the painted strands show as streaks instead of one flat column
    # of colour. The inner ear and the crown have their own generated textures,
    # so uv_bowl and uv_round map into those instead.
    def uv_disc(pos):
        c = pos.mean(axis=0)
        d = pos - c
        radius = max(float(np.hypot(d[:, 0], d[:, 1]).max()), 1e-6)
        r = np.hypot(d[:, 0], d[:, 1]) / radius
        ang = np.arctan2(d[:, 1], d[:, 0])
        return np.stack([0.12 + 0.44 * (0.5 + 0.5 * np.cos(ang)),
                         0.14 + 0.58 * r ** 2], axis=1)

    def uv_facet(piece):
        """每個面自己的法線決定它在金色斜坡上的位置。

        先前這裡是依方位角的斜坡（uv_round）：位置連續，所以一頂外層 60 面、
        內層 40 面的冠算出來是一片平滑漸層，齒和環帶之間沒有交界，正面看就是一塊桃色
        板子。皇冠之所以讀得出來是冠，靠的是相鄰兩個面亮度突然差一階——參考
        圖裡每一支齒的兩個側面亮暗分明，那是折角不是曲面。

        法線能這樣用是因為皇冠在 Blender 裡是平面著色的：每個面自己一組頂
        點，匯出時就分開了（實測 head.glb 的 Crown 是 240 頂點 120 三角形，
        每個頂點只被兩個三角形用，同一個三角形內的法線離散為 0），所以一個
        頂點的法線就是它所屬那個面的法線，指定到頂點的 UV 等於指定到面。耳圈
        與髮髻是 shade_smooth（同一份實測，一個頂點最多被 26 個三角形共用），
        同樣的算法在那裡會被插值抹平，所以它們留在各自的鋪法。
        """
        n = piece['nrm']
        lit = n @ (np.array(CROWN_LIGHT) / np.linalg.norm(CROWN_LIGHT))
        # 攤到這一層自己的最暗與最亮之間，不是直接用 0.5+0.5*lit。斜坡的均值
        # 決定了係數（見 ramp_texture），所以斜坡只能有那麼寬；把只用到中間
        # 六成的 v 攤開，等於在同樣的均值下把可用的對比翻倍。內外兩層各自攤
        # 各自的範圍，兩層的最暗面顏色不同，本來就該分開對映。
        span = max(float(lit.max() - lit.min()), 1e-6)
        return np.stack([np.full(len(n), 0.5),
                         np.clip((lit - lit.min()) / span, 0.02, 0.98)], axis=1)

    def uv_bowl(pos):
        c = pos.mean(axis=0)
        d = pos - c
        radius = max(float(np.hypot(d[:, 0], d[:, 1]).max()), 1e-6)
        # 平面投影，不是半徑投影。照半徑鋪會讓髮絲繞成同心圓弧，一塊 25mm 的
        # 碗上讀起來是指紋；平面鋪讓髮絲跟頭髮同一個方向。
        return np.stack([np.clip(0.5 + 0.45 * d[:, 0] / radius, 0.02, 0.98),
                         np.clip(0.5 - 0.45 * d[:, 1] / radius, 0.02, 0.98)], axis=1)

    def uv_ball(pos):
        c = pos.mean(axis=0)
        d = pos - c
        radius = max(float(np.abs(d[:, 1]).max()), 1e-6)
        ang = np.arctan2(d[:, 2], d[:, 0])
        return np.stack([0.12 + 0.44 * (0.5 + 0.5 * np.cos(2 * ang)),
                         0.20 + 0.55 * (0.5 - 0.5 * d[:, 1] / radius)], axis=1)

    def uv_strand(pos):
        t = pos[:, 0]
        t = (t - t.min()) / max(float(t.max() - t.min()), 1e-6)
        return np.stack([np.full(len(pos), 0.30), 0.12 + 0.73 * t], axis=1)

    head_path = os.path.join(os.path.dirname(dst), HEAD)
    head_pieces = weld.pieces(head_path) if os.path.exists(head_path) else {}
    hair_mat = next(i for i, m in enumerate(doc['materials'])
                    if m['name'] == HEAD_HAIR)
    bowl, bowl_mean = bowl_texture(doc, views, 'Milfy_EarInner_shade')
    mats['Milfy_EarInner'] = add_material(
        doc, 'Milfy_EarInner', tuple(c / bowl_mean for c in EAR_INNER),
        tuple(c / bowl_mean for c in EAR_INNER_SHADE), texture=bowl)
    if max(doc['materials'][mats['Milfy_EarInner']]
           ['pbrMetallicRoughness']['baseColorFactor'][:3]) > 1.0:
        raise SystemExit('內耳除以貼圖均值後超過 1.0，係數會被 glTF 截掉')

    # One part per side, not one merged Hair_Bun_Ears. The template's whole
    # claim is that a tool can address a piece by name, and a single part
    # covering both sides cannot answer "remove the left bun".
    if head_pieces:
        for label in ('L', 'R'):
            ear = head_pieces[f'Ear_{label}']
            put(rigid(ear, uv_disc(ear['pos'])), hair_mat, f'Hair_Ear_{label}',
                mesh='Hair001.baked')
            inner = head_pieces[f'EarInner_{label}']
            put(rigid(inner, uv_bowl(inner['pos'])), 'Milfy_EarInner',
                f'Hair_Ear_{label}',
                mesh='Hair001.baked', tag=f'Hair_Ear_{label}#inner')
            bun = head_pieces[f'Bun_{label}']
            put(rigid(bun, uv_ball(bun['pos'])), hair_mat, f'Hair_Bun_{label}',
                mesh='Hair001.baked')
        ahoge = head_pieces['Ahoge']
        put(rigid(ahoge, uv_strand(ahoge['pos'])), hair_mat, 'Hair_Ahoge',
            mesh='Hair001.baked')
        # 補在既有材質上，不是用同名再建一份。建第二份會讓出貨檔裡出現兩個
        # Milfy_Gold，manifest 的 palette 以名字為鍵、後者蓋前者，宣告出去的
        # 底色就變成沒有人挑過也沒被算圖用到的那一組；customise.tint 又會走訪
        # 所有同名材質，一次改色寫進兩份，其中一份是死的。
        gold, gold_mean = ramp_texture(doc, views, 'Milfy_Gold_ramp',
                                      GOLD_RAMP[0], GOLD_RAMP[1],
                                      gamma=GOLD_RAMP[2])
        for name in ('Milfy_Gold', 'Milfy_GoldInner'):
            mat = doc['materials'][mats[name]]
            pbr = mat['pbrMetallicRoughness']
            pbr['baseColorTexture'] = {'index': gold}
            pbr['baseColorFactor'] = [c / gold_mean for c
                                      in pbr['baseColorFactor'][:3]] + [1.0]
            props = doc['extensions']['VRM']['materialProperties'][mats[name]]
            props['textureProperties'] = {'_MainTex': gold, '_ShadeTexture': gold}
            props['vectorProperties']['_Color'] = list(pbr['baseColorFactor'])
        for name in ('Milfy_Gold', 'Milfy_GoldInner'):
            # 兩個都要查。上面那個迴圈改的是兩個材質，守衛先前只看外層，把
            # GoldInner 調亮到 0.87 以上照樣建置成功，glTF 靜默夾成 1.0。
            if max(doc['materials'][mats[name]]
                   ['pbrMetallicRoughness']['baseColorFactor'][:3]) > 1.0:
                raise SystemExit(f'{name} 除以斜坡均值後超過 1.0，'
                                 f'係數會被 glTF 截掉')
        # 兩層用同一個髮面池沉下去。沉完才算 UV 只是順手，不是必要：uv_facet
        # 只讀法線，而 sink 是剛體平移不動法線，先算後算等價。
        skull = np.concatenate([
            garment.body_pool(doc, views, manifest, n)['pos']
            for n in ('Hair_Bangs', 'Hair_Side_L', 'Hair_Side_R', 'Hair_Back')])
        # 2026-09-02 使用者指出皇冠壓住右熊耳太多：出貨檔量到皇冠 x 質心 +0.067
        # 幾乎正對耳盤 +0.075，前視圖 x 重疊佔耳寬 84%。往中線收又往瀏海前移，
        # sink 會讓它順著瀏海坡面落定。位置常數會靜默過期（appearance_test 的
        # test_crown_rides_the_bangs_not_the_ear 釘住移完的相對關係）。
        for shell_piece in (head_pieces['Crown'], head_pieces['CrownInner']):
            shell_piece['pos'] = shell_piece['pos'] + np.array(CROWN_SHIFT)
        shells, fell = sink([head_pieces['Crown'], head_pieces['CrownInner']],
                            skull)
        print(f'   皇冠整體下沉 {fell * 1000:.0f}mm 貼上髮面')
        for piece, colour, tag in zip(shells, ('Milfy_Gold', 'Milfy_GoldInner'),
                                      (None, 'Acc_Crown#inner')):
            put(rigid(piece, uv_facet(piece)), colour, 'Acc_Crown',
                mesh='Hair001.baked', tag=tag)
    else:
        # No Blender on this machine. These are the parametric shapes the
        # measured ones replaced: a sphere with two smaller spheres stuck on
        # top for each side, and a five-spike ring with no thickness. They read
        # as coloured blocks next to the reference. They cover Hair_Bun_L/R and
        # Acc_Crown only -- Hair_Ear_L/R and Hair_Ahoge have no parametric
        # version and are simply absent on a machine without Blender, which is
        # a degraded build and not an equivalent one.
        for side, label in ((-1, 'L'), (1, 'R')):
            c = [side * skull_r * 0.92, crown_y - 0.012, 0.012]
            bun = [garment.sphere(c, 0.046, hj, hw, lat=10, lon=14,
                                  squash=(1.0, 0.94, 0.98))]
            for ear_x, ear_z in ((-0.026, -0.004), (0.026, -0.004)):
                bun.append(garment.sphere(
                    [c[0] + ear_x, c[1] + 0.036, c[2] + ear_z], 0.019, hj, hw,
                    lat=6, lon=10, squash=(1.0, 1.0, 0.62)))
            put(garment.merge(bun), 'Milfy_Hair', f'Hair_Bun_{label}',
                mesh='Hair001.baked')
        put(garment.crown([0.028, crown_y + 0.026, 0.004], 0.030, 0.036, 5, hj, hw),
            'Milfy_Gold', 'Acc_Crown', mesh='Hair001.baked')

    # 瀏海用基底 VRoid 的原生髮束，不再從臉部曲面切一片外推。外推那版是一片
    # 178 面的光滑殼，在臉部特寫裡看起來是泳帽而不是頭髮；原生瀏海本來就有
    # 分束與髮絲明暗，只是把烘在上面的髮夾貼片切成 Acc_HairClip_Base 丟掉
    # （見 partition.hair_name 與 make.DROP）。

    # Plaster clip: two crossed bars. Bear clip: a head and two round ears.
    # z 由 -0.062 移到 -0.136：髮夾別在瀏海「上面」，不是夾在瀏海和額頭中間。
    # 原本的深度會把三個髮飾整組藏到瀏海後面；-0.136 在殼狀瀏海與後來換回的
    # 原生瀏海底下都成立，臉部特寫裡三個都露在外面。
    #
    # 左右：本模型 leftUpperArm 在 x=-0.081，臉朝 -z，所以正面視角裡 +x 是畫
    # 面左側。參考的兩張插畫和 ingame/07 的實機正面都是「橫槓在畫面左、OK 繃
    # 和小熊在畫面右」，換算成 +x 橫槓、-x 小熊。原本橫槓和小熊各自擺在相反
    # 邊，三個髮飾裡只有 OK 繃是對的。
    clip_z = -0.136
    px, py = -0.016, crown_y - 0.086
    arm, wide, deep = 0.015, 0.0056, 0.0026
    # OK 繃是斜交叉的 X，兩條膠布直身圓頭，中間壓一塊較亮的紗布墊。角度取
    # official/front-back-with-cardigan.jpg，也就是本模型這個配色的那張；照
    # ingame/01 取樣過一次是錯的，那張是冰白配色的另一個版本，跟著它改成的
    # 軸對齊「＋」在臉部近拍裡和參考差得比改之前還遠。
    # 圓頭用球而不是把整條做成橢球：橢球的兩端是尖的，做出來是四角星。
    TILT = 0.55

    def bandage(rot):
        """一條膠布：直的身體，兩端各一個圓頭，整條繞 z 轉 rot。"""
        out = [garment.box([px, py, clip_z], (arm, wide, deep), hj, hw,
                           rot_z=rot)]
        for end in (-arm, arm):
            # 圓頭要跟著身體一起轉，所以端點自己算過旋轉；garment.sphere 沒有
            # rot_z，但球是旋轉對稱的，只有位置需要轉。
            out.append(garment.sphere(
                [px + end * math.cos(rot), py + end * math.sin(rot), clip_z],
                wide, hj, hw, lat=4, lon=6, squash=(1.0, 1.0, deep / wide)))
        return out

    put(garment.merge(bandage(TILT) + bandage(TILT - math.pi / 2)),
        'Milfy_Plaster', 'Acc_HairClip_Plaster', mesh='Hair001.baked')
    put(garment.box([px, py, clip_z - deep], (0.0090, 0.0066, 0.0016), hj, hw,
                    rot_z=TILT),
        'Milfy_White', 'Acc_HairClip_Plaster', mesh='Hair001.baked',
        tag='Acc_HairClip_Plaster#pad')

    bear = [garment.sphere([-0.064, crown_y - 0.078, clip_z + 0.010], 0.015,
                           hj, hw, lat=6, lon=10)]
    for ex in (-0.013, 0.013):
        bear.append(garment.sphere([-0.064 + ex, crown_y - 0.067, clip_z + 0.010],
                                   0.007, hj, hw, lat=4, lon=6))
    put(garment.merge(bear), 'Milfy_Bear', 'Acc_HairClip_Bear', mesh='Hair001.baked')
    # 兩眼一鼻。少了這三點，小熊在近拍裡是一顆長了兩隻耳朵的白球，而參考圖上
    # 它是有臉的——這是整個頭部特寫裡最便宜的一項辨識度。
    face = [garment.sphere([-0.064 + ex, crown_y - 0.079 + ey, clip_z - 0.004],
                           r, hj, hw, lat=3, lon=5)
            for ex, ey, r in ((-0.005, 0.003, 0.0022), (0.005, 0.003, 0.0022),
                              (0.000, -0.002, 0.0026))]
    put(garment.merge(face), 'Milfy_Ink', 'Acc_HairClip_Bear',
        mesh='Hair001.baked', tag='Acc_HairClip_Bear#face')

    # 兩條不是三條，改細改深。官方圖上這一組是兩條炭黑細槓；先前是三塊 7mm
    # 厚的純白方塊，在近拍裡像三張貼紙。
    bars = [garment.box([0.047, crown_y - 0.112 + i * 0.012, clip_z + 0.018],
                        (0.019, 0.0022, 0.004), hj, hw, rot_z=0.12)
            for i in range(2)]
    put(garment.merge(bars), 'Milfy_Ink', 'Acc_HairClip_Bars', mesh='Hair001.baked')

    # --- hair colour. It lives in six textures, not in a material factor, so
    #     the only way to move it is to rotate the textures themselves. The base
    #     model is pink at hue 350 / sat 0.49 / lightness 0.71; the reference is
    #     a pale sand around hue 33 / sat 0.24 / lightness 0.79. ---
    for i in range(1, 7):
        customise.hue(doc, views, f'F00_000_Hair_00_0{i}',
                      HAIR_SHIFT, HAIR_SAT, lift=HAIR_LIFT, unify=HAIR_UNIFY,
                      flatten=HAIR_FLATTEN_BLOCKS)

    # --- brows. The base model's are periwinkle, hue 250, to go with pink hair;
    #     the reference's are a warm grey-brown. They are their own texture, so
    #     this is one rotation and not a repaint. ---
    customise.hue(doc, views, 'F00_000_00_FaceBrow_00', BROW_SHIFT, BROW_SAT)

    # --- the scalp cap. It is HAIR, and it lives in the face's skin texture.
    #     VRoid paints it there so a parting shows hair rather than scalp, which
    #     means every step that treats that atlas as skin also drags the cap
    #     along: the first Milfy build rotated it by the SKIN solve and shipped a
    #     violet cap under blonde hair, visible through every parting. It is
    #     recoloured here, onto the hair's OWN post-transform median rather than
    #     onto a colour written down beside it, and the mask is taken now so the
    #     skin solve below can exclude the same pixels. ---
    #     The cap has an edge. Its anti-aliased boundary blends the paint into
    #     the skin, and those texels belong to neither solve: rotated with the
    #     core they turn green (a blend rotated by the core's angle), rotated
    #     with the skin they turn mauve (the 09-03 build, seen as purple lines
    #     at the nape on 09-04). They are kept out of both and painted LAST, as
    #     the same mix of solved hair and solved skin they were in the source
    #     (customise.blend_fringe); their mix is read now, before anything
    #     moves. ---
    face_rgba = customise.image_rgba(doc, views, 'F00_000_00_Face_00')
    cap, cap_fringe = customise.hair_paint_pixels(
        face_rgba[..., :3], face_rgba[..., 3], SCALP_HUE, SCALP_WINDOW,
        fringe_to=SCALP_FRINGE_TO, fringe_min_sat=SCALP_FRINGE_SAT)
    cap_weight = customise.paint_weights(face_rgba[..., :3], face_rgba[..., 3],
                                         cap, cap_fringe)
    scalp = cap | cap_fringe
    hair_med = customise.median_hue(
        doc, views, [f'F00_000_Hair_00_0{i}' for i in range(1, 7)])
    deg, sat, light, lift, shift = customise.retone(
        doc, views, 'F00_000_00_Face_00', tuple(hair_med),
        stat=cap, where=cap)
    print(f'   頭皮色塊 {int(cap.sum())} px → 髮色 '
          f'{tuple(int(v) for v in hair_med)} 轉色相 {deg:+.1f}° 飽和 x{sat:.2f} '
          f'明度 x{light:.2f} 提亮 {lift:.2f} 位移 {shift:+.3f}；'
          f'邊緣 {int(cap_fringe.sum())} px 留到最後混色')

    # --- the nape. The same paint in the BODY atlas: VRoid draws the base
    #     hairstyle's nape strands as two hair-coloured strips down the back of
    #     the neck. The 09-03 fix never looked in this atlas, the skin solve
    #     barely moves a hue that far from skin, and the two strips shipped
    #     violet, running from under the hair down both sides of the neck. They
    #     are not a parting -- this hairstyle covers the nape with its own hair
    #     -- so they are filled from the skin around them here, before the skin
    #     solve, and go through it as skin. ---
    body_rgba = customise.image_rgba(doc, views, 'F00_000_00_Body_00')
    nape_core, nape_fringe = customise.hair_paint_pixels(
        body_rgba[..., :3], body_rgba[..., 3], SCALP_HUE, SCALP_WINDOW,
        fringe_to=SCALP_FRINGE_TO, fringe_min_sat=SCALP_FRINGE_SAT)
    filled = customise.fill_from_surroundings(
        doc, views, 'F00_000_00_Body_00', nape_core | nape_fringe)
    print(f'   後頸髮根條 {filled} px（核心 {int(nape_core.sum())}）填回周圍膚色')

    # --- skin. Two textures, one skin, so ONE solve across both. Solving each
    #     atlas against the target separately is what desaturated the face: the
    #     face atlas's median carries the lips, the brows and the blush and sits
    #     well below its own visible cheek, so its offset came out larger, and an
    #     offset that lands the visible face at lightness 0.99 leaves chroma a
    #     ceiling of 2(1-l) whatever saturation asks for. Measured on the shipped
    #     2026-09-03 build: visible face (232, 231, 229) against a neck at
    #     (231, 209, 202), built from a source whose face reads (231, 210, 204).
    #     The scalp cap is out of both the sample and the transform: it has just
    #     been solved onto the hair and must not be moved again. ---
    skin_names = ('F00_000_00_Face_00', 'F00_000_00_Body_00')
    stats = {n: customise.image_rgba(doc, views, n)[..., 3] > 200 for n in skin_names}
    stats['F00_000_00_Face_00'] &= ~scalp
    deg, sat, light, lift, shift = customise.retone_together(
        doc, views, skin_names, SKIN_TARGET, stats=stats,
        wheres={'F00_000_00_Face_00': ~scalp})
    print(f'   膚色 {sum(int(m.sum()) for m in stats.values())} px（臉與身共用一組解）'
          f' 轉色相 {deg:+.1f}° 飽和 x{sat:.2f} '
          f'明度 x{light:.2f} 提亮 {lift:.2f} 位移 {shift:+.3f}')
    # --- the neck. VRoid paints a band of permanent shadow round the throat,
    #     from the collarbone up under the jaw, because the base model wears a
    #     collar and it is never seen. This one wears a scoop neck, so it is on
    #     screen from the first frame, and this renderer draws no shading of its
    #     own there: a white-albedo render puts the face and the neck at the same
    #     (226, 229, 229), so the painted band is the whole of what the eye gets.
    #     Shipped 2026-09-03 it read (243, 187, 174) against a face at
    #     (252, 232, 226), delta-E 20 in the texture and 14.4 on screen, which is
    #     the "脖子的膚色跟臉的膚色不一致" this fixes.
    #
    #     The band crosses BOTH atlases -- the face mesh keeps a stub of neck
    #     below the jaw -- so both are lifted by one solve against one target.
    #     Lifting only the body's half moves the mismatch onto the seam instead
    #     of removing it, which is what the first attempt did (seam delta-E 1.0
    #     to 8.9, and a visible step 5 mm under the jaw).
    #
    #     Rig landmarks, not written-down heights: the band runs from the neck
    #     bone to the head bone, with NECK_MARGIN of overshoot at each end so the
    #     feather has somewhere to land. ---
    world = render.world_matrices(doc)
    bones = {b['bone']: b['node'] for b in doc['extensions']['VRM']['humanoid']['humanBones']}
    neck_y = float(world[bones['neck']][1, 3])
    head_y = float(world[bones['head']][1, 3])
    lo, hi = neck_y - NECK_MARGIN, head_y + NECK_MARGIN
    weights, band_px = {}, {}
    for mesh_name, mat_name, image in (
            ('Face.baked', 'F00_000_00_Face_00_SKIN', 'F00_000_00_Face_00'),
            ('Body.baked', 'F00_000_00_Body_00_SKIN', 'F00_000_00_Body_00')):
        mesh = next(m for m in doc['meshes'] if m.get('name') == mesh_name)
        shape = customise.image_rgba(doc, views, image).shape[:2]
        uvs, tris, base = [], [], 0
        for p in mesh['primitives']:
            if doc['materials'][p['material']].get('name') != mat_name:
                continue
            pos = glb.read_accessor(doc, views, p['attributes']['POSITION'])
            uv = glb.read_accessor(doc, views, p['attributes']['TEXCOORD_0'])
            idx = glb.read_accessor(doc, views, p['indices']).reshape(-1, 3).astype(int)
            band = (pos[:, 1] >= lo) & (pos[:, 1] <= hi)
            keep = band[idx].all(axis=1)
            uvs.append(uv)
            tris.extend(idx[keep] + base)
            base += len(uv)
        if not tris:
            raise SystemExit(f'{mesh_name} 在頸部帶裡取不到三角形')
        weights[image] = customise.uv_mask(shape, np.concatenate(uvs), tris)
        band_px[image] = int((weights[image] > 0.5).sum())

    # The target is the skin OUTSIDE the band, over both atlases together: the
    # chest, the arms and the face, which is the tone the neck has to disappear
    # into. Taking it from one atlas would put the other one's half of the band
    # somewhere else.
    outside = []
    for image in weights:
        a = customise.image_rgba(doc, views, image)
        pick = (a[..., 3] > 200) & (weights[image] < 0.01)
        if image == 'F00_000_00_Face_00':
            pick &= ~scalp
        outside.append(a[..., :3][pick])
    neck_target = np.median(np.concatenate(outside), axis=0)
    for image, weight in weights.items():
        off, n = customise.lift_region(doc, views, image, weight, neck_target)
        print(f'   頸部帶 {image} {band_px[image]} px 最暗十分位抬升 {off:+.3f}')

    print(f'   頸部目標 ({neck_target[0]:.0f}, {neck_target[1]:.0f}, {neck_target[2]:.0f})'
          f' 取自帶外的皮膚')
    # The cap's edge, last: both sides of it are now their final colours.
    blended = customise.blend_fringe(doc, views, 'F00_000_00_Face_00',
                                     cap, cap_fringe, cap_weight)
    print(f'   頭皮蓋邊緣 {blended} px 依來源的髮／膚比例混色')

    deg, sat, light, lift, shift = customise.retone(
        doc, views, 'F00_000_00_EyeIris_00', EYE_TARGET, mid=(60, 215))
    print(f'   F00_000_00_EyeIris_00 轉色相 {deg:+.1f}° 飽和 x{sat:.2f} '
          f'明度 x{light:.2f} 提亮 {lift:.2f} 位移 {shift:+.3f}')

    skin_materials = customise.tone_textured_materials(
        doc,
        {'F00_000_00_Face_00', 'F00_000_00_Body_00'},
        SKIN_MATERIAL_TONE,
    )
    hair_materials = customise.tone_textured_materials(
        doc,
        {f'F00_000_Hair_00_0{i}' for i in range(1, 7)},
        HAIR_MATERIAL_TONE,
        shade=HAIR_SHADE_TONE,
    )
    print(f'   膚色 MToon 乘色 {SKIN_MATERIAL_TONE}，改了 {len(skin_materials)} 個材質')
    print(f'   髮色 MToon 乘色 {HAIR_MATERIAL_TONE} 陰影 {HAIR_SHADE_TONE}，'
          f'改了 {len(hair_materials)} 個材質')

    # --- outlines. Everything above moved colour that a texture or a factor
    #     carries; this moves the one that the second draw pass carries. ---
    moved = customise.outline(doc, OUTLINE_COLOR, skip=OUTLINE_KEEP)
    was = sorted({tuple(w) for _, w in moved if w is not None})
    print(f'   描邊統一為 {OUTLINE_COLOR}，改了 {len(moved)} 個材質，'
          f'原本有 {len(was)} 種：{was}')
    rimmed = customise.rim(doc, RIM_COLOR)
    print(f'   邊光宣告為 {RIM_COLOR}，寫進 {len(rimmed)} 個材質')

    # Last, after every branch has had its chance to use one.
    gone = customise.sweep_materials(doc)
    if gone:
        print(f'   掃掉沒有網格用的材質 {len(gone)} 個：{gone}')

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)

    # Rebuild the manifest from the file we just wrote, not from the one we
    # read. Indices recorded before the strip step are stale by exactly the
    # number of primitives that step removed, and a stale index is how a
    # downstream delete takes its neighbour with it.
    locked = {'Face', 'Body_Skin'}
    parts = {}
    for mesh in doc['meshes']:
        mname = mesh.get('name')
        if mname == 'Face.baked':
            parts['Face'] = {
                'mesh': mname,
                'primitives': list(range(len(mesh['primitives']))),
                'tris': sum(doc['accessors'][pr['indices']]['count'] // 3
                            for pr in mesh['primitives']),
                'materials': sorted({doc['materials'][pr['material']]['name']
                                     for pr in mesh['primitives']}),
                'deletable': False,
                'note': 'carries the 56 morph targets; splitting it breaks blendShapeMaster',
            }
            continue
        for i, pr in enumerate(mesh['primitives']):
            label = pr.get('extras', {}).get('part')
            if label is None:
                continue
            e = parts.setdefault(label, {
                'mesh': mname, 'primitives': [], 'tris': 0,
                'materials': [], 'deletable': label not in locked,
            })
            e['primitives'].append(i)
            e['tris'] += doc['accessors'][pr['indices']]['count'] // 3
            mat = doc['materials'][pr['material']]['name']
            if mat not in e['materials']:
                e['materials'].append(mat)
    for e in parts.values():
        e['materials'].sort()

    # The slot a swap tool addresses. Every part name here is already one slot,
    # which is the point of the naming rule; `group` says which of them are
    # alternatives to each other, so a tool can offer "another Outfit_Bottom"
    # without a hardcoded list, and `locked` parts are the ones with nothing to
    # swap in -- the body and the face, whose morph tables the rest depends on.
    group_of = {'Outfit': 'outfit', 'Acc': 'accessory', 'Hair': 'hair',
                'Body': 'body', 'Face': 'face'}
    for name, e in parts.items():
        e['slot'] = name
        e['group'] = group_of.get(name.split('_')[0], 'other')
    manifest['parts'] = parts

    # Read back off the finished model, not off the constants above. The
    # manifest's whole claim is that a swap tool can drive the model from it,
    # and listing the constants let it drift: after the imported outfit took
    # over, the palette still advertised Milfy_Cardigan, Milfy_Ribbon,
    # Milfy_Bandage and Milfy_Sock, which no part used any more, and said
    # nothing about the eight Mellow_* materials that actually carried the
    # colour. The self-test retinted names that painted nothing and passed.
    by_name = {m['name']: m for m in doc['materials']}
    shade_of = {m['name']: m.get('vectorProperties', {}).get('_ShadeColor')
                for m in doc['extensions']['VRM']['materialProperties']}
    manifest['palette'] = {}
    for name in sorted({m for e in parts.values() for m in e['materials']}):
        if not name.startswith(('Milfy_', 'Mellow_')):
            continue     # the VRoid body, face and hair are coloured in texture
        base = by_name[name]['pbrMetallicRoughness']['baseColorFactor'][:3]
        shade = (shade_of.get(name) or list(base) + [1.0])[:3]
        manifest['palette'][name] = {
            'base': [round(float(v), 4) for v in base],
            'shade': [round(float(v), 4) for v in shade],
            'parts': sorted(n for n, e in parts.items() if name in e['materials']),
        }
    # Shape keys, read back the same way and for the same reason. A key is only
    # reachable if a tool knows its name, which mesh carries it and which parts
    # it moves; without that the customiser's only option is to drive all of
    # them and watch. `mm` is the mean displacement over the vertices the key
    # actually moves, which is the number that says whether a slider does
    # anything -- a maximum is one vertex and flatters a key that barely moves.
    # One part can span several primitives, so the sum of displacements and the
    # count of moved vertices are accumulated separately and divided once at the
    # end. Taking a max over the per-primitive means instead would report a
    # number that is neither a mean nor a maximum, and nothing downstream could
    # say which.
    manifest['shapes'] = {}
    part_of = {}
    for pname, e in parts.items():
        for pi in e['primitives']:
            part_of[(e['mesh'], pi)] = pname
    for mesh in doc['meshes']:
        names = mesh.get('extras', {}).get('targetNames') or []
        if not names or mesh.get('name') == 'Face.baked':
            continue     # Face.baked's 56 are expressions, in blendShapeMaster
        for ti, key in enumerate(names):
            moves = {}
            for pi, pr in enumerate(mesh['primitives']):
                targets = pr.get('targets') or []
                if ti >= len(targets) or 'POSITION' not in targets[ti]:
                    continue
                d = glb.read_accessor(doc, views, targets[ti]['POSITION'])
                mag = np.linalg.norm(d.astype(np.float64), axis=1)
                hit = mag > glb.MORPH_EPSILON
                if not hit.any():
                    continue
                where = part_of.get((mesh.get('name'), pi), f'primitive {pi}')
                prev = moves.get(where, (0, 0.0))
                moves[where] = (prev[0] + int(hit.sum()),
                                prev[1] + float(mag[hit].sum()) * 1000.0)
            manifest['shapes'][key] = {
                'mesh': mesh.get('name'),
                'index': ti,
                'parts': {k: {'vertices': n, 'mm': round(total / n, 2)}
                          for k, (n, total) in sorted(moves.items())},
            }

    manifest['landmarks'] = lm
    # Written in a fixed key order. Python dicts keep insertion order, and every
    # section here is ASSIGNED rather than created fresh -- so a key that some
    # earlier stage already put in the manifest keeps its old slot while a new
    # one lands at the end. Building from a clean out/ therefore produced the
    # same manifest with `shapes` and `palette` swapped: identical content, but
    # the `shapes` block moving wholesale, 78 lines deleted and 78 re-added.
    # Nothing reads the order, but a shipped file that reorders itself depending
    # on what was on disk is a diff no one can dismiss at a glance.
    #
    # Sorted rather than picked from a white-list. A white-list pins the order
    # just as well and silently DROPS any section a future stage adds, which is
    # a worse failure than the one being fixed here: the reorder was loud and
    # cost a diff, a dropped section is invisible and nothing downstream would
    # catch it (verify.py never opens this file, and selftest only reads parts,
    # palette and shapes). Unknown keys sort to the tail, in name order, so they
    # survive and are still deterministic.
    ORDER = ('source', 'parts', 'palette', 'shapes', 'landmarks')
    manifest = dict(sorted(manifest.items(),
                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER
                                           else len(ORDER), kv[0])))
    json.dump(manifest, open(out_manifest, 'w'), indent=2, ensure_ascii=False)
    return added, size, lm


if __name__ == '__main__':
    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    print(f'wrote {sys.argv[2]} ({size} bytes)')
    print(f'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}')
    for k, (v, mesh) in added.items():
        print(f'  + {k:<22} {v:>6} tris  -> {mesh}')
