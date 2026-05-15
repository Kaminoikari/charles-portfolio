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
      '"Give AI a senior PM\'s brain and turn flashes of inspiration into shippable specs." An LLM-orchestrated AI agent: 22 professional product frameworks (JTBD, RICE, and more) replace generic boilerplate, native distribution across Claude.ai Custom Skill and the Claude Code ecosystem embeds it straight into the PM\'s existing workflow, and the output is a dev document with acceptance criteria for genuine dev handoff.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
  {
    id: 'house-ops',
    title: 'House Ops',
    description:
      '"In an ocean of property listings, let the good ones come to you." A personal Node.js + AI pipeline for real-estate decisions: it scans 591 and Facebook rental groups daily at 09:00, has Claude API extract structured data from messy posts, applies five-dimension weighted scoring to turn gut-feel into quantified signals, and integrates Claude Code as a deep advisory layer for everything from first-buyer affordability to upgrade planning.',
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
    subtitle: '"Give AI a senior PM\'s brain and turn flashes of inspiration into shippable specs." An LLM-orchestrated AI agent built to close the enormous gap between "idea" and "buildable task": framework-driven generation (22 professional product frameworks like JTBD and RICE replace vague generic prose), multi-channel distribution (native to Claude.ai Custom Skill and the Claude Code ecosystem, embedded directly into the PM\'s existing workflow), and automated technical handoff (output is a dev document with acceptance criteria, enabling genuine seamless Dev Handoff).',
    metaTitle: 'Product Playbook — AI Agent Spec Generator | LLM Product Case Study',
    metaDescription: 'AI agent product for Claude Code with 22 frameworks and automated dev handoff. An LLM product case study by AI Product Manager Charles Chen.',
    problem: [
      'In traditional product development, writing a high-quality spec/PRD runs into two structural challenges.',
      'High time cost: a passable PRD has to integrate user research, competitive analysis, and technical constraints. The work often spans days and becomes a bottleneck for the build.',
      'Limits of general-purpose AI: ChatGPT or Notion AI can produce prose but they "don\'t understand product." They can\'t automatically run a JTBD analysis or order a backlog by RICE; what they ship is generic boilerplate you can\'t act on.',
      'Communication gaps: when PMs skip documentation alignment to chase a deadline, the downstream development and rework costs scale up multiplicatively.',
    ],
    solution: [
      'Product Playbook is not just a chatbot, it is a disciplined spec-production pipeline.',
      'Framework-driven orchestration: the system turns 22 mature product frameworks (from Positioning in Discovery through PRD in Deliver) into structured prompts. This forces the AI to think the way a senior PM does, so the output carries real practitioner weight.',
      'Six flexible modes: Quick, Full, Revision, Build, and two more, tuned to different product stages. Whether it is a rapid feature experiment or a full new-product launch, there is a matching output depth.',
      'Heavy-duty data ingestion: a three-layer PDF parsing engine (plain text → semantic recognition → OCR fallback) lets you upload existing research so the AI reasons from real evidence rather than thin air.',
      'Automated change propagation: when an upstream decision changes, downstream documents update with it. More importantly, the system auto-generates CLAUDE.md and TASKS.md, translating product requirements straight into engineering tasks an engineer can act on.',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin/Skill' },
      { category: 'AI Engine', items: 'Claude (LLM Orchestration), Claude Vision (semantic document parsing)' },
      { category: 'Frameworks', items: '22 professional frameworks (JTBD, Positioning, PR-FAQ, RICE, OST, etc.)' },
      { category: 'Doc Processing', items: 'Playwright (PDF rendering), Pandoc (format conversion), pymupdf, Tesseract OCR' },
      { category: 'Tooling', items: 'Node.js, Bash, Markdown-based framework definitions' },
      { category: 'Localization', items: 'Six languages: Chinese (Traditional/Simplified), English, Japanese, Korean, Spanish' },
    ],
    impact: [
      'Maximum efficiency: spec writing compressed from days to minutes, with quality beating the baseline benchmark',
      '+69% quality lift: against the same model without the skill loaded, product thinking and logical rigor improve by 69%',
      'Seamless workflow integration: multi-channel distribution lets users invoke the tool inside their existing editor or terminal with no platform switching',
      'Open-source contribution: shipped under MIT license, used by PMs and engineers as a shared productivity tool',
    ],
    learnings: [
      '"In the AI era, product value lives at the framework layer, not at the generation layer." As an AI PM, I came to feel viscerally that LLM orchestration is fundamentally a product-design problem. The execution order of frameworks directly decides output quality, for example, defining Persona before running JTBD analysis lets the AI identify real user pain points far more precisely.',
      'A skill-based channel strategy also produced unusually high retention. The tool should not force users to adapt to a new platform, it should go and meet them in the surface they already work in.',
      'My core insight: anyone can call an API, but knowing how to "ask the right question" and "guide the thinking" is the actual intellectual property. The 22 frameworks are the soul of the system; the AI is merely the delivery mechanism that ships that wisdom fast.',
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
    subtitle: '"In an ocean of property listings, let the good ones come to you." A personal Node.js + AI pipeline for real-estate decisions, built to break the information fragmentation of the Taiwan housing market: multi-channel integration (auto-scans 591 and Facebook rental groups at 09:00 daily, collapsing scattered information into a single flow), AI semantic parsing (Claude API extracts structured data from chaotic community posts), a quantitative decision model (five-dimension weighted scoring turns gut-feel into scientific signals), and a deep advisory mode (Claude Code provides expert consultation, from first-buyer affordability to upgrade planning).',
    metaTitle: 'House Ops — Taiwan Housing Automation & AI Decision Pipeline | Charles Chen Personal Project',
    metaDescription: 'A Node.js automation pipeline that scans 591 and Facebook public rental groups daily, uses Claude API to extract structured fields from free-form posts, scores Taiwan listings on price, space, location, condition, and risk, and delivers an HTML email digest. A personal automation case study by AI Product Manager Charles Chen.',
    problem: [
      'For anyone hunting a rental or a home in Taiwan, the real pain is not "there is nothing to look at," it is "there is no way to look at it all."',
      'Extreme information fragmentation: listings are scattered across 591, Facebook private groups, and a long tail of forums. Users are forced to manually cross-reference MRT proximity, layout, and price across dozens of tabs.',
      'High-density noise: FB posts are free-form text that traditional tools cannot filter, paired with repeat postings, price drift, and broken formatting, driving search costs through the roof.',
      'Decision fatigue: the daily scan → evaluate → discard loop repeats, and the good listings are usually gone within the few hours a working professional has free.',
      'No contextual diagnosis: existing platforms only offer basic filters and cannot deliver synthesized advice on "district median rent, spatial ratios, tenancy risk."',
    ],
    solution: [
      'House Ops uses an automated pipeline and AI collaboration to turn property hunting from "manual scanning" into "automatic delivery."',
      'Breakthrough scraping: by synthesizing physical touch gestures through the Chrome DevTools Protocol (CDP), the pipeline gets past Facebook\'s anti-bot mechanism and lazy-load, securing access to the freshest community listings.',
      'LLM structuring engine: for the chaotic free-form text on FB, Claude API (Haiku 4.5) extracts price, address, size, layout, and other structured fields in real time, aligning data across every channel.',
      'Five-dimension heuristic scoring: the system quantifies price, space, location, condition, and risk. Users can dynamically swap weights between "renter / first-time buyer / upgrader" personas, turning vague impressions into concrete 0–5 signals.',
      'Push-style decision experience: every morning before 09:30, a visual HTML digest lands in Gmail right on time, with price-drop tracking, new-listing alerts, and district breakdowns, so decisions happen when attention is most focused.',
      'Human-AI collaborative decision layer: the pipeline handles the data funnel and dedupe; the Claude Code interactive layer takes the harder trade-offs, such as affordability simulation, the upgrade-plan funding gap, and the visit-day checklist.',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js (ESM)' },
      { category: 'Scraping', items: 'agent-browser (591) + CDP (Facebook synthesized-gesture scraping)' },
      { category: 'LLM Extraction', items: 'Claude API (Haiku 4.5) for free-form text parsing' },
      { category: 'Email', items: 'Nodemailer + Gmail SMTP delivering an interactive HTML digest' },
      { category: 'Scheduling', items: 'macOS launchd (scheduled launch + env inheritance)' },
      { category: 'Persistence', items: 'JSON cache and TSV scan history' },
      { category: 'Interactive Layer', items: 'Claude Code integration for deep financial and upgrade planning' },
    ],
    impact: [
      'Multi-channel convergence: breaks the wall between 591 and FB, unifying scattered information streams into one evaluation system',
      'Precise dedupe and tracking: persistent caching plus diff-based change detection auto-filters repeat posts and tracks price drift in real time',
      'From filtering to weighting: evolves rigid "hard-threshold filtering" into a "multi-dimensional weighted model" that more accurately mirrors human preference',
      'Maximum decision efficiency: push-style digest plus AI interaction compresses daily property hunting from "hours" to "minutes"',
    ],
    learnings: [
      '"In the world of automation, the delivery medium is the product itself." Why email rather than a dashboard? It comes from a behavioral-science insight: during the high-frequency morning decision window, push reach far outperforms pull. Data should appear actively wherever the user\'s attention already is.',
      'Trade-offs on the technical path: integrating FB took experimenting with many scroll-simulation approaches. In the end, only CDP\'s Input.synthesizeScrollGesture (synthesized touch gesture) was treated as physical interaction, which taught me that the closer to a physical-layer operation you get, the more effective you are against anti-bot mechanisms.',
      'The economics of LLM as a parser: using an LLM to extract structured fields looks expensive on paper but the per-post cost is tiny (around USD 0.001) and its stability is far higher than a rule-based parser. Against unpredictable Taiwanese phrasing like "月租押金含管費可議," the AI showed human-level comprehension. Most of all, the shift from hard filtering to a weighted model is the soul of this project, letting listings trade off across dimensions in a way that genuinely mirrors how humans decide.',
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
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
