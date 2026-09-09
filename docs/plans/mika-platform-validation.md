# Mika 模組化 3D 平台驗證計畫

更新日期：2026-09-09。狀態：Phase 0、Phase 1 已完成；Phase 2A 已實作，驗證結果見[髮型與臉型報告](../reports/mika-hair-face-prototypes-2026-09-09.md)。完整 Phase 2 與產品交付資格保持 `PENDING`。

最新執行原則：先依[現成方案評估](mika-existing-solutions-evaluation.md)完成 reuse-first gate，暫停繼續自研髮型、臉型與動作調參。先用既有 authoring 工具、VRM Add-on／UniVRM、模組組裝與生成 API 驗證相同需求，再依實測缺口決定最小自研範圍。方案待授權或待測試保持 `PENDING`，不能直接當作無方案可用。

最新實測：[R0／R1 報告](../reports/mika-reuse-validation-2026-09-09.md)已完成限定來源查核與官方 Blender VRM Add-on 的 Mika 往返。基本結構／表情載入通過，strict baseline 因微小 rest position 差異仍 FAIL；分件整合、完整動作／物理及 R2 品質比較待驗。359 Python tests 與獨立 driver review 通過，原始模型未更換。

R2 最新結果：[Studio 實測報告](../reports/mika-r2-studio-2026-09-09.md)已產生 control＋三份變體的 `.vroid`／VRM0，四份各 14 expressions、10 clips 載入 probe 通過，另完成十支 motion 數值掃描。同臉換髮型／服裝的 face residual 低於 0.0004 mm。XWear 已匯出、重新套用、保存 `.xroid` 並匯出 VRM1；自動遮蔽造成頸部缺口，該成品 FAIL。原生四份亦未通過 Mika 專用 `verify.py` 全部規則，產品交付保持 `PENDING`。先沿用 Studio authoring 建立可編輯資產庫，下一輪處理乾淨換裝 base／內建遮蔽、專用構圖與完整品質驗收；不恢復自研髮型或 IK。

R3 限定試驗已完成：[內建 mesh restore 與候選動作報告](../reports/mika-r3-studio-2026-09-09.md)。Studio 原生空白服裝 preset 建立乾淨 base，再套 XWear 並 restore，已另存／重開 `.xroid` 及匯出 VRM1；獨立檢視頸部連續、舊 T-shirt 白色尖角消失，兩項局部修復 `PASS`。最終檔完成 4 views／21 PNG／18 expressions 與 10 clips 數值掃描，取得 13 組 numeric candidate placements；缺少專屬 crown clearance，正式 allowlist 仍為空（其後已補上 clearance 三個模組裡的兩份，見下段）。Bent-arm growth 46.48 mm 高於 25 mm（下一段已修復並套回原檔，該次量測的位元組保存為 `R3-B-clean-base-dressup-torn.vrm`），另 5 項舊 gate 不支援 VRM1，完整產品交付仍 `PENDING`。保留 R2 與 R3 partial 歷史，未放寬門檻或自研幾何／IK。先驗收固定 base × module 組合並保存可逆 source／mask／hash，整備人工與每單工時分開記錄。

R3 遺留的 bent-arm 46.48 mm 已找到根因並修復，收據見 [refit-0909](../../scripts/avatar/evidence/refit-0909.md)。寬版外套腋下外側整片飛離身體 66–97 mm，auto-fit 的最近頂點複製在那片空隙裡一邊抓到肋骨（該身體點手臂權重 0.069）、隔壁抓到上臂下緣（0.919），外套自己因此拿到 0.265 與 0.562；單邊 Δw = 0.297 乘上該處距肩關節的 181 mm，抬手 60 度就把一條 49.8 mm 的邊拉到 96.3 mm。擴散修不到門檻（32 pass 停在 30.53 mm），因為過渡帶在 r≈200 mm 需要 8 條邊接力而空隙只有約 4 條。新增 `scripts/avatar/refit.py` 把懸空布料的手臂那一份還給它懸掛的宿主骨，並已套回 `R3-B-clean-base-dressup.vrm` 本身（修正前位元組保存為同名 `-torn.vrm`）。R3 那一整套驗收重跑：`torn_bindings` 由 FAIL 轉 PASS（最壞邊 22.99 mm）、structure-check 7 PASS／0 FAIL／5 NOT_SUPPORTED exit 0、10 clips 掃描與 4 views／21 PNG／18 expressions 擷取重跑一致、完整性快照 PASS（9 產物、138 PNG）。只改 `JOINTS_0`／`WEIGHTS_0`，沒有動幾何、UV、morph 或門檻；`.xroid` 未變，從 source 重新匯出仍需再跑一次 refit。

