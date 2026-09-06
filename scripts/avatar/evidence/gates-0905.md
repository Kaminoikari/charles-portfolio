# gates-0905：Phase 3 放寬 54 gate、殺 `skins[0]`、`--base`、地標推導的收據

骨架泛化計畫第四步（Phase 0–2 之後）。改前管線只能吃 VRoid 那副 54 骨的身體，
擋在四個地方：

- `make.gate`、`verify.report`、`selftest.run` 各自寫死 `bones == 54`（selftest 旁邊還有
  `56` 個臉部 morph target、`15` 個 blendShapeGroup）；
- 十二處 `doc['skins'][0]`（`outfit.py` ×3、`pose.py` ×2、`pierce.py`、`partmap.py`、
  `envelope.py`、`build.py` ×2、`twintail.py`、`bonemap.py` ×2）把第一個 skin 當每個 mesh 的
  skin。VRoid 三個 skin 共用同一份 joint list，所以一直沒事；
- `make.py` 的 baseline 固定是 `baseline.vrm`；
- `build.py` 把 `hip, knee, ankle = 0.843, 0.501, 0.118`、`arm_r = 0.54`、
  `shoulder_top = 1.215`、`neck_y = 1.243` 當世界座標手打，與檔頭「每個量都從檔案讀」
  自相矛盾。

## 改成什麼

- **gate**：`make.gate(label, path, base)` 只斷言 `humanoid.compare(base, path) == []` 且
  `humanoid.required_missing(path) == []`。骨骼集合由 `compare()` 守（一邊有一邊沒有的骨
  回 `distance: None`），VRM 規範的 15 根必要骨由 `required_missing` 守；數量只印不判。
  `verify.report` 同樣改成 `required_missing`，`selftest.run` 的骨數／target 數／group 數
  改從**輸入模型**執行期讀（沒有 `Face.baked` 時 target 數為 0 而非 `ValueError`），骨架
  compare 也對輸入模型而非 `baseline.vrm`，並多一個 `out=` 參數讓測試不寫進
  `out/selftest.vrm`。
- **skin**：`humanoid.mesh_skin(doc)`（mesh index → 畫它的 node 所指的 skin；同一 mesh 被
  兩個 node 用不同 skin 畫時拋 `BadRig`）、`skin_of_mesh(doc, mesh_name)`、`all_joints(doc)`
  （所有 skin 的 joint 聯集，first-seen 順序）；`body_skin` 改為委派 `skin_of_mesh`。
  `pose.skin_matrices` 每個 skin 各算一組 joint matrices，`skinned`／`skinned_normals` 每個
  mesh 用自己那組；`pierce`／`partmap` 的 arm／side 槽位表按 skin 建；`envelope`／`twintail`
  用該部件 mesh 的 skin；`build` 的身體 skin 走 `body_skin`，頭飾的 head joint slot 走
  `Hair_Back` 那個 mesh 的 skin（11 處 `mesh='Hair001.baked'` 改成同一個 `head_mesh`）；
  `outfit.pieces`／`_weighted_joints` 按每個 mesh 的 skin 解 slot，`load` 與 `bonemap` 對
  joint 聯集擬合／對應；`outfit.add_bones(bundle, doc, views, skin_index=0)` 把新骨同時
  append 到所有共用 joint list 的 skin（`humanoid.skins_sharing`，在該 skin 變長之前先取）。
  `humanoid_test.Wiring` 多一條 source 掃描：`scripts/**/*.py`（`evidence/` 除外，那裡的
  mutation harness 字串就是被禁的拼法）不得再出現 `['skins'][0]`。
- **`--base <vrm>`**：`make.main(base=BASELINE)`，partition、五道 gate 與 `verify.report`
  全走它；`gate_test.Wiring` 掃 `main()` 的原始碼證每一步都吃 `base`。
- **地標**：`build.landmarks(pool, doc)` 從 `humanoid.rest_world` 讀 `hip`／`knee`／`ankle`／
  `shoulder`／`neck`／`hand_x`（左側）；`build()` 用 `lm['hip']`／`lm['knee']`／`lm['ankle']`／
  `lm['hand_x']`／`lm['shoulder']`，領口是 `lm['neck'] - 0.007`（參考圖的蕾絲在頸根，頸關節
  在斜方肌頂）。`torso` 的 1.181、`strap` 的 1.168–1.252、`sleeve` 下緣 1.155 這些不對應
  humanoid 地標的絕對高度仍手打，依計畫留給 Phase 5／6b。

