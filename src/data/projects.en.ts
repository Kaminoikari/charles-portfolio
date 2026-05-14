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
      '"When the network disappears, your itinerary shouldn\'t disappear with it." A PWA designed for unstable network environments. A cache-first + background sync architecture keeps itineraries, transit routes, and expenses fully usable offline. A single URL installs straight to iOS and Android home screens.',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description: '"Take the analytical firepower of an entire trading desk and compress it into a single AI synthesis pass." A deep-analysis tool built for a single trader: monthly revenue, fundamentals, institutional flow, and technical structure are cross-domain synthesized by Gemini AI, every recommendation is instrumented for long-run win-rate and ROI tracking, and an underlying quantitative momentum model screens the candidate pool so the semantic reasoning rests on solid data.',
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
      'Taiwan housing automation pipeline. Scans 591 and Facebook public rental groups daily, has Claude API extract structured fields from free-form posts, scores listings on five weighted dimensions, and hands off affordability checks, upgrade planning, and visit prep to an AI decision layer.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation', 'Claude API'],
  },
  {
    id: 'job-ops',
    title: 'Job Ops',
    description:
      '"Turn the weapon that was aimed at you, back to your own use." An automated personal job-search pipeline. Daily 07:00 run pulls fresh 104 listings, scores them against your markdown CV, and emails a three-tier digest (RECOMMEND, CAUTIOUS, SKIP). Seven Claude Code interactive modes pick up the deeper calls: company legitimacy, level strategy, interview prep.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/job-ops',
    tags: ['Python', 'launchd', 'CV-aware', 'Automation'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — Offline-First Trip Planning PWA',
    subtitle: '"When the network disappears, your itinerary shouldn\'t disappear with it." A Progressive Web App (PWA) designed for unstable network environments, making sure travellers stay oriented at the moments where help matters most: no blackouts even when the signal is gone (traffic, expenses, and routes stay reachable from deep inside the Tokyo subway or a remote hot-spring town), zero-latency feel (offline-first architecture for instant reads with background sync), and cross-platform install (a single URL installs straight to the iOS or Android home screen, no app store needed).',
    metaTitle: 'Path — Offline-First Trip Planning PWA | Charles Chen Product Case Study',
    metaDescription: 'A Progressive Web App designed for unstable network environments. Cache-first + background sync architecture built with React, TypeScript, Supabase, and IndexedDB keeps the full itinerary, transit routes, and expense records working without a connection. A travel-product case study by AI Product Manager Charles Chen.',
    problem: [
      'Most trip-planning apps on the market (Wanderlog, Tripit) assume the user is always online. In international travel, that turns out to be a luxurious assumption.',
      'Signal blackouts. The airport WiFi works fine; then the itinerary turns into a blank screen the moment you reach a subway platform, an underground shopping arcade, or a rural hot-spring town.',
      'Unstable connectivity. Mobile data abroad is expensive and patchy. The moment a Pocket WiFi battery dies or an eSIM drops at the worst possible time, the whole group\'s itinerary and routing collapses.',
      'The tool\'s own contradiction. An app that needs the network to work is precisely the one that goes down at the worst possible moment (no signal, urgent need to find the way).',
    ],
    solution: [
      'Path doesn\'t just wrap a website into an app; it redefines a "web app that works without the network" from the architecture up.',
      'PWA as the architectural choice. Going PWA over native solved cross-platform install and offline runtime in the same move. Through a Service Worker we get the same kind of capabilities a native app would, without paying the "platform tax" or waiting on app-store review cycles.',
      'Cache-first strategy. On reads, every request hits a local IndexedDB first to render instantly, while fresh data syncs quietly from Supabase in the background. On writes, we use optimistic UI: the moment the user taps, the UI responds, the edit goes into a sync queue, and the queue replays automatically once connectivity returns.',
      'Specialised for Taiwan-to-Japan travellers. Google Maps integration for places and routes, with dedicated labels for common Japan/Taiwan public transit (vehicle icons, walking durations, line colours), plus multi-currency expense tracking, photo and document attachments, and one-tap apply for frequent-traveller itinerary templates.',
      'Secure data isolation. Supabase Row Level Security (RLS) keeps user data properly isolated in a multi-tenant setup.',
    ],
    techStack: [
      { category: 'Frontend Framework', items: 'React 18, TypeScript, Vite, TailwindCSS' },
      { category: 'Offline Tech', items: 'IndexedDB (via idb), Service Worker, PWA Manifest' },
      { category: 'State Management', items: 'TanStack Query (server sync), @dnd-kit (itinerary drag-and-drop)' },
      { category: 'Backend Services', items: 'Supabase (PostgreSQL, Auth, Storage, RLS)' },
      { category: 'Maps Integration', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      '100% offline-usable: core itinerary, map routes, and expense records all keep working when the network is fully gone.',
      'Buttery UI: cache-first removes every loading spinner, and writes are guaranteed not to lose data.',
      'Context-aware design: built directly around Taiwan-to-Japan travel pain points, with vehicle colours and icons that match the real-world transit signage.',
      'Low maintenance cost: one codebase covers cross-platform install, removing native app development and multi-store distribution overhead.',
    ],
    learnings: [
      'PWA was a load-bearing decision. Going native would have meant two codebases and two app-store review cycles, with development energy diluted across both. The core question "what happens when the network is gone" turned out to have a more elegant, more native-feeling answer in the web\'s own Service Worker + IndexedDB stack.',
      'Sync logic is the real challenge. Cache-first + background sync looks clean in a sequence diagram and gets messy fast in practice. The hardest part is conflicts: two phones editing the same trip offline, both syncing later. I settled on last-write-wins with timestamp-based merging plus a per-record sync queue. Imperfect, but for the actual usage profile (mostly single-user, occasionally multi-device, rarely true conflicts) it strikes the right balance between fidelity and engineering cost.',
      'Precise cost control on the maps side. Google Maps API costs scale with request volume, so I leaned into aggressive caching: places cached indefinitely, directions cached 24h, and the chosen polyline pinned to the trip itself. API spend stayed flat as usage grew, and the win came with a useful side effect: every cached request that saves money is also a request that works without connectivity.',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
    screenshots: [
      {
        src: '/assets/path-demo.mp4',
        alt: 'Path 30-second demo video stepping through nine scenes: marketing hero, feature grid, dashboard KPI overview, trip card list, drag-to-reorder day editor, Asia route map, itemized cost breakdown, AI receipt OCR scanner, offline-mode banner over a fully-loaded dashboard, and a closing Path brand frame.',
      },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — Personal AI Decision-Support Tool for Taiwan Equities',
    subtitle: '"Take the analytical firepower of an entire trading desk and compress it into a single AI synthesis pass." A deep-analysis tool built for a single trader. It does not just display data, it compresses what used to be hours of fundamentals + institutional flow + technical research into one decision recommendation grounded in explicit reasoning: full-spectrum synthesis (monthly revenue, fundamentals, institutional flow, and technical structure all cross-domain diagnosed by Gemini AI), auditable decisions (every AI recommendation is instrumented for long-run win-rate and ROI tracking), and a quantitative foundation (a momentum model pre-screens the candidate pool so the semantic reasoning rests on solid data).',
    metaTitle: 'Plutus Trade — Personal AI Decision-Support Tool for Taiwan Equities | Case Study',
    metaDescription: 'Single-user decision-support tool for active Taiwan equity research. Gemini-powered synthesis, guided screening, and instrumented prediction tracking. A generative AI case study by AI Product Manager Charles Chen.',
    problem: [
      'For an active Taiwan equity trader, the most expensive cost is not capital, it is research time.',
      'Analytical-load explosion: every name demands processing monthly revenue YoY/MoM, quarterly EPS and gross margin, institutional flow, and K-line structure. Once the watchlist reaches 30–50 names, the workload directly blows through the time budget of any non-full-time trader.',
      'A polarized tool market: existing charting apps "lay out the data" without interpretation; advisory products hand out "hot tips" with no transparency underneath.',
      'A trust gap: no tool serves the middle, the domain-literate trader who wants AI-accelerated analysis but also needs to "personally audit the AI\'s reasoning" to build trust over time.',
    ],
    solution: [
      'Plutus Trade positions itself as your personal digital analyst, translating qualitative investment criteria into an AI-executable instruction contract.',
      'Cross-domain AI diagnosis: Gemini 2.5 Flash performs cross-dimensional synthesis on the watchlist. The system returns a BUY/SELL/HOLD diagnostic with explicit reasoning, framed at the level of "professional analysis," with final decision authority retained by the user.',
      'Guided Discovery: a three-step investor profile (risk tolerance, holding horizon, sector preference) collapses a long market scan into one high-quality interaction that returns a curated short-list with per-pick reasoning.',
      'Hybrid Quant Layer: the system does not rely on semantic reasoning alone. A 14:00 daily quantitative model computes eight market-wide momentum features with percentile rank and pre-orders the candidate pool, "laying the foundation" so the LLM can focus on the semantic reasoning it is best at.',
      'Full audit trail: every prediction is logged with entry context. When recommendations settle at horizon, the system produces a structured decision-quality matrix (realized ROI, win rate). This lets the user look back across market cycles and audit how the system performed in each regime.',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+ (cross-platform, deployed on Vercel)' },
      { category: 'Backend', items: 'FastAPI (Python 3.11), Pydantic v2, APScheduler' },
      { category: 'AI Engine', items: 'Google Gemini 2.5 Flash (narrative synthesis)' },
      { category: 'Quant Engine', items: 'In-house momentum scorer (8-feature weighting + Redis cache)' },
      { category: 'Data Sources', items: 'Three-tier fallback chain (FinMind → Yahoo Finance → TWSE OpenAPI)' },
      { category: 'Persistence', items: 'Supabase (PostgreSQL), Redis (Upstash) for intraday cache' },
      { category: 'Deployment', items: 'Fly.io (backend, nrt region) + Vercel (frontend)' },
    ],
    impact: [
      'Full-stack coverage: a single interface integrates market data, AI diagnostics, guided screening, prediction tracking, and 8 modules in total',
      'Data resilience: a three-tier source fallback plus a 7-day stale-cache safety net keeps the tool analytically capable even when upstream providers degrade',
      'Auditable trust: every AI call is traceable and settled at horizon, solving the "black box" problem common to AI in financial decisions',
      'Market-aware caching: TTL auto-adjusts by trading session (5-minute intraday, locked over the weekend), saving API spend while keeping data fresh',
    ],
    learnings: [
      '"The design of the Prompt Contract decides the quality of the AI\'s decisions." During development I found that most "the model isn\'t strong enough" complaints can be resolved by tightening upstream structural constraints. By using a JSON Schema to bound the output format and introducing few-shot anchors, I cut Gemini\'s hallucination rate by roughly 60%.',
      'Product-design discipline at the boundary: in a financial product, the line between "analysis" and "advice" has to be enforced at the interface layer. The product\'s job is to frame model output as professional analysis under explicit disclaimer.',
      'The strategic advantage of "designing for one person": pinning the audience to "a single domain-literate user" is a deliberate product strategy. It let me eliminate every redundant design aimed at novices and release the entire design surface in pursuit of analytical depth and system auditability. In the decision-support category, "reliability" and "transparency" are the highest-priority value propositions.',
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
    screenshots: [
      {
        src: '/assets/product-playbook-demo-en.mp4',
        alt: 'Product Playbook Build Mode demo video: describe a product requirement, the AI scans the existing codebase, detects the tech stack, then applies PM frameworks to clarify the problem before jumping into solution design.',
      },
    ],
  },
  {
    id: 'house-ops',
    title: 'House Ops — Taiwan Housing Automation & AI Decision Pipeline',
    subtitle: 'A macOS launchd job kicks off a Node.js pipeline at 09:00 daily: scans 591 and Facebook public rental groups, has Claude API (Haiku 4.5) extract structured fields from free-form posts, scores each listing 0–5 on five weighted dimensions, and ships an HTML digest. A Claude decision layer takes over in-session for affordability checks, upgrade planning, side-by-side comparisons, and visit-day checklists.',
    metaTitle: 'House Ops — Taiwan Housing Automation & AI Decision Pipeline | Charles Chen Personal Project',
    metaDescription: 'A Node.js automation pipeline that scans 591 and Facebook public rental groups daily, uses Claude API to extract structured fields from free-form posts, scores Taiwan listings on price, space, location, condition, and risk, and delivers an HTML email digest. A personal automation case study by AI Product Manager Charles Chen.',
    problem: [
      'Hunting for a property in Taiwan traps users in a low-efficiency scan → evaluate → discard loop spread across 591, Facebook public groups, and a long tail of community boards. Listings are highly volatile and noisy: repeat postings, price drift, fragmented data across platforms, and free-form social posts that no field filter can read. Users end up juggling dozens of tabs to manually cross-reference MRT proximity, school districts, layouts, and agent reputation. For time-constrained working professionals, the cost of decision-making and the sheer volume of noise routinely bury high-quality listings. Existing platforms expose only basic field filters; they lack any synthesized diagnosis of listing context (rent against district median, spatial ratios, tenancy risk), forcing users to repeat low-value information synthesis every single day.',
    ],
    solution: [
      'This project ships a Node.js (ESM) automation pipeline driven by macOS launchd. At 09:00 daily, two scans run in parallel: agent-browser hits the configured 591 search areas, while a dedicated Chrome instance (kept alive by a separate launchd plist with its profile isolated from the user\'s daily Chrome) uses the Chrome DevTools Protocol `Input.synthesizeScrollGesture` to bypass Facebook anti-bot lazy-load and pull the latest posts from public rental groups. Free-form FB posts are handed to Claude API (Haiku 4.5) for `{price_num, address, district, size, layout, contact, confidence}` extraction, then merged with 591 listings into a single evaluation queue. Each listing runs through a five-dimension heuristic score (price, space, location, condition, risk) with weights tuned for three personas: renters, first-time buyers, and upgraders. Listings scoring ≥ 4.0 are flagged as priority recommendations and rendered into a sortable, filterable HTML digest delivered via Nodemailer. A Claude Code interactive layer handles the in-session decisions: `affordability` for first-time buyer simulations, `upgrade plan` for sell-and-buy timing and funding-gap analysis, `compare 001, 003` for side-by-side comparisons, and `prepare visit for 001` for visit-day checklists and negotiation strategy. The pipeline owns the data funnel, the AI handles the trade-off judgments.',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js (ESM, .mjs)' },
      { category: 'Scraping', items: 'agent-browser (591) + Chrome DevTools Protocol (FB groups via Input.synthesizeScrollGesture)' },
      { category: 'LLM Extraction', items: 'Claude API (Haiku 4.5), free-form posts → structured fields' },
      { category: 'Email', items: 'Nodemailer + Gmail SMTP (HTML digest with sortable / filterable tables)' },
      { category: 'Scheduling', items: 'macOS launchd (daily run + dedicated Chrome KeepAlive instance)' },
      { category: 'Persistence', items: 'JSON cache, TSV scan history (automated), Markdown tracker (written interactively via Claude Code session)' },
      { category: 'Interactive Layer', items: 'Claude Code (Affordability, Upgrade Plan, Compare, Prepare Visit)' },
      { category: 'Sources', items: '591.com.tw (rental / purchase) + Facebook public rental groups' },
    ],
    impact: [
      'Multi-source ingestion: a synthesized-gesture CDP bypass for FB anti-bot lazy-load, combined with Claude API field extraction from free-form posts, collapses 591 and community supply into a single evaluation queue.',
      'Scheduled scanning: triggers the pipeline at 09:00 daily, with persistent caching for precise deduplication.',
      'Five-dimension scoring: a quantitative model with persona-tuned weights (e.g., 30/20/25/15/10 for rentals) that converts subjective impressions into data signals across renters, first-time buyers, and upgraders.',
      'Daily email digest: structured HTML reports delivered on schedule with 591 and FB listings as separate sections, including price-drop tracking, delisted rows, and district breakdowns, optimized for the morning decision window.',
      'Interactive Claude modes: in-session AI consultation covering first-time-buyer affordability, upgrade financing, and deep listing comparison, sharpening last-mile decision quality.',
    ],
    learnings: [
      'For personal automation, launchd is a more elegant choice than cron. It cleanly inherits the user environment, handles Keychain authentication, and respects system wake settings, which raises the operational ceiling of the pipeline considerably.',
      'On filtering logic, shifting from hard filters to multi-dimensional weighted scoring was the key breakthrough. Hard filters tend to kill borderline candidates over a single metric, while a weighted model lets listings trade off across dimensions and more accurately models human decision-making. As for the delivery medium, choosing email was grounded in behavioral science: during the high-frequency morning decision window, the reach of push delivery and its mobile readability far outperform pull-style interfaces like a dashboard, letting data assert itself wherever attention already is.',
      'Getting Facebook to paginate took experimenting through plain JS scroll, agent-browser scroll, keyboard PageDown, and CDP `Input.dispatchMouseEvent`, all of which were caught by anti-bot detection and the feed simply refused to advance. The only path that worked was CDP `Input.synthesizeScrollGesture`, which Facebook treats as a physical trackpad. On the extraction side, sending free-form posts to an LLM costs about USD 0.001 per post and stays robust against the long tail of Taiwanese rental shorthand ("月租押金兩個月含管理費可議") that a rule-based parser would lose to within weeks.',
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
  {
    id: 'job-ops',
    title: 'Job Ops — A Candidate-Side ATS for Personal Job Search',
    subtitle: '"Turn the weapon that was aimed at you, back to your own use." A personal Python pipeline built to break the information asymmetry of job hunting. It inverts the applicant tracking system (ATS) logic companies use to filter candidates: macOS launchd fires the daily run at 07:00, fresh 104 listings flow in, each one is scored precisely against your Markdown CV, and seven Claude Code interactive modes deliver deeper strategy from comp research to interview prep.',
    metaTitle: 'Job Ops — A Candidate-Side ATS for Personal Job Search | Charles Chen Personal Project',
    metaDescription: 'A personal Python pipeline that inverts the ATS logic companies use on candidates and points it at the jobs instead. Daily 07:00 run scores fresh 104 listings against my Markdown CV and personal weights, then emails a banded shortlist. Paired with seven Claude Code interactive modes covering legitimacy, level strategy, comp talk, and interview prep. A personal job-search OS by AI Product Manager Charles Chen.',
    problem: [
      'On the hiring market, companies wield powerful ATS: hundreds of candidates filtered, ranked, and trimmed every day, automatically. The candidate side has no counterpart, leaving job seekers stuck in a low-efficiency loop.',
      'Manual review hits a hard ceiling. Tracking 30 to 50 target listings at once, the brain cannot balance comp, location, team size, and remote policy as simultaneous variables; by the eighth listing fatigue sets in, and the typical exit is to accept whatever the platform\'s recommendation feed serves at the top.',
      'Filter knobs are too rigid. Existing platforms only express hard constraints like a salary floor or a region; they cannot capture a weighted preference such as "growth > comp > commute".',
      'There is no room for dynamic recalibration. Search filters cannot adjust their weighting between a wide-net early stage and a closing-on-an-offer late stage, leaving the candidate to play matching engine themselves at very low efficiency.',
    ],
    solution: [
      'Job Ops inverts the structured scoring process HR uses on candidates, so the job listings become the things being filtered.',
      'Automated scoring loop. macOS launchd fires the run every morning at 07:00. Listings come in from 104 and flow into a CV-aware evaluator: it reads your Markdown CV, matches it against a "candidate archetype" defined in YAML, and scores each role dimension by dimension.',
      'Two report formats. The digest lands before 07:30: HTML for the quick phone-Gmail read in the morning, and a Markdown twin synced to Obsidian for the end-of-month retrospective.',
      'Programmable values. The scoring weights (comp, remote, growth, etc.) live entirely in a YAML config. Switching job-search strategies takes one line of edits. More importantly, once that YAML is under git, every commit records how your priorities evolved over time, becoming the truest narrative trace of the search.',
      'Human-machine division of labour. The pipeline handles the rule-bound, high-volume work (scraping, dedupe, scoring, sending). The Claude Code interactive layer handles the judgment work that benefits from conversation: company legitimacy, level strategy (IC vs management), comp negotiation, and interview alignment.',
    ],
    techStack: [
      { category: 'Runtime', items: 'Python 3.11+ (asyncio)' },
      { category: 'Scraping', items: 'httpx (104 API integration, UA rotation, rate limiting)' },
      { category: 'CV Ingestion', items: 'cv_reader parses a Markdown CV into structured signals' },
      { category: 'Scoring Engine', items: 'Multi-dimensional weighted scoring, banded RECOMMEND / CAUTIOUS / SKIP' },
      { category: 'Config', items: 'YAML (search criteria and personal preference weights)' },
      { category: 'Notifications', items: 'Gmail SMTP (inline-styled HTML and Markdown twin export)' },
      { category: 'Scheduling', items: 'macOS launchd (com.job-ops.daily)' },
      { category: 'Persistence', items: 'TSV scan-history (job-listing lifecycle, price moves, repost detection)' },
      { category: 'Interactive Layer', items: 'Seven specialised Claude Code modes (interview-prep, comp-research, etc.)' },
      { category: 'Testing', items: 'pytest, pytest-asyncio' },
    ],
    impact: [
      'High-efficiency funnelling. 30 to 50 raw listings per day distilled into a three-tier digest that fits a breakfast read.',
      'Flexible strategy switching. A config edit alone moves the pipeline from "wide-net" mode to "precision closing" mode, with no logic-code change required.',
      'Deeper decision support. Seven AI interactive modes fill the blind spots: company legitimacy via community-source lookup, comp game theory between IC and management tracks, and more.',
      'Noise minimised. The TSV tracking surface renders listing updates as diff annotations on a single row, so a job reposted three times stays one line of clean signal instead of three rows of noise.',
    ],
    learnings: [
      'The engineering pieces are scaffolding. The decision that actually matters is who the rubric points at. This project\'s value sits in breaking the asymmetry of the hiring market: HR runs automation against candidates every day; I chose to flip that ruler around and run it against jobs instead. The payoff is twofold, real efficiency gains plus the recovery of agency over the filter.',
      'Separately, decoupling weights from logic paid off in ways I had not expected. Because YAML and git work together, each commit becomes a timestamp of a personal priority shift; my job-search history turns from a stack of broken daily reports into a single timeline I can replay.',
      'Finally, the "pipeline + interactive modes" two-layer architecture turned out to generalise unusually well. Deterministic work (scraping, ranking) goes to code; ambiguous judgment (strategy, negotiation) goes to AI conversation. The same pattern applies in my other automation projects (such as house-ops) just as cleanly.',
    ],
    links: [
      { label: 'GitHub (private repo)', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
