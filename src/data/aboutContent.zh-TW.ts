// Translation policy mirrors src/i18n/strings/zh-TW.ts:
//   - Product names (Path / Plutus Trade / Product Playbook / USPACE),
//     framework names (JTBD / Persona / RICE / OKRs / AARRR), tech stack
//     (React / TypeScript / Claude Code / Codex / Gemini AI / FastAPI /
//     Laravel / Vercel etc.), and standard product terms (B2B SaaS,
//     builder, Product Builder, MaaS, BI, A/B Testing, Cross-Functional)
//     stay English in line with how Taiwan PMs actually write/speak.
//   - Descriptive sentences and bullet titles translated to Traditional
//     Chinese.

export interface AboutBullet {
  // Stable, locale-independent key. The RAG chunk id is built from it, so it
  // must stay identical across the three locale files and must not change when
  // the copy is rewritten.
  id: string
  title: string
  body: string
}

export interface AboutTableRow {
  // Stable, locale-independent key — see AboutBullet.id.
  id: string
  label: string
  body: string
}

export interface AboutContent {
  whoIAm: string[]
  philosophyBullets: AboutBullet[]
  aiTable: AboutTableRow[]
  skillsTable: AboutTableRow[]
}

export const aboutContent: AboutContent = {
  whoIAm: [
    '我是陳德潁（Charles Chen），一位來自台灣並深信「實作即驗證」的 Head of Product。我擅長從 0 到 1 打造軟體產品，結合產品策略與 AI 開發工具，完成從概念到上線的端到端交付。',
    '我有 12 年工作資歷，其中 5 年以上專注於產品管理，打造能改變使用者行為的產品，經歷橫跨創作者工具、Fintech、B2B SaaS 與 MaaS（移動服務）。我曾參與影響超過 700 萬人的產品規劃。目前在 USPACE 擔任 Head of Product，帶領 6 人產品團隊，負責跨台日市場的產品策略、年度 Roadmap 與 OKR，主導停車支付、企業差旅平台與金融保險三大核心產品線，並延伸統籌 B2C 機場接送、司機端調度中控平台 App 與車體鍍膜 SaaS。我曾任 USPACE app 負責人，也擔任過跨職能 Scrum 團隊的 Product Owner，協調工程、設計與營運，並決定產品方向與優先序。',
    '我深信未來最強大的產品人會是 Product Builder。在我的工作流中，AI 不只是輔助工具，更是開發的核心引擎。這讓我能超越傳統 PM 僅止於收斂需求與撰寫 PRD 的框架，並親手利用 AI 工具快速產出原型、完成上線驗證。這種「Builder 模式」讓我能以比傳統流程快 5 倍的速度進行迭代，確保產品在投入大規模資源前，就已經獲得真實市場的認可。現在我把同一套做法放大到組織層級：在 USPACE 建構產品部門的 RAG 知識庫與 Agentic Workflow 標準作業流程，把需求調研與競品分析的週期縮短 80%。',
  ],
  philosophyBullets: [
    {
      id: 'outcomes-over-outputs',
      title: '重成果，不重產出 (Outcomes over outputs)',
      body: '單純交付功能並不是目標，改變使用者行為並推動商業指標才是。我衡量成功的標準是「使用者做了什麼不一樣的事」，而不是「有多少張 ticket 可以勾完成」。',
    },
    {
      id: 'product-sense',
      title: '敏銳的 Product Sense',
      body: '最好的決策往往發生在數據還不存在的時候。知道哪些問題值得解決、哪些方案能引起共鳴、何時該果斷縮減範疇，這種直覺來自於不斷親手交付產品，並觀察真實使用者的反應。',
    },
    {
      id: 'strong-opinions',
      title: '觀點要堅定，態度要靈活 (Strong opinions, loosely held)',
      body: '具備 Product sense 意味著對「要做什麼、為什麼做」有清晰的觀點。但只有信念而沒有彈性就是固執。我會建立強而有力的假設，並隨時準備好讓數據與使用者回饋來證明我錯了。',
    },
    {
      id: 'build-to-learn',
      title: '做中學 (Build to learn)',
      body: '原型勝過簡報。我使用 Claude Code 與 Codex 打造實際可運作的產品，藉此產生真實的使用者回饋，而不是停留在利害關係人的假設性意見上。',
    },
  ],
  aiTable: [
    {
      id: 'discovery',
      label: 'Discovery',
      body: '利用 LLM 處理海量的市場研究、競品分析與訪談資料。我能將碎片化的資訊快速整理成清晰的市場洞察，輔助決策。',
    },
    {
      id: 'spec-writing',
      label: 'Spec Writing',
      body: '我打造了個人專屬 AI Agent「Product Playbook」。這套 Claude Skills 整合了 22 種產品框架，能針對不同情境產出邏輯嚴密且專業的產品規格文件，將原本需要數天的規劃流程縮短至數小時。',
    },
    {
      id: 'prototyping',
      label: 'Prototyping',
      body: '運用 Claude Code 與 Codex 進行全端原型開發。我能獨立完成涵蓋 React、Node.js 與 Python 等技術棧的產品原型，讓創意在幾小時內就變換成可觸摸的軟體。',
    },
    {
      id: 'ai-features',
      label: 'AI Features',
      body: '具備實戰經驗將 AI 落地。例如在 Plutus Trade 深度整合 Gemini Model，將複雜的數據轉化為直覺的個股診斷，實現數據驅動的投資決策。',
    },
    {
      id: 'agentic-workflows',
      label: 'Agentic Workflows',
      body: '建立能自動處理任務的 AI Agent。我讓 AI 協助從規格產出到開發交付的重複性工作，大幅提升團隊整體的執行效率。',
    },
    {
      id: 'ai-enablement',
      label: 'AI Enablement',
      body: '把 AI 從個人生產力放大成組織能力。我在 USPACE 建構產品部門的 RAG 知識庫與 Agentic Workflow 標準作業流程，讓整個團隊共用同一套調研與分析管線，需求調研與競品分析的週期縮短 80%。',
    },
    {
      id: 'qa-automation',
      label: 'QA Automation',
      body: '在 App 重構專案中獨立架構 Maestro MCP 的全套 E2E 自動化測試腳本，把回歸測試從人工逐頁點擊變成每次交付都會跑的自動流程，釋放 80% 回歸測試工時。',
    },
  ],
  skillsTable: [
    {
      id: 'product-strategy',
      label: 'Product Strategy',
      body: 'JTBD、Persona、User Journey Map、Empathy Map、Opportunity Solution Tree、User Story Mapping、North Star Metric、OKRs、RICE Prioritization、AARRR（Pirate Metrics）、Competitive Analysis、JIRA、Figma、Axure RP',
    },
    {
      id: 'ai-llm',
      label: 'AI / LLM',
      body: 'Claude Code、Codex、Gemini AI、LLM Orchestration、Prompt Engineering、AI Agent Development、Agentic Workflows、Multi-Agent Systems、MCP Servers',
    },
    {
      id: 'ai-engineering',
      label: 'AI Engineering',
      body: 'RAG（Retrieval-Augmented Generation）、Hybrid / Vector Search、LangGraph / LangChain、Vector Database（Qdrant）、Embeddings（Voyage AI）、LLM Evaluation & Benchmarking、AI Safety / Prompt-Injection Defense',
    },
    {
      id: 'engineering',
      label: 'Engineering',
      body: 'React、TypeScript、Flutter、Canvas 2D、three.js (WebGL)、Node.js、Python (FastAPI)、PHP (Laravel)、PostgreSQL、SQLite、Redis、Supabase、Vercel、Fly.io、Maestro（E2E 測試自動化）',
    },
    {
      id: 'data-analytics',
      label: 'Data & Analytics',
      body: 'BI Dashboard、Predictive Analytics、A/B Testing、SQL、資料驅動的決策',
    },
    {
      id: 'leadership',
      label: 'Leadership',
      body: '跨部門團隊領導、跨台日市場產品策略、年度 Roadmap 與 OKR、產品部門 AI 轉型、Stakeholder Management、Agile / Scrum、Mentoring',
    },
  ],
}
