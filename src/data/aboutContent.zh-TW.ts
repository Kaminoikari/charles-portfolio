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
      title: '重 outcome、不重 output。',
      body: '出 feature 不是目標，改變使用者行為、推動商業指標才是。我用「使用者做了什麼不一樣的事」來衡量成功，不是用「關了幾張 ticket」。',
    },
    {
      title: '立場明確，但隨時可被推翻。',
      body: 'Product sense 意味著對「要做什麼、為什麼做」有明確觀點。但只有信念、沒有彈性叫做固執。我先建出有立場的假設，再讓資料與使用者回饋來證明我錯。',
    },
    {
      title: '強 product sense。',
      body: '最好的決策發生在資料還不存在的時候。知道哪些問題值得解、哪些方案會打中、何時該砍 scope，這種直覺來自親手出產品、看真實使用者怎麼反應。',
    },
    {
      title: '做出來，學到東西。',
      body: '原型勝過簡報。我用 Claude Code、Codex 直接打造可運作的產品來產生真實的使用者回饋，而不是停留在 stakeholder 的假設意見上。',
    },
  ],
  aiTable: [
    {
      label: 'Discovery',
      body: '用 LLM 做市場研究、競品分析、使用者訪談的內容彙整',
    },
    {
      label: 'Spec Writing',
      body: 'Product Playbook，我自己做的 AI agent，用 22 個產品框架產出完整 spec',
    },
    {
      label: 'Prototyping',
      body: '用 Claude Code 與 Codex 快速進行全端原型開發（React、Flutter、Node.js、Python + FastAPI、PHP + Laravel）',
    },
    {
      label: 'AI Features',
      body: '在 Plutus Trade 整合 Gemini AI，提供個股診斷與預測追蹤',
    },
    {
      label: 'Agentic Workflows',
      body: '打造能編排多步驟任務的 AI agent，從 spec 產出到 dev handoff',
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
