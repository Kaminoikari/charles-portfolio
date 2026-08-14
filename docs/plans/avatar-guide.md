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
- **AvatarSample_B.vrm 入 git 並上 production**（2026-08-14 起 production 檔為
  WebP 重打包版 `AvatarSample_B_webp.vrm`，見 Batch 3-G；原檔已自 public/ 移除，
  git 歷史可回）。授權已核對（pixiv 官方 FAQ，2024-12-26 更新，
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
ContactFooter）。~~三句日文短句（三語系共用——聲音是角色身分，文字才在地化）：
greet ×2（點她／點泡泡時）、ack ×1（送出問題時）。播放全在 tap-completed 手勢內
（符合 CLAUDE.md iOS 硬規則，無需 unlock dance）~~（**2026-08-13 擴充（使用者指示
「20 句全部接上」）**：目錄擴為 **23 句／7 種 cue**（**2026-08-13 三修：加 intro cue 成 24 句／8 種**——
使用者選定句 A——ja／zh-TW 站：「はじめまして！あたしミカ！チャールズの作品集を案内する、エーアイアシスタントだよ。経歴でもプロジェクトでも、なんでも聞いてね！」；en 站（カタカナ英語，對應 "Hi, I'm Mika! Charles's AI portfolio guide. Ask me anything about his work!"）：「ハーイ、アイムミカ！チャールズの、エーアイポートフォリオガイド！アスクミーエニシング、アバウトヒズワーク！」——**每 tab-session 首次開面板**播
完整自介（sessionStorage `mikaIntroSpoken`＋in-memory ref 雙 latch。膠囊時期的開啟結構上
就走不到 speakOpenCue（膠囊鈕只呼叫 openPanel），「僅在真的播出時燒掉」是對
未來新呼叫點的第二道保險；之後開面板回到 greet 池）。日文版 1.1 倍速 8.95s、
カタカナ英語版 7.38s）——greet ×9（點她／點泡泡，含
2 句彩蛋）、ack ×5（打字送出）、fullscreen ×2（僅進入全螢幕，收合靜默）、
suggest ×2（點建議問題，取代該次的 ack）、bye ×2（僅明確的關閉鈕；Escape 關閉
刻意靜默）、done ×2（串流成功結束）、error ×1（串流失敗——含連線層失敗與 **SSE error
frame（HTTP 200＋status 停在 idle、訊息標 error）**，後者是 pipeline 生成失敗的
常態路徑，effect 以訊息的 error 旗標路由，不能只看 status）。前五種 cue 全在
tap/keypress 手勢內；**done／error 兩種在手勢外觸發（status 轉場 effect），iOS 會
拒絕 fresh play() 而靜默、桌機在首次互動後可播**——使用者知情接受的取捨。done／
error 另以 `open` 守門：串流中收面板就不出聲；且**讓行不搶話**（2026-08-13
使用者定案）：ack 還在播時 done／error 直接跳過不補播——快取快答曾在 ack 播到
0.118s 時被 done 掐斷成爆音（production 時間軸實測），跳過而非排隊是因為
答案早已上屏、ack 本身已涵蓋交付，且排隊起點在 ended 回呼（手勢外）iOS 也不會放行。iOS 拒播時 promise 被拒但**不觸發
任何 DOM 事件**，playVoiceCue 的 onBlocked 回呼負責把 voiceSpeaking 撥回 false，
否則 speaking 臉會卡死。~~日文三語系共用不變~~（**2026-08-13 再修訂（使用者試聽
多語 TTS 候選後否決：「只有原本的 voicevox 最好」，英文版改由 VOICEVOX 生成）**：
語音目錄改 locale 分流——en 語系用**同一把つむぎ聲音唸カタカナ英語**（23 句
`-en.m4a` 對檔，合成時片假名**連寫**避免空格停頓＋speedScale 1.1，時長 0.7–3.7s
與日文版同節奏）；ja／zh-TW 共用日文原 23 句（中文無法用假名近似，維持
「聲音是角色身分」）。聲音克隆到多語 TTS 為授權禁區（VOICEVOX 條款禁止拿生成
音訊訓練聲音模型），カタカナ英語是同聲跨語的唯一合法路徑）；~~`ambient.muted` 在**播放起點**
閘門全部語音~~（**2026-08-13 修訂**：使用者決定移除背景音樂 FAB，整個 ambient
系統（AudioProvider／audio-context／MusicToggle／ambient-noir.mp3）一併下線，
語音改為**無條件**播放；安全性由「只在手勢內出聲」承擔，膠囊代打狀態照舊
因 speakCue 的 avatarLoaded 前置檢查而完全不出聲）；~~播放中借用既有
speaking mode 的**亂數口型迴圈**讓嘴巴動（與 clip 同起訖，不做音訊分析——
Non-goals 的「口型對真實語音」維持不做）~~（**2026-08-14 修訂**：Batch 1 A 項
改為預生成 VOICEVOX mora 時間軸逐幀對嘴，見「表演力升級」節；「不做 runtime
音訊分析」這一半維持成立，亂數迴圈降為無 track 時的回退）；檔案在
`public/avatar/voice/*.m4a`（AAC 24kHz mono，8–23KB ×23 共約 300KB，吃 /avatar/*
immutable 快取，**改內容必須換檔名**）。合成管線：本機 colima＋voicevox_engine
Docker（speaker 8）→ wav → afconvert AAC（不帶 -b，帶了會報 '!dat' 錯）。

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
     （**2026-08-14 Batch 4 起 330px**＋原 padding＝366px 淨空；原為 212px，
     對應舊的 0.8 縮放 180×280 畫布）保留她的站位，滾到底的內容停在她頭上
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

## 2026-08-14 表演力升級（hololive 對標，使用者圈選 7 項）

使用者要求以百萬粉 VTuber 標準檢視後圈選執行；**明確不做**：客製正式模型
（Tier1-1，另案）與全文 TTS（Tier3-8，翻盤條件維持原記錄）。三批交付，每批
獨立 gate＋probe＋雙 reviewer。

**Batch 1（表演力核心）**
- A 口型同步：VOICEVOX audio_query 的 mora 時間軸（vowel＋consonant/vowel_length，
  除以各 clip 的 speedScale，加 prePhonemeLength 位移）預生成 `voiceVisemes.gen.ts`
  （48 clip 全表；生成腳本兼作全部台詞的 canonical 記錄）。引擎新增 speech track
  模式：**以 audio element 的 currentTime 逐幀取樣**（天然對時，不碰 Web Audio，
  iOS 規則無涉），5 viseme 通道各自 lerp；無 track（串流回答）回退亂數迴圈。
  AC：播任一語音時嘴型與母音逐幀一致；track 結束自動歸零。
- B 表情層：runtime 檢查 expressionManager 實有 preset（VRM0 樣本預期
  happy/angry/sad/relaxed，**無 surprised**），cue→emotion 映射（intro/greet/bye/
  done→happy、ack/suggest→relaxed 輕、error→sad、fullscreen→happy 輕），
  平滑進出＋hold 自動歸位；emotion 高權重時抑制眨眼、speech 中 emotion 上限 0.45
  防嘴型打架。缺 preset 時靜默跳過（換正式模型自動升級）。
- D 動作：呼吸（chest 正弦）＋重心慢移（hips＋spine 反向）＋眼球 saccade
  （0.7–2.5s 微跳，快切不 lerp）＋自然眨眼（1.5–6s、12% 雙連眨）＋程序式手勢庫
  wave（greet/intro）/bow（bye）/nod（ack/suggest/done 輕），additive 疊在既有姿勢上，
  播畢自動回位。

**Batch 1 驗證結果（2026-08-14）**：tsc 0、vitest 131/131（含 visemeTrack 4 條，
lockstep guard 經 mutation 驗證）、build 過。preview probe（`?mikadebug=1` 引擎
逐幀 state channel，斷言值為 scene graph 讀回非計算值 echo）：口型自我比對
greet 34 樣本＋bye 9 樣本 **0 mismatch**（含 ？/、停頓段與句尾歸零，speechT 與
audio currentTime 差 <16ms）；happy attack→hold→decay→清除全程觀測；wave 於
1.6s 準時結束且手臂回 rest pose（後續截圖無殘留）；bow 於 launcher 位觀測；
呼吸 chestX ±0.012 振盪、重心 hipsZ +0.020↔−0.020 慢擺（皆骨骼讀回值）。
截圖：b1-idle / b1-wave（右臂舉起）/ b1-bow。console 僅 preview 固有的
Vercel analytics 404。~~ack→nod、error→sad 走同一 CUE_PERFORMANCE 查表路徑，
未逐一重放（與 greet/bye 同機制）~~（R1 spec review 指出 nod 是獨立動畫分支，
豁免不成立；R2 已補觀測，下段）。

**R1 雙 review（皆 FAIL）→ 修正 → R2 補驗（2026-08-14）**：code MEDIUM——
emotion cap 為離散開關直接乘顯示值，短 clip 結束時臉部權重單幀 0.45→1.0 瞬跳、
切換 emotion 殘值繞過 attack；修為 emoShown 單一 smoothing pass（cap 只限制
target）＋emoFade crossfade。spec HIGH——本檔 Non-goals「口型對真實語音」與
語音節舊文字和 Batch 1 A 項矛盾；已劃線修訂（存續部分＝不做 runtime 音訊分析）。
R2 probe 補齊：ack→nod（headX 讀回擺幅 0.204）、串流亂數回退（47 樣本
speechT=−1 且 viseme 全五種）、done cue、error→sad（attack→cap 釘住→平滑衰減）、
cap 釋放上坡（bye clip 0.715s＜hold：0.449→…→1.0 約 500ms，55ms 樣本最大
Δ0.168，修正前為單幀跳變）、bow spineX 讀回峰值 0.319（包絡 0.32）→0。
眨眼抑制改用顯示值 emoShown；引擎檔頭 docblock 同步四層新行為。

**R2→R3（2026-08-14）**：R2 spec PASS；R2 code FAIL 新抓 MEDIUM——A→B→A 快速
切回的續接分支寫在 emoFade 覆寫之後成為死碼，切回頻道被硬熄再從 0 重 attack。
R3 重排 setEmotion（先消化切入情緒的 fade 續接，再推入切出情緒；emoW/emoShown
同設 resume 值）；Node 逐行等價 sim（reviewer 同法同情境）：切回首寫 0.482＝
fade 值、無硬歸零、每幀最大 Δ0.024；實機 probe 平滑無閃爍（50ms 級時序受
軟體渲染限制，判別以 sim 為準）。gate 全綠（vitest 131/131；中途一輪 7–9 紅
為機器負載 timeout，colima 停機後復綠，隔離跑亦綠）。

**Batch 2（畫面質感）**
- C 渲染：ACESFilmic tone mapping、DPR 上限 1.5→2、MToon 參數化 rim（mars orange，
  speaking 時增強；整身乘色 tint 減半讓 rim 當主角）、腳下接觸陰影（radial 貼圖
  平面）、低位 cyan 補光。禁 EffectComposer（透明背景＋bloom 的 alpha 破壞
  ＋chunk 成本，本輪明確不做，記為 Non-goal）。
- E 登場：onLoaded 首幀跑 materialize（cyan→本色色閃＋0.94→1 scale pop＋粒子
  上升束）；rail/launcher 轉場期間輕微步行 bob（時間盒，效果不到位就保留純滑動）。

**Batch 2 驗證結果（2026-08-14）**：C＋E materialize 實裝——ACESFilmic＋
exposure 1.25（截圖比對色彩不濁不暗）、DPR 上限 2（特寫線條明顯銳化）、MToon
parametricRim mars orange（rimR 讀回 idle 0.178→speaking 0.581，恰為公式值經
sRGB→linear；特寫可見外套/髮絲邊緣暖光）、接觸陰影 radial disc（shadowOp 0→1
隨 materialize 淡入）、低位 cyan 補光。materialize 首幀即 p=0（不閃全尺寸幀）：
scale 讀回 0.952→1.006（back-out overshoot）→1.0、粒子束截圖可見、1.1s 後資源
即時 dispose。EffectComposer 維持 Non-goal 未引入。**E 的 rail/launcher 轉場
walk bob 走預留出口不做**：placement 轉場是 500ms CSS bottom 滑動，rotation-only
bob 疊加讀感為抖動、位移式 bob 違反「動作一律骨骼旋轉」慣例，保留純滑動。

**Batch 3（互動＋資產）**
- F 互動：~~游標接近 wrapper 時眼神/頭部追游標（離開回 idle 掃視）~~
  （**2026-08-14 Batch 4 整組移除**，使用者指示不要跟著滑鼠走）；桌機 head 區
  hover 來回 ≥3 次觸發摸頭反應（happy＋wiggle，**不出聲**——點擊她=開面板的
  契約不可破壞，故不用 press-hold）；idle 25–45s 隨機視覺小動作（伸展），
  純視覺不出聲。（**2026-08-14 增訂，使用者指示**：小動作擴為 **11 種**——伸展、
  歪頭、快速張望、看手掌、重心大挪移、小彈跳、雙臂輕擺、撥髮、深呼吸、扭腰、
  看地板——頻率改**約 5 秒**起點間隔（timer 2.5–4s 均勻抽樣＋動作本身約 2s；2026-08-14 使用者再指示由約 10 秒加快），單次 re-roll 使連續重複機率降到約 1/121，
  interaction 後至少隔 4s。手勢系統同步改查表制（GESTURES 表），cue 手勢與
  idle 池共用同一播放器。）
- G 壓縮（時間盒 45 分鐘）：gltf-transform meshopt＋webp 試壓 AvatarSample_B
  （15.4MB 目標 ≤7MB），**必須驗證 VRM 擴充存活**（載入 probe：渲染＋表情＋
  spring bones 全通過才換檔）；失敗即記錄原因跳過，不硬上。

**Batch 3 驗證結果（2026-08-14）**：
F——游標追視（gaze blend 層：進 0.989/1.0、出衰減 0.001，headY 隨游標左右
翻號 −0.235/+0.124）**已於同日 Batch 4 整組移除，見下節**；摸頭（頭區來回
≥3 翻向、2s 窗、8s 冷卻：wiggle 8 樣本
＋happy＋headZ 0.08，純 hover 不動 click 契約）；idle 伸展（25–45s 未打擾
idle 觸發：65s 觀測窗抓到 stretch 8 樣本，雙臂外張＋後仰，播畢回 pin）。
第一輪 probe gaze/pat 全零是 probe 自己 querySelector 抓到 hero canvas
（頁面 9 個 canvas 的第一個），修 selector 後全過——實作未改。
G——gltf-transform optimize 確認**丟棄整個 VRM extension**（extensionsUsed
只剩 KHR_materials_unlit，輸出中無 "VRM" 字串），該路徑棄用；改走自製
`scripts/compress_vrm_webp.py`：只換 image payload 為 WebP（EXT_texture_webp，
three GLTFLoader 原生支援）＋重排 byteOffset，mesh/accessor/texture **索引
全不動**，VRM extension 引用保持有效。15.4MB→5.5MB（−64%，HTTP 實傳 1.9MB），
存活 gate 全過：expressions 15（=原檔）、spring joints 58、humanoid 完整、
180 材質貼圖全解、渲染像素 alpha 255、`aa` 表情驅動可見。腳本以 git 歷史
原檔重跑產出 byte-identical，已入 repo。換檔守則照舊：新內容新檔名
（AvatarSample_B_webp.vrm）＋VRM_URL 同步改，原檔自 public/ 移除（git 歷史
可回）。WebP 解碼支援由 WebGL2 閘門涵蓋（凡過閘門的瀏覽器世代皆支援 WebP）。

**驗證計畫**：逐批 tsc/vitest/build＋preview probe（口型：取樣 track 與
expressionManager 實際權重比對；表情/手勢：state 斷言＋多角度截圖；渲染：
截圖對比）＋production 驗證。

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
- hologram shader、~~口型對真實語音~~（**2026-08-14 修訂**：語音口型已由表演力
  升級 Batch 1 以**預生成 mora 時間軸**實現；本條的存續部分是「不做 runtime
  音訊分析」——引擎仍不碰 Web Audio／AnalyserNode，對「真實語音」（訪客麥克風
  或任意音訊）的口型分析維持不做）
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

## Batch 4——構圖改半身景＋聊天態放大＋移除游標追視（2026-08-14）

使用者回報「桌機與行動都看不清楚」。量測後確認主因是**構圖**：全身景下臉在
180×280 畫布上只有約 26.7px 高，launcher 態窄螢幕再乘 0.72 只剩 19.3px。
四案（相機拉近／只在聊天態放大／hover 才放大／整體放大）以真實頁面截圖比較後，
使用者選定相機拉近，並追加要求小 widget 與全螢幕態一併加強。

- **相機 3.9m → 2.3m（腰上景）**，`camera.position (0,1.27,2.3)`／`lookAt (0,1.17,0)`。
  臉高 ×1.70，**launcher 態的畫布尺寸與她在頁面上的佔位完全不變**（聊天開啟後的
  兩態另外加大，見下），視覺引導順序不受影響。距離比即倍率（3.926/2.304），
  與截圖目視一致。
- **手勢全數重驗**：GESTURES 中抬手最高的 wave／stretch／hairTouch 在新框內；
  bow 前傾使頭下移約畫面 13.5%，仍在框內。唯一語意減弱的是 `toeLook`
  （腳已在框外，讀作單純低頭），保留在 IDLE_ACTS。
- **底緣遮罩**：畫面在大腿中段截斷，canvas 加
  `mask-image: linear-gradient(to bottom, #000 84%, transparent)` 讓裁切溶入頁面，
  取代硬切。腳下的假接觸陰影自此在框外（grounding 是這案的已知取捨）。
- **聊天態畫布加大**：beside-panel 與 rail 由 180×280 改 220×342（**維持 180:280
  比例，否則構圖會被重新裁切**）。引擎每幀比對 canvas CSS 盒與 drawing buffer，
  不符即 `setSize`＋更新 aspect，因此是**原生解析度**而非 CSS 放大。
  **比對必須用 `Math.floor(css × pixelRatio)`**，那是 `setSize` 實際寫進
  `canvas.width` 的值（three r183 `WebGLRenderer.setSize`）；用 `Math.round`
  在小數 devicePixelRatio（Windows 125%／175%、瀏覽器縮放）下會與它差 1，
  條件恆真而每幀重配 drawing buffer——220×342 在 DPR 1.25／1.75 正好中招
  （spec review R1 抓到，已改）。
  rail 同時取消原本的 `scale-[0.8]`（全螢幕是最該看清楚她的地方），
  `left` 44px→24px 重新居中於 236px 側欄，spacer 212px→330px。
- **短視窗退回（e54f76c）**：rail 的加大畫布需要 rail 自身 640px 高門檻不保證的
  縱向空間——640 高時 330px spacer 吃掉側欄可視高度的 60%，trace 只剩約 196px，
  違反「管線不可被角色擋住」的舊約定。新增 `roomy`（`min-height: 760px`）：
  未達標時 rail 退回 180×280／`left-[44px]`／spacer 268px，trace 回到 258px。
  beside-panel 不設此門檻（她旁邊就是面板，沒有被擠壓的內容）。
- **移除游標追視**（使用者 mid-turn 指示：「動作不要跟著滑鼠 hover 走」）。
  驅動端與引擎端一併移除（`setGaze`／`clearGaze`／gazeBlend／idle gate 的
  `gazeBlend < 0.05` 條件／debug 欄位），**摸頭保留**——它需要在她頭上來回劃過，
  屬於主動互動，不是被動跟隨。她的視線現在只來自聊天狀態與 idle 動作。
  **附帶的行為變更（code review R1 指出）**：那道 idle gate 過去同時擋掉
  「游標靠近（舊半徑 420px）時不表演 idle 動作」，隨 gaze 一起沒了，所以現在
  訪客停在面板旁不打字時她照樣每 ~5s 表演。判定為可接受：要復原就得重新引入
  游標距離偵測，那與「不要跟著滑鼠」的意圖相衝。摸頭後不會緊接 idle act，
  因為 `setEmotion('happy', 0.9, 1.8)` 讓 `emoW ≥ 0.05` 持續約 2.6s，閘門仍關著。
- **hover／focus 光暈改為疊在她身上**：原本是腳下的 ground ring
  （`bottom-0 h-[20px] w-[130px]`），腰上景把地面移出畫面後它變成一顆懸在裙擺
  下方的青色圓盤。改為 `top-[24%] h-[54%] w-[150%]` 的柔光橢圓＋`mix-blend-screen`
  （加亮而非遮蔽，也就不依賴 stacking order）。它是這顆按鈕唯一的 focus 指示
  （`data-own-focus-ring` 停用了全域 outline），不能只是刪掉。
- **摸頭頭區隨構圖上移**：判定由畫布 0–32% 改 **12–40%**。以 VRM 骨架投影實測
  （code review R1 校正了我原本目測的 18–36%）：髮頂 12.5%、眼 31.2%、下巴約 38%、
  頸 42.8%、肩 44.9%——所以上界停在 40%，劃過鎖骨不算摸頭。比例式判定，
  聊天態換成 220×342 畫布時自動跟著走。
  （gaze 的 dy 錨點原本也要從 0.35 調到 0.30，隨游標追視整組移除而不存在了。）

**驗證（2026-08-14）**：三態幾何以 `getBoundingClientRect` 實測——launcher
180×280、beside-panel 與 rail 皆 CSS 220×342 且 drawing buffer 同值（證明 resize
生效）；rail canvas top = vh−366、trace 內容底 524 對 canvas 頂 534，不重疊。
900×640 的短視窗實測退回 180×280／left 44／spacer 268／trace 可見 258px。
floor 對 round 的差異以 `Math.floor` 對照 three 原始碼逐一驗算四組尺寸 × 五種
DPR：round 有 2 組不一致（220×342 @1.25、@1.75），floor 為 0 組。
三態＋行動 390×844 皆有截圖。摸頭做了對照組：清掉 8s 冷卻後，先在她頭頂上方
空白帶（畫布 5%）來回 8 次 gesture 全程 null，再在頭區（27%）同手法觸發 wiggle。
`npx tsc --noEmit` 乾淨、chat 測試 70 綠。
（本輪 Playwright 已知限制：viewport 截圖常在 software WebGL 下等不到穩定幀而
逾時，reload 後才有額度；幾何一律改以 evaluate 實測數據佐證。）

## 已知限制（歷輪 review 記錄，接受不修的部分）

- WebGL context 遺失後不嘗試恢復——膠囊回歸、avatar wrapper 卸載，直到重新整理
  （最小 handler 見 Non-goals；遺失瞬間若焦點在角色鈕上，交還膠囊）。
- launcher 態下 avatar wrapper 的透明像素會吃右下角點擊（ChatWidget 註解記載取捨）。
- GLTFLoader 因 hero 與 avatar 引擎共用而被 Rollup 抽成獨立 chunk：hero 多一個 HTTP
  request，總 bytes 不變（round 1 spec review 核可的例外）。
- ~~15.4MB VRM 是首訪成本（intro 後才載、瀏覽器快取吸收重訪）；正式角色階段再壓
  （meshopt／draco／貼圖降階）~~（**2026-08-14 修訂**：Batch 3-G 已壓——WebP
  重打包 5.5MB（HTTP 實傳約 1.9MB），延載與快取策略不變；mesh 端 meshopt/draco
  仍未做，留給正式角色階段）。
- `/avatar/*` 在 vercel.json 設了 `max-age=31536000, immutable`（讓「重訪走快取」
  成立）。**約束：換角色必須換檔名**（並改 `AvatarGuide.tsx` 的 `VRM_URL`），同名
  覆蓋會讓舊訪客拿快取裡的舊模型最長一年。
