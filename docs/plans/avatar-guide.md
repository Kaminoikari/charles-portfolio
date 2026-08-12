# Avatar Guide — 3D 對話嚮導（PoC 接線階段）

## 背景

chatbot 的 launcher 要換成 Amika 式全身 3D avatar（mekahime.com 參考）。角色資產分兩階段：
本階段用 VRoid 官方樣本 AvatarSample_B 把管線接通；正式角色（自製 VRM）完成後只換檔案。

PoC 已在本機驗證（2026-08-13，scratchpad/poc.html）：15.4MB VRM、60fps@300×450（軟體渲染下限）、
spring bones、lookAt 轉頭、visemes aa/ih/ou/ee/oh、tint 變色全部成立。

## Acceptance criteria

1. `?avatar=1`（或 `localStorage.avatarGuide='1'`）且桌機（≥880px、fine pointer）、
   `prefers-reduced-motion` 未開、WebGL2 可用時：全身 3D avatar（無底座、無邊框）
   站在膠囊 launcher 正上方；膠囊按鈕保留，仍是唯一的可及性控制項（focus ring、
   aria-label、鍵盤路徑不變），點角色本身等同點膠囊。
   （2026-08-13 修訂：原文寫「取代膠囊按鈕」。實作時改為並存，理由：把 canvas 包進
   button 會讓 340px 高的裝飾區都變成 focus 目標，且膠囊不動可讓既有 launcher 測試
   與行為零風險。Spec review round 1 抓到此漂移，據此回寫。）
2. 面板開啟時 avatar 站在面板左側，持續反映對話狀態：
   - `input === ''` 且非 streaming → idle：頭部左右緩慢轉動（look left/right）
   - `input !== ''`（含 IME 組字）且非 streaming → listening：頭部上下轉動（look up/down）
   - `status === 'streaming'` → speaking：visemes 不規則開合＋材質 tint 往 mars orange，
     結束後 lerp 回原色
   頭部動作一律是骨骼旋轉（轉頭看方向），不是整體位移。
3. flag off、行動裝置、reduced-motion、無 WebGL：可觀測行為與現在完全相同（膠囊
   launcher；不建立任何額外 WebGL context——WebGL 探測必須排在旗標檢查之後）。
   允許的例外（2026-08-13 修訂，spec review round 1 抓到）：GLTFLoader 因為 hero 與
   avatar 引擎共用而被 Rollup 抽成獨立 chunk，flag-off 訪客載 hero 時多一個 HTTP
   request，總 bytes 不變。
4. 引擎 chunk（three-vrm＋引擎碼）與 VRM 檔都是 lazy：flag off 的訪客不多載任何
   avatar 專屬 bytes（閘門與殼層本來就得住在主 bundle，不在此列）。
5. 測試：mode 推導與 flag 閘門有單元測試；既有 107 測試維持全綠。

## Non-goals（本階段明確不做）

- 正式角色（AvatarSample_B 僅 dev，**VRM 檔不入 git**：license 條文未逐條核對，
  `public/avatar/` 進 .gitignore；production flag off 所以不會 404 給真訪客）
- 行動版 3D、hologram shader、口型對真實語音、fullscreen 模式下的 avatar 佈局
- changelog entry（flag off，非 user-visible；正式角色上線時再寫）

## 驗證計畫

- 單元：`avatarMode.test.ts`（推導函式全分支）＋ gating 測試（jsdom mock matchMedia，
  含「WebGL 探測不得先於旗標檢查」的計數測試）
- 視覺：Playwright + `?avatar=1`，擷取 idle／listening／speaking 三態各兩幀存 scratch，
  多角度規則適用（狀態切換前後）；另補 launcher 態整頁截圖（avatar＋膠囊同框）
- 迴歸：`npm test` 全綠；`npm run build` 過；flag off 的 network 驗證跑在
  `npm run preview`（production build），比對 hero chunk 圖變化
- 雙 reviewer（code＋spec）審 diff 與本檔

## 已知限制（code review round 1 記錄，接受不修的部分）

- 無 `webglcontextlost` handler（faceHero 有）：dev flag 閘門限定桌機，正式角色落地
  前一併補。
- launcher 態下 avatar wrapper 的透明像素會吃右下角點擊（已在 ChatWidget 註解記載
  取捨理由）。