這個缺陷在出貨動作範圍內就會發生：十支 clip 中 stretch 把左上臂抬到 T-pose 之上 36 度，該角度修正前已達 30.31 mm，修正後為 15.66 mm。修法把 auto-fit 的權重撕裂變成一個可腳本化的步驟，仍需人工指名哪些 primitive 是布、哪些是身體，樣本也只有一件衣服。`motion.check` 的像素穿模 gate 本輪未跑；能量到的是外套與身體的最近距離沒有變差（抬手 60 度 min 2.71→3.01 mm）。頸部 auto-mask 仍須人工 restore，spring 與完整動態驗收不受此影響，維持 `PENDING`。

crown clearance 補上了三個模組裡的兩份（`simulated` 與 `measured`），收據見 [parts-0909](../../scripts/avatar/evidence/parts-0909.md)。第三方匯出檔沒有 `parts.json`，改手寫一份 17 個 primitive 全列的對照表，腰線 1.0187 讀自未被 auto-mask 挖過的 `InnerTop.baked[0]`（挖過的那個 mesh 在搜尋範圍的 29 個切片裡只剩一片還有頂點，量到的是破洞邊緣）。量下去發現這個檔宣告 16 組彈簧而沒有一組動得了頭頂：29 個彈簧節點只有 6 個出現在任何 skin 且全是胸部，頭髮完全由 `J_Bip_C_Head` 帶動。`springsim.ts` 原本無條件拒絕這種檔；量過之後放寬了，因為頭頂不取決於哪個 primitive 被叫做頭髮（把 milfy 的 `Hair_*` 指向臉，`spin` 與 `dance` 的頭頂與兩個機位投影一位不差），空清單只影響 `jump` 兩欄與四個調參旗標，所以改成照跑並標 `rigidHair`、帶旗標才拒絕。十支 clip 全部跑出頭頂。`measure-motions.ts --write` 的 `measured` 也跑出來了，兩份的 `rigSha` 與 `restCrownY`（1.5982）一致；缺的是手寫決策模組（`crownFringe`、`pans`、waiver），`approvedAllowlist` 在三份齊備前是空集合。像素穿模 gate 另外還卡在 `pierce.py` 寫死的 `SKIN = ('Body_Skin', 'Face')`：這具身體的皮膚分在三個 mesh 上，另外兩層會被當成布。

使用者定案（2026-09-09）：既有 Mika 素材、pixiv／MellowHeart 及平台使用授權為 **已驗證（使用者確認先前已完成驗證）**，後續不再詢問或要求 source 補件阻擋；直接進入 R2 本機製作比較。檔案可讀性及新輸出的品質按實測記錄。

本文件是目前產品定位、商模與驗證順序的依據。`/Users/charles/vtuber-kit/spec.html` 保留舊語音產品構想；`/Users/charles/.claude/plans/nested-conjuring-wirth.md` 保留骨架泛化工程及收據。歷史規格中的 TTS-first Gate、語音分鐘計價、舊訂閱價格與 VTube Studio 交付路徑不再作為當前平台承諾。

## 產品決策

