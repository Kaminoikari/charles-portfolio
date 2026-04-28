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
      '我自己用的台股 AI 副駕駛。Gemini 把財報、籌碼整理好，省掉每天人肉拉資料的時間；預測追蹤 + 盤後 AI 自我檢討把回饋迴路收起來，作為後續 prompt 與模型 fine-tune 的基礎。',
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
      '把 Path 蓋成一支離線優先的 Progressive Web App。架構上要回答的不是「該做 native 還是 web」，而是「怎麼做出一支沒網路也能跑的 web app」。PWA 同時回答了兩件事：iOS / Android 都可以從一個 URL 直接安裝到主畫面、用 Service Worker 拿到完整離線能力、不用過 app store、沒有 native build、不付平台稅。',
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
      'Google Maps API 費用是看 route 呼叫量、不是看使用者數。積極快取策略：路線快取 24h、地點永久快取、選定的 transit polyline 直接寫在行程本身上。使用量上去後 API 開銷維持平的，離線體驗也沒打折。每一筆能命中 cache 的呼叫，剛好就是一筆沒網路也能跑的呼叫。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/path' },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — 我自己用的台股 AI 副駕駛',
    subtitle: '為了不再每天花好幾小時翻月營收、季報、籌碼面，自己做給自己用的 AI 工具。',
    metaTitle: 'Plutus Trade — 個人台股 AI 副駕駛 | Generative AI 案例',
    metaDescription:
      '個人用台股 AI 副駕駛：Gemini AI 個股診斷、一鍵選股、預測追蹤、盤後 AI 自我檢討。台灣 AI Product Manager Charles Chen 的 generative AI 案例研究。',
    problem: [
      '人肉研究台股很花時間。月營收要拉、YoY/MoM 要交叉比對、季報的 EPS 與毛利率要解讀、三大法人買賣超要看、K 線要掃，最後才形成觀點。Watchlist 上每一檔、每一天都得重來一次。',
      '我也不想再做一支消費型 SaaS。我要的是一個自己用的副駕駛，幫我做完這些統整、把它的預測記下來，把我原本要花一個晚上拉資料的時間還給我。',
    ],
    solution: [
      '把 Plutus Trade 蓋成自己用的台股 AI 副駕駛。Gemini 2.5 Flash 一次讀完月營收（YoY/MoM/累計）、季報基本面（EPS、毛利率、ROE、股利）、法人籌碼、技術指標，回傳一段白話的 BUY/SELL/HOLD 診斷，並附上推論。重點不是取代判斷，而是把一個晚上的研究壓縮成一段話。',
      '加上一鍵選股流程。3 步驟投資者設定精靈（風險偏好、時間區間、產業偏好）把限制條件交給 AI，AI 回傳精選名單並附上每一支的理由。省掉「為了挑出 3 檔值得細看的、要先點 30 檔」那段工作流。',
      '在每一個 AI 推薦之上蓋一層預測追蹤。每一筆推薦都帶 entry context 寫進 log，到了時間再 settle：實際 ROI、勝率、決策品質矩陣。16:30 的盤後日報內含 AI 自我檢討，把昨天的決策對齊實際發生的結果。回饋迴路收起來後，就拿到一批標註好的資料，可以拿來持續 fine-tune prompt（之後還可以拿來訓練模型）。',
      '一開始有做三階段訂閱模型（Free / Pro / Premium）+ Apple In-App Purchase，後來把它拔了。當目標收斂成「我自己信任的工具」，那些 SaaS 鷹架就只是阻力：給一個使用者的 auth flow、永遠都會解鎖的 tier gating、根本不會跟誰收費的金流整合。拔掉後，產品可以單純為分析深度做最佳化，而不是為升級率最佳化。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（Web 部署在 Vercel）、Riverpod、go_router、fl_chart、Dio' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、httpx、APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI、Yahoo Finance、FinMind（含 fallback 鏈 + 7 天 stale cache）' },
      { category: 'Database', items: 'Supabase（PostgreSQL）、Redis（Upstash）做 cache' },
      { category: 'Notifications', items: 'Web Push（VAPID / pywebpush），16 種通知 + 12 小時冷卻' },
      { category: 'Deployment', items: 'Vercel（前端 auto-deploy）+ Fly.io（後端 nrt region）' },
    ],
    impact: [
      '個人 AI 副駕駛，覆蓋 8 個整合模組：數據中心、自選股／投資組合、AI 個股診斷、一鍵選股、預測追蹤、財報基本面、智慧通知、盤後日報',
      '閉環預測系統：每一次 AI 呼叫都被 log、到期 settle、再進次日報自我檢討，累積出後續 prompt 迭代與模型 fine-tune 需要的有標註資料集',
      '三層資料源 fallback（FinMind → Yahoo Finance → TWSE/TPEX OpenAPI）+ stale-cache 安全網，任何一家服務掉了 AI 還是有飯吃',
      '動態快取策略：盤中 5 分鐘、收盤後快取到下一個交易日 09:00、週末快取滾到週一',
    ],
    learnings: [
      'LLM 輸出品質高度受 prompt 結構影響。結構化 prompt（明確指定 JSON schema 輸出）+ few-shot 範例，把 Gemini 的幻覺率比 free-form prompt 降低約 60%。',
      '金融類 AI 產品需要更多護欄。每一頁 AI 輸出都附上免責聲明，BUY/SELL/HOLD 標籤一律包成「分析輸出」、不是投資建議。即便是個人工具，這條限制也要早早釘進去：它擋住我把判斷外包給模型的傾向。',
      '把訂閱拔掉是這個專案最讓人腦袋清醒的決定。一旦確認這是「我做給自己的工具」，每一條「萬一免費使用者怎樣」的權衡就一起消失。Build constraint 來自於你為誰而做；先把這件事釘對，比任何單一 feature 都重要。',
      '預測追蹤這層比預測本身更值錢。AI 是簡單的部分；「AI 當時怎麼說、實際怎麼發生、為什麼錯」這份標註好的歷史，才是讓系統會隨時間變好的護城河。這也是我未來任何 fine-tuning 工作想要的基礎。',
    ],
    links: [
      { label: 'Try Plutus Trade', url: 'https://plutustrade.vercel.app/' },
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
      '關鍵架構決策是把 22 個成熟的產品框架（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD 等）當作結構化 prompt，而不是 free-form 生成。每一個框架把 AI 的輸出限制在資深 PM 真實會用的思考模式上，貫穿 Discovery、Define、Develop、Deliver 四個階段。',
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
      'LLM orchestration 是產品設計問題，不只是工程問題。框架的執行順序很重要：Persona 在 JTBD 之前跑，輸出會更好，因為使用者脈絡會引導 job 的識別。花了不少時間優化 pipeline 順序。',
      'Skill-based 發佈（Claude Code 生態系）是非常強的通路。使用者在自己既有的工作流裡發現工具，不需要為了它去採用新平台。',
      '身為 AI Product Manager 打造 AI agent，最大的洞察是：產品價值不在 AI，而在框架。AI 是交付機制，但 22 個產品框架才是真正的智慧財產。任何人都能呼叫 LLM API，差異在於知道要問它什麼。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
]
