"""頭上的四樣：獸耳、髮髻、皇冠、呆毛。

前一版是參數化的球體堆疊，和參考圖差最遠的就是這裡。原本的「耳朵」是髮髻球
頂上黏兩顆小球——一邊兩隻、長在正頂端、而且是無貼圖的平色塊。實際量過的形
狀完全是另一回事：

  獸耳    一對直徑 82mm 的圓耳，長在頭殼上緣兩側。它不是扁球，是「厚圓環 +
          凹碗」：外圈是一道圓潤的邊，中間內耳往內凹進去，顏色比髮色暗約 7%
          且偏粉。ingame/01-front-closeup.png 把這個凹陷拍得最清楚——那張是
          實際模型的近拍，凸起的墊子和凹進去的碗在斜光下差很多。
  髮髻    雙馬尾根部的小結，在腦後，不是頭頂。
  皇冠    上寬下窄的錐形環帶加五支寬楔形齒，齒約佔總高的六成七，往模型右側
          傾 34 度、再往後仰 19 度，下緣埋進頭髮裡。後仰不是為了好看：正面看過
          去，只有仰角能把對面那半圈的內壁抬到近側齒縫之上，齒縫裡才看得到
          那片明顯較暗的內側（亮面 237,211,184、暗面 163,134,121）。沒有仰
          角時內外兩層都做了、正面卻一個內面像素都看不到，整頂冠是一塊通道
          標準差為 0 的色片——和先前那塊平色內耳是同一個毛病。
  呆毛    一撮從頭頂繞一個圈落到模型左側的髮束，整條在瀏海與耳朵之前。

尺寸由 official/quest-two-colors-head.jpg 與 ingame/07-front-fullbody-pair.png
兩邊換算後取值，不是目測：前者瀏海輪廓寬 325px，本模型 Hair_Bangs 寬 180mm，
得 0.554 mm/px；後者是實際模型的正面，用來校正插畫拉長的部分（耳心高度、呆
毛大小兩項插畫都偏大）。左右靠 leftUpperArm x=-0.081 定錨——本模型臉朝 -z、
模型左手在 -x，所以正面視角裡畫面左側是模型的右側（+x）。

UV 不在這裡做。這裡只出幾何。耳圈、髮髻與呆毛的 UV 由 build.py 算進 VRoid 的髮
絲貼圖，這樣髮色的色相旋轉一次就把它們一起帶到；內耳與皇冠有自己生成的貼圖，
理由見 build.py 的 EAR_INNER 與 GOLD_RAMP。
"""
import math
import os
import sys

import bpy
import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit  # noqa: E402

OUT = sys.argv[-1]

# --- 獸耳。剖面寫成 (半徑, 軸向)，軸向負值朝模型正面。---
EAR_X, EAR_Y, EAR_Z = 0.076, 1.535, 0.010
EAR_YAW = math.radians(18.0)          # 往外側轉，耳片才不是正對鏡頭的死板圓
                                      # （yaw 的正負在下面取 -side，+x 的右耳要負角）
# 20 邊在臉部特寫與 three-vrm 近拍上都看得到折角，參考的耳圈是平滑的。
EAR_SEG, INNER_SEG = 26, 18
# 外圈：由內緣往正面翻過圓邊，再繞到背面收成一個丘。
# 內緣 0.030／外緣 0.041：內碗佔耳寬 73%，參考圖上外圈是一道細月牙而不是等寬
# 的粗環，先前 0.026 讓外圈厚得像橡膠墊圈。
EAR_RING = [(0.030, 0.002), (0.034, -0.005), (0.038, -0.009), (0.041, -0.003),
            (0.041, 0.006), (0.034, 0.013), (0.020, 0.018), (0.000, 0.020)]
# 內耳：一塊淺碗，邊緣正好接上外圈的內緣。
EAR_BOWL = [(0.000, 0.012), (0.012, 0.011), (0.022, 0.007), (0.030, 0.002)]

# --- 髮髻：雙馬尾根部量到的位置 ---
BUN_X, BUN_Y, BUN_Z = 0.049, 1.478, 0.088
BUN_R = 0.026

