# Plan: Hero 3D 頭像新增雷射命中點特效與捲動離場塵埃解體

## Acceptance criteria
1. **雷射命中特效**：按住臉部發射雷射時，游標瞄準點（aim plane 交點）出現命中特效：命中光暈＋向外飛散的火花粒子。放開後光束熄滅，殘餘火花在短時間內自然衰減，不殘留。
2. **捲動解體**：從 hero 往下捲動時，頭像隨捲動進度逐步解體：頂點亮度由上而下（帶隨機抖動）熄滅、解體前緣有 cyan 光緣、塵埃場同步增強且偏向從解體前緣剝離。捲回頂部時頭像完整重組。
3. **Reduced motion 尊重**：prefers-reduced-motion 使用者不套用捲動解體（頭像保持完整）。
4. **無回歸**：intro、sweep 變身、雷射本體、既有 95 tests 全綠；`npm run build` 通過；載入頁面 console 無錯誤。

## Verification plan
- C1（gating）：Playwright 載入首頁 → Enter → intro 結束後，滑鼠移到臉上按住 ≥1.6s → 截圖確認命中點有光暈與火花；放開 ≥1s 後截圖確認火花消散。
- C2（gating）：Playwright 捲動至 hero 高度的 ~30%、~60% 各截圖，確認解體漸進；捲回 0 截圖確認重組。純函數 `scrollDissolveTarget`（捲動→進度映射）與 `dissolveAliveEdge`（頂點存活/光緣）以 vitest 單元測試鎖定（先紅後綠）。
- C3（gating）：單元測試鎖定 reducedMotion 時 dissolve 目標恆為 0（或等價的純函數行為）。
- C4（gating）：`npm test` 全綠、`npm run build` 通過；Playwright console 無 page error。

## Non-goals
- 點擊漣漪、閒置生命感（掃視／呼吸）、jaw rig 對嘴、sweep 週期隨機化（前次討論的第 3、4、5 項與附帶建議）。
- 雷射命中對 DOM 內容（headline 等）的灼燒效果。
- 任何音效新增或變更。
- changelog 條目（依專案規則需使用者決定）。

## Assumed scope
- `src/components/hero/faceHero.ts`（主要）
- 新測試檔 `src/components/hero/dissolve.test.ts`
- 不動 `FaceHero.tsx`（scroll 監聽放引擎內，隨 dispose 拆除）

## Task checklist
- [x] 失敗測試：scrollDissolveTarget / dissolveAliveEdge（先紅：9 failed；修正輪再加 3 條，先紅有存檔）
- [x] 實作雷射命中特效（glow sprite ＋ spark 粒子池）
- [x] 實作捲動解體（CPU 層 ＋ halftone/eye/occluder shader ＋ 塵埃增強）
- [x] 單元測試轉綠（12）、全 suite 綠（107）、build 綠
- [x] Playwright 實機驗證＋多狀態截圖，修正輪重拍（見 scratchpad/verify-evidence.md）
- [x] 雙 reviewer：round 1 各 FAIL（3 confirmed ＋ 2 效率 ＋ spec 缺件）→ 修正 → round 2 雙 PASS

## Deviations
- 第一輪 C3 的「reducedMotion 單元測試」未交付（僅 Playwright 截圖驗證），且本節誤登「無」。第二輪已補：`effectiveDissolveTarget` 純函數成為 frame loop 的實際決策點，並由 dissolve.test.ts 鎖定（reduced=true 恆 0）。
- 第一輪 dissolve.test.ts 的紅燈輸出未留存原始擷取（僅文字宣稱，9 failed 由實作者親見）。第二輪起紅綠輸出均存檔於 session scratchpad（fix-round-red.txt / fix-round-green.txt）。
- Review 第一輪三項 confirmed findings 已修：dissolveEdge 全解體殘光（加 0.92→1.0 收尾閘門）、occluder 頭形塵埃空洞（改 per-fragment discard shader）、按住開火捲動不停火（frame loop 強制 stopFiring）。效率建議 E1（spark 池閒置 early-out）、E2（scroll listener 改旗標＋每幀單次 rect 讀取）已採納；E3（逐頂點 dissolve 計算再省一次 key/exp）婉拒：4400 次/幀為 µs 級，不值得犧牲單一定義來源。