## RED → GREEN（`gates-0905-red.log`、`gates-0905-tests.log`）

改生產碼之前先跑新測試：`gates-0905-red.log` 第 132–134 行 `Ran 9 tests … FAILED
(failures=4, errors=4)`。四個 error 是 `gate_test` 打舊簽名 `gate(label, path)`（第 3、12、
21、30 行），四個 failure 是 `verify_test` 撞 `expected 54`（第 39、48 行）與 `pose_test`
撞 `skins[0]`（第 76、104 行）；`DanglingJoints` 那條本來就綠（偵測器早已按 node 解 skin），
留著當 G6 的靶。改完後全套 discovery：`gates-0905-tests.log` 第 3、5 行 `Ran 146 tests … OK`
（Phase 2 是 128；新增 gate 4＋wiring 1、verify 3、pose 2、selftest 1、build 3、humanoid 3
（wiring 1、`mesh_skin` 1、`all_joints` 1）、outfit `add_bones` 1，共 18，其中
`verify_test.DanglingJoints` 是既有行為的測試）。vitest 三個讀出貨檔的套件：
`gates-0905-vitest.log` 第 10–11 行 `3 passed / 14 passed`。

## 幾何：0 個 primitive 移動、四視角 0 像素，只有裙子的權重動了

兩次重建。第一輪（`gates-0905-equiv.log`，`make.py` 預設 base）：第 4 行重建前 vertex sha
`73cfb472ca1cb1c3`（Phase 2 出貨），第 113 行重建後 `0ef55e617ea791cd`，第 114–117 行四視角
差異像素全 0。第二輪（`gates-0905-equiv-r2.log`，review 後 `shoulder`／`neck` 也改吃地標、
頭飾 slot 改走頭髮 skin）：第 4 行與第 113 行都是 `0ef55e617ea791cd`，第 114–117 行仍全 0，
也就是那三個修正在這具身體上不動任何頂點屬性（`gates-0905-attrdiff.log` 第 20–25 行，兩輪
之間只差髮髻 index 順序）。

`gates-0905-analysis.py`（`gates-0905-analysis.log`）拆開看：

| 地標 | 推導值 | 手打值 | 差 | 出處 |
|---|---|---|---|---|
| hip | 0.843383 | 0.843 | +0.383mm | 第 2 行 |
| knee | 0.500952 | 0.501 | −0.048mm | 第 3 行 |
| ankle | 0.118327 | 0.118 | +0.327mm | 第 4 行 |
| hand_x | 0.540342 | 0.540 | +0.342mm | 第 5 行 |
| shoulder | 1.215111 | 1.215 | +0.111mm | 第 6 行（手打值在 commit 9c1faab 的 `build.py:641`） |
| neck | 1.249834 | 1.243（＝neck − 0.007 的 1.242834） | −0.166mm | 第 7 行（手打值在 commit 9c1faab 的 `build.py:672`） |

105 個 primitive 的 POSITION 逐點相同（第 12 行 `unchanged: 105, moved: 0`），同框算圖四
視角 0 像素（第 16–19 行）。sha 變的是頂點的其他屬性（`gates-0905-attrdiff.log` 第 1–11
行，Phase 2 出貨對 Phase 3 build）：`Outfit_Bottom`（`Body.baked` #18、#19）的 `WEIGHTS_0`
最大差 0.00084（第 5–7 行）、`JOINTS_0` 5 個頂點換了 lead（第 3–4 行）。機制是
`build.drape()` 的下襬高度 `hem_y = hip − (hip − knee) × 0.34` 吃到推導的 hip／knee，腿權重
的高度 fade 跟著移 0.4mm 以下。這是本 phase 唯一的幾何側影響，`verify.stats` 的 sha 把
JOINTS／WEIGHTS 一起 hash 所以看得見，算圖看不見。

`Hair_Bun_L/R` 的 `indices` 也不同（第 8–10 行），但那與本 phase 無關：兩次同程式碼的
build 之間也只差這兩個 primitive 的 index 順序（第 13–18 行，預設 base 對
`--base mika-pink.vrm`），三角形集合相同（每行末的 `same triangle set … True`）。這是
memory `project_milfy_replica_pipeline` 記的 Blender `head.py` 位元組不決定性。

