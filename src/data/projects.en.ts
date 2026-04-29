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
  screenshots?: { src: string; alt: string }[]
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
    description: 'AI-powered stock-picking tool for Taiwan equities, integrating real-time prices, K-line charts, financial-statement analysis, AI per-name diagnostics, and one-tap screening, with a performance-tracking backtest system that continuously improves AI accuracy.',
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
  {
    id: 'house-ops',
    title: 'House Ops',
    description:
      'Autonomous house-hunting pipeline for the Taiwan rental market. Scans 591 every morning, scores each listing on five weighted dimensions, and delivers a curated email digest before you finish your coffee.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation'],
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
      'Built Path as an offline-first Progressive Web App. The real architectural question was "how do I make a web app that works without a network" (the surface-level "native or web" is downstream of that). PWA satisfied both: installable on iOS and Android home screens with a single URL, full offline capability through a Service Worker, no app store gate, no native build, no platform tax.',
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
      'Google Maps API costs scale with route lookups (independent of user count). Aggressive caching policy: directions cached 24h, geocoded places cached indefinitely, the selected transit polyline stored on the trip itself once chosen. API spend stayed flat while usage grew, without degrading the offline experience. Every cached call is also a call that works without connectivity.',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — Personal AI Decision-Support Tool for Taiwan Equities',
    subtitle: 'A single-user analytical tool that compresses the daily research cycle (fundamentals, institutional flow, and technical signals) into one AI synthesis pass, with every recommendation instrumented for long-run auditability.',
    metaTitle: 'Plutus Trade — Personal AI Decision-Support Tool for Taiwan Equities | Case Study',
    metaDescription: 'Single-user decision-support tool for active Taiwan equity research. Gemini-powered synthesis, guided screening, and instrumented prediction tracking. A generative AI case study by AI Product Manager Charles Chen.',
    problem: [
      'For an active Taiwan equity practitioner, the daily research workflow is a compounding time cost: monthly revenue with YoY/MoM normalization, quarterly fundamentals (EPS, gross margin, ROE), institutional buy/sell flow, and technical structure on the K-line. Each input is individually addressable; the bottleneck is synthesis. Across a watchlist of 30–50 names, the analytical workload routinely exceeds the time budget of any practitioner who is not full-time on the desk.',
      'Available consumer tooling addresses this asymmetrically. Charting apps surface raw data without interpretation; advisory products provide interpretation but treat the user as a passive recipient. Neither serves the use case in between: a domain-literate operator who wants AI-assisted synthesis they can override, audit, and build trust in over time.',
    ],
    solution: [
      'Plutus Trade is positioned as a single-user decision-support tool. Gemini 2.5 Flash performs cross-domain synthesis on each name in the watchlist (monthly revenue with YoY/MoM/cumulative views, quarterly fundamentals covering EPS, gross margin, ROE, dividend policy, institutional flow, and technical signals) and returns a BUY/SELL/HOLD diagnostic with explicit reasoning. Output is framed strictly as analysis under disclaimer, and final decision authority stays with the user.',
      'A guided screening flow translates qualitative investment criteria into an AI-executable contract. A three-step investor profile (risk tolerance, holding horizon, sector preference) parameterizes the screening prompt, returning a curated short-list with per-pick reasoning. The discovery phase of the workflow, historically the highest-time-cost step, collapses into a single interaction.',
      'An instrumented prediction layer logs every AI recommendation with its entry context and settles outcomes at horizon, producing a structured record of decision quality (realized ROI, win rate, decision-quality matrix). The intent is durable transparency: the user can interrogate the system\'s historical performance across market regimes and strategy types, treating any single output as one data point in a longitudinal track record.',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+ (Web on Vercel), Riverpod, go_router, fl_chart, Dio' },
      { category: 'Backend', items: 'FastAPI (Python 3.11), Pydantic v2, httpx, APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI, Yahoo Finance, FinMind (three-source fallback chain + 7-day stale cache)' },
      { category: 'Database', items: 'Supabase (PostgreSQL), Redis (Upstash) for caching' },
      { category: 'Notifications', items: 'Web Push via VAPID/pywebpush, 16 notification types with 12h cooldown' },
      { category: 'Deployment', items: 'Vercel (frontend, auto-deploy) + Fly.io (backend, nrt region)' },
    ],
    impact: [
      'Single-user decision-support surface covering 8 integrated modules: market data center, watchlist and portfolio management, AI diagnostics, guided screening, prediction tracking, fundamental analysis, smart notifications, and after-hours daily report',
      'Instrumented prediction layer logging every AI call with entry context and settled outcome (ROI, win rate, decision-quality matrix), making the system fully auditable',
      'Three-source data resilience: FinMind → Yahoo Finance → TWSE/TPEX OpenAPI fallback chain with seven-day stale-cache safeguard maintains analytical capability under upstream provider outages',
      'Trading-aware caching policy: five-minute TTL during regular session, cache held until next open after close, weekend cache rolls forward to Monday open',
    ],
    learnings: [
      'LLM output quality is primarily a function of prompt contract design. JSON-schema-constrained prompts with few-shot anchors reduced Gemini hallucination by approximately 60% relative to free-form prompting. Most "we need a stronger model" debates resolve upstream: a tighter prompt contract closes the gap before model swapping is justified.',
      'In financial AI, the line between analysis and advice must be enforced at the product layer. The model will produce recommendations on demand; the product\'s job is to reframe them as analysis under explicit disclaimer. This is a design decision that lives at the product layer, with content moderation downstream of it.',
      'Audience-of-one is a deliberate product constraint that doubles as the product strategy. Scoping to a single domain-literate user eliminates the trade-off matrix consumer products inherit (sensible defaults, novice onboarding, error tolerance for the unfamiliar) and frees the design surface to optimize for analytical depth.',
      'For decision-support tools, data source reliability is a first-class product concern. A multi-tier fallback chain with stale-cache safety net is what keeps the tool useful when an upstream provider degrades; in this product category, degradation is functionally an outage of the core value proposition.',
    ],
    links: [
      { label: 'Try Plutus Trade', url: 'https://plutustrade.vercel.app/' },
    ],
    screenshots: [
      {
        src: '/assets/plutus-watchlist.png',
        alt: 'Plutus Trade watchlist with stock cards showing prices, daily change, and intraday sparklines. Stock names and tickers are blurred for the demo.',
      },
      {
        src: '/assets/plutus-ai-winrate.png',
        alt: 'AI screening win-rate analytics: 64% on 238 picks, average ROI +58.96%, ROI distribution chart, monthly breakdown.',
      },
      {
        src: '/assets/plutus-holdings-winrate.png',
        alt: 'Portfolio win-rate analytics with per-holding returns and unrealized P&L. Stock names and tickers are blurred for the demo.',
      },
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
      'The key architecture decision was using 22 established product frameworks (JTBD, Positioning, PR-FAQ, Pre-mortem, OST, RICE, PRD, etc.) as structured prompts. Each framework constrains the AI\'s output to match how experienced PMs actually think across Discovery, Define, Develop, and Deliver phases. Free-form generation is what this approach replaces.',
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
      'Concept to complete spec in minutes (down from days)',
      '22 product frameworks codified into reusable LLM prompts across Discovery → Deliver phases',
      '6 execution modes (Quick / Full / Revision / Custom / Build / Feature Expansion) for different product development stages',
      '+69% quality improvement measured against baseline Claude responses without the skill',
      'Multi-channel distribution (Claude.ai, Claude Code Plugin, and Claude Code Skill) meeting users inside their existing workflow',
    ],
    learnings: [
      'LLM orchestration is a product design problem first, with engineering as the implementation layer. The order of framework execution matters: running Persona before JTBD produces better output because user context informs job identification. Spent significant time optimizing the pipeline sequence.',
      'Skill-based distribution (Claude Code ecosystem) turned out to be a strong channel. Users discover the tool inside their existing workflow, with no new platform adoption required.',
      'The biggest insight as an AI Product Manager building an AI agent: the product value isn\'t in the AI. It\'s in the frameworks. The AI is the delivery mechanism, but the 22 product frameworks are the actual intellectual property. Anyone can call an LLM API; the differentiation is knowing what to ask it.',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
  {
    id: 'house-ops',
    title: 'House Ops — Autonomous House-Hunting Pipeline for the Taiwan Rental Market',
    subtitle: 'A scheduled scanner for 591 listings that scores each rental and purchase property on five weighted dimensions and ships an HTML digest at 09:00, with a Claude-powered interactive layer for affordability checks, comparisons, and visit preparation.',
    metaTitle: 'House Ops — Autonomous House-Hunting Pipeline | Charles Chen Personal Project',
    metaDescription: 'A Node.js automation pipeline that scrapes 591 daily, scores Taiwan rental and purchase listings on price, space, location, condition, and risk, and delivers an HTML email digest. A personal automation case study by AI Product Manager Charles Chen.',
    problem: [
      'Searching for a rental in Taiwan on 591 is a repetitive scan-evaluate-discard loop. Listings come and go within hours, prices shift, the same property reposts under a different agent, and any honest evaluation takes thirty-plus tabs of cross-referencing: MRT distance, school district, building age, layout, agent reputation. For a working professional running this in evenings only, the funnel is wide enough that high-priority listings get buried under noise inside a single day\'s drift.',
      '591 itself, and most Taiwan rental aggregators, surface raw fields without judgment. They list, they sort, they filter; they don\'t score. A listing\'s reasonableness depends on a contextual blend (rent against district median, layout against household size, building condition, tenancy risk) that the platform does not consolidate. The user is left to do the synthesis manually, every day, on every listing.',
    ],
    solution: [
      'Built House Ops as a Node.js (ESM) automation pipeline driven by macOS launchd. Each morning at 09:00, run-daily.mjs triggers an agent-browser session that scans the configured 591 search regions, deduplicates against data/last-scan.json (cache) and data/scan-history.tsv (long-running record), and writes a delta of new, price-changed, and delisted properties.',
      'Each listing is scored heuristically across price reasonableness, space and layout, neighborhood amenities, property condition, and risk, weighted into a 0–5 total (rent uses 30/20/25/15/10; purchase uses 35/20/20/15/10). Keyword detection picks up MRT proximity (捷運), school district (學區), elevator availability, balcony, floor, and renovation status. Listings ≥4.0 are flagged as recommend, 3.5–3.9 as worth a cautious look, and below 3.5 as skip.',
      'Results render into an HTML email through nodemailer over Gmail SMTP and arrive before the morning coffee window. The email contains a new-listings table (score, district, rent, size, layout, warnings, 591 link), price-change rows, delisted entries, and a district breakdown. A second layer lives inside Claude Code: in-session interactive modes for affordability calculation, upgrade-plan modeling, side-by-side property comparison, visit-day checklists, and ad-hoc scan and pipeline commands. The automated pipeline does the funnel; the interactive modes do the human-decision moments around viewings and trade-offs.',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js (ESM, .mjs)' },
      { category: 'Scraping', items: 'agent-browser (591 search and listing page extraction)' },
      { category: 'Email', items: 'nodemailer over Gmail SMTP (App Password authentication)' },
      { category: 'Scheduling', items: 'macOS launchd (com.house-ops.daily.plist, daily 09:00)' },
      { category: 'Persistence', items: 'data/last-scan.json (cache), data/scan-history.tsv (history), data/tracker.md (lifecycle), data/pipeline.md (queue)' },
      { category: 'Interactive Layer', items: 'Claude Code modes (affordability, upgrade plan, compare, prepare visit, pipeline, scan)' },
      { category: 'Source', items: '591.com.tw (rentals + purchases)' },
    ],
    impact: [
      'Scheduled scanning: macOS launchd triggers run-daily.mjs every morning at 09:00; results are deduplicated against a persisted scan history (data/last-scan.json cache + data/scan-history.tsv long-running record)',
      'Five-dimension scoring: each listing is scored on price reasonableness, space and layout, neighborhood amenities, property condition, and risk, weighted to a 0–5 total (rent uses 30/20/25/15/10, purchase uses 35/20/20/15/10)',
      'Daily email digest: HTML brief via nodemailer over Gmail SMTP covering new listings, price changes, delisted entries, and district breakdown, delivered before the morning coffee window',
      'Stateful tracker: every evaluated property flows through a Scanned → Evaluated → Visit → Signed lifecycle persisted in data/tracker.md',
      'Interactive Claude modes: in-session affordability calculator, upgrade-plan modeling, side-by-side property comparison, visit-day checklists, and ad-hoc scan and pipeline commands, layered on top of the automated pipeline',
    ],
    learnings: [
      'launchd is the right scheduling primitive on macOS for tools that depend on a logged-in user session. cron runs detached and inherits a minimal environment, which complicates anything that needs the user\'s keychain (Gmail credentials), GUI subsystems (some headless browser modes), or process supervision. launchd respects pmset wake settings, integrates with the system log, and survives reboot without manual reseeding. For a daily personal automation, the operational ceiling is meaningfully higher.',
      'A first pass tried hard threshold filters: rent ≤ X, MRT walking distance ≤ Y, building age ≤ Z. The output was unstable as priorities shifted: a cheap reasonable listing got dropped for being one floor above the cap, while a pricier listing that happened to hit every default snuck through. Switching to dimensional weights, with a 0–5 composite and three decision bands (≥4.0 recommend, 3.5–3.9 cautious, <3.5 skip), let the system surface trade-offs without losing borderline candidates that deserved a second look.',
      'A web dashboard was the obvious-looking interface for a personal tool, then the actual morning routine made the choice. The first thing checked is the phone, before getting out of bed. Email lands in that exact context: scannable on a small screen, archivable as a record, searchable by date. A dashboard would have required deliberate navigation; the email shows up where attention already is.',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/house-ops' },
    ],
    screenshots: [
      {
        src: '/assets/house-ops-daily-report.png',
        alt: 'House Ops daily email digest: top summary block, new-listings table, price-change and delisted rows, district breakdown.',
      },
      {
        src: '/assets/house-ops-listing-report.png',
        alt: 'Per-listing five-dimension evaluation report: price reasonableness, space and layout, neighborhood amenities, property condition, and risk scored individually with the 0–5 weighted composite.',
      },
    ],
  },
]
