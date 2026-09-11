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

---

## 步驟 1 的產出：分類表（2026-09-11）

判準跑在 `scripts/avatar/evidence/build-axes-0911.py`。它不印表就算了事，而是
**斷言這是一個分割**：AST 找到的每個常數恰好被指派一次，且沒有指派到 AST 找不到
的名字。常數增刪或搬走時，表跟檔案對不上會直接 assert 失敗。

| 軸 | 個數 | 常數 |
|---|---|---|
| 底模 | 6 | `HEAD_HAIR`、`OUTLINE_KEEP`、`SCALP_HUE`、`SCALP_WINDOW`、`SCALP_FRINGE_TO`、`SCALP_FRINGE_SAT` |
| 服裝包 | 7 | `MELLOW`、`MELLOW_OUTER`、`MELLOW_BONEMAP`、`MELLOW_PARTS`、`MELLOW_TINT`、`MELLOW_GAIN`、`THIGH_BAND_SOURCE_MATERIAL` |
| 服裝包 × 身體 | 5 | `MELLOW_SHIFT`、`MELLOW_LOOSEN`、`MELLOW_STANDOFF`、`MELLOW_BIND_SMOOTH`、`THIGH_BAND_FINAL_CLEARANCE` |
| 角色美術 | 24 | `HEAD`、`EAR_INNER`、`EAR_INNER_SHADE`、`BOWL_MEAN`、`GOLD_RAMP`、`CROWN_SHIFT`、`CROWN_LIGHT`、`HAND_GARMENTS`、`BLENDER_PARTS`、`HAIR_SHIFT`、`HAIR_SAT`、`HAIR_LIFT`、`HAIR_UNIFY`、`HAIR_MATERIAL_TONE`、`HAIR_SHADE_TONE`、`BROW_SHIFT`、`BROW_SAT`、`SKIN_TARGET`、`SKIN_MATERIAL_TONE`、`OUTLINE_VALUE`、`EYE_TARGET`、`PALETTE`、`RIM_COLOR`、`OUTLINE_COLOR` |
| 管線 | 9 | `TAIL_COAT_INTRUSION_MAX`、`TAIL_COAT_INSIDE_SHARE_MAX`、`SHAPE_KEY_MIN_MEAN`、`BOW_GAP_MAX`、`HAIR_FLATTEN_BLOCKS`、`OUTLINE_CHROMA_MAX`、`NECK_MARGIN`、`WAIST_SEARCH`、`TORSO_EDGES` |

### 分類時量到、值得記下來的四件事

**「底模」這一軸比預期大。** `SCALP_*` 四個常數看起來像角色美術，實際上量的是
VRoid 匯出檔自己的性質：VRoid 會把一片髮色的頭皮蓋畫進臉部 atlas，匯出檔上色相
261、粉紅重繪後 257，而這四個常數是抓住那片蓋子的窗與邊緣。換一具底模，那片蓋子
的色相就不是 261。單看名字會把它們歸到角色。

**`MELLOW_*` 不是同一類。** 以 dict 的 key 從哪裡來當判準就分得開：
`MELLOW_PARTS`／`MELLOW_TINT`／`MELLOW_GAIN` 的 key 是廠商自己的網格與材質名
（`Inner`、`Skirt_Cloth`、`Belt_Acc`、`Leg_Acc`、`Main_Ribbon`、`Leg_belt`，在
`blender/mellow.py` 裡對得上），換一包衣服整批作廢；`MELLOW_SHIFT`／`_LOOSEN`／
`_STANDOFF`／`_BIND_SMOOTH` 的 key 是**我們自己的**部件名（`Outfit_Cardigan`
等），換衣服時 key 還在、值卻要重量，換身體時也一樣。這五個是 plan 風險段講的
雙軸格，不能塞給單一擁有者。

**`PALETTE` 的 13 個 `Milfy_*` 是我們產出的材質名，不是讀進來的。**
`build.py:674` 用 `add_material` 逐一建出來。所以它同時是角色的配色與出貨 VRM 的
材質命名權，抽走它等於決定第二個角色的材質要叫什麼。

**兩個常數已經做完了這件事。** `WAIST_SEARCH` 與 `TORSO_EDGES` 在 2026-09-07 都
從絕對高度改成了地標跨距的比例，前者的註解還記著當時的症狀：0.8x 與 1.25x 兩具身
體回報同一個 1.020，「答案來自常數而不是來自身體」的簽名。它們是這個 phase 的完
成樣本。

### `build()` 內的絕對高度：6 個字面量，4 行

判準是「literal 流進一個代表 y 的參數或與 `pos[:, 1]` 相比」，不是「數值落在
0.5–2.0」（那樣會收到 46 個，絕大多數是比例與 UV 座標）。

| 位置 | 值 | 是什麼 |
|---|---|---|
| L769 | 1.02 | 找最接近胸口的頂點，與 `p[:, 1]` 相比 |
| L770 | 0.945、1.005、1.065 | 三道環的高度 |
| L826 | 1.176 | `garment.ring_at(pool, 1.176, …)` 的荷葉邊環 |
| L923 | 0.652 | `wrap('Acc_Bandage_Thigh', 0.652, …)` |