# --- 皇冠 ---
# 位置與尺寸都以耳朵當比例尺量 ingame/07 的實機正面，因為耳徑 82mm 這一項先
# 對上了。實機量到冠寬是耳徑的 0.84、冠高 0.94，橫向幾乎壓在耳朵前面。
#
# 這個比例讀錯過一次：某一輪把並排圖的裁切尺度算錯，得出「冠寬 0.92、冠高
# 0.89、做出來高了兩成六」，並照那組數字把冠壓矮。重量之後那組數字是錯的，
# 已經作廢——留這段是因為現在的 CROWN_BAND / CROWN_SPIKE 是照正確的 0.94 訂
# 的，看到舊數字的人要知道它為什麼不在了。
#
# 高寬比是這裡真正要對的一項，不只是「多大」。實機上冠高是冠寬的 1.12 倍，
# 更早的一版是 0.73——比自己還寬的一頂冠，對面那半圈的內壁永遠抬不到近側齒
# 縫之上，於是齒縫裡露出來的是後面的耳朵而不是冠自己的暗內面，而暗內面正是
# 參考圖上皇冠讀得出立體的原因。壓窄加高之後總面數沒變多，比例才對得上。
#
# z = -0.040 是頭殼頂那塊平的。更前面的 -0.066 在額頭前方、腳下沒有東西，量
# 到的髮面在下方 29mm，怎麼擺都是懸空。實際下沉量由 build.sink 從髮面量出
# 來，不是這裡寫死的。
CROWN_AT = (0.054, 1.524, -0.040)     # 環帶下緣的中心，落在頭殼頂的髮面上
CROWN_TILT = math.radians(-34.0)      # 繞 VRM z 轉，冠頂往 +x（模型右）倒
CROWN_PITCH = math.radians(19.0)      # 繞 VRM x 轉，冠頂往後仰。太小時正面一
                                      # 個內側面像素都看不到，太大則是看進杯
                                      # 口；19 度時內側面佔皇冠可見像素的一成
# 尺寸取 ingame/07 的實機正面，不取插畫：插畫把冠畫得比實機寬、齒也比較短。
CROWN_R0, CROWN_R1 = 0.021, 0.028     # 下緣半徑、上緣半徑（上寬下窄）
CROWN_BAND = 0.021                    # 環帶高
CROWN_SPIKE = 0.042                   # 尖齒再往上多少，約佔總高六成七
CROWN_TIP_R = 0.021                   # 齒尖收進來一點，齒才是錐形而不是柱狀
CROWN_SHARP = 1.1                     # 三角波的次方。參考的齒是寬楔形、缺口是大
                                      # V，1.8 收出來的是細條和窄縫
# 波谷抬高一點點。谷底剛好是 0 時上緣環與中緣環重合，每層會生出 10 個零面積
# 三角形：glTF 收得下、描邊也看不出來，但嚴格 validator 會報，而且白吃面數。
CROWN_FLOOR = 0.06
CROWN_POINTS, CROWN_SEG = 5, 20
CROWN_THICK = 0.004                   # 內層往內縮多少

# --- 呆毛。實際模型上它比插畫小：寬 45mm、高 62mm。---
AHOGE = [(0.012, 1.505, -0.062), (0.004, 1.552, -0.068),
         (-0.012, 1.567, -0.070), (-0.028, 1.545, -0.068),
         (-0.033, 1.508, -0.066)]
AHOGE_W, AHOGE_T = 0.013, 0.0035


def name(obj, label):
    obj.name = label
    obj.data.name = label
    return obj


