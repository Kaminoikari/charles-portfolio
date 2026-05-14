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
      '「當網路消失，你的行程不該隨之蒸發。」為不穩定網路環境設計的 PWA：採用 Cache-first + 背景同步架構，行程、地圖路線與花費紀錄都能離線使用，一個 URL 即可安裝到 iOS 與 Android 主畫面。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      '「將一整張交易桌的分析戰力，收斂進一次 AI 合成 (Synthesis)。」專為單一交易者打造的深度分析工具：整合月營收、基本面、法人籌碼與技術結構由 Gemini AI 跨領域合成診斷，每一筆推薦都經「儀器化」處理長期追蹤勝率與 ROI，底層以量化動能模型篩選候選池確保語意推論建立在紮實數據上。',
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
      '「把原本對準你的武器，反過來為你所用。」自動化的個人求職管線：每天 07:00 從 104 抓新職缺、依你的 Markdown 履歷打分、寄出推薦 / 觀察 / 跳過三段日報。需要深度判斷時（公司合法性、職等策略、面試準備），7 個 Claude Code 互動模式接手。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/job-ops',
    tags: ['Python', 'launchd', 'CV-aware', 'Automation'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — 離線優先旅遊行程 PWA',
    subtitle: '「當網路消失，你的行程不該隨之蒸發。」這是一個專為「不穩定網路環境」設計的 Progressive Web App (PWA)，確保旅人在最無助的時刻，依然能掌握所有導航與資訊：斷網不斷片（即使在東京地鐵深處或偏遠溫泉鄉，交通、花費與路線依然觸手可及）、零延遲體驗（採用離線優先架構，讀取瞬間完成，變更自動同步）、跨平台安裝（無須透過 App Store，一個 URL 即可安裝至 iOS 或 Android 主畫面）。',
    metaTitle: 'Path — 離線優先旅遊行程 PWA | Charles Chen 產品案例',
    metaDescription:
      '為不穩定網路環境設計的 Progressive Web App：Cache-first + 背景同步架構，採用 React、TypeScript、Supabase 與 IndexedDB，讓行程、交通與花費紀錄在沒網路時也能完整運作。AI 產品經理 Charles Chen 的旅遊產品案例。',
    problem: [
      '市面上主流的行程 App（如 Wanderlog、Tripit）大多預設使用者「永遠在線」。但在跨國旅遊中，這往往是一個奢侈的假設。',
      '信號黑洞：機場 WiFi 雖然順暢，但到了地鐵月台、地下街或鄉間溫泉，行程往往變成一片空白。',
      '連線不穩定：國外行動數據昂貴且不穩。一旦 Pocket WiFi 沒電或 eSIM 在關鍵時刻斷訊，整團人的行程與交通指引就會陷入癱瘓。',
      '工具的矛盾：一個需要網路才能運行的工具，偏偏會在最糟（沒訊號、急需找路）的時候掛掉。',
    ],
    solution: [
      'Path 不只是將網頁變成 App，而是從底層架構重新定義「沒網路也能跑的 Web App」。',
      'PWA 架構策略：選擇 PWA 而非原生（Native），是因為它能同時解決跨平台安裝與離線運行的難題。透過 Service Worker，我們拿到了與原生 App 同等的權限，卻不需要付「平台稅」或等待繁瑣的 App Store 審核。',
      '快取優先（Cache-first）策略：讀取時所有請求優先打向本地的 IndexedDB，達成「瞬間 Render」，最新資料在背景默默與 Supabase 同步；寫入則採用「樂觀更新（Optimistic UI）」，使用者點擊的當下 UI 立即反應，編輯請求會先排入 Sync Queue，連線恢復後自動重播（Replay）。',
      '針對旅日台人的特化規劃：整合 Google Maps 景點與路線，並針對日台常見大眾運輸提供特化標籤（車種圖示、步行時間、路線顏色）；另含多幣別花費管理、照片與文件附件，並提供常用行程樣板一鍵套用。',
      '安全隔離：利用 Supabase 的 Row Level Security (RLS)，確保多使用者環境下的資料存取安全。',
    ],
    techStack: [
      { category: '前端框架', items: 'React 18, TypeScript, Vite, TailwindCSS' },
      { category: '離線技術', items: 'IndexedDB (via idb), Service Worker, PWA Manifest' },
      { category: '狀態管理', items: 'TanStack Query（伺服器同步）、@dnd-kit（行程拖拉排序）' },
      { category: '後端服務', items: 'Supabase (PostgreSQL, Auth, Storage, RLS)' },
      { category: '地圖整合', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: '部署環境', items: 'Vercel' },
    ],
    impact: [
      '100% 離線可用：核心行程、地圖路線與財務紀錄在完全斷網時依然運作如常。',
      '極致流暢的 UI：快取優先機制消滅了所有的 Loading Spinner，寫入操作保證不掉失。',
      '情境化設計：精準捕捉日台旅遊痛點，車種顏色與圖示直接對應真實世界的導引看板。',
      '極低維護成本：單一 Codebase 達成跨系統安裝，省去原生 App 開發與多平台發布的成本。',
    ],
    learnings: [
      'PWA 是一個關於「承重」的決策。開發初期我意識到，如果走原生 App 路線，開發能量會被兩份 Codebase 與審查機制稀釋。而「沒網路怎麼辦」這個核心命題，在 PWA 的 Service Worker + IndexedDB 體系下，反而能得到更優雅、更具原生性的網頁解法。',
      '同步邏輯的現實挑戰：「快取優先 + 背景同步」在理論上很優雅，但實作上卻很骨感。最大的挑戰在於處理「衝突」，例如兩支手機離線編輯同一份行程後同步。我最終選擇了 Last-write-wins + Timestamp 的合併策略，這在單人旅遊或偶爾跨裝置的場景中，是最能在性能與開發成本間取得平衡的實作。',
      '精確的成本控管：由於 Google Maps API 開銷與請求量成正比，我實施了積極的快取策略：地點永久快取、路線快取 24 小時。這不僅讓 API 費用維持在極低水位，更創造了一個有趣的技術副產品：每一筆為了省錢而命中的快取，剛好就是一筆「沒網路也能看」的行程路徑。',
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
    subtitle: '「將一整張交易桌的分析戰力，收斂進一次 AI 合成 (Synthesis)。」這是一套專為單一交易者打造的深度分析工具。它不只是顯示數據，而是將原本耗時數小時的「財報 + 籌碼 + 技術面」研究循環，壓縮成一次具備邏輯推論的決策建議：全維度合成（整合月營收、基本面、法人籌碼與技術結構，由 Gemini AI 進行跨領域診斷）、可稽核的決策（每一筆 AI 推薦都經過「儀器化（Instrumented）」處理，長期追蹤勝率與 ROI）、量化底層架構（以量化動能模型篩選候選池，確保 AI 的語意推論建立在紮實的數據基礎上）。',
    metaTitle: 'Plutus Trade — 個人用台股 AI 決策支援工具 | 案例研究',
    metaDescription:
      '為主動操作的台股研究工作者打造的單一使用者決策支援工具：Gemini 驅動的跨領域 synthesis、導引式選股、已 instrument 的預測追蹤層。台灣 AI Product Manager Charles Chen 的 generative AI 案例研究。',
    problem: [
      '對於主動操作台股的實務工作者來說，最昂貴的成本不是資金，而是研究時間。',
      '分析量能爆炸：每一檔股票都需要處理月營收 YoY/MoM、季報 EPS/毛利、法人買賣超與 K 線結構。當自選股達到 30–50 檔時，分析工作量會直接擊穿任何非全職交易者的時間預算。',
      '市場工具的兩極化：現有的看盤 App 只負責「攤開數據」但不解讀；投顧產品則直接給「明牌」但不透明。',
      '信任缺口：市場缺乏一種工具，能服務具備領域素養、想要 AI 加速分析、卻又需要能「親自稽核 AI 邏輯」以建立長期信任的中堅交易者。',
    ],
    solution: [
      'Plutus Trade 將自己定位為你的個人數位分析師，將質性的投資條件翻譯成 AI 可執行的指令契約。',
      'AI 跨領域診斷：透過 Gemini 2.5 Flash 對 watchlist 進行跨維度合成分析。系統會回傳帶有明確推論的 BUY/SELL/HOLD 診斷，將輸出框架在「專業分析」層級，並保留最終決策權給使用者。',
      '導引式選股（Guided Discovery）：透過三步驟投資人 Profile（風險偏好、持有區間、產業偏好），將漫長的市場掃描收斂成一次高質量的互動，直接產出精選清單與選股理由。',
      '混合量化層（Hybrid Quant Layer）：系統不只依賴語意推論。每日 14:00 會先執行量化模型，計算全市場 8 大動能特徵與百分位排序（Percentile Rank），由數據排序為 AI 進行「布底」，確保 LLM 專注在它最擅長的語意推論。',
      '完整的稽核機制：所有的預測層都經過儀器化紀錄（Log entry context）。當推薦到期結算時，系統會產出結構化的決策品質矩陣（實際 ROI、勝率）。這讓使用者能跨越市場週期，回頭審視系統在不同階段的表現。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（跨平台支援，部署於 Vercel）' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、APScheduler' },
      { category: 'AI Engine', items: 'Google Gemini 2.5 Flash（負責 Narrative Synthesis）' },
      { category: 'Quant Engine', items: '自製動能 Scoring 層（8 特徵加權 + Redis 快取）' },
      { category: 'Data Sources', items: '三層 Fallback 鏈（FinMind → Yahoo Finance → TWSE OpenAPI）' },
      { category: 'Persistence', items: 'Supabase（PostgreSQL）、Redis（Upstash）做盤中快取' },
      { category: 'Deployment', items: 'Fly.io（後端 nrt region）+ Vercel（前端）' },
    ],
    impact: [
      '全功能覆蓋：單一界面整合市場數據、AI 診斷、導引選股與預測追蹤等 8 個模組',
      '數據韌性保證：透過三層資料源 Fallback 與 7 天 Stale-cache 安全網，確保在上游服務退化時，工具依然具備分析能力',
      '可審核的信任：每一筆 AI 呼叫皆可溯源與結算，解決了 AI 在金融決策中常見的「黑盒子」問題',
      '盤勢感知快取：根據交易時段自動調整 TTL（盤中 5 分鐘、週末鎖定），在節省 API 開銷的同時維持即時性',
    ],
    learnings: [
      '「Prompt Contract 的設計，決定了 AI 決策的品質。」在開發過程中我發現，多數「模型不夠強」的抱怨，其實可以透過上游的結構化約束解決。透過 JSON Schema 限制輸出格式並引入 Few-shot anchors，我成功將 Gemini 的幻覺率降低了約 60%。',
      '產品設計的邊界感：在金融產品中，「分析」與「建議」的界線必須在介面層強制切割。產品的工作不是無止盡地滿足模型的所有回應，而是將其框架在附帶免責聲明的專業分析中。',
      '「為一個人設計」的策略優勢：將受眾鎖定在「單一具備專業素養的使用者」，是一個刻意的產品策略。這讓我得以消除所有針對新手的冗餘設計，釋放出所有的設計表面積，全力追求分析的深度與系統的可稽核性。在決策支援工具的世界裡，「可靠度」與「透明度」就是最高順位的價值主張。',
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
    title: 'Job Ops — 候選人視角的個人版 ATS',
    subtitle: '「把原本對準你的武器，反過來為你所用。」這是一條自動化的個人求職管線（Python Pipeline），旨在解決求職過程中資訊不對稱的痛點。它將企業端用來篩選人的「申請人追蹤系統（ATS）」邏輯反向操作：每天 07:00 由 macOS launchd 觸發自動從 104 抓取新職缺、根據你的 Markdown 履歷進行精準打分、透過 7 個 Claude Code 互動模式提供從薪資調查到面試準備的深度策略。',
    metaTitle: 'Job Ops — 候選人視角的個人版 ATS | Charles Chen 個人作品',
    metaDescription: '自動化的 Python 求職管線：每天 07:00 把 ATS 邏輯反向操作，從 104 抓新職缺、依 Markdown 履歷與個人權重打分，寄出三段日報；搭配 7 個 Claude Code 互動模式處理公司合法性、職等策略、薪資談判、面試準備。AI 產品經理 Charles Chen 的個人求職 OS。',
    problem: [
      '在求職市場中，企業端擁有強大的 ATS 系統，每天自動化篩選、排序並淘汰上百位候選人。然而，候選人端卻缺乏對應的工具，只能陷入低效率的循環。',
      '肉眼篩選的極限：同時追蹤 30 到 50 個目標職缺，大腦難以平衡薪資、地點、規模與遠端政策等多重變因，讀到第 8 個職缺就開始疲勞，最終被迫接受平台的「推薦排序」。',
      '篩選條件太過僵硬：現有平台只能篩選薪資下限或地點等硬性指標，無法表達「成長性 > 薪資 > 通勤」這類加權偏好。',
      '缺乏動態調整空間：無法根據求職階段（前期海投 vs. 後期收網）調整評估權重，候選人被迫自己擔任低效的「匹配引擎」。',
    ],
    solution: [
      'Job Ops 將 HR 的結構化評分流程反轉，讓職缺成為被篩選的對象。',
      '自動化評價流程：每天 07:00 透過 macOS launchd 啟動，從 104 抓取職缺後餵進 CV-aware evaluator。系統會讀取你的 Markdown 履歷，並對照定義在 YAML 中的「候選人原型」，逐項評分。',
      '多格式報表：在 07:30 前將報告送達。手機端讀取 Gmail HTML 日報，同時同步 Markdown 版本至 Obsidian，供月底回顧。',
      '可程式化的價值觀：評分權重（薪資、遠端、成長性等）完全外接到 YAML 設定檔。切換求職策略只需修改一行代碼。更重要的是，當 YAML 進入 Git 管理後，每次 commit 都記錄了你優先順序的演變，成為最真實的求職軌跡紀錄。',
      '人機協作模式：Pipeline 處理規律且大量的爬蟲、去重、評分與寄信；Claude Code 互動層處理需要深度的判斷工作，如公司合法性、職等策略（IC vs 管理職）、薪資談判與面試對位。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Python 3.11+ (asyncio)' },
      { category: '爬蟲', items: 'httpx（串接 104 API、UA 輪替、速率限制）' },
      { category: 'CV 攝入', items: 'cv_reader 將 Markdown 履歷解析為結構化訊號' },
      { category: '評分引擎', items: '多維度加權分析，輸出 RECOMMEND / CAUTIOUS / SKIP 三段評價' },
      { category: '設定管理', items: 'YAML（儲存搜尋條件與個人偏好權重）' },
      { category: '通知系統', items: 'Gmail SMTP（發送 inline-styled HTML 與 Markdown 雙版本）' },
      { category: '自動化排程', items: 'macOS launchd（com.job-ops.daily）' },
      { category: '持久化', items: 'TSV scan-history（追蹤職缺生命週期、價格變動與重複貼文）' },
      { category: '互動層', items: '整合 7 個 Claude Code 專業模式（如 interview-prep、comp-research）' },
      { category: '測試', items: 'pytest、pytest-asyncio' },
    ],
    impact: [
      '高效收斂資訊：每天將 30–50 個原始職缺，精煉成一份可在早餐時間讀完的三段式日報。',
      '策略靈活切換：透過修改 config 即可從「海投模式」轉向「精準收網」，無須變更任何邏輯代碼。',
      '深度決策支援：透過 7 個 AI 互動模式補足了資訊盲點（例如透過論壇來源查核公司合法性、IC 與管理職的薪資博弈）。',
      '雜訊最小化：TSV 追蹤機制讓「職缺更新」以 diff 註記呈現於同一列，避免重複貼文累積成三行噪音，保持資訊純淨。',
    ],
    learnings: [
      '工程組件只是骨架，真正核心的決策是「這把尺指向誰」。這個專案的價值在於打破求職市場的不對稱：HR 每天用自動化工具衡量候選人，而我選擇將這把尺反過來，拿來衡量職缺。這不僅提升了效率，更讓我奪回了篩選的主動權。',
      '此外，「權重與邏輯分離」的設計帶來了意外的收穫。因為 YAML 與 Git 結合，我的求職歷程不再只是破碎的報告，而是一段「個人優先順序移動」的時間戳。',
      '最後，這套「Pipeline + 互動模式」的雙層架構展現了極佳的泛用性。將確定性的工作（爬蟲、排序）留給程式，將模糊的判斷（戰略、談判）留給 AI 互動，這種設計模式在我其他的自動化專案（如 house-ops）中同樣適用。',
    ],
    links: [
      { label: 'GitHub（private repo）', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
