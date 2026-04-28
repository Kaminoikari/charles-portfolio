// Translation policy mirrors src/i18n/strings/zh-TW.ts and the project's
// data files:
//   - Code identifiers, React APIs (useRef, IntersectionObserver,
//     React.lazy, Suspense), library names (React, Vite, Tailwind, GSAP,
//     Pixabay, Vercel, FastAPI), file paths (src/..., main.tsx,
//     vercel.json), CSS values (100vh, 100dvh, rgba()), browser APIs
//     (localStorage, hreflang, JSON-LD, Open Graph), and CSS class
//     fragments stay English.
//   - Section / UI markers that remain English in the live site
//     (Hero, About, Universe, Changelog, [ ABOUT ], CASE STUDY, IMPACT,
//     TECH STACK) keep the same form in titles for consistency with
//     what readers see on screen.
//   - Numerical values, units, file/byte sizes, durations are kept.
//   - Descriptive narrative prose is translated to Traditional Chinese.

export type ChangelogTag = 'feature' | 'design' | 'technical'

export interface ChangelogEntry {
  id: string
  date: string
  title: string
  body: string[]
  tags: ChangelogTag[]
}

export const changelog: ChangelogEntry[] = [
  {
    id: 'plutus-trade-case-study-rewrite',
    date: '2026-04-29',
    title: 'Plutus Trade — 改寫為決策支援工具的案例研究',
    tags: ['design'],
    body: [
      '以資深 PM 的視角重寫 Plutus Trade 案例研究。先前版本有兩個問題：一、把產品定位成「把法人級分析帶給散戶」的消費型 SaaS，這個 market frame 已不再對應目前正在運行的產品；二、文案偏向個人化、口語化的敘述，而非 recruiter 或業界同儕在案例研究中預期讀到的分析框架。',
      '新版 problem statement 用產品語言重新框定使用者現實：每天的台股研究是一個 synthesis bottleneck，而非 data availability bottleneck。月營收標準化、季報基本面、三大法人籌碼、K 線技術面，每一項單獨都能處理；成本是在 30–50 檔自選股 watchlist 中累積出來的。市面上的消費型工具回應方式不對稱——看盤 App 給出原始資料但不解讀；投顧型產品提供解讀但把使用者當成被動接收方。Plutus Trade 鎖定中間這道斷層：具備領域素養、希望取得可覆寫且可審計的 AI 綜合分析的操作型使用者。',
      'Solution 段落現在呈現為三個承重的產品決策，而非功能描述：（1）跨領域 AI synthesis，輸出明確 framed 為 analysis 而非 advice；（2）guided screening flow，把投資人的質性條件翻譯成 AI 可執行的 contract；（3）instrumented prediction layer，每一筆建議都帶 entry context 寫入 log，到期 settle 結果，使整個系統可審計而非黑箱。',
      'Tech stack 對齊正在運行的 repo，校正過時資訊：Flutter Web 部署於 Vercel（非 iOS）、FastAPI 部署於 Fly.io nrt region、Gemini 2.5 Flash（先前誤植為 1.5 Pro）、前端 Riverpod + go_router + fl_chart + Dio、後端 Pydantic v2 + httpx + APScheduler、三層資料源 fallback 鏈（FinMind → Yahoo Finance → TWSE/TPEX OpenAPI）配 7 天 stale cache、Web Push 透過 VAPID。同步補上實際的功能面（8 大模組：數據中心、自選股／投資組合、AI 個股診斷、一鍵選股、預測追蹤、財報基本面、智慧通知、盤後日報）。',
      'Learnings 段重寫為四條 PM-voice 結論，對應上述承重設計決策：模型選型之前，prompt contract 設計才是第一個槓桿；任何金融類 AI 必須在產品層強制 analysis-vs-advice 的分界；audience-of-one 是刻意設定的 constraint，能釋放設計面、讓產品專注於分析深度而非轉換率；資料源可靠度對任何決策支援工具都是 first-class 產品議題——這個層次的退化在功能上等同於核心價值主張的 outage。',
    ],
  },
  {
    id: 'path-case-study-rewrite',
    date: '2026-04-28',
    title: 'Path — 圍繞 PWA 與離線優先重寫案例研究',
    tags: ['design'],
    body: [
      '重寫 Path 案例研究，因為原稿把產品擺到錯的競品空間。原本的敘事拿 Booking.com、Agoda、TripAdvisor 當對手（訂房平台跟社群旅遊 App），但 Path 不是這兩種裡的任何一種。它真正的參照點是 Wanderlog、Tripit、去趣這類行程規劃工具，競爭也不在折扣或評論，而在「網路在國外掉了，行程是不是還能用」。',
      '三個 locale（en、zh-TW、ja）全部重寫，只用 Path GitHub repo 與其 ARCHITECTURE.md 已經寫下的內容，絕不無中生有。新版敘事以兩個承重的產品決策為主軸：（1）PWA 是「做出沒網路也能跑的 web app」這道題的架構解答：iOS / Android 直接從主畫面安裝、Service Worker 拿到完整離線、不用過 app store、沒有 native build；（2）cache-first + background sync 是資料策略：IndexedDB 讓讀取瞬間 render、背景同步 Supabase 取最新資料、寫入 optimistic、sync queue 把離線編輯接住、連線回來再 replay。',
      '更新 tech stack 段落為 Path 實際出貨的內容：React 18 + Vite + TailwindCSS + shadcn/ui（Radix UI）、TanStack Query 管 server state、@dnd-kit 處理拖拉、IndexedDB 透過 idb、Service Worker、Supabase 配 Google OAuth 與 Row Level Security、Zod client schema + Postgres CHECK 限制、Vitest 測試。同時在 live demo 旁加上 GitHub 連結，讓讀案例的人能自己驗證實作。',
      '首頁 project card 也順手改了：描述換成「Cache-first + background sync，就算在國外網路掉了，行程、交通路線、花費都還拿得到」，標籤從 React / TypeScript / Supabase 換成 PWA / React / IndexedDB，把離線那一面在專案列表就拋出來。',
    ],
  },
  {
    id: 'i18n-content-translation',
    date: '2026-04-28',
    title: '多語系內容 — 全量翻譯收尾',
    tags: ['feature'],
    body: [
      '把 i18n 架構原本留作英文 placeholder 的所有 locale 資料檔全部補完。/zh-TW/ 與 /ja/ 路由現在都是端到端的母語體驗：About 頁（Who I Am 段落、產品哲學 bullets、AI 工作流表、技能組合表）、experience 時間軸、三份案例研究（Path、Plutus Trade、Product Playbook）、universe section 飄浮的 skill names，以及 ~3,200 字的 changelog 本身：shader 工程、動畫重構、scroll restoration、GEO/SEO 策略、音訊系統等等都涵蓋進去。',
      '每份翻譯都遵守在檔頭明確寫下的政策。產品名（Path、Plutus Trade、Product Playbook、USPACE）、技術棧（React、Flutter、Supabase、FastAPI 等）、框架名（JTBD、RICE、OKRs、AARRR）、產業標準詞（B2B SaaS、builder、Product Builder、MaaS）、程式碼識別子、React/browser API（useRef、IntersectionObserver、localStorage、hreflang）、檔案路徑、CSS 值，以及英文 UI markers（[ ABOUT ]、CASE STUDY、IMPACT、TECH STACK）一律保留英文，符合台日 PM 實際的書寫習慣，硬翻反而拗口。描述句、problem/solution 段落、bullet 標題、技術敘事則翻成在地語言。',
      'Blog section 上，原文就是繁體中文的文章在 /zh-TW/ 維持原文標題與副標（與發文一致）。在 /ja/ 上，標題與副標都翻成日文作為「這篇繁中文章在講什麼」的描述，呼應日本科技部落格對外語來源做日文摘要的慣例，連結本身仍指向繁中原文 Substack/Medium。',
      '語氣上，日文用 です/ます 體對齊現有資料檔；繁體中文用台灣 PM 的口吻，自然中英夾雜在實際會這樣寫的技術 context 處。整個 portfolio 現在三個 locale 在每個頁面、每份資料檔都做完 i18n，無 TODO 殘留。對 canonical 英文 Strings interface 跑型別檢查通過，未來任何 locale 偏移都會在 build time 浮上來。',
    ],
  },
  {
    id: 'hero-easter-egg-mobile-polish',
    date: '2026-04-27',
    title: 'Hero — Easter Egg 手機版優化',
    tags: ['design', 'technical'],
    body: [
      '修了兩個傷害 easter-egg 肖像在手機上呈現的問題。第一，hero text、「click the logo 5 times」hint、SCROLL 指示器在 photo phase 仍維持滿不透明，肖像在較小 viewport 收斂後就被它們覆蓋。每個 overlay 現在各有自己的 ref，render-loop 內依 egg phase machine 做淡出：從 egg t=1.25s 到 t=1.55s（對齊 shader 的 photoHide）淡出，整個肖像期間維持隱藏，再在 reverse phase 開始的 0.15s 內淡回。肖像現在在每種螢幕尺寸都落在乾淨的舞台上。',
      '第二，肖像 sampler 原本只取邊緣：對來源 PNG 跑 4 方向 Laplacian，只留下輪廓、眼睛、眉毛、嘴唇邊線。手機上看起來像 hollow wireframe 而不是一張臉，因為臉頰、額頭、頸部區域是空的。加上稀疏的內部填充：照片區域內每 5 個 pixel 也以低 weight（6）進入 particle pool，排序後拿到最暗的粒子，強邊則仍然搶下最亮的粒子。臉在小尺寸下現在讀起來是飽滿的肖像，桌機尺寸下也沒失去定義輪廓的乾淨線條。',
    ],
  },
  {
    id: 'i18n-architecture',
    date: '2026-04-27',
    title: '多語系站點 — English / 繁中 / 日本語 架構',
    tags: ['feature', 'technical'],
    body: [
      '為 portfolio 加上 i18n 架構，可同時提供英文（root 預設）、繁體中文（/zh-TW/* 之下）、日文（/ja/* 之下）。英文入口維持 bare URL（沒有 /en/ 前綴），讓既有的入站連結與 SEO 仍落在搜尋引擎預期的位置。Locale 前綴分支共用同一份 route table，每個頁面（home、About、案例研究、changelog）都能在每個 locale 下對應到同一條路徑。Router 從 URL 前綴解析 locale；首訪不依瀏覽器語言自動偵測。',
      '不引入 i18n 函式庫。react-i18next 與 react-intl 帶來這個 site 用不到的功能（ICU formatting、複數規則、namespace lazy load），加上各約 50KB。改自製一層輕量元件：每個 locale 一份 typed strings dictionary（英文檔案定義 canonical Strings interface，zh-TW 與 ja 必須結構符合，缺漏 key 在 build time 即浮現）、useT() hook 從 active dictionary 取 dotted-path 字串並支援簡單 {{var}} 內插，加上 LocaleProvider 包住每個 locale 分支並把 `<html lang>` 與 active locale 同步。',
      'Per-locale 資料架構套用同樣的模式：每個內容檔（projects、changelog、experience、blog、skills）都拆成 .en.ts / .zh-TW.ts / .ja.ts 三份。Locale-aware loader（src/data/index.ts）對外提供 useProjects()、useChangelog() 等 hook，依當前 locale 回傳對應資料集，缺漏 entry 則 fallback 到英文。翻譯複本起初是英文 + TODO 標記，讓 site 馬上可上線、譯者也能漸進填上而不需動架構。',
      'SEO 表面現在 locale-aware。useDocumentMeta() helper 在每條路由上更新 document.title、meta[name=description]、canonical link，以及完整的 <link rel="alternate" hreflang>（en、zh-TW、ja、x-default）。hreflang URL 指向每個 locale 對應的同一條路徑，讓 Google、百度等 crawler 對不同 audience 呈現正確的版本。index.html 原本所有 hreflang 都指向同一個英文 root 的靜態宣告已經被取代。',
      'Persistence 是 opt-in 的。首訪不做瀏覽器語言自動偵測。Root 永遠 render 英文。但使用者按下語言切換器後，選擇會寫入 localStorage，回訪者會落在上次選的 locale（root 一次性 redirect 到 /zh-TW/ 或 /ja/）。切回英文時 redirect 會被清掉。',
      '在 nav 加上一組緊湊的 3 鍵語言切換器（桌機：CONTACT 按鈕旁的 pill group；手機：放在 hamburger menu 內，用 divider 隔開）。切換時保留當前 sub-path（/about → /zh-TW/about → /ja/about），使用者中途換語言不會被踢回首頁。',
    ],
  },
  {
    id: 'hero-easter-egg-braam-sfx',
    date: '2026-04-27',
    title: 'Hero — Easter Egg 電影級 Braam 音效',
    tags: ['feature', 'design'],
    body: [
      '為 easter-egg 序列配上電影預告片風格的 braam 音效。觸發時對音檔做 offset，讓它招牌的 50dB attack transient 剛好落在 COLLAPSE_END（egg elapsed ~0.80s）：奇異點達到最大壓縮、白色閃光點燃的瞬間。Braam 接著貫穿 flash 與 explode phase，粒子收斂成肖像，長尾迴響則延伸進 photo-hold 與 reverse phase。',
      '透過單一個延遲播放 `setTimeout` 串起來：音檔從 egg 觸發後 idle 0.49s，然後從 t=0 開始播，音檔開頭的靜音段恰好填滿 collapse 起始的張力，撞擊才落下。重用同一個 Audio element 跨多次觸發，由現有的 eggStartRef guard 把關重複觸發，元件 unmount 時暫停任何進行中的播放。音量上限 0.55，braam 讀起來是戲劇性的標點，不會壓過 ambient 配樂。',
    ],
  },
  {
    id: 'hero-easter-egg-cosmic-photo',
    date: '2026-04-27',
    title: 'Hero — 宇宙塵埃肖像粒子 & Easter Egg 細節',
    tags: ['feature', 'design', 'technical'],
    body: [
      '重做了 easter-egg 肖像 phase，讓組成照片的粒子像宇宙塵埃，而不是實心唸珠。每顆粒子現在改畫成預先 render 好的 radial-gradient sprite（共用的暖白核心、根據 5 段亮度梯度上色的 halo），用 additive blending 合成，相鄰的 halo 重疊成連綿發光的織物，而不是堆疊成一顆顆獨立的點。約三分之一的粒子還會多畫一條短切線拖尾，暗示它們剛剛從 orbital ring 脫逃、正往肖像移動。',
      '把照片的色盤對齊 shader 的 lens-halo 光譜：brightness 0 對到火焰般的紅橘（暖氣絲），brightness 1 對到奶油白（lens 月牙核心），再加 12% 的青色點綴對應冷側氣體。肖像本身的明暗對比現在讀起來像溫度梯度（亮 pixel 像被引力透鏡聚焦的熱光，暗 pixel 像逐漸冷卻的吸積殘骸），宇宙底色與肖像視覺上共享同一組 colour DNA。',
      '在 easter egg 中加入真正的 shader 端引力塌縮。Shader 現在依 `u_eggCollapse` 套上徑向縮放與旋轉漩渦，collapse phase 中 lens 視覺上會塌陷而不只是變暗；reverse phase 中粒子發散回 orbital ring 時，shader 也會跑一段較小的二次塌縮。新增 `u_photoHide` uniform 在 photo phase 期間把整個 shader 淡到 0（explode 最後 0.35s 內逐漸升起，避免 lens 在收斂的肖像背後閃光，整個肖像期間維持為 0，reverse collapse 時再降下來）。',
      'Reverse phase 改回乾淨的線性發散：粒子用 `easeOutQuart` 直接飛回 orbital ring，不旋轉。早先的 CW 螺旋版讀起來像照片在「旋轉著解體」，感覺不自然；引力氛圍現在完全活在 shader 的二次塌縮裡，粒子單純發散重組。',
      '為了讓 3000 顆粒子的 ring 維持 60 fps：canvas DPR 上限現在是 1.5（在 Retina 螢幕上大約砍半 pixel work，肉眼看不出損失）；idle-orbit trail 的 stroke style 移到 per-frame 迴圈外（每幀省下數千次冗餘 state 切換）；trail render 門檻也提高，讓昏暗或慢的外角粒子完全跳過 stroke。Photo phase 的 shadowBlur 換成預 render 的 glow sprite，便宜約 3-4 倍，halo 也更乾淨。順手移掉了讓 hero 文案抖動的 mousemove text-repulsion。',
    ],
  },
  {
    id: 'hero-black-hole-shader-orbital-particles',
    date: '2026-04-27',
    title: 'Hero — 黑洞 Shader 與 Orbital 粒子系統',
    tags: ['feature', 'design', 'technical'],
    body: [
      '在 hero 粒子背後加上一支 WebGL fragment shader，render 黑洞風格的吸積盤：中央有亮起來的 lensing 月牙，柔和的氣體絲流動環繞。Shader 在自己的 canvas 上、貼在既有粒子環下層，hero 現在讀起來是分層的構圖（前景發光的 event horizon、後方流動的氣體、最上層的 orbiting 粒子），而不是一片扁平的粒子場。',
      '把先前波形調變、固定角度的粒子模型換成參考 msurguy blackhole 寫法的 Kepler 式軌道系統。每顆粒子真的繞中心旋轉，角速度依半徑而定（內圈快、外角慢漂），讀起來像差動旋轉，而不是靜態的裝飾環。粒子數從原本窄帶內的 800 顆，提升到貫穿整條 viewport 對角線的 3000 顆，寬螢幕的角落不再空蕩。',
      '點擊與輕觸互動現在改用 spring-damper 物理模型：擊中時把鄰近粒子用初始徑向速度推開，重力再把它們拉回 base orbit，配上欠阻尼振盪讓它們略微越過再自然安頓，而不是硬性的線性 repel-and-snap。Shader 本身不再回應點擊；只有粒子環會。氣體底色保持中性，讓點擊回饋讀起來像對軌道的物理擾動，而不是全螢幕「shakes」反應。',
      'Konami easter egg 重做為 shader 與粒子環同步的 big-bang 序列。所有粒子向奇異點塌縮、中心爆出閃光、衝擊波向外漣漪、粒子炸開拼成 Charles 的肖像、停留片刻、最後溶解回 ring，shader 也從黑出淡回正常氣體。兩個元件聽同一個 `easter-egg` window event，phase 邊界（collapse 0.8s → flash 1.0s → explode 1.6s → photo 3.5s → reverse 5.0s）保持鎖在一起。',
      '一路上幾個小修：shader 分母奇異點（中心亮點、穿過 lens 的對角斜片）換成 epsilon-stabilised 形式；氣體旋轉改用指數飽和的 drift 而非線性纏繞，noise 圖樣不會隨時間累積出長弧線；hero 文字加上分層黑色 text-shadow，輔助文案的不透明度也略提高，讓亮 lens 月牙穿過時仍可讀。',
    ],
  },
  {
    id: 'hero-mobile-vertical-centering',
    date: '2026-04-21',
    title: 'Hero Section — 手機垂直置中修正',
    tags: ['technical', 'design'],
    body: [
      'Hero 文字在手機上明顯坐在可見 viewport 中線下方。根因是 100vh：這個單位在手機瀏覽器代表「URL bar 收起」狀態下的 viewport，不是「目前實際看得到」的範圍。所以 section 比訪客真正能看到的還高，「100vh 中央」就落在視覺中心下方約 40-50px。底部的 SCROLL ↓ 指示器也因此被 URL bar 蓋住。',
      '改用 100dvh（dynamic viewport height），透過 supports-[] variant 應用：現代瀏覽器以實際可見區域決定 section 高度，不認得 dvh 的舊瀏覽器則 fallback 到 100vh。Canvas 早就以 section 的 clientHeight 做 resize，粒子動畫中心會自動跟著 layout 走，這邊不用再動。',
    ],
  },
  {
    id: 'ambient-audio-default-muted',
    date: '2026-04-19',
    title: 'Ambient Audio — 預設靜音啟動',
    tags: ['design'],
    body: [
      '翻轉了 ambient soundtrack 的啟動方式。第一版預設是 unmuted，試圖「偷渡」過瀏覽器的 autoplay block，等首次 click 或 scroll 來偷偷淡入。手法聰明，但不誠實：角落的喇叭 icon 從頭到尾顯示「sound on」，瀏覽器其實一直在悄悄擋播放。訪客根本不知道延遲是刻意的，沒 click 也沒 scroll 的人會永遠看到一個說謊的 icon。',
      '現在 icon 啟動時就是 muted 狀態，跟瀏覽器實際在做的事一致；音樂只在訪客主動點下喇叭時才開始。點擊本身就算成解鎖 autoplay 的 user gesture，一個動作同時授權與啟動淡入。沒有額外「enable audio」步驟，icon 也不再說謊。',
      '同時收緊了 localStorage 語意。按鈕仍會記住訪客的最後選擇，但預設狀態（若沒儲值、或儲值意外損毀）是 muted。上次主動 unmute 過的回訪者會再聽到音樂；其他人在主動要求前都是靜音。把音效當作 opt-in，這對 portfolio 才是對的預設。',
    ],
  },
  {
    id: 'ambient-space-audio',
    date: '2026-04-18',
    title: 'Ambient Space Audio — Interstellar 風格氛圍音景',
    tags: ['feature', 'design'],
    body: [
      '加上一段電影感的 ambient soundtrack，在訪客探索 site 時靜靜播放。參考是 Hans Zimmer 的 Interstellar 配樂：慢推進的 pad 與 sub bass，沒有節奏元素，待在體驗底層而不爭奪注意力。授權使用 Pixabay 一段 CC0 的 “Calm Space Music” 軌。',
      '瀏覽器 autoplay policy 會擋下任何沒經過互動就開始的有聲音訊。Chrome 和 Safari 多年來都很嚴格，這也是合理的。與其硬碰，player 等到第一個 pointer/keyboard/scroll/touch event，再以 1.8 秒把音量從 0 淡入到 0.35。轉場慢到讓音訊感覺一直就在那。',
      '一顆小小的 glassmorphic 靜音按鈕固定在右下角。點擊後音訊在 0.6 秒內淡出再暫停，並把偏好寫到 localStorage：靜音的訪客回訪後仍維持靜音。按鈕本身採 44×44 點擊區方便手機操作，hover 用 accent-cyan 對齊既有的 focus ring 風格。',
      '音訊 element 在 main.tsx 裡放在 router 之上，只實例化一次，所以 /、/about、/changelog、/projects/:id 之間導航時播放不中斷，沒有重新初始化，路由間也沒有空檔。',
    ],
  },
  {
    id: 'product-page-refresh-2026-04',
    date: '2026-04-18',
    title: 'Product Pages — Tech Stack 內容更新',
    tags: ['technical'],
    body: [
      '三份案例研究頁的 tech stack 表已經過時。產品本身在上線後仍持續演進，portfolio 也得跟上。',
      'Path 在 frontend stack 加上 PWA / Service Worker 層：offline-first 是面向使用者的承諾，背後支撐它的技術也應該被點到。Plutus Trade 的資料源從「FinMind API、Redis」擴張到還包含 Yahoo Finance API，提供國際報價搭配台灣特有的 FinMind 資料源。產品其實雙市場都涵蓋，只是頁面沒反映。',
      'Product Playbook 改寫幅度最大，直接從目前的 GitHub README 拉過來。發佈通路原本只列「npm、GitHub」，現已擴張到三條交付管道（Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill），分別在使用者工作流的不同位置相遇。文件處理 pipeline（Playwright 跑 Chromium PDF render、Pandoc 做格式轉換、pymupdf 純文字解析、Tesseract OCR fallback、pikepdf 處理 bookmark、Claude Vision 做語意解析）原本完全沒寫。Impact 段加上 6 種語言國際化、MIT license、+69% 品質提升的 benchmark。',
      '同時把 6 種執行模式換成它們在 production 真正的名字（Quick、Full、Revision、Custom、Build、Feature Expansion），取代頁面原本含糊的「from lightweight to comprehensive」描述。',
    ],
  },
  {
    id: 'footer-portaly-link',
    date: '2026-04-17',
    title: 'Footer — 加上 Portaly 連結',
    tags: ['feature'],
    body: [
      '在 Contact Footer 加上 Portaly（portaly.cc/charleschen）作為第四個社群連結，與 LinkedIn、GitHub、Threads 並列。Portaly 是主要的 link-in-bio hub，從 portfolio 露出可以收斂跨平台的存在感。',
      'Icon 用 Portaly 官方 brand mark（apple-touch-icon），本地處理過：去掉白底、貼緊 logo 邊緣裁切，在其他社群 icon 用的 20×20 尺寸下能乾淨呈現。',
    ],
  },
  {
    id: 'scroll-restoration-fix',
    date: '2026-04-15',
    title: 'Scroll Restoration — 修掉重新整理回不去的問題',
    tags: ['technical'],
    body: [
      '在任何捲動位置 refresh 都會跳到錯的 section，有時是 About，有時是頂端。根因是首頁每個 section 都用 React.lazy() 包 Suspense lazy load。',
      '瀏覽器的 scroll restoration 機制是：先存捲動位置，等頁面 render 完再還原。但有 Suspense 後，頁面會先 render 一個矮 fallback（單一 h-screen div），等所有 section 載完再展開到真實高度。等真實內容出現，瀏覽器早已對著錯的頁面高度嘗試還原，位置被夾擠回 0。',
      '修法很直接：移掉所有首頁 section 的 lazy()，改成直接 import。這些 section 訪客捲動時遲早會看見，lazy load 沒帶來實質效益，卻搞壞了 scroll restoration。Route 層級頁面（About、Changelog、案例研究）仍維持 lazy load，因為訪客不一定會點進去。',
      'Bundle 從 233KB 變 313KB（gzip 75KB → 102KB），但少了 7 個獨立 chunk request。對真實世界的載入時間幾乎沒差。一個大 request 在 HTTP round-trip overhead 下，常比多個小 request 還快。',
    ],
  },
  {
    id: 'responsive-layout-fixes',
    date: '2026-04-14',
    title: 'Responsive Layout — Hero 與 About 對齊',
    tags: ['design', 'technical'],
    body: [
      '修了兩個 layout 一致性問題。Hero section 文字容器是 max-w-[900px]，About 卻是 max-w-[1400px]，內容左緣會在 section 之間跳動。把 Hero 統一成同一個 max-w-[1400px] px-6 md:px-12 容器，h1 本身則上限 max-w-[900px] 維持舒適行寬。',
      'About section 在 md（768px）切成水平 layout，但側邊有標註的照片需要 ~728px 空間。在平板螢幕（768-1024px）上文字欄被擠到接近零寬。把水平 breakpoint 從 md 推到 lg（1024px），並加上響應式照片尺寸：lg 時 350×480，xl 時擴張到完整的 440×600。',
    ],
  },
  {
    id: 'blog-xai-redesign',
    date: '2026-04-13',
    title: 'Blog Section — xAI 風格文章列表',
    tags: ['feature', 'design'],
    body: [
      'Blog section 之前只放兩顆平台按鈕（Medium、Substack），沒文章標題、沒描述，對訪客或搜尋引擎都沒價值。重新設計成完整文章列表，靈感來自 xAI 的 news page layout。',
      '每篇文章現在以 row 顯示，含日期、標題、副標題、平台 tag、封面圖、READ 按鈕。封面圖以 background-size: cover 套在 16:10 容器內。沒封面圖的文章顯示一個淡化的平台 logo 作 fallback。Featured 文章（Uber L4 Offer）在日期旁有一個 mars 色 badge。',
      '副標題第一版是寫得很制式的一句話 summary。改用 Substack 的真實副標，說服力強很多。例如 CS153 那篇從「探討 AI 發展的真正限制與突破方向」改成「這堂被戲稱為「AI Coachella」的課，可能是目前全世界最搶手的一堂課。」',
      '排序把 featured 放前面，其餘依時間倒序。共 13 篇：Substack 7 篇有封面、Medium 6 篇。',
    ],
  },
  {
    id: 'case-study-pages',
    date: '2026-04-12',
    title: 'Case Study Pages — SEO Topic Cluster',
    tags: ['feature', 'technical'],
    body: [
      '在 /projects/path、/projects/plutus-trade、/projects/product-playbook 加上專屬案例研究頁。每頁有結構化區塊（Problem、Solution、Tech Stack、Impact、Learnings），配上正確的 meta title、description、動態 canonical URL。',
      '首頁的 project card 現在連到這些案例研究頁，而非外部 URL。這在 SEO 上建出內部 topic cluster：首頁連到案例研究、案例研究互連回首頁，每頁針對不同 long-tail 關鍵字。',
      '同時新增一個獨立的 /about 頁，含完整職涯經歷、產品哲學（outcomes over outputs、strong opinions loosely held、strong product sense、build to learn）、AI 工作流拆解、技能組合，與一段帶 lang="zh-TW" 的中文簡介，給台灣搜尋流量。',
      '所有新頁面用動態 canonical URL 與結構化 meta tag。修掉 Google Search Console 把子頁面標記為「Alternate page with proper canonical tag」的問題：它們之前共用一條寫死的 root canonical。',
    ],
  },
  {
    id: 'geo-seo-optimization',
    date: '2026-04-11',
    title: 'GEO & SEO — 讓 AI 找得到 Portfolio',
    tags: ['feature', 'technical'],
    body: [
      '對人類來說 portfolio 看起來很好，對搜尋引擎與 AI 系統卻是隱形的。作為 React SPA，整個頁面 client-side render：不執行 JavaScript 的 crawler 看到的只是 <div id="root"></div>，其餘什麼都沒有。沒有 structured data、沒有 meta 策略、沒有 sitemap。',
      '第一層是機械工：加上 JSON-LD structured data（Person、FAQPage、ItemList schema）、Open Graph tag、Twitter Cards、canonical URL、author metadata、freshness signal（published/modified date）。建立 robots.txt 明確允許全部 14 種主要 AI crawler（GPTBot、ClaudeBot、PerplexityBot 等）、一份 sitemap.xml，與一份實驗性的 llms.txt 提供給 AI 直接消化。',
      '第二層解 SPA 可見性問題。在 <noscript> tag 內塞入完整的 HTML fallback：不執行 JS 的 crawler 拿到完整的語意內容，含正確的 H1/H2/H3 階層、成就列表、技能表、專案描述、FAQ section。React mount 後接管可見的 DOM，使用者永遠不會看到 fallback。一開始把 fallback 放在 #root 內，造成 React hydrate 前一閃 unstyled HTML，挪到 <noscript> 修掉了。',
      '第三層是關鍵字策略。GEO 審計顯示內容是以「我是誰」（品牌頁）的方式組織，而不是「我解決什麼問題」（搜尋頁）。「AI Product Manager」搜尋量明顯高於「AI Product Builder」，但只出現 4 次 vs 19 次。重新平衡到 title、JSON-LD、noscript 標題、FAQ 內容裡共 15 次「AI Product Manager」。把地理訊號「Taiwan」放到關鍵位置。Title 從 name-first（「Charles Chen — AI Product Builder」）切成 keyword-first（「AI Product Manager | Charles Chen Portfolio」）。',
      '同時在 vercel.json 加上 X-Robots-Tag header、從 noscript fallback 內部連到 /changelog，以及一段針對 long-tail 關鍵字的新 FAQ：「how to become an AI product builder」、「AI product manager portfolio example」、「generative AI product case study」、「difference between AI PM and AI Product Builder」。',
    ],
  },
  {
    id: 'playbook-animation-fixes',
    date: '2026-04-09',
    title: 'Product Playbook — Connection Line 修正',
    tags: ['design', 'technical'],
    body: [
      '把框架 badge（JTBD、Persona、RICE、PRD）連到 SPEC.md 區塊的橘色 bezier 線，原本有三個問題。第一，在深底色上幾乎看不見：疊加 alpha 後實際 opacity 只有約 18%（globalAlpha 0.3 × marsA(0.6)）。把數值提到 0.55 與 0.9，實際可見度拉到約 50%。',
      '第二，每條線一個週期內動畫跑了兩次。根因是 lineProgress 計算裡的「peek-ahead」分支，在下一個 section 開始前就先把線預畫出來。Section index 推進時，sectionLocalProgress 重置為 0，整條線從畫好跳回空，再從頭跑一次。移掉 peek-ahead 分支，每條線剛好動畫一次。',
      '第三，Dev Handoff section（最後一個）一直沒顯示完成 checkmark。isComplete 條件是 si < activeSectionIndex，最後一個 section index 等於 activeSectionIndex 最大值，所以 3 < 3 永遠是 false。加上 progress >= 1 檢查處理最後一個 section。',
    ],
  },
  {
    id: 'changelog-page',
    date: '2026-04-09',
    title: 'Changelog — Building in Public',
    tags: ['feature', 'design'],
    body: [
      '新增獨立的 /changelog 頁，記錄這個 portfolio 每個部分背後的設計決策、技術迭代、與思考過程。靈感來自 Linear 的 changelog：乾淨單欄 layout、寬鬆的留白、自然的散文敘事，而不是 bullet-point 形式的 changelog。',
      '為此把原本單頁捲動的站點導入 React Router。首頁照舊運作：所有 section 維持垂直捲動、nav 行為不變。Changelog 活在自己的 URL，並對 Vercel 部署設正確的 SPA fallback。',
      'Nav 元件變得 route-aware：在首頁，section 按鈕仍捲動。在 changelog 頁，按鈕會 navigate 回 /#section，頁面載入後自動 scroll-to。Changelog 入口放在 footer：技術 metadata 旁的低調連結，留給想再深入的訪客。',
      '每篇 entry 寫成自然散文，而不是 release notes。目標是分享決策背後的「為什麼」：為什麼 About section 跑了 5 次背景動畫迭代、為什麼 Fibonacci 分佈解掉了 Universe 球面、為什麼卡片動畫需要完整的 state machine 生命週期。',
    ],
  },
  {
    id: 'animation-module-extraction',
    date: '2026-04-09',
    title: '動畫架構重構',
    tags: ['technical'],
    body: [
      '三套卡片動畫系統長到單檔 1,240 行。每個動畫（Path 的 S 形 bezier 路線、Plutus Trade 的 K 線 ticker、Product Playbook 的 spec 組裝）都是自含系統，有自己的常數、state machine、draw function。它們只是剛好住在同一個檔。',
      '抽成各自的 module：pathAnimation.ts、plutusAnimation.ts、playbookAnimation.ts，加上一份 shared.ts 放共用工具。ProjectCards.tsx 從 1,240 行降到 593 行。',
      '同時把所有寫死的 rgba() 字串集中到兩個 helper（whiteA() 與 marsA()），整個 codebase 共做 56 處替換。重點色未來若改變，動一個常數即可，不用在 draw function 裡到處找。',
      'Playbook 動畫的 badge metric 計算之前是 module-level 的可變 cache。改成元件 scope 的 useRef，不再共享可變狀態。',
    ],
  },
  {
    id: 'product-playbook-card',
    date: '2026-04-08',
    title: 'Product Playbook — Spec 組裝動畫',
    tags: ['feature', 'design'],
    body: [
      '加上第三張側邊專案卡片：Product Playbook，一個 Claude Code 的 AI 驅動產品規劃 skill。動畫要視覺化它的核心概念：框架進去、完整 spec 出來。',
      '設計上左邊是四個框架 badge（JTBD、Persona、RICE、PRD），透過弧形 bezier 線連到右側文件。隨著每個段落填入（Overview、User Stories、Architecture、Dev Handoff），對應的框架 badge 以 accent-mars 脈衝亮起。',
      '文件內部，內容行漸進填入，附帶以約 0.6Hz 閃爍的打字 cursor。完成的段落會出現 checkmark。底部進度條用 easeInOutCubic 而非線性增長，質感更精緻。',
      '進場編排對第一印象很重要：badge 以淡入 + slide-up 交錯出場（120ms 間距），文件外框接著淡入。給動畫一個「揭幕」時刻，這是另外兩張卡一開始沒有的。',
      '經過多輪審查微調：把框架從 6 個減到 4 個，做出乾淨的 1:1 段落對映；連線改弧形而非平直水平；用分數插值平滑掉部分曲線端點。',
    ],
  },
  {
    id: 'mobile-card-autoplay',
    date: '2026-04-08',
    title: '手機自動播放卡片動畫',
    tags: ['feature', 'technical'],
    body: [
      'Canvas 卡片動畫原本由 onMouseEnter 與 onMouseLeave 觸發，觸控裝置永遠不會收到這兩個事件。在手機上，插畫永久凍結在靜態。',
      '修法用 matchMedia("(hover: none)") 偵測觸控裝置，改用 IntersectionObserver（threshold 0.3）作為替代觸發。卡片捲入畫面時動畫自動播放，捲出畫面時停止。',
      '桌機行為不變：動畫仍由 hover 觸發。',
    ],
  },
  {
    id: 'canvas-card-animations',
    date: '2026-04-07',
    title: '專案卡片的互動式 Canvas 動畫',
    tags: ['feature', 'design'],
    body: [
      '專案卡片原本掛靜態 SVG 插圖，通用、無生氣。三張全部換成互動式的 Canvas 2D 動畫，各自講自己專案的故事。',
      'Path 的動畫描繪一條 S 形 bezier 路線，附上發光的彗星拖尾。光點通過每個 waypoint 時，到達漣漪向外擴散，對應的行程卡（Day 1、Day 2、Day 3）依序亮起並打勾。整個循環跑：旅行 → 抵達端點停留 → 淡出 → 重置。',
      'Plutus Trade 顯示一個即時 K 線 ticker。多頭蠟燭以 accent-mars 發光、空頭蠟燭白色。新蠟燭從右側捲入，週期性的 surge 事件做出戲劇性的長蠟燭。交易日有自己的生命週期：8 秒交易 → 收盤減速 → 淡出 → 新一天。',
      '卡片 UI 本身受 xAI 啟發：銳利邊框搭配角落方塊裝飾、hover 漸層 overlay、輕微 scale transform。每個動畫只在 hover（桌機）或進入 viewport（手機）時跑，靜態狀態永遠顯示完整插畫的暗預覽。',
    ],
  },
  {
    id: 'nav-footer-cleanup',
    date: '2026-04-07',
    title: 'Navigation 與 Footer 細節',
    tags: ['design'],
    body: [
      '兩個小但重要的 layout 修正。手機 hamburger menu 原本排在 CONTACT 按鈕之前，挪到使用者預期的最右側。',
      'About section 有一個「Let\'s Connect」連結，跟 nav bar 的 CONTACT 按鈕重複。移掉。一個明確的 call-to-action 比兩個互搶好。',
    ],
  },
  {
    id: 'about-hero-photo',
    date: '2026-03-28',
    title: 'About Section — 帶成就標註的照片',
    tags: ['design'],
    body: [
      'About section 重新設計，主視覺是大張個人照搭配桌機版兩側的成就標註。照片用 CSS radial gradient mask 自然淡化邊緣融入深底，比嘗試程式去背乾淨許多。',
      '桌機 layout 把照片放中央，「6M+ Users Impacted」在左側，「85% Revenue Impact」與「5x Faster with AI」在右側。手機上把照片堆在精簡的指標 row 上方。',
      '文案從制式介紹改成「What I bring to the table.」：直接、有自信，讓指標站在它旁邊一起說話。',
    ],
  },
  {
    id: 'universe-section-evolution',
    date: '2026-03-25',
    title: 'Universe Section — 3D 球面之路',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Skills section 的迭代次數比站上其他任何部分都多。從一個基礎 canvas 配散落的線開始，演化成完整的 3D 球面視覺。',
      '球面上線的分佈是最難的問題。隨機放看起來不平均。試過 grid-based 方法，看起來人工。最後落在 Fibonacci sphere 演算法（向日葵排種子用的同一套數學），分佈完美均勻。',
      'Render 順序在 3D 裡很重要：靠 viewer 近的粒子要畫在較遠的之上。實作了 z-sorted render，配上預先配置好的 sort array，避免每幀對 garbage collector 施壓。',
      '捲動驅動的文字擴張靈感來自 xAI 的視覺語言：技能標籤環繞球面，使用者捲動時向外移動，營造擴張與探索的感受。標籤自動在類別間循環，不讓初始視覺被資訊淹沒，又能呈現完整技能集。',
      '微調球面比例、線密度、粒子亮度、中央密集分佈，跨數十次 commit 才對齊到 xAI 的美學。',
    ],
  },
  {
    id: 'particle-hero-rings',
    date: '2026-03-22',
    title: 'ParticleHero — Ring 粒子系統',
    tags: ['feature', 'design'],
    body: [
      'Hero section 一開始用 Perlin noise flow field：粒子像有機水流般漂移。看起來還行，但通用。換成 Antigravity 風格的 ring 粒子演算法，粒子在同心圓上以柔和脈動環繞。',
      '在 hero 上點任何位置會產生 ripple 效果，向外傳遞穿過粒子。Ring 中心固定在螢幕中央，不跟隨點擊，維持構圖穩定，同時保有回應感。',
      '參數做了大量微調：脈動從 0.008 慢到 0.003 求低調，密度從 80×25 降到 40×15，避免壓過 hero 文字。',
      '這裡藏了一個 easter egg：快速點 logo 5 次會觸發粒子用邊緣偵測重組成個人照剪影。臉會依 viewport 尺寸縮放，桌機與手機上都讀得清楚。',
    ],
  },
  {
    id: 'about-neural-network',
    date: '2026-03-20',
    title: 'About Section — 背景動畫的演化',
    tags: ['design', 'technical'],
    body: [
      'About section 背景動畫快速迭代過。先是連線粒子、試過六角形節點（太忙碌），演化成「quantum neural network」概念，最後落在簡單的發光點以脈動線連接。',
      '最終實作 80 個一般節點與 10 個 hub 節點。Hub 較大、較亮、較慢移動，它們是網路裡的視覺錨點。藍紫色盤（#6BA3D6、#4E8FD4、#8B9FD6）選來呼應暖色 accent-mars 而不互搶。',
      '效能在 80 個節點下需要 O(n²) 距離檢查連線時是個顧慮。實作 spatial grid 把它降到 O(n)：每個節點只檢查鄰近的 grid cell。Grid 容器跨幀重用，避免 garbage collection 壓力。',
      '整個動畫在 section 捲出畫面時透過 IntersectionObserver 暫停。對沒人在看的東西燒 CPU 沒意義。',
    ],
  },
  {
    id: 'space-grotesk-typography',
    date: '2026-03-18',
    title: 'Space Grotesk — 字體基礎',
    tags: ['design'],
    body: [
      '從系統字體切到 Space Grotesk 作為主字。Space Grotesk 幾何但溫暖的個性對應 xAI 啟發的視覺語言：技術但平易近人。',
      '搭配 SF Mono 處理 section label、tag、技術 UI 元素的等寬字。Section header 統一成 [ SECTION ] 樣式，搭配 tracking-[2px]，這個小細節把整個站點扣在一起。',
    ],
  },
  {
    id: 'initial-launch',
    date: '2026-03-15',
    title: 'Portfolio 上線',
    tags: ['feature', 'design', 'technical'],
    body: [
      'charles-chen.com 首次上線。以 React 19、Vite、Tailwind 4、Canvas 2D 動畫打造。深色主題（#0A0A0A 背景配暖色 accent-mars #E8652B）就在這一刻定下來。',
      '色彩、邊框、字體的 design token 集中在 Tailwind 的 @theme directive：單一 source of truth。每個 section 用 React.lazy() lazy load，由 Vite 自動 code-split。',
      'Accessibility 從第一天就內建：skip-to-content 連結、focus-visible outline、prefers-reduced-motion 支援可關掉所有動畫，每個互動元素都有 ARIA label。View Transitions API 讓 section 之間導航有平滑 crossfade。',
    ],
  },
]