def finish(label, verts, faces):
    mesh = bpy.data.meshes.new(label)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(label, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    return obj


def lathe(label, profile, centre, segments, yaw=0.0):
    """繞耳朵自己的軸旋出一個面。軸是 VRM 的 z，再繞 VRM y 轉 yaw。

    面的繞向在這裡就決定好，不交給 normals_make_consistent：外圈和內碗都是
    開放面（一個是中間有洞的盤，一個是碗），開放面沒有「內外」可判，Blender
    會挑哪一邊是隨機的。繞錯的後果不是看不見而是整片變成描邊色——MToon 的
    描邊 pass 剔除正面，先前熊耳髮夾就是這樣整顆變黑的。所以下面收工前會
    斷言：正面那幾圈的法線確實朝著模型正面。
    """
    cy, sy = math.cos(yaw), math.sin(yaw)

    def point(r, a, theta):
        x, y, z = r * math.cos(theta), r * math.sin(theta), a
        return (centre[0] + x * cy + z * sy, centre[1] + y,
                centre[2] - x * sy + z * cy)

    verts, rings = [], []
    for r, a in profile:
        if r <= 1e-9:
            rings.append([len(verts)])
            verts.append(point(0.0, a, 0.0))
            continue
        ring = []
        for s in range(segments):
            ring.append(len(verts))
            verts.append(point(r, a, 2 * math.pi * s / segments))
        rings.append(ring)

    faces = []
    for lo, hi in zip(rings, rings[1:]):
        if len(lo) == 1:
            faces += [(lo[0], hi[(s + 1) % len(hi)], hi[s]) for s in range(len(hi))]
        elif len(hi) == 1:
            faces += [(lo[s], lo[(s + 1) % len(lo)], hi[0]) for s in range(len(lo))]
        else:
            faces += [(lo[s], lo[(s + 1) % len(lo)],
                       hi[(s + 1) % len(hi)], hi[s]) for s in range(len(lo))]

    obj = finish(label, [kit.to_blender(v) for v in verts], faces)
    bpy.ops.object.shade_smooth()
    return obj


def points_outward(obj, centre):
    """面積加權地問：法線是不是背離這個中心？封閉外殼該是正的。"""
    origin = mathutils.Vector(kit.to_blender(centre))
    return sum(poly.normal.dot(poly.center - origin) * poly.area
               for poly in obj.data.polygons)


def points_at(obj, direction):
    """面積加權地問：法線是不是朝著這個方向？開放的碗該是正的。"""
    d = mathutils.Vector(direction)
    return sum(poly.normal.dot(d) * poly.area for poly in obj.data.polygons)


def crown(label, shrink, inward, rim_to=None):
    """錐形環帶加五支尖齒的一層面。

    齒不是另外貼上去的三角形，而是上緣環自己的高度走三角波：五個週期、每個
    週期四段，谷底在段 0、峰在段 2。這樣齒縫是 V 形凹口，是皇冠的剪影，而不
    是一圈平環上插五片旗子——後者正是前一版 45 面的樣子。

    `shrink` 把整層往軸心縮，`inward` 把繞向翻過來讓可見面朝內：兩個參數合起
    來就是內層。內外分成兩個物件而不是一個 solidify 出來的實體，是因為兩層要
    上不同顏色，而一個 primitive 只能有一個材質。

    `rim_to` 給外層一圈把上緣接到內層的窄面。沒有它，齒尖是兩片相隔 4mm 的薄
    刃，正面對著鏡頭那支齒的尖端會從縫裡透出背景——在 three-vrm 的近拍上量得
    到，平面算圖看不出來。
    """
    cx, cy, cz = CROWN_AT
    cos_t, sin_t = math.cos(CROWN_TILT), math.sin(CROWN_TILT)

    cos_p, sin_p = math.cos(CROWN_PITCH), math.sin(CROWN_PITCH)

    def at(radius, height, ang, inset):
        radius = max(radius - inset, 1e-4)
        dx, dy, dz = radius * math.cos(ang), height, radius * math.sin(ang)
        dy, dz = dy * cos_p - dz * sin_p, dy * sin_p + dz * cos_p
        return kit.to_blender((cx + dx * cos_t - dy * sin_t,
                               cy + dx * sin_t + dy * cos_t,
                               cz + dz))

    per = CROWN_SEG // CROWN_POINTS

    def tip(ang, wave, inset):
        return at(CROWN_R1 + (CROWN_TIP_R - CROWN_R1) * wave,
                  CROWN_BAND + CROWN_SPIKE * wave, ang, inset)

    verts, faces = [], []
    waves = []
    for s in range(CROWN_SEG):
        ang = 2 * math.pi * s / CROWN_SEG
        raw = 1.0 - abs((s % per) - per / 2.0) / (per / 2.0)
        wave = CROWN_FLOOR + (1.0 - CROWN_FLOOR) * raw ** CROWN_SHARP
        waves.append(wave)
        verts.append(at(CROWN_R0, 0.0, ang, shrink))
        verts.append(at(CROWN_R1, CROWN_BAND, ang, shrink))
        verts.append(tip(ang, wave, shrink))
    for s in range(CROWN_SEG):
        a, b = 3 * s, 3 * ((s + 1) % CROWN_SEG)
        faces.append((a, a + 1, b + 1, b))
        faces.append((a + 1, a + 2, b + 2, b + 1))
    if inward:
        faces = [tuple(reversed(f)) for f in faces]

    if rim_to is not None:
        base = len(verts)
        for s in range(CROWN_SEG):
            verts.append(tip(2 * math.pi * s / CROWN_SEG, waves[s], rim_to))
        for s in range(CROWN_SEG):
            o, o2 = 3 * s + 2, 3 * ((s + 1) % CROWN_SEG) + 2
            i, i2 = base + s, base + (s + 1) % CROWN_SEG
            faces.append((o, i, i2, o2))

    # 在建 mesh 之前查，不是建完之後查 polygon.area：波谷為 0 時四個頂點的索引
    # 各自不同、只有座標重合，Blender 算出來的多邊形面積就是那個有效三角形的面
    # 積，不是零，面積檢查因此永遠是綠的。真正壞掉的是匯出後的 glTF——那裡兩
    # 個三角形照發，其中一個面積為零。
    for f in faces:
        for i in range(len(f)):
            a, b = verts[f[i]], verts[f[(i + 1) % len(f)]]
            if all(abs(a[k] - b[k]) < 1e-9 for k in range(3)):
                raise SystemExit(f'{label} 有邊長為零的面，匯出後就是零面積三角形')

    obj = finish(label, verts, faces)
    want = -1.0 if inward else 1.0
    if want * points_outward(obj, CROWN_AT) <= 0.0:
        raise SystemExit(f'{label} 的繞向和它該露出的那一面相反')
    if rim_to is not None:
        # 上緣窄面單獨查。points_outward 是面積加權的總和，而窄面只佔外層面積
        # 的 19.4%：把它單獨繞反，總和仍然是正的，斷言照樣通過。這個檔案立的
        # 規矩就是開放面繞錯會整片變描邊色，窄面是全檔唯一沒被釘住方向的一面。
        rim = list(obj.data.polygons)[-CROWN_SEG:]
        # 局部 up 要先過 pitch 再過 tilt，和 at() 同一個順序。少了 pitch 的
        # 版本和真值的夾角解析上恰好等於 CROWN_PITCH（兩個都是單位向量，內積
        # 就是 cos(pitch)），守衛還會過，但那是靠餘裕不是靠量對方向。
        up = mathutils.Vector(kit.to_blender((
            -math.cos(CROWN_PITCH) * math.sin(CROWN_TILT),
            math.cos(CROWN_PITCH) * math.cos(CROWN_TILT),
            math.sin(CROWN_PITCH))))
        if sum(p.normal.dot(up) * p.area for p in rim) <= 0.0:
            raise SystemExit(f'{label} 的上緣窄面朝下，MToon 描邊會把它整片塗黑')
    return obj


def ball(label, centre, radius, flat, segments, rings):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings,
                                         radius=radius)
    obj = name(bpy.context.object, label)
    obj.scale = (1.0, flat, 1.0)
    kit.place(obj, centre)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.shade_smooth()
    return obj


