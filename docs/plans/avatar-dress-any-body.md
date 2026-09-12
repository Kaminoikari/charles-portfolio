# 讓任何身體穿上這套衣服

骨架泛化計畫（`~/.claude/plans/nested-conjuring-wirth.md`，Phase 0–6b）已經讓引擎
能驅動任何骨架：14 家 rig family 進 registry，動作重定位、手勢、鏡頭、彈簧全部跨
身體成立。模組合約計畫（`avatar-build-module-contracts.md`）讓 `build.py` 不再宣告
任何一個角色、服裝或底模的值。

剩下的是**穿衣層**：`make.py --base <陌生身體>` 會停在第 1 步。

## 現況（量到的，不是估的）

**整節量在 `9b09611`，也就是這份計畫動手之前。** 階段 0 與階段 1 已經回答掉其中的
兩列，各自在下面的步驟裡寫了結果；這一節留著原樣，因為它是判斷還沒做的部分時要回頭
看的基準。

### 它停在哪裡，以及為什麼是停而不是壞

`evidence/alicia-0907-build.log` 是完整的一次實跑，對象是 Alicia Solid
（ニコニ立体ちゃん，VRM Consortium 自己的測試模型）：

```
1. partition
  alicia-solid.vrm 不是這一步認得的 VRoid 匯出，拒絕命名：
    - 沒有名為 Face.baked 的 mesh
    - 沒有名為 Body.baked 的 mesh，因此 BODY_NAMES 的 primitive 編號對不到任何東西
```

拒絕是刻意的。`partition.recognise()` 的註解寫明理由：硬跑會產生一份讀起來合理但
虛構的 `parts.json`，而後面每一步都會相信它。2026-09-07 的 Seed-san 夾具就是這樣把
一隻機器人的手臂與衣服標成 `Hair_Twintail_R`、`Hair_Bangs`、`Hair_Side_L`。

### 三步被擋住，不是一步

| 步驟 | 做什麼 | 當時綁在 VRoid 的什麼 | 現況 |
|---|---|---|---|
| 1 partition | 標記每個 primitive | mesh 名 `Face.baked`／`Body.baked`、primitive 索引、髮絲的絕對世界座標 | 三者皆已解（階段 0／2b-i／2b-ii）；剩 `CLIP_DECALS` 一條 |
| 2 strip | 刪掉它自己的衣服 | 上一步的標籤 | 隨第 1 步 |
| 3 skin | 把畫在身體貼圖上的衣服重繪成皮膚 | `is_skin` 的絕對色彩門檻、寫死的材質名 | 已解（階段 1） |

### 純幾何與骨架的訊號能分開什麼

`evidence/partname-0907-probe.log` 在兩具身體上逐 primitive 量過四個訊號
（morph 綁定、主控人形骨群、非人形骨佔比、彈簧驅動）：

- **臉**：有 blendShape／expression 綁定。可靠。
- **頭髮**：掛非人形骨、在頭底下、被彈簧驅動。Alicia 的 `flonthair` 讀 52–100% 非
  人形骨。可靠。
- **會飄的衣服**：掛非人形骨。Alicia 的 `cloth`／`cloth1`／`cloth2`／`cloth_ribbon`
  讀 98–100%。可靠。
- **貼身、綁在身體自己骨頭上的衣服**：**分不出來**。Alicia 的 `body_top`（水手服）
  讀 63–100% 人形骨、0% 非人形骨，與裸皮膚一模一樣。

### 「脫掉它的衣服」對多數身體不成立

`a031907` 的量測：到最近面的帶號距離能還原穿衣層次，在 VRoid 身體上有效（皮膚
57% 的取樣點在外套底下、腳 91% 在鞋底下、裙 83% 在外套底下）。但

- **Alicia 沒有這種配對**：最深的 body-to-body 覆蓋只有 34%，而且是同一曲面的兩片
  相鄰面板。她的軀幹**就是**制服。
- **Seed-san 有 `wear` mesh，完全沒有 body mesh**。

衣服底下沒有身體，就沒有東西可以露出來。

### 貼圖 alpha 在陌生身體上是平的

`cover._painting`（我們既有的實作）在 Alicia 上逐 primitive 量：

```
Alicia_body       (皮膚)     100.0%      other.baked   (裝飾貼花)   5.4%
Alicia_body_wear  (水手服)   100.0%      other02.baked               0.0%
Alicia_wear       (水手服)   100.0%
cloth*.baked      (裙、緞帶) 100.0%
```

對照它在 VRoid Studio 換裝匯出上的表現（`Body_Skin` 100%／`InnerTop` 23.8%／
`InnerBottom` 6.3%，見 memory `project_dressup_three_skin_layers`），可以看出這個
訊號真正回答的是「這層是不是畫在身體複本上的內搭」，不是「這是皮膚還是衣服」。

