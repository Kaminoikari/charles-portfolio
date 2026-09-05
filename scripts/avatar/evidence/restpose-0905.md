# restpose-0905：Phase 2 rest pose 正規化（outfit.py 旋轉感知擬合）的收據

骨架泛化計畫第三步。`outfit.py` 原本把 yaw 硬寫成 π（`YAW` 常數）、逐骨修正只有平移，
模組 docstring 明寫「兩具都 T-pose 垂直腿，不需逐骨旋轉」；VRoid 身體其實是 slight
A-pose，量到兩具 rig 的段方向差（`restpose-0905-analysis.log` 第 0 節）：四肢 2.4–3.5°、
shoulder→upperArm 10.5–12.9°、hips→spine 9.9–10.2°、spine→chest 6.0°。

現在 `outfit._fit` 從錨點解 yaw（XZ 平面 Kabsch）再 snap 到最近的 k·180°，離兩者都
超過 5° 就以 `BadFit` 拒收；逐骨修正變成 `(R, pivot, d)`，四肢骨的 R 是把服裝的段方向
（`CHILD_OF`：UpperArm→LowerArm→Hand、UpperLeg→LowerLeg→Foot→Toes）轉到我們段方向的
最小旋轉，Hand／Toes／手指與「子骨沒對上」的四肢骨繼承上一根的 R，軀幹一律 None、
Shoulder 不在 `CHILD_OF` 所以從軀幹繼承 None；服裝鏈骨繼承錨點整組 `(R, pivot, d)`。`pieces()` 的法線與 morph delta 走混合後的
線性部分，`add_bones()` 的鏈骨世界矩陣同樣繞錨點轉。

**軀幹不轉是設計決定，不是還沒做**：hips→spine 差 10°、spine→chest 差 6°，但兩具軀幹都
沒有傾斜，那是關節擺放位置的差異，不是表面方向；把 hips 轉 10° 會把 0.4m 長的裙襬甩
70mm。四肢的段方向就是四肢的軸，所以四肢的布跟著轉。軀幹由測試 (g)／mutation R11 釘住，
Shoulder 由 (j)／R15 釘住。

## 出貨幾何改了（`restpose-0905-equiv.log`，16:51:45–16:52:44）

```
服裝擬合 mellow.glb：縮放 x1.172，yaw -180.00°，對位骨最大殘差 0.00mm，錨點 16 根，轉向 8 根（Foot.L、Foot.R、Lower_leg.L、Lower_leg.R、Toe.L、Toe.R、Upper_leg.L、Upper_leg.R）
服裝擬合 mellow_outer.glb：縮放 x1.153，yaw 180.00°，對位骨最大殘差 0.00mm，錨點 10 根，轉向 0 根
vertex sha（重建前）: ad8f3adc45f87430
vertex sha（重建後）: 73cfb472ca1cb1c3   !!! 不同
算圖 final-front.png 差異像素 72575 / final-back.png 62780 / final-three_quarter.png 66826 / final-face.png 0
```

bodice 組的 8 根腿骨轉向（角度 2.4–3.5°）；手臂沒轉，因為 bodice 組沒有前臂錨點、cardigan
的前臂錨點被 vendor 檔壓住（下節），`Upper_arm` 的子骨對不上就繼承 Shoulder 的 None。

這次 build 之後 `outfit.py` 在 review 中又改了註解與拿掉多餘的 `FIXED_PARTS`，最終原始碼
重建一次確認：`restpose-0905-final-rebuild.log`，vertex sha 73cfb472ca1cb1c3 相同、四視角
差異像素 0。

兩份檔逐 primitive 比對（同一條管線，頂點順序相同；`restpose-0905-analysis.py` 第 1 節，
輸出在 `restpose-0905-analysis.log`，before 取 `git show f828e8a:public/avatar/mika-milfy-10.vrm`）：
105 個 primitive 有 98 個逐位元組相同，動的 7 個全在腿部：