L923 特別值得看：它的兩個手足 L924、L925 已經由 `ankle`／`knee` 地標推導
（`ankle + (knee - ankle) * 0.38`、`ankle + 0.030`），只有大腿繃帶還留著絕對高度。

### `build.py` 以外的消費端

`src/` 對 `Milfy_` 零命中，runtime 不認得這些材質名，合約邊界整個在
`scripts/avatar/` 內。活程式碼的耦合只有三處，其餘命中都是註解或 evidence log：

- `measure.py:96`：`('皇冠', 'Milfy_Gold', SHEET, …)`，量測目標以材質名指定
- `appearance_test.py:520`：斷言 `Milfy_Gold_ramp` 這個材質存在
- `validation/briefs.json` 的 B05：改緞帶顏色的 brief，直接指名 `Milfy_Mint`

`blender/mellow.py` 另外持有一整份廠商網格與材質名，步驟 3 的服裝包合約要把它與
`build.py` 的那七個常數視為同一份合約的兩半。

---

## 步驟 2 的產出：角色合約（2026-09-11）

`scripts/avatar/characters/mika.py` 持有 **23 個**值，每一個連同它的註解逐字搬過
去。搬完先證明搬對：逐名比對 `build.py` 與新模組，23/23 完全相同（含型別），這一
步在改 `build.py` 之前做，因為改完之後就沒有對照組了。

`build()` 的簽章變成 `build(src, dst, manifest_path, out_manifest, character=mika)`，
34 個參照點全部改成 `character.X`。`build.py` 現在一個角色常數都不宣告。

### 三個不能照抄的地方

**`RIM_COLOR` 進角色模組，`OUTLINE_COLOR` 不進。** 兩個在步驟 1 都歸在角色軸，實
際上不同類：`RIM_COLOR` 只讀自己 `PALETTE` 的薄荷色，怎麼算都是她的；
`OUTLINE_COLOR` 還要讀 `OUTLINE_CHROMA_MAX`，那是「任何描邊能有多少彩度」的管線規
則。所以前者搬進去，後者留在 `build.py` 變成 `outline_colour(character)`。把推導放
進資料檔會讓第二個角色跟自己的配色悄悄不一致。

**三個模組層 helper 讀得到這些值，所以光把 character 傳進 `build()` 不夠。**
`add_material` 讀 `OUTLINE_COLOR`／`RIM_COLOR`、`bowl_texture` 讀 `BOWL_MEAN`、
`uv_facet` 讀 `CROWN_LIGHT`。後者巢狀在 `build()` 內，closure 就解決了；前兩個改成
收參數。`add_material` 的 `outline`／`rim` 是 keyword-only **且沒有預設值**，理由是
它會被當 callback 交給 `outfit.load`：給了預設值，第二個角色的每一件匯入服裝都會
悄悄戴上 Mika 的邊光。交出去的地方改用 `functools.partial` 綁定。

**兩段註解在原檔被別軸的常數夾開了。** `BLENDER_PARTS` 的開頭兩行註解上面卡著
`BOW_GAP_MAX` 和它自己的單行註解，`HAIR_MATERIAL_TONE` 的註解上面卡著
`HAIR_FLATTEN_BLOCKS`。搬家時要把被夾開的那半一起帶走，否則留下的是一段沒有主人
的說明。

### 分類時沒看到、寫測試才量出來的一件事

`OUTLINE_CHROMA_MAX` **目前對 Mika 是鬆的**，完全不咬。她的膚色 (252, 222, 214) 在
`OUTLINE_VALUE` 0.20 下三個通道的散佈是 0.0302，低於允許的 0.038，所以她的描邊就是
膚色色相本身。第一版測試把 cap 調高想看顏色變化，結果不變：floor 是
`max(raw) - cap`，調高只會讓 floor 更不咬。要往下調才驗得到。這道上限是為彩度更高
的膚色準備的，正是「第二個角色出現前不會被執行到」的那種守衛，所以測試除了驗它會
動，也順手斷言它今天確實不咬，哪天咬了就會有人來讀這段。

---

## 步驟 3 的產出：服裝包合約（2026-09-11）

`scripts/avatar/outfits/mellowheart.py` 持有 **11 個**名字（原本 12 個常數，因為
`MELLOW` 與 `MELLOW_OUTER` 併成一個 `FILES` tuple）。搬前一樣先逐一比對，11/11 與
`build.py` 的值相同。13 個參照點全在 `build()` 內，沒有模組層 helper 讀它們，所以這
一步比步驟 2 單純。

### 名字全部去掉 `MELLOW_` 前綴

角色那一軸的名字（`PALETTE`、`SKIN_TARGET`）本來就是通用的，直接沿用；服裝這一軸
不是，`MELLOW_PARTS` 是用第一包衣服的名字寫的合約，第二包填不進去。所以合約裡叫
`PARTS`、`TINT`、`GAIN`、`STANDOFF`。值一個沒動。