## 研究結論（2026-09-11／12，七路）

完整收據在各 subagent 報告；以下只留改變決策的部分，並標明一手來源。

### 檔案格式幫不上忙

VRM 唯一的 per-mesh 標註是 `firstPerson`，規格對 `thirdPersonOnly` 舉的例子是
「face, eyes, head, hair, hat, helmet」，**頭髮與帽子同一桶**；預設值 `auto` 的規範
定義是「看頂點有沒有綁 Head bone 或其子骨」，那是幾何推導指令不是語意標籤。實測本機
16 具：14 個 VRM0 的 `meshAnnotations` 全是空陣列，2 個 VRM1 全是 `auto`。

Khronos 那邊 `KHR_mesh_annotation` 在 PR #2512 被延後，換裝列在 Phase 2 future work。
生態唯一可機器檢查的部件契約是 Ready Player Me 的 `meshNames.schema.json`，單一廠商
封閉生態。

`alphaMode` 與 `doubleSided` 實測也不能用：標準 VRoid 匯出裡髮、上衣、下身、鞋、
連身體皮膚全是 `MASK`，而 `mika-milfy-12.vrm` 是 24 個材質全 `OPAQUE`；髮與衣服同樣
都是 `ds=1`。

### 學界分不出來，而且連指標都沒有

SAMPart3D 的 benchmark PartObjaverse-Tiny：200 個物件、477 個相異部件標籤，
`skin`／`bare`／`flesh`／`garment`／`shirt` 出現 **0 次**；29 個人形物件裡，穿著衣服
的軀幹一律標成 `body`。沒有資料教它分，也沒有指標量過它分不分得出來。

實跑佐證：社群最常用的服裝 parser `segformer_b2_clothes`（ATR 18 類）跑我們自己的
toon render，**全裸雙腿被判成 `Pants` 3.33%，腿的兩個類別合計 0 px**；同一模型跑真實
照片完全正確。裁切成只有腿再跑，`Pants` 27.15%、`Right-leg` 0.09%。動漫域沒有任何
部件 parser 存在。

### neural garment 家族在商業上全滅

MGN、TailorNet、IF-Net、IP-Net、ICON/ECON、SHAPY、SMPLicit、DrapeNet 全部卡在 SMPL
model licence 的「any use for commercial purposes is prohibited」，repo 自身是 MIT 也
救不了。SewFormer、DressCode、BCNet、ManifoldPlus 整個 tree 連授權檔都沒有。而且
輸出是解剖正確的成人比例，對頭身比 1:4 的角色結構性錯配。

### 遮蔽是產業共識，不是將就

MakeHuman/MPFB2 的 `ClothesService` 把 fitting 與「delete groups + MASK modifier」寫
在同一個 service。整個 VRChat 生態（`AvatarOptimizer` 的 Remove Mesh By Mask／By UV
Tile、`MeshDeleterWithTexture`）沒有一個是分類器，全部靠遮罩。

市面最強的 VRChat 換裝工具もちフィッター（¥2,500）內建只有四具身體的**人工
profile**，而且變形其實是裝一份 Blender 去跑。沒有人解決了「任意身體全自動」。

### 補洞路線結構性無效

所有補洞工具的前提是存在 boundary loop。Seed-san 那種「根本沒有軀幹幾何」的情況沒有
東西可三角化，PyMeshFix 會把半個軀幹封成一顆實體。

### 我們已經在做的兩件事有名字

- **pull-push 補洞** = Gortler 等，*The Lumigraph*, SIGGRAPH 1996 §3.4，連
  `min(w,1)` 的權重飽和都一樣。
- **`is_skin` 的 R>G>B 規則** = Kovac et al., EUROCON 2003（doi
  `10.1109/eurcon.2003.1248169`）的 explicit skin-cluster rule。它的前提是日光下的
  真實人類皮膚，動漫貼圖的顏色是美術選擇，前提不成立。

### 值得引進的三樣，全部授權乾淨

| 東西 | 授權 | 解什麼 |
|---|---|---|
| `libigl` generalized winding number（Jacobson 等，SIGGRAPH 2013，doi `10.1145/2461912.2461916`） | 核心 MPL-2.0 | 取代自推的帶號距離；對破面、自交、非水密穩健，正是害射線奇偶性失敗的那個性質 |
| `Huangzizhou/cloth-fit`（IFGR，SIGGRAPH 2025，doi `10.1145/3721238.3730590`） | MIT | 服裝對位，IPC 保證無穿插 |
| `rin-23/RobustSkinWeightsTransferCode`（Epic Games，SIGGRAPH Asia 2023，doi `10.1145/3610543.3626180`） | MIT | 權重轉移 |

