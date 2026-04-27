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
      '離線優先的旅遊行程規劃 App。整合 Google Maps、大眾運輸路線、花費追蹤，與拖拉式行程管理。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['React', 'TypeScript', 'Supabase'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      'AI 驅動的台股選股平台。即時報價、K 線圖、Gemini AI 個股診斷、一鍵選股，以及預測追蹤系統。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description:
      'AI 驅動的產品規劃系統。22 個框架、6 種執行模式，自動產出開發 handoff——從一句話想法到完整 spec 只要幾分鐘。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — AI 旅遊規劃 App',
    subtitle: '把旅遊規劃從「埋在資料堆裡的好幾個小時」變成拖拉式體驗的 AI SaaS 產品。',
    metaTitle: 'Path — AI 旅遊規劃 App | Charles Chen AI 產品案例',
    metaDescription:
      '整合 Google Maps、大眾運輸、花費追蹤的 AI SaaS 旅遊規劃 App。台灣 AI Product Manager Charles Chen 的真實 AI 產品案例研究。',
    problem: [
      '旅遊規劃是碎片化的。旅人為了安排一趟行程，得在 Google Maps、訂房平台、Excel、群組訊息之間來回切換。市場上沒有任何工具同時把路線規劃、花費追蹤、行程管理整合在一起——更別說一個能在收訊不穩的國外環境離線運作的版本。',
      '既有的旅遊 App 不是專注訂購（Booking.com、Agoda），就是強調分享（TripAdvisor），都沒有解決真正的規劃工作流：「我每天要做什麼？怎麼到那裡？花費多少？」',
    ],
    solution: [
      '打造離線優先的旅遊規劃 App，核心是拖拉式的每日行程時間軸。每一天都是一條由景點組成的時間線，整合 Google Maps 顯示景點之間的路線。使用者一眼就看得到通勤時間、距離與花費。',
      '最關鍵的產品決策是「離線優先」——所有行程資料同步到 local storage，旅人即使沒網路也能查行程。這直接解掉國際旅人最痛的第一名問題。',
      'UX 設計圍繞「漸進式複雜度」：先輸入目的地與日期，再逐層加入景點、路線、花費、備註。新使用者不到 2 分鐘就能建出第一份完整行程。',
    ],
    techStack: [
      { category: 'Frontend', items: 'React, TypeScript, Tailwind CSS, PWA (Service Worker)' },
      { category: 'Backend', items: 'Supabase (PostgreSQL, Auth, Realtime)' },
      { category: 'Maps', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      '由 solo AI Product Builder 從 0 到 1 完整打造的 AI SaaS 產品',
      '離線優先架構——沒網路也能讀行程',
      '不到 2 分鐘的 onboarding，新使用者就能完成第一份完整行程',
      '展示完整產品生命週期：研究 → 設計 → 建構 → 上線',
    ],
    learnings: [
      '離線優先聽起來簡單，實際上要小心管理狀態。本地與遠端資料的衝突解析是最難的工程問題——最後用 last-write-wins + timestamp 合併解掉。',
      'Google Maps API 費用累積得很快。實作積極快取（路線快取 24h、地點永久快取）把 API 成本壓下來，且不犧牲 UX。',
      '身為 AI Product Manager 自己打造產品，最大的收穫是：當你能在同一個下午從產品決策走到部署上線，迭代速度會完全不一樣。沒有 handoff delay、沒有 spec 誤解。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — AI 台股分析平台',
    subtitle: '把法人級的選股分析帶給散戶投資人的 generative AI 產品。',
    metaTitle: 'Plutus Trade — AI 台股分析 | Generative AI 產品案例',
    metaDescription:
      '整合 Gemini AI 個股診斷、K 線圖、預測追蹤的 AI 驅動台股平台。台灣 AI Product Manager Charles Chen 的 generative AI 產品案例研究。',
    problem: [
      '台灣散戶投資人取得不到法人在用的分析工具。多數散戶靠直覺、社群消息、或只能看不能解讀的基本看盤 App。',
      '問題不在「資料」，在「分析能力」。K 線、營收報告、法人籌碼資料其實公開可得，但要把它們綜合成可行動的洞察，需要多數散戶沒有的專業知識。',
    ],
    solution: [
      '打造 AI 驅動的台股分析平台，用 Gemini AI 把多種資料源——價量行為、技術指標、法人交易模式、財報——綜合成一段白話的個股診斷。',
      '核心產品創新是「一鍵選股」：使用者描述自己想找的股票（例：「營收成長中、被低估的科技股」），AI 回傳一份精選名單並附上每一支的選股理由。取代過去要花好幾小時的人工篩選。',
      '加入預測追蹤系統，記錄每一個 AI 推薦並追蹤其長期準確度。透明化建立使用者信任——使用者可以直接看到 AI 推薦的歷史表現。',
      '採用三階段訂閱模型（Free / Pro / Premium）並逐層解鎖功能。AI 分析的深度隨方案升級遞增，給使用者明確的升級理由。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter (iOS)' },
      { category: 'Backend', items: 'FastAPI (Python), APScheduler' },
      { category: 'AI', items: 'Google Gemini 1.5 Pro' },
      { category: 'Data', items: 'FinMind API（台股資料）, Yahoo Finance API（國際報價）, Redis caching' },
      { category: 'Database', items: 'Supabase (PostgreSQL)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      '完整的 AI SaaS 產品，含訂閱模型與金流整合',
      'Gemini AI 整合，提供繁體中文即時個股診斷',
      '預測追蹤系統，量測歷史準確度',
      '動態快取策略——盤中 5 分鐘、收盤後 1 小時、週末 24 小時',
    ],
    learnings: [
      'LLM 輸出品質高度受 prompt 結構影響。結構化 prompt（明確指定 JSON schema 輸出）+ few-shot 範例，把 Gemini 的幻覺率比 free-form prompt 降低約 60%。',
      '金融類 AI 產品需要更多護欄。每一頁 AI 輸出都附上免責聲明，系統絕不給明確的買/賣建議，只給分析。這是基於法規意識的產品決策。',
      '做訂閱 SaaS 讓我學到分層差異化的重要性。第一版免費方案塞太多功能，使用者沒有升級理由。重新以「分析深度」為主軸（basic → advanced → deep）後，升級意願明顯提升。',
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
      '既有的 AI 寫作工具（ChatGPT、Notion AI）能產文字，但不懂產品框架。它們不會做 JTBD 分析、不會建出 RICE-scored backlog、也不會把 user persona 對應到功能需求——它們只會生成通用段落。',
    ],
    solution: [
      '打造一個跨 Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill 三種發佈管道的 AI agent，將多個產品框架編排成一條 spec 產生 pipeline。使用者用一句話描述產品想法、選擇執行模式，agent 產出一份完整 spec 文件。',
      '關鍵架構決策是把 22 個成熟的產品框架（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD 等）當作結構化 prompt，而不是 free-form 生成。每一個框架把 AI 的輸出限制在資深 PM 真實會用的思考模式上，貫穿 Discovery、Define、Develop、Deliver 四個階段。',
      '設計 6 種執行模式——Quick、Full、Revision、Custom、Build、Feature Expansion——讓 PM 能依產品階段挑工具的深度。功能實驗不需要 50 頁 spec，但新產品上線確實需要完整 dev handoff。',
      '建出 change propagation engine，當上游決策改動時自動更新下游文件；再加上三層 PDF 解析（pymupdf 純文字 → Claude Vision 語意 → Tesseract OCR fallback），讓使用者可以直接上傳既有的 PDF/DOCX/PPTX 研究資料。',
      '自動 dev handoff 產出 CLAUDE.md、TASKS.md、TICKETS.md，把產品需求轉成帶驗收條件的技術任務，縮短 PM → 工程師 的溝通落差。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin, Claude Code Skill' },
      { category: 'AI', items: 'Claude (Anthropic) — LLM orchestration, Claude Vision (PDF 語意解析)' },
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
      '多通路發佈——Claude.ai、Claude Code Plugin、Claude Code Skill——直接在使用者既有工作流裡相遇',
    ],
    learnings: [
      'LLM orchestration 是產品設計問題，不只是工程問題。框架的執行順序很重要——Persona 在 JTBD 之前跑，輸出會更好，因為使用者脈絡會引導 job 的識別。花了不少時間優化 pipeline 順序。',
      'Skill-based 發佈（Claude Code 生態系）是非常強的通路。使用者在自己既有的工作流裡發現工具，不需要為了它去採用新平台。',
      '身為 AI Product Manager 打造 AI agent，最大的洞察是：產品價值不在 AI——而在框架。AI 是交付機制，但 22 個產品框架才是真正的智慧財產。任何人都能呼叫 LLM API，差異在於知道要問它什麼。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
]
