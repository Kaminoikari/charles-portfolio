# Mika Phase 2A：髮型與臉型模組驗證

日期：2026-09-09。狀態：Phase 2A 本機 prototype 實作與驗證完成；動作與商品品質未通過。產品資格：`RESEARCH_ONLY`。

已建立版本化 recipe、固定 base hash 與兩個可執行 geometry builders。下顎加寬版本出現臉部動作間隙回歸；bob 的材質接縫與輪廓仍需美術製作。這些產物尚未列入可售 allowlist。

依據：[平台計畫](../plans/mika-platform-validation.md)、[本輪分階段計畫](../plans/mika-hair-face-prototypes.md)。驗證與產物放在忽略目錄 `build/mika-phase2/`，沒有改寫 `public/avatar` 或發布商品。

## 實作範圍

```text
pinned base + versioned recipe
              |
        jaw deformation
              |
       bob replacement
              |
    VRM + manifest + provenance
              |
 geometry / expression / MToon / motion
```

| 模組 | 有界能力 | 不涵蓋 |
|---|---|---|
| `face-jaw-v1` | `jaw_width` 0.88 至 1.12；下臉局部寬度、56 組 POSITION／NORMAL morph 配套處理 | 新眼型、完整新五官、任意 base、設計圖相似度 |
| `hair-bob-v1` | `length_scale` 0.9 至 1.1；新 cap、側後髮殼、七片瀏海；替換舊髮型與依附配件 | 新 spring 髮絲物理、商品級髮束與貼圖、任意臉型相容 |

Face 使用 neutral 狀態推導的固定每頂點 affine map，POSITION morph 可線性混合。Normal 使用 inverse transpose 轉換各端點，沿用既有 blend-and-normalize 模型；本輪沒有證明所有混合 normal 等同重新雕塑後的幾何法線。

Bob 共 1,721 vertices、3,072 triangles，綁定從 mesh skin 推導的 head slot。重用原 Hair mesh node，不留下空 primitives；原 rig、inverse bind matrices、服裝及未指定替換配件保持不變。舊 spring 資料保留，新 bob 不受舊髮尾 spring 驅動，spring 資格標為不適用。

Recipe 拒絕未知 module ID、版本、參數、超範圍或非 finite 值、重複種類及任意路徑。組裝限定全新的 `build/mika-phase2/` 子目錄，禁止覆寫與 symlink 逃逸；輸出附完整 contract snapshot。來源 hash 固定只代表相容與可追溯，商用授權仍待確認。

## 七組固定實驗

| Case | Recipe | 直接量測 |
|---|---|---|
| CONTROL | 空模組 | 基準 |
| F_NARROW | 顎寬 0.88 | neutral 最大位移 7.810mm |
| F_WIDE | 顎寬 1.12 | neutral 最大位移 7.810mm |
| H_SHORT | bob 長度 0.9 | 髮殼下緣 y＝1.299005m |
| H_DEFAULT | bob 長度 1.0 | 髮殼下緣 y＝1.284736m |
| H_LONG | bob 長度 1.1 | 髮殼下緣 y＝1.270467m |
| COMBINED | 顎寬 1.12、bob 長度 1.0 | 兩個操作合成 |

這七份是同一來源模型的受控變體，沒有新增七個原創角色。幾何 verifier 獨立讀回實際 VRM，檢查有意變化、保留 payload、材質貼圖、rig／IBM、manifest 分件與 bbox、head binding、normal 與 winding。上頭皮共 57 個使用中頂點位於 cap bounds 推導的 ellipsoid 內，最大值約 0.795666；cap 在下緣以上沒有開口邊。瀏海最低 y＝1.417121m，眼部最高 y＝1.406813m。這是 neutral 幾何檢查，不能推論所有動作都不穿模。

[v2 原始結果](../../build/mika-phase2/prototype-20260909-v2/results.json) 的七組全部 `TECHNICAL_PASS`，來源未改寫；[圖像與 recipe](../../build/mika-phase2/prototype-20260909-v2/index.html)可逐案檢視。每份核對 56 個 morph targets、15 個 expression groups 及兩組 blink／vowel POSITION 混合。最大 array error 小於 8.22e-8，門檻為 5e-7，未調降門檻。