`cloth-fit` 的 CI 在 `macos-14`（Apple Silicon）的 Release 與 Debug 四個 job 於
2025-08-19 全綠；論文自己的 54 組實測在 MacBook Pro M3 Max 限 16 threads 上跑，平均
97 秒、最長 432 秒。純 CLI。

**它的輸入是我們已經有的東西。** 量過：

- 全部 17 具身體（16 公開 ＋ Alicia）的**共同 humanoid 骨是 51 根**，扣掉手指與眼睛
  約 20 根，正是論文用的粒度。
- 限制到 `humanoid.REQUIRED` 的 15 根，七個家族（含 VRM0／VRM1／非 VRoid 的 Alicia）
  產出**唯一一個連通性簽章**：15 verts、14 edges、邊集與排序完全相同。這正是
  cloth-fit README 要求的「same mesh connectivity, joints ordered the same way」。

### 一個會靜默咬人的規格事實

VRM 1.0 的 T-pose 規格對**外觀**有八條約束，但對 node transform 的數值定義只有一條：
「Definition 2.1. All node transforms are on a positive uniform scale」。**規格對
humanoid bone 的 local 旋轉軸沒有任何約束。** bone frame 必須從全域骨方向加階層
Gram-Schmidt 推導，絕不能拿節點自己的 local rotation；拿錯的話衣服會繞肢體軸轉一個
角度，而且只在沒開發過的家族出現。

## 步驟

### 0. VRoid 家族：類別後綴 token 取代寫死的索引表 — 已完成

`partition.py` 的 `BODY_NAMES` 用 primitive 索引寫死七個部件。在 Mika 自己的底模上，
它與 VRoid 材質名的類別後綴 token 完全對應：

```
BODY_NAMES 索引        材質名                         後綴
  0-3 Body_Skin     →  F00_000_00_Body_00_SKIN        SKIN
  4   Outfit_Top    →  F00_008_01_Tops_01_CLOTH       CLOTH
  5   Outfit_Bottom →  F00_001_01_Bottoms_01_CLOTH    CLOTH
  6   Outfit_Shoes  →  F00_006_01_Shoes_01_CLOTH      CLOTH
```

**換一具身體就對不上，而且是無聲的。** 收據
[partition-0912-grammar.log](../../scripts/avatar/evidence/partition-0912-grammar.log)：
Darkness_Shibu、Victoria_Rubin、Vita、Vivi 四具的 `Body.baked` 剛好也是 7 個
primitive，所以舊的 `recognise()` 讓它們過關，然後索引表把 #5 的鞋叫成
`Outfit_Bottom`、把 #6 的後髮叫成 `Outfit_Shoes`。四具、八個 primitive，每一份
`parts.json` 都讀起來合理。

修法是讀 VRoid 自己的匯出文法，不是啟發式：

```
<prefix>_<PartName>_<nn>_<CATEGORY>[_<nn>]
CATEGORY ∈ {SKIN, CLOTH, HAIR, FACE, EYE, MATCAP}
```

三個實測到的變體都要吃：頭髮材質 `F00_000_Hair_00_HAIR_03` 在 token 後面還有一個變體
編號（本機唯一一種 token 不在最後一段的 VRoid 名字，而 `CLIP_DECALS` 讀的正是這個
後綴）；`vrm1-twist-sample.vrm` 的 `Bottoms_01_CLOTH` 沒有 `F00_nnn_nn` 前綴；
換裝匯出會加裝飾字尾 `N00_004_01_Shoes_01_CLOTH (Instance) (Instance)`。

`recognise()` 的判準同時從「primitive 剛好 7 個」換成「每個 primitive 的材質都帶得出
部件名稱」。舊判準問錯了問題：HairSample_Female 匯出 6 個、三具 Sendagaya／Sakurada
匯出 9 個，它們都是普通的 VRoid 身體。

本機 16 具通過 `recognise()` 的從 9 具變成 13 具，13 具全部跑完 `partition()` 並產出
`parts.json`。當時三具仍被拒絕：`mika-milfy-12.vrm` 是我們自己的產出（材質叫 `Milfy_*`／
`Mellow_*`，不帶 token），`vrm1-twist-sample.vrm` 與 `vroid-studio-dressup.vrm` 的
mesh 不叫 `Face.baked`。

**這一步當時沒有解決的兩件事，後來都在階段 2b 解掉了**：mesh 曾經靠名字找，答案不是
containment 而是同一套材質文法（2b-i）；髮絲曾經靠這具身體的絕對世界座標分，改成從
骨架讀（2b-ii）。所以 partition 在階段 0 收尾時是「需要**一具** mesh 名字沒被改過的
VRoid 匯出」，現在連那個限制也沒有了，最新狀態見下面的 2b。

