# Mika R3 內建換裝修復與動作候選驗證

日期：2026-09-09。狀態：R3 限定的原生換裝修復與重驗試驗完成；頸部缺口及舊 T-shirt 白色尖角的局部修復 `PASS`。完整交付品質、spring 與 consumer 驗收仍為 `PENDING`。R2 失敗樣本與 R3 partial 中間檔完整保留。

**2026-09-09 後續更新**：本輪唯一的 `FAIL`（hoodie bent-arm 46.478 mm）已找到根因並修復，機制、四種失敗修法的數字與收據見 [refit-0909](../../scripts/avatar/evidence/refit-0909.md)。修正已套回原檔名並重跑完整驗收，結果在本文末節。以下正文保留 R3 當輪的量測，其中每一個 46.478 mm 與舊 SHA-256 描述的是修正前的位元組，現在保存在 `R3-B-clean-base-dressup-torn.vrm`。

## 本輪最終結果

採用 Studio 原生空白服裝 preset 建立乾淨 base，再重新套用既有 XWear、執行內建 mesh restore，已保存並重新開啟 `R3-B-clean-base-dressup.xroid`，另匯出 VRM1。Root 獨立檢視匯出檔的 face-neutral／blink／aa／quarter／back，確認頸部連續、白色尖角消失。這是上述兩項局部缺陷的修復驗收；完整動態衣物與 spring 未驗收。

| 最終產物 | bytes | SHA-256 |
|---|---:|---|
| `R3-B-clean-base-dressup.vrm`（現行，已套入 refit） | 14,728,128 | `6135e4295d169e5130e52cf3d3c1180c4228d7c6f819ecb68114620e5c64971c` |
| `R3-B-clean-base-dressup-torn.vrm`（本文正文量測的那一份） | 14,686,304 | `c062e296a0875cb977f66c1b48406795c630027ec45d6d9241fa1731a1d56b07` |
| `R3-B-clean-base-dressup.xroid` | 11,712,569 | `ff33c2e0667a564dedf6e0813a41837d840835d3f76de9760793714bb9b8d127` |

`.xroid` 是 Studio 工程檔，refit 只改匯出的 VRM，所以從這份 source 重新匯出會再次得到修正前的權重。重新匯出後跑 `python3 scripts/avatar/dressup.py <匯出檔> <修好的檔> <parts.json>`：它用 `verify.torn_bindings` 當場量出要修哪些 primitive、用 manifest 的皮膚當身體 pool，寫完再量一次，還撕就 raise。在本輪這個撕裂檔上它自己選中 `Tops.baked[0]`，出來的權重與手動那一次差最多 0.0077（收據 [dressup-r3.log](../../scripts/avatar/evidence/dressup-r3.log)）。

`evidence/clean-browser/results.json`：4 views、21 PNG、18 expressions，全部載入／driving／繪製成功；各 screenshot 有 hash。`clean-motion/`：10 clips 掃描完成、13 組數值候選 placement，`approvedAllowlist=[]`。`clean-structure/structure.json`：VRM1、53 bones、57 face targets、31,009 triangles、16 spring groups、22 collider groups、17 materials、134 nodes；6 checks PASS、torn_bindings FAIL、5 checks NOT_SUPPORTED。Hoodie `Tops.baked` 的 bent-arm edge growth 仍為 46.47845 mm，高於 25 mm，沒有放寬門檻。

最終 Body 已不含原 T-shirt 的 `Tops_CLOTH`。移除舊服裝也改變結構：restored 中間檔為 26 spring groups、34 collider groups、164 nodes，最終為 16／22／134；未宣稱完整骨架或物理設定不變。Source reopen 證據為 `evidence/50-final-reopened.png`，GUI 操作已停止。

## 執行範圍

既有 Mika 素材與平台使用授權維持 **已驗證（使用者確認先前已完成驗證）**，不再索取授權或 source 補件。不呼叫付費 API、不上傳模型、不修改 production 幾何／framing／IK。使用者已要求開始下一階段；原生 Studio 與 headless browser 分工操作，GUI 由單一代理獨佔。

