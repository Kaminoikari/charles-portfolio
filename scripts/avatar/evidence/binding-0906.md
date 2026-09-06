# Phase 4：綁定策略資料化 `binding.py`（2026-09-06）

計畫：`~/.claude/plans/nested-conjuring-wirth.md` Phase 4。

## 修的機制

四種蒙皮策略由「作者呼叫哪個函式」決定：`garment.shell` 抄身體自己的權重列（inherit）、
`garment.bind` 抄最近身體頂點（nearest）、每個參數化建構子 `np.tile` 一列（single）、
`build.py` 內的 `drape()` 把最近頂點列往兩根大腿骨淡入（drape）。九處 `bind(` 與刻意不
呼叫的那些沒有 manifest 欄位、沒有測試，第二具身體只能繼承這具的猜測。

現在 `scripts/avatar/binding.py` 從量測做決定，`build.put()` 是唯一給部件權重的地方，
manifest 每個 part 帶 `binding: {strategy, reason, lead[, smooth][, joint]}`。

## 規則與門檻（全部量自真實建置，不是選的）

探針：`binding-0906-probe.py` 在真實 `build()` 上攔截每個 `garment.attach`，對每件量
最近身體頂點的主導骨側別、hip 以下占比、主導骨數、權重變異、直徑、連通片數，並標上今天的
策略；`binding-0906-probe-bands.py` 量胯下線以下每 1cm 帶的方位覆蓋與環狀比。
輸出：`binding-0906-probe-hand.log`（無 mellow／無 Blender 的手作路徑）、
`binding-0906-probe-mellow.log`（出貨路徑）、`binding-0906-probe-bands.log`。

| 規則 | 判準 | 量到的數字 |
|---|---|---|
| inherit | `origin == 'shell'` | 手作 Outfit_Top／Cardigan／Socks／Shoes 是 shell；鞋的兩顆耳朵帶的是腳頂點的列 |
| drape | 胯下線（hip − 0.25·(hip − knee) = 0.7578；bands log 印 0.758）以下某 1cm 帶，12 個方位全到 **且** 環狀比 min r／max r ≥ 0.5 | 廠商裙 c1.00 q0.65-0.67（y 0.733-0.753）；手作裙 c1.00 q0.72-0.78；手作裙襬荷葉 q0.78-0.79。反例：廠商襪 c1.00 **q0.20**、廠商鞋 c1.00 **q0.16**、手作鞋 c1.00 q0.18（兩隻腳夾著髖軸，方位全到但不是一個環）；廠商外套最低點 0.781 > 0.758（無帶）；廠商大腿帶 c0.25 |
| single | 每個最近皮膚頂點都**整權重**（≥ 1 − 1e-6）在同一根骨 | 全部頭飾與髮蝴蝶結：唯一列 `(10,0,0,0)/(1,0,0,0)` = 今天 `rigid()` 的 hj/hw。反例：廠商頸緞帶 upperChest 0.99 + 肩 0.01、廠商大腿帶 leftUpperLeg 0.99 + hips 0.01 都留 nearest |
| nearest | 其餘；`smooth` 由呼叫端給（MELLOW_BIND_SMOOTH） | 鈕扣主導骨 2 根、領子 6 根、熊臉 2 根（六顆球各在一隻腳） |

計畫原稿的兩條門檻被量測推翻，改掉並記在 `binding.py` 的 docstring：

- 「兩側各 ≥ 20% 且垂在 hips 以下 → drape」：手作左大腿帶的最近頂點有 21% 在**右**腿
  （大腿內側最近的皮膚是另一條腿），廠商裙上半個 primitive 兩側各只有 1%、hip 以下占 2%
  （它自己停在髖關節）。改成「胯下線以下的完整環」，並且決定在**整個 part 的 primitive 聯集**
  上做（`binding.signals` 吃 list；`Choose.test_the_decision_is_taken_on_the_union…`）。
- 「直徑 < 60 mm → single」：髮髻 86–161 mm、髮飾整組都剛體掛頭；上限本來代理的是「不跨關節」，
  「每列整權重同一根骨」直接量這件事。

裙子側向淡化仍以 x = 0 為中線（`DRAPE_SIDE_X`）：這具身體 hips 世界座標 x = 4.2e-5，減掉會讓
每個裙權重動一點點而看不出理由；離軸的身體歸 Phase 6b（`binding._drape` 註解）。