順手補了一道防禦：manifest 以部件名稱為鍵，第二個 mesh 主張同一個名稱時原本會無聲蓋掉
第一個。現在會拒絕。這正是把 HAIR 允許進 `Body.baked` 所帶出來的風險，所以那個部件叫
`Hair_BodyBack` 而不是 `Hair_Back`。

### 1. `skin.py` 的三個「對這具身體剛好夠用」的常數 — 已完成

量的方式用兩個指標，第二個存在的理由是第一個看不見自己的盲點。

**殘留**：`is_skin` 判定不是皮膚、且落在該 atlas 被 mesh 實際取樣到的 UV 範圍內的
texel 比例。UV 範圍由 Body SKIN 材質的 UV 三角形逐一光柵化得到。這個指標用 `is_skin`
自己量，所以看不見「被 `is_skin` 誤收的衣服」。

**殘留物**：完整走過 `strip()` 而未被改動、且離這具身體自己的膚色超過 120 的最大連通
區塊，單位是 px，判準是 `MIN_REGION`＝1500（`strip()` 自己對「大到算是衣服」的答案）。
膚色由 humanoid map 讀手部取得，完全不經過 `is_skin`。

收據 [skin-0912-residue.log](../../scripts/avatar/evidence/skin-0912-residue.log)。

**1a. pull-push 的金字塔深度。** 原本寫死 `levels=9`，在 2048 見方的 atlas 上只降到
4×4。AvatarSample_A 與 AvatarSample_C 在那一層各有 2/16 個格子完全沒有有效像素，
`colour / max(weight, 1e-6)` 於是輸出 `(0, 0, 0)`，上採樣再把這個零一路混進底下每一
層。AvatarSample_A 洞內的填色中位數因此是 `[175 148 130]`、最暗處 `[49 41 36]`，而
存活皮膚的平均是 `[243 215 190]`。

改成一路降到 1 像素之後，殘留從 12.46% 與 14.05% 進到 0.04% 與 0.00%，其餘 14 具逐項
不變。Mika 自己的遮罩逐 texel 相同（重繪比例兩邊都是 36.1008%），只有填色改變，最大
單通道差 7/255、平均 1.59。

`half()` 同時改成不對已經是 1 的維度再折半：原本會把 6×400 一路折成 0×50，非方形圖的
金字塔因此停在 1×N，那一層仍有整欄沒有有效像素。這是第二道防禦，有自己的 mutation。

**1b. `is_skin` 的絕對門檻。** `r > 105` 把兩件深棕衣服收進皮膚色域：AvatarSample_A
的上衣（49,193 px、`[120 92 80]`）與 Vivi 的（155,800 px、`[129 100 85]`）。兩者在
殘留指標上分別只讀到 0.06% 與 0.04%，因為指標問的正是被誤收的那一塊。

改成「離這具身體自己的膚色不得超過 `SKIN_RADIUS`」。膚色取自 humanoid map 說是手的
地方：手部與手指骨的蒙皮權重合計 ≥ 0.9 的頂點，沿 UV 取樣 atlas 取**中位數**。16 具
身體每一具都拿到 1428 個頂點（VRoid 的手是同一份網格）。中位數不是平均數，因為頂點
落在 UV island 邊界上，有相當一部分會取到外圍的描邊，這批樣本的離散度到 300 而中心
是對的。

**取手不取手臂，Vita 是本機唯一的反例**：它的手臂骨驅動一截青綠色袖子，手臂中位數
`[87 168 159]` 與手部 `[232 177 158]` 相差 144.8。參考色一旦不是皮膚，整張圖每個
texel 都落在半徑外，`strip()` 於是重繪 100.00%（正確值 57.13%），連可以借色的地方都
沒有了。

半徑 130 由端到端掃描定，不是由色彩理論定：110、130、150 三個值下，16 具身體沒有任何
一具留下大到算是衣服的非皮膚區塊，所以這個選擇落在一段平坦區間的中央。兩件衣服的距離
是 227 與 165，那是上界的來源。修正後全體最大殘留物 940 px（AvatarSample_B）。

Mika 自己的 atlas 有 13.9% 的 texel 改變，平均 1.22/255。最糟的單一 texel 從
`[115 40 13]` 變成 `[242 177 167]`：那是絕對門檻因為 115 > 105 而留下來的深紅棕，同一
個缺陷的小號版本。

**本機樣本沒有真正深膚色的身體**，最深的參考是 AvatarSample_B 的 `[206 157 135]`。
比它更深的身體整個色域壓在更小的體積裡，這個半徑會佔掉更大的比例，換身體前要重量。

**1c. 身體皮膚貼圖的材質名。** `body_image` 的預設參數寫死
`F00_000_00_Body_00_SKIN`，那是 Mika 底模、AvatarSample_A 與 B 的名字；其餘 13 具
`apply()` 在重繪任何東西之前就 raise，`make.py` 第 3 步對它們根本走不完。改成沿用
階段 0 的材質文法找「部件名是 Body 的 SKIN 材質」。臉也有一個 SKIN 材質、在自己的
atlas 上，重繪到它會把填色蓋到眼睛上，那是部件名回答而類別回答不了的一半。