平台接受設計圖或概念，從少量經驗證的 base model 與相容模組產生可繼續修改的角色。角色保存版本化 recipe，後續可加購服裝、配件、動作與場景。首版明訂支援畫風、體型、表情與模組範圍，未覆蓋需求先列出缺口，再決定是否納入有次數與工時上限的人工加購。

主要收費方式為點數。使用者可單次購買，月訂閱提供每月點數額度；點數對應新資產生成、付費模組及有實際成本的製作工作。基本調整與預覽不逐次扣點，重複下載已購檔案不收費；匯出收費只適用於明確新增的付費交付物。訂閱結束後仍保留已購資產的使用權，正式規格另訂點數效期與平台編輯功能的存取範圍。角色 base、recipe 與可用模組的長期延伸能力是本輪要驗證的產品價值。語音保留為後續選配。

```text
設計圖／概念
    |
需求確認與範圍判定
    |
base family + 相容模組 + 有限參數
    |
版本化 recipe
    |
離線組裝與候選輸出
    |
結構、渲染、表情、動作驗收
    |
預覽與有限修改
    |
目標軟體交付包
```

保留 React、TypeScript、Vite、three.js、three-vrm 與 Python／Blender 生產工具。API、Postgres、object storage、job queue、帳號及點數帳務在交付可行性與單位經濟得到證據後實作。客戶 recipe 只能引用 allowlist 中的 asset ID 與合法參數，不能提交檔案路徑、Python、shell 或任意程式碼。