v2 各案 build 0.068 至 0.469 秒、獨立 verify 0.769 至 1.335 秒、CPU 四視角 render 13.270 至 28.657 秒。執行時有其他驗證並行，這些耗時只描述本機既定模組組裝，不含美術、人工修改、客戶反覆確認，也不作為正式定價或毛利依據。

## Review 找到的驗證缺口

初版 bob builder 留下舊空 mesh，已改為重用原 mesh，並以拒絕測試確認。Sidecar 的 vertex count、bbox 或 spring 宣告被改錯時，初版 hair verifier 仍會通過，已補讀回比較。

正式 v1 產物的貼圖正確，但獨立 review 將新 bob 材質改成合法紅色 PNG 後，初版 verifier 仍判通過。原因是舊 hair 被排除在保留項，新 hair 的材質來源也沒有另外核對。此缺口以新貼圖拒絕測試修正，再以 v2 重新驗證。v1 收據保留，不能宣稱 v1 已涵蓋貼圖來源契約。

## 可見品質與表情

瀏覽器載入七份實際 VRM，各有 54 根 humanoid bones、15 個 expressions、10 支 clips。每份逐一切換並立即繪製全部 15 個 expressions，保存 neutral、blink、aa、Extra 四張 MToon 圖，共 28 張。主代理直接目視 13 張：七份 neutral，以及 F_WIDE／COMBINED 各三個表情。下顎寬度、bob 長度、閉眼、張嘴與 Extra 變化可見。

CPU 四視角共產出 28 張，主代理直接目視 12 張：CONTROL 四視角、兩個臉型的 face、H_SHORT／H_LONG 各 back 與 three_quarter、COMBINED 的 face／back。Bob 頭頂、側後髮與瀏海可見，舊雙馬尾及依附髮飾移除；cap／fringe 貼圖接縫明顯，瀏海節奏與輪廓粗糙。美術品質不接受為商品。

使用 agent-browser 的 immediate WebGL canvas readback 留證據。此替代 viewer 可載入、繪製及切換表情；原 live-preview 在本次 headless 環境的 requestAnimationFrame 未前進，完整互動預覽保持未驗收。動畫檔載入只檢查 runtime 相容，姿勢安全由另外的動作量測記錄。

[Browser 收據](../../build/mika-phase2/prototype-20260909-v1/evidence/browser/results.json)取自 v1；[主代理核對](../../build/mika-phase2/prototype-20260909-v2/evidence/root-verification.json)確認 v2 七份 VRM、完整 manifest 與 28 張 CPU PNG 的 hashes 全部與 v1 相同，故沿用本輪影像與目視證據。另核對所有 v2 Python source hashes 與實際檔案一致。可直接比較 [CONTROL](../../build/mika-phase2/prototype-20260909-v1/evidence/browser/CONTROL-neutral.png) 與 [COMBINED](../../build/mika-phase2/prototype-20260909-v1/evidence/browser/COMBINED-neutral.png)。

## 動作結果

七份各跑十支 motion；CONTROL 與兩份 face-only 另跑十支 spring clip，共 100 組不同的模型／量測種類／clip 組合。另重算 70 個 motion 結果以保存 JSON。新 bob 固定 head 綁定，spring 不適用，沒有以零穿模計入通過。

| 變體 | scratchHead faceRatio | dance faceRatio |
|---|---:|---:|
| CONTROL 與三份 bob-only | 0.9710 | 0.1825 |
| F_NARROW | 0.9714 | 0.1830 |
| F_WIDE、COMBINED | 0.9690 | 0.1799 |
| 既有最低預算 | 1.0000 | 0.1900（waiver） |

全部仍有兩項超出。加寬版本比 CONTROL 分別下降 0.0020、0.0026，確認新幾何使指標更差；列為動作相容未通過。縮窄雖略有改善，也沒有通過既有預算。這些是幾何近似指標與取樣結果，沒有宣稱零穿模或完整動作美術接受。

三份原髮型的 spring 十支 clip 在 CLI 顯示精度下均與 CONTROL 一致。既有 `dance` coat max 37mm、body max 50mm、skirt 18mm，`spin` coat max 42mm 仍存在；列印 0% 不代表沒有穿模。取樣為 60Hz、pre-roll 2 秒、hair stride 2。

