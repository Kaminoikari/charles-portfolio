// AboutPage long-form content. Lives in the data layer (not i18n strings)
// because the structure is rich — paragraph arrays, bullet lists with bold
// titles, and label/body table rows — which doesn't fit useT()'s flat
// dotted-string keys cleanly.

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
    "I'm Charles Chen (陳德潁), a Taiwan-based Head of Product who treats shipping as the truest form of validation. I specialize in building software products from 0 to 1, combining product strategy with AI development tools to deliver end-to-end from concept to launch.",
    "Across 12 years of work, more than 5 of them in product management, I've built products that change user behavior, with experience spanning creator tools, Fintech, B2B SaaS, and MaaS (Mobility-as-a-Service). I've contributed to product planning that has reached over 7 million people. I'm now Head of Product at USPACE, leading a 6-person product team and owning product strategy, the annual roadmap and OKRs across Taiwan and Japan. I still drive the three core product lines (parking payments, business travel platform, and financial insurance), and now also oversee B2C airport transfers, a driver-side dispatch console app, and a car-coating SaaS. I served as the USPACE app owner and as Product Owner of a cross-functional Scrum team, aligning engineering, design, and operations while setting product direction and priorities.",
    "I'm convinced the strongest product people of the future will be Product Builders. In my workflow, AI is the core engine of development. That lets me move past the traditional PM frame of synthesizing requirements and writing PRDs, and personally use AI tools to ship prototypes quickly and validate them in production. This 'Builder mode' lets me iterate 5x faster than traditional workflows, so a product earns real market validation before any large-scale resource commitment. I now run the same play at the org level: at USPACE I built the product org's RAG knowledge base and agentic workflow SOP, cutting the discovery and competitive-analysis cycle by 80%.",
  ],
  philosophyBullets: [
    {
      id: 'outcomes-over-outputs',
      title: 'Outcomes over outputs',
      body: "Shipping features alone isn't the goal. Changing user behavior and moving business metrics is. I measure success by what users do differently, not by how many tickets get checked off.",
    },
    {
      id: 'product-sense',
      title: 'Sharp product sense',
      body: 'The best decisions often happen before the data exists. Knowing which problems are worth solving, which solutions will resonate, and when to cut scope decisively: that intuition comes from shipping products and watching how real users respond.',
    },
    {
      id: 'strong-opinions',
      title: 'Strong opinions, loosely held',
      body: 'Having product sense means holding a clear point of view on what to build and why. But conviction without flexibility is just stubbornness. I form strong hypotheses, then stay ready to let data and user feedback prove me wrong.',
    },
    {
      id: 'build-to-learn',
      title: 'Build to learn',
      body: 'Prototypes beat slide decks. I use Claude Code and Codex to build working products that generate real user feedback, not hypothetical stakeholder opinions.',
    },
  ],
  aiTable: [
    {
      id: 'discovery',
      label: 'Discovery',
      body: 'I use LLMs to process dense market research, competitive analysis, and interview material, turning fragmented signals into clear market insight that informs decisions.',
    },
    {
      id: 'spec-writing',
      label: 'Spec Writing',
      body: 'I built my own AI agent, "Product Playbook", a Claude Skills setup integrating 22 product frameworks. It produces rigorous, professional product spec documents tailored to each context, compressing what used to take days of planning into hours.',
    },
    {
      id: 'prototyping',
      label: 'Prototyping',
      body: 'I use Claude Code and Codex for full-stack prototyping, shipping product prototypes independently across React, Node.js, and Python and turning ideas into tangible software in hours.',
    },
    {
      id: 'ai-features',
      label: 'AI Features',
      body: 'I have hands-on experience shipping AI in production. In Plutus Trade I deeply integrated the Gemini Model to turn complex data into intuitive per-stock diagnostics, enabling data-driven investment decisions.',
    },
    {
      id: 'agentic-workflows',
      label: 'Agentic Workflows',
      body: "I build AI agents that handle tasks autonomously, delegating repetitive work spanning spec generation through dev handoff to AI and lifting the team's overall execution efficiency.",
    },
    {
      id: 'ai-enablement',
      label: 'AI Enablement',
      body: 'I scale AI from personal productivity into an organizational capability. At USPACE I built the product org\'s RAG knowledge base and agentic workflow SOP, putting the whole team on one research-and-analysis pipeline and cutting the discovery and competitive-analysis cycle by 80%.',
    },
    {
      id: 'qa-automation',
      label: 'QA Automation',
      body: 'For the app rewrite I architected the full Maestro MCP end-to-end test suite single-handedly, turning regression testing from manual click-through into a run-every-release pipeline and freeing 80% of regression-testing hours.',
    },
  ],
  skillsTable: [
    {
      id: 'product-strategy',
      label: 'Product Strategy',
      body: 'JTBD, Persona, User Journey Map, Empathy Map, Opportunity Solution Tree, User Story Mapping, North Star Metric, OKRs, RICE Prioritization, AARRR (Pirate Metrics), Competitive Analysis, JIRA, Figma, Axure RP',
    },
    {
      id: 'ai-llm',
      label: 'AI / LLM',
      body: 'Claude Code, Codex, Gemini AI, LLM Orchestration, Prompt Engineering, AI Agent Development, Agentic Workflows, Multi-Agent Systems, MCP Servers',
    },
    {
      id: 'ai-engineering',
      label: 'AI Engineering',
      body: 'RAG (Retrieval-Augmented Generation), Hybrid / Vector Search, LangGraph / LangChain, Vector Databases (Qdrant), Embeddings (Voyage AI), LLM Evaluation & Benchmarking, AI Safety / Prompt-Injection Defense',
    },
    {
      id: 'engineering',
      label: 'Engineering',
      body: 'React, TypeScript, Flutter, Canvas 2D, three.js (WebGL), Node.js, Python (FastAPI), PHP (Laravel), PostgreSQL, SQLite, Redis, Supabase, Vercel, Fly.io, Maestro (E2E test automation)',
    },
    {
      id: 'data-analytics',
      label: 'Data & Analytics',
      body: 'BI Dashboards, Predictive Analytics, A/B Testing, SQL, Data-Driven Decision Making',
    },
    {
      id: 'leadership',
      label: 'Leadership',
      body: 'Cross-Functional Team Leadership, Taiwan / Japan Product Strategy, Annual Roadmap & OKRs, Product Org AI Transformation, Stakeholder Management, Agile / Scrum, Mentoring',
    },
  ],
}