順帶：VRoid 的 body atlas UV layout 對 10/16 具身體逐 texel 相同（IoU 1.0000），另外
4 具 ≥ 0.989。所以「哪個 texel 是身體的哪個部位」可以查表，不必猜。

### 2. 脫衣層：清單改成契約，其餘留給遮蔽

原本這一階段寫成「遮蔽取代脫衣」，量過之後拆成三件事，因為 VRoid 家族根本不需要遮蔽：
它的材質文法已經精確答出哪些 primitive 是衣服。遮蔽要解的是**分不出衣服的身體**。

**2a. 服裝清單由契約推導 — 已完成。** `make.DROP` 是五個部件名，也就是 Mika 底模剛好
有的那五個。`drop_parts` 對名單裡不存在的部件會 `SystemExit`，那是刻意的（默默跳過一個
拼錯的名字等於默默留下一件衣服），於是它把第 2 步在其他每一具身體上擋死。

改成由服裝契約宣告前綴、對這具身體的 manifest 解析：

```python
# outfits/mellowheart.py
REPLACES = ('Outfit_', 'Acc_')

# make.py 第 2 步
drop = customise.replaced(m, mellowheart.REPLACES)
```

前綴是服裝的事實（這套服裝取代身體的哪些部件），解析成名字是身體的事實。收據
[pipeline-0912-steps.log](../../scripts/avatar/evidence/pipeline-0912-steps.log)，現在是
七具身體第 1 到第 3 步全部走完（2a 交付時是六具，`vrm1-twist-sample` 由 2b-i 加入；
parts 數也比 2a 當時高，因為 2b 開始在這些身體上命名 `Hair_Side_L`／`Hair_Side_R`，
脫掉的清單一件沒變）：

```
AvatarSample_C     9 parts   removes Outfit_Bottom, Outfit_Shoes, Outfit_Top          skin 72.0%
Vivi               9 parts   removes Outfit_Shoes, Outfit_Top                         skin 13.1%
Sendagaya_Shibu   11 parts   removes Outfit_AccessoryNeck, Outfit_Bottom, ...          skin 36.7%
Darkness_Shibu     9 parts   removes Outfit_Shoes, Outfit_Top                         skin 77.7%
HairSample_Female  8 parts   removes Outfit_Shoes, Outfit_Top                         skin  3.0%
mika-pink         13 parts   removes 的正是原本那五個                                  skin 36.5%
vrm1-twist-sample  7 parts   removes Outfit_Bottom, Outfit_Shoes, Outfit_Top          skin  4.7%
```

`Outfit_AccessoryNeck` 是這條管線沒見過的部件，前綴照樣認得它。

撐住這件事的位置數出來是五個，不是改動看起來的那一個：make.py 的呼叫點、`replaced()` 裡的 `deletable` 檢查、比對述詞與排序，以及服裝契約裡的前綴值。五道 mutation 逐一拆，各自的 must-fail 集合全部照預期轉紅，收據在 [mutations-replaces-0912.md](../../scripts/avatar/evidence/mutations-replaces-0912.md)。

**2b-i. mesh 找法 — 已完成。** partition 原本靠 mesh 名字找 `Face.baked` 與
`Body.baked`。量過十六具的每一個 mesh
（[partition-0912-meshes.log](../../scripts/avatar/evidence/partition-0912-meshes.log)）
之後，兩個假設都不必要，而且第二個從一開始就問錯了問題。

- **臉**：帶 `FACE` 材質的 mesh，十六具各剛好一個。morph target 在其中十五具也唯一，
  第十六具是我們自己的產出 `mika-milfy-12`（匯入的服裝自己帶 6 個），所以 morph 只當
  佐證，`recognise()` 另外要求臉這個 mesh 真的帶 morph，因為那才是它被鎖住的理由。
- **身體不是一個 mesh**。`vroid-studio-dressup` 把它拆成七個（`Tops.baked`、
  `InnerTop.baked`、`Shoes.baked`……）。所以不再問「哪個 mesh 是身體」，改成逐
  primitive 問文法。
- **兩種頭髮由部件名分**，不由 mesh 分：`HairBack` 是整塊 baked 進去的物件（八具在身體
  mesh 群裡，`vrm1-twist-sample` 在一個就叫 `Body` 的 mesh 裡），`Hair` 是髮絲。
- **MATCAP 有名字了**：`Acc_<Part>`，也就是 dressup 的眼鏡。

