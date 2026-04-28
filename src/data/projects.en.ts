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
      'Offline-first trip planning PWA. Cache-first + background sync keeps your itinerary, transit routes, and costs reachable even when the network drops abroad.',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
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
      'AI-powered product planning system with 22 frameworks, 6 execution modes, and automated dev handoff. From concept to spec in minutes.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — Offline-First Trip Planning PWA',
    subtitle: 'A Progressive Web App that keeps your full itinerary, transit routes, and costs accessible even when the network drops abroad.',
    metaTitle: 'Path — Offline-First Trip Planning PWA | Charles Chen Product Case Study',
    metaDescription: 'An offline-first PWA for multi-day trip planning. Cache-first + background sync architecture using React, TypeScript, Supabase, and IndexedDB so itineraries work abroad without a connection.',
    problem: [
      'Trip itinerary apps (Wanderlog, Tripit, or local options like 去趣) assume connectivity. They render a beautiful itinerary on the airport WiFi, then go blank in the Tokyo subway, the rural Hokkaido hot spring, the JR transfer with no signal. The planner is most needed exactly when it stops working.',
      'Mobile data abroad is expensive, spotty, or both. Pocket WiFi runs out of battery, eSIM doesn\'t cover every basement station, and group plans bottleneck on whichever phone happens to be doing the routing for everyone. A trip planner that requires the network is the planner that fails at the worst moment.',
    ],
    solution: [
      'Built Path as an offline-first Progressive Web App. The architectural question wasn\'t "native or web." It was "how do I make a web app that works without a network." PWA answered both: installable on iOS and Android home screens with a single URL, full offline capability through a Service Worker, no app store gate, no native build, no platform tax.',
      'Adopted a cache-first + background sync data strategy. All reads hit IndexedDB first for instant render, then a background sync to Supabase brings down fresh data and updates the cache. Writes happen optimistically: the UI updates immediately, the change is committed to local cache, and the API call runs in the background. If the network is gone, the change waits in a sync queue and replays when connectivity returns. Travelers never see a loading spinner abroad, and nothing they typed gets lost.',
      'Built the planning experience around that offline guarantee: drag-and-drop multi-day itineraries (@dnd-kit), Google Maps for places and routes (cached after first fetch), Japan/Taiwan-specific transit directions with vehicle icons and walking durations, cost tracking with currency support, photo and document attachments, and frequent-traveler templates for repeat trips. Row Level Security on Supabase isolates each user\'s data on the server.',
    ],
    techStack: [
      { category: 'Frontend', items: 'React 18, TypeScript, Vite, TailwindCSS, shadcn/ui (Radix UI)' },
      { category: 'Offline / PWA', items: 'IndexedDB (via idb), Service Worker, PWA manifest' },
      { category: 'State', items: 'TanStack Query (server state), React Context (auth), @dnd-kit (drag-and-drop)' },
      { category: 'Backend', items: 'Supabase (PostgreSQL, Auth with Google OAuth, Storage, Row Level Security)' },
      { category: 'Maps', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: 'Validation', items: 'Zod (client schemas), Postgres CHECK constraints (server)' },
      { category: 'Testing', items: 'Vitest, Testing Library' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      'Offline-first PWA: full itinerary, transit routes, and costs accessible without a connection',
      'Cache-first + background sync: instant reads, optimistic writes, sync queue catches network drops without losing edits',
      'Japan/Taiwan transit specialization: vehicle icons, line colors, walking durations matching the primary use case',
      'Single codebase, single URL: installable on iOS/Android home screens with no app store distribution overhead',
    ],
    learnings: [
      'PWA was the load-bearing architecture decision. Going native would have meant two codebases, two app store reviews, and still no good answer for "what happens when the network is gone." The PWA route gave Path everything a native app delivered (home-screen icon, offline support, installability) without the platform tax. The offline story got measurably stronger because Service Worker + IndexedDB are first-class web primitives now.',
      'Cache-first + background sync looks clean in a sequence diagram and gets messy in practice. Reads were straightforward: IndexedDB returns cached data instantly. The hard part was conflicts. A user edits the same trip on two devices both offline, both come back online later. Settled on last-write-wins with timestamp-based merging plus a per-record sync queue. Not perfect, but matches the actual user behaviour (single user, occasional multi-device, rare true conflicts).',
      'Google Maps API costs scale with route lookups, not user count. Aggressive caching policy: directions cached 24h, geocoded places cached indefinitely, the selected transit polyline stored on the trip itself once chosen. API spend stayed flat while usage grew, without degrading the offline experience. Every cached call is also a call that works without connectivity.',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/path' },
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
      'The gap isn\'t data availability. It\'s analysis capability. Raw K-line charts, revenue reports, and institutional trading data are publicly available, but synthesizing them into actionable insights requires expertise that most retail investors don\'t have.',
    ],
    solution: [
      'Built an AI-powered stock analysis platform that uses Gemini AI to synthesize multiple data sources (price action, technical indicators, institutional trading patterns, and financial reports) into plain-language diagnostics.',
      'The core product innovation is "one-tap stock screening": users describe what they\'re looking for (e.g., "undervalued tech stocks with growing revenue"), and the AI returns a curated list with reasoning for each pick. This replaces hours of manual screening.',
      'Added a prediction tracking system that logs every AI recommendation and tracks its accuracy over time. This builds user trust through transparency: users can see exactly how often the AI\'s picks performed well.',
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
      'Dynamic caching strategy: 5min during trading hours, 1hr after close, 24hr weekends',
    ],
    learnings: [
      'LLM output quality varies significantly with prompt structure. Structured prompts with explicit output format (JSON schema) and few-shot examples reduced Gemini hallucination by ~60% compared to free-form prompts.',
      'Financial AI products need extra guardrails. Every AI output page shows a disclaimer, and the system never gives explicit buy/sell recommendations, only analysis. This was a product decision driven by regulatory awareness.',
      'Building a subscription SaaS taught me the importance of clear tier differentiation. The first version had too many features in the free tier, leaving users no reason to upgrade. Restructuring around analysis depth (basic → advanced → deep) increased upgrade intent.',
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
      'Existing AI writing tools (ChatGPT, Notion AI) can generate text, but they don\'t understand product frameworks. They can\'t apply JTBD analysis, create RICE-scored backlogs, or map user personas to feature requirements. They just generate generic paragraphs.',
    ],
    solution: [
      'Built an AI agent distributed across Claude.ai Custom Skill, Claude Code Plugin, and Claude Code Skill that orchestrates multiple product frameworks into a single spec generation pipeline. Users describe their product idea in one line, select an execution mode, and the agent produces a complete spec document.',
      'The key architecture decision was using 22 established product frameworks (JTBD, Positioning, PR-FAQ, Pre-mortem, OST, RICE, PRD, etc.) as structured prompts rather than free-form generation. Each framework constrains the AI\'s output to match how experienced PMs actually think across Discovery, Define, Develop, and Deliver phases.',
      'Designed 6 execution modes (Quick, Full, Revision, Custom, Build, and Feature Expansion) so PMs can match the tool\'s depth to their stage. You don\'t need a 50-page spec for a feature experiment, but you do need full dev handoff when shipping a new product.',
      'Built a change propagation engine that automatically updates downstream documents when upstream decisions change, plus three-layer PDF parsing (pymupdf text extraction → Claude Vision semantic → Tesseract OCR fallback) so users can upload existing research in PDF/DOCX/PPTX.',
      'The automated dev handoff generates CLAUDE.md, TASKS.md, and TICKETS.md, translating product requirements into technical tasks with acceptance criteria and reducing the PM → engineer communication gap.',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin, Claude Code Skill' },
      { category: 'AI', items: 'Claude (Anthropic) for LLM orchestration, Claude Vision (PDF semantic parsing)' },
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
      'Multi-channel distribution (Claude.ai, Claude Code Plugin, and Claude Code Skill) meeting users inside their existing workflow',
    ],
    learnings: [
      'LLM orchestration is a product design problem, not just an engineering problem. The order of framework execution matters: running Persona before JTBD produces better output because user context informs job identification. Spent significant time optimizing the pipeline sequence.',
      'Skill-based distribution (Claude Code ecosystem) turned out to be a strong channel. Users discover the tool inside their existing workflow rather than needing to adopt a new platform.',
      'The biggest insight as an AI Product Manager building an AI agent: the product value isn\'t in the AI. It\'s in the frameworks. The AI is the delivery mechanism, but the 22 product frameworks are the actual intellectual property. Anyone can call an LLM API; the differentiation is knowing what to ask it.',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
]
