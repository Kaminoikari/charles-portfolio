# Mika R2 本機製作比較

日期：2026-09-09。階段：R2 本機 authoring／匯出／重新載入試驗完成；三份變體已有成品。Studio 路徑可沿用，完整交付品質與單位經濟保持 `PENDING`。

## 本輪結論

使用 VRoid Studio 2.14.0 的內建 preset，已實作臉型、bob、服裝、眼鏡及保留臉部 identity 的換裝。沒有新增自研幾何、IK 或手調 slider。XWear 已完成匯出、重新組裝及 VRM1 匯出，但自動刪除遮蔽網格後有頸部缺口，該組裝成品不合格。

採用判斷：先以 Studio native authoring 建立經人工驗收的 source／模組庫。平台保留需求、recipe、版本、預覽與驗收工作；GUI 操作成功尚未證明可作全自動 SaaS worker。XWear 保留為候選，需先解決具體遮蔽缺陷。

## 執行依據

既有 Mika 的 pixiv／MellowHeart 素材與平台使用授權為 **已驗證（使用者確認先前已完成驗證）**。使用者要求不再詢問，直接進入 R2。沒有權利補件待辦；authoring source 缺少時直接以成熟工具建立新的本機 fixture。

沿用 [reuse-first 計畫](../plans/mika-existing-solutions-evaluation.md)。不呼叫付費 API、不上傳模型、不修改現有 Mika 成品、不恢復自研 bob／jaw／IK。

## 固定的三份比較案例

| 案例 | 製作需求 | 現成工具路徑 | 實際輸出狀態 |
|---|---|---|---|
| R2-A | 新建動漫女性 fixture，使用 bob preset 與 round-face preset | 頭髮套組第 4 列右側 bob；臉部套組第 4 列右側大眼 preset，位置見截圖；未手調參數 | `.vroid`／VRM0 已輸出，渲染／表情 probe 通過；圓臉主觀符合度未作客戶驗收 |
| R2-B | 相同 fixture 替換上衣／長褲，加入眼鏡配件 | 從 A 換紅 hoodie 套組，再選深色長褲，新增「眼鏡（有厚度）」 | `.vroid`／VRM0／XWear 已輸出；另有 control＋XWear 的 `.xroid`／VRM1，遮蔽品質 FAIL |
| R2-C | 相同臉部 identity，替換另一組髮型／服裝，保留表情 | 從 B 換頭髮套組第 2 列左側長髮、白針織上衣＋格紋長裙套組，保留眼鏡與臉部 preset | `.vroid`／VRM0 已輸出，重新開啟 source 成功；臉部／morph 保留已量測 |

新 Studio fixture 與 Mika prototype 的比較回答相同能力類型的製作方式及可編輯性，不能將不同基底當作同 identity 的 A/B 成品。實際製作鏈為 `CONTROL -> A -> B -> C`；A 更換臉部，B／C 的 identity 對照是 A。CONTROL 保留新建女性預設臉型、白 T-shirt、黑短褲，沒有完整髮型。

## 保存產物

根目錄：`build/mika-reuse/r2-studio-20260909-v2/`。共 11 個模型／工程／模組檔；`artifacts.json` 記錄每檔 bytes 與完整 SHA-256。

| 模型 | source bytes | VRM bytes | VRM／humanoid／表情 | triangles |
|---|---:|---:|---|---:|
| CONTROL | 4,619,811 | 12,187,996 | 0／54／14 | 19,527 |
| R2-A | 5,022,149 | 15,150,644 | 0／54／14 | 41,368 |
| R2-B | 6,426,170 | 16,971,028 | 0／54／14 | 44,879 |
| R2-C | 9,247,121 | 20,357,716 | 0／54／14 | 53,565 |

另有 `R2-B-outfit.xwear`（5,651,658 bytes）、`R2-B-dressup.xroid`（12,120,783 bytes）、`R2-B-dressup.vrm`（14,728,684 bytes）。Dress-up 匯出畫面只提供 VRM1，本輪結果為 53 humanoid、18 expressions，required bones 無缺漏。相較 VRM0 control，thumb 改用 VRM1 命名，`upperChest` 未保留；不把格式合法等同骨架完全相同。

四份 native VRM 的 metadata title 均保留 `Mika R2 CONTROL`，author 為 `Mika`。檔案身分依檔名與 hash 識別，未把 title 當唯一鍵；正式交付前需建立 metadata 命名規格。本輪使用限制保留 exporter 預設，沒有上傳／販售檔案。

## 實測與未通過項目

