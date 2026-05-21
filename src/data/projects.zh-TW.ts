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
  features?: { label: string; description: string }[]
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
      '「讓 AI 擁有資深 PM 的大腦，將靈光乍現轉化為可開發的規格。」這是一套基於 LLM 編排的多 Agent 系統。內建 22 款專業產品框架，並透過 3 位專家 Sub-agent 獨立分工，深度執行產品探索、策略批判與風險推演。完美嵌入 Claude 生態系工作流，自動產出帶有驗收條件（AC）的開發文件，達成無縫的技術對接（Dev Handoff）。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Multi-Agent', 'Claude Code', 'AI/LLM'],
  },
  {
    id: 'house-ops',
    title: 'House Ops',
    description:
      '「在房產資訊的大海中，讓優質物件主動來找你。」基於 Node.js 與 AI 的個人化房產決策管線：每日 09:00 自動掃描 591 與 Facebook 租屋社團、Claude API 把混亂貼文抽成結構化數據、五維加權打分把感性看房直覺轉成科學指標，並整合 Claude Code 提供首購試算到換屋規劃的深度顧問模式。',
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
    title: 'Product Playbook — 產出 spec 的 Multi-Agent System',
    subtitle: '「讓 AI 擁有資深 PM 的大腦，將靈光乍現轉化為可開發的規格。」本系統專為縮短「點子」到「開發任務」的巨大鴻溝而設計，具備四大核心架構：',
    features: [
      { label: '框架導向生成', description: '內建 JTBD、RICE 等 22 套產品框架，強迫 AI 以資深 PM 思維深度推論，拒絕通用型的空泛輸出。' },
      { label: 'Multi-Agent Orchestration', description: '部署 3 位專家 Sub-agent 獨立執行探索與策略批判，將深度判斷從主 Agent 擁擠的 Context 中解放。' },
      { label: '全通路生態嵌入', description: '整合 Claude.ai Custom Skill 與 Claude Code 終端工具，不改變既有習慣，直接嵌入 PM 現有工作流。' },
      { label: '自動化技術對接', description: '一鍵轉譯帶驗收條件的規格文件與 CLAUDE.md，達成無縫的技術交接（Dev Handoff）。' },
    ],
    metaTitle: 'Product Playbook — Multi-Agent 規格產生系統 | LLM 產品案例',
    metaDescription:
      'A Multi-Agent product planning system on Claude Code: 22 PM frameworks orchestrated with 3 specialist sub-agents (discovery, strategy critique, pre-mortem) for automated Dev Handoff. AI PM Charles Chen — LLM orchestration case study.',
    problem: [
      '傳統規格撰寫成本極高：一份及格的產品需求文件（PRD）需整合用戶研究、競品分析與技術限制，通常耗時數天，常成為團隊開發的進度瓶頸。',
      '通用型 AI 的產品思維侷限：ChatGPT 或 Notion AI 雖能產出文字卻「不懂產品」，無法自動進行 JTBD 分析或依 RICE 模型排序優先級，流於通用廢話。',
      '單一 Context 的記憶稀釋：若強行讓單一 AI 攜帶所有框架，其分析深度會被龐大的記憶互相干擾。產品探索所需的同理心、策略階段所需的批判性，與風險推演所需的悲觀想像，是三種截然不同的工作模式，難以在同一個對話中並存。',
      '溝通落差引發重工：當 PM 為了趕進度而跳過文件對齊時，後續的開發誤解與重工成本將成倍增加。',
    ],
    solution: [
      'Multi-Agent 規格管線：Product Playbook 不只是聊天機器人，它是一個嚴謹的規格生產流水線，並在 v1.2 升級為 Multi-Agent 專業分工架構。',
      '框架驅動的 LLM 編排：將 22 個成熟的產品框架轉化為結構化 Prompt，引導 AI 模擬資深 PM 的思維模式，確保輸出具備實戰價值。',
      '專家 Sub-agent 獨立運作：3 位專家在獨立環境中各司其職。discovery-specialist 專注於用戶與機會探索；strategy-critic 扮演嚴厲但公正的策略批判者；pre-mortem-runner 則全力投入產品失敗的悲觀推演。主 Agent 自動指派任務，並由 Sub-agent 以結構化 YAML 回傳整合。',
      '權責專一的工程化設計：每個 Sub-agent 內建拒絕機制（out_of_scope），遇到越權請求時會明確拒絕並指名正確的負責人。工具集嚴格限制為「唯讀」，從底層確保「規劃過程不亂動檔案」，將決策所有權留給主 Agent。',
      '靈活的六大產品模式：提供 Quick、Full、Revision、Build 等 6 種模式，無論是快速功能實驗還是完整新產品上線，都能找到對應的輸出深度。',
      '強大的資料攝入：內建三層 PDF 解析引擎（文字 → 語意 → OCR 備援），支援上傳既有研調資料，讓 AI 基於真實素材進行推論。',
      '變動自動傳播與技術轉譯：上游決策修改時，下游文件同步更新。系統能自動產出 CLAUDE.md 與 TASKS.md，將產品需求直接轉譯為工程師的技術任務。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill、Claude Code Plugin/Skill' },
      { category: 'AI Engine', items: 'Claude（LLM Orchestration）、Claude Vision（語意文件解析）' },
      { category: 'Multi-Agent Layer', items: '3 個 Claude Code sub-agent（discovery-specialist / strategy-critic / pre-mortem-runner），唯讀工具集、model: inherit、PROACTIVELY auto-delegate、structured YAML output' },
      { category: 'Frameworks', items: '內建 JTBD、Positioning、PR-FAQ、RICE、OST 等 22 套專業框架' },
      { category: 'Doc Processing', items: 'Playwright（PDF 渲染）、Pandoc（格式轉換）、pymupdf、Tesseract OCR' },
      { category: 'Tooling', items: 'Node.js、Bash、Markdown-based Framework Definition' },
      { category: 'Localization', items: '支援中（繁/簡）、英、日、韓、西等 6 國語言' },
    ],
    impact: [
      '開發效率極大化：將原本需要數天的規格撰寫過程大幅縮短至數分鐘，且品質超越基準測試',
      '品質基線提升 69%：在 Iteration 4 評測中，相較於未掛載核心技術的模型，在產品思維與邏輯嚴整度上大幅提升 69%',
      'Sub-agent 架構帶來額外 40.9% 增益：Iteration 5 評測顯示，啟用 3 位 Sub-agent 後品質達成率從 59.1% 躍升至 100%，且 Token 消耗幾乎持平，證明專業分工能在不增加成本的前提下大幅提高品質',
      '關鍵承重元件的驗證：實測證實 pre-mortem-runner 是系統的承重核心。少了它，主 Agent 只能產出單薄的風險清單；補回後，同一項評測的品質從 22.2% 提升到 100%（淨增 77.8%）',
      '工作流無縫融合：透過多通路發佈，使用者無需切換平台，在既有的編輯器或終端機中即可直接呼叫',
      '開源社群貢獻：產品以 MIT 協議開源，成為 PM 與工程師跨團隊協作的生產力工具',
    ],
    learnings: [
      '產品價值住在「框架」那一層：作為 AI PM，我體會到 LLM 的編排本質上是個產品設計問題。生成只是表象，框架的執行順序才是核心：唯有先定義 Persona 再執行 JTBD 分析，AI 才能精準識別出真正的用戶痛點。',
      '授權專家（Empowered Specialist）是一個核心的工程決策：過去我以為 Sub-agent 只是把長 Prompt 拆短的技術優化，但實作後才發現，「拒絕機制」與「唯讀工具集」才是設計核心。允許專家 Agent 在越權時說「這不是我的工作」並交還決策權，正對應了 Marty Cagan 所說的「自主團隊」概念：專家清楚自己的邊界，反而讓整個系統更穩定。',
      '架構的演化在於「誠實面對差異」：設計初期我曾想讓所有 Sub-agent 共用一套工整漂亮的 YAML Schema。但實作發現，策略批判需要的是「盲點評分」，而風險推演需要的是「帶有指標的場景模擬」，強行統一規格只會稀釋專業度。最終我採取「共用外殼（Envelope）+ 獨立內核（Body）」的權衡。這讓我學到：一致性的價值在於服務品質目標，當底層問題本質不同時，強行標準化反而是種傷害。',
      '通路策略決定用戶留存：選擇 Skill-based 的佈署策略帶來了極高的黏著度。好的工具不該強迫使用者適應新平台，而應該去「相遇」使用者原本就在工作的地方。',
      '核心洞察：任何人都能呼叫 API，但知道如何「問對問題」、「導引思考」並「讓專家在對的時機說話」才是系統真正的壁壘。22 個框架是這套系統的靈魂，3 位 Sub-agent 是專業分工的骨架，而 AI 則是負責將這些智慧快速交付的自動化機制。',
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
    subtitle: '「在房產資訊的大海中，讓優質物件主動來找你。」這是一套基於 Node.js 與 AI 的個人化房產決策管線，旨在打破台灣房地產市場的資訊碎片化：全通路整合（每日 09:00 自動掃描 591 與 Facebook 租屋社團，將割裂的資訊收斂至單一流程）、AI 語意解析（透過 Claude API 將混亂的社群貼文精準抽換成結構化數據）、量化決策模型（實作五維度加權打分，將原本感性的看房直覺轉化為科學的數據指標）、深度顧問模式（整合 Claude Code，提供從首購試算到換屋規劃的專業諮詢）。',
    metaTitle: 'House Ops — 台灣看房自動化與 AI 決策 Pipeline | Charles Chen 個人專案',
    metaDescription:
      'Node.js 自動化管線。每日掃描 591 與 FB 公開租屋社團，由 Claude API 把自由文字貼文抽成結構化欄位，依價格、空間、地段、屋況、風險五個維度加權評分，並透過 HTML email 簡報交付。AI Product Manager Charles Chen 的個人自動化案例研究。',
    problem: [
      '對於在台灣尋找租屋或買房物件的人來說，最大的痛苦不在於「沒房看」，而在於「看不完」。',
      '資訊極度破碎：房源分散在 591、Facebook 秘密社團與各種長尾論壇。使用者被迫在數十個分頁中手動比對捷運、格局與價格。',
      '高強度的資訊雜訊：FB 貼文充滿了無法被傳統工具篩選的自由文字，伴隨著重複上架、價格波動與格式斷裂，導致極高的搜尋成本。',
      '決策疲勞：每天重複「掃描 → 評估 → 丟棄」的循環，優質標的往往在上班族忙碌的幾小時內就被搶走。',
      '缺乏脈絡診斷：現有平台只提供基礎過濾，無法針對「租金中位數、空間比例、租賃風險」提供綜合性的決策建議。',
    ],
    solution: [
      'House Ops 透過自動化管線與 AI 協作，將房產篩選從「手動掃描」轉變為「自動交付」。',
      '突破性的抓取技術：透過 Chrome DevTools Protocol (CDP) 合成實體觸控手勢，成功繞過 Facebook 的反爬蟲機制與延遲載入（Lazy-load），確保能抓取到最即時的社群物件。',
      'LLM 結構化引擎：針對 FB 混亂的文字內容，由 Claude API (Haiku 4.5) 即時抽取出價格、地址、坪數、格局等結構化欄位，達成全通路數據對齊。',
      '五維啟發式評分：系統針對「價格、空間、地段、屋況、風險」進行量化打分。使用者可依「租屋族 / 首購族 / 換屋族」動態切換權重，將模糊的觀感轉化為 0–5 分的具體指標。',
      '推播式決策體驗：每日 09:30 前，一份視覺化的 HTML 簡報會準時寄達 Gmail。包含降價追蹤、新上架提醒與行政區拆解，讓決策發生在注意力最集中的早晨。',
      '人機協作決策層：管線（Pipeline）負責資料漏斗與去重，AI 互動層（Claude Code）處理複雜的權衡判斷，如可負擔性試算（Affordability）、賣舊買新的資金缺口（Upgrade Plan）以及看屋清單（Checklist）。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js（ESM）' },
      { category: 'Scraping', items: 'agent-browser（591）+ CDP（Facebook 合成手勢抓取）' },
      { category: 'LLM Extraction', items: 'Claude API（Haiku 4.5）負責自由文字解析' },
      { category: 'Email', items: 'Nodemailer + Gmail SMTP（發送互動式 HTML 簡報）' },
      { category: 'Scheduling', items: 'macOS launchd（處理定時啟動與環境變數繼承）' },
      { category: 'Persistence', items: 'JSON Cache 與 TSV 掃描歷史紀錄' },
      { category: 'Interactive Layer', items: '整合 Claude Code 進行深度財務與換屋規劃' },
    ],
    impact: [
      '全通路收斂：成功打破 591 與 FB 的壁壘，將原本割裂的資訊流統一進同一個評估體系',
      '精準去重與追蹤：結合持久化緩存，實現對重複貼文的自動過濾與價格異動的即時追蹤',
      '從過濾到加權：將原本死板的「硬門檻篩選」進化為「多維度加權模型」，更精準地模擬人類的決策偏好',
      '極致決策效率：透過推播式日報與 AI 互動，將每日看房時間從「數小時」收斂至「數分鐘」',
    ],
    learnings: [
      '「在自動化的世界裡，交付媒介就是產品本身。」為什麼選 Email 而非 Dashboard？這源於對行為科學的洞察：在早晨的高頻決策時段，「推播（Push）」的資訊到達率遠高於「拉取（Pull）」。數據應主動出現在使用者的注意力所在之處。',
      '技術路徑的權衡：在整合 FB 過程中，我嘗試過各種模擬捲動路徑，最後發現唯有 CDP 的 Input.synthesizeScrollGesture（合成觸控手勢）能被視為實體操作，這讓我學到：在對抗反爬蟲機制時，越接近實體層級的操作越有效。',
      'LLM 作為解析器的經濟性：使用 LLM 抽樣結構化欄位看似昂貴，但實際上單篇成本極低（約 USD 0.001），且其穩定性遠高於規則式 Parser。面對「月租押金含管費可議」這類變幻莫測的台式中文，AI 展現了人類等級的理解力。最後，從硬篩選轉向加權模型是這個專案的靈魂——它容許物件在不同維度間進行 Trade-off，這才是最符合真實人性的決策模式。',
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
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
