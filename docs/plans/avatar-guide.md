# Avatar Guide — 3D 對話嚮導

## 背景

chatbot 的 launcher 換成 Amika 式全身 3D avatar（mekahime.com 參考）。角色資產分兩階段：
現階段用 VRoid 官方樣本 AvatarSample_B；正式角色（自製 VRM）完成後只換
`public/avatar/` 的檔案與 `AvatarGuide.tsx` 的 `VRM_URL`，接線不動。

PoC 已在本機驗證（2026-08-13，scratchpad/poc.html）：15.4MB VRM、60fps@300×450（軟體渲染下限）、
spring bones、lookAt 轉頭、visemes aa/ih/ou/ee/oh、tint 變色全部成立。
第一輪以 dev flag 暗上線（f9caf83）並通過雙 reviewer 兩輪。

## 2026-08-13 production launch 修訂（使用者決定）

使用者指示：「現在就直接上 production，而且行動裝置也要可以看得到」。因此：

- **閘門改為全員開啟**：拿掉 `?avatar=1`／localStorage flag、≥880px、fine-pointer 三項檢查。
  保留兩項能力檢查：`prefers-reduced-motion: reduce` 關閉、WebGL2 探測（仍必須排最後，
  reduced-motion 訪客不付探測成本；探測後以 `WEBGL_lose_context` 立即釋放 context）。
- **AvatarSample_B.vrm 入 git 並上 production**。授權已核對（pixiv 官方 FAQ，2024-12-26 更新，
  https://vroid.pixiv.help/hc/en-us/articles/4402394424089 ）：AvatarSample 系列
  "can be used by anyone in any kind of activity, be it for-profit or not"、無署名義務；
  禁止的是「收費再散佈模型檔案本身」與改標 CC0。本站免費展示，合規。
- **行動版佈局**：launcher 態（面板收起）在所有viewport 都顯示 avatar；docked 面板開啟時，
  寬度 <880px 的裝置面板幾乎蓋滿螢幕，avatar 以 `display:none` 隱藏並停止渲染
  （wrapper 不 unmount，VRM 不重載）。fullscreen 同前，一律隱藏。
  placement 三態由純函式 `avatarPlacement(mode, wide)` 決定，有單元測試。
- **VRM 延後載入**：hero intro 進行中（`useHeroIntro().introRunning`）不掛載 avatar，
  intro 結束（或 400ms 內未開始，涵蓋 same-session skip 路徑）才載，避免 15MB 與
  intro 資產搶頻寬。latch 一旦開啟不再關閉。

## Acceptance criteria（launch 版）

1. 無任何 flag 的 production 訪客（桌機與行動裝置皆然），只要未開 reduced-motion 且
   WebGL2 可用：全身 3D avatar（無底座、無邊框）站在膠囊 launcher 正上方；膠囊按鈕
   保留，仍是唯一的可及性控制項（focus ring、aria-label、鍵盤路徑不變），點角色本身
   等同點膠囊。
2. 面板開啟時：寬 viewport（≥880px）avatar 站在面板左側，持續反映對話狀態
   （idle 左右看／listening 上下看／speaking visemes＋mars-orange tint，動作一律骨骼
   旋轉）；窄 viewport avatar 隱藏且渲染迴圈停止，收起面板後回到 launcher 上方。
3. reduced-motion 或無 WebGL2 的訪客：可觀測行為與 avatar 出現前完全相同（膠囊
   launcher；不建立任何額外 WebGL context——探測必須排在 reduced-motion 之後）。
4. 引擎 chunk（three-vrm＋引擎碼）與 VRM 檔維持 lazy，且在 hero intro 結束前不發出
   請求。
5. 背景音樂預設關閉（同批使用者指示）：hero 完全不再碰 ambient audio（Enter 不
   unlock 也不 unmute，intro 結束不自動開聲）；唯一開聲路徑是左下 MusicToggle FAB，
   FAB 在自己的 tap 手勢內先做 iOS unlock（muted play）再 unmute，因此在任何路由
   （含直落 /about 等無 hero 頁）第一下都能出聲。也因此不再有「解鎖後整場靜音串流
   4.7MB」的頻寬成本（code review round 1 #2/#5，一次修掉）。
6. 測試：mode 推導、閘門、placement 皆有單元測試；FaceHero 音訊測試改釘「intro 完成
   不呼叫 unmute」；全 suite 綠。

## Non-goals（本階段明確不做）

- 正式自製角色（換檔即換，不動接線）
- hologram shader、口型對真實語音
- `webglcontextlost` handler（正式角色落地那輪一併補；行動裝置背景分頁遺失 context
  時 canvas 空白、膠囊照常可用，可接受）
- 行動裝置 docked 面板旁的 avatar 佈局（螢幕放不下兩者並列，直接隱藏）

## 驗證計畫

- 單元：`avatarMode.test.ts`（推導／閘門／placement 全分支）＋ `FaceHero.test.tsx`
  音訊斷言翻新（TDD：先紅後綠）
- 視覺：`npm run preview` 桌機（1470 寬）與行動（390×844）截圖——launcher 態、
  開面板態（窄螢幕驗 avatar 隱藏）、音樂 FAB 預設 off
- 迴歸：`npx tsc --noEmit`、`npm test` 全綠、`npm run build` 過
- 雙 reviewer（code＋spec）審 diff 與本檔

## 已知限制（歷輪 review 記錄，接受不修的部分）

- 無 `webglcontextlost` handler（見 Non-goals）。
- launcher 態下 avatar wrapper 的透明像素會吃右下角點擊（ChatWidget 註解記載取捨）。
- GLTFLoader 因 hero 與 avatar 引擎共用而被 Rollup 抽成獨立 chunk：hero 多一個 HTTP
  request，總 bytes 不變（round 1 spec review 核可的例外）。
- 15.4MB VRM 是首訪成本（intro 後才載、瀏覽器快取吸收重訪）；正式角色階段再壓
  （meshopt／draco／貼圖降階）。
- `/avatar/*` 在 vercel.json 設了 `max-age=31536000, immutable`（讓「重訪走快取」
  成立）。**約束：換角色必須換檔名**（並改 `AvatarGuide.tsx` 的 `VRM_URL`），同名
  覆蓋會讓舊訪客拿快取裡的舊模型最長一年。
