"""Mika, as the set of values that are hers rather than the pipeline's.

Every number here was measured off her reference sheets or off a render of her,
and the comment above each one says how. They lived in build.py until
2026-09-11, where they sat between the outfit package's numbers and the
pipeline's thresholds with nothing marking which was which; the split and the
reason for it are in docs/plans/avatar-build-module-contracts.md.

One value here is derived, and the line between it and the one that is not is
worth stating. `RIM_COLOR` reads this file's own PALETTE and nothing else, so it
is hers whichever way you compute it and it lives here. `OUTLINE_COLOR` also
reads OUTLINE_CHROMA_MAX, a cap on how colourful ANY outline may be, which is
the pipeline's rule rather than hers; it is not in this file, and build.py
derives it from whichever character it is handed.

A second character is a second module shaped like this one. build.py takes it as
a parameter and reads nothing from here by name.
"""

# 頭上的獸耳、髮髻、皇冠、呆毛都在這一個檔裡，見 blender/head.py。
HEAD = 'blender/head.glb'

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

# 前綴。出貨檔裡的材質分三種來源：底模自己畫的（VRoid 的 F00_000_*）、服裝包帶
# 進來的，以及這裡這一組。manifest 的 palette 只收後兩種，因為只有它們是用
# baseColorFactor 上色、可以被換色工具改；底模那些顏色畫在貼圖裡，改 factor 沒
# 用。前綴是這個分類的判準，所以它跟 PALETTE 是同一件事的兩半。
MATERIAL_PREFIX = 'Milfy_'

# 哪個部件塗哪一格。build() 知道自己正在做哪個部件，但「那個部件在這個角色身上
# 是什麼顏色」和 PALETTE 的值是同一種決定，所以兩者放在一起。鍵是角色無關的角
# 色名（role），值必須是 PALETTE 的鍵。
#
# 之所以不讓 build() 直接寫 'Milfy_White'：那些名字是這個角色的詞彙，而
# build() 裡的 `mats[...]` 查的就是它，第二個角色只要不沿用同一組名字就是
# KeyError。這與底模軸二十四處 inline 的 VRoid 名字是同一類耦合，那一類已經由
# bodies_test 的 `assertNotIn('F00_000', source())` 擋住，這裡對應的那條在
# characters_test。
MATERIALS = {
    'cloth':      'Milfy_White',      # 上衣、領子、裙襬、兩圈荷葉邊、OK 繃襯底
    'cardigan':   'Milfy_Cardigan',
    'sock':       'Milfy_Sock',
    'bandage':    'Milfy_Bandage',    # 大腿、小腿、腳踝三圈
    'bear':       'Milfy_Bear',       # 鈕扣、鞋、熊髮夾的身體
    'ribbon':     'Milfy_Ribbon',     # 熊臉
    'ink':        'Milfy_Ink',        # 熊的五官與橫槓髮夾
    'plaster':    'Milfy_Plaster',
    'gold':       'Milfy_Gold',       # 皇冠外側；斜坡貼圖也以它命名
    'gold_inner': 'Milfy_GoldInner',  # 皇冠齒縫露出來的內側面
    'hair':       'Milfy_Hair',       # 兩顆髮髻
    # 這一格不在 PALETTE 裡：內耳的底色由 EAR_INNER 除以碗狀貼圖的均值算出來，
    # build() 當場建材質而不是查 PALETTE。名字仍然是這個角色的詞彙，所以放這裡。
    # 碗狀貼圖也以它命名，跟金色斜坡同一條規則。
    'ear_inner':  'Milfy_EarInner',
}
