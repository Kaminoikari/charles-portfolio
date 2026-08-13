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
  （wrapper 不 unmount，VRM 不重載）。fullscreen 同前，一律隱藏（此句後由
  launcher 取代節推翻：寬且高足夠的 fullscreen 改站 rail）。
  placement 三態由純函式 `avatarPlacement(mode, wide)` 決定，有單元測試
  （後續 launcher 取代節將其擴為四態，並加入第三參數 `tall`）。
- **VRM 延後載入**：hero intro 進行中（`useHeroIntro().introRunning`）不掛載 avatar，
  intro 結束（或 400ms 內未開始，涵蓋 same-session skip 路徑）才載，避免 15MB 與
  intro 資產搶頻寬。latch 一旦開啟不再關閉。

## 2026-08-13 launcher 取代＋fullscreen rail 修訂（使用者以 mockup 確認）

使用者選定：launcher 走 **C＋B 混合**（純角色為按鈕＋首次泡泡提示）、fullscreen rail
avatar **一起做**。mockup：scratchpad/mock-launcher-{A,B,C}.png、mock-fullscreen-rail.png。
使用者補充約束：avatar 背景必須與實際畫面背景一致（canvas alpha:true 透明背景已滿足，
mockup 的黑框是截圖合成痕跡）。

**語音（2026-08-13 使用者定案，路線 A）**：預錄 voice lines，**不做**即時 TTS 唸答案
（執行期成本＋濫用風險，翻盤條件：正式角色定案且願掛付費 API 預算）。聲源
**VOICEVOX:春日部つむぎ**（辣妹系聲線貼 Mika 造型；商用允許、需標注，credit 在
ContactFooter）。三句日文短句（三語系共用——聲音是角色身分，文字才在地化）：
greet ×2（點她／點泡泡時）、ack ×1（送出問題時）。播放全在 tap-completed 手勢內
（符合 CLAUDE.md iOS 硬規則，無需 unlock dance）；~~`ambient.muted` 在**播放起點**
閘門全部語音~~（**2026-08-13 修訂**：使用者決定移除背景音樂 FAB，整個 ambient
系統（AudioProvider／audio-context／MusicToggle／ambient-noir.mp3）一併下線，
語音改為**無條件**播放；安全性由「只在手勢內出聲」承擔，膠囊代打狀態照舊
因 speakCue 的 avatarLoaded 前置檢查而完全不出聲）；播放中借用既有
speaking mode 的**亂數口型迴圈**讓嘴巴動（與 clip 同起訖，不做音訊分析——
Non-goals 的「口型對真實語音」維持不做）；檔案在
`public/avatar/voice/*.m4a`（AAC 24kHz mono，13–19KB ×3，吃 /avatar/* immutable
快取，**改內容必須換檔名**）。合成管線：本機 colima＋voicevox_engine Docker（speaker 8）
→ wav → afconvert AAC。

**角色命名（2026-08-13 使用者定案）**：**Mika**（ミカ／中文稱 Mika 醬）。選名理由：
辣妹感貼合黑肉街頭系造型＋兩音拍三語系都好念；Amika 避開（與參考站 mekahime 撞名圈）、
Orihime 否決（神話人設＋BLEACH 撞名）。名字落地面：泡泡文案（i18n ×3）、FAQ cache
新條目 who-is-mika（「你是誰」類 paraphrase 自 who-is-charles 移轉）、portfolio map
SITE 節、generation persona（rag/nodes.ts）、changelog ×3、專案 memory。
aria-label 維持功能性描述（"Open the AI assistant"）不掛名字。

- **launcher 態（C＋B）**：avatar 載入完成後取代膠囊。wrapper 維持常駐 `<div>`
  （元素型別不變，React 才不會重掛 canvas，15MB VRM 只載一次）；互動由 wrapper 內
  `inset-0` 的真 `<button>`（canvas 的 sibling）承擔（沿用 `chat.openAriaLabel`，
  focus-visible/hover 顯示腳下青色光環，不出現大矩形 focus ring）。膠囊只在
  「她確定不會來」時**出現或回歸**：閘門關（reduced-motion／無 WebGL2）、VRM 載入
  失敗（onLoadFailed）、載入超過 12 秒耐心窗、WebGL context 被瀏覽器回收；
  **正常載入過程角落保持留空**，不先閃舊膠囊（使用者 2026-08-13 真機回報後定案）
  ——引擎為此提供 onLoaded／onContextLost／onLoadFailed 回報，且
  onLoaded 在**首幀真正畫出後**才發（避免 parse 完成到首幀之間「膠囊已卸、角色
  未畫」的空窗，弱 GPU 上該窗可達數百 ms）。交接方式：onLoaded 當下膠囊卸載、
  角色 wrapper 以 `transition-[bottom]` 滑入角落定位（非 crossfade）。
  首次泡泡：每 tab-session 一次（sessionStorage），顯示 8 秒淡出，文案入 i18n ×3；
  泡泡本身可點（同樣開面板——邀請點擊的元件自己必須可點）。
- **fullscreen rail**：`avatarPlacement` 增第四態 `rail`，門檻是 rail **自己的**
  斷點 `md`（≥768px，aside 的 max-md:hidden）＋高 ≥640px——她站在 rail 存在的
  任何地方，含 768–880px 平板視窗（post-launch 小修批次補上；原本以 wide=880
  代管、留過已知限制）。角色以 transform 縮至 rail 寬內站在 rail 底部，
  pointer-events-none、渲染恢復（active=true）。手機 fullscreen 無 rail 維持
  hidden；視窗高 <640px 時 `tall`（min-height:640px matchMedia 的 React 狀態）
  把 rail 降級為 hidden——wrapper 隱藏且 active=false 真正停掉渲染迴圈
  （code review round 1 後由 CSS 版改此作法，round 2 後收進純函式納入單元測試；
  `md`／`tall` 皆為 `avatarPlacement` 參數，全分支有測試）。
- **changelog**：更新今日剛發的 avatar 條目（「膠囊仍是真按鈕」的句子隨此輪失真，
  同日修訂不另開條目）。
- **實作過程中的使用者追加指令**（mid-turn，一併入約）：
  1. avatar 背景與畫面背景一致（canvas alpha:true 已滿足）。
  2. 泡泡內的小 tag（RAG · AI 副標）拿掉，只留一句話。
  3. **管線不可被角色擋住**：rail 內容改為狀態換場——trace 為空時顯示建議問題，
     trace 一有節點就整區讓位給管線（建議退場）；rail 末端以真 spacer 元素
     （212px＋原 padding＝248px 淨空）保留她的站位，滾到底的內容停在她頭上
     （不用 block-end padding：部分引擎不把它計入 overflow 容器的捲動範圍）。
  4. ~~移除預設問題「Why should a team hire him?」~~（使用者於 rail 換場定案後
     撤回此指令：換場後管線不再與建議並列，6 條無害，**保留** suggested6）。
  5. 泡泡右側要有類似箭頭的形狀，像是 avatar 講出來的話——以 before/after
     雙三角偽元素做講話尾巴（border 色墊底＋填色內縮 1px）。
  6. （出貨後真機回報）landing page 首開不得先出現舊膠囊 widget——載入中角落
     留空，膠囊只在閘門關／載入失敗／逾時／context 遺失時出現。
- **focus 矩形陷阱（實測發現）**：index.css 的無 layer `*:focus-visible` outline
  會以 cascade-layer 順序壓過任何 Tailwind utility；解法是全域規則挖
  `:not([data-own-focus-ring])` 豁免口，avatar 按鈕掛該屬性、以腳下光環為
  focus 指示。

## Acceptance criteria（2026-08-13，含 launcher 取代＋rail 修訂；第 1、2 條由該節改寫）

1. 無任何 flag 的 production 訪客（桌機與行動裝置皆然），只要未開 reduced-motion 且
   WebGL2 可用：VRM 載入完成後，全身 3D avatar（無底座、無邊框）**本人就是 launcher
   按鈕**（沿用 `chat.openAriaLabel`、鍵盤可達，focus/hover 指示為腳下青色光環，
   無全域矩形 focus ring）；膠囊按鈕只在閘門關、載入失敗、載入逾時（12s）或 WebGL
   context 遺失時作為 fallback（context 遺失後膠囊**回歸**，角落不得留下隱形按鈕）；
   正常載入過程角落留空，首開不閃舊膠囊。
2. 面板開啟時：docked＋寬 viewport（≥880px）avatar 站在面板左側（docked 只看寬度，
   矮視窗不降級——側欄空位與視窗高無關，單元測試明文釘住）；fullscreen 在 rail
   存在（≥768px）且高 ≥640px 時 avatar 縮小站在左側 rail 底部（管線一啟動建議即
   讓位，角色站位以 rail 末端**真 spacer 元素**保留，不被節點壓到）；docked＋窄，
   以及 fullscreen＋手機寬或矮 viewport，avatar 隱藏且渲染迴圈停止。全程持續反映對話狀態（idle 左右看／
   listening 上下看／speaking visemes＋mars-orange tint，動作一律骨骼旋轉），
   收起面板後回到 launcher 態。
3. reduced-motion 或無 WebGL2 的訪客：可觀測行為與 avatar 出現前完全相同（膠囊
   launcher；不建立任何額外 WebGL context——探測必須排在 reduced-motion 之後）。
4. 引擎 chunk（three-vrm＋引擎碼）與 VRM 檔維持 lazy，且在 hero intro 結束前不發出
   請求。
5. ~~背景音樂預設關閉（同批使用者指示）：hero 完全不再碰 ambient audio（Enter 不
   unlock 也不 unmute，intro 結束不自動開聲）；唯一開聲路徑是左下 MusicToggle FAB，
   FAB 在自己的 tap 手勢內先做 iOS unlock（muted play）再 unmute，因此在任何路由
   （含直落 /about 等無 hero 頁）第一下都能出聲。也因此不再有「解鎖後整場靜音串流
   4.7MB」的頻寬成本（code review round 1 #2/#5，一次修掉）。~~
   （**2026-08-13 修訂**：背景音樂整組移除——FAB、AudioProvider、音檔全下線，
   詳見上方語音節修訂。本條的現行殘餘只剩「hero 不碰任何 BGM、intro 結束不自動
   開聲」，這在系統移除後自然成立。）
6. 測試：mode 推導、閘門、placement 皆有單元測試；~~FaceHero 音訊測試改釘「intro 完成
   不呼叫 unmute」~~（2026-08-13 修訂：ambient 模組已刪，該批守衛失去標的一併移除）；
   全 suite 綠。

## Non-goals（本階段明確不做）

- 正式自製角色（換檔即換，不動接線）
- hologram shader、口型對真實語音
- `webglcontextlost` 後的 context **恢復**（正式角色落地那輪評估）。round 3–4 已補
  最小 handler：遺失即回報 onContextLost、膠囊回歸為 launcher、avatar wrapper
  **整個卸載**（死 canvas 在 Chrome 會合成為不透明白框，不能只留空）、引擎
  dispose 停掉渲染迴圈；同頁不重掛（剛證明 GPU 記憶體吃緊的裝置不該再吞 15MB），
  重新整理才重來。引擎端 contextLost 旗標同時擋住「遺失後 VRM 才解析完 →
  onLoaded 補發 → 膠囊被卸」的競態。
- 行動裝置 docked 面板旁的 avatar 佈局（螢幕放不下兩者並列，直接隱藏）

## 驗證計畫

- 單元：`avatarMode.test.ts`（推導／閘門／placement 全分支）＋ `FaceHero.test.tsx`
  音訊斷言翻新（TDD：先紅後綠）
- 視覺：`npm run preview` 桌機（1470 寬）與行動（390×844）截圖——launcher 態、
  開面板態（窄螢幕驗 avatar 隱藏）、~~音樂 FAB 預設 off~~（2026-08-13 修訂：FAB
  已移除，改驗「左下角無任何 fixed 按鈕」）
- 迴歸：`npx tsc --noEmit`、`npm test` 全綠、`npm run build` 過
- 雙 reviewer（code＋spec）審 diff 與本檔

## 已知限制（歷輪 review 記錄，接受不修的部分）

- WebGL context 遺失後不嘗試恢復——膠囊回歸、avatar wrapper 卸載，直到重新整理
  （最小 handler 見 Non-goals；遺失瞬間若焦點在角色鈕上，交還膠囊）。
- launcher 態下 avatar wrapper 的透明像素會吃右下角點擊（ChatWidget 註解記載取捨）。
- GLTFLoader 因 hero 與 avatar 引擎共用而被 Rollup 抽成獨立 chunk：hero 多一個 HTTP
  request，總 bytes 不變（round 1 spec review 核可的例外）。
- 15.4MB VRM 是首訪成本（intro 後才載、瀏覽器快取吸收重訪）；正式角色階段再壓
  （meshopt／draco／貼圖降階）。
- `/avatar/*` 在 vercel.json 設了 `max-age=31536000, immutable`（讓「重訪走快取」
  成立）。**約束：換角色必須換檔名**（並改 `AvatarGuide.tsx` 的 `VRM_URL`），同名
  覆蓋會讓舊訪客拿快取裡的舊模型最長一年。