採用 VRoid Studio 內建 mesh restore，官方文件提供 tracing brush、Confirm 及 reset 操作；XRoid 保存可回復的網格刪除狀態。[Dress-up 官方流程](https://vroid.pixiv.help/hc/en-us/articles/38722733769241-Getting-Started-with-the-Dress-up-Feature-for-those-who-want-to-dress-up-their-characters)、[XRoid](https://vroid.pixiv.help/hc/en-us/articles/38729963613849-What-is-XRoid)。本輪操作結果與官方功能說明分開記錄。

## 中間產物與獨立驗收歷史

隔離目錄：`build/mika-reuse/r3-studio-20260909/`。

| 項目 | 狀態 | 證據／限制 |
|---|---|---|
| R2 原始失敗 VRM 重新載入 | 已驗證 | root 獨立 browser 確認 VRM1、53 bones、18 expressions；正式基線重拍 `evidence/before-browser/`，4 views、21 PNG，正面近照 `face-neutral.png` |
| Studio mesh restore、另存 source／VRM | `PARTIAL` | `R3-B-restored.xroid`／VRM 已另存、source 重新開啟；頸部缺口消失，領口下緣仍見白色內衣尖角。此歷史候選保留，後續最終結果見上節 |
| 匯出 VRM 的前／側／背面、表情 | 已執行，品質 `PARTIAL` | `evidence/restored-browser/results.json`：4 views、21 PNG、18 expressions。root 直接檢視 face-neutral、face-aa、quarter、back，確認頸部連續及白色尖角；其他表情截圖不宣稱全數人工美術驗收 |
| 新 VRM 數值 motion 掃描 | 已執行，完整品質 `UNKNOWN` | `restored-motion/`：10 clips、13 組 numeric candidate placements；`approvedAllowlist=[]`，未知 crown clearance 不放行 |
| 完整既有 `verify.py` 對 VRM1 | `NOT_SUPPORTED`／tool error | 實跑於 `loud_outlines()` 存取 `extensions['VRM']` 時 `KeyError: 'VRM'`，不能將此中斷當成模型品質 FAIL；可重用項目另行檢查 |
| Restored VRM 的 partial structure check | 已執行，`FAIL` | 6 checks PASS、torn_bindings FAIL、5 checks NOT_SUPPORTED，exit 1。hoodie `Tops.baked` 的左上臂 +60 度／右上臂 -60 度 edge growth 約 46.47845 mm，大於 25 mm |
| 原生乾淨 base | 已另存，完整站台 gate `FAIL` | `R3-clean-base.vroid`／VRM0：原生上衣與下身空白 preset 移除 T-shirt／短褲，保留預設 bandeau；7 項核心結構檢查含 bent-arm binding 通過，outline／rim 仍不符站台規則。後續 XWear 重組見上節 |
| 完整動態衣物／spring／目標 consumer | `NOT_RUN` | 靜態渲染與數值 pre-screen 無法代替完整時序品質 |

Restored VRM 為 14,952,188 bytes，SHA-256 `104bd14e4721b7127721ae2054e6153de23b4a9b134a4659b114c6c96d10ad3c`。Browser 為 VRM1、53 bones、18 expressions；既有 stats 讀得 30,915 triangles、26 spring groups、34 collider groups、57 face targets。此身分僅適用 restored 候選，clean 若匯出必須重新 hash／驗證。

Root 獨立核對 R2 dress-up 與 R3 restored 的 Face mesh：遍歷各 primitive、排序後的 attributes 及 57 組 morph target accessors，合併 array bytes 的 SHA-256 均為 `d06189665a0fd5dbab88ee4bf738f0cfa2c2ba30583a6a5423967250dfe9162d`。這證明此次 restore 沒有改變所量測的 face geometry／morph bytes；不把此結果套用到 clean-base 新 lineage。初次 `independent-before-face.png` 的 viewport 曾被文字結果佔滿，正式視覺對照使用後續直接 canvas capture 的 `evidence/before-browser/face-neutral.png`。

內建 restore 後的白色尖角經 Studio 顯示／隱藏對照，定位於 CONTROL 合併的 Body 舊 T-shirt。精準 erase 嘗試未取得合格成品，接著使用原生 authoring 的上衣／下身空白 preset，另存乾淨換裝 base，保留預設基本遮蔽，未使用 texture painting。`R3-clean-base.vrm` 為 11,723,984 bytes，SHA-256 `b6cc78456dd907eda1e6a29adc32c9145a3f94ed752736b44f9674a650e9dff7`，VRM0、54 bones、19,152 triangles。`clean-base-structure/structure.json` 顯示 7 項核心檢查 PASS；outline／rim FAIL，其餘 3 項 VRM0 專屬檢查 PASS。Body primitives 已不含 `Tops_CLOTH`，舊 restored 留有該 T-shirt 的 12 triangles。乾淨 base 再套 XWear 的自動遮蔽仍切到頸部，最終再次使用內建 restore 才取得上節局部通過結果，不能宣稱 auto-mask 已全自動合格。

## 重用的量測與 fail-closed 候選

`measure-candidate.ts` 直接呼叫既有 `scripts/measure-motions.ts` 的 `measure(target, null)`，不套用預設 `vroid-sample-b` clearance／waiver。CLI 接受模型與全新輸出目錄，測量前後核對完整 SHA-256；保留 `motion-report.json` 與 `motion-candidates.json`。輸出目錄已存在會失敗，避免覆寫證據。

`motion-candidates.ts` 從既有 `avatarMode`／`avatarMotions` 讀取構圖與門檻，逐一檢查 18 組 motion／placement 的 reach、skinTop、hipsLow、faceRatio、endSink、hipsDrift、endWrist。因 producer 將數值四捨五入至四位小數，門檻附近 0.0001 內標 `UNKNOWN`；缺值與非有限數字亦不放行。數值通過僅進 `numericCandidates`。缺少模型專屬 crown clearance 與完整動態驗收時，`approvedAllowlist` 永遠為空集合。

R2 歷史輸入已唯讀核對：四份原生模型皆 10 clips、各 18 項 missing crown。額外數值超標數為 CONTROL／A／B／C 各 5／5／6／5。共通數值候選為 peaceSign、modelPose、spin、squat（column）、akimbo、playFingers；scratchHead 的 waist-up 數值通過，column 超頂；stretch 僅 CONTROL／A／C waist-up 通過，B 超頂 22.6 mm。idleLoop／dance 的 endpoint 或 face 指標不合門檻。此歷史結果不能移植到新匯出的 R3 模型，必須重跑。

Restored 新檔已重跑：scratchHead column 的 skinTop 超頂約 36.77 mm；idleLoop 的 hipsDrift 為 157.3 mm，高於 100 mm；dance 的 faceRatio 0.4058、hipsDrift 144.9 mm、endWrist 1.2358 m 超出各自門檻。13 組其餘 placement 是數值候選，18 組全部 crownStatus 仍為 `UNKNOWN`。

`structure-check.py` 以薄 wrapper 重用 required bones、winding、unused materials、sparse bounds、ragged morph counts、bent-arm binding、dangling joints。對 VRM1 明列五項 `NOT_SUPPORTED`：outline、rim、materialProperties 對位、VRM0 expression-based torn shapes、VRM0 stranded collider groups。後三個舊函式在缺少 VRM0 extension 時會回空集合，本輪不將它們當 PASS。保持原 25 mm bent-arm growth 門檻，沒有變更 production reader 或 assertion。

## 本輪工具與測試收據

- root 重新執行 `python3 -m unittest discover -s scripts/avatar -p '*_test.py'`：359 tests，10.068 秒，`OK`，exit 0；有既存 ResourceWarnings，未修改 production Python／TypeScript。
- `tsx --test build/mika-reuse/r3-studio-20260909/motion-candidates.test.ts`：10 tests，10 pass，0 fail。涵蓋 missing clip、NaN、臨界四捨五入、drift／face fail、未知不放行與固定 18 組 motion／placement。
- root 獨立重跑同一組 motion helper tests：10 pass，0 fail，132.645 ms。
- `python3 build/mika-reuse/r3-studio-20260909/structure-check_test.py`：4 tests，4 pass；外部檢查函式以 Mock 替代，驗證空 finding、非空 finding、exception 狀態及錯誤原因保留。
- R2-B runner integration：10 clips、12 numeric candidate placements、空 approved allowlist，source hash `d0d97d6c7ca453c5e937cf8668dd7a77028fc085f90914701c02205a443bdd78`，exit 0。Restored runner 另由 root 實跑取得上方結果。
- R2 dress-up VRM1 的 structure wrapper integration：6 checks PASS、torn_bindings FAIL、5 checks NOT_SUPPORTED，exit 1。這是 helper 重用驗證，R3 新檔仍須獨立執行。
- root 已獨立執行 restored 的 structure wrapper，結果見上表；另重跑 4 個 mocked tests 全過。
- measure runner 以已存在的 preflight 輸出目錄重跑，取得 `EEXIST`、exit 1，確認拒絕覆寫。capture CLI 缺少參數亦 exit 1，未啟動 browser 操作。
- `node --check build/mika-reuse/r3-studio-20260909/capture-candidate.mjs`：exit 0；root 已實跑 restored capture，4 views、21 PNG，保存結果與 screenshot hashes。
- 原 R2 11 個 artifact hashes 經 root 逐一核對保持一致。原 Mika VRM SHA-256 保持 `f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6`，sidecar 保持 `24246ee7f22a13965baf8f7da56cadaceb06ef01b1345f1f01a31a33a660acba`。
- `verification-snapshot.test.mjs`：7 tests 全過；其中 inventory 二次掃描的 schema 混淆先以 6 pass／1 fail 重現，再改用 `evidenceScreenshots` 修正為 7 pass。Root 獨立重跑 7 tests 全過，44.762583 ms。
- 最終 integrity snapshot `verification-final/verification-receipt.json`：`PASS`，8 個 `.vrm`／`.vroid`／`.xroid`、117 張 evidence PNG、13 份 JSON、13 個 source model references、63 個 screenshot references 的 bytes／full SHA-256 核對完成；inventory 在同目錄 `artifacts.json`。再執行 `verification-repeat/` 也 `PASS`，讀到 15 份 JSON，證明自產 inventory 二次掃描整合成功。這些 PASS 僅代表檔案完整性，不是產品品質全過。
- 收尾再次核對 R2 的 11 個 artifact hashes 與原 Mika／sidecar，均保持不變。兩份最新 helper code reviews 為 `PASS`；獨立審查涵蓋 21 個 helper tests 與四個 CLI 拒絕已存在輸出目錄的行為。

收尾狀態：最終 Studio source 已保存並重新開啟，GUI automation 停止；headless `mika-r3` 已關閉。Root 核對自行啟動的 Vite port 5189 process 後終止，觀察到 exit 143；沒有背景製作或測試繼續執行。未刪除中間失敗樣本、沒有 commit／push／付費 API／外部上傳。

本輪沿用 do 的階段拆分，以及 agent-browser 的獨立本機渲染驗證。新增內容限於 ignored build 的薄 helper、證據及 R3 計畫／報告；未實作新的幾何、綁定或動作調參演算法。

## 驗證命令

從 repository root 執行，各 output-directory 都必須是全新目錄：

```sh
./node_modules/.bin/tsx build/mika-reuse/r3-studio-20260909/measure-candidate.ts <candidate.vrm> <fresh-motion-output-directory>
node build/mika-reuse/r3-studio-20260909/capture-candidate.mjs <candidate.vrm> <fresh-render-output-directory>
# VRM0 only: existing full project gate
python3 scripts/avatar/verify.py <candidate-vrm0.vrm>
# VRM1: explicit partial checks, unsupported gates retained
python3 build/mika-reuse/r3-studio-20260909/structure-check.py <candidate.vrm> <fresh-structure-output-directory>
```

capture helper 使用既有 `mika-r3` browser session 與 `127.0.0.1:5189` 本機 server，靜態 spring reset 後等待 120 frames，擷取 face 全表情及 front／quarter／back。`verify.py` 保留原 Mika 站台規則；VRM1 目前有上述不支援例外，改用 partial wrapper 明列支援範圍，不能自行放寬或宣稱完整通過。

## 模組化平台採用決策

目前證據支持先驗收固定 `base × module` 組合，保存可逆 source／mesh mask、來源 hash 及版本，平台先提供已驗收組合。一次性的模組整備人工與每單客製工時分開記錄，才能估算模組收費、點數或訂閱的可持續成本。本輪單例 restore／partial 結果尚未支持任意設計全自動交付，不據此編定價格或毛利；平台 code、付款與定價不在本輪實作範圍。


## 套回原檔後的完整驗收（2026-09-09 後續）

`refit.apply` 套回 `R3-B-clean-base-dressup.vrm`，修正前的位元組保存為 `R3-B-clean-base-dressup-torn.vrm`（hash 不變）。R3 當初那一整套重跑，輸出在同一個 run 目錄的 `final-*`：

| 關卡 | 修正前 | 現行 |
|---|---|---|
| `structure-check` | 6 PASS、torn_bindings FAIL、5 NOT_SUPPORTED，exit 1 | 7 PASS、0 FAIL、5 NOT_SUPPORTED，exit 0 |
| `verify.torn_bindings` | FAIL 2 筆，最壞邊 46.48 mm | `[]` PASS，最壞邊 22.99 mm |
| `measure-candidate` | 10 clips、13 組 numeric candidate、allowlist 空 | 相同 |
| `capture-candidate` | 4 views、21 PNG、18 expressions | 相同，證據在 `evidence/final-browser/` |
| `verification-snapshot` | PASS（8 產物、117 PNG） | PASS（9 產物、138 PNG、21 JSON、17 model reference） |

`approvedAllowlist` 在寫這一段時仍為空集合，缺的是模型專屬 crown clearance，與本次權重修正無關（三個 clearance 模組後來都補上了，family 也登記並服務了；`approvedAllowlist` 為什麼還是空的見末節）。人工檢視 `final-browser` 的 face-neutral 與 quarter-neutral，確認本輪原本修好的頸部連續與領口無白色尖角在 refit 後仍成立。

覆寫原檔會讓 run 目錄自相矛盾：`clean-structure`、`clean-motion`、`evidence/clean-browser` 都記著舊 hash。先跑快照確認它抓得到（`Hash mismatch`、exit 1），再把這四份結果檔的 `source.path` 指向 `-torn.vrm`，`sha256` 與 `bytes` 未動；之後快照才 PASS。保留樣本重跑仍是 FAIL 2 筆、46.48 mm。

## 手寫 parts.json 與剛體頭頂

這份第三方匯出檔沒有 `parts.json`，`springsim.ts` 的推導在它身上找到 0 個會動的髮部件並停在 `manifest has no Hair_* part`。量下去的結果是這個檔宣告了 16 組彈簧而沒有一組動得了頭頂：展開後 29 個彈簧節點裡只有 6 個出現在任何 skin 的 joints 清單，全是胸部（攤成 4 個相異骨名），帶彈簧權重的 primitive 只有 `InnerTop.baked[0]` 與 `InnerBottom.baked[0]`，9 條 `transferable_HairJoint-*` 與帽兜、兩條帽繩的鏈都搬不動任何頂點。頭髮 `N00_000_00_HairBack_00_HAIR` 的權重是 `J_Bip_C_Head` 715.5、`J_Bip_C_Neck` 28.8，是由 humanoid 擺出來的剛體。

因此 `springsim.ts` 的 `hairJoints` 空集合關卡放寬了。頭頂是所有列出部件的最高頂點，而 solver 不論 manifest 怎麼命名都會把每條彈簧跑完，所以剛體頭頂本來就量得出來：拿出貨的 milfy 把 `Hair_*` 指向臉，`spin` 與 `dance` 的頭頂與兩個機位投影一位不差（1.5886／1.6107／1.5958 與 1.6647／1.7087／1.7000），只有 `jump` 從 12.4° 與 21.7° 掉成 0。空清單真正決定的是 `jump` 兩欄與 `--hit`／`--gravity`／`--no-arms`／`--no-coat`／`--colliders` 五個旗標，所以現在改成照跑並標 `rigidHair`，只有帶了那五個旗標之一才拒絕。機制、鏈長表與五次 mutation 收據見 [parts-0909](../../scripts/avatar/evidence/parts-0909.md)。

手寫的 `R3-B-clean-base-dressup.parts.json` 列滿 17 個帶皮 primitive，腰線 1.0187 讀自未被 auto-mask 挖過的 `InnerTop.baked[0]`。十支 clip 全部跑出頭頂，靜止 1.5982，最高的是 `stretch` 的 1.8661（舉起來的手），產物是 `vroid-studio-dressup.simulated.gen.ts` 與 `springsim-0909.log`。

clearance 的三個模組都有了。`measure-motions.ts --write` 的 `measured` 也產出了（`vroid-studio-dressup.measured.gen.ts`、`measure-0909.log`），兩份的 `rigSha` 同為 `ec3b9ab3…`、`restCrownY` 同為 1.5982，而這兩個數字來自兩條獨立路徑（蒙皮後的最高頂點對 `rigProbe.deriveRestCrown`）。手寫的決策模組同日補上：`pans` 推導了五趟才不再動（十支 clip 裡八支要 pan），waiver 四項落在 dance 與 idleLoop 上。family 已登記並服務，`offered: false`，look strip 不會把它拿給訪客；`rigProbe.test.ts` 的 per-family 區塊在這具 rig 上 71 條全過（整檔三個 family 合計 269 條全過）。原本擋著的兩件事都解掉了。其一，匯出檔的 VRM meta 是 `allowRedistribution: false`／`modification: prohibited`／`avatarPermission: onlyAuthor`，而 `public/avatar` 會被服務且這個 repo 是公開的；匯出檔作者放寬那三項之後才服務，改了哪三個欄位與來源檔 hash 記在 `parts.json` 的 `derived_from`。其二，`dance` 在 column 上原本沒有不動點，`least` 落在 120 mm 邊界一毫米內，0.12 與 0.13 互指；`crownFringe` 原本沿用 VRoid family 的 1.5 mm，同日在瀏覽器上量到這具身體自己的值 0.5 mm，少的那 1.0 mm 正是來回差的量，pass 5 在 0.12 下推導出 0.12、`least` 119.6 mm。收據 [family3-0909-pans.log](../../scripts/avatar/evidence/family3-0909-pans.log)、[armrest-0909.md](../../scripts/avatar/evidence/armrest-0909.md)。服務這具 VRM 1.0 身體同時揭穿一個 production bug：engine 的休息姿勢把 0.x 的旋轉方向寫死，1.0 身體套上去雙臂朝天；`armRestPins` 現在依版本給號，三道防禦各自 mutation 紅。`approvedAllowlist` 仍是空集合，但缺的不再是 clearance：`motion-candidates.ts` 把 `approvedAllowlist` 寫死成空陣列、`crownStatus` 寫死成 `UNKNOWN`，它從來沒讀過 clearance 檔；真正還沒過的是它列的第二個理由，連帽衫的動態穿模。這具身體的 rig sha 與出貨的 `e2aad79e…` 不同（沒有 `upperChest`、拇指用 1.0 命名、hips 高 29.8 mm），現成的 clearance 檔套不上去。

`motion.check` 的像素穿模 gate 跑了，這是它第一次跑在這具身體上。原本擋住的是 `pierce.py` 寫死的 `SKIN = ('Body_Skin', 'Face')`：這具身體的皮膚分在三個 mesh 上（`Body (merged)` 的身體層加上 `InnerTop`／`InnerBottom` 兩層），後兩者會被當成布。改成由 manifest 決定皮膚名字之後，靜止與動態都是 FAIL，而兩個 FAIL 是不同的東西。`Outfit_Cardigan` 靜止 108 px（上限 150）、動態最差 779 px 為上限的 5.19 倍（modelPose t=2.82s），貼圖算圖看得見：紅色帽 T 胸口有一塊身體層穿出來的深色洞，779 個像素裡 750 個來自 POSITION 位元組相同的 `InnerTop`／`InnerBottom`。`Acc_Glasses` 靜止 48 px（上限 30）是誤報，鏡腳繞到耳後、耳朵皮膚在它前方 8.6–11.0 mm，gate 的三個條件全部通過。`Outfit_Jeans`、`Outfit_Shoes`、`Outfit_Shoes_Sole` 乾淨（最差 0.37 倍）。收據 [pierce-0909.log](../../scripts/avatar/evidence/pierce-0909.log)、[cardigan](../../scripts/avatar/evidence/pierce-0909-cardigan.png)、[glasses](../../scripts/avatar/evidence/pierce-0909-glasses.png)。外套的穿模是這具身體本身的缺陷，尚未修。完整動態衣物、spring 與目標 consumer 驗收維持 `PENDING`。