## 檔案

- `scripts/avatar/binding.py`（新）：`context(doc, pool, manifest, landmarks, drape)`、
  `tree_of`／`nearest`（cKDTree；平手一律取最小 index，與被取代的稠密 argmin 逐位元相同）、
  `drape_band`、`signals(ctx, pieces)`、`choose(ctx, sig, origin, smooth)`、`decide`、
  `override`（記 `chosen`）、`apply(ctx, piece, decision, mesh)`（slot 依 joint node 轉進目標 mesh
  的 skin；三個 skin 同表時是 identity）、`_drape`（原 `build.drape()` 逐字搬入）。
- `scripts/avatar/build.py`：`ctx`／`bindings` 在 landmarks 之後建立；`put(piece, material, name,
  mesh, tag, bind='auto'|Decision, origin, smooth)` 回傳 `{index, piece, signals, decision}`；
  九處 `garment.bind(` 刪除；`drape()` 刪除；`rigid()` 改 `with_uv()`（只設 UV）；廠商迴圈按
  part 聯集 `binding.decide` 後逐 primitive `put(bind=…)`，外套軀幹片的 lead 改讀
  `signals['lead_slot']`（平滑前的最近頂點主導骨，語意同前）；manifest 尾：
  `e['binding'] = bindings.get(label) or carried.get(label, {}).get('binding')`，都沒有就 SystemExit。
- `scripts/avatar/weld.py`：`attach(doc, views, ctx, piece, material, part_name, mesh)` 走
  `binding.decide/apply`（無呼叫端，簽章改了）。
- `scripts/avatar/partition.py`：每個 part（含 Face）帶 `binding.EXPORTED`。
- `scripts/avatar/twintail.py`：`CHAIN`；`apply()` 結尾把它寫進重蒙皮的兩個 part。
  第五個策略名 `chain` 不在 `binding.STRATEGIES`（那四個是幾何決定的；這個是它掛的鏈）。
- `scripts/avatar/customise.py`：未改；`remap` 本來就保留未知鍵（`Manifest.test_customise_remap…`
  釘住，C1 mutation 證明測試看得到剝除）。
- `scripts/avatar/selftest.py`：新 check「every part still says how it is bound」。
- `scripts/avatar/garment.py`：`bind()` 改委派 `binding.nearest`（同一個 nearest，留給
  `garment_test` 單獨釘平滑）；docstring 的「裙子單一綁定」一段更新。
- `scripts/avatar/verify.py` 註解、`twintail.py:95` 註解：不再指 `garment.bind`。

## RED → GREEN

- `binding-0906-red.log`：`binding_test.py` 先寫，`ModuleNotFoundError: No module named 'binding'`。
- 實作後仍紅的四條是「manifest 還沒重建」：`Shipped.*` 三條讀出貨 manifest、
  `selftest_test` 跑 `out/mika-milfy.parts.json` 遇到新 check（這一條同時是 selftest 新 check 的
  red 收據）。`make.py` 重建後 `binding-0906-tests.log`：`Ran 215 tests … OK`（Phase 3.5 是 189，
  +26 = `binding_test.py` 全部）。
- `binding-0906-selftest.log`：3 rounds PASS，每輪 `[ok] every part still says how it is bound`。

## 等價（chooser 重現每個現行選擇，零 override）

- `binding-0906-build.log`：`make.py` 全程 exit 0，vertex sha **`d2f578d76a7b8d22`** = HEAD 出貨檔
  `mika-milfy-12.vrm`（sha 含 JOINTS／WEIGHTS）。
- `binding-0906-attrdiff.log`：對 HEAD 出貨檔，沒有任何 attribute 或 morph target 有差（`worst` 只有
  `indices` 一個鍵），差的只有 Hair001.baked primitive 61／64（Hair_Bun_L／R）的 index 順序
  （Blender 髮髻不決定性，三角形集合相同，Phase 3 已知）。
  `nodes equal False` 是 HairTailL_0／R_0 translation y 差 2.2e-16：同一輸入上
  `twintail._frame_of`（Phase 3.5 的矩陣乘積）與舊的 translation 加總相差正是 −2.22e-16
  （本檔撰寫時現算），Phase 4 沒碰 twintail 的座標計算。