kit.reset()
made = []

for side, label in ((-1, 'L'), (1, 'R')):
    centre = (side * EAR_X, EAR_Y, EAR_Z)
    yaw = -side * EAR_YAW
    ring = lathe(f'Ear_{label}', EAR_RING, centre, EAR_SEG, yaw)
    bowl = lathe(f'EarInner_{label}', EAR_BOWL, centre, INNER_SEG, yaw)
    # 外圈是包住耳心的殼，法線該背離耳朵中心；內碗是開放面，法線該朝耳朵
    # 自己的正面（yaw 之後的 -a 方向）。兩個判準不同，不能共用一個。
    if points_outward(ring, centre) <= 0.0:
        raise SystemExit(f'{ring.name} 的面朝內，MToon 描邊會把它整片塗黑')
    if points_at(bowl, (-math.sin(yaw), math.cos(yaw), 0.0)) <= 0.0:
        raise SystemExit(f'{bowl.name} 的面朝後，MToon 描邊會把它整片塗黑')
    made += [ring, bowl, ball(f'Bun_{label}', (side * BUN_X, BUN_Y, BUN_Z),
                              BUN_R, 0.85, 12, 6)]

made.append(crown('Crown', 0.0, False, rim_to=CROWN_THICK))
made.append(crown('CrownInner', CROWN_THICK, True))

band = kit.profile('ahoge_section', AHOGE_W, AHOGE_T)
band.hide_render = True
loop = kit.sweep('Ahoge', AHOGE, band, resolution=4,
                 tilt=[0.0, 0.4, 0.9, 1.4, 1.9])
made.append(name(kit.to_mesh(loop), 'Ahoge'))

kit.export(made, OUT)