| primitive（材質） | 最大位移 | 平均 | 頂點數 |
|---|---|---|---|
| Body.baked#20（Mellow_Lace，襪口蕾絲） | 19.3mm | 11.8mm | 3396 |
| Body.baked#21（Mellow_Underwear） | 16.4mm | 5.9mm | 1506 |
| Body.baked#16（Mellow_Shoes） | 13.2mm | 2.9mm | 10914 |
| Body.baked#11（Mellow_Leg_Acc，大腿帶） | 7.6mm | 3.5mm | 3520 |
| Body.baked#17（Mellow_Lace） | 7.1mm | 3.9mm | 190 |
| Body.baked#12／#15（Mellow_Jewel） | 5.0mm／1.3mm | | 323／320 |

四視角像素差 6–7 萬看起來像整身都動了，其實是鞋底最低點從 y=4.8mm 降到 2.0mm，
`render.py` 用 bbox 取景，整張圖跟著平移不到一個像素。把兩個 build 用同一組 bbox 算圖
（`restpose-0905-analysis.py` 第 2 節）之後：

```
同框 front: 差異像素 11710  bands top→bottom [0, 0, 0, 0, 0, 1200, 29, 0, 5403, 5078]
同框 back:  差異像素 11202  bands top→bottom [0, 0, 0, 0, 0, 1057, 29, 0, 5596, 4520]
同框 three_quarter: 12452   bands top→bottom [0, 0, 0, 0, 0, 1136, 18, 0, 5267, 6031]
同框 face: 0
```

差異在大腿帶（第 6 帶）與襪鞋（第 9、10 帶），第 7 帶另有 18–29 px（大腿帶下緣）。`restpose-0905-socks-sameframe.jpg`
是三視角襪鞋 3 倍放大前後對照，肉眼看不出差別、沒有撕裂。

## 三道 gate 前後（`restpose-0905-gates-before.log`／`-after.log`）

before 是出貨 build（ad8f3adc45f87430）在 scratch 副本上跑的，after 是新 build。

| gate | before | after |
|---|---|---|
| pierce.py 靜態穿模 | 20 px（大腿帶 16、外套 4）PASS | 15 px（大腿帶 10、外套 4、鞋 1）PASS |
| motion.py 10 支 clip 最差 | 0.67 of limit（大腿帶 dance 20 px；襪 21 px） | 0.63 of limit（裙 akimbo 94 px 同前；大腿帶 14 px；襪 5 px）PASS |
| retarget_test.py | 最差 idleLoop +1.94° PASS | 相同 |

`hug`／`loosen`／`standoff`／`MELLOW_SHIFT` 沒有重校；計畫預留的重校這輪用不到。

## cardigan 的 ignore 沒有解除（`restpose-0905-16anchors.log`，17:03:39–17:04:32）

Phase 1 把 cardigan 的 `Lower_arm_*`／`Hand_*`／`Thumb Proximal_*` 用 vendor 檔 `ignore`
留在鏈骨，理由是 16 錨點的純平移擬合撕裂 Breasts_Cow shape key，並約定 Phase 2 解除。
解除後重建：

```
服裝擬合 mellow_outer.glb：縮放 x1.188，yaw 180.00°，對位骨最大殘差 0.00mm，錨點 16 根，轉向 8 根（Hand_L、Hand_R、Lower_arm_L、Lower_arm_R、Thumb Proximal_L、Thumb Proximal_R、Upper_arm_L、Upper_arm_R）
grafted shape keys that tear their mesh: 1
FAIL Body.baked#22 "(No bra)Breasts_Cow" stretches an edge 2.0x and flips 5 faces
make.py exit 1
```

`verify.torn_shapes` 的拒收條件是「邊拉超過 3.0x **或**任一面翻轉」；這裡是翻面（純平移
時翻 1 面，現在 5 面）。出貨的 10 錨點檔上，這把 key 拉得最兇的三個三角形是 tri
4251／3063／3062，中心 (−0.144, 1.183, 0.084)，左腋下的胸部，不在袖子上，已拉 1.79x、
翻 0 面（`restpose-0905-analysis.log` 的「torn triangles」節；16 錨點 build 的輸出檔沒有留下，
它的翻面位置只有 verify 那一行）。在 `outfit.pieces()` 剛擬合完、還沒 hug 的網格上比四種
變體（同 log 第 3 節），最差的都是同三個三角形：