三個 VRoid skin 共用同一個 IBM accessor（`gates-0905-ibm.log` 第 1–4 行，`[760, 760, 760]`，
兩兩差 0），joint list 也相同（第 5 行），所以「每個 mesh 用自己的 skin」在這具身體上數字
不可能變；改的是對其他身體的正確性，本檔上只能由 wiring 掃描（G14）與合成夾具
（`pose_test`：兩個 skin joint 順序相反；`humanoid_test`：`mesh_skin`／`all_joints`）釘住。
`pierce`／`partmap`／`twintail`／`bonemap`／`outfit.pieces`／`build` 頭飾 slot 的轉換在本檔上
沒有行為測試，這點要說清楚。

## `--base public/avatar/mika-pink.vrm` 給同一份輸出

`gates-0905-base-pink.log`：五道 gate 第 10–80 行全 `compare=[] … required_missing=[]`，
第 89 行 vertex sha `0ef55e617ea791cd`，與預設 base 相同；屬性逐一比對只剩上述髮髻 index
順序（`gates-0905-attrdiff.log` 第 13–18 行）。

## 其他 gate（都在第二輪 build 上跑）

- `pierce.py`（`gates-0905-pierce.log`）：第 5 行 total 15 PASS，與 Phase 2 相同（POSITION
  沒動）。
- `motion.py`（`gates-0905-motion.log`）：第 21 行 PASS，最差仍是 akimbo 0.63 of limit
  （第 2 行；`Outfit_Bottom` 94 px of 150，第 14 行），與 Phase 2 的收據逐字相同。裙子權重差
  ≤ 0.00084 在 10 支 clip × 4 幀 × 3 視角的像素計數上看不出來。
- `selftest.py <build> <manifest> 3`（`gates-0905-selftest.log`）：第 81 行 `3 rounds: PASS`，
  標籤現在是執行期讀出的 `54 humanoid bones`／`56 face morph targets`／`15 blendShapeGroups`
  （第 13–15 行），同一支程式對 `selftest_test` 的擾動副本印 53／57／14。

## Mutation（`mutations-0905-gates.md`，harness `gates-0905-mutate.py`）

22 道，各自一條具名測試，全部 RED、還原後 sha256 相同：G1–G3 `make.gate`（放回 54、
拿掉 `required_missing`、拿掉 `compare`），G4–G5 `verify.report`（拿掉 `required_missing`、
放回 54），G6 `verify.dangling_joints`（skin 全指 0），G7–G10 `selftest`（54／15／56 字面、
compare 對 `baseline.vrm`），G11–G12 `pose`（skinned／skinned_normals 用 skin 0），G13
`humanoid.mesh_skin` 回 0，G14 `envelope.py` 放回 `skins[0]` → wiring 掃描紅，G15
`outfit.add_bones` 不長共用 skin，G16 `build.landmarks` 手打 hip，G17 `build()` 手打三個
高度 → `build_test.Wiring` 紅。第一輪 code review 後加的：G18 `all_joints` 只看第一個
skin，G19 `make.main` 的 partition 讀 `BASELINE` → `gate_test.Wiring` 紅，G20 `mesh_skin`
不拒絕兩個答案，G21 `shoulder_top = 1.215`、G22 `neck_y = 1.243` 放回 → `build_test.Wiring` 紅。

## 出貨檔名 `-10` → `-11`

`make.py` 的規則是位元組變了就要換名（`/avatar/*` cache-immutable 一年）。Phase 2 改了
幾何（sha `ad8f…` → `73cf…`）卻仍以 `-10` 出貨，本 phase 再改權重；兩次合併換成
`mika-milfy-11.vrm`，登錄表 `avatarVariants.ts`、`live-preview*`、`springsim.ts`、四個
probe html、五個測試的常數與 `.gitignore` 的註記一起改，`-10` 兩檔自 git 移除。出貨的是
`--base mika-pink.vrm` 那次 build 的 `out/`（最後一次 build）。

## 沒做／範圍外

- `hem band y ≥ 0.92`、`COAT_LEG_BAND_TOP`、`twintail.TIE_Y`、`proportion.CHIN_Y/FOOT_Y`
  與 `build()` 裡不對應地標的絕對高度依計畫留給 Phase 5／6b。
- `humanoid_test.Wiring.FIXTURE_WRITERS`：`gate_test`／`verify_test`／`selftest_test` 寫擾動
  的 VRM 0.x 夾具時必須碰 `['humanoid']['humanBones']` 的拼法（`selftest_test` 還讀一次骨數
  當期望值），只豁免 inline-read 那一條掃描；import 與 `skins[0]` 掃描照常涵蓋它們。
- Phase 3.5（VRM1 → VRM0 入口轉換）未動；`--base` 對 VRM1 身體仍會在 writer 端失敗。