- 出貨 manifest `public/avatar/mika-milfy-12.parts.json` diff：213 行新增全是 `binding` 區塊，
  26 行刪除是每個 part 的 `"group": …` 補逗號。`.vrm` 用 `git checkout --` 還原 HEAD 位元組
  （內容等價，避免 12MB 二進位翻動）。
- manifest 宣告的策略（`binding_test.Shipped` 釘住）：Outfit_Bottom drape；Outfit_Top／Cardigan
  nearest smooth 16；Belt／Socks／Shoes／Bandage_Thigh／Ribbon_Neck／Ribbon_Waist nearest；
  Ribbon_Hair／Bun／Ear／Crown／HairClip_* single（head 1.0）；Body_Skin／Face／Hair_* inherit；
  Hair_Twintail_L/R chain。計畫原稿第 6 條列的 Acc_Frill_Hem／Acc_Collar／Outfit_Socks=inherit
  是手作路徑的部件，出貨檔（mellow）裡沒有或被廠商件取代，測試改釘出貨檔實際有的。
- `binding-0906-motion.log`：`python3 scripts/avatar/motion.py` 第 21 行 PASS、exit 0（十支 clip 的
  穿模 gate，最差 akimbo 0.61 of limit，與 Phase 3 收據的 0.63 同一支 clip）。

## Mutation（`binding-0906-mutate.py` → `mutations-0906-binding.md`）：24／24 RED，全部還原

B1 環狀比、B2 方位覆蓋、B3 胯下線、B4 整權重、B5 同一根骨、B6 shell、B7 平手重排、B8 平手取最小
index、B9 single slot 轉換、B10 nearest slot 轉換、B11 腿占比 0.75、B12 聯集決策、B13 記 smooth、
B14 override 記 chosen、B15 inherit 不動列；C1 `customise.remap` 剝欄位（remap 測試）、C2 同一
mutation 由 `selftest_test` 端到端抓到；P1 partition 蓋章；W1 put 不記錄、W2 manifest 尾不寫 put
的決定、W3 put 走回 `garment.bind`、W4 weld 走回 `garment.bind`；S1 selftest 不查；T1 twintail 不寫。

W1–W4／S1／T1 六道是 `binding_test.Wiring` 對原始碼的 regex 斷言，不是行為斷言：計畫第 6 條把
「`put()` 不寫 manifest → 紅」放在檔案級重建測試下，每道 mutation 重跑 `make.py` 不現實，改由
source 掃描擋。真正的端到端保護是 C2（剝欄位經 `selftest_test` 讀實際寫出的 manifest 抓到）。

## 沒做／已知

- 出貨檔沒在瀏覽器重載（頂點與權重逐位元相同，只有 manifest 多欄位；網站不讀 parts.json）。
- vertex sha 等價只覆蓋出貨（mellow）路徑。手作路徑的部件（Acc_Collar／Acc_Buttons／Acc_Frill_Bust／
  Acc_Bear_Face／Acc_Bandage_*）只有探針量測支撐，沒有第二次 build 的 sha。胯下線以下的四件另用
  `binding-0906-probe-hand-below-crotch.py` 照 build.py 的公式建出來過 chooser（結果附在
  `binding-0906-probe-bands.log` 末四行）：熊臉 cover 0.17／annulus 0.92（六顆球離髖軸等距，只靠
  方位覆蓋擋）、大腿帶 0.83／0.14、小腿帶 0.83／0.08、腳踝帶 0.67／0.03，四件都 nearest。
- `binding.context` 需要 hips 與（drape 時）兩根 upperLeg；沒有腿的身體 `legs=None`，chooser 不會
  選 drape，`_drape` 直接 BadRig。
- `nearest` 的 slot 轉換在這具身體是 identity（三個 skin 同表），只有 `binding_test.Apply` 的反轉
  skin 夾具真的轉過；Phase 6b 的異表夾具才是總驗收。
- 廠商外套最低點 0.781 對胯下線 0.758 只有 23mm 餘裕；外套再長 24mm 會被判 drape。屆時該給
  `put(bind=binding.override(...))` 帶理由，不是調 `CROTCH_SHARE`。
