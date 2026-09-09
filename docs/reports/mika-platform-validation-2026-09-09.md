# Mika 平台本機技術驗證

日期：2026-09-09。狀態：本輪技術驗證完成。產品交付資格：`PENDING`。

本輪使用既有 Mika 模型驗證六項可配置操作與四項能力缺口。十份需求是內部合成案例，保留同一臉型與髮型；無設計圖相似度、客戶接受度、付費 OCM 比較或正式商用授權驗證。

計畫依據：[Mika 模組化 3D 平台驗證計畫](../plans/mika-platform-validation.md)。原始 machine results 保持寫出時的狀態；之後進行的瀏覽器及動作檢查在本報告另附證據，不覆寫原始 `NOT_RUN`。

## 執行紀錄

| Run | 結果 | 用途 |
|---|---|---|
| `diagnostic-20260909-v1` | 4 TECHNICAL_PASS、2 FAILED、4 BLOCKED；CONTROL 通過 | 首輪找到材質與 manifest 不同步 |
| `diagnostic-20260909-v2` | 6 TECHNICAL_PASS、0 FAILED、4 BLOCKED；CONTROL 通過 | 修正後重新生成全部候選並驗證 |

[v1 原始結果](../../build/mika-validation/diagnostic-20260909-v1/results.json) 記錄 source model 與 manifest hash 在執行前後相同。CONTROL 與六個候選各有四個 CPU render view。B05、B06 生成了改色模型，但輸出 manifest 的 palette 仍保留舊色，故判定失敗。失敗行仍留在分母，四個未支援需求也未被剔除。

[v2 原始結果](../../build/mika-validation/diagnostic-20260909-v2/results.json) 的 `validation_execution` 為 `COMPLETE`，`full_brief_support` 為 `NOT_MET`，`product_readiness` 為 `PENDING`。CONTROL 與 B01 至 B06 共有七份候選及 28 張 CPU 圖像，新增 verifier 檢查與 palette 同步均通過。四項缺口仍需新模組。

## 十份固定需求

| Brief | 需求 | v1 | v2 |
|---|---|---|---|
| B01 | 移除皇冠，保留其餘內容 | TECHNICAL_PASS | TECHNICAL_PASS |
| B02 | 移除腰部緞帶，保留其餘內容 | TECHNICAL_PASS | TECHNICAL_PASS |
| B03 | 移除 cardigan，保留內搭與裙子 | TECHNICAL_PASS | TECHNICAL_PASS |
| B04 | 移除皇冠、小熊及貼布髮夾 | TECHNICAL_PASS | TECHNICAL_PASS |
| B05 | 既有薄荷色緞帶改為梅紫色 | FAILED | TECHNICAL_PASS |
| B06 | 既有 cardigan 改為藍色 | FAILED | TECHNICAL_PASS |
| B07 | 新 bob 短髮輪廓與瀏海 | BLOCKED | BLOCKED |
| B08 | 新圓臉與下垂眼 | BLOCKED | BLOCKED |
| B09 | 裙子換成完整長褲 | BLOCKED | BLOCKED |
| B10 | 可編輯 3D 房間與新 finger-heart 手勢 | BLOCKED | BLOCKED |

這組案例刻意包含六個已知操作與四個缺口探針，覆蓋比例只有描述用途。完成六個既有造型調整不能推估客戶需求覆蓋率，也沒有八成商業 go／no-go 判定。

## 本輪找到的問題與修正

`customise.tint` 原本只更新 glTF 材質，VRM0 `_Color` 仍可能保留原色。修正後同步 lit color，保留 alpha 與各 channel 的 shade／lit 比例。v1 實驗再發現，模型與 VRM0 色值已符合 recipe，manifest 的 palette 卻沒有更新。`customise.apply` 現在於寫出 sidecar 前同步 palette 的 base 與 shade。

獨立 review 另確認 verifier 的兩類漏檢。第一類是修改嘴部貼圖後，geometry 與材質 JSON 不變，檢查仍判通過。第二類是修改 inverse bind matrices，實際 skinned vertices 移動 0.1000000238m，骨架靜止位置與原始 POSITION 卻未改變，檢查同樣誤判通過。新增保留材質引用貼圖、sampler、skin joint mapping 與解碼 bind matrices 的 fingerprint，涵蓋此次 drop／tint 範圍。

這三個拒絕測試在修正前均失敗，另有一個未改動的正向 fixture 通過。修正後與當時最新 customise tests 合跑 38 項通過。後續新增或修改測試以最終驗證節記錄為準。

## 瀏覽器與動作證據

