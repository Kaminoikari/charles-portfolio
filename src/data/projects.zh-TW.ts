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
      '為台灣租屋市場打造的自動化找房管線。每天早上自動掃描 591、把每筆物件依五個維度加權評分，在你還沒喝完早晨咖啡前就把精選簡報送進信箱。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation'],
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
      '已 instrument 的預測層在每一個 AI 推薦之上 log 該次的 entry context，到期 settle，產出一份結構化的決策品質紀錄（實際 ROI、勝率、決策品質矩陣）。意圖是建立長期透明度：使用者可以在不同市場 regime 與策略類型下回頭稽核系統的歷史表現，把任何單次輸出當作長期紀錄裡的一個資料點來檢視。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（Web 部署在 Vercel）、Riverpod、go_router、fl_chart、Dio' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、httpx、APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI、Yahoo Finance、FinMind（三層 fallback 鏈 + 7 天 stale cache）' },
      { category: 'Database', items: 'Supabase（PostgreSQL）、Redis（Upstash）做 cache' },
      { category: 'Notifications', items: 'Web Push（VAPID / pywebpush），16 種通知 + 12 小時冷卻' },
      { category: 'Deployment', items: 'Vercel（前端 auto-deploy）+ Fly.io（後端 nrt region）' },
    ],
    impact: [
      '單一使用者的決策支援表面，覆蓋 8 個整合模組：市場數據中心、自選股與投資組合管理、AI 個股診斷、導引式選股、預測追蹤、財報基本面分析、智慧通知、盤後日報',
      '已 instrument 的預測層：每一次 AI 呼叫都帶 entry context 寫入 log、到期 settle（ROI、勝率、決策品質矩陣），讓系統做到完整 auditable',
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
  },
  {
    id: 'house-ops',
    title: 'House Ops — 台灣租屋市場的自動化找房管線',
    subtitle: '排程式 591 掃描器，把每筆租屋與買房物件依五個加權維度打分，每天 09:00 寄出 HTML email 簡報，再加上 Claude 互動層處理可負擔性試算、物件比較與看屋準備。',
    metaTitle: 'House Ops — 自動化找房管線 | Charles Chen 個人專案',
    metaDescription:
      'Node.js 自動化管線。每日掃描 591，把台灣租屋與買房物件依價格、空間、地段、屋況、風險五個維度加權評分，並透過 HTML email 簡報交付。AI Product Manager Charles Chen 的個人自動化案例研究。',
    problem: [
      '在 591 上找房是一個重複的「掃描 → 評估 → 丟棄」循環。物件常常只撐幾個小時就消失、價格會變、同一筆物件可能換另一個經紀人重 po，每次認真評估都要開三十幾個分頁互相比對：捷運距離、學區、屋齡、格局、經紀人風評。對只能晚上做這件事的上班族來說，漏斗寬到單日的雜訊就會把高優先序的物件埋掉。',
      '591 本身、以及大多數台灣租屋彙整網站，攤的是欄位、不負責判斷。它們列、排序、篩選，但不打分。一筆物件合不合理，看的是把租金、行政區中位數、格局與家庭人口、屋況、租賃風險串在一起的脈絡，這層整合平台沒做。使用者只能自己每天、每筆物件人工 synthesis。',
    ],
    solution: [
      '把 House Ops 蓋成一條 Node.js（ESM）自動化管線，由 macOS launchd 驅動。每天 09:00，run-daily.mjs 觸發一個 agent-browser session 掃過設定好的 591 搜尋區域，先和 data/last-scan.json（cache）與 data/scan-history.tsv（長期紀錄）做 dedupe，再寫出一份「新增、降價、下架」的 delta。',
      '每筆物件用啟發式評分跑過五個維度：價格合理度、空間與格局、地段機能、屋況、風險，加權合成 0–5 分（租屋是 30/20/25/15/10、買房是 35/20/20/15/10）。關鍵字偵測會抓出捷運、學區、電梯、陽台、樓層、整修狀態。≥4.0 標為推薦、3.5–3.9 為謹慎參考、低於 3.5 直接跳過。',
      '結果透過 nodemailer + Gmail SMTP 渲染成一封 HTML email 寄出，趕在早晨咖啡時間之前抵達。內容含新上架表（分數、行政區、租金、坪數、格局、警示、591 連結）、降價列、下架條目、行政區拆解。另一層住在 Claude Code 裡：in-session 互動模式做可負擔性試算、升級規劃、物件並排比較、看屋當天 checklist，以及 ad-hoc 的 scan / pipeline 指令。自動化管線負責漏斗，互動模式負責看屋與 trade-off 周邊那些需要人類判斷的時刻。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js（ESM, .mjs）' },
      { category: 'Scraping', items: 'agent-browser（591 搜尋與物件頁抓取）' },
      { category: 'Email', items: 'nodemailer over Gmail SMTP（App Password 驗證）' },
      { category: 'Scheduling', items: 'macOS launchd（com.house-ops.daily.plist，每日 09:00）' },
      { category: 'Persistence', items: 'data/last-scan.json（cache）、data/scan-history.tsv（歷史）、data/tracker.md（生命週期）、data/pipeline.md（佇列）' },
      { category: 'Interactive Layer', items: 'Claude Code modes（affordability、upgrade plan、compare、prepare visit、pipeline、scan）' },
      { category: 'Source', items: '591.com.tw（租屋 + 買房）' },
    ],
    impact: [
      'Scheduled scanning：macOS launchd 每天 09:00 觸發 run-daily.mjs，結果與持久化掃描歷史（data/last-scan.json cache + data/scan-history.tsv 長期紀錄）做 dedupe',
      'Five-dimension scoring：每筆物件依價格合理度、空間與格局、地段機能、屋況、風險五項分別打分，加權合成 0–5 分（租屋 30/20/25/15/10、買房 35/20/20/15/10）',
      'Daily email digest：透過 nodemailer + Gmail SMTP 寄出 HTML 簡報，內容含新上架、降價、下架、行政區拆解，趕在早晨咖啡時間之前抵達',
      'Stateful tracker：每筆已評估物件依 Scanned → Evaluated → Visit → Signed 生命週期保存於 data/tracker.md',
      'Interactive Claude modes：in-session 可負擔性計算機、升級規劃、物件並排比較、看屋當天 checklist，以及 ad-hoc 的 scan / pipeline 指令，疊在自動化管線上面',
    ],
    learnings: [
      'launchd 是 macOS 上「需要登入使用者環境」這類個人自動化的合適排程原語。cron 跑在 detached 狀態、繼承到的環境最小化，跟 keychain（Gmail 密碼）、GUI 子系統（某些 headless browser 模式）、process 監督都會打架。launchd 會尊重 pmset 喚醒設定、整合系統 log、重開機後不用手動 reseed。對日跑型的個人自動化來說，可營運天花板高很多。',
      '一開始試過硬門檻過濾：租金 ≤ X、捷運步行 ≤ Y、屋齡 ≤ Z。priority 一變整個輸出就抖動：一筆便宜合理的物件因為樓層差一層被踢掉，一筆比較貴只是踩中所有預設值的物件卻溜進候選。改成維度加權、0–5 合成分、三段決策（≥4.0 推薦、3.5–3.9 謹慎、<3.5 跳過）後，邊界候選不會被誤殺，trade-off 也直接攤在分數面上。',
      '一開始覺得 Web dashboard 是個人工具的標準介面，後來真實的早晨流程做了選擇。第一個被打開的是手機，在還沒下床的時候。Email 直接落在那個情境裡：小螢幕掃得動、可歸檔當紀錄、可依日期搜。Dashboard 要主動去開，Email 直接出現在注意力本來就在的地方。',
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
]