| 變體 | 縮放 | 轉向 | Breasts_Cow 最大拉伸 | 位置 |
|---|---|---|---|---|
| 10 錨點（出貨） | x1.153 | 0 | 1.67 | 同三個三角形 |
| 16 錨點 | x1.188 | 8 | 1.77 | 同 |
| 16 錨點、全部不轉 | x1.188 | 0 | 1.71 | 同 |
| 16 錨點、只轉腿 | x1.188 | 0 | 1.71 | 同 |

旋轉只貢獻 1.71→1.77；把 key 推過線的是 16 錨點相似擬合的縮放（x1.153→x1.188）加上
hug 之後的邊長（出貨 build 上這三個三角形已拉 1.79x）。根因是 vendor 那把 key 在腋下
本來就接近撕裂。「旋轉感知擬合讓這些錨點安全」這個
Phase 1 的假設不成立；要解除 ignore 得先把 key 在腋下平滑，或讓袖子獨立綁定（Phase 4
`binding.lead`），不在本 phase。`mellowheart.json` 的 `_comment`、`build.py` 的註解與
`bonemap_test` 的 docstring 改成這個結論。

## 測試

```
python3 -W ignore -m unittest scripts.avatar.outfit_test.RestPose   → 改前 8 條全紅（restpose-0905-red.log：小腿軸偏 65.7mm、法線與 delta 偏 10.00°、鏈骨偏 32.8/65.7mm）
python3 -W ignore -m unittest discover -s scripts/avatar -p "*_test.py"   → 128 tests OK（Phase 1 是 117；RestPose 11）
```

(g) 在 red.log 裡的紅是 `rot, _, _ = correction[i]` 把舊的 3 向量拆開、`d[0]=3.77e-06` 被當成
旋轉，不是行為上的紅；這道守衛真正由 mutation R11 證明。(h)、(i) 與 (c) 的精確對角矩陣斷言
是 review 第一輪補的，沒有改前的 red.log，各自的紅是 R14、R13、R12。

`RestPose` 用 10 骨合成配對（hips、spine、neck、左肩、左上臂、左右大小腿、左腳；第一版是
`bonemap.require` 接受的最小 8 根，review 第二輪加了肩與上臂），服裝寫成真的 glb 走 `outfit.load` 同一扇門，服裝骨帶 90° 的 rest rotation，
讓 (a) 能釘住「用骨矩陣算旋轉」的教科書 retarget：

- (a) 相同 rig：每根骨 R 是 None，`pieces()` 輸出與 `aligned + d` `assert_array_equal`
- (b) 小腿外張 10°：軸上 5 點落在我們小腿線 1mm 內（改前偏 65.7mm）
- (c) `_fit` 對 0°／±180° 都能解、hips 落點對、`A` 的線性部分與 `scale · diag(±1, 1, ±1)`
  `assert_array_equal`（精確對角，不是解出角度的 sin/cos）、90° 拋 `BadFit` 指名角度
- (d) 環上法線垂直我們的小腿方向（改前偏 10°）
- (e) morph delta 平行我們的小腿方向（改前偏 10°）
- (f) 鏈骨 `Cloth_1.L` 的頂點（`pieces()`）與節點（`add_bones()`）都落在小腿線上，兩條測試
- (g) 軀幹傾 10°：hips／spine／neck 的 R 是 None，裙頂點與 `aligned + d` 逐位元組相同
- (h) 段沒對上的骨繼承上一根的 R：`Foot.L` 的子骨 Toes 不在對應裡，鞋頂點（權重到 Foot.L）
  落在小腿線上，且 Foot 的 R 與小腿的 R `assert_array_equal`。出貨 build 的 Toe.L／Toe.R
  就是走這條（`CHILD_OF` 沒有 Toes 的項）
- (i) `_turn(u, −u)` 拋 `BadFit`、`_turn(u, u)` 回 None
- (j) 肩到上臂的段在服裝側下垂 10°：leftShoulder 與 leftUpperArm 的 R 都是 None，領口頂點
  與 `aligned + d` 逐位元組相同（review 第二輪補的；(g) 只釘軀幹，Shoulder 要自己的一條）

