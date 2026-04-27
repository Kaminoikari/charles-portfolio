// Translation policy mirrors src/i18n/strings/ja.ts:
//   - Product names (Path / Plutus Trade / Product Playbook / USPACE),
//     framework names (JTBD / Persona / RICE / OKRs / AARRR), tech stack
//     (React / TypeScript / Claude Code / Codex / Gemini AI / FastAPI /
//     Laravel / Vercel etc.), and standard product terms (B2B SaaS,
//     builder, Product Builder, MaaS, BI, A/B Testing, Cross-Functional)
//     stay English in line with how Japanese tech industry writes/speaks.
//   - Descriptive sentences and bullet titles translated to Japanese.

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
    '私は陳德潁（Charles Chen）、台湾の AI Product Manager です。プロダクト戦略と AI 開発ツールを組み合わせ、コンセプトからローンチまでをエンドツーエンドで届ける、0→1 のソフトウェアプロダクトづくりを得意としています。',
    'この 5 年間、クリエイターツール、フィンテック、SaaS、MaaS にまたがるプロダクト経験を積み、累計 600 万人以上のユーザーに影響を与えてきました。現在は USPACE で、駐車場決済・出張・金融保険の 3 つのプロダクトラインの戦略を主導し、台湾と日本市場をカバーしながら、会社の売上の 85% 以上を駆動しています。',
    'これからの最高のプロダクトマネージャーは Product Builder の形になると信じています。プロダクトを企画するだけでなく、自ら AI ツールを使って素早くプロトタイプを作り、本番で検証する。このやり方で、従来の PM ワークフローより 5 倍速くイテレーションできています。',
  ],
  philosophyBullets: [
    {
      title: 'output より outcome。',
      body: 'feature をリリースすることが目的ではない——ユーザー行動を変え、ビジネス指標を動かすことが目的です。「ticket を何枚閉じたか」ではなく「ユーザーが何を変えたか」で成功を測ります。',
    },
    {
      title: '強い意見、しなやかに手放す。',
      body: 'Product sense とは「何を作るか、なぜ作るか」に明確な視点を持つこと。ただ柔軟性のない確信は頑固にすぎない——強い仮説を立てた上で、データとユーザーフィードバックに自分の間違いを証明させます。',
    },
    {
      title: '強い product sense。',
      body: '最高の判断は、データがまだ存在しない時点で起きます。どの問題が解く価値があるか、どの解決策が刺さるか、いつ scope を切るか——その直感は、プロダクトを実際に出して、ユーザーの反応を見続けることで育ちます。',
    },
    {
      title: 'Build to learn.',
      body: 'プロトタイプはスライド資料に勝つ。Claude Code と Codex で動くプロダクトを作って、stakeholder の仮定の意見ではなく、本物のユーザーフィードバックを生み出します。',
    },
  ],
  aiTable: [
    {
      label: 'Discovery',
      body: 'LLM を活用した市場調査、競合分析、ユーザーインタビューの統合',
    },
    {
      label: 'Spec Writing',
      body: 'Product Playbook——22 個のプロダクトフレームワークから spec を生成する、私自身が作った AI agent',
    },
    {
      label: 'Prototyping',
      body: 'Claude Code と Codex でフルスタックの素早い開発（React、Flutter、Node.js、Python + FastAPI、PHP + Laravel）',
    },
    {
      label: 'AI Features',
      body: 'Plutus Trade で Gemini AI を統合し、個別株の診断と予測追跡を提供',
    },
    {
      label: 'Agentic Workflows',
      body: '複数ステップのタスクを編成する AI agent の構築——spec 生成から dev handoff まで',
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
      body: 'BI Dashboard、Predictive Analytics、A/B Testing、SQL、データ駆動の意思決定',
    },
    {
      label: 'Leadership',
      body: 'クロスファンクショナルチームのリード、Stakeholder Management、Agile / Scrum、Mentoring',
    },
  ],
}
