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
    description: 'A personal AI co-pilot for Taiwan stocks. Gemini synthesizes financials and institutional flows so I don\'t spend hours pulling them myself; prediction tracking + after-hours self-review closes the loop for prompt and model fine-tuning.',
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
    title: 'Plutus Trade — Personal AI Co-pilot for Taiwan Stocks',
    subtitle: 'A personal AI tool I built so I\'d stop spending hours digging through monthly revenue, quarterly fundamentals, and institutional flows before every trade.',
    metaTitle: 'Plutus Trade — Personal AI Co-pilot for Taiwan Stocks | Generative AI Case Study',
    metaDescription: 'Personal Taiwan stock AI co-pilot with Gemini AI diagnostics, one-tap screening, prediction tracking, and after-hours self-review. A generative AI case study by AI Product Manager Charles Chen.',
    problem: [
      'Researching every Taiwan stock the manual way takes hours. Pull the monthly revenue, cross-check YoY/MoM, decode the quarterly EPS and gross margin, watch the institutional buy/sell flow, scan the K-line, then form a view. Repeat for every name in the watchlist, every day.',
      'I didn\'t want to build another consumer SaaS. I wanted a personal co-pilot that would do the synthesis for me, log its predictions, and give me back the evening I\'d otherwise spend pulling reports together.',
    ],
    solution: [
      'Built Plutus Trade as a personal Taiwan stock co-pilot. Gemini 2.5 Flash reads monthly revenue (YoY/MoM/累計), quarterly fundamentals (EPS, gross margin, ROE, dividends), institutional flows, and technical signals together, then returns a plain-language BUY/SELL/HOLD diagnostic with the reasoning. The point isn\'t to replace judgement; it\'s to compress an evening of research into a paragraph.',
      'Added a one-tap stock screening flow. A 3-step investor profile wizard (risk tolerance, horizon, sector preference) hands the constraints to the AI, which returns a curated short-list with per-pick reasoning. Saves the part of the workflow where I was clicking through 30 names just to find 3 worth a closer look.',
      'Built a prediction tracking layer on top of every AI recommendation. Each pick is logged with its entry context, then settled at horizon: actual ROI, win rate, decision quality matrix. The 16:30 after-hours daily report includes an AI self-review that compares yesterday\'s calls against what actually happened. This closes the feedback loop and gives me labelled data I need to fine-tune prompts (and eventually a model) over time.',
      'Originally shipped with a 3-tier subscription model and Apple In-App Purchase. Pulled it. Once the goal collapsed to "personal tool I trust", the SaaS scaffolding was just friction: auth flows for one user, tier gating for features I\'d always unlock, payment integration to charge no one. Removing it freed the product to optimize for analytical depth instead of upgrade intent.',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+ (Web on Vercel), Riverpod, go_router, fl_chart, Dio' },
      { category: 'Backend', items: 'FastAPI (Python 3.11), Pydantic v2, httpx, APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI, Yahoo Finance, FinMind (with fallback chain + 7-day stale cache)' },
      { category: 'Database', items: 'Supabase (PostgreSQL), Redis (Upstash) for caching' },
      { category: 'Notifications', items: 'Web Push via VAPID/pywebpush, 16 notification types with 12h cooldown' },
      { category: 'Deployment', items: 'Vercel (frontend, auto-deploy) + Fly.io (backend, nrt region)' },
    ],
    impact: [
      'Personal AI co-pilot covering 8 integrated modules: data center, watchlist/portfolio, AI diagnostics, one-tap screening, prediction tracking, fundamentals, smart notifications, and after-hours daily report',
      'Closed-loop prediction system: every AI call is logged, settled at horizon, and reviewed in the next-day report, building the labelled dataset needed for prompt iteration and eventual model fine-tuning',
      'Three-tier data source fallback (FinMind → Yahoo Finance → TWSE/TPEX OpenAPI) with stale-cache safety net keeps the AI fed even when one provider goes down',
      'Dynamic caching strategy: 5min during trading hours, cache-until-next-open after close, weekend cache rolls to Monday',
    ],
    learnings: [
      'LLM output quality varies significantly with prompt structure. Structured prompts with explicit output format (JSON schema) and few-shot examples reduced Gemini hallucination by ~60% compared to free-form prompts.',
      'Financial AI products need extra guardrails. Every AI output page shows a disclaimer, and the BUY/SELL/HOLD label is framed as analysis output, not investment advice. Even for a personal tool, baking the constraint in early matters: it stops me from outsourcing judgement to the model.',
      'Pulling subscriptions was the most clarifying decision. The moment I decided this was a tool I built for myself, every "what if a free-tier user does X" trade-off disappeared. Build constraints come from who you build for; getting that right first is more important than any individual feature.',
      'The prediction tracking layer is more valuable than the prediction itself. The AI is the easy part; the labelled history of "what did the AI say, what actually happened, why was it wrong" is the moat that lets the system improve over time. This is the foundation I want for any future fine-tuning work.',
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