收據 [partition-0912-bymesh.log](../../scripts/avatar/evidence/partition-0912-bymesh.log)：
本機 16 具能命名的從 13 具變成 14 具，`vrm1-twist-sample` 加入，而且它現在一路走完第 1
到第 3 步（[pipeline-0912-steps.log](../../scripts/avatar/evidence/pipeline-0912-steps.log)，
7 parts、脫掉 3 件、重繪 4.7%）。Mika 底模的 `parted.vrm` 逐位元組不變，`parts.json` 相同。

仍被拒絕的兩具，理由都換成了真正的結構問題：`mika-milfy-12` 的 20 個材質不帶類別
token（它是我們自己的產出，partition 本來就不對它跑），`vroid-studio-dressup` 是三個
mesh 都主張 `Body_Skin`。後者正是 2c 要解的那件事，manifest 目前一個部件只能屬於一個
mesh。

八道 mutation 逐一拆四個決定的八個位置，全部照預期轉紅，收據在
[mutations-meshes-0912.md](../../scripts/avatar/evidence/mutations-meshes-0912.md)。

**2b-ii. 頭髮命名 — 已完成。** 四個數字原本是量在 Mika 身上的絕對世界座標，換到
Sakurada_Fumiriya（髖部高 27cm）身上，「腰線以下」指的是她的膝蓋。改成從這具身體讀：

| 判準 | 原本 | 現在讀哪裡 | Mika 上量到 |
|---|---|---|---|
| 腰線以下 | y < 0.90 | `hips` 骨 | 0.878 |
| 臉的前面 | z < -0.03 | `leftEye` 骨，沿 `forward_z` | -0.025 |
| 後腦起點 | y > 1.44 | 眼睛到臉部 mesh 頂端的中點 | 1.4402 |
| 離中線 | \|x\| > 0.12 | 臉部 mesh 自己的半寬 | 0.092 |

左右也改由眼睛骨的 x 正負決定，因為角色的左在 0.x 是 -X、在 1.0 是 +X。

收據 [hair-0912-relative.log](../../scripts/avatar/evidence/hair-0912-relative.log)：
**Mika 的 77 條髮絲一條都沒換手**（`mika-pink` 與 `AvatarSample_B` 各 0 移動）。其餘
十二具動了 1 到 56 條，那正是原本的標籤在說謊的量；動 1 條的是
`vrm1-twist-sample`，它整顆頭的頭髮只有一個 primitive，而 `vroid-studio-dressup` 一條
髮絲都沒有所以不動。`baseline.vrm` 的 `parted.vrm` 逐位元組不變，收據
[partition-0912-baseline.log](../../scripts/avatar/evidence/partition-0912-baseline.log)。

**順帶抓到一個座標系缺陷。** 骨頭的世界座標與 mesh 的 POSITION 在 `vrm1to0` 跑過之後
不是同一個空間：它把整個 scene 掛到一個轉了 180 度的節點底下，骨頭全部移動、頂點
buffer 一個字沒動。原本 hair_name 只讀 POSITION 所以看不見，加進骨頭之後
`vrm1-twist-sample` 整顆頭的頭髮被判在眼睛前面，標成瀏海。改成用 `pose.skinned` 量
rest world，轉換前後答案相同（`Hair_Side_R`），並有一條測試把「轉過去再 partition 一次
得到同一組部件」釘住。

**這一步沒有解決的**：`CLIP_DECALS`（`HAIR_03`／`HAIR_05` 是髮夾貼花）仍然是 Mika 的
事實。它在另外兩具身上是錯的：AvatarSample_A 有 9 條、Victoria_Rubin 有 3 條普通髮絲
剛好用這兩個材質變體又落在眼睛前面，被歸成飾品，然後被 `mellowheart.REPLACES` 刪掉
（改成身體相對之前是 7 條與 1 條，所以這一步讓它略為變差）。三角形數分不開兩者
（Mika 的 18 片夾子 6 到 128 個，那 12 條髮絲 24 到 194 個），沒有便宜的通則；貼花
偵測屬於 2c 的遮蔽工作。逐身體的計數與三角形分布見
[hair-0912-clips.log](../../scripts/avatar/evidence/hair-0912-clips.log)。

八道 mutation（六個數字加座標系的兩端）全部照預期轉紅，收據在
[mutations-hairframe-0912.md](../../scripts/avatar/evidence/mutations-hairframe-0912.md)。

**2c. 遮蔽（未做）。** 給的是 Alicia 與 Seed-san 那一類：衣服與皮膚在同一片曲面上，
刪不掉。partition 的契約縮成三個**可量**的問題：

1. 哪些 primitive 絕不能動（臉＝morph 綁定；頭髮＝非人形骨＋在頭底下＋彈簧）
2. 哪些身體幾何在新衣服裡面（containment，`cover.py` 已經在做）
3. 哪個材質帶皮膚貼圖（階段 1 已完成）

