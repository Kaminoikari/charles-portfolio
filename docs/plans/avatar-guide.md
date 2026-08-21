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
**VOICEVOX:春日部つむぎ**（辣妹系聲線貼 Mika 造型；商用允許、需標注。~~credit 在
ContactFooter~~ **2026-08-21 查證：ContactFooter 沒有這行；全站唯一出現這個名字的地
方是 2026-08-13 那則 changelog 的內文，見本檔「三語配音」一節末**）。~~三句日文短句（三語系共用——聲音是角色身分，文字才在地化）：
greet ×2（點她／點泡泡時）、ack ×1（送出問題時）。播放全在 tap-completed 手勢內
（符合 CLAUDE.md iOS 硬規則，無需 unlock dance）~~（**2026-08-13 擴充（使用者指示
「20 句全部接上」）**：目錄擴為 **23 句／7 種 cue**（**2026-08-13 三修：加 intro cue 成 24 句／8 種**（**2026-08-20 四修：加 giggle cue 成 27 句／9 種**，笑聲池見下方 F 互動節（**2026-08-21 五修：加 huff cue 成 28 句／10 種**，三語各一句，見本檔「點頭也算拍頭」一節））——
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
拒絕 fresh play() 而靜默、桌機在首次互動後可播**——使用者知情接受的取捨
（**2026-08-20 增訂**：~~giggle 是第三個手勢外的 cue，它騎在 pointermove 上。
代價與 done／error 相同，但摸頭本來就以 `(pointer: fine)` 擋掉觸控裝置，
所以這條只落在桌機~~（**2026-08-21 修訂：兩個 claim 都不再成立**。拍頭現在有兩條
路徑：**點擊**走 `pointerup`，那是 tap-completed 手勢，不背 done／error 那份成本；
**撫摸**才走 `pointermove`，只有它掛在 `(pointer: fine)` 後面。而且點擊路徑不分指標
型別，`avatarPlacement` 的 `md`(≥768) 與 `wide`(≥880) 都只看寬度，所以 iPad 與橫置
手機拍得到——「只落在桌機」是錯的。`avatarVoice.ts` 開頭的播放規則區塊寫的是修訂後
的版本），而桌機在訪客有過任何一次互動後就放行。讓行規則現在是雙向的：
串流結束前 0.9 秒內摸頭，笑聲會把該次 done 吃掉，她不會說「こんな感じ！どう？」。
接受，理由與 ack 吃掉 done 相同：答案早已上屏，而摸頭是訪客當下的動作，
比收尾台詞更該被回應）。done／
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
音訊訓練聲音模型），カタカナ英語是同聲跨語的唯一合法路徑）**（2026-08-21 再修訂：這一整段作廢，`-en.m4a` 已下線，zh-TW 也有了自己的錄音，見本檔「三語配音」一節）**；~~`ambient.muted` 在**播放起點**
閘門全部語音~~（**2026-08-13 修訂**：使用者決定移除背景音樂 FAB，整個 ambient
系統（AudioProvider／audio-context／MusicToggle／ambient-noir.mp3）一併下線，
語音改為**無條件**播放；安全性由「只在手勢內出聲」承擔，膠囊代打狀態照舊
因 speakCue 的 avatarLoaded 前置檢查而完全不出聲）；~~播放中借用既有
speaking mode 的**亂數口型迴圈**讓嘴巴動（與 clip 同起訖，不做音訊分析——
Non-goals 的「口型對真實語音」維持不做）~~（**2026-08-14 修訂**：Batch 1 A 項
改為預生成 VOICEVOX mora 時間軸逐幀對嘴，見「表演力升級」節；「不做 runtime
音訊分析」這一半維持成立，亂數迴圈降為無 track 時的回退）；檔案在
`public/avatar/voice/*.m4a`（AAC 24kHz mono，單檔 7–41KB，最大的是自介 intro-1；2026-08-20 起是
24 句日文＋24 句 `-en`＋3 段三語系共用的笑聲＝51 檔約 716KB，吃 /avatar/*
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
  ~~首次泡泡：每 tab-session 一次（sessionStorage），顯示 8 秒淡出~~，文案入 i18n ×3；
  （**2026-08-14 修訂**：改為 5s 顯示／5s 靜默的無限循環，sessionStorage 旗標移除，
  且開過面板後收起仍會繼續循環，見下節）
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
  hover 來回 ≥3 次觸發摸頭反應（happy＋wiggle，~~**不出聲**~~——點擊她=開面板的
  契約不可破壞，故不用 press-hold）（**2026-08-20 修訂，使用者指示**：摸頭改為
  **會笑**。新增 `giggle` cue，三段 VOICEVOX 純笑聲（えへへ 系，0.67–0.86s；
  另有「んふふ…えへへ」「わっ、えへへ…」兩段合成後經使用者試聽否決，已刪），
  由 AvatarGuide 的 `onPat('happy')` 回報、ChatWidget 的 `speakCue('giggle')` 播放。「不說台詞」那一半維持成立：她只笑，不講話；也因為
  笑聲無語言，三段檔三語系**共用**，不做 `-en` 對檔（`LOCALE_NEUTRAL_CUES`）。
  表情與 wiggle 仍由 AvatarGuide 自己演（`PAT_EMOTION` 是兩處共用的常數），
  所以聲音被跳過或被瀏覽器拒播時，摸頭照樣讀得出來；giggle 與 done／error
  同一條讓行規則，她正在講話時不搶話。~~連拍第三次的 angry 維持**不出聲**：
  怒臉配笑聲會互相抵銷~~（**2026-08-21 再修訂，見本檔「點頭也算拍頭」一節**））；
  idle 25–45s 隨機視覺小動作（伸展），
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
- ~~**手勢全數重驗**：GESTURES 中抬手最高的 wave／stretch／hairTouch 在新框內~~；
  bow 前傾使頭下移約畫面 13.5%，仍在框內。唯一語意減弱的是 `toeLook`
  （腳已在框外，讀作單純低頭），保留在 IDLE_ACTS。
  （**2026-08-14 同日推翻**：那次重驗只看了垂直方向。wave 與 stretch 在水平方向
  各被切掉——stretch 在 launcher 盒少 13.7px、在兩個聊天盒少 16.7px，wave 則是
  9.6px 與 11.6px（13.7／16.7 是同一個手勢在兩種擺放下的值，不是兩個手勢）——
  正是使用者當天回報的現象，負向對照已重現。這條記錄
  保留原文，因為它就是讓 bug 通過的那個保證。見下方「手勢被畫布左右裁掉」。）
- **底緣遮罩**：畫面在大腿中段截斷，canvas 加
  `mask-image: linear-gradient(to bottom, #000 84%, transparent)` 讓裁切溶入頁面，
  取代硬切。腳下的假接觸陰影自此在框外（grounding 是這案的已知取捨）。
- **聊天態畫布加大**：beside-panel 與 rail 由 180×280 改 220×342（當時**維持 180:280
  比例**，因為那時寬高一起決定構圖）。（**2026-08-14 同日修訂**：手勢露出批次把
  寬度改由手臂長度決定，三態成為 245×280／300×342／300×400，比例不再守恆——
  高度與 distance 才是決定她大小的兩個數，見下節。）引擎每幀比對 canvas CSS 盒與 drawing buffer，
  不符即 `setSize`＋更新 aspect，因此是**原生解析度**而非 CSS 放大。
  **比對必須用 `Math.floor(css × pixelRatio)`**，那是 `setSize` 實際寫進
  `canvas.width` 的值（three r183 `WebGLRenderer.setSize`）；用 `Math.round`
  在小數 devicePixelRatio（Windows 125%／175%、瀏覽器縮放）下會與它差 1，
  條件恆真而每幀重配 drawing buffer——220×342 在 DPR 1.25／1.75 正好中招
  （spec review R1 抓到，已改）。
  rail 同時取消原本的 `scale-[0.8]`（全螢幕是最該看清楚她的地方），
  `left` 44px→24px 重新居中於 236px 側欄，spacer 212px→330px。
  （**2026-08-14 手勢露出批次修訂**：畫布加寬到 300px 後 `left` 改為 −16px，
  仍居中於同一個 236px 側欄，spacer 不變。）
- **rail 再往上＋露到膝蓋（2026-08-14 使用者回饋「位置有點太下面、想多露腿部」）**：
  單純平移不會露出更多腿（切點在她身上的位置不變），要**畫布加高＋相機同步後拉**。
  rail 畫布 342→**400px**，相機 2.3→**2.69m**、lookAt 1.17→**1.076**。
  不變量：`2·distance·tan(fov/2) / 畫布高` ＝ 每像素世界尺寸，兩態同為 **3.229 mm/px**，
  所以她**在螢幕上一樣大**；上緣維持 y=1.722（頭頂留白不變），下緣 0.618→**0.430**
  （大腿中段→膝蓋以下）。畫布往上長 58px ⇒ 她整體上移 58px。spacer 330→**388**。
  常數收斂在 `avatarMode.ts`（`AVATAR_FRAMING_*`／`AVATAR_CANVAS_*`／
  `avatarMetresPerPixel`／`avatarViewSpan`），引擎與 React 殼層都讀同一份；
  引擎新增 `setFraming(distance, lookAtY)`。**三條單元測試釘住不變量**
  （同尺寸／多出的視野在下方不在頭上／launcher 構圖不裁到頭），
  兩個 mutation 各自驗過會轉紅（拿掉 dolly → 2 紅；不下移 lookAt → 1 紅）。
- **嘴型可讀性（同輪回饋「嘴型有點看不太清楚」）**：不是解析度問題（DPR 已 cap 2、
  buffer 與 CSS 盒同尺寸），是**嘴巴的像素尺寸**——臉在螢幕上約 55px 高，
  嘴巴開合只有數 px。viseme 目標權重 0.85→**1.0**（隨機口型 0.65→0.8）、
  lerp 22→**28/s**：一個 60ms 的 mora 只有 3–4 幀，22 只走完約 70%、28 約 85%，
  再高會讀成連續碎抖。**根本解**（未做，需使用者決定）是說話時把相機推近，
  `setFraming` 已具備這個能力。
- **短視窗退回（e54f76c）**：rail 的加大畫布需要 rail 自身 640px 高門檻不保證的
  縱向空間——640 高時 330px spacer 吃掉側欄可視高度的 60%，trace 只剩約 196px，
  違反「管線不可被角色擋住」的舊約定。新增 `roomy`（`min-height: 760px`）：
  未達標時 rail 退回 launcher 的盒子／spacer 268px，trace 回到 258px
  （當時是 180×280／`left` 44px，2026-08-14 手勢露出批次改為 245×280／`left-[12px]`）。
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
  聊天態換成更大的畫布時自動跟著走。
  （gaze 的 dy 錨點原本也要從 0.35 調到 0.30，隨游標追視整組移除而不存在了。）
- **講完話的角度跳接（使用者回報「非常突兀」）**：root cause 是三個模式各自一組
  正弦、共用同一個 `t`、直接寫進骨骼，中間沒有任何插值。idle 的 yaw 掃 ±0.42、
  speaking 只有 ±0.07，所以串流結束那一幀最壞會跳 0.487rad（27.9°），平均
  0.265rad（15.2°），到 head bone 是單幀 18.1°，眼睛注視點橫移 2.85 world unit。
  這是既有缺陷，2.3m 構圖把她放大 1.7× 之後才變得刺眼。修法是把三組正弦抽成
  `avatarMode.ts` 的 `headAim(mode, t)`，引擎改用一階低通（`HEAD_AIM_SMOOTHING = 6`，
  `k = min(1, dt·6)`）追過去：模式切換約 0.4s 收斂成一次轉頭，代價是 idle 掃視
  本身損失約 2% 振幅與 11° 相位，在這個尺寸看不出來。下游（head 0.65、neck、
  spine、eyeTarget）全部沿用濾波後的值，不需改動。
- **邀請泡泡改成循環**（使用者指示：每 5 秒顯示一次、每次約 5 秒）。原本是
  sessionStorage `avatarBubbleSeen` 把持的「每個 tab session 只出現一次、8 秒」，
  現在改為遞迴 `setTimeout` 的 5s 顯示／500ms 淡出（timer 給 600ms）／4.4s 靜默，
  週期 10s。使用者原話「每 5 秒顯示一次、每次約 5 秒」照字面取（週期 5s＋時長 5s）
  會變成永不消失，所以取「顯示 5s、靜默 5s」這個唯一自洽的讀法。
  sessionStorage 旗標一併移除：留著它會讓重新整理後一次都不顯示，與「反覆邀請」
  的意圖相反。~~另外自行加了「開過面板就不再循環」的 `bubbleDoneRef`~~
  （**同日使用者推翻**：「開過面板後泡泡循環還是要可以繼續正常顯示」，該 ref 整組
  移除）。現在循環只綁在收合狀態上，沒有任何「看過了」的閂：面板開著時隱藏
  （泡泡本來就只在 launcher 態渲染），收起面板就重新開始。

**驗證（2026-08-14，構圖批次當時）**：三態幾何以 `getBoundingClientRect` 實測——
~~launcher 180×280、beside-panel 220×342、rail 220×400~~（**同日手勢露出批次改為
245×280／300×342／300×400，見該節的驗證段**），drawing buffer 皆等於 CSS 盒
（證明 resize 生效）；rail canvas top = vh−424、spacer 388、left 24，canvas 底
在 aside 內。**未驗**：rail 新構圖的實際畫面沒截到——1 fps 環境下
`browser_take_screenshot` 連三種做法（reload／關閉重開分頁／凍結 rAF）都逾時，
見 [[project_playwright_starved_transitions]]。尺寸不變與露出範圍改由單元測試
與幾何數據保證。（此前 220×342 態的畫面截圖存在，構圖差異僅在下緣。）
900×640 的短視窗實測退回 ~~180×280／left 44~~／spacer 268／trace 可見 258px
（退回的盒子同日改為 245×280／left 12；spacer 與 trace 不變）。
floor 對 round 的差異以 `Math.floor` 對照 three 原始碼逐一驗算四組尺寸 × 五種
DPR：round 有 2 組不一致（220×342 @1.25、@1.75），floor 為 0 組。
三態＋行動 390×844 皆有截圖。摸頭做了對照組：清掉 8s 冷卻後，先在她頭頂上方
空白帶（畫布 5%）來回 8 次 gesture 全程 null，再在頭區（27%）同手法觸發 wiggle。
`npx tsc --noEmit` 乾淨、chat 測試 70 綠。
（本輪 Playwright 已知限制：viewport 截圖常在 software WebGL 下等不到穩定幀而
逾時，reload 後才有額度；幾何一律改以 evaluate 實測數據佐證。）

- **手勢被畫布左右裁掉**（使用者回報「某些動作的手勢會超出框」）。root cause 是
  畫布寬度是照「她要多大」定的，沒人算過她的手伸多遠：三態的水平半視野都是
  0.355m，而 `stretch` 的指尖到 0.409m、`wave` 到 0.393m（依 VRM 骨架算：肩
  離中線 0.081、upperArm 0.233、lowerArm 加手 0.333，套上手勢表的旋轉）。
  修法利用透視相機的 fov 是**垂直**的這件事：加寬畫布只增加水平視野，她的大小
  由 `2·distance·tan(fov/2)/canvasHeight` 決定，完全不受寬度影響。三態改為
  245×280／300×342／300×400（高度與 framing 全部不動），半視野變成 0.484m，
  比最寬手勢多 18% 餘裕，足夠吸收手本身的厚度與 spring bone 甩出的頭髮。
  多出來的區域是透明的，不佔頁面任何可見空間。連帶處置三處：
  launcher 的點擊鈕從 `inset-0` 改 `left-[13%] right-[13%]`，維持原本約 180px
  的點擊寬度（否則加寬等於把右下角更多透明像素變成按鈕）；泡泡的 `right` 由
  150px 改 183px，讓尾巴繼續指著她的頭；rail 由 `left` 24px 改 `-left-4`
  （＝16−(300−236)/2），讓 300px 畫布仍以 236px 欄為中心，溢出的透明區平均分在
  兩側。畫布尺寸原本是 ChatWidget 裡的 Tailwind 字面量、與 `AVATAR_CANVAS_*`
  常數各寫一份且無人綁定（改一邊另一邊靜默失效），這輪收斂成
  `avatarSizeClass()` 並加測試把字串解析回來與常數比對。
  **雙 reviewer 抓到的連帶漏網（本輪一併修）**：
  1. 摸頭判定的水平帶原本是 `r.width * 0.2`，寬度一放寬它就跟著長（±54px→
     ±73.5px，約她頭寬的 3.7 倍），旁邊空白處來回劃也算摸頭。兩軸改為以
     **高度**為基準（`r.height * 0.19`，自中線起算）：高度才是決定她大小的維度，
     寬度只是手臂餘裕。
  2. launcher 的 wrapper 原本沒有 `pointer-events-none`，所以整個畫布盒都在吃
     右下角的點擊，加寬等於把死區從 180px 擴到 245px。改為 wrapper 不收事件、
     按鈕與泡泡各自 `pointer-events-auto`（泡泡若漏掉就會變成不可點，這是加上
     wrapper 那道 none 之後才出現的新耦合）。
  3. `AVATAR_WIDEST_GESTURE_REACH` 原本是從 scratchpad 腳本手抄的 0.409，與引擎的
     手勢表無任何綁定。改為 `armReach()` 從骨長與 `ARM_REST_UPPER_Z`／
     `STRETCH_ARM_FLARE` 算出，引擎的 ARM_PINS 與 stretch 改用同一組常數：把
     stretch 的 0.35 調大到 0.6，畫布寬度測試會紅。
  4. `AvatarGuide.tsx` 的 `sizeClass` 預設值是第三份手寫尺寸，改為必填。
  **知情接受的兩點**：rail 態下 stretch 的指尖會越過 236px 側欄約 10px（左側落在
  遮罩上、右側落在對話欄上）。canvas 透明且 `pointer-events-none`，不擋任何互動，
  而且「手可以越過欄界」正是使用者要的「看不出框」。另外 launcher 的按鈕只覆蓋
  中央 ±90.7px，而 stretch 指尖到 ±105px，所以**點在她伸出的手上不會開面板**——
  那正是本輪要露出的像素，與「透明邊緣不該是按鈕」互為代價。

**驗證（頭部平滑與泡泡循環，2026-08-14）**：泡泡在瀏覽器實測通過——每 200ms
取樣 opacity 共 43 秒，顯示起點（淡入）落在 5.4／15.4／25.4／35.4s，淡出起點
落在 10.4／20.4／30.4／40.4s，DOM 在 11／21／31／41s 卸載，週期 10.0s。
每輪可見 5.6s（淡入 0.6＋全亮 4.4＋淡出 0.6）、DOM 缺席 4.4s，與規格相符。
頭部平滑只有單元測試證據（`avatarMode.test.ts` 三條：原始不連續 > 0.45rad、
收斂時間落在 0.2–0.8s、idle 掃視峰值仍 > 0.4；mutation 把 6 改成 90 紅 1 條、
改成 1.2 紅 2 條）。**未在瀏覽器實測**，而且在這個環境原理上測不出來：
software WebGL 只有 1 fps，`k = min(1, dt·6)` 在 dt≈1s 時等於 1，濾波器退化成
直接賦值，濾波前後的畫面完全相同。引擎端的接線靠 `tsc` 與讀碼確認。
（code review R1 指出原本的三條測試在測試檔裡重寫了濾波器，等於只釘住常數，
把引擎那兩行刪掉照樣全綠。已把濾波抽成 `avatarMode.ts` 的 `stepHeadAim()`，
引擎與測試呼叫同一支；mutation 讓它改為 `return target` 會紅。
  全部 mutation 的實際輸出存在 `scratchpad/mutations.txt`：改 90 紅 1 條、改 1.2
  紅 2 條、`AVATAR_CANVAS_LAUNCHER.w` 改回 180 紅 3 條、點擊 inset class 脫鉤紅 1 條。）

**驗證（手勢露出，2026-08-14）**：瀏覽器實測通過，證據在
`scratchpad/round6-browser.txt`。做法是每幀 `readPixels` 取 alpha>20 的
bounding box，並用這輪新增的 debug handle（`?mikadebug=1` 下的
`window.__mikaHandle`，沿用既有 `__mikaState` 的閘門）直接觸發 `stretch`，
因為 1 fps 下 idle act 的計時器要等上百秒、也抓不到峰值幀。
`__mikaState.luaZ` 確認峰值真的到了 0.800（＝1.15−0.35）。
- 新尺寸 245×280：峰值輪廓寬 209.5px，左右各餘 17.5px，**兩側皆未裁切**；
  實測最遠伸展 0.414m，與骨架推算的 0.409m 差 1.2%（手的厚度）。
- **負向對照**：同一幀把 CSS 寬度強制改回 180px（引擎每幀把 drawing buffer 與
  camera aspect 對齊 CSS 盒，buffer 隨即變成 360＝DPR 2，證明對齊有跑），
  同樣的 stretch 峰值下輪廓寬 179.5px＝整個畫布，左右間隙皆 0，**兩側都裁**。
  這同時證明使用者的觀察為真，以及新尺寸解掉了它。
- 三態尺寸與位置：launcher 245×280（點擊區 181px）、beside-panel 300×342
  （`right-[436px]`，canvas x=[728,1028]）、rail 300×400（`-left-4`，
  canvas x=[−16,284]，中心 134 對欄中心 135，差 1px）；三者 drawing buffer
  皆等於 CSS 盒 ×2。

## Batch 5——docked 對齊面板高度＋fullscreen 改右側全高欄（2026-08-14）

使用者兩點回饋：docked 態 Mika 應與 chat widget 同高等比放大；fullscreen 態應佔滿
螢幕高度。第二點以真實頁面 mockup（只改瀏覽器 CSS，不動原始碼）比較後定案。

- **docked 對齊面板**：canvas 從 300×342 改為面板自己的 `min(560px,80vh)`，寬度
  依同比例走 `min(491px,70.14vh)`。構圖不變，等於同一個腰上景攤在 1.64 倍的像素上。
  面板高度移進 `CHAT_PANEL_HEIGHT_CLASS`，由 ChatWidget 消費，ChatWidget 測試渲染
  真面板讀回該 class，兩者不能各改各的。
  已知取捨：視窗寬 880–933px 時她的左側手勢邊界超出畫面（880px 實測 −53px，
  純邊界只有 38px，stretch 少約 15px 指尖）；fixed 元素向左溢出不產生捲軸
  （`scrollWidth` 實測未變）。

- **fullscreen 改 `column`，`rail` 站位整個移除**。mockup 比較三案後使用者選定
  「不開剛性第三欄、改給文字欄右內距」：她的身體只佔 canvas 約 80% 寬，其餘是透明
  手勢邊界，讓邊界疊在留白上，文字欄比開剛性欄多 119px。
  - **構圖重新對到她身上**（使用者要求頭頂再高一些）：`AVATAR_FRAMING_COLUMN`
    = distance 2.441／lookAtY 1.016，上緣 1.602（髮頂 1.582 之上約 40px 螢幕餘裕，
    已接近髮飾極限），下緣維持膝蓋 0.43。視野高度 1.291→1.172m，同畫布放大 10%。
    比例因此從 rail 的 0.75 變成 0.826——手臂空間是固定的 0.484m，攤在較少的
    垂直公尺上就佔更大寬度比。
  - **不設窄視窗退路**（使用者明確要求 1200px 以下不退回）。`avatarColumnBox(vw,vh)`
    以「面板本體高」與「寬度預算」取小，維持比例縮放，所以窄視窗得到的是小一號的
    她而不是別的站位。高度對寬度連續，測試以「相鄰 1px 的高度差 < 2px」釘住，
    任何斷點式退路都是幾百 px 的跳躍，會紅。
  - `tall`／`roomy` 兩個高度閘門與 rail 底部的 spacer 一併移除：它們只為了擋
    「她站在 rail 腳下壓到 trace」，站位換了就沒有碰撞對象。副作用是 vh<640 的
    fullscreen 從「完全隱藏」變成「縮小顯示」，這是改善。
  - `CHAT_COLUMN_MIN_TRANSCRIPT` 是**文字**寬下限而非欄位寬：第一版忘了扣 `px-6`
    的 48px，常數寫 360 但實際只給 312，瀏覽器量測時才發現。測試 helper 已改為
    重現 ChatWidget 的實際版面（element = min(欄寬, 760+reserve) − padding − reserve）。

- **建議問題永駐**：舊規則是 trace 一有節點就整區讓位，理由是她站在 rail 腳下會擋住
  最後幾站。她離開 rail 後該理由消失，改為常駐並在 streaming 時 disabled，長 trace
  由 rail 既有的 `overflow-y-auto` 捲動。

## Batch 6——八個可讀的手勢取代 stretch，加上手指關節（2026-08-14）

使用者看不懂 idle 裡的 `stretch`（雙臂外張＋後仰在半身景裡讀起來不像動作），
給了九張參考圖要求換成更可愛的動作。idle 池從 11 個變成 18 個。

- **新增八個手勢**：`doublePeace`／`singlePeace`／`cheekPoke`／`salute`／
  `pointAtYou`／`handsBehindHead`／`handOnHip`／`hipWave`。`stretch` 與
  `STRETCH_ARM_FLARE` 一併移除。
- **手指關節**：模型帶完整 VRM0 的 30 根手指骨。新增 `HandPose`（curl 走 z、
  spread 走 proximal 的 y）與 `HAND_PEACE`／`HAND_POINT`／`HAND_HIP` 等姿勢。
  V 字必須張開（`spread` ±0.55）：兩根併攏的手指在她實際被看到的尺寸下會糊成
  一根粗手指，比 0.3 小的張開量在 807px 畫布上看不出來。`pinArms` 因此要一併
  歸零 30 根手指骨，它是唯一會還原手勢的地方，漏列的骨頭會留在原地到下次重整。
- **`fore` 的方向與直覺相反**：前臂的角度是**接續**上臂的旋轉，所以正值是把手
  往下、往身體內側折。八個手勢的第一版全部寫成正值，結果兩隻手都停在腰上。
  所有舉手的姿勢現在都是負值。校準基準（讀 `rightHand` 的世界座標）：
  頭骨 1.320、臉頰約 1.38、眉 1.45、髮頂 1.582、腰約 0.90。
- **`pointAtYou` 的寬度是實測翻案的**：原本給上臂 0.55 把手臂側舉，再用
  `forward` 旋轉補向前。x 軸旋轉不會改變 x 分量，所以側舉的部分整個留著，
  指尖實測跑到 0.604，超出畫布半寬 0.484。改成 z 角維持 rest、整個動作交給
  x 軸前擺，指尖落在身前 0.528、側向只有 0.212。
  連帶把 `poseReach()` 裡的 `cos(forward)` 前縮項刪掉：它把這個姿勢的寬度低估
  了三倍，是它讓越界的版本通過測試的。mutation 驗證：把 0.55 那版寫回去，
  「keeps every arm gesture inside the canvas」轉紅（`fits: false`）。
- **量測工具的陷阱（已移除，重開時要記得）**：用 `window.__mikaPose` 把手勢
  凍在 envelope 中點時，`pinArms` 永遠不會執行（它只在 `p >= 1` 觸發），所以
  只擺單邊的手勢會留著上一個姿勢的另一邊，連 `rotation.x` 也留著。前兩輪的
  contact sheet 有三格是這樣被污染的，看起來像姿勢寫錯。凍結前要自己先呼叫
  `pinArms`。production 沒有這個問題：idle 挑選只在 `!gesture` 時進行，
  `playGesture` 也會先 pin。
- 驗證：18 個 idle act 在真實 idle 下實測 56 秒觸發 5 次（含 `cheekPoke`、
  `handsBehindHead`），每次結束後上臂都回到 1.150／−1.150 的 pin 值。

### 同批的第二輪（使用者回報三點）

- **手勢會不會被畫布切掉：不會，第一次的量測是錯的。** 用 `p.project(camera)`
  把手臂與 30 根手指骨投影成 NDC 來量，第一版探針在入場動畫（`matz < 2`）還沒
  結束時就讀值，六個手勢報 `|ndc.x| > 1`。等 `matz === 2` 再量，18 個手勢全部
  在框內，最寬的 `hipWave` 只到 0.715（launcher 176×202、aspect 0.875）。
  **教訓：任何讀 avatar 骨骼座標的量測都要先等 `matz === 2`。**
- **姿勢要停得住**：包絡從 `sin(p·π)` 改成梯形。`gestureEnvelope(t, dur, hold)`
  收在 avatarMode（可單元測試），`dur` 是動作時間、前後各半當升降，`hold` 是停
  在滿值的秒數。八個具名姿勢 `hold: 3.5`；ambient 的小拍子 `hold` 缺省為 0，
  此時梯形與原本的 sin 完全等價（測試逐點比對），所以它們的調校沒有被動到。
  實測 `doublePeace` 在滿值停 3660ms 後回到 pin。
- **`armSwing` 與 `deepBreath` 移除**：使用者看不出它們在做什麼。量下來確實
  如此——armSwing 的峰值是雙臂在**深度**方向各 0.12rad，正面鏡頭幾乎零位移；
  deepBreath 只有左上臂 0.08rad 加胸口 0.05rad，手部在 491px 畫布上移動約 11px。
  兩者在峰值截圖與待機姿勢分不出來。idle 池 18 → 16。
  收斂用的判準寫進引擎檔頭：**一個 idle act 必須讓觀看者說得出它是什麼**。
- **待機不再左右擺頭**（使用者：「平常待機的時候可以不用一直左右擺頭」）。
  `headAim('idle')` 的 yaw 從 5.2 秒週期 ±0.42（頭骨 ±15.6°，來回不停）改成
  19 秒週期 ±0.08（頭骨 ±3°）。這也把「東張西望」還給 `glance`：原本那個 idle
  act 的效果被底層的持續掃視蓋掉了。上面第 247 行那條 2026-08-13 的驗收條件
  （「idle 左右看」）由這一條取代。
  連帶三條測試改寫：mode 切換的落差從 0.487 降到約 0.15（濾波仍有必要，改釘
  0.13–0.2 的區間）；「掃視不被濾平」改成**比值** ≥ 0.95，免得它其實是在測振幅；
  新增一條直接釘住使用者要的行為（idle yaw 峰值 < 0.12 且 > 0.02，不擺頭也不凍住）。
  mutation：把舊的 5.2s／±0.42 寫回去，後兩條同時轉紅。
- **開啟聊天不再揮手**（使用者：「每次開啟小 chat widget 會舉起來左邊手臂的手勢
  要移除」，看到的是她的右臂）。`wave` 只有 `intro` 與 `greet` 兩個 cue 在用，
  兩個都在開啟時觸發，所以整個手勢連同 peaks 條目一起移除，`greet`／`intro`
  保留表情與語音。`AVATAR_WIDEST_GESTURE_REACH` 因此從 wave 的 0.393 降到
  `hairTouch` 的 0.314；**畫布尺寸不跟著縮**，餘裕只會變大。
  changelog 兩處「打招呼時揮手」的敘述已同步修正（三語）。

### 第三輪——抬手「過程」被裁（使用者：「是手臂往上擺動作的過程中手臂會有部分被截掉」）

**這是真的被裁，而且前兩次都量錯地方。** 寬度檢查一直只看 `ARM_GESTURE_PEAKS`
的**終點**。手臂從垂下抬到折起的路徑上，前臂會先在額狀面裡掃過水平，那一瞬間
指尖到中線 0.622，畫布半寬只有 0.484。兩個端點反而都很窄（rest 0.233、姿勢本身
0.31），所以峰值檢查看不到。

- **檢查改成走完整段路徑**：`armAt(pose, env)` 是引擎與檢查共用的姿態來源，
  `poseReach()` 沿 env 取 96 個樣本取最大。引擎不可能走到檢查沒看過的形狀。
- **修法是加寬畫布**（使用者指定）。中途試過「轉場中把肩膀往前轉」把路徑壓窄，
  使用者看過後否決：**正常人類肩膀做不出那個動作**，已還原。`armAt` 現在只有
  upper／fore 兩個關節的線性內插，並有測試釘住「只有這兩個關節」，避免下次遇到
  寬度問題又去凹她的骨架。
- **新尺寸**：launcher 245×280 → **342×280**，docked 491×560 → **684×560**
  （`w-[min(684px,97.71vh)]`），column aspect `0.484/0.586` → `0.6745/0.586`。
  三者的世界半寬都落在 0.674，對路徑最大值 0.622 有 1.08 倍餘裕。
  該係數過去是 1.15 的猜測，現在有量測：實際渲染輪廓（含袖子、頭髮）最寬 0.636、
  骨架模型 0.622，差 2.3%。整體門檻其實大幅提高（0.314×1.15 → 0.622×1.08）。
- **連帶必須改的三處**：
  1. `AVATAR_COLUMN_BODY_FRACTION` 0.8 → **0.5741**。畫布變寬但她的身體沒變，
     reserve = w × fraction 這個乘積刻意保持不變（0.6608），所以 transcript 的
     可用寬度、高度連續性、floor 全部不受影響。
  2. `AVATAR_LAUNCHER_HIT_INSET_PCT` 13 → **24**。點擊區是寬度的百分比，畫布加寬
     而不改它等於把手勢邊界又變成可點。改後點擊寬度 178px（原 181px）。
  3. **docked 態新增等比縮小** `besidePanelScale(vw)`。684px 畫布在窄桌機視窗會
     跑出左邊界：900px 時有 226px 在畫面外、其中 26px 是她的肩膀。改成連續縮放
     （沿用 column 那次「不要斷點退路」的決定），1120px 以上維持原尺寸。
- **viewport 寬度改用 `clientWidth`**：`innerWidth` 含捲軸寬，而 fixed 定位是對
  版面視窗，兩者差 6px 就讓畫布掛在左邊界外 6px。
- **像素驗證**（讀 canvas alpha，不受背後星空干擾）：
  launcher 342×280 跑 90 秒真實 idle、2700 幀，最窄邊距 10px、貼邊幀數 0；
  docked 在版面寬 894 跑 60 秒、1801 幀，畫布落在 x 0..458，她離螢幕左緣最近 13px、
  畫布內最窄邊距 20px。加寬前同樣的量測，doublePeace 在 t=0.22s 有 58 個像素貼邊。
- **加寬的兩個視覺副作用**（使用者回報）：她的身體在畫布正中，畫布加寬 97px 就把
  她往左推了 48.5px（手機縮放後約 35px），看起來「站得比較裡面」；同時泡泡壓到她。
  - launcher 的 wrapper 從 `right-6` 改成 `right-0`。手機上她的中心回到離右緣
    121px（加寬前約 112px），而畫布右緣貼齊螢幕右緣後，右側手勢仍完全在畫面內
    （45 秒實測最右 376，螢幕 387）。
  - 泡泡 `right-[183px]` → **`right-[256px]`**，並把數值搬進 avatarMode 的
    `AVATAR_BUBBLE_RIGHT_PX`／`AVATAR_BUBBLE_RIGHT_CLASS`，由 ChatWidget 消費。
    這個偏移**已經被畫布加寬撞歪兩次**（245px 那次改過一次），所以補了一條測試
    把它綁在 `AVATAR_CANVAS_LAUNCHER.w` 與 `AVATAR_LAUNCHER_BODY_FRACTION`
    （0.415，launcher 畫布上她連頭髮的實測寬度佔比）上：清空間必須 > 10px。
    mutation：改回 183 該測試轉紅。實測清空間 12px（手機 387px 寬）。
- **手指彎曲方向全部反了**（使用者手機特寫回報「不像人類的手的角度」）。
  `setHand` 的 curl 沿用了手臂 pin 的鏡像符號（左 +z），但手指收向掌心是
  **相反的**鏡像（左 −z、右 +z），所以每根「彎起來」的手指其實都往手背反折。
  正面遠看幾乎看不出來（反折的手指跟收進掌心的一樣會消失），特寫才露餡。
  兩個連帶修正：拇指的彎曲軸改成 **y**（拇指在 rest pose 就轉了 ~90°，用 z 彎
  會橫著戳出去變雞爪），且 y 折疊的鏡像與四指**相反**（拇指 `+mirror`、四指
  `-mirror`；兩邊各自用錯號都會讓那隻拇指轉出拳外橫掛，就是使用者在八姿勢
  截圖左上兩格看到的東西，逐手特寫定案）；`HandPose` 新增 `wrist`（繞前臂軸的手腕轉向，鏡像），
  V 手勢 `wrist: 1.0` 把掌心轉向鏡頭——前臂折起後掌心原本朝著自己的頭，
  V 的張開方向變成純深度，正面看兩指互相遮擋只剩一指。
  驗證方式是 929×807 大畫布下逐姿勢手部特寫（誤標軸向時畫面立刻露餡），
  修正後八個姿勢的全身 contact sheet 全部可讀。`pinArms` 的手指歸零是
  `rotation.set(0,0,0)`，y 軸的拇指與 x 軸的手腕都涵蓋。
- 量測工具的注意事項：`getBoundingClientRect` 會把入場的 scale transform 算進去
  （量到 176×202 而不是 245×280），亮度門檻會把 hero 星空誤判成她。用
  `gl.readPixels` 的 alpha 通道，並等 `matz === 2`。

## Batch 7——表情擴充＋peace 掌心修正（2026-08-15，使用者附表情差分一覧＋雙 V 參考照）

使用者兩點：peace 的掌心要朝鏡頭（參考照是雙 V 掌心向前）；表情不夠豐富，
把差分一覧下排四種（しいたけ目・怒り・青ざめ・なごみ目）加進去。

- **peace 掌心**：`HAND_PEACE.wrist` 從 1.0 翻成 **−1.0**。前一輪加 wrist 軸時
  方向選錯，V 是張開了但露的是手背。single/double 兩姿勢特寫各自確認掌心向前。
- **表情配方層 `EMOTION_RECIPES`**（avatarMode.ts，純資料可測）：每個情緒宣告
  [channel, share] 清單＋可選 `paleTint`／`angerMark` 旗標，引擎的可用性閘門改成
  逐 channel 對模型的 expression 清單。**修掉一個上線以來的沉默 bug**：模型的
  自訂 blendshape 叫 `'Surprised'`／`'Extra'`（保留原作大小寫），舊閘門拿小寫
  `'surprised'` 比對永遠 false，她從來沒驚訝過。測試釘死大小寫字串。
- **四種新表情**：
  - `excited`＝模型內建 `Extra`（>< 臉），**權重只能 1.0**——X 睫毛 rest 時藏在
    臉內，morph 是「滑出來」不是「縮放」，0.85–0.93 渲染成兩顆黑點、0.75 以下
    只剩閉眼（五個權重逐一截圖驗證）。使用者嫌 1.0 的 V 太大，但看過對照圖後
    拍板保留原作 1.0。接 `done` cue（答完 nod ＋ excited/2.2s）。
    **配方寫 1.0 不等於畫面是 1.0**：引擎是 `setValue(ch, 顯示權重 × share)`
    相乘，cue 傳 0.85 就渲染成 0.85 的破圖，語音期間更被 `emoTarget` 的 0.45
    上限夾住（`done` 正好與語音同時發）。收斂做法是配方加 `snapToFull`
    旗標＋`EMOTION_SNAP_THRESHOLD`（0.25，刻意壓在 0.45 之下），權重換算抽成
    `emotionChannelValues()` 放 avatarMode 由引擎與測試共用，測試釘住
    0.45／0.85／1 三個輸入都輸出 `Extra = 1`。這條是 spec review 抓到的，
    上一版全綠測試只釘到配方常數、釘不到 cue→引擎的端到端權重。
  - `nagomi`＝`relaxed`＋`blink` 合成（閉眼滿足）。接 undisturbed idle 的
    12–22s 隨機拍（之後 16–28s），與 idle acts 並行不衝突。
  - `pale`＝`sad`@0.7 ＋ 臉部材質乘 `FACE_PALE_TINT`（0.62/0.74/0.95）——
    blendshape 動不了膚色，藍色由引擎在 `/face|skin/i` 材質上疊，騎在既有的
    consolidated m.color write（與 answering tint／入場 flash 不打架）。接
    `error` cue。驗證是量臉頰 RGB：pale 的 r−b 差收到 10（其他表情 21–35）。
  - `angry`＝內建 angry ＋ **青筋 sprite**：canvas 手繪四道弓形 V（尖端朝內、
    八個肢端朝外、整體帶 0.35 rad 傾斜），**白芯＋紅描邊**，同一條 path 描兩次
    （先紅 17 後白 6），對齊使用者給的 怒り 差分圖。
    形狀試錯四輪才收斂，依序被退回的是：圓弧破圓、圓角方框四角、
    U+1F4A2 emoji 字符的實心紅新月（emoji 與手繪青筋是兩個不同的符號）。
    定案方式是把畫出來的貼圖本身放大跟參考圖並排比對——只在 3D 場景裡看
    是前兩輪連錯的原因。`colorSpace = SRGBColorSpace`（漏標會被當 linear 洗淡）、
    depthTest off、256px 貼圖，位置每幀從 head bone 世界座標 + (+0.08, +0.11)，
    **壓在頭髮右上**（使用者指定），透明度與 pale 同機制騎 `emoShown`／`emoFade`。
    接連拍頭：相鄰兩次間隔 < 20 秒的連段到第三次觸發 angry 0.9/1.6s
    （`patStreak`，滾動視窗不是固定 20 秒視窗），前兩次仍是 happy＋wiggle
    （2026-08-20 起再加 giggle 笑聲；~~第三次的 angry 不配聲音~~
    **2026-08-21：angry 改為出聲，新增 localised 的 `huff` cue，見本檔
    「點頭也算拍頭」一節**）。另從 2026-08-21 起，**點一下她的頭**也算一次拍頭，
    與撫摸共用同一個 streak。
- 驗證路徑：TEMP probe 的 `__mikaEmo` 一度只做裸 `setValue`，合成表情與 tint
  根本沒走到——改成呼叫真的 `applyEmotion` 後才算數（probe 已於收尾移除）。

## 已知限制（歷輪 review 記錄，接受不修的部分）

- **這份文件本身在 Tailwind 的掃描範圍內**：v4 預設掃整個 repo，所以把已廢棄的
  class 名以字面量寫進這裡（加寬前 rail 用的那兩個 `left` 偏移就是例子，這裡
  刻意不把它們寫成 class 字面量，否則這段文字自己就會讓它們復活），
  production CSS 就會繼續產出那條沒人用的規則。2026-08-14 實測到兩條，
  已把出處改寫成敘述並重新 build 確認兩條都消失。
  觸發條件：在 docs/ 用反引號寫**現在已不存在**的 Tailwind arbitrary value。
  驗證方式：`npm run build` 後在 `dist/assets/*.css` 找**轉義後**的 selector
  （`.w-\[245px\]`，不是 `w-[245px]`——用未轉義字串搜尋會全部假報 MISSING，
  這輪就先踩了一次；`%` 同樣會轉義成 `\%`，所以百分比的 class 要搜
  `.left-\[13\%\]`）。可停用條件：Tailwind 設定改為明確的 `@source` 只含 `src/`。

- WebGL context 遺失後不嘗試恢復——膠囊回歸、avatar wrapper 卸載，直到重新整理
  （最小 handler 見 Non-goals；遺失瞬間若焦點在角色鈕上，交還膠囊）。
- ~~launcher 態下 avatar wrapper 的透明像素會吃右下角點擊~~（**2026-08-14 手勢露出
  批次修正**：wrapper 改 `pointer-events-none`、按鈕與泡泡各自 auto，實測畫布左右
  邊緣的點擊已穿透到頁面；死區縮到按鈕自己的 181px）。
- GLTFLoader 因 hero 與 avatar 引擎共用而被 Rollup 抽成獨立 chunk：hero 多一個 HTTP
  request，總 bytes 不變（round 1 spec review 核可的例外）。
- ~~15.4MB VRM 是首訪成本（intro 後才載、瀏覽器快取吸收重訪）；正式角色階段再壓
  （meshopt／draco／貼圖降階）~~（**2026-08-14 修訂**：Batch 3-G 已壓——WebP
  重打包 5.5MB（HTTP 實傳約 1.9MB），延載與快取策略不變；mesh 端 meshopt/draco
  仍未做，留給正式角色階段）。
- `/avatar/*` 在 vercel.json 設了 `max-age=31536000, immutable`（讓「重訪走快取」
  成立）。**約束：換角色必須換檔名**（並改 `AvatarGuide.tsx` 的 `VRM_URL`），同名
  覆蓋會讓舊訪客拿快取裡的舊模型最長一年。

## 三語配音——讓同一把聲音真的講中文與英文（2026-08-21）

使用者：「目前英文語音是靠日文硬翻過去的……用現在日文這個聲音，講出可愛台灣腔中文
和類似 Amika 口音的英文」。

起點比描述的更糟一階：**zh-TW 根本沒有中文語音**，三個語系裡它聽到的是未翻譯的日文
原檔。en 則是 24 句カタカナ英語（英文字用假名拼寫），那是 VOICEVOX 唯一做得到的事，
因為它沒有非日文音素。兩件事同源。

### 第一版做法被實測否決：跨語言 voice clone

先照最直覺的路走：把つむぎ的聲音 clone 到 fish.audio（22 秒 48kHz 參考音，由
`scripts/gen_voice_ref.py` 從 VOICEVOX 重新合成，不用已上線的 24kHz AAC），再叫它講
中文與英文。使用者試聽後：「中文還是偏日本腔，英文也是日本腔，尤其是日本英文腔會讓
人聽不懂」。

**機制**：clone 的參考音是純日文，模型對「這個說話者怎麼發中文／英文音」零證據，只
能沿用日文的音素實現。這不是溫度或取樣參數能調掉的，是參考音的資訊缺口。用一個能分
辨的測試確認過：同樣兩句、不套 clone，fish.audio 的預設聲音講得出正常中文與英文，所
以是參考音把它拖回日式腔，不是模型不會。

### 定案架構：口音與音色分兩段買

| 階段 | 做什麼 | 在哪 | 腳本 |
|---|---|---|---|
| 1 | 用**原生口音**聲線合成，同時取回逐字時間戳 | fish.audio 免費層 | `gen_voice_fish.py` |
| 2 | Voice conversion 換成つむぎ音色 | 本機 seed-vc / MPS | `vc_to_tsumugi.py` |
| 3 | 時間戳 → 嘴型軌 | 純計算 | `gen_visemes_align.py` → `gen_visemes.py` |
| 4 | 編碼成上線格式 | ffmpeg | `pack_voice.py` |

`voiceVisemes.gen.ts` 仍然只有一個產生器。資料現在有兩個來源（日文走 VOICEVOX mora、
中英走時間戳），但寫檔的只有 `gen_visemes.py`：它 import
`gen_visemes_align.build_track` 來處理中英那半邊。這是因為產生的是單一個 Record，兩
個寫入者的結果會互相蓋掉，而且不會有任何錯誤訊息。

分兩段是整件事的重點：**口音向有口音的人買，音色向她買**。voice conversion 是唯一能
把這兩者拆開的操作，它逐幀改寫音色而不動已經發出來的音。

**但「不動已經發出來的音」不包含音高，這一句當初寫得太寬**，第一批中文就是踩在這個
誤解上出去的，修正記在下面「中文的聲調被轉換吃掉」一節。

口音來源由使用者試聽選定：中文 `台灣腔女生版`、英文 `Cute anime girl`（皆為
fish.audio 公開模型，只作為發音來源，不是 Mika 的聲音）。

**為什麼第 2 階段不是 ComfyUI**：使用者原話是「你可以透過 fish audio 以及 comfyUI 去
實現」。ComfyUI 是節點式工作流介面，語音轉換能力來自它掛載的節點，實際做事的仍是
seed-vc 這類模型。這批要跑的是 48 個檔案的固定流程，直接以腳本呼叫 seed-vc 可以留下
可重跑、可 diff 的產生器，而 GUI 工作流留不下這些。能力相同，交付物不同。

### 兩個關鍵事實，都是實測不是推論

**voice conversion 不改長度。** 逐檔比對轉換前後時長完全相同（3.81s→3.81s、
3.44s→3.44s），所以第 1 階段取得的時間戳在換完音色後仍然指向同一個字。嘴型軌因此
可以在轉換之前就算好。`gen_visemes_align.py --verify` 就是拿來釘這個宣稱的。

**fish.audio 有逐字時間戳，但文件沒寫。** `/v1/tts/stream/with-timestamp` 只出現在
OpenAPI schema 裡，免費層可用，中文回傳逐字、英文逐詞的 start/end。這跟 VOICEVOX 的
mora 時值是同一個等級的資料，也就是說換掉 TTS 之後嘴型並沒有降級成估算。原本準備的
備案（短時能量分段＋音節比例分配）因此整個丟掉。`/v1/asr` 只給 segment 級跨度，而且
另外計費（本帳號 402）。

### 授權立場（使用者裁示，據實記錄）

本檔 2026-08-13 記載「聲音克隆到多語 TTS 為授權禁區（VOICEVOX 條款禁止拿生成音訊訓
練聲音模型）」。這一輪重新查證，結果與那句話不完全相符：

- VOICEVOX 官方條款頁（2026-08-21 取得）只寫商用可、需標注，**沒有**任何關於機器學
  習或聲音模型訓練的條文。
- 春日部つむぎ的角色個別條款頁已從 wix 搬到 `tsumugi-official.studio.site`，該站是
  SPA，抓不到條款正文，**所以個別條款的實際措辭這一輪並未確認**。
- 附帶線索：春日部つむぎ是 MMVC（聲質變換）官方支援角色，官方自己發佈訓練用音聲資
  料，這指向聲質變換並非一律禁止，但同樣未經條款正文確認。

使用者於 2026-08-21 明示「推翻掉這個條款，請執行」，授權風險由擁有者承擔。上面那句
2026-08-13 的記載保留在原處作為歷史，這一節是它的更新。

### 嘴型的兩端要對聲音，不對文字

時間戳描述的是**文字**，跟音訊在頭尾都會脫鉤，這在把軌道實際跟波形比對之前看不出來，
因為每個檔的中段都是連續的（相鄰 segment 的縫隙最大只有一次 720ms，那是句間停頓，
`GAP_CLOSES` 本來就會關嘴）。實測到兩件事：

- **尾端被低估**：48 個檔裡有 12 個，聲音在最後一個字「結束」之後還持續 130-415ms
  （最糟 `mika-full-1-en2` 415ms）。照時間戳關嘴會在字唸完之前就閉上。
- **開頭對不上**：2 個檔的第一個音是鼻音（`mika-ack-5-en2` 的 "Mm"、`mika-ack-5` 中文
  版的「嗯」）。時間戳**有**給這一段（Mm 是 0.0-0.4），是 `en_vowels`／`zh_vowels`
  在裡面找不到母音、`build_track` 因此把整段丟掉，嘴巴晚開 480ms（en）與 320ms（zh）。
  另一批檔的時間戳從 0.00 開始，但音訊有一小段 run-in。

一併撞上的還有一個**搬錯的常數**：原本沿用日文軌的 `LEAD = 0.1`（VOICEVOX 每個檔前面
有約 0.1s 的 prePhonemeLength，所以日文軌都從 0.1 開始）。fish.audio 沒有這段前導，
48 個檔有 40 個從 0.00 開始，硬夾到 0.1 不只讓嘴晚開，還會把落在前 0.1s 內的音節整個
吃掉——「掰掰」少了第一個掰，「我的聲音」少了我。

修法是兩端都改成量出來的：用 `silencedetect` 取每個 clip 的第一個聲音起點與最後一個
聲音終點，把軌道的首步與收尾步釘在那兩個時刻上（首步不得晚於第二步減 20ms，收尾步不
得超過 clip 長度）。驗收是逐檔比對，48 個檔的開嘴與閉嘴都落在量測值的 0ms 內。

### 已知近似

英文的時間戳是**逐詞**，詞內的母音叢是平均分配的。中文是逐字，一字一音節一母音，沒
有這個問題。實際影響有界，但界線比一開始估的寬：全批 148 個詞跨度，中位數 320ms、
95 百分位 800ms、最長 1200ms；其中 42 個詞含一個以上母音，最糟的每母音切片是 400ms
（"projects"、"question"、"Yahoo" 各 2 個母音分 800ms）。誤差不會跨出該詞，但在長詞
上就是一個嘴型撐 0.4 秒。

### 檔名與快取

新的英文檔是 `-en2` 不是 `-en`。`/avatar/*` 走 immutable 快取，clip 的**名字就是快取
鍵**，沿用舊名會讓聽過舊版的訪客永遠停在カタカナ英語上。舊的 24 個 `-en` 檔已移除，
沒有任何地方指向它們。中文當時是全新的 `-zh`，同一天稍後又因為聲調問題整組換成
`-zh2`，理由同上：改的是 clip 說出來的內容，就必須換鍵。

### 標注義務尚未履行（待使用者決定）

本檔上方 2026-08-13 寫「credit 在 ContactFooter」。2026-08-21 查證：**那行不存在**，
`ContactFooter.tsx` 的頁尾只有 `footer.rights` 與一行 render 時間。

全站確實出現過這個名字，但不是以 credit 的形式：`changelog.{en,zh-TW,ja}.ts` 裡
2026-08-13 那則 `mika-avatar-guide` 的內文寫了「VOICEVOX:春日部つむぎ 配音」，訪客在
`/changelog` 三個語系都讀得到。那是敘述，不是標注列，是否足以履行條款屬於擁有者判斷。

這一輪讓欠帳從一個來源變成三個：

| 來源 | 用途 | 授權要求 |
|---|---|---|
| VOICEVOX:春日部つむぎ | Mika 的音色（日文原檔＋voice conversion 目標） | 商用需標注 |
| fish.audio `台灣腔女生版` | 中文發音來源 | 未查證 |
| fish.audio `Cute anime girl` | 英文發音來源 | 未查證 |

沒有自行加上頁尾 credit，因為那是網站可見的設計改動，屬於使用者的決定範圍。若判斷
changelog 內文不夠，建議做法是頁尾加一行 mono 小字（與現有 `React · WebGL · Tailwind`
同一排版層級）列出 VOICEVOX:春日部つむぎ；兩個 fish.audio 公開模型的條款需先查證再決
定是否併列。

## 點頭也算拍頭，生氣也出聲（2026-08-21）

使用者：「我想要類似每次用滑鼠點擊或在手機螢幕上點擊 Mika 醬的頭，就會有一個類似拍
頭反應的動作跟聲音，連拍三次頭就會觸發生氣表情跟音效」。

原本只有一種觸發：桌機在頭區來回撫摸（2s 內 ≥3 次翻向）。加上點擊之後兩種並存，
**streak 共用**，所以三下不管怎麼湊都會走到生氣。

### 兩個決定是使用者做的，因為它們互相衝突

**點擊要在哪個狀態成立**。手機上 Mika 只有一個狀態看得到：`avatarPlacement()` 在 `md`
以下對 fullscreen 與 docked 都回 `hidden`，只有 minimised 回 `launcher`。所以「手機上
點她的頭」跟「點她＝開聊天室」這條契約是同一塊像素。三個選項（頭當拍頭／兩件事都做／
只在聊天室開著時可拍）呈給使用者，選定**只在聊天室開著時可拍**：啟動鈕的行為一個像素
都不動，代價是手機拿不到這個互動。`onTap` 的第一行就是 `placementRef.current ===
'launcher'` 直接 return。

**生氣要用什麼聲音**。無語言的鼻音三語共用（跟笑聲同一個做法）比較省，但使用者選了
**三語各自一句短抱怨**，所以 `huff` 是一個正常的 localised cue，走完整 stage 1→4：

| clip | 內容 |
|---|---|
| `mika-huff-1` | もー！さわりすぎだよ！ |
| `mika-huff-1-zh2` | 夠了啦！摸太多次了欸！ |
| `mika-huff-1-en2` | Hey! That's enough already! |

這推翻了本檔上方「她只笑，不講話」那半條規則。保留的是另一半：**她不會自己出聲**，
huff 一樣只在訪客剛動作過的那一刻播。

讓行規則對 huff 是**半條**，跟 giggle／done／error 不同：她正在講**台詞**時 huff 讓行，
正在**笑**時 huff 蓋過去。理由是節奏——連拍三次是個快動作，前兩下的笑聲各 0.7–0.9 秒，
huff 排在後面就會在訪客拍最快的時候變成靜音，而那正是這個 cue 存在的理由。打斷一段笑
聲去抱怨也不算插話，那是反應在升級，就是第三下的意思。實作在 `speakCue`，靠
`voiceCueRef` 記住現在播的是哪個 cue。

### 順帶修掉一個沒人發現的 bug：她的頭早就不在判定區裡了

拍頭的頭區判定原本是兩個寫死的百分比（畫布高度 12%–40%，半寬 ±0.19×高度），註解寫著
「髮頂在 12.5%」。那是對著 `lookAtY = 1.17` 量的。**2026-08-20 的 319036b 把
`lookAtY` 提高到 1.32**（為了讓舉起的手不被切掉），她在畫面裡整個往下移，判定區就跟著
偏離，而且什麼都不會失敗，測試照樣全綠。

**偏離不等於失效**（這一段第一版寫成「留在她頭髮上方的空氣裡、撫摸不再是拍頭」，是誇
大的，數字就在下面這張表裡）。她的頭高 295mm（1.287–1.582），舊判定區在 waist-up 仍
然蓋住其中 152mm、在 column 蓋住 174mm，撫摸照樣觸發。真正的問題是它蓋到的是**哪一
半**，以及沒有任何東西擋得住下一次相機調整再把它推走一次：

| framing | 髮頂 1.582 實際位置 | 舊判定區 12%–40% 覆蓋到的世界高度 | 與頭部重疊 |
|---|---|---|---|
| waist-up（`lookAtY` 1.32） | 26.3% | y 1.740 → 1.430（前 158mm 是頭頂上方的空氣，止於眼睛） | 152mm（51%），只剩上半顆 |
| column（`lookAtY` 1.016） | 1.7% | y 1.461 → 1.133（下巴到胸口） | 174mm（59%），頭頂完全在外 |

修法是把判定區從 framing **推導**出來：`avatarHeadBand(framing, canvas)` 用
`avatarViewSpan()` 把她的髮頂（1.582，全檔通用的量測值）與下巴（1.287，rigProbe 的
`FACE_BOX` 下緣）換算成畫布比例，`avatarMode.test.ts` 對兩個 placement 各釘一次。相機
有 0.1m 的俯角，嚴格投影與這個線性模型的差距最大 3.2px（745px 畫布），可以忽略。

驗證：兩個 placement 各截一張把判定框畫在她身上的圖，框都正好落在髮頂到下巴、停在
choker 上方；docked 連點三次依序拿到 `mika-giggle-1`、`mika-giggle-3`、
`mika-huff-1-zh`（該次驗證當下的檔名，中文組後來整批改名為 `-zh2`），點在頭以下不出
聲。

### 節奏：兩個冷卻時間，以及「每次點擊都會有聲音」的落差

- **撫摸 8 秒、點擊 120 毫秒**，兩者共用 20 秒的 streak 窗。撫摸是連續動作，沒有長冷
  卻一次掃過去會連發；點擊是離散的，冷卻只用來把重複的 pointerup 併成一下。這個值原
  本設 350ms 並在註解裡寫「擋 double-click」，兩件事都錯：350ms 低於作業系統
  double-click 門檻（約 500ms）所以擋不到，卻會吃掉刻意的快拍——以 300ms 的節奏連拍
  三下只會落地兩下，第三下要拍到第五次才來。
- **冷卻只在拍頭真的落地時才消耗**。引擎是動態 import 進來的，載入完成前 `landPat`
  沒有 handle 可以演；先扣冷卻再嘗試，會讓載入期間的一次撫摸把接下來 8 秒也一起吃掉。
- 使用者的原話是「每次點擊都會有動作跟聲音」。**動作每次都有**，聲音不是：huff 以外
  的 cue 沿用既有的不搶話規則，所以快拍時第二下的笑聲會被第一下蓋著而靜音（實測
  400ms 間隔：笑、靜音、抱怨）。表情與 wiggle 由 AvatarGuide 自己演，所以那一下仍然
  讀得出來。這是既有規則的延伸，不是這次新增的取捨。


## 中文的聲調被轉換吃掉（2026-08-21）

使用者列出 11 支中文檔，主訴分成三類：多數是「聽起來像外勞，不像台灣腔」，兩支是特定
字發音錯（`唷` 被唸成「噎」、`鏘` 唸 qiāng 但要的是「將將」），一支是句尾語調上揚而不
是重音四聲。

### 先分段，再修

問題可能在 stage 1（fish.audio 合成）或 stage 2（seed-vc 換音色），修法完全不同。把兩
段的音檔做成同頁 A/B 給使用者聽，答案是**只有 stage 2 之後才有**，stage 1 的合成聽起來
自然。這一題不自己猜，因為判準是耳朵。

### 機制

`vc_to_tsumugi.py` 當初跑的是 `f0_condition=False`。那個設定選到的是**沒有 F0 輸入**的
模型：音高由內容加上目標說話者 embedding 重新生成，完全不看來源。英文沒事，中文
死得很難看，因為**中文音節內的音高曲線就是聲調**，而目標 embedding 是個日文（非聲調語
言）說話者。生出來的聲調被一個沒有聲調的語言的韻律塑形，聽起來就是外國人講中文。

### 為什麼一開始沒被抓到

量錯了層級。來源與輸出的**句子層級** F0 相關係數，中文 0.89、英文 0.86，兩者一樣高，看
起來完全正常——因為損傷藏在句子語調包絡底下。要把包絡濾掉才看得到：用約 300ms 的移動
平均當高通，只留音節內的音高 movement，`greet-3` 的殘差相關是舊版 0.926、新版 0.991，
換算成殘差誤差是 0.57 半音降到 0.20 半音。

**這是本檔可重複的教訓**：驗證聲調語言的語音處理，量測的時間尺度必須小於一個音節。任何
以整句為單位的相關係數都會給出綠燈。

### 修法

`f0_condition=True` 選 F0 條件模型（44kHz），直接餵它來源的音高曲線；`auto_f0_adjust=True`
把那條曲線整體移調到目標的中位音高，形狀不動。兩個一起才是修正。

中途試過一個不需要重建 seed-vc 的辦法：用 WORLD 把音框拆成音高／頻譜包絡／非週期性，
保留轉換版的包絡、換上來源的音高再合成。聲調確實救回來了（使用者確認），但**部分檔有
機械感**，那是多過一次 vocoder 分析合成的代價。所以還是走重建。`scripts/transplant.py`
沒有留下來，這段記在這裡是因為它是有效的診斷工具：它能在不重建任何模型的情況下，證明
問題出在音高而不是音色。

### 環境重建時撞到的四件事（都不在原本的腳本裡）

seed-vc 的 checkout 與 torch 在這輪之前已經從機器上消失，重建時依序撞到：

| 症狀 | 原因 | 處置 |
|---|---|---|
| `BigVGAN._from_pretrained() missing 'proxies' and 'resume_download'` | huggingface_hub 1.x 不再傳這兩個 kwarg | 釘 `huggingface_hub==0.34.4`、`transformers==4.46.3` |
| `Cannot convert a MPS Tensor to float64` | RMVPE 回傳 float64，MPS 無此型別 | `vc_to_tsumugi.py` 的 `float32_f0` shim |
| `Output channels > 65536 not supported at the MPS device` | BigVGAN alias-free upsampler 的 grouped conv_transpose1d | **整段轉 CPU**。這是明確 raise 的 `NotImplementedError`，`PYTORCH_ENABLE_MPS_FALLBACK` 不涵蓋 |
| `TorchCodec is required for save_with_torchcodec` | torchaudio 2.13 把 `save` 委派給 torchcodec，其 dylib 綁不到本機 FFmpeg | 把 `torchaudio.save` 換成 soundfile |

CPU 上實測一支 2.6 分鐘，25 支 63 分鐘。這是這個階段唯一的代價。

### 最後兩支靠耳朵定案，不是靠量測（2026-08-21）

聲調修好之後使用者又點了兩支，主訴都不是缺陷，是「我要的不是這個」：

- `greet-3` 的「哈囉」是兩個滿調音節，使用者要的是英文 hello 的形狀。定案改成
  `Hello！今天想問什麼呀？`。fish.audio 的中文模型把拉丁字當成單一 segment 處理，
  跟既有的 `Charles`／`Mika`／`AI` 一樣。
- `ack-1` 的「喔」落成重音四聲，使用者要輕聲。槓桿是標點：驚嘆號正是在要求重音，
  定案改成句號的 `好喔。稍等我一下下`。

**這一輪值得記的是判準的歸屬。** 我為 `ack-1` 合成三個候選並量了每個「喔」的時長、
音高斜率與相對音量，量測指向候選 A（160ms、斜率 −0.50 半音，最接近輕聲的定義），
使用者選的是候選 C（320ms、斜率 +13.24 半音，量測上是上揚）。量測沒有錯，它量的是
它定義的東西；錯的是把那個定義當成使用者要的東西。**可操作的界線：量測用來排除
「明顯壞掉」與縮小候選集，不用來替使用者做選擇。** 這也是為什麼候選是三個而不是一個。

順帶修掉一個一直都在的沉默缺陷：`zh_vowels` 用 pypinyin，對拉丁字回傳空陣列，
`build_track` 因此整段跳過——`Charles`、`Mika`、`AI` 從上線以來就沒有嘴型，不報錯也
沒人會發現。`Hello` 放在句首會讓它變得看得出來，所以補上了 `en_vowels` fallback。
`greet-1` 的軌從 13 步變 14 步、`intro-1` 從 29 步變 31 步，就是這個 fallback 生效。

### 一個會靜默壞掉的地方

`gen_visemes_align.py` 的 `locale_of()` 原本是 `endswith('-zh')`，其他一律當英文。改名成
`-zh2` 之後它會拿 `en_vowels` 去跑中文字，而 `en_vowels` 在「你好」裡找不到 `[aeiouy]`
叢集，於是**每個 clip 都產出空軌，而且不報任何錯**。已改成允許世代編號的 regex，並讓認
不出來的後綴直接 raise。

## 再三支，以及第三代 `-zh3`（2026-08-21）

同一天稍晚，使用者又點了三支：初次見面（`intro-1`）、「這個選得好欸」（`suggest-2`）、
「你要問那個喔」（`suggest-1`）。主訴一律是唸法，台詞本身沒有要改。

**但最後有兩支的文字動了**，這不是偏離那個約定，是執行它的唯一辦法：這條管線沒有音素
或拼音控制（fish.audio 的 API 只有 `prosody` 的速度與音量），要指定某個字怎麼唸，能動的
只有那個字本身與它周圍的標點。所以 `suggest-1` 換了句首的字與兩處標點、`intro-1` 的合成
輸入換成同音字，說出來的話沒有變。`suggest-2` 的文字則一字未動，只換了一次抽樣。

定案是 `mika-suggest-1-zh3`、`mika-suggest-2-zh3`、`mika-intro-1-zh3`。**中文組因此同時
存在兩個世代**：這三支是 `-zh3`，其餘 22 支仍是 `-zh2`。沒有整組改名，因為 stage 1 是
隨機取樣，重抽只會弄丟使用者已經認可的 take。接線在 `avatarVoice.ts` 的 `ZH_REGEN`：
`localised()` 從「每個 locale 一個後綴」改成「預設後綴加上逐 clip 覆寫」，
`avatarVoice.test.ts` 用寫死的三支清單釘住（清單刻意不從實作 import，改映射必須動兩個
地方）。`gen_visemes_align.locale_of()` 的 regex 本來就允許世代編號，`-zh3` 直接通過。

### 一句話裡的兩個語氣詞要往相反方向拉

`suggest-1` 兩個「喔」都錯，而且錯的方向相反：句首被唸成「嗚喔」（`喔` 的異讀 wo1／wu1
被選中，使用者要的是單純一個上揚二聲），句尾是一聲，使用者要重音四聲。

兩個修法各自有明確槓桿，但**它們是同一個東西**：

- 句首改用 `哦`。這個字沒有 wo／wu 異讀，多餘的音節從此不會出現。
- 標點決定重音。上一輪 `ack-1` 的「喔」是靠**拿掉**驚嘆號才變輕聲的，這一支要的正是
  那個被拿掉的重音，所以驚嘆號加回來。
- 句首的上揚則來自問號：12 次抽樣測出它穩定買到 +9 到 +15 半音。

衝突在於問號的上揚會**滲透到句尾**，把剛用驚嘆號買到的重音抵銷掉。24 次抽樣裡只有 2 支
兩端同時命中。這不是文字問題：同一段文字的兩次抽樣，句首可以是 −3.3 也可以是 +13.3
半音，temperature 0.7 就是這個意思。所以做法從「改寫句子」換成「抽到為止，用量測篩」。

### 寫作「醬」，唸作「獎」

`intro-1` 的「Mika 醬」要唸 jiang3，但字必須是「醬」（jiang4）。`voice_lines.py` 的表是
**合成輸入，不是顯示文案**（訪客讀到的是 `i18n/strings/zh-TW.ts` 的泡泡文字），所以那一
格直接寫同音的「獎」。這在表上看起來像錯字，`voice_lines.py` 因此留了一段註解明講不要
改回去——沒有那段註解，下一個看到的人會順手「修正」它，而且不會有任何測試變紅。

同一支的 `Charles` 發音也不夠英文。兩件事最後由同一個 take 一起解決，槓桿是 fish.audio
的 `normalize`（文字正規化，這條管線從來沒動過）：關掉它，「獎」會落在半三聲；開著，
它被唸回四聲 −6.9 半音。使用者選的是**開著**的那一支。

### 量測第二次證明它不能替使用者選

上一輪的結論是「量測用來排除明顯壞掉與縮小候選集，不用來替使用者做選擇」。這一輪兩次
撞到同一件事，一次比一次直接：

- `intro-1` 的候選裡，量測指向 `normalize` 關掉的兩支（「獎」是半三聲），使用者選的是
  開著的那一支（量測判定為四聲）。
- 中途我從「`intro-1` 的四聲保留率只有 30%」推論 stage 2 吃掉了它的聲調。把全部 23 支
  攤開之後這個推論垮了：`greet-8` 是 0.458、`full-1` 是 0.557，都比 `intro-1` 的 0.907
  差，而那兩支是使用者批准過的。長度與相關係數的關係也只有 +0.034。

**可操作的界線因此再收一格**：這個指標可以判斷「某個音節的調值是不是使用者說的那一個」
（那是可量的事實），不能判斷「這一支好不好聽」。用它篩選，不用它排名。

### 順帶量到的：那 96ms 的 encoder priming 不見了

`pack_voice.py` 原本記著「AAC-in-MP4 有約 96ms 的 encoder priming，ffprobe 會算進去、
播放器會跳過」，證據是當時的 `mika-intro-1-zh2`。這一輪在三支 `-zh3` 上重量，ffprobe 讀
m4a 與讀來源 wav 的差距是 0 到 1ms，那個位移量不到了。原因沒查（不在這一輪範圍內），
註解已改成同時記載兩次量測。嘴型軌照舊對 wav 計時：那個做法在兩種情況下都是對的。