[v2 browser results](../../build/mika-validation/diagnostic-20260909-v2/evidence/browser/results.json) 記錄 CONTROL 與 B01 至 B06 共七個 VRM，皆載入 54 根 humanoid bones、15 個 expressions、10 支 clips，WebGL canvas 成功繪出且 errors 為空。主代理已檢視 v1 七張 MToon canvas；v2 重新載入七份候選，且各 VRM bytes 與七張 PNG hash 都和 v1 相同，故該次目視結果適用於 v2。此處以 canvas readback 保存畫面，Page.captureScreenshot 曾 timeout。

主代理另直接檢視 v2 的 12 張 CPU 圖像：CONTROL 四視角、B01 face、B02 three_quarter、B03 front／back、B04 face、B05 three_quarter、B06 front／back。配件移除與局部改色均可見。CPU 預設取景會裁掉左右手，故不判全身取景通過；替代 MToon viewer 的全身畫面可見完整雙手。

原 `live-preview` 頁面兩次測試出現空 canvas 與 0 clips，包含原模型及 B05。主代理開啟 debug 後讀到 VRM 已載入、頁面為 visible，但手動 requestAnimationFrame 計數經數秒仍為 0；此 headless session 的動畫 frame 未前進，互動 preview 保持未驗收。替代 browser-check viewer 使用 immediate render 成功繪製，證明本次檔案可由該 viewer 使用。尚未取得客戶的美術接受、設計圖相似度及 Warudo 等外部 consumer 證據。成功載入 clips 或 expressions 也不能單獨證明每個動作姿勢沒有瑕疵。

[v1 CONTROL spring log](../../build/mika-validation/diagnostic-20260909-v1/evidence/motion/CONTROL.spring.log) 中，`dance` 記錄 coat max 37mm、body max 50mm、skirt 18mm。這些是基準已存在的非零深度，後續只能比較變體是否增加問題，不能宣稱零穿模。量測取樣為 60Hz、pre-roll 2 秒、hair stride 2。

[動作摘要](../../build/mika-validation/diagnostic-20260909-v2/evidence/motion/motion-summary.json) 記錄七個模型各十支 motion 與十支 spring clip，共 140 次 clip evaluations、14 個 CLI 成功退出。七份皆有相同兩個臉部預算超出：`scratchHead` faceRatio 0.9710 小於 1.0；`dance` 為 0.1825，小於既有 waiver 0.1900。`spin` 基準 coat max 另有 42mm。成功退出代表量測完成，這些既有超出仍保留。

B02、B05、B06 的 spring 數值在 CLI 顯示精度下與 CONTROL 相同。B01、B04 移除皇冠後投影上緣最多降低 12.1mm；B03 的 coat 欄位為不適用，其餘 spring 數值與 CONTROL 相同，不能將缺少外套視為 coat 深度 0。這組取樣未發現新的回歸，並未證明零穿模。

[v1 至 v2 reuse proof](../../build/mika-validation/diagnostic-20260909-v2/evidence/motion/reuse-proof.json) 核對七份 VRM bytes 完全相同，manifest 排除 palette 後也相同；兩個動作工具不讀 palette。因此 v2 沿用本輪 v1 的動作與 spring 原始 logs，無重複執行 140 次。色彩 sidecar 修正另由 v2 結構檢查驗證。

## 耗時與成本

v2 各候選量測如下，秒數取小數點後三位。CONTROL 不列入需求數。

| 候選 | build 秒 | verify 秒 | 四視角 render 秒 | triangles | VRM bytes |
|---|---:|---:|---:|---:|---:|
| CONTROL | 0.042 | 0.611 | 11.529 | 102,984 | 12,010,112 |
| B01 | 0.051 | 0.770 | 12.120 | 102,784 | 11,981,964 |
| B02 | 0.043 | 0.662 | 11.371 | 102,440 | 11,969,680 |
| B03 | 0.033 | 0.580 | 7.141 | 88,914 | 11,373,428 |
| B04 | 0.028 | 0.470 | 7.469 | 102,250 | 11,952,568 |
| B05 | 0.032 | 0.482 | 7.697 | 102,984 | 12,010,184 |
| B06 | 0.039 | 0.446 | 7.528 | 102,984 | 12,010,148 |

計時只涵蓋本機從既有 Mika 派生候選的階段，執行時另有測試及驗證工作並行，並非獨佔機器的效能基準。不包含建立新 base、建模、美術修改、客服或客戶迭代。沒有採用合成 GPU 成本或從本輪耗時推估正式售價。

## 重現方式