這一步讓「Alicia 的 `body_top` 是皮膚還是制服」這個解不掉的問題不必問：要問的是
「這塊身體是不是在新衣服底下」。

**這一段原本寫「containment 從自推的帶號距離升級成 generalized winding number」，
寫的時候沒讀 `cover.py`。** 帶號距離那一版早就被換掉了：現在問的是沿著頂點自己的外法線
射一條 150mm 的射線，並且要求衣服比任何其他皮膚都先被射到（`cover.covered` 的 docstring
記了前兩版各錯在哪、各差幾個像素）。所以 winding number 要比的對象是這條射線規則，不是
帶號距離，而射線規則答的是「站在前面的人看不看得到這塊皮膚」，未必是 winding number
答的那個問題。**要先量再決定。**

**已知的第一個擋路點也不是遮蔽。** `vroid-studio-dressup` 現在被 partition 擋在
`Body_Skin` 名稱衝突上：`Body (merged)`、`InnerTop`、`InnerBottom` 三個 mesh 的材質
文法都推出同一個名字（前兩者的材質名連字串都一樣，只有 material index 不同），而
manifest 一個部件只能屬於一個 mesh。手寫的
`public/avatar/vroid-studio-dressup.parts.json` 早就示範了答案的形狀：`Body_Skin`、
`Body_Skin_Inner_Top`、`Body_Skin_Inner_Bottom`，而 `pierce.skin_parts` 與
`cover.cloth_parts` 已經照前綴收。要決定的是命名衝突時怎麼取名（mesh 名會把 2b 剛
拿掉的東西放回來），以及 `'Body_Skin'` 這個字面量寫死在 9 個模組共 11 處，其中只有
`pierce.py` 是前綴式的，其餘每一處都只會看到三層皮膚的第一層。

### 3. 服裝對位與權重

`cloth-fit` ＋ weight inpainting。我們要寫的新程式碼只有：

- `humanoid` map → 骨架邊網格 `.obj`（已驗證可導出，見上）
- avatar 與 garment 的 `.obj` 匯出與結果匯回

**不自己寫骨架相對編碼。** 那是 LoBoFit 的 `P_b(g) = (1/ℓ_b)·(⟨g−b_o, b_x⟩, …)`，而
自己寫的版本只到論文的初始化那一步，論文原話是解碼完「does not yet conform to the
target body shape」。而且單一主導骨正是 LoBoFit 點名 IFGR 的失敗原因。

## 驗收

每一階段各自可驗，不等到最後。

- **階段 0（已達成）**：13 具 VRoid 身體走完第 1 步並產出 `parts.json`；Mika 自己的
  `baseline.vrm` 產出與改動前逐位元組相同（VRM sha256 `1d4e3a37d33d91d0…`、6739132
  bytes、`parts.json` sha256 `79aa95bd5956f2ff…`）；類別 token 缺席時**拒絕**而不是猜。
  mutation 見 [mutations-partition-0912.md](../../scripts/avatar/evidence/mutations-partition-0912.md)。
- **階段 1（已達成）**：16 具身體跑 `strip()`，殘留全部 < 1%（最大 0.43%），殘留物
  全部小於 `MIN_REGION`＝1500（最大 940 px）。收據
  [skin-0912-residue.log](../../scripts/avatar/evidence/skin-0912-residue.log)。
  不變式測試：pull-push 是存活像素的加權平均，輸出不得離開輸入的值域。mutation 見
  [mutations-skin-0912.md](../../scripts/avatar/evidence/mutations-skin-0912.md)，
  每一條宣告**哪幾條測試該紅**而不只是「有東西紅了」；S3 證明夾具必須是陌生身體，
  同一個 mutation 換成 mika-pink 就不會紅。
- **階段 2a（已達成）**：六具身體走完 make.py 的第 1 到第 3 步（階段 2b 之後是七具）；
  Mika 解析出來的清單與原本寫死的五個名字逐項相同。收據
  [pipeline-0912-steps.log](../../scripts/avatar/evidence/pipeline-0912-steps.log)，
  mutation 五道見
  [mutations-replaces-0912.md](../../scripts/avatar/evidence/mutations-replaces-0912.md)。
- **階段 2b（已達成）**：本機 16 具能命名的從 13 具變成 14 具；partition 不再讀任何
  mesh 名字；髮絲的四個判準全部從這具身體量出來，而 Mika 的 77 條髮絲一條都沒換手，
  `baseline.vrm` 的 `parted.vrm` 逐位元組不變。收據
  [partition-0912-bymesh.log](../../scripts/avatar/evidence/partition-0912-bymesh.log)
  與 [hair-0912-relative.log](../../scripts/avatar/evidence/hair-0912-relative.log)。
  逐位元組那一條有自己的收據
  [partition-0912-baseline.log](../../scripts/avatar/evidence/partition-0912-baseline.log)。
  mutation 二十道，全部量在出貨的 blob 上：
  [mutations-meshes-0912.md](../../scripts/avatar/evidence/mutations-meshes-0912.md)（八道）、
  [mutations-hairframe-0912.md](../../scripts/avatar/evidence/mutations-hairframe-0912.md)（八道）、
  [mutations-review-0912.md](../../scripts/avatar/evidence/mutations-review-0912.md)（四道，
  review 抓到的三條靜默錯誤路徑加上拒絕理由的拆分）。