[動作摘要](../../build/mika-phase2/prototype-20260909-v2/evidence/motion-summary.json)與[沿用證明](../../build/mika-phase2/prototype-20260909-v2/evidence/motion-reuse-proof.json)保留完整命令、耗時、hash、逐案原始 logs。量測實際在本輪 v1 執行，v2 以完全相同的 VRM／manifest／recipe 沿用，主代理另核對複製 logs 的 hashes。`measure-motions` 的 crown 預算仍沿用 family spring clearance 推估，因此本輪 head／hand 指標不能證明新 bob 的動態碰撞或完整取景安全。

## 重現與後續

```sh
python3 scripts/avatar/module_validation.py --run-id fresh-name
PYTHONPATH=scripts/avatar python3 -m unittest discover -s scripts/avatar -p '*_test.py'
npm test
npx tsx scripts/measure-motions.ts build/mika-phase2/fresh-name/COMBINED/model.vrm --family=vroid-sample-b
```

`fresh-name` 必須是尚不存在的目錄。Runner 產出結構、幾何與 CPU render 結果；瀏覽器、動作、美術與目標軟體需另外執行，不會自動將 pending 欄位改成通過。

## 最終驗證收據

| 項目 | 結果 |
|---|---|
| 固定七組 v2 | 7 TECHNICAL_PASS，source immutable |
| 可重現性 | 全新目錄重建 COMBINED，VRM 與完整 manifest hashes 相同 |
| Python | 349 tests，31.067 秒，OK |
| TypeScript | 單 worker 完整 27 files、508 tests，127.32 秒通過 |
| 最新 code reviews | pipeline_review 與 recipe_discovery 均為 PASS，範圍限 research contract |
| 影像 | 28 CPU、28 MToon 圖像；主代理分別直接目視 12、13 張 |
| 動作 | 70 組 motion、30 組 spring 量測完成；品質超出仍保留 |
| 交付資格 | 美術未接受；互動 preview、Warudo、OCM、相似度、客戶與授權未驗證 |

[Python 最終 log](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/final-python.log)與[修改前 baseline](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/baseline-python-before-phase2.log)保留本輪證據。[Mutation 收據](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/mutation-results.json)確認停用 face delta、normal、保留貼圖、IBM 與新 bob 材質核對後，對應拒絕測試都轉紅。[可重現性證明](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/reproduction-proof.json)另記錄新目錄重建。

TypeScript 的前兩次預設並行執行雖各有 508 項 assertions 通過，仍因 worker `onTaskUpdate` timeout 退出失敗。[第一次](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/npm-worker-timeout-first.log)與[第二次](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/npm-worker-timeout-second.log)失敗收據保留。最終改用 `npm test -- --maxWorkers=1` 跑同一完整測試集合，[單 worker 收據](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/final-npm-serial.log)確認通過，未更改 assertion 或 timeout 設定；預設並行模式不能列為本輪全綠。

依 make-plan／do 的分階段流程，將 discovery、builder、獨立拒絕測試、候選輸出及 review 分開完成；agent-browser 提供實際 MToon 與更新後舊 spec 入口的 browser 證據。工具成功不改變美術、動作及授權門檻。原始 results／manifest 的 `NOT_RUN` 是寫出當時狀態，後續驗證以本報告及附加收據為準。

Source VRM hash 為 `f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6`，manifest 為 `24246ee7f22a13965baf8f7da56cadaceb06ef01b1345f1f01a31a33a660acba`。v2 results 保存所有 Python source identities，主代理已逐檔核對。`public/avatar` 未改寫，未 commit、push、付費呼叫或商用發布。

[完整測試與 review 索引](../../build/mika-phase2/prototype-20260909-v2/evidence/recipe-verification/README.md)集中本輪收據。兩份最新 review 均核對最終實作與已知品質限制；主代理另直接核對模型、來源、圖像、motion logs 與本報告的檔案連結。

下一階段優先處理 bob 的獨立 UV／材質與造型，並建立依臉型重驗的動作修正及相容範圍。`B08` 的下垂眼、長褲、場景與新手勢仍未實作。十份獨立原創參考、設計相似度、人工修改分鐘、Warudo、OCM 實際成品及再散布授權保持未驗證。點數與訂閱方向維持，帳務後端等交付與單位經濟證據成熟再做。
