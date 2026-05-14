// Translation policy mirrors src/i18n/strings/zh-TW.ts:
//   - Product names (Path, Plutus Trade, Product Playbook), tech stack
//     (React, Flutter, Supabase, etc.), framework names (JTBD, RICE, PRD),
//     and CTA markers (TRY IT, EXPLORE, GitHub) stay English.
//   - Descriptive copy, problem/solution/learnings paragraphs, and meta
//     descriptions are in Traditional Chinese.
//   - "AI Product Manager", "AI Product Builder", "B2B SaaS", "builder",
//     "consumer platform" stay English by industry convention in Taiwan.

export interface Project {
  id: string
  title: string
  description: string
  ctaText: string
  ctaUrl: string
  tags: string[]
}

export interface ProjectDetail {
  id: string
  title: string
  subtitle: string
  metaTitle: string
  metaDescription: string
  problem: string[]
  solution: string[]
  techStack: { category: string; items: string }[]
  impact: string[]
  learnings: string[]
  links: { label: string; url: string }[]
  screenshots?: { src: string; alt: string }[]
}

export const projects: Project[] = [
  {
    id: 'path',
    title: 'Path',
    description:
      '離線優先的旅遊行程 PWA。Cache-first + background sync，就算在國外網路掉了，行程、交通路線、花費都還拿得到。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      '台股 AI 智慧選股工具，整合即時股價、K 線圖、財報分析、AI 個股診斷與一鍵選股，並以績效追蹤回測系統持續優化 AI 準確率。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description:
      'AI 驅動的產品規劃系統。22 個框架、6 種執行模式，自動產出開發 handoff，從一句話想法到完整 spec 只要幾分鐘。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
  {
    id: 'house-ops',
    title: 'House Ops',
    description:
      '台灣看房自動化 pipeline。每日掃 591 與 FB 公開租屋社團，Claude API 把貼文自由文字抽成結構化欄位，五維加權評分後由 Claude Code 接手可負擔試算、換屋規劃與看屋準備。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation', 'Claude API'],
  },
  {
    id: 'job-ops',
    title: 'Job Ops',
    description:
      '把 HR 端 ATS 的結構化評分邏輯反過來給求職者用的 Python pipeline。macOS launchd 每天早上 7:00 自動爬 104 職缺，CV-aware evaluator 對照履歷與候選人原型逐筆評分，銜接 RECOMMEND / CAUTIOUS / SKIP 三段日報透過 Gmail SMTP 寄達；另有 7 個 Claude Code interactive modes 在 session 內處理合法性查核、職等策略、面試準備。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/job-ops',
    tags: ['Python', 'launchd', 'CV-aware', 'Automation'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — 離線優先旅遊行程 PWA',
    subtitle: '一支 Progressive Web App，就算在國外網路掉了，整份行程、交通路線、花費都還拿得到。',
    metaTitle: 'Path — 離線優先旅遊行程 PWA | Charles Chen 產品案例',
    metaDescription:
      '離線優先的多日旅遊行程 PWA。React、TypeScript、Supabase、IndexedDB 上的 cache-first + background sync 架構，國外無網路也能用。',
    problem: [
      '旅遊行程規劃 App（Wanderlog、Tripit、或像去趣這種）預設你有網路。在機場 WiFi 上看起來很美的行程，到了東京地鐵、北海道鄉間溫泉、JR 轉乘月台沒訊號的當下就一片空白。最需要行程的時刻，剛好就是它停止運作的時刻。',
      '國外行動數據貴、不穩，常常兩個都中。Pocket WiFi 沒電、eSIM 在地下室收不到訊號、整團人的路線都靠那一支手機在跑。用網路才能跑的旅遊規劃工具，就是會在最糟的時候掛掉的工具。',
    ],
    solution: [
      '把 Path 蓋成一支離線優先的 Progressive Web App。架構上真正要回答的問題是「怎麼做出一支沒網路也能跑的 web app」（native vs web 是底下那一層的議題）。PWA 同時解決了多項條件：iOS / Android 都可以從一個 URL 直接安裝到主畫面、用 Service Worker 拿到完整離線能力、不用過 app store、沒有 native build、不付平台稅。',
      '採用 cache-first + background sync 的資料策略。所有讀取都先打 IndexedDB（瞬間 render），背景再向 Supabase 同步取最新資料、更新 cache。寫入用 optimistic：UI 立即更新、變更先寫進本地 cache、API 呼叫在背景跑。沒網路時變更會排進 sync queue，連線回來就 replay。旅人在國外不會看到 loading spinner，也不會有任何輸入掉進虛空。',
      '把規劃體驗整個架在這個離線保證上：拖拉式多日行程（@dnd-kit）、Google Maps 處理景點與路線（首次取回後就快取）、針對日台特化的大眾運輸指引（車種圖示、步行時長、路線顏色）、含幣別的花費追蹤、照片與文件附件、常用旅客樣板（重複行程一鍵帶入）。Supabase 的 Row Level Security 在伺服器端隔離每個使用者的資料。',
    ],
    techStack: [
      { category: 'Frontend', items: 'React 18, TypeScript, Vite, TailwindCSS, shadcn/ui (Radix UI)' },
      { category: 'Offline / PWA', items: 'IndexedDB（透過 idb）, Service Worker, PWA manifest' },
      { category: 'State', items: 'TanStack Query（server state）、React Context（auth）、@dnd-kit（拖拉排序）' },
      { category: 'Backend', items: 'Supabase（PostgreSQL、Auth 含 Google OAuth、Storage、Row Level Security）' },
      { category: 'Maps', items: 'Google Maps API（Places、Directions、Geocoding）' },
      { category: 'Validation', items: 'Zod（client schema）、Postgres CHECK constraint（server）' },
      { category: 'Testing', items: 'Vitest, Testing Library' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      '離線優先 PWA：完整行程、交通路線、花費在沒網路時依然可用',
      'Cache-first + background sync：讀取瞬間反應、寫入 optimistic、sync queue 把網路掉了的編輯接住不掉',
      '日台大眾運輸特化：車種圖示、路線顏色、步行時長對應主要使用情境',
      '單一 codebase、單一 URL：iOS / Android 直接從主畫面安裝，不走 app store',
    ],
    learnings: [
      'PWA 是承重的架構決策。如果走 native，就是兩份 codebase、兩次 app store 審查，而「沒網路怎麼辦」這題還是沒答案。PWA 路徑把 native 能給的（主畫面 icon、離線、安裝）都拿到了，沒有付平台稅，而且離線那一段反而更強，因為 Service Worker + IndexedDB 已經是 web 的 first-class primitive。',
      'Cache-first + background sync 在序列圖上很乾淨，實際做起來會髒。讀取很單純：IndexedDB 直接吐快取資料。難的是衝突：同一份行程在兩支裝置都離線編輯，後來都連回來。最後用 last-write-wins + timestamp 合併，加上 per-record 的 sync queue。不完美，但對應到真實使用者行為（單人、偶爾跨裝置、真衝突很少）這樣夠了。',
      'Google Maps API 費用看的是 route 呼叫量（與使用者數獨立）。積極快取策略：路線快取 24h、地點永久快取、選定的 transit polyline 直接寫在行程本身上。使用量上去後 API 開銷維持平的，離線體驗也沒打折。每一筆能命中 cache 的呼叫，剛好就是一筆沒網路也能跑的呼叫。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
    screenshots: [
      {
        src: '/assets/path-demo.mp4',
        alt: 'Path 30 秒 demo 影片走過 9 個場景：行銷 hero、功能格子、儀表板 KPI 概覽、行程卡片列表、拖拉重排的單日編輯器、亞洲路線地圖、費用詳情、AI 收據 OCR 掃描器、離線模式 banner 蓋在完整 dashboard 上，最後收在 Path 品牌畫面。',
      },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — 個人用台股 AI 決策支援工具',
    subtitle: '單一使用者的分析工具：把每天「財報 + 籌碼 + 技術面」的研究循環壓縮成一次 AI synthesis pass，每一筆推薦都做了 instrument，可長期稽核。',
    metaTitle: 'Plutus Trade — 個人用台股 AI 決策支援工具 | 案例研究',
    metaDescription:
      '為主動操作的台股研究工作者打造的單一使用者決策支援工具：Gemini 驅動的跨領域 synthesis、導引式選股、已 instrument 的預測追蹤層。台灣 AI Product Manager Charles Chen 的 generative AI 案例研究。',
    problem: [
      '對主動操作的台股實務工作者來說，每日研究工作流是一個會持續累積的時間成本：月營收的 YoY/MoM 正規化、季報基本面（EPS、毛利率、ROE）、法人買賣超、K 線上的技術結構。每一個輸入單獨來看都不難處理，瓶頸在於 synthesis。當 watchlist 上有 30–50 檔，分析工作量就會直接超過任何沒有全職坐在交易桌前的實務工作者所能負擔的時間預算。',
      '目前消費端的工具回應這個問題的方式是不對稱的。看盤 App 把原始資料攤在你面前但不負責解讀；投顧型產品提供解讀但把使用者當被動接收方。中間這條使用脈絡（具備領域素養、要能自己稽核 AI 輸出、想用 AI 加速 synthesis 並隨時間建立信任）兩端都沒服務到。',
    ],
    solution: [
      '把 Plutus Trade 定位成單一使用者的決策支援工具。Gemini 2.5 Flash 對 watchlist 上每一檔做跨領域的 synthesis：月營收（YoY/MoM/累計）、季報基本面（EPS、毛利率、ROE、股利政策）、法人籌碼、技術指標，回傳一段帶明確推論的 BUY/SELL/HOLD 診斷。輸出嚴格 framed 為「分析」並附上免責聲明，最終決策權保留在使用者。',
      '導引式選股流程把質性的投資條件翻譯成一份 AI 可執行的 contract。3 步驟的投資人 profile（風險偏好、持有區間、產業偏好）參數化選股 prompt，回傳精選短名單與每一支的選股理由。工作流中歷史上最耗時的探索階段，因此收斂成一次互動。',
      '導引式選股下面再墊一層 deterministic 的量化動能 layer：APScheduler 每日 14:00 對全市場跑 8 大動能特徵 + 跨市場 percentile rank 加權，把排序好的候選池 snapshot 進 Redis。Gemini 在選股 prompt 階段直接消化這份已排序候選做 narrative synthesis，量化篩選交給 deterministic 的數值排序兜底，讓 LLM 專注在語意層的推論。',
      '已 instrument 的預測層在每一個 AI 推薦之上 log 該次的 entry context，到期 settle，產出一份結構化的決策品質紀錄（實際 ROI、勝率、決策品質矩陣）。意圖是建立長期透明度：使用者可以在不同市場 regime 與策略類型下回頭稽核系統的歷史表現，把任何單次輸出當作長期紀錄裡的一個資料點來檢視。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（Web 部署在 Vercel）、Riverpod、go_router、fl_chart、Dio' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、httpx、APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash（narrative synthesis）+ 自製動能 scoring 層（8 特徵 + 跨市場 PR 加權，APScheduler 每日 14:00 全市場 snapshot → Redis）' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI、Yahoo Finance、FinMind（三層 fallback 鏈 + 7 天 stale cache）' },
      { category: 'Database', items: 'Supabase（PostgreSQL）、Redis（Upstash）做 cache' },
      { category: 'Notifications', items: 'Web Push（VAPID / pywebpush），16 種通知 + 12 小時冷卻' },
      { category: 'Deployment', items: 'Vercel（前端 auto-deploy）+ Fly.io（後端 nrt region）' },
    ],
    impact: [
      '單一使用者的決策支援表面，覆蓋 8 個整合模組：市場數據中心、自選股與投資組合管理、AI 個股診斷、導引式選股、預測追蹤、財報基本面分析、智慧通知、盤後日報',
      '已 instrument 的預測層：每一次 AI 呼叫都帶 entry context 寫入 log、到期 settle（ROI、勝率、決策品質矩陣），讓系統做到完整 auditable',
      'Hybrid quant + LLM 選股架構：每日 14:00 跑全市場 8 大動能特徵與跨市場 PR 加權 snapshot 進 Redis 做候選排序，Gemini 在這份排序池上做 narrative synthesis，把量化篩選與語意推論兩層各自最擅長的事拆乾淨',
      '三層資料源韌性：FinMind → Yahoo Finance → TWSE/TPEX OpenAPI fallback 鏈，搭配 7 天 stale-cache 安全網，在上游服務退化時仍維持分析能力',
      '盤勢感知的快取策略：盤中 5 分鐘 TTL，收盤後快取持有至下一個開盤，週末快取直接滾到下週一開盤',
    ],
    learnings: [
      'LLM 輸出品質主要是 prompt contract 設計問題。以 JSON schema 限制輸出格式 + few-shot anchors 的結構化 prompt，把 Gemini 幻覺率比 free-form 降低約 60%。多數「需要換更強模型」的討論其實上游就能收掉：先把 prompt contract 收緊，多半 model swap 的需求就消失。',
      '在金融類 AI 產品，「分析」與「建議」的界線必須在產品層強制。模型有求必應；產品的工作是把它重新框架成附帶免責聲明的分析。這是住在產品層的設計決策，內容審查只是下游配套。',
      '把 audience 鎖在「一個人」是刻意的產品 constraint，本身就構成產品策略。Scope 收斂成單一具備領域素養的使用者後，消費型產品繼承來的權衡矩陣（合理預設、新手 onboarding、針對不熟悉者的容錯）整批消除，把設計表面釋放出來，全力為分析深度做最佳化。',
      '對決策支援工具來說，資料源可靠度是第一順位的產品考量。多層 fallback + stale-cache 安全網是「上游服務退化時，工具還能用」的保證；在這個產品類別裡，退化等同核心價值主張的 outage。',
    ],
    links: [
      { label: 'Try Plutus Trade', url: 'https://plutustrade.vercel.app/' },
    ],
    screenshots: [
      {
        src: '/assets/plutus-watchlist.png',
        alt: 'Plutus Trade 自選股頁面，每張卡片顯示股價、當日漲跌與即時走勢線。股票名稱與代碼已模糊處理。',
      },
      {
        src: '/assets/plutus-ai-winrate.png',
        alt: 'AI 選股勝率：238 檔已結算推薦勝率 64%、平均 ROI +58.96%、ROI 走勢分布圖、月度勝率拆解。',
      },
      {
        src: '/assets/plutus-holdings-winrate.png',
        alt: 'Plutus Trade 庫存勝率分析，呈現各檔損益與未實現損益。股票名稱與代碼已模糊處理。',
      },
    ],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook — 產出 spec 的 AI Agent',
    subtitle: '用 LLM orchestration，把一句話的產品想法變成完整 spec 文件的 AI agent 產品。',
    metaTitle: 'Product Playbook — AI Agent 規格產生器 | LLM 產品案例',
    metaDescription:
      '為 Claude Code 打造的 AI agent 產品。22 個產品框架、自動 dev handoff。台灣 AI Product Manager Charles Chen 的 LLM 產品案例研究。',
    problem: [
      '產品 spec 寫得好要花好幾天。一份好 PRD 要綜合使用者研究、競品分析、技術限制、商業目標。多數 PM 不是直接跳過（沒對齊就開工），就是花太多時間（拖到開發進度）。',
      '既有的 AI 寫作工具（ChatGPT、Notion AI）能產文字，但不懂產品框架。它們不會做 JTBD 分析、不會建出 RICE-scored backlog、也不會把 user persona 對應到功能需求。它們只會生成通用段落。',
    ],
    solution: [
      '打造一個跨 Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill 三種發佈管道的 AI agent，將多個產品框架編排成一條 spec 產生 pipeline。使用者用一句話描述產品想法、選擇執行模式，agent 產出一份完整 spec 文件。',
      '關鍵架構決策是把 22 個成熟的產品框架（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD 等）當作結構化 prompt 來使用。每一個框架把 AI 的輸出限制在資深 PM 真實會用的思考模式上，貫穿 Discovery、Define、Develop、Deliver 四個階段。Free-form 生成就是這個做法所取代的對象。',
      '設計 6 種執行模式（Quick、Full、Revision、Custom、Build、Feature Expansion），讓 PM 能依產品階段挑工具的深度。功能實驗不需要 50 頁 spec，但新產品上線確實需要完整 dev handoff。',
      '建出 change propagation engine，當上游決策改動時自動更新下游文件；再加上三層 PDF 解析（pymupdf 純文字 → Claude Vision 語意 → Tesseract OCR fallback），讓使用者可以直接上傳既有的 PDF/DOCX/PPTX 研究資料。',
      '自動 dev handoff 產出 CLAUDE.md、TASKS.md、TICKETS.md，把產品需求轉成帶驗收條件的技術任務，縮短 PM → 工程師 的溝通落差。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin, Claude Code Skill' },
      { category: 'AI', items: 'Claude (Anthropic) 負責 LLM orchestration, Claude Vision (PDF 語意解析)' },
      { category: 'Frameworks', items: '22 個產品框架（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD 等）' },
      { category: 'Document Processing', items: 'Playwright (Chromium PDF rendering), Pandoc (格式轉換), pymupdf (純文字解析), Tesseract OCR, pikepdf (bookmarks)' },
      { category: 'Tooling', items: 'Node.js (npm), Bash, Git, Markdown (框架定義)' },
      { category: 'Distribution', items: 'npm package, GitHub (MIT license)' },
      { category: 'Internationalization', items: '6 種語言（英文、繁體/簡體中文、日文、西班牙文、韓文）' },
    ],
    impact: [
      'PM 與工程師都在用的 open source AI agent 產品',
      '從想法到完整 spec，從幾天縮短到幾分鐘',
      '22 個產品框架編成可重用的 LLM prompt，覆蓋 Discovery → Deliver 全階段',
      '6 種執行模式（Quick / Full / Revision / Custom / Build / Feature Expansion）對應不同產品開發階段',
      '相對於沒掛 skill 的 baseline Claude 回應，品質提升 +69%',
      '多通路發佈（Claude.ai、Claude Code Plugin、Claude Code Skill），直接在使用者既有工作流裡相遇',
    ],
    learnings: [
      'LLM orchestration 在本質上是產品設計問題，工程實作住在它下游。框架的執行順序很重要：Persona 在 JTBD 之前跑，輸出會更好，因為使用者脈絡會引導 job 的識別。花了不少時間優化 pipeline 順序。',
      'Skill-based 發佈（Claude Code 生態系）是非常強的通路。使用者在自己既有的工作流裡直接接觸工具，無需採用任何新平台。',
      '身為 AI Product Manager 打造 AI agent，最大的洞察是：產品價值住在框架那一層。AI 只是交付機制，22 個產品框架才是真正的智慧財產。任何人都能呼叫 LLM API，差異在於知道要問它什麼。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
    screenshots: [
      {
        src: '/assets/product-playbook-demo-zh-TW.mp4',
        alt: 'Product Playbook Build Mode 示範影片：輸入產品需求，AI 掃描現有 codebase、自動偵測技術棧，套用 PM 框架釐清問題後直接進入方案設計。',
      },
    ],
  },
  {
    id: 'house-ops',
    title: 'House Ops — 台灣看房自動化與 AI 決策 Pipeline',
    subtitle: 'macOS launchd 每天 09:00 啟動 Node.js 管線：scan 591 與 FB 公開租屋社團、Claude API（Haiku 4.5）把自由文字貼文抽成結構化欄位、五維加權打 0–5 分、寄出 HTML 簡報；Claude 決策層在 session 內接手可負擔性試算、換屋規劃、物件比較與看屋 checklist。',
    metaTitle: 'House Ops — 台灣看房自動化與 AI 決策 Pipeline | Charles Chen 個人專案',
    metaDescription:
      'Node.js 自動化管線。每日掃描 591 與 FB 公開租屋社團，由 Claude API 把自由文字貼文抽成結構化欄位，依價格、空間、地段、屋況、風險五個維度加權評分，並透過 HTML email 簡報交付。AI Product Manager Charles Chen 的個人自動化案例研究。',
    problem: [
      '台灣租屋與買房物件分散在 591、Facebook 公開社團與長尾論壇，使用者常陷於低效的「掃描 → 評估 → 丟棄」循環。物件具備極高的瞬變性與資訊雜訊：重複上架、價格波動、跨平台格式斷裂，再加上社群貼文是無法被欄位篩選讀懂的自由文字。使用者往往同時開啟數十個分頁手動比對捷運、學區、格局與風評，對時間有限的上班族而言，高昂的決策成本與龐大雜訊常導致優質物件被淹沒。現有平台僅提供基礎欄位過濾，缺乏對物件脈絡（租金中位數、空間比例、租賃風險）的綜合診斷，迫使使用者每日重複進行低產值的資訊合成。',
    ],
    solution: [
      '本專案開發一套基於 Node.js（ESM）的自動化管線，由 macOS launchd 驅動。每日 09:00 同步啟動兩條掃描：agent-browser 抓 591 指定區域；獨立的 Chrome 實例（透過另一支 launchd plist KeepAlive，profile 與日常使用的 Chrome 隔離）使用 Chrome DevTools Protocol 的 `Input.synthesizeScrollGesture` 合成觸控手勢，繞過 Facebook anti-bot lazy-load，抓公開租屋社團最新貼文。FB 自由文字貼文交給 Claude API（Haiku 4.5）抽成 `{price_num, address, district, size, layout, contact, confidence}` 的結構化欄位，與 591 物件統一進入評估佇列。每筆物件執行五維度啟發式評分（價格、空間、地段、屋況、風險），依租屋族 / 首購族 / 換屋族三種情境切換加權邏輯，篩出 ≥ 4.0 分標的後，透過 Nodemailer 渲染成可排序篩選的視覺化 HTML 簡報寄出。Claude Code 互動層在 session 內處理 `affordability`（首購族試算）、`upgrade plan`（換屋的賣舊買新時程與資金缺口）、`compare 001, 003`（並排對比）與 `prepare visit for 001`（看屋清單與議價策略）：管線負責資料漏斗，AI 負責複雜的權衡判斷。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js（ESM, .mjs）' },
      { category: 'Scraping', items: 'agent-browser（591）+ Chrome DevTools Protocol（FB 公開社團，Input.synthesizeScrollGesture 繞過 anti-bot）' },
      { category: 'LLM Extraction', items: 'Claude API（Haiku 4.5），自由文字貼文 → 結構化欄位' },
      { category: 'Email', items: 'Nodemailer + Gmail SMTP（HTML 簡報，支援排序與篩選）' },
      { category: 'Scheduling', items: 'macOS launchd（daily run + 專用 Chrome KeepAlive 實例）' },
      { category: 'Persistence', items: 'JSON Cache、TSV 掃描歷史（自動）、Markdown Tracker（由 Claude Code session 互動寫入）' },
      { category: 'Interactive Layer', items: 'Claude Code（Affordability、Upgrade Plan、Compare、Prepare Visit）' },
      { category: 'Sources', items: '591.com.tw（租屋 / 買房）+ Facebook 公開租屋社團' },
    ],
    impact: [
      'Multi-source ingestion：以 CDP 合成觸控手勢繞過 FB anti-bot lazy-load，搭配 Claude API 抽結構化欄位，把 591 與社群兩條原本割裂的供給管道收斂進同一個評估流程。',
      'Scheduled scanning：每日 09:00 自動觸發管線，結合持久化緩存實現精準去重。',
      'Five-dimension scoring：實作量化評分模型，依租屋族 / 首購族 / 換屋族動態調整權重（如租屋 30/20/25/15/10），將感性觀感轉化為數據指標。',
      'Daily email digest：定時交付結構化 HTML 報告（591 與 FB 物件分區呈現），包含降價追蹤、下架條目與行政區拆解，優化早晨決策體驗。',
      'Interactive Claude modes：提供 in-session AI 諮詢，涵蓋首購試算、換屋財務規劃與物件深度對比，強化最後一哩路的決策品質。',
    ],
    learnings: [
      '在個人自動化場景中，launchd 是比 cron 更優雅的選擇。它能完整繼承使用者環境、處理 Keychain 驗證並配合系統喚醒設定，大幅提升管線的營運天花板。',
      '過濾邏輯從「硬門檻（hard filters）」轉向「多維度加權評分」是關鍵突破。硬過濾容易因單一指標誤殺邊界候選標的，加權模型則能容許物件在不同維度間進行 trade-off，更精準地模擬人類決策。交付媒介選 Email 是基於對行為科學的理解：早晨高頻決策時段，Push 推播的資訊到達率與行動裝置閱讀體驗，遠優於 Dashboard 那類 Pull 型介面，讓數據能主動在注意力所在之處發揮價值。',
      'FB 整合過程依序試過純 JS scroll、agent-browser scroll、keyboard PageDown、CDP `Input.dispatchMouseEvent`，全都被 anti-bot 攔截、feed 不會 paginate；最後唯一能跑的路徑是 CDP `Input.synthesizeScrollGesture`，因為合成觸控手勢會被 FB 視為實體 trackpad 滾動。同步學到的是：把自由文字社群貼文交給 LLM 抽結構化欄位（每篇成本約 USD 0.001）長期成本低於維護一套規則式 parser，後者面對「月租押金兩個月含管理費可議」這類台式中文表達很快就會崩潰。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/house-ops' },
    ],
    screenshots: [
      {
        src: '/assets/house-ops-daily-report.png',
        alt: 'House Ops 每日 email 簡報：頂部摘要區塊、新上架物件表、降價與下架條目、行政區拆解。',
      },
      {
        src: '/assets/house-ops-listing-report.png',
        alt: '單筆物件的五維評估報告：價格合理度、空間與格局、地段機能、屋況、風險五項分別打分，並加權合成為 0–5 分。',
      },
    ],
  },
  {
    id: 'job-ops',
    title: 'Job Ops — 把 ATS 反向給求職者用的 Pipeline',
    subtitle: '每天早上 7:00 由 macOS launchd 觸發的 Python pipeline。爬 104 職缺後，CV-aware evaluator 用 cv_reader 解析履歷、對照 archetypes.yml 的候選人原型逐筆打分，輸出 RECOMMEND / CAUTIOUS / SKIP 三段式日報，透過 Gmail SMTP 在 07:30 前送到手機；另有 7 個 Claude Code interactive modes 在 session 內處理合法性查核、職等策略、薪資調查與面試準備。',
    metaTitle: 'Job Ops — 把 ATS 反向給求職者用的個人 Pipeline | Charles Chen 個人作品',
    metaDescription: 'CV-aware 的 Python 自動化每天爬 104，用候選人視角的 rubric 打分，產 HTML + Markdown 日報透過 Gmail SMTP 在 07:00 寄達；搭配 7 個 interactive modes 處理合法性查核、職等策略、面試準備。AI 產品經理 Charles Chen 的個人求職 OS。',
    problem: [
      '求職 funnel 的 HR 端有 ATS，每天用同一套結構化規則把 100+ 候選人打分、排序、淘汰；求職者端沒有對應工具。30 到 50 個目標職缺只能靠人眼一頁頁讀，把「85K vs 90K、遠端 vs hybrid、30 人團隊 vs 5 人團隊」這些資訊全部塞進工作記憶試圖比較。triage paralysis 來得很快，多數人最後就點推薦列表的第一個職缺：等於把篩選權交還給平台，他們的排序變成你的排序。',
      '104、LinkedIn、CakeResume 的搜尋條件只能設 hard filter（薪資下限、地區、職類）。沒辦法表達「我重視成長性 > 薪資 > 通勤」這種權重式偏好；沒辦法用我的 CV 比對職缺敘述；沒辦法依求職階段（探索期 / 收網期）動態調整評估權重。求職者被迫扮演 matching engine 的角色，且 batch size 遠低於 HR 端 ATS 的處理量。',
    ],
    solution: [
      'Job Ops 是 reverse-ATS：把 HR 端那套結構化評分邏輯反過來指向職缺。asyncio Python pipeline（httpx 串 104 search/detail API）由 macOS launchd 在 07:00 觸發。每個新職缺進到 CV-aware evaluator：cv_reader 解析履歷、對照 archetypes.yml 定義的候選人原型逐項評分、把結果分為 RECOMMEND / CAUTIOUS / SKIP 三段。report.py 渲染 inline-styled HTML（手機 Gmail 直接讀）+ Markdown 雙生本（Obsidian 收錄、版本控制、月底回顧）。Gmail SMTP 在 07:30 前送達，趁注意力還便宜的早晨。',
      '評分權重外接到 YAML，不寫死在 Python。8 個維度（薪資、遠端、技術棧、成長、團隊、品牌、地點、生活）的權重定義在 config/profile.yml，從探索期（成長、團隊吃重）切到收網期（薪資、通勤吃重）一行 edit 就解決，完全不必碰 evaluator 程式碼。這份 YAML 進 git 後，每次 commit 等於記錄自己優先順序的變化，求職結束後拿出來看比任何單日報告更有訊息量。',
      '7 個 interactive modes 沿用 house-ops 的雙層架構，在 Claude Code session 內觸發：cv-match（單一職缺 CV 對位）、comp-research（市場薪資調查）、legitimacy（公司與職缺合法性查核，由 forum_lookup 串論壇來源）、level-strategy（IC 路線 vs 管理職）、interview-prep、personalization、role-summary。Pipeline 承擔 deterministic 工作（爬、dedupe、評分、寄信），interactive 層處理需要對話深度的判斷。scan-history.tsv 同時負責 lifecycle（價變、下架、重貼），同一職缺貼三次只會顯示一列加上 diff 註記，不會累積成 3 列噪音。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Python 3.11+ (asyncio)' },
      { category: '爬蟲', items: 'httpx 串 104 search + detail API、UA 輪替、RateLimiter' },
      { category: 'CV 攝入', items: 'cv_reader 把 markdown 履歷解析為結構化訊號餵進 evaluator' },
      { category: '評分', items: '多維度加權 evaluator + archetypes.yml，輸出 RECOMMEND / CAUTIOUS / SKIP 三段式' },
      { category: '設定', items: 'YAML（archetypes、search criteria、個人權重）' },
      { category: '寄信', items: 'Gmail SMTP + inline-styled HTML + Markdown 雙生本匯出' },
      { category: '排程', items: 'macOS launchd（com.job-ops.daily，每日 07:00）' },
      { category: '持久化', items: 'TSV scan-history 追蹤價變與下架 lifecycle，每日 MD + HTML 日報' },
      { category: '互動層', items: '7 個 modes：cv-match、comp-research、legitimacy、level-strategy、interview-prep、personalization、role-summary' },
      { category: '測試', items: 'pytest、pytest-asyncio' },
    ],
    impact: [
      'Reverse-ATS pipeline 把每日 30–50 個 104 listings 收斂為三段式日報（RECOMMEND / CAUTIOUS / SKIP），全部在 07:30 前送進早晨手機',
      'CV-aware evaluator 用 cv_reader 解析 markdown 履歷、對照 archetypes.yml 的候選人原型逐筆評分，同一份程式碼透過 config edit 切換不同求職階段',
      '7 個 interactive modes 補完判斷層：合法性查核（forum_lookup 串論壇來源）、IC vs 管理職、薪資談判、面試準備',
      'TSV lifecycle tracking：價變、下架、重貼以 diff 註記呈現在同一列上，避免重複職缺累積成噪音',
      'macOS launchd 原生排程搭配 Gmail App Password（無 OAuth dance），與 house-ops 共用同一套自動化 family',
    ],
    learnings: [
      'Reverse-ATS 的本質是視角切換，工程組件（scraper、evaluator、digest）和任何評分 pipeline 都一樣。產品決策的重點在於「這把尺指向誰」：HR 端把同一把尺指向 100 個候選人，這個專案把同一把尺指向 100 個職缺。求職 funnel 的雙向不對稱性（HR 端有 ATS、候選人端只有眼睛）本身就是 build 的價值主張。',
      '8 個維度權重外接 YAML 的收益遠超「少改一點程式碼」這個明面好處。因為 YAML 進 git 後，每次 commit 都是自己在這次求職中優先順序變化的時間戳；探索期偏向成長與團隊、收網期偏向薪資與通勤這類轉變，會被 git history 完整記錄下來。求職結束後拿這份 longitudinal record 出來看，比任何一份單日報告都更有訊息量。',
      'Pipeline + 互動層的雙層切法，在 house-ops 上驗證過一次，在 job-ops 上又得到一次驗證。Deterministic 工作（爬、dedupe、評分、寄信）放 pipeline、需要對話深度的判斷（合法性推理、職等策略、薪資談判）放 interactive Claude Code modes。把合法性推理塞進 Python 模組會讓 pipeline 變成怪物；把每天的 scraping 塞進 Claude session 會燒錢且不穩。同樣的架構切法在不同領域反覆成立。',
    ],
    links: [
      { label: 'GitHub（private repo）', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
