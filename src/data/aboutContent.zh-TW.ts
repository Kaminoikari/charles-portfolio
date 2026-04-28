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
  title: string
  body: string
}

export interface AboutTableRow {
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
    '我是陳德潁（Charles Chen），一位來自台灣並深信「實作即驗證」的 Software Product Manager。我擅長從 0 到 1 打造軟體產品，結合產品策略與 AI 開發工具，完成從概念到上線的端到端交付。',
    '過去 5 年，我專注於打造能改變使用者行為的產品，經歷橫跨創作者工具、Fintech、B2B SaaS 與 MaaS（移動服務）。我曾參與影響超過 700 萬人的產品規劃。目前在 USPACE 主導停車支付、企業差旅平台與金融保險三大核心產品線，業務涵蓋台灣與日本市場，並直接貢獻了公司 85% 以上的營收。',
    '我深信未來最強大的產品人會是 Product Builder。在我的工作流中，AI 不只是輔助工具，更是開發的核心引擎。這讓我能超越傳統 PM 僅止於收斂需求與撰寫 PRD 的框架，並親手利用 AI 工具快速產出原型、完成上線驗證。這種「Builder 模式」讓我能以比傳統流程快 5 倍的速度進行迭代，確保產品在投入大規模資源前，就已經獲得真實市場的認可。',
  ],
  philosophyBullets: [
    {
      title: '重成果，不重產出 (Outcomes over outputs)',
      body: '單純交付功能並不是目標，改變使用者行為並推動商業指標才是。我衡量成功的標準是「使用者做了什麼不一樣的事」，而不是「有多少張 ticket 可以勾完成」。',
    },
    {
      title: '敏銳的 Product Sense',
      body: '最好的決策往往發生在數據還不存在的時候。知道哪些問題值得解決、哪些方案能引起共鳴、何時該果斷縮減範疇，這種直覺來自於不斷親手交付產品，並觀察真實使用者的反應。',
    },
    {
      title: '觀點要堅定，態度要靈活 (Strong opinions, loosely held)',
      body: '具備 Product sense 意味著對「要做什麼、為什麼做」有清晰的觀點。但只有信念而沒有彈性就是固執。我會建立強而有力的假設，並隨時準備好讓數據與使用者回饋來證明我錯了。',
    },
    {
      title: '做中學 (Build to learn)',
      body: '原型勝過簡報。我使用 Claude Code 與 Codex 打造實際可運作的產品，藉此產生真實的使用者回饋，而不是停留在利害關係人的假設性意見上。',
    },
  ],
  aiTable: [
    {
      label: 'Discovery',
      body: '利用 LLM 處理海量的市場研究、競品分析與訪談資料。我能將碎片化的資訊快速整理成清晰的市場洞察，輔助決策。',
    },
    {
      label: 'Spec Writing',
      body: "我打造了個人專屬 AI Agent 'Product Playbook'。這套 Claude Skills 整合了 22 種產品框架，能針對不同情境產出邏輯嚴密且專業的產品規格文件，將原本需要數天的規劃流程縮短至數小時。",
    },
    {
      label: 'Prototyping',
      body: '運用 Claude Code 與 Codex 進行全端原型開發。我能獨立完成涵蓋 React、Node.js 與 Python 等技術棧的產品原型，讓創意在幾小時內就變換成可觸摸的軟體。',
    },
    {
      label: 'AI Features',
      body: '具備實戰經驗將 AI 落地。例如在 Plutus Trade 深度整合 Gemini Model，將複雜的數據轉化為直覺的個股診斷，實現數據驅動的投資決策。',
    },
    {
      label: 'Agentic Workflows',
      body: '建立能自動處理任務的 AI Agent。我讓 AI 協助從規格產出到開發交付的重複性工作，大幅提升團隊整體的執行效率。',
    },
  ],
  skillsTable: [
    {
      label: 'Product Strategy',
      body: 'JTBD、Persona、User Journey Map、Empathy Map、Opportunity Solution Tree、User Story Mapping、North Star Metric、OKRs、RICE Prioritization、AARRR（Pirate Metrics）、Competitive Analysis',
    },
    {
      label: 'AI / LLM',
      body: 'Claude Code、Codex、Gemini AI、LLM Orchestration、Prompt Engineering、AI Agent Development、Agentic Workflows',
    },
    {
      label: 'Engineering',
      body: 'React、TypeScript、Flutter、Canvas 2D、Node.js、Python (FastAPI)、PHP (Laravel)、PostgreSQL、SQLite、Redis、Supabase、Vercel、Fly.io',
    },
    {
      label: 'Data & Analytics',
      body: 'BI Dashboard、Predictive Analytics、A/B Testing、SQL、資料驅動的決策',
    },
    {
      label: 'Leadership',
      body: '跨部門團隊領導、Stakeholder Management、Agile / Scrum、Mentoring',
    },
  ],
}