新增採用決策：VRoid Studio 優先作動漫角色品質基準，Blender＋VRM Add-on 優先做自動化往返試驗，XWear／Modular Avatar 評估換裝，Tripo／Meshy 與 OCM 評估圖像生成成品。既有 VRoid-derived 素材與平台使用授權依使用者確認標為已驗證，不重開確認。[官方 Guidelines](https://vroid.com/en/studio/guidelines) 保留為來源參考。

## 競品與價格依據

2026-09-09 已讀取下列公開頁面；本輪未購買 OCM 成品，也未測試其輸出檔。

| 來源 | 頁面記載或參照用途 | 尚未驗證 |
|---|---|---|
| [Kimina 製作流程與價格](https://kimina-studio.com/processandprice/) | 使用者目標是降低這類原創模型委託約 NT$100,000 至 NT$200,000 的取得門檻 | 本平台在相同設計複雜度與交付範圍下的成本與品質 |
| [OCM 官網](https://vtuber-ocm.com/en/) | 點數型製作平台；Standard 為單次 JPY 2,080 的 2,000 points 點數包 | 實際付費成品、生成成功率、重試成本 |
| [OCM guide](https://vtuber-ocm.com/en/guide/) | 角色 800 points、表情 200、背景 60、影片每秒 85、參考圖 25 | 角色 topology、rig、表情品質、跨軟體相容及可持續編輯能力 |
| [OCM terms](https://vtuber-ocm.com/en/legal/terms) | 產品權利與使用條件的公開來源 | 對實際購買成品及特定再製用途的逐項適用範圍 |

OCM 的背景圖片與生成影片 overlay，和可自由操控的 3D 場景、rig 動畫有不同交付內容。後續比較須取得同一需求的實際檔案，再逐項確認，不能只從頁面功能名稱判定等價。以上頁面價格只提供商模參照，不直接換算成 Mika 售價。

每單成本應記錄：

```text
總成本 = 運算與重試 + 人工修改 + 授權攤提
       + 客服與退款 + 金流 + 儲存與交付
```

點數贈送、折扣與月配額都會改變實收單點價格。尚未量測成功率與人工分鐘數前，不發布固定售價、毛利或 GPU 成本推估。

## 已有技術與邊界

目前已有部件 manifest、刪件／改色、頭部比例調整、骨架讀取、rest pose 與 retarget、綁定策略及穿模量測工具。這些能力構成受控 base family 的研發底座。

[骨架夾具紀錄](avatar-fixture-seed-san.md) 記載機器層已能處理另一具 VRM 1.0、不同 skin 與 rest rotation；內容 recipe 仍帶 VRoid／Milfy 的分件、服裝和配件假設。骨架可讀與動作可 retarget，不能單獨證明服裝不穿模。既有配色與刪件也不能證明能建立新的臉型、髮型或服裝。

現有 Mika 來源包含 VRoid sample 衍生資產及匯入的 MellowHeart 服裝。相關授權已驗證，證據來源為使用者確認先前已完成驗證；不再索取原文、不再重問。技術製作與品質 gate 持續依實際產物驗收。本輪僅執行本機研發，無模型發布、付費 API 或商用販售。

## Phase 0：文件與 API discovery

狀態：已完成 source discovery，尚不代表新候選輸出已通過驗收。

**工作**：已核對現有入口與直接 API、輸出位置、副作用及量測範圍。

| Source | 已確認的介面或限制 |
|---|---|
| `scripts/avatar/customise.py` | `apply(src, dst, manifest_path, drop=(), tints=(), hues=(), manifest_out=None)` |
| `scripts/avatar/proportion.py` | `apply(src, dst, factor, chin=None)` |
| `scripts/avatar/verify.py` | `report(path, baseline=None)` 回傳 `(ok, stats)` |
| `scripts/avatar/render.py` | `render(path, out_prefix, size=(700, 1200), only=None, posed=None)`；view keys 為 `front`、`back`、`three_quarter`、`face` |
| `scripts/avatar/selftest.py` | `run(model, manifest_path, seed=None, out=None)`；可指定獨立輸出 |
| `scripts/avatar/vrmrig.py` | `read(path: str) -> dict`、`compare(a: dict, b: dict, tolerance: float = TOLERANCE) -> list` |
| `scripts/measure-motions.ts` | 模型路徑加 `--family=vroid-sample-b` 讀現有 family budgets；`--write` 會寫量測檔 |
| `scripts/avatar/springsim.ts` | 模型路徑加 `--clip=all` 跑全部動作；對應 `.parts.json` 決定可量的服裝欄位 |
| `scripts/avatar/make.py` | `main(base=BASELINE)` 最後無條件複製到 `public/avatar`；不可直接用於隔離驗證 |

**文件**：本節保留 discovery 結果；現有四個計畫入口指向本文件。實際 run 另外記錄 code identity、source asset hashes、命令、時間與產物位置。

**驗證**：已直接讀取上述 source 及 `public/avatar/mika-milfy-12.parts.json`。Phase 1 執行 focused tests 與候選輸出檢查。

**避免事項**：不以歷史測試紀錄代替當次檢查；不呼叫會發布模型的預設 rebuild；不把 NumPy rasterizer 結果當成完整 MToon 或 Warudo 驗收。`customise.tint` 與 VRM0 `_Color` 的 consumer 差異須在輸出驗證時單獨檢查。

## Phase 1：十份合成需求的本機技術驗證

狀態：本輪技術驗證完成。[本輪驗證報告](../reports/mika-platform-validation-2026-09-09.md) 記錄 v1 的兩項 palette 同步失敗與修正，v2 六項操作通過、四項能力缺口，CONTROL 通過，來源未改寫。282 項 Python、508 項 TypeScript tests 通過，兩個最新 review verdict 均為 PASS。140 次動作量測未發現新回歸；基準仍有兩項臉部預算超出與非零穿模深度。MToon viewer 可用，原互動 preview 在本次 headless session 的 requestAnimationFrame 未前進，保留未驗收。這是既有模型的配置能力，產品交付資格保持 `PENDING`。先建立新髮型與臉型模組，再推進支付與後端。產物放在已忽略的 `build/mika-validation/<run>/`，需求與判定方式已在執行前固定。

**工作**：使用 `scripts/avatar/platform_validation.py` 執行 `scripts/avatar/validation/briefs.json` 的固定矩陣。六份需求使用既有部件或材質操作，四份用來標示能力缺口。使用現有 shipped Mika VRM 與 manifest 產生支援需求的實際候選，保留既有臉型與髮型。基準 control 另列，不列入十份分母。先修正已確認的 tint 與 VRM0 `_Color` 不同步問題，附 failing test 與回歸檢查，再驗證候選。每筆要求、recipe 與預期可觀察變化在執行前存檔。

| Brief | 固定需求 | 執行前分類 |
|---|---|---|
| B01 | 移除皇冠 | 既有操作，待實測 |
| B02 | 移除腰部緞帶 | 既有操作，待實測 |
| B03 | 移除 cardigan | 既有操作，待實測 |
| B04 | 移除皇冠、小熊及貼布髮夾 | 既有操作，待實測 |
| B05 | 將既有薄荷色配件改為梅紫色 | 既有操作，待實測 |
| B06 | 將既有 cardigan 改為藍色 | 既有操作，待實測 |
| B07 | 新增 bob 短髮 | 缺少髮型模組 |
| B08 | 新增圓臉及下垂眼 | 缺少臉型與五官參數 |
| B09 | 將現有服裝換成長褲 | 缺少服裝模組 |
| B10 | 可編輯的 3D 房間與新的 finger-heart 手勢 | 缺少場景與手勢模組 |

這次量測既有模型的衍生可行性。十份 brief 不代表十個新角色；本輪沒有從零重建、設計相似度評分、客戶接受度或付費 OCM A/B。未支援需求仍留在分母，逐項寫明缺少能力。某一筆失敗後繼續完成其餘列舉與驗證。

本輪執行通過的條件是：支援需求的實際效果、結構與渲染均獲驗證，未支援或未量測項目如實記錄。矩陣刻意選入六個既有操作與四個缺口探針，覆蓋數僅描述這組案例，不能推估客戶需求覆蓋率，也不設八成商業 go／no-go 門檻。任一支援候選未通過檢查，保留失敗項，繼續完成全矩陣。

執行時分開記錄：

| 欄位 | 判斷方式 |
|---|---|
| 需求覆蓋 | 每個要求均有已實作操作；只完成一部分即不能標完整覆蓋 |
| 候選生成 | 實際輸出 VRM 與同步 manifest，記錄耗時、大小、hash、失敗與重試 |
| 幾何及結構 | 獨立 verifier 直接讀出目標變化與保留項，不能只信 runner 回傳值 |
| 靜態渲染 | 比對 control 與候選的真實 view keys；記錄可見改變及瑕疵 |
| 瀏覽器檢視 | 載入候選，檢查 three-vrm 渲染；失敗或未執行均明記 |
| 動作與穿模 | 按實際修改量測；同 rig 不豁免衣服、頭髮及新比例檢查 |
| 美術與相似度 | 本輪未驗證，不能由自動結構檢查推定 |
| 目標軟體 | Warudo 等尚未驗證，與瀏覽器檢視分開 |
| 客戶與商業 | 客戶接受度、願付價格、OCM 成品比較未驗證；既有素材／平台授權依 2026-09-09 使用者確認結案 |

**文件**：報告列出原始十份需求、逐項結果、執行判定、timings、source hashes、code identity、實際命令及 screenshots。支援數、生成數、自動 gate 數與人工檢視數各自計數，禁止合併為一個不明確的成功率。

**驗證**：改既有程式前先跑相關 baseline tests；新增 runner 附帶 focused tests。對每份支援候選執行獨立 structure／geometry checks 與渲染。使用實際檔案與瀏覽器讀回結果核對，並由主代理以 agent-browser 檢視 MToon 顯示。檢查來源與 `public/avatar` 未被改寫。顏色變更若不改幾何，可用相同幾何與 spring hashes 說明可共用的量測；未覆蓋的 consumer 仍列 pending。

**避免事項**：不把改色當成新髮型，不把頭部縮放當成新臉型，不把 unsupported 計為交付成功，不虛構客戶評分，不填推測 GPU 成本，不因靜圖正常宣稱完整動畫通過，不修改 `public/avatar` 或呼叫付費服務。

## Phase 2：依缺口建立角色與模組契約

狀態：部分完成。[Phase 2A](mika-hair-face-prototypes.md) 已建立版本化 catalog／recipe、下顎寬度與 procedural bob 模組，包含七組控制與參數探針。加寬下顎在 scratchHead／dance 的臉部間隙指標更差，bob 貼圖與輪廓仍屬 prototype 品質，尚無可售模組。完整[驗證結果](../reports/mika-hair-face-prototypes-2026-09-09.md)分開記錄幾何通過與交付缺口；點數與後端帳務維持 Phase 3。

下一個本機階段依[現成方案評估 R2](mika-existing-solutions-evaluation.md)直接比較現成髮型／臉型 authoring、換裝及生成成品；R0 已由使用者確認結案，R1 官方往返已完成。bob 美術、臉型動作間隙仍是驗收目標，處理方法先採用既有工具與參考實作。髮型 spring 若納入產品承諾，須驗證實際動態。`B08` 的下垂眼、長褲、場景及新手勢維持缺口。Phase 1 的歷史矩陣不回填成成功。

**工作**：依實際未覆蓋需求排序 face shape、hair、outfit contracts。每個 base family 與 module 記錄支援參數範圍、attachment、skin／morph、材質、collision、動畫相容、版本及授權來源。先建立十份原創且權利清楚的角色參考，再驗證外觀相似度；取得實際 OCM 產物做同需求比較，接著進行目標 Warudo 交付測試。參考需求須獨立選取，避免按既有操作挑題；可在執行前登記至少八份完整交付等技術門檻，客戶接受與付費意願另外驗證。

**文件**：新增 module contract 與 compatibility matrix；每份參考記錄權利鏈、目標設計、版本、修改紀錄及人工作業分鐘。OCM 比較附實際檔案能力、設定、重試及成本，記錄取得日期。

**驗證**：每個新模組在宣告的 base／體型／動作範圍內檢查表情、穿模、MToon 與 consumer 相容；獨立檢視者評估外觀，但實際客戶接受度另行收集。正式交付前須處理本輪確認的既有手部入臉與穿模問題，並完成真實互動預覽驗收。只有通過的組合列入可售 allowlist。

**避免事項**：不從一具 rig 推論任意衣服安全；不為涵蓋任意輸入而無限泛化；不把頁面功能表當成 OCM 成品證據；未經確認不使用既有 sample 的同意紀錄推定所有資產皆可再散布。

## Phase 3：點數系統與商業驗證

狀態：待交付與單位經濟證據。

**工作**：根據實測工時、重試與授權成本建立點數 SKU、月配額及有限人工加購。實作版本化 recipe、asset allowlist、job queue、取消／重試、下載權限、帳務及帳號。用真實付費需求驗證成單、接受、修改、退款與持續使用情況。

**文件**：記錄實收單點價格、每 SKU 成本分布、修改上限、權利與訂閱條件、失敗處理及付費 cohort。價格更新須能追溯到量測，正式目標與停止條件在試賣前固定。

**驗證**：金流與外部依賴 mock 測試、job idempotency、點數扣還一致性、recipe 可重建及版本追蹤；再於已授權的實際付款環境測試。確認每個販售資產、客戶輸入與交付包的使用範圍，實測客戶接受及總人工成本。

**避免事項**：不把充值視為已消耗收入，不以未測成本宣布毛利，不讓訂閱包住無上限人工，也不讓使用者提供任意執行路徑或程式碼。

## 完成判定

本輪完成需有固定十份 brief、control、實際候選與逐項結果、獨立 verifier、耗時及圖像證據、瀏覽器檢視紀錄，並將執行判定依實際結果寫為通過或未通過。合成案例覆蓋數保持描述用途。未取得的美術、相似度、Warudo、OCM 成品與客戶證據保留 pending；既有授權依使用者確認為已驗證。任何後續改動碰到已驗證的技術項目，都須重跑該項檢查。
