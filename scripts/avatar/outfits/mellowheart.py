"""MellowHeart's bodice set and cardigan, as an outfit contract.

Two kinds of value live here and the line between them matters. The first is the
package: its files, its bonemap, the vendor's own mesh and material names, and
the colours and exposures chosen for its greyscale maps. Swap the outfit and
every one of those is gone, because they are spelled in the vendor's vocabulary.

The second is under FIT below, and it is this package ON this body. Those are
keyed by OUR part names, so the keys survive an outfit swap while the numbers
survive neither an outfit swap nor a body swap: a clearance is how far a garment
has to stand off a particular pair of hips. docs/plans/avatar-build-module-contracts.md
calls that the double-axis cell, and the reason it is a labelled section rather
than a second module is that there is no honest single owner to give it to.

These values lived in build.py until 2026-09-11, under names prefixed MELLOW_.
The prefix is gone because a contract a second outfit can fill cannot be spelled
in the first one's name; nothing else about them changed.
"""
import os


# The imported outfit, if it has been converted. Every garment build.py builds
# by hand is a stand-in for it, so when the file is there they step aside:
# wearing both would put two skirts and two bodices on the same body, each
# hugging the same skin and z-fighting the other. Hair, head accessories, body
# and face are unaffected -- the package does not ship those.
# Two files, because the package ships the bodice set and the cardigan as
# separate FBXs with separate armatures; see blender/mellow.py. A tuple rather
# than two names, because the next outfit may ship one file or three.
FILES = ('blender/mellow.glb', 'blender/mellow_outer.glb')

# The vendor's bonemap file: the one name the generic table cannot read (the
# thumb) and, more importantly, the ignore list that keeps the cardigan's
# forearm, hand and thumb OFF the fit anchors. Emptying that ignore list
# re-fits the cardigan on sixteen bones and a grafted shape key flips faces at
# the left armpit, with the translation-only fit and with the rotation-aware
# one alike (evidence/bonemap-0905-16anchors.log, evidence/restpose-0905.md);
# dropping the whole file would fit on fourteen (no thumb alias), a build
# nobody has run.
BONEMAP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       'bonemap', 'mellowheart.json')

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
PARTS = {'Inner': ('Outfit_Top', 0.010), 'Skirt': ('Outfit_Bottom', 0.014),
                'Socks': ('Outfit_Socks', 0.010), 'Shoes': ('Outfit_Shoes', 0.009),
                'Main_Ribbon': ('Acc_Ribbon_Neck', 0.012),
                'Belt': ('Acc_Belt_Waist', 0.020),
                'Leg_belt': ('Acc_Bandage_Thigh', 0.003),
                'Outer': ('Outfit_Cardigan', 0.020)}

# Its base maps are greyscale -- the vendor colours them in a Unity shader from
# a mask -- so the colour is ours to choose and it stays on named materials.
TINT = {
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
GAIN = {
    'Skirt_Cloth': (0.55, 0.83),
    'Shoes': (0.55, 0.83),
    'Outer': (0.55, 0.64),
    'Belt_Acc': (0.55, 0.68),
    'Leg_Acc': (0.55, 0.62),
    'Jewel': (0.55, 0.45),
}


# ---------------------------------------------------------------------------
# FIT: this outfit on this body.
#
# Every number below was measured with MellowHeart on Mika. Change either and
# they are not measurements any more, they are leftovers. The keys are our part
# names rather than the vendor's, which is what makes them look reusable and is
# exactly why this banner is here.
# ---------------------------------------------------------------------------

# 沿 y 平移，套在擬合之後、貼身之前。大腿繃帶是唯一需要的一件：廠商把它放在
# Milfy 自己的大腿中段，本模型過了 proportion 之後裙襬落在 y=0.693，繃帶原位
# 0.668-0.729 有六成埋在裙子裡，正面只露出 25mm 的一條。往下 45mm 讓它整條落
# 在裸露的大腿上，也就是參考圖上它該在的位置。
SHIFT = {'Acc_Bandage_Thigh': -0.045}
THIGH_BAND_SOURCE_MATERIAL = 'Leg_Acc'

# Extra room a garment needs for the poses rather than for the rest pose, ramped
# from nothing at its top to this at its hem. See outfit.loosen.
LOOSEN = {'Outfit_Bottom': 0.005}

# 外套的動作間隙。跟 loosen 是同一類需求（rest 量不到、動作才拖出來的穿模），
# 但機制不能共用：外套有 13% 頂點是法線朝內的 teal 內裡 shell，沿自身法線外推
# 會把內裡推「進」襯衫，modelPose 兩側胸口的鋸齒 teal 三角就是內裡刺穿襯衫。
# 所以走 outfit.standoff：法線帶符號（內裡翻向，與外層平行同向移動，厚度不變）、
# 只取水平分量（肩頂法線朝上，自然當錨點，領口不浮）、|x| 羽化排除袖管（袖子
# 沒有病灶；軀幹片延伸到 |x|≈0.30，羽化帶 0.26-0.32 刻意跨在軀幹與袖管的交界
# 上，讓被推的軀幹片在接縫前就漸縮到零，不在肩袖交界留下階梯）。10mm 是
# akimbo 腰際手掌穿出與 modelPose 胸口內裡兩處都蓋掉的量，疊在 hug 的 20mm
# rest 間隙之上。
STANDOFF = {'Outfit_Cardigan': 0.010}

# 匯入服裝綁定後的權重擴散次數（garment.smooth_weights 的 passes），按部件。最
# 近頂點抄權重在身體的皺褶處會跳：腋下一個袖子頂點最近的皮膚是肋骨、隔壁那個
# 是上臂，權重在一條邊上從全胸跳到全臂，手臂一放下一條 11mm 的邊被拉到 74mm
# ——使用者 2026-09-06 回報的兩側腋下黑色與薄荷色碎片，跳舞時放下手臂就出現，
# T-pose 的四個機位與六道 gate 全看不到。16 次是真蒙皮量出來的：外套最壞的邊
# 0 次 77mm、4 次 27mm、16 次 15mm（身體自己的皮膚腋下 15mm、手肘 17mm），再
# 多就開始被四槽上限吃掉權重（evidence/armpit-0906.md）。
# 只給跨過腋下的兩件上身衣。貼著肢體的管狀件（襪、鞋、腿帶、腰封）本來就沒有
# 皺褶要跨，抄最近頂點就是對的；把襪子也擴散過，膝蓋一彎小腿就從襪子穿出來
# （motion gate scratchHead t=4.02s 從 5px 變 233px）。守衛：撕裂在
# verify.torn_bindings，穿模在 motion.py。
BIND_SMOOTH = {'Outfit_Cardigan': 16, 'Outfit_Top': 16}

THIGH_BAND_FINAL_CLEARANCE = 0.004

