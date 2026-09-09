# Mika Phase 2A：髮型與臉型模組 prototype

日期：2026-09-09。狀態：本輪實作與驗證完成，動作與商品品質未通過。[結果報告](../reports/mika-hair-face-prototypes-2026-09-09.md)。依據：[平台計畫 Phase 2](mika-platform-validation.md)。

本輪交付可執行的模組契約與可見幾何 prototype。只支援 hash 固定的 `mika-milfy-12`，用途為本機研發。完整 Phase 2 的十份原創參考、相似度、商用授權、OCM 與 Warudo 證據仍需另行完成。

後續順序已更新：依[現成方案評估](mika-existing-solutions-evaluation.md)先採用／整合成熟工具。本文件保留已完成的 prototype 設計與證據，暫停追加自研 bob、jaw 與動作調參，直到有具體現成方案不足的實測紀錄。

## Phase 0：已確認的 API 與限制

`garment.attach(doc, views, mesh_name, piece, material, part_name)` 可追加具備 `pos/nrm/uv/joints/weights/tris` 的 primitive。`humanoid.skin_of_mesh(doc, mesh_name)` 與 `humanoid.bones(doc)` 可取得目標 mesh 的 head slot。`glb.add_accessor`、`rebuild`、`save` 提供獨立 GLB 輸出。

Face 的十個 primitives 共用 vertex attributes 與 56 組 morph targets；寫入須處理共用 accessor。`proportion.py` 的 uniform scaling 只作 API 參考。原 `twintail.apply` 是既有雙馬尾專用 builder，不能作通用髮型交換器。`make.py` 有發布副作用，本輪不執行。原 spring CLI 要求至少一組 spring-driven hair，新 static-head bob 不符合此先決條件。

修改前基線：Python 282 項通過；TypeScript 508 項通過。原始 logs 保留於本次獨立暫存目錄，結果報告連結持久收據。

## Phase 1：契約與隔離組裝

實作版本化 catalog、recipe validator 與 assembly。輸入只接受已登記 base/module ID、版本及 finite 範圍參數，拒絕未知欄位、任意路徑、重複 slot、錯誤 base hash。模組記錄 attachment、geometry/morph policy、相容範圍、來源與 `research_only`；schema 通過不改變商用資格。

```text
recipe + pinned catalog
          |
schema / version / base hash
          |
face deformation -> hair replacement
          |
new VRM + manifest + provenance
          |
independent checks / render / expressions / motion
```

驗證：拒絕案例先紅後綠；相同 recipe 可重現；輸出目錄不得覆寫；原始模型與 Phase 1 收據不變。現有 `platform_validation.py` 的十份矩陣維持歷史狀態。

## Phase 2：兩個有界 geometry builders

| 模組 | 參數 | 幾何與表情策略 | 明確不涵蓋 |
|---|---|---|---|
| `face-jaw-v1` | `jaw_width`，0.88 至 1.12 | neutral 下臉局部寬度場與固定每頂點 affine map；POSITION morph 使用同一線性部分，normal endpoint 使用 inverse transpose | 新眼型、完整新五官、設計相似度 |
| `hair-bob-v1` | `length_scale`，0.9 至 1.1 | 新生成 cap、側後髮殼、瀏海，明確替換原髮型與依附配件；依 mesh skin 的 head slot rigid 綁定 | spring 髮絲物理、任意 base、任意臉型 |

臉型改動保留眼部以上及頸接縫，56 組 morph 的索引、binding 與 expression 語意不變。固定 neutral affine 場可以處理線性混合，並不承諾任意非線性雕塑的動畫重算。Normal morph 仍受既有 blend-and-normalize 模型限制，需讀回端點與混合表情。

驗證：control、各參數兩端、default hair 與一組 face/hair 組合；至少驗證有意變化、保留 payload、頂點／normal 有限、morph 端點與混合、rig/IBM 不變、新 hair 綁定與 silhouette。CPU 四視角及 MToon 各自留證據。face-only 仍重跑既有 spring clips；static bob 標為 spring 不適用，仍跑實際 motion sweep。

避免：不能以刪除馬尾稱為新 bob；不能以整頭縮放稱為下顎參數；不能把同 rig 當成服裝或臉部安全；不能把 schema 與結構檢查當成美術接受。

## Phase 3：結果與後續資格

結果分開記錄 contract、geometry、expression、render、motion、spring、visual review。失敗保留原始數據，不降低 gate 來取得通過。新 bob 只在輪廓、覆蓋及綁定讀回成功後標記 prototype 可用；`B08` 的下垂眼仍是缺口。

本輪只驗證受控 prototype。既有手入臉與穿模、完整互動預覽、獨立角色參考、外部軟體與商用交付須繼續驗收。帳務與點數後端保持後續階段。
