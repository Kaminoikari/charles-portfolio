# 第六版守衛的紅燈驗證（2026-09-02 深夜，雙 reviewer FAIL 之後重取）

這一份取代 mutations-0902c.md 裡兩格失效的收據，並補上新守衛。失效的原因分
別記在下面，不是重跑一次就算數。

原則同前：每道防禦單獨拔掉，對應那條測試必須自己轉紅；還原用位元組副本；替
換腳本在 pattern 命中數 ≠ 1 時 assert 失敗。

## outfit.standoff 三道防禦（源碼級 mutation，fixture 修正後重取）

**為什麼要重取。** 0902c 的「y 歸零拔除 → RED」是打在 build-c 的硬符號版上
的。build-d 把符號改成 cos/0.3 平滑過渡之後，fixture 裡唯一帶 y 分量的頂點
（法線純 +y）水平分量為零、cos 為 0，推力係數剛好落在斜坡的歸零點，該頂點在
有無 y 歸零兩種版本下位移都是 0——那條測試變成空的，拿掉 `horizontal[:, 1]
= 0.0` 整行三條測試照樣全綠。0902c 的註記說「取樣頂點 cos 值都在飽和區」，對
這個頂點不成立，是錯的。round-4 code reviewer 抓到。

修法：fixture 補一個混合法線的領口頂點（index 7，位置 [0.10, 1.22, -0.090]、
法線 [0.0, 0.8, -0.6]），它的水平分量不為零、cos 在飽和區，y 歸零因此成為它
位移的唯一決定因素。同一條測試另加一句 `assertGreater(|Δz|, 1e-4)`，釘住
「它真的有被推」——否則下一次改動又可能讓它悄悄回到零位移。

| mutation | 對應測試 | 結果 |
|---|---|---|
| y 歸零拔除（`horizontal[:, 1] = 0.0` → `pass`） | test_push_is_horizontal_everywhere | RED |
| 翻符號拔除（`sign = np.clip(cosine/0.3, -1, 1)` → `np.ones`） | test_lining_moves_with_the_outer_shell | RED |
| 袖管羽化拔除（fade → `np.ones`） | test_shoulder_top_and_sleeves_stay_put | RED |

還原後 outfit_test 8/8 GREEN。

## 掃髮帽色（模型級 mutation：把 UV 映射還原成原生 uv_ball 域重建）

**為什麼標準差那一條是必要的。** 第一版守衛只釘取樣均色（期望 ±20）。把
`cap_uv` 的兩行映射換成 `pass`（等於回到原生 uv_ball 域）重建之後：

- 取樣均值 (222.2, 211.8, 199.0)，落在 (210,200,189)±20 窗內 → 只看均值**照
  樣綠**
- 取樣標準差 35.0 對平色格的 3.0 → 加上 `spread <= 12.0` 之後 **RED**

而畫面上的病灶（背面那片對稱格紋）正是標準差那一項。均值守衛驗過會綠，等於
沒守到。收據：

| mutation | 對應測試 | 結果 |
|---|---|---|
| cap UV 映射拔除（兩行 → `pass`，重建） | test_nape_cap_matches_the_curtains | RED |

還原並重建後 appearance_test 9/9 GREEN。

## 皇冠暖度（雙邊門檻）

守衛從單邊 `spread >= 0.5` 改成雙邊 `0.30 <= spread <= 0.45`，因為這一輪證明
了兩種對立的退化都會發生：

- 太淡（numpy 空間解色，被 ACES 洗白）：factor 紅藍差 0.24 → 低於下限，RED
- 太橘（線性值誤當 sRGB factor，二次 gamma）：紅藍差 0.64 → 高於上限，RED
- 正解（過 linear→sRGB）：Gold 0.371、GoldInner 0.376，兩者都在窗內

上述三組數字由出貨檔與前兩版出貨檔直接讀出，非推算。迴圈涵蓋 Milfy_Gold 與
Milfy_GoldInner 兩個材質（共用 Milfy_Gold_ramp 貼圖），門檻咬在較低的那個上。

## 未變動的收據

膚色上下限、後腦覆蓋、皇冠讓耳三條的紅燈驗證在 mutations-0902c.md，第六版沒
有改動它們的判準或門檻，收據續用。