## Mutation：十五道守衛各自轉紅（`mutations-0905-restpose.md`）

| # | 守衛 | mutation | 紅在哪 |
|---|---|---|---|
| R1 | 旋轉來自段方向，不是骨矩陣 | `turn[i]` 改成 `M_tgt·inv(A·M_src)` 的旋轉部分 | (a) 相同 rig 的骨拿到旋轉 |
| R2 | 段方向一致時 `_turn` 回 None | 回 `np.eye(3)` | (a) `assertIsNone` |
| R3 | 四肢骨真的轉 | `turn[i] = None`（改前的程式） | (b) 小腿軸離我們的小腿線超過 1mm（log：65.8mm） |
| R4 | 半圈跟著解出的 yaw | `rot` 硬寫 diag(−1,1,−1) | (c) 0° case 的 scale ≠ 1（反向的半圈把最小平方縮放拉歪，先於 hips 落點斷言；log：0.9569） |
| R5 | 離兩個半圈都遠就拒收 | 拿掉容差檢查 | (c) 90° 沒拋錯 |
| R6 | yaw 是解出來的 | `yaw = 180.0` | (c) 0° case 的 scale ≠ 1（同 R4：硬寫 180° 讓 0° 的 rig 拿到反向半圈；log：0.9569） |
| R7 | 法線走混合旋轉 | 跳過法線的 einsum | (d) 偏 10° |
| R8 | morph delta 走混合旋轉 | 跳過 delta 的 einsum | (e) 偏 10° |
| R9 | 鏈骨在 `pieces()` 繼承錨點旋轉 | 非錨點骨 R 設 None | (f) 鏈骨頂點離小腿線超過 1mm（log：65.8mm） |
| R10 | 鏈骨在 `add_bones()` 繼承錨點旋轉 | 跳過旋轉 | (f) 鏈骨節點離小腿線超過 1mm（log：32.9mm） |
| R11 | 軀幹不轉 | 軀幹骨也從段方向算 R | (g) hips 拿到旋轉 |
| R12 | snap 後的半圈是精確對角矩陣 | `rot` 改用 cos/sin(180°·k) 組 | (c) `A[:3,:3]` 多出 1.2e-16（sin π）的非對角元素 |
| R13 | 反向的段拒收 | `raise BadFit` 改 `return None` | (i) 沒拋錯 |
| R14 | 段沒對上的骨繼承上一根的 R | `turn[i] = inherited` 改 `None` | (h) Foot 的 R 是 None（`assert_array_equal` 對小腿的 R 失敗，鞋的斷言沒跑到） |
| R15 | Shoulder 不是四肢骨 | `CHILD_OF` 加 `'Shoulder': 'UpperArm'` | (j) leftShoulder 拿到旋轉 |

第一輪 R8 GREEN：R7 與 R8 的替換等長、同一秒落地，CPython 沿用 R7 的 `.pyc`（那份
bytecode 裡 delta 還在轉）。harness 改成寫入後刪 `__pycache__`，全部重跑才是上表；
R12–R14 是 review 第一輪指出的三道沒有測試的守衛，R15 是第二輪指出的（Shoulder），
十五道在最終原始碼上一起重跑。

## 這一步沒做的事

- cardigan 的前臂／手／拇指錨點（見上）。
- `standoff(torso_x=0.26, sleeve_x=0.32)` 沒改成從骨架推導：量到 target 的 leftShoulder.x
  是 −0.020、leftUpperArm.x 是 −0.081，計畫原案的推導式（`leftShoulder.x − 0.02`）給不出
  0.26；那兩個數是 cardigan 軀幹片的外緣，屬於服裝，交給 Phase 4 `binding.lead`。
  `fit_ring_to_limb` 的 `sign(median x)` 在 target 座標已與身體無關，也沒改。
- `add_bones()` 仍沒有被 build.py 呼叫（服裝重綁到我們的身體權重），旋轉版只有測試 (f) 跑到。
