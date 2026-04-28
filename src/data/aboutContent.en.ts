// AboutPage long-form content. Lives in the data layer (not i18n strings)
// because the structure is rich — paragraph arrays, bullet lists with bold
// titles, and label/body table rows — which doesn't fit useT()'s flat
// dotted-string keys cleanly.

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
    "I'm Charles Chen (陳德潁), an AI Product Manager based in Taiwan. I specialize in building software products from 0 to 1, combining product strategy with AI development tools to deliver end-to-end from concept to launch.",
    'Over the past 5 years, my product experience has spanned creator tools, fintech, SaaS, and MaaS, impacting over 6 million users in total. I currently lead product strategy at USPACE across three product lines (parking payments, business travel, and financial insurance) covering both Taiwan and Japan, driving more than 85% of company revenue.',
    'I believe the best product managers of the future will be Product Builders. Not just planning products, but personally using AI tools to rapidly build prototypes and validate them in production. This approach lets me iterate 5x faster than traditional PM workflows.',
  ],
  philosophyBullets: [
    {
      title: 'Outcomes over outputs.',
      body: "Shipping features isn't the goal. Changing user behavior and moving business metrics is. I measure success by what users do differently, not by how many tickets get closed.",
    },
    {
      title: 'Strong opinions, loosely held.',
      body: 'Product sense means having a clear point of view on what to build and why. But conviction without flexibility is stubbornness. I form strong hypotheses, then let data and user feedback prove me wrong.',
    },
    {
      title: 'Strong product sense.',
      body: 'The best decisions happen before the data exists. Knowing which problems are worth solving, which solutions will resonate, and when to cut scope: that intuition comes from shipping products and watching how real users respond.',
    },
    {
      title: 'Build to learn.',
      body: 'Prototypes beat slide decks. I use Claude Code and Codex to build working products that generate real user feedback, not hypothetical stakeholder opinions.',
    },
  ],
  aiTable: [
    {
      label: 'Discovery',
      body: 'LLM-powered market research, competitive analysis, and user interview synthesis',
    },
    {
      label: 'Spec Writing',
      body: 'Product Playbook, my own AI agent that generates specs from 22 product frameworks',
    },
    {
      label: 'Prototyping',
      body: 'Claude Code and Codex for rapid full-stack prototyping and development (React, Flutter, Node.js, Python with FastAPI, PHP with Laravel)',
    },
    {
      label: 'AI Features',
      body: 'Gemini AI integration in Plutus Trade for stock diagnostics and prediction tracking',
    },
    {
      label: 'Agentic Workflows',
      body: 'Building AI agents that orchestrate multi-step tasks, from spec generation to dev handoff',
    },
  ],
  skillsTable: [
    {
      label: 'Product Strategy',
      body: 'JTBD, Persona, User Journey Map, Empathy Map, Opportunity Solution Tree, User Story Mapping, North Star Metric, OKRs, RICE Prioritization, AARRR (Pirate Metrics), Competitive Analysis',
    },
    {
      label: 'AI / LLM',
      body: 'Claude Code, Codex, Gemini AI, LLM Orchestration, Prompt Engineering, AI Agent Development, Agentic Workflows',
    },
    {
      label: 'Engineering',
      body: 'React, TypeScript, Flutter, Canvas 2D, Node.js, Python (FastAPI), PHP (Laravel), PostgreSQL, SQLite, Redis, Supabase, Vercel, Fly.io',
    },
    {
      label: 'Data & Analytics',
      body: 'BI Dashboards, Predictive Analytics, A/B Testing, SQL, Data-Driven Decision Making',
    },
    {
      label: 'Leadership',
      body: 'Cross-Functional Team Leadership, Stakeholder Management, Agile / Scrum, Mentoring',
    },
  ],
}
