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
    "I'm Charles Chen (陳德潁), a Taiwan-based Software Product Manager who treats shipping as the truest form of validation. I specialize in building software products from 0 to 1, combining product strategy with AI development tools to deliver end-to-end from concept to launch.",
    "Over the past 5 years I've focused on building products that change user behavior, with experience spanning creator tools, Fintech, B2B SaaS, and MaaS (Mobility-as-a-Service). I've contributed to product planning that has reached over 7 million people. I currently lead three core product lines at USPACE (parking payments, business travel platform, and financial insurance), covering Taiwan and Japan, and directly contributing more than 85% of company revenue.",
    "I'm convinced the strongest product people of the future will be Product Builders. In my workflow, AI is the core engine of development. That lets me move past the traditional PM frame of synthesizing requirements and writing PRDs, and personally use AI tools to ship prototypes quickly and validate them in production. This 'Builder mode' lets me iterate 5x faster than traditional workflows, so a product earns real market validation before any large-scale resource commitment.",
  ],
  philosophyBullets: [
    {
      title: 'Outcomes over outputs',
      body: "Shipping features alone isn't the goal. Changing user behavior and moving business metrics is. I measure success by what users do differently, not by how many tickets get checked off.",
    },
    {
      title: 'Sharp product sense',
      body: 'The best decisions often happen before the data exists. Knowing which problems are worth solving, which solutions will resonate, and when to cut scope decisively: that intuition comes from shipping products and watching how real users respond.',
    },
    {
      title: 'Strong opinions, loosely held',
      body: 'Having product sense means holding a clear point of view on what to build and why. But conviction without flexibility is just stubbornness. I form strong hypotheses, then stay ready to let data and user feedback prove me wrong.',
    },
    {
      title: 'Build to learn',
      body: 'Prototypes beat slide decks. I use Claude Code and Codex to build working products that generate real user feedback, not hypothetical stakeholder opinions.',
    },
  ],
  aiTable: [
    {
      label: 'Discovery',
      body: 'I use LLMs to process dense market research, competitive analysis, and interview material, turning fragmented signals into clear market insight that informs decisions.',
    },
    {
      label: 'Spec Writing',
      body: 'I built my own AI agent, "Product Playbook", a Claude Skills setup integrating 22 product frameworks. It produces rigorous, professional product spec documents tailored to each context, compressing what used to take days of planning into hours.',
    },
    {
      label: 'Prototyping',
      body: 'I use Claude Code and Codex for full-stack prototyping, shipping product prototypes independently across React, Node.js, and Python and turning ideas into tangible software in hours.',
    },
    {
      label: 'AI Features',
      body: 'I have hands-on experience shipping AI in production. In Plutus Trade I deeply integrated the Gemini Model to turn complex data into intuitive per-stock diagnostics, enabling data-driven investment decisions.',
    },
    {
      label: 'Agentic Workflows',
      body: "I build AI agents that handle tasks autonomously, delegating repetitive work spanning spec generation through dev handoff to AI and lifting the team's overall execution efficiency.",
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