### `FIT` 區塊：不給單一擁有者的那五個

步驟 1 的風險段點名的雙軸格，處理方式是合約裡一條有橫線的區塊，上面寫明「這包衣服
穿在這具身體上」。五個值（`SHIFT`、`LOOSEN`、`STANDOFF`、`BIND_SMOOTH`、
`THIGH_BAND_FINAL_CLEARANCE`）放在橫線之下。它們的 key 是我們自己的部件名，所以看
起來可以沿用，而那正是危險的地方：間隙是一件衣服離某一副胯骨多遠，換哪一邊都要重
量。`outfits_test` 有一條測試斷言那條橫線還在，而且那五個名字都還在它下面，因為一
個悄悄掉了標籤的區塊，下一個人就會把它併回去。

### `outfit_files` 是為了讓「換一包衣服」可驗而抽出來的

原本 `build()` 內三行 inline：把 `FILES` 接到 `dst` 的目錄下、濾掉不存在的。抽成
函式之後，換一包宣告不同檔案的合約可以在不跑整個建置的情況下驗出差異。Blender 沒
產出的檔案是跳過而不是拋錯（手工服裝會頂替），這條也跟著變成可測的行為。

### `BONEMAP` 的路徑深了一層

它是用 `__file__` 推出來的，而 `__file__` 從 `scripts/avatar/` 移到了
`scripts/avatar/outfits/`。多一層 `os.path.dirname` 才回得到 `bonemap/`。這種錯不會
在 import 時炸開，只會在建置時找不到檔案然後退回十四根錨點，所以合約測試直接斷言那
個路徑存在。

---

## 步驟 4 的產出：底模（2026-09-11）

這一軸的答案有兩個，而分界線本身就是結論。

### 兩個髮材質名是**推導**的

`HEAD_HAIR` 與 `OUTLINE_KEEP` 從 `build.py` 消失，改由 `body_hair_materials(doc,
known)` 從「partition 標成 `Hair_*` 的 primitive」推出來，依三角形數排序。名字有穩
定的來源可讀，所以不必寫死。

在這具身體上完全重現：doc 裡實際存在的髮材質就是四個（HAIR_01／02／04／05），而
`OUTLINE_KEEP` 原本宣告 01–06，多出來的 03 與 06 **根本不在 doc 裡**，跳過它們一直
是 no-op。排序也不是勉強分出來的：`HAIR_02` 覆蓋 10020 個三角形，第二名 1122 個。

`known` 參數擋住一件事：頭飾與內耳也是 `Hair_*` 部件，而內耳帶著我們自己造的材質。
沒有它，這個 build 自己寫進去的材質會被當成身體原本就有的。

### 十九處 inline 的 VRoid 名字，是步驟 1 沒看到的

`build.py` 裡有 19 處直接寫著 `F00_000_*` 的貼圖與材質名（六張髮貼圖、眉、臉
atlas、身體 atlas、虹膜、兩個膚材質）。**步驟 1 的常數盤點一個都沒找到**，因為它們
是寫在函式內的字面量，不是模組層常數。這是比計畫預期更大的耦合面，也是「列常數」這
個方法本身的盲區。

它們全部進了 `bodies/mika_base.py`，**宣告而不是推導**。有幾個其實推得出來（臉
atlas 就是 Face 部件的膚材質上那張貼圖），但眉和虹膜只能靠名字跟臉 atlas 的其他兄
弟分開，所以「推導一部分、宣告一部分」的規則會比全部宣告更難驗。

### 四個 `SCALP_*` 是**量的**，而且說明為什麼不推導

它們量的是 VRoid 畫進臉部 atlas 的那片髮色頭皮蓋（匯出檔 265、粉紅重繪 257），不是
我們選的值。要推導就得在不被告知位置的情況下把 atlas 的 texel 分群，而這具身體的腮
紅離嘴唇只有 9 度。在那個偵測器存在、而且能對第二具匯出檔驗證之前，「一個註明量自
哪具匯出檔的數字」是誠實的形式。測試把它的工作寫成算術而不是散文：窗口要蓋到 265
與 257 兩個蓋子，而且不能碰到 9 的皮膚與 0 的嘴唇。

### 最後五個絕對高度

`build()` 內還剩五個（胸口探測 1.02、三顆鈕扣 0.945／1.005／1.065、胸前荷葉邊
1.176）加上大腿繃帶的 0.652。全部改成地標跨距的比例，前五個對腰→肩，最後一個對膝→
髖——它下面兩行的手足本來就是那個寫法。在原本這具身體上重現到 **0.033mm 以內**，最
差的是胸前荷葉邊的 0.0068mm，標準沿用 `TORSO_EDGES` 2026-09-07 訂的 0.1mm。

順手抓到一個會咬人的東西：`build()` 內原本就有一個區域變數叫 `hair_materials`，會
遮蔽我新加的模組層函式。函式改名為 `body_hair_materials`。