在 `/Users/charles/portfolio` 執行以下命令。每次 runner 都必須使用全新的 `--run-id`；既有目錄會拒絕覆寫，`fresh-name` 如已使用也需換名。輸出限定在 `build/mika-validation/`，原始模型不被改寫。

```sh
python3 scripts/avatar/platform_validation.py --run-id fresh-name
PYTHONPATH=scripts/avatar python3 -m unittest discover -s scripts/avatar -p '*_test.py'
npm test
npx tsx scripts/measure-motions.ts build/mika-validation/fresh-name/B01/model.vrm --family=vroid-sample-b
npx tsx scripts/avatar/springsim.ts build/mika-validation/fresh-name/B01/model.vrm --clip=all --family=vroid-sample-b
```

對 CONTROL、B01 至 B06 分別執行最後兩項才涵蓋七份候選；B07 至 B10 沒有產生模型。新的 run 仍需單獨進行瀏覽器及人工檢視，runner 不會自動更改這些 pending 欄位。

## 最終驗證

| 項目 | 狀態 |
|---|---|
| v2 固定矩陣與 CONTROL | 六項通過、四項缺口；CONTROL 通過 |
| v2 獨立 geometry／texture／skin checks | 七份輸出通過，保留項及要求的效果符合檢查 |
| v2 四視角與 MToon browser 檢視 | 28 張 CPU 圖產出、12 張直接目視；七份 MToon 載入／繪製，原 live-preview 保持未驗收 |
| v2 十支動作及 spring 與基準比較 | 140 次量測，以相同模型及必要 manifest 的 hash 證據沿用；無新回歸，兩項既有臉部超出保留 |
| 最終 Python tests | 282 項通過，9.144 秒 |
| 最終 TypeScript tests | 27 files、508 項通過，74.43 秒 |
| 最終 code reviews | 兩個最新 verdict 均為 PASS，主代理另獨立核對候選、來源及 motion reuse hashes |
| source assets 與 public/avatar 未改寫 | v2 hashes 與主代理獨立檢查確認未改寫 |
| 新原創角色與設計相似度 | 未驗證 |
| Warudo、OCM 實際成品比較 | 未驗證 |
| 客戶接受、願付價格、修改成本 | 未驗證 |
| 顧客再散布／商用交付授權 | 未驗證 |

原始結果包含 git commit、未提交 Python source hashes、source asset hashes、dataset hash、Python／NumPy 版本。相關 run 目錄在 `build/mika-validation/`，屬本機忽略產物；此報告提供持久摘要，未將客戶可下載商品發布到網站。

[最終 Python 測試收據](../../build/mika-validation/final-python-root.log) 為主代理單獨重跑的全套結果。測試 fixture 的 skin index 已改由 node 讀取，再經 focused tests 38 項及全套 282 項確認。計畫與執行依 make-plan／do 工作流程分成 discovery、固定矩陣、候選產出、獨立 review 與驗證階段；這個流程沒有把未執行的商業或目標軟體檢查算成通過。

[最終 TypeScript 測試收據](../../build/mika-validation/final-typescript-tests.log) 記錄 27 個檔案、508 項測試通過。改動前的 [Python baseline](../../build/mika-validation/baseline-python-tests.log) 與 [TypeScript baseline](../../build/mika-validation/baseline-typescript-tests.log) 亦保留在同一證據目錄。舊入口 `spec.html` 已由主代理實際開啟，確認目前標題、canonical link 與歷史區預設折疊。

本輪 v2 source 與實作識別：

```text
source VRM  f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6
manifest    24246ee7f22a13965baf8f7da56cadaceb06ef01b1345f1f01a31a33a660acba
briefs file 195cb4f7cf84ecf80e926c7c5baa3eada9d884357740d6354a88aa7ef1646a8e
runner      97f4d015ed929a2a3f12c19db55d99cdb023a40f03705e45ea17f470de4d4b46
customise   5adb173e60f4b20037e2b86ea378a8f125520c879cfb26a43cb65c1e089aed09
git HEAD    a031907f70bff32081140134ceb98bf41fb41a6b
```

## 下一步

優先建立可驗證的新髮型與臉型模組，讓角色辨識特徵能改變，再處理服裝及跨模組相容。正式交付前須處理本輪確認的既有手部入臉與穿模問題，並完成真實互動預覽驗收。對十份獨立選取、原創且權利清楚的角色參考量測完整交付、相似度及人工修改成本，並取得實際 OCM 產物與 Warudo 匯入證據。點數、訂閱及後端帳務排在這些交付證據之後。
