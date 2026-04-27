// TODO(i18n): translate this file to zh-TW. Until translated, contents
// are an English copy and the site falls back gracefully.

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
      'Offline-first trip planning app with Google Maps integration, transit directions, cost tracking, and drag-and-drop itinerary management.',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['React', 'TypeScript', 'Supabase'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description: 'AI-powered Taiwan stock selection platform with real-time quotes, K-line charts, Gemini AI diagnostics, one-tap stock screening, and prediction tracking system.',
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description:
      'AI-powered product planning system with 22 frameworks, 6 execution modes, and automated dev handoff — from concept to spec in minutes.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — AI Travel Planning App',
    subtitle: 'An AI SaaS product that turns trip planning from hours of research into a drag-and-drop experience.',
    metaTitle: 'Path — AI Travel Planner | Charles Chen AI Product Case Study',
    metaDescription: 'AI SaaS travel planning app with Google Maps, transit routing, cost tracking. A real-world AI product case study by AI Product Manager Charles Chen.',
    problem: [
      'Trip planning is fragmented. Travelers bounce between Google Maps, booking sites, spreadsheets, and group chats to organize a single trip. There was no tool that combined route planning, cost tracking, and itinerary management in one place — especially one that worked offline for international travelers with limited connectivity.',
      'Existing travel apps either focused on booking (Booking.com, Agoda) or social sharing (TripAdvisor), but none solved the actual planning workflow: "what do I do each day, how do I get there, and how much will it cost?"',
    ],
    solution: [
      'Built an offline-first trip planning app centered on a drag-and-drop daily itinerary. Each day is a timeline of places, with Google Maps integration showing transit directions between stops. Users can see travel time, distance, and cost at a glance.',
      'The key product decision was making it offline-first — all itinerary data syncs to local storage so travelers can access their plans without internet. This solved the #1 pain point for international travelers.',
      'Designed the UX around progressive complexity: start with just a destination and dates, then layer in places, routes, costs, and notes. New users can create a basic itinerary in under 2 minutes.',
    ],
    techStack: [
      { category: 'Frontend', items: 'React, TypeScript, Tailwind CSS, PWA (Service Worker)' },
      { category: 'Backend', items: 'Supabase (PostgreSQL, Auth, Realtime)' },
      { category: 'Maps', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      'End-to-end AI SaaS product built from 0 to 1 as a solo AI Product Builder',
      'Offline-first architecture — itineraries accessible without internet',
      'Under 2-minute onboarding to first complete itinerary',
      'Demonstrated full product lifecycle: research → design → build → ship',
    ],
    learnings: [
      'Offline-first sounds simple but requires careful state management. Conflict resolution between local and remote data was the hardest engineering problem — solved with last-write-wins and timestamp-based merging.',
      'Google Maps API costs add up fast. Implemented aggressive caching (directions cached for 24h, places cached indefinitely) to keep API costs under control without degrading UX.',
      'As an AI Product Manager building my own product, the biggest insight was how much faster iteration becomes when you can go from product decision to deployed code in the same afternoon. No handoff delay, no spec misinterpretation.',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — AI Stock Analysis Platform',
    subtitle: 'A generative AI product that brings institutional-grade stock analysis to individual Taiwan stock investors.',
    metaTitle: 'Plutus Trade — AI Stock Analysis | Generative AI Product Case Study',
    metaDescription: 'AI-powered Taiwan stock platform with Gemini AI diagnostics, K-line charts, and prediction tracking. A generative AI product case study by AI Product Manager Charles Chen.',
    problem: [
      'Individual Taiwan stock investors lack access to the analytical tools that institutional traders use. Most retail investors rely on gut feeling, social media tips, or basic charting apps that show data but don\'t help interpret it.',
      'The gap isn\'t data availability — it\'s analysis capability. Raw K-line charts, revenue reports, and institutional trading data are publicly available, but synthesizing them into actionable insights requires expertise that most retail investors don\'t have.',
    ],
    solution: [
      'Built an AI-powered stock analysis platform that uses Gemini AI to synthesize multiple data sources — price action, technical indicators, institutional trading patterns, and financial reports — into plain-language diagnostics.',
      'The core product innovation is "one-tap stock screening": users describe what they\'re looking for (e.g., "undervalued tech stocks with growing revenue"), and the AI returns a curated list with reasoning for each pick. This replaces hours of manual screening.',
      'Added a prediction tracking system that logs every AI recommendation and tracks its accuracy over time. This builds user trust through transparency — users can see exactly how often the AI\'s picks performed well.',
      'Implemented a three-tier subscription model (Free / Pro / Premium) with progressive feature unlocking. The AI analysis depth increases with each tier, giving users a clear reason to upgrade.',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter (iOS)' },
      { category: 'Backend', items: 'FastAPI (Python), APScheduler' },
      { category: 'AI', items: 'Google Gemini 1.5 Pro' },
      { category: 'Data', items: 'FinMind API (Taiwan stock data), Yahoo Finance API (global quotes), Redis caching' },
      { category: 'Database', items: 'Supabase (PostgreSQL)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      'Full AI SaaS product with subscription model and payment integration',
      'Gemini AI integration for real-time stock diagnostics in Traditional Chinese',
      'Prediction tracking system with historical accuracy measurement',
      'Dynamic caching strategy — 5min during trading hours, 1hr after close, 24hr weekends',
    ],
    learnings: [
      'LLM output quality varies significantly with prompt structure. Structured prompts with explicit output format (JSON schema) and few-shot examples reduced Gemini hallucination by ~60% compared to free-form prompts.',
      'Financial AI products need extra guardrails. Every AI output page shows a disclaimer, and the system never gives explicit buy/sell recommendations — only analysis. This was a product decision driven by regulatory awareness.',
      'Building a subscription SaaS taught me the importance of clear tier differentiation. The first version had too many features in the free tier — users had no reason to upgrade. Restructuring around analysis depth (basic → advanced → deep) increased upgrade intent.',
    ],
    links: [
      { label: 'Try Plutus Trade', url: 'https://plutustrade.vercel.app/' },
    ],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook — AI Agent for Product Specs',
    subtitle: 'An AI agent product that turns a one-line product idea into a complete spec document using LLM orchestration.',
    metaTitle: 'Product Playbook — AI Agent Spec Generator | LLM Product Case Study',
    metaDescription: 'AI agent product for Claude Code with 22 frameworks and automated dev handoff. An LLM product case study by AI Product Manager Charles Chen.',
    problem: [
      'Product specs take days to write well. A good PRD requires synthesizing user research, competitive analysis, technical constraints, and business goals into a coherent document. Most PMs either skip this (shipping without clarity) or spend too long on it (delaying the build).',
      'Existing AI writing tools (ChatGPT, Notion AI) can generate text, but they don\'t understand product frameworks. They can\'t apply JTBD analysis, create RICE-scored backlogs, or map user personas to feature requirements — they just generate generic paragraphs.',
    ],
    solution: [
      'Built an AI agent distributed across Claude.ai Custom Skill, Claude Code Plugin, and Claude Code Skill that orchestrates multiple product frameworks into a single spec generation pipeline. Users describe their product idea in one line, select an execution mode, and the agent produces a complete spec document.',
      'The key architecture decision was using 22 established product frameworks (JTBD, Positioning, PR-FAQ, Pre-mortem, OST, RICE, PRD, etc.) as structured prompts rather than free-form generation. Each framework constrains the AI\'s output to match how experienced PMs actually think across Discovery, Define, Develop, and Deliver phases.',
      'Designed 6 execution modes — Quick, Full, Revision, Custom, Build, and Feature Expansion — so PMs can match the tool\'s depth to their stage. You don\'t need a 50-page spec for a feature experiment, but you do need full dev handoff when shipping a new product.',
      'Built a change propagation engine that automatically updates downstream documents when upstream decisions change, plus three-layer PDF parsing (pymupdf text extraction → Claude Vision semantic → Tesseract OCR fallback) so users can upload existing research in PDF/DOCX/PPTX.',
      'The automated dev handoff generates CLAUDE.md, TASKS.md, and TICKETS.md, translating product requirements into technical tasks with acceptance criteria and reducing the PM → engineer communication gap.',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin, Claude Code Skill' },
      { category: 'AI', items: 'Claude (Anthropic) — LLM orchestration, Claude Vision (PDF semantic parsing)' },
      { category: 'Frameworks', items: '22 product frameworks (JTBD, Positioning, PR-FAQ, Pre-mortem, OST, RICE, PRD, etc.)' },
      { category: 'Document Processing', items: 'Playwright (Chromium PDF rendering), Pandoc (format conversion), pymupdf (text extraction), Tesseract OCR, pikepdf (bookmarks)' },
      { category: 'Tooling', items: 'Node.js (npm), Bash, Git, Markdown (framework definitions)' },
      { category: 'Distribution', items: 'npm package, GitHub (MIT license)' },
      { category: 'Internationalization', items: '6 languages (English, Traditional/Simplified Chinese, Japanese, Spanish, Korean)' },
    ],
    impact: [
      'Open source AI agent product used by product managers and developers',
      'Concept to complete spec in minutes instead of days',
      '22 product frameworks codified into reusable LLM prompts across Discovery → Deliver phases',
      '6 execution modes (Quick / Full / Revision / Custom / Build / Feature Expansion) for different product development stages',
      '+69% quality improvement measured against baseline Claude responses without the skill',
      'Multi-channel distribution — Claude.ai, Claude Code Plugin, and Claude Code Skill — meeting users inside their existing workflow',
    ],
    learnings: [
      'LLM orchestration is a product design problem, not just an engineering problem. The order of framework execution matters — running Persona before JTBD produces better output because user context informs job identification. Spent significant time optimizing the pipeline sequence.',
      'Skill-based distribution (Claude Code ecosystem) turned out to be a strong channel. Users discover the tool inside their existing workflow rather than needing to adopt a new platform.',
      'The biggest insight as an AI Product Manager building an AI agent: the product value isn\'t in the AI — it\'s in the frameworks. The AI is the delivery mechanism, but the 22 product frameworks are the actual intellectual property. Anyone can call an LLM API; the differentiation is knowing what to ask it.',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
]
