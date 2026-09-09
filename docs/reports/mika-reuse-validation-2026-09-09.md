# Mika 現成工具驗證紀錄

日期：2026-09-09。依據：[現成方案評估與採用計畫](../plans/mika-existing-solutions-evaluation.md)。

R0 與 R1 最小 round-trip 試驗已完成。R0 既有授權為 **已驗證（2026-09-09 使用者確認先前已完成驗證）**，後續不再詢問、不索取原文或 source 補件阻擋 R2。官方 Blender VRM Add-on 可以自動化處理現有 Mika；基本結構與載入驗證通過。嚴格 baseline gate 仍為 `FAIL`，完整動作／物理保真與分件整合保持 `PENDING`，本輪未替換生產 pipeline。

## R0：來源、製作檔與權利證據

以下檔案搜尋保留為當時的歷史收據。使用者後續已確認先前驗證完成，當時的「待證」判定已被本報告頂端的已驗證狀態取代，不再列為待辦。

本輪只讀 `/Users/charles/portfolio`、`/Users/charles/vtuber-kit` 與 `/Users/charles/.claude/plans` 中本案相關明文紀錄及模型 metadata。使用 `rg` 搜尋 pixiv 同意／許可／授權、MellowHeart、BOOTH 6975498、license／licence 與 authoring 副檔名；排除 `.env`、金鑰、Git 內部資料，依賴目錄命中未作資產權利證據。未讀 email、Downloads 或其他私人目錄，沒有安裝、上傳或修改模型。

| 實際位置 | 讀到的內容 | 證據性質 |
|---|---|---|
| [avatar-guide.md](../plans/avatar-guide.md)，第 22 行起 | 記錄核對 AvatarSample 官方 FAQ，提到一般商用及禁止收費再散布模型檔 | 公開條款的二手核對紀錄，沒有 pixiv 對 Mika 平台的個別許可原文 |
| [mika-platform-validation.md](../plans/mika-platform-validation.md)，「已有技術與邊界」 | R0 查核時記載「既有紀錄提到已取得 pixiv 同意」，現已補上來源待證說明 | 目前未追到這項二手說法的原始來源，標記待證；查無原文不代表不存在許可 |
| [blender/mellow.py](../../scripts/avatar/blender/mellow.py)，第 38 行及 `SETS` | 原始路徑為 `/Users/charles/Downloads/MellowHeart_Dream1.05/FBX`，使用 `Milfy_Inner.fbx` 與 `Milfy_Outer.fbx` | 可定位的來源指標；Downloads 超出本輪範圍，未讀原始包或條款 |
| [bonemap/mellowheart.json](../../scripts/avatar/bonemap/mellowheart.json)，第 3 行 | `MellowHeart Dream (booth 6975498), Milfy fitting` | 開發者來源註解，沒有許可條款 |
| [Mika sidecar](../../public/avatar/mika-milfy-12.parts.json)，`source` | `/Users/charles/portfolio/scripts/avatar/baseline.vrm` | 管線來源路徑，未構成完整素材授權鏈 |
| `/Users/charles/vtuber-kit/models/README.md`，第 18 行起 | 記錄身體源自 `AvatarSample_B_webp.vrm`，缺少對應 VRoid project | 歷史 source 缺口紀錄，另有本輪檔名搜尋支持 |

本輪直接讀取 `public/avatar/AvatarSample_B_webp.vrm` 與 `public/avatar/mika-milfy-12.vrm` 的 GLB JSON。兩者 `VRM.meta` 都仍為 `author: VRoid`、`title: AvatarSample_B`、`commercialUssageName: Allow`、`licenseName: Other`、空白 `otherLicenseUrl`。這些實際欄位不足以證明 MellowHeart 衣服授權、平台生成或付費再散布資格。

`public/avatar/vrm1-twist-sample.vrm` 與 `scripts/avatar/fixtures/seed-san.vrm` 的 `VRMC_vrm.meta` 均實際讀到 `allowRedistribution: true`、`modification: allowModificationRedistribution`、`commercialUsage: corporation`、VRM Public License 1.0 URL。Seed-san 的 `creditNotation` 為 `required`，Twist 為 `unnecessary`。相關來源記錄見 [Twist fixture](../plans/avatar-family-vrm1-twist-sample.md) 與 [Seed-san fixture](../plans/avatar-fixture-seed-san.md)。這些是各自 fixture 的證據，不能擴張為 Mika 全部素材已授權。

### 查無結果的精確範圍

- 在 portfolio 與 vtuber-kit 兩個目錄，以包含 hidden／ignored files 的檔名搜尋，未找到 `.vroid`、`.vroidcustomitem`、`.blend`、`.xwear`、`.xavatar`；Git 與套件依賴內容不納入 authoring source。
- 在上述範圍的本案相關明文檔，未找到 pixiv 個別書面許可或 MellowHeart 原始 license。`.claude/plans/nested-conjuring-wirth.md` 有 MellowHeart 技術與 fixture 記錄，沒有找到上述許可原文。
- 結論僅限已搜尋位置；未判定其他位置沒有 source 或許可，也未否定任何既有合約。