1. **保存與可編輯性**：已從原生「打開」重新載入 `CONTROL.vroid`；從最近使用模型重新載入 `R2-C.vroid`，臉部 preset、髮型、服裝及眼鏡可見。A／B 已保存，未另逐一執行 source reopen。直接透過 macOS `open -a` 開啟 `.vroid` 被 app 拒絕，改用 Studio 原生入口成功。
2. **WebGL／MToon**：四份 native VRM 各 14 expressions，包含 blink 與五母音，每份載入 10 clips 並各走兩個 0.5 秒 mixer step，全部 `ok=true`。另以無 motion、spring reset＋120 frames 的靜態 viewer 重跑 14 expressions 與 front／quarter，各保存 16 PNG。兩組共 128 PNG，結果在 `evidence/browser/results.json`、`evidence/static/results.json`。已直接檢視 A neutral、B blink、C aa／全身等代表畫面；其餘截圖已產生，未宣稱全部人工美術驗收。背面與完整消費端驗收尚未執行。
3. **臉部保留**：`structure.json` 使用既有 `glb`／`humanoid` reader。A／B／C 的 face topology 對應可比較，57 face targets；扣除整體位移並擬合單一 scale 後，B 最大 position residual `3.4191e-7 m`、C `3.0175e-7 m`，scale 與 1 相差不到 `6e-7`。兩者 morph 最大差異均 `2.3842e-7 m`。原始 face positions 並非 byte-identical：B 整體 Y 位移約 31.13 mm，C 約 0.307 mm。這支持臉部形狀保留，未承諾全角色 rest pose 不動。
4. **十支 motion 掃描**：呼叫既有 `measure(path, null)`，避免套用 Mika family 的 pan／clearance。四份均跑完，報告在各 `*-motion-report.json`。報表 total 為 23／23／24／23，其中各 18 項是沒有 family crown clearance，不能解讀成 23 個穿模。其餘量測超出為 5／5／6／5：scratchHead 超出 column 上緣約 36.7／36.7／67.9／37.1 mm；B 的 stretch 另超出 waist-up 上緣 22.6 mm；idleLoop／dance 有既有 clip 的結尾位移，dance 的手臉橢球值約 0.406、結尾手腕過高。這是現有構圖／retarget 指標，未證明每項都是可見碰撞；完整衣物／spring 時序尚未驗收。
5. **既有 verify gate**：四份 `verify.py` 均 exit 1，沒有放寬 assertion。required bones、winding、sparse bounds、morph counts、dangling joints 等檢查未報錯。失敗包含 Studio 彩色 outline 與省略 `_RimColor` 不符合 Mika 站台規則，以及彎臂 edge growth：CONTROL／A 約 38 mm、B 約 47 mm、C 約 27 mm，高於既有 25 mm 門檻。保留 FAIL；這些結果不直接等同 VRM 格式毀損或所有衣物實際撕裂。
6. **XWear 往返**：批次匯出 B 的穿著物，在 dress-up 加入 `CONTROL.vrm` 與 XWear，選「保持服裝的形狀」，使用工具內建自動刪除遮蔽網格。原本 T-shirt／短褲的交疊大幅消除；自動刪除後頸部出現不規則缺口，原生畫面與匯出 VRM1 的 MToon 均可見（`evidence/dressup-browser-face.png`）。僅修改隔離組裝的可恢復 mesh mask，原始 CONTROL 檔沒有改寫。保存 `.xroid` 和 VRM1 作失敗樣本，停止美化為成功。

動作 probe 後立即截圖曾出現髮束上翹。相同檔案在無 motion、reset spring 後恢復正常靜態形狀，證明初次截圖含 probe 狀態影響；舊證據保留，靜態比較採 `evidence/static/`。完整動態品質仍需獨立測試。

本輪 359 Python tests 在開始前實跑通過（34.643 秒），之後未修改 production Python／TypeScript。原始 Mika VRM SHA-256 仍為 `f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6`，sidecar 仍為 `24246ee7f22a13965baf8f7da56cadaceb06ef01b1345f1f01a31a33a660acba`。

## 工時與採用邊界

檔案時間可確認 14:52 保存 control、14:59／15:03／15:06 保存 A／B／C，15:19 完成 dress-up VRM。過程混有 GUI automation 除錯、輸入法切換、截圖與測試，沒有逐步人工計時，不能將檔案時間差直接當每單成本。GUI 不穩定時已改用原生選單與 save panel，不反向工程 `.vroid` 或使用未公開 API。

下一輪採用既有 Studio source 與 XWear 功能處理可重現的缺口：先測 authoring 階段乾淨的換裝 base／內建 mesh restore，驗證頸部遮蔽；再建立新 base 專用構圖及可用 motion 清單。完整 spring、背面、Warudo／其他目標 consumer、跨體型、設計圖符合度與重複工時測量仍為 `PENDING`。OCM／付費生成比較 `NOT_RUN`，不影響已完成的本機 authoring 證據。

## v1 歷史入口檢查（已由 v2 產物進度取代）

- 已啟動 `/Applications/VRoidStudio.app`，版本 2.14.0。
- Native editor 的實際畫面可見髮型 preset、臉部、體型、服裝、飾品、匯出入口。截圖在 `build/mika-reuse/r2-studio-20260909-v1/evidence/`。
- 畫面當時有未命名且未儲存的角色，沒有將其當作本輪新建模型。先嘗試官方 Save As 快捷鍵以保留副本，沒有覆寫既有檔案。
- Save As 過程中觀察到「保存」視窗，之後 Studio process 退出。已檢查 scoped DiagnosticReports／Logs 檔名，未找到 VRoid crash report；退出原因未定，不能宣稱崩潰或使用者關閉。
- 沒有取得可確認的 `.vroid`／VRM 產物；R2 成品、工時與品質尚未驗證。沒有把 GUI 入口成功當作三份案例通過。

官方參考：[Custom Items](https://vroid.pixiv.help/hc/en-us/articles/900005583186-How-to-Use-Custom-Items)、[鍵盤快捷鍵](https://vroid.pixiv.help/hc/en-us/articles/900006050066-I-want-to-learn-more-about-keyboard-shortcuts-in-VRoid-Studio-for-Windows-and-macOS)、[XRoid 保存內容](https://vroid.pixiv.help/hc/en-us/articles/38729963613849-What-is-XRoid)。Shortcut 文件確認 macOS Save As 為 Cmd＋Shift＋S；沒有使用非公開 authoring API。

## 接續位置

Control、三個案例及 XWear 往返產物均已建立。接續從上方品質缺口開始，不重做 R0 或重新詢問授權。R1 的薄 driver、模型與測試結果未更動。

本輪使用 do 的階段拆分與實測記錄原則，以及 agent-browser 的獨立本機瀏覽器驗證。分工代理仍處於額度錯誤，因此沒有新增代理驗證或宣稱雙 review。新增 GUI／probe helper 只在 ignored build 目錄，沒有 production code 改動。
