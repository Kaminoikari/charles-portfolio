# build.py 的角色假設抽成 module contract

2026-09-11 開工。骨架泛化計畫（`~/.claude/plans/nested-conjuring-wirth.md`）的
Phase 0–6b 已經把 humanoid map、蒙皮、retarget、clearance 都收斂成身體無關，
`build.py` 是最後一個仍然綁死在單一角色上的層。

## 現況（量到的，不是估的）

`scripts/avatar/build.py` 有 1731 行，其中 `build()` 一個函式佔 1059 行
（L665–1723）。模組層的大寫常數有 **51 個**（用 AST 逐一列舉，不是 grep；第一
次數成 42 是因為走訪只認 `ast.Name` 目標，`HAIR_SHIFT, HAIR_SAT, HAIR_LIFT = …`
這種 tuple 賦值整組被跳過，步驟 1 的腳本要展開 tuple target）。字串層的角色名
命中：`Milfy` 65 處、`Mellow` 12 處。

這 51 個常數混住了三條互相獨立的軸：

- **底模**：`HEAD_HAIR`、`OUTLINE_KEEP` 直接寫 VRoid 的材質名
  （`F00_000_Hair_00_HAIR_0n`）。換一具底模，這些名字不存在。
- **服裝包**：`MELLOW`、`MELLOW_OUTER`、`MELLOW_BONEMAP` 指向 MellowHeart 的
  檔案；`MELLOW_PARTS`、`MELLOW_SHIFT`、`MELLOW_LOOSEN`、`MELLOW_STANDOFF`、
  `MELLOW_BIND_SMOOTH`、`MELLOW_TINT`、`MELLOW_GAIN`、`THIGH_BAND_*` 是那一包
  衣服在這具身體上的逐件調校。換一包衣服，網格名與間隙全部作廢。
- **角色美術**：`PALETTE`（13 個 `Milfy_*` 材質）、`RIM_COLOR`、`BLENDER_PARTS`、
  `HAND_GARMENTS`、`HEAD`、`EAR_INNER*`、`BOWL_MEAN`、`GOLD_RAMP`、`CROWN_*`、
  `HAIR_*`、`SKIN_*`、`EYE_TARGET`、`OUTLINE_VALUE`／`OUTLINE_COLOR`。這些是量
  自 Mika 參考圖的值。

剩下的是管線本身的閘門（`BOW_GAP_MAX`、`TAIL_COAT_*`、`SHAPE_KEY_MIN_MEAN`、
`HAIR_FLATTEN_BLOCKS`、`OUTLINE_CHROMA_MAX`），它們不屬於任何一條軸，留在
`build.py`。

`build()` 函式內部另有一批絕對高度殘留（確認的兩處：L770 的
`(0.945, 1.005, 1.065)`、L826 的 `1.176`）。總數未確立，確立它是步驟 1 的工作，
不在這裡寫一個沒量過的數字。

## 範本已經存在

`TORSO_EDGES`（L652）是這件事做對的樣子。2026-09-07 之前它是三個絕對高度
（1.181、1.168、1.155），只在這具 VRoid 身體上讀過一次；改成腰→肩跨距的比例
之後，「軀幹長一點的身體上，胸帶會停在原高度而它要蓋的肋骨已經移開」這個缺陷
就不可能發生。驗收寫在它的註解裡：**在原本那具身體上重現舊高度到 0.1mm 以內，
三個頂點遮罩逐一相同**。

Phase 2 就是把這一步從高度推廣到整組常數：值本身不變，改變的是它由誰擁有、以
及換一具身體／一包衣服時誰必須跟著改。

## 步驟

1. **分類**。對 51 個模組常數與 `build()` 內的數值字面量，逐一用一條寫成程式的
   判準分到四類（底模／服裝包／角色美術／管線閘門），輸出一張表。判準是「換掉
   這條軸上的資產時，這個值是否必須改」，而判斷依據是它的**消費端**，不是它的
   名字或值裡有沒有角色字串（字串比對判不出 `SKIN_TARGET` 這種量自某張畫的
   值）。這張表是後面三步的合約，先定下來再動任何程式碼。
2. **抽出角色美術**：`characters/mika.py`（或等價的資料檔）持有 PALETTE 與所有
   量自參考圖的顏色與位移，`build.py` 由參數讀入。
3. **抽出服裝包**：`outfits/mellowheart.py` 持有網格對照、間隙、tint、gain、
   bonemap 路徑。
4. **抽出底模依賴**：VRoid 材質名改由 manifest／網格自己推導，比照 Phase 4 的
   `binding.py` 與 Phase 6b 的 partition 拒絕策略。

## 驗收

- 每一步結束後，用同一組輸入跑 `make.py`，產出的 **manifest 逐欄相同**，且所有
  既有 gate 的量測值相同。位元組層允許的唯一差異是 `head.py` 兩顆髮髻的已知非
  決定性（見 memory `project_milfy_replica_pipeline`）。
- 每抽出一條軸，補一條測試：把該軸的合約換成第二組值，斷言 `build.py` 的行為跟
  著變；還原後轉綠。逐條 mutation 各自確認會紅。
- 分類表上每一個判為「管線閘門」的常數，要能說出它在換軸時為什麼不必改。

## 不做

- 不改任何常數的**值**。這是搬家，不是調校。
- 不支援第二個角色或第二包衣服的實際建置。本 phase 只把合約的邊界劃出來並證明
  它可替換，真的做出第二套是後續的事。
- 不動 `build()` 的演算法結構。1059 行的拆分是另一個題目，混進來會讓「manifest
  逐欄相同」這條驗收失去意義。

## 風險

- 這些常數幾乎每一個都帶著長註解，記著它是怎麼量出來的、以及前幾版錯在哪。搬家
  時註解必須原樣跟著走，否則下一個人會把量過的值當成猜的。
- 三條軸不是完全正交：`MELLOW_PARTS` 的間隙是「那包衣服在這具身體上」的值，換
  任一邊都要重量。步驟 1 的表要標出這種雙軸格，不要硬塞進單一擁有者。
