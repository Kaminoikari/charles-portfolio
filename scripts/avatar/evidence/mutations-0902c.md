# 第五版守衛的紅燈驗證（2026-09-02 下午）

原則同前兩輪：每道防禦單獨拔掉，對應那條測試必須自己轉紅；還原用位元組副
本（未 commit 前禁 `git checkout --`）；替換腳本在 pattern 命中數 ≠ 1 時
assert 失敗，杜絕靜默失配。

## outfit.standoff 三道防禦（源碼級 mutation）

替換器：python 腳本，`src.count(old) == 1` 先 assert 再替換，測試單條跑，
還原自位元組副本 outfit.py.bak。

| mutation | 對應測試 | 結果 |
|---|---|---|
| 翻符號拔除（`outward < 0.0` → `< -9e9`） | test_lining_moves_with_the_outer_shell | RED |
| y 歸零拔除（`horizontal[:, 1] = 0.0` → `pass`） | test_push_is_horizontal_everywhere | RED |
| 袖管羽化拔除（fade → `np.ones`） | test_shoulder_top_and_sleeves_stay_put | RED |

還原後 outfit_test 8/8 GREEN。

（註：這輪的 mutation 打在 build-c 的硬符號版上；build-d 起符號改為
cos/0.3 平滑過渡（健檢抓到 Breasts_Cow shape key 撕裂），三條測試的取樣
頂點 cos 值都在飽和區，語意不變，改動後 8/8 仍綠。）

## 外觀守衛四條（模型級 mutation：v3 舊檔當紅燈基準）

v3 = out/milfy.v3.vrm（舊金色、舊膚色、皇冠舊位、無後腦帽），配對 manifest
用 out/milfy.rerun.parts.json（27 parts、primitive 數與 v3 逐 mesh 吻合、無
Hair_Nape）。換進 public/avatar/ 路徑後跑對應測試，換回最終檔後全綠。

第一組（金與膚，v3 + 現行 manifest；兩測試不讀 manifest）：
- test_skin_texture_keeps_visible_tone_under_mtoon_lighting：RED
  （v3 膚 median 222 低於新下限 SKIN_MIN_CHANNEL 238）
- test_crown_gold_stays_warm：RED
  （v3 金 factor 紅藍差 0.238 < 0.5，AssertionError 全文在 session log）

第二組（位置，v3 + rerun manifest）：
- test_back_skull_is_covered_by_hair：RED（v3 枕骨帶髮面 z 低於頭骨）
- test_crown_rides_the_bangs_not_the_ear：RED（v3 重疊 84% > 60%、
  質心 z -0.032 > -0.045）

還原後 appearance_test 8/8 GREEN；五模組合跑 24/24 GREEN。

## spring no-op 強化

test_nothing_changes_when_every_group_is_used 補 `assertIs` 釘 early-return
路徑（list 物件必須原樣留下，等值重建不算）。此為斷言強化，非新防禦，無
獨立 mutation；prune 三道防禦的紅燈紀錄在 mutations-0902b.md。