後續結案：使用者確認既有素材與平台使用事項先前已驗證，R0 為已驗證；不再要求原始 pixiv 許可或 MellowHeart 條款。本輪沒有聲稱親自重閱原始合約，資料來源明記為使用者確認。

### 修改前 Python baseline

```text
python3 -m unittest discover -s scripts/avatar -p '*_test.py'
Ran 349 tests in 10.308s
OK
exit 0
```

本次使用 `mktemp -d /tmp/mika-r0-python-baseline.XXXXXX` 建立全新 log 目錄。原始輸出：[python-tests.log](/tmp/mika-r0-python-baseline.Bn6X0N/python-tests.log)。這是既有 Python suite 的 baseline，沒有證明 R1 工具匯出成功。

## R1：Blender＋VRM Add-on round-trip

### 工具與實際執行

使用 `/Applications/Blender.app/Contents/MacOS/Blender`，實際版本 5.2.1 LTS、build `9e2066aef7ef`。官方 VRM Add-on 4.7.1 Extension zip 解壓至本次 `vendor/io_scene_vrm`，沒有安裝至使用者目錄。下載 SHA256 `5d6f8fb5c9bf836f0e77b9af501f17fbe35801dd353fef509fc917c64ac7c9ac` 與 GitHub release digest 相符。實際 manifest 支援 Blender 4.2 至 5.3 以下，code license 為 MIT OR GPL-3.0-or-later。素材權利另行確認。[官方 release](https://github.com/saturday06/VRM-Addon-for-Blender/releases/tag/v4.7.1)

Driver 只呼叫官方 `bpy.ops.import_scene.vrm` 與 `bpy.ops.export_scene.vrm`，沒有美術、geometry 或 serializer 修改。[官方 Python 範例](https://vrm-addon-for-blender.info/en-us/scripting-api/) 以 factory-startup／disable-autoexec 啟動，啟用外掛只建立 process 內 preferences entry，沒有 `save_userpref`，結束即釋放。

實際命令：

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/avatar/blender/vrm_roundtrip.py -- \
  --addon-source build/mika-reuse/r1-roundtrip-20260909-v1/vendor/io_scene_vrm \
  --source public/avatar/mika-milfy-12.vrm \
  --output build/mika-reuse/r1-roundtrip-20260909-v1/model.vrm
```

兩個 operator 皆回傳 `FINISHED`，Blender exit 0，import／export 與輸出讀回約 22.02 秒。再次執行必須使用全新 run 路徑，driver 拒絕覆寫。Source／output 均確認 VRM `specVersion: 0.0`，沒有轉成 VRM1。

| 檔案 | SHA256 |
|---|---|
| 原始 Mika，12,034,572 bytes | `f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6` |
| round-trip，29,692,752 bytes | `430e09ed05a3656fd64f223c91db2028b387373fa60c4f37a6207432dd4ae6eb` |
| 原始 `.parts.json`，未修改或複製 | `24246ee7f22a13965baf8f7da56cadaceb06ef01b1345f1f01a31a33a660acba` |

### 實測保留項與差異

語意比較按 node／mesh／material 名稱和解碼後貼圖核對，避免把索引重排直接當作損壞。程式 `build/mika-reuse/compare-roundtrip.py` 僅產生唯讀證據，不寫模型或調整任何 gate。

| 檢查 | 本輪結果 |
|---|---|
| Humanoid | 54 個 bone 名稱皆保留 |
| World matrices | 142 個同名 node 可配對，最大元素差 `5.356e-7`；輸出省略兩個名為 `Hairs`、`secondary` 的 node，其他同名 node 無缺失 |
| Inverse bind matrices | 3 skins × 139 joints 共 417 筆皆可配對，最大元素差 `5.364e-7` |
| Morph／expression | Face 56、Body 6 target 名稱與順序保留；15 組 expression 按 mesh／target 名稱解析後的 binds、weight、preset 等完全相同。全量 morph displacement 等價尚未驗證 |
| MToon 貼圖 | 每個材質 texture slot 對應的解碼 RGBA hash 與尺寸相同，沒有像素差異 |
| MToon properties | Raw JSON 有 951 個欄位差異，含 462 個新增／移除欄位及浮點差。官方 `vrm_diff.py` 明確將未啟用的 outline width／lighting、非 screen-space distance、emission alpha 正規化；不能把 raw diff 數量當成缺陷數量。完整跨 consumer 材質等價未宣告 |
| Spring metadata | 4 boneGroups、17 colliderGroups 保留，名稱解析後的 bone／center／collider 引用相同；810 個純數值差異最大 `1.193e-7`。時間序列物理等價未宣告 |
| 結構健康 | 單獨執行既有 `verify.py output` 為 PASS，exit 0；無 dangling joints、反面 winding、ragged targets 或綁定撕裂等失敗 |
| 嚴格 baseline | `verify.py output source` 為 FAIL，exit 1；唯一失敗類型為 9 個 bone 的 rounded rest positions 約 `1e-6 m` 差異。既有 `rest_positions` 先 round 至小數 6 位，故此值高於未 round 的矩陣差；原 gate 未放寬 |
| 分件與索引 | Face／Body／Hair primitives 從 10／23／72 變為 9／14／11，nodes 與 accessors 也重排。未生成新 sidecar，舊 `.parts.json` 不可直接套用 |

MToon 正規化的原始參考為外掛 [vrm_diff.py](https://github.com/saturday06/VRM-Addon-for-Blender/blob/v4.7.1/src/io_scene_vrm/importer/vrm_diff.py)，本輪讀取的是已固定版本的下載包。Blender log 出現 `Duplicated bone` warnings；輸出名稱唯一性與 humanoid 名稱集合另已實際檢查，沒有僅憑 warning 宣告骨架重複或損壞。

檔案增加至約 2.47 倍有可確認的儲存原因：source 為 35 WebP＋8 PNG，output 為 37 PNG；image bytes 從 3,636,760 增至 12,941,852。Sparse accessors 從 138 變為 0，binary bytes 從 11,714,184 增至 29,512,060。官方 `image_to_image_bytes` 對非 JPEG 使用 PNG；`export_try_sparse_sk` 在本版的讀取路徑屬 VRM1 exporter，未作為 VRM0 解法。沒有自行改寫 exporter 或壓縮模型。[官方 image helper](https://github.com/saturday06/VRM-Addon-for-Blender/blob/v4.7.1/src/io_scene_vrm/external/io_scene_gltf2_support.py)

### Browser 與程式驗證

沿用 Phase 2 的 immediate MToon WebGL viewer，使用 agent-browser 在 localhost 檢查原始與 round-trip 兩模型。兩者各繪製 15 個 expression，共 30 次指定表情 draw；各保存 face neutral／blink／aa／Extra 與 front／quarter neutral，共 12 PNG。Root 實際查看成對畫面，主體造型與上述表情可見且一致；後續 `vrm.update` 的髮尾與胸前蝴蝶結位置有差異，未將其歸因為表情錯綁或宣告完整物理保真。

每個 viewer page 均可載入 10 支 VRMA，各僅執行兩次 `mixer.update(0.5)`。這是載入／步進 smoke test，沒有覆蓋完整 motion、穿模、長時間 spring、Warudo 或其他目標 consumer。headless 的完整互動／rAF 驗收仍未執行。

```text
修改前 Python suite：349 tests，10.308s，OK，exit 0
新增 driver tests：10 tests，先紅後綠，外部 bpy operators 使用 mock
修改後 Python suite：359 tests，9.530s，OK，exit 0
獨立 code-quality review：PASS
獨立 anti-pattern review：PASS
git diff --check：exit 0
```

兩個 review verdict 的 driver SHA 為 `e3369a77d5526aaaa8fe2ce4f413edb75c4e6b30e7240bdc3b5d25187f232a9e`，test SHA 為 `26607e7f356e7f5a90ba791eefc132fd8abbc7cc6e4e50af162c69d9d32a0f9c`。Root 再讀程式、核對 SHA、執行 full Python suite 及 browser 檢查。這輪沒有 TypeScript source 改動，未重跑 TypeScript suite，不沿用上一輪結果聲稱本輪全 stack 通過。

本輪 `do` skill 使 discovery、實作、code review 分工執行；代理額度耗盡後，由 root 完成唯讀語意驗證與報告。agent-browser skill 用於實際畫面證據。沒有 commit、push、上傳模型、付費 API 或原始模型替換。

### 產物與採用判斷

全部執行收據位於 `build/mika-reuse/r1-roundtrip-20260909-v1/`：`blender.log`、`model.roundtrip.json`、`driver-red.log`、`driver-green.log`、`python-final.log`、`verify-standalone.log`、`verify-strict.log`、`semantic.json`、`evidence/browser-automated/results.json` 與 12 PNG。`model.roundtrip.json` 的 `quality_validation: NOT_RUN` 是匯出當下狀態，後續驗證由本報告及各收據補足，未覆寫原始收據。

**決策：保留 Blender＋VRM Add-on 作為 authoring／automation 候選，暫不直接替換現有生產 pipeline。** 下一步優先驗證現成工具的部件保留／組裝工作流，並使用有 authoring source 與明確權利的 base 作 R2 三份需求比較。嚴格 baseline 精度、分件索引整合、完整 motion／spring 與 consumer 驗收分開處理。沒有恢復自研 bob、jaw 或 IK 調參，沒有由本次未通過嚴格 gate 推定現成工具不可用。

R0 已結案，R2 直接開始本機製作比較，不再要求權利原文或 source 補件。付費或外部上傳保持 `NOT_RUN`，尚未獲指定執行額度與資產範圍。這輪未量測每單人工成本、重試率或客戶接受度，點數價格與毛利仍未定案。