- **階段 2c**：約定機位算圖，斷言「原本是皮膚的像素」零洩漏。三個問題各自 mutation
  會紅。第一個已知的擋路點不是遮蔽而是 manifest 的形狀：`vroid-studio-dressup` 有三個
  mesh 都帶皮膚，而一個部件目前只能屬於一個 mesh。
- **階段 3**：Mika 自己跑一遍與階段 1 之後的產出相同（回歸關；階段 1 已經動過她的
  皮膚貼圖，所以基準是那一版而不是 `9b09611`）；換一具身體後每個部件對身體的最近
  距離不得為負；**主導骨指派在 source 上算一次就固定，斷言同一件服裝解碼到各家族時
  每個頂點的指派逐位元相同**；邊長拉伸比 `len_target / len_source` 的全域最大值有
  上界，門檻由兩副骨架的骨長比推出而不是拍腦袋。

夾具要挑比例差最大的兩個家族，並且一定要含一件跨雙腿的裙子。

## 已知的待辦，範圍外

**出貨檔還沒重建。** 階段 1 改了 `strip()` 對 Mika 底模的輸出（13.9% 的 texel，平均
1.22/255），所以 `public/avatar/mika-milfy-12.vrm` 現在與管線的產出不一致。重建要跑
Blender、要換版本檔名、要走瀏覽器驗證，那是出貨動作不是泛化動作，留給使用者決定何時
做。差異的量級見階段 1。

## 不做

- **不做通用部件分類器。** 研究結論是它在 2026-09 的公開技術水準下不存在，連 benchmark
  都沒有。VRoid 家族走後綴 token（精確），其餘走遮蔽。
- **不補洞、不換身體。** 補洞在「沒有軀幹幾何」的情況結構性無效；換身體會把角色的
  identity 丟掉，而那正是替它換衣服的理由。
- **不引進 Blender 當核心。** `make.py` 步驟 0 已經用它做手工部件，那條路留著。
  Shrinkwrap 與 Surface Deform 對靜態網格工作，而結果必須帶著 skin weights 與 morph
  targets，那正是往返 Blender 會丟掉的東西。
- **不追求「任何身體都好看」。** 新衣服蓋不到的地方，舊衣服會留著（Alicia 的水手領、
  袖口、裙襬外的腿）。這是遮蔽方案的天花板，用可接受的身體清單管理，不用程式解。

## 風險

- **主導骨指派的不連續性**（階段 3 的主要失敗模式）。四個獨立佐證：LoBoFit §6.2 的
  手臂／腹部、§5.2 的雙腿胯下、補充材料的短肢 avatar、Elastic Clothing Fit 為同樣的
  凹陷區做了 Hull Fit。它在平均誤差上看不出來，破壞無上界，而且修它要改資料模型不是
  調參數。驗收已經為它寫了專屬的兩條斷言與一個 mutation。
- **bone frame 的 roll 未定義**（見上方規格事實）。守衛：拿一個家族把某根骨的節點
  local rotation 繞自身軸轉 90°（不動 mesh 外觀、不動全域骨方向），解碼結果必須完全
  不變。
- **`cloth-fit` 的前提**：服裝 mesh 必須 manifold 且無自交，來源與目標最好同 pose。
  我們的服裝是手工建的，manifold 性尚未驗證。
- **VRM humanoid 骨表沒有 rib 也沒有 crotch**，而胯下與肋側正是失敗率最高的兩區。
  LoBoFit 的做法是額外加四根輔助骨補完階層；我們要嘛從既有骨推導虛擬 frame，要嘛接受
  那兩區沒有合理的 local frame。
- **本機樣本有偏**：17 具裡 16 具是 VRoid 血統，非 VRoid 只有 Alicia 與 Seed-san，
  n=2。「市面上多少比例可以用遮蔽解決」這個問題本機量不出來。

## 尚未驗證

- CLO3D SDK 是否真能 headless、Wretch AutoFit 與 RLX Auto Fit 的授權與價格。
- LoBoFit 沒有公開程式碼（arXiv 與 ACM 都沒有 repo 連結，論文授權 CC BY-NC-ND 4.0），
  只能當設計文件讀。
- `cloth-fit` 我們尚未實跑過，上述效能與平台數字來自它的 CI 與論文。
