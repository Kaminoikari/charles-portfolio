export type ChangelogTag = 'feature' | 'design' | 'technical'

export interface ChangelogEntry {
  id: string
  date: string
  title: string
  body: string[]        // paragraphs of natural prose
  tags: ChangelogTag[]
}

export const changelog: ChangelogEntry[] = [
  {
    id: 'i18n-content-translation',
    date: '2026-04-28',
    title: 'Multilingual Content — Full Translation Pass',
    tags: ['feature'],
    body: [
      'Filled in every locale data file the i18n architecture left as English placeholder. The /zh-TW/ and /ja/ routes now read in their own language end-to-end: the About page (Who I Am narrative, Product Philosophy bullets, How I Use AI table, Skills table), the experience timeline, the three project case studies (Path, Plutus Trade, Product Playbook), the floating skill names in the universe section, and the full ~3,200-word changelog itself: shader work, animation refactors, scroll restoration, GEO/SEO strategy, the audio system, and so on.',
      'Each translation follows an explicit policy documented at the top of every locale file. Product names (Path, Plutus Trade, Product Playbook, USPACE), tech stack (React, Flutter, Supabase, FastAPI, etc.), framework names (JTBD, RICE, OKRs, AARRR), industry vocabulary (B2B SaaS, builder, Product Builder, MaaS), code identifiers, React/browser APIs (useRef, IntersectionObserver, localStorage, hreflang), file paths, CSS values, and English UI markers ([ ABOUT ], CASE STUDY, IMPACT, TECH STACK) all stay English in line with how Taiwan and Japan PMs actually write. Translating these would feel forced. Descriptive sentences, problem/solution paragraphs, bullet titles, and technical narrative are translated.',
      'For the blog section, articles published in Traditional Chinese keep their original titles and subtitles on /zh-TW/ since that matches the published copy. On /ja/, both titles and subtitles are translated to Japanese as descriptions of each article\'s topic, matching how Japanese tech blogs typically summarize foreign-language sources. The destination is still the original Chinese article on Substack/Medium.',
      'Tone-wise, Japanese uses です/ます register matching existing data files; Traditional Chinese follows Taiwan PM voice with natural English-Chinese mixed prose where that\'s how technical context actually gets written. The portfolio is now i18n-complete across all three locales: every page, every data file, no TODO markers left. Type-checks pass against the canonical English Strings interface, so any future drift between locales surfaces at build time.',
    ],
  },
  {
    id: 'hero-easter-egg-mobile-polish',
    date: '2026-04-27',
    title: 'Hero — Easter Egg Mobile Polish',
    tags: ['design', 'technical'],
    body: [
      'Fixed two issues that hurt the easter-egg portrait on mobile. First, the hero text, "click the logo 5 times" hint, and SCROLL indicator stayed at full opacity through the photo phase, overlapping the portrait once it converged on the smaller viewport. Each overlay now has its own ref, and a render-loop fade tied to the egg phase machine ramps them out from egg t=1.25s to t=1.55s (matching the shader\'s photoHide), holds them hidden through the portrait, and fades them back in over 0.15s as the reverse phase begins. The portrait now lands on a clean stage on every screen size.',
      'Second, the portrait sampler was edge-only: a 4-direction Laplacian on the source PNG kept just the silhouette, eyes, brow, and lip outlines. On mobile that read as a hollow wireframe with no interior face, because the cheek/forehead/neck regions were empty. Added a sparse interior fill: every fifth pixel inside the photo region also enters the particle pool at low weight (6) so it gets the dimmest particles after sort, while strong edges still claim the brightest ones. The face now reads as a filled portrait at small display sizes without losing the clean linework that defined the silhouette at desktop sizes.',
    ],
  },
  {
    id: 'i18n-architecture',
    date: '2026-04-27',
    title: 'Multilingual Site — English / 繁中 / 日本語 Architecture',
    tags: ['feature', 'technical'],
    body: [
      'Added i18n architecture so the portfolio can serve English (default at root), Traditional Chinese (under /zh-TW/*), and Japanese (under /ja/*). The English entry stays at the bare URL (no /en/ prefix) so existing inbound links and SEO continue to land where search engines expect. Locale-prefixed branches share the same route table so every page (home, About, project case studies, changelog) exists at the matching path under each locale. The router resolves the locale from the URL prefix; nothing is detected from browser language at first visit.',
      'Built without an i18n library. react-i18next and react-intl ship features this site does not need (ICU formatting, plural rules, namespace lazy loading) and would add ~50KB. Instead, a small custom layer: a typed strings dictionary per locale (the English file defines the canonical Strings interface; zh-TW and ja must structurally satisfy it, so missing translation keys surface at build time), a useT() hook that pulls a dotted-path string from the active dictionary with simple {{var}} interpolation, and a LocaleProvider that wraps each locale branch and keeps `<html lang>` synced with the active locale.',
      'Per-locale data architecture mirrors the same pattern: each content file (projects, changelog, experience, blog, skills) was split into .en.ts / .zh-TW.ts / .ja.ts variants. A locale-aware loader (src/data/index.ts) exposes useProjects(), useChangelog(), etc., returning the matching dataset for the active locale and falling back to English if a translation file is missing entries. Translation copies start as English with TODO markers so the site is shippable immediately and translators can fill in incrementally without further architectural work.',
      'SEO surface is now locale-aware. A useDocumentMeta() helper updates document.title, meta[name=description], the canonical link, and a full set of <link rel="alternate" hreflang> tags (en, zh-TW, ja, x-default) on every route. The hreflang URLs point at the matching path under each locale so Google, Baidu, and other crawlers can present the right version per audience. The static hreflang in index.html that previously pointed every locale at the same English root has been replaced.',
      'Persistence is opt-in only. There is no browser-language auto-detection on first visit. The unprefixed root always renders English. But once a user clicks the language switcher, the choice is written to localStorage so returning visitors land in their last-chosen locale (the unprefixed root one-time-redirects them to /zh-TW/ or /ja/). Switching back to English clears the redirect.',
      'Added a compact 3-button language switcher in the nav (desktop: pill group next to the CONTACT button; mobile: inside the hamburger menu, separated by a divider). Switching preserves the current sub-path (/about → /zh-TW/about → /ja/about) so users do not get bounced to the home page when changing language mid-browse.',
    ],
  },
  {
    id: 'hero-easter-egg-braam-sfx',
    date: '2026-04-27',
    title: 'Hero — Easter Egg Cinematic Braam SFX',
    tags: ['feature', 'design'],
    body: [
      'Paired the easter-egg sequence with a cinematic trailer-braam sound effect. The audio is offset on trigger so its iconic 50dB attack transient lands exactly at COLLAPSE_END (egg elapsed ~0.80s): the moment the singularity reaches maximum compression and the white flash ignites. The braam then swells through the flash and explode phases as the particles converge into the portrait, and the long decay tail rings through the photo-hold and reverse phases.',
      'Plumbed via a single delayed-play `setTimeout`: the audio sits idle until 0.49s after the egg trigger, then plays from t=0 so the silent pre-attack of the file fills the start of the collapse with tension before the impact lands. Reuses one Audio element across triggers, gates re-trigger on the existing eggStartRef guard, and pauses any in-flight playback on component unmount. Volume capped at 0.55 so the braam reads as dramatic punctuation without overwhelming the ambient soundtrack.',
    ],
  },
  {
    id: 'hero-easter-egg-cosmic-photo',
    date: '2026-04-27',
    title: 'Hero — Cosmic Photo Particles & Easter Egg Polish',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Reworked the easter-egg portrait phase so the particles forming the photo look like cosmic stardust (replacing the prior solid mantra beads). Each particle is now drawn as a pre-rendered radial-gradient sprite (universal warm-white core, tinted halo from a 5-bucket brightness gradient) and composited with additive blending, so neighbouring halos overlap into a continuous luminescent fabric. Stacking as discrete dots is what the old approach did. Roughly a third of the particles also draw a short tangent streak, hinting they only just escaped the orbital ring on their way to the portrait.',
      'Tuned the photo palette to the shader\'s lens-halo spectrum: brightness 0 maps to flame red-orange (warm gas filaments), brightness 1 maps to cream-white (lens crescent core), with a 12% cyan accent matching the cool gas opposite the warm side. The portrait\'s natural chiaroscuro now reads as a temperature gradient (bright pixels look like hot lensed light, dark pixels like cooling accretion debris), and the cosmic backdrop and the portrait visibly share the same colour DNA.',
      'Added a real shader-side gravitational collapse during the easter egg. The shader now applies a radial zoom + tightening vortex driven by `u_eggCollapse`, so the lens visibly implodes during the collapse phase (the prior version just darkened), and a smaller secondary collapse plays during the reverse phase as the particles disperse back to the orbital ring. A `u_photoHide` uniform fades the entire shader to zero across the photo phase (ramps up during the last 0.35s of explode so no lens flashes behind the converging portrait, holds at zero through the portrait, ramps back down for the reverse collapse).',
      'Reverted the reverse phase to a clean linear dispersal: particles fly straight back to their orbital ring with `easeOutQuart`, no rotation. The earlier CW spiral version read as the photo "rotating" as it dissolved, which felt unnatural; the gravitational atmosphere now lives entirely in the shader\'s secondary collapse, and the particles just disperse and reform.',
      'Performance work to keep the 3000-particle ring at 60 fps: the canvas DPR is now capped at 1.5 (roughly halves pixel work on Retina displays without a perceptible quality loss), idle-orbit trail stroke styles are hoisted outside the per-frame loop (saved several thousand redundant state changes per frame), and the trail-rendering threshold was raised so dim/slow outer-corner particles skip the stroke entirely. Photo-phase shadowBlur was traded for pre-rendered glow sprites, which is roughly 3-4× cheaper and produces a cleaner halo. Also removed the mousemove-driven text-repulsion effect that was wobbling the hero copy.',
    ],
  },
  {
    id: 'hero-black-hole-shader-orbital-particles',
    date: '2026-04-27',
    title: 'Hero — Black Hole Shader & Orbital Particle System',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Added a WebGL fragment shader behind the hero particles that renders a black-hole-style accretion disk: a bright lensing crescent at the centre with soft gas filaments flowing around it. The shader sits underneath the existing particle ring on its own canvas, so the hero now reads as a layered composition: a glowing event horizon in the foreground, animated gas behind it, and orbiting particles on top. The previous version was a single flat particle field.',
      'Replaced the previous wave-modulated, fixed-angle particle model with a Kepler-like orbital system inspired by msurguy\'s blackhole reference. Every particle now genuinely rotates around the centre with a radius-dependent angular velocity (inner orbits fast, outer corners drift slowly), which reads as differential rotation. The prior look was a static decorative ring. Particle count went from 800 in a narrow band to 3000 spread across the full viewport diagonal, so the corners of widescreen displays no longer look empty.',
      'Click and tap interactions now use a spring-damper physics model: a hit pushes nearby particles outward with an initial radial velocity, then gravity pulls them back through their base orbit and an under-damped oscillation lets them swing past and settle naturally. The previous behavior was a hard linear repel-and-snap. The shader itself no longer responds to clicks; only the particle ring does. Keeping the gas backdrop neutral made the click feedback feel like a physical perturbation of the orbit, with no global "screen shakes" reaction.',
      'The Konami easter egg was rebuilt as a synchronized big-bang sequence between the shader and the particle ring. All particles collapse toward a singularity, a flash bursts at the centre, a shockwave ripples outward, particles explode out into Charles\'s photo, hold for a moment, then dissolve back into the ring as the shader fades from black-out into normal gas. Both components listen to a shared `easter-egg` window event so their phase boundaries (collapse 0.8s → flash 1.0s → explode 1.6s → photo 3.5s → reverse 5.0s) stay locked together.',
      'Several smaller fixes along the way: the shader\'s denominator singularities (centre bright spot, diagonal slice through the lens) were replaced with epsilon-stabilised forms; gas rotation uses an exponentially-saturating drift (replacing linear winding) so the noise pattern doesn\'t accumulate long sweep arcs over time; the hero text gained a layered black text-shadow and slightly higher opacity on the supporting copy so it stays readable when the bright lens crescent passes through it.',
    ],
  },
  {
    id: 'hero-mobile-vertical-centering',
    date: '2026-04-21',
    title: 'Hero Section — Mobile Vertical Centering Fix',
    tags: ['technical', 'design'],
    body: [
      'The hero text on mobile was sitting visibly below the vertical center of the visible viewport. The root cause was 100vh: on mobile browsers this unit represents the viewport with the URL bar collapsed (a larger area than what the user actually sees). So the section was taller than what the visitor could see, and "center of 100vh" landed roughly 40-50px below the visual center. The SCROLL ↓ indicator at the bottom was also hidden behind the URL bar for the same reason.',
      'Switched the hero section to use 100dvh (dynamic viewport height) via a supports-[] variant, so modern browsers size the section to the actually-visible area and fall back to 100vh on older browsers where dvh isn\'t recognized. The canvas already resized off the section\'s clientHeight, so the particle animation center follows the layout automatically. No additional changes needed there.',
    ],
  },
  {
    id: 'ambient-audio-default-muted',
    date: '2026-04-19',
    title: 'Ambient Audio — Start Muted by Default',
    tags: ['design'],
    body: [
      'Flipped how the ambient soundtrack starts. The first version defaulted to unmuted and tried to sneak past browser autoplay blocks by waiting for the first click or scroll to sneak the fade-in through. It was clever but dishonest: the speaker icon in the corner showed "sound on" the entire time, while the browser was silently blocking playback. Visitors had no idea the delay was intentional, and anyone who never clicked or scrolled saw a lying icon forever.',
      'Now the icon starts in the muted state, which matches what the browser is actually doing, and music only begins when the visitor explicitly clicks the speaker. The click itself counts as the user gesture that unlocks autoplay, so a single action both grants the permission and starts the fade-in. No separate "enable audio" step, no icon that disagrees with reality.',
      'Also tightened the localStorage semantics. The button still remembers the visitor\'s last choice either way, but the default state (if nothing is stored, or if a stored value is somehow corrupted) is muted. Returning visitors who actively unmuted last visit will hear the music again; everyone else gets silence until they ask for it. Treats sound as opt-in, which is the right default for a portfolio.',
    ],
  },
  {
    id: 'ambient-space-audio',
    date: '2026-04-18',
    title: 'Ambient Space Audio — Interstellar-Inspired Soundscape',
    tags: ['feature', 'design'],
    body: [
      'Added a cinematic ambient soundtrack that plays quietly in the background while visitors explore the site. The reference was Hans Zimmer\'s Interstellar score: slow-moving pads and sub bass without any rhythmic element, so it sits under the experience without demanding attention. Licensed a CC0 "Calm Space Music" track from Pixabay.',
      'Browser autoplay policies block any audio with sound from starting without user interaction. Chrome and Safari have been strict about this for years, and for good reason. Rather than fighting that, the player waits for the first pointer/keyboard/scroll/touch event, then fades volume from 0 to 0.35 over 1.8 seconds. The transition is slow enough that the audio feels like it was always there.',
      'A small glassmorphic mute button sits fixed in the bottom-right corner. Clicking it fades the audio out over 0.6 seconds before pausing, and persists the preference to localStorage so muted visitors stay muted on return. The button itself uses a 44×44 hit area for mobile reachability, with the accent-cyan color on hover to match the site\'s existing focus ring treatment.',
      'The audio element lives once in main.tsx above the router so playback continues uninterrupted when navigating between /, /about, /changelog, and /projects/:id, with no re-initialization and no gaps between routes.',
    ],
  },
  {
    id: 'product-page-refresh-2026-04',
    date: '2026-04-18',
    title: 'Product Pages — Tech Stack Refresh',
    tags: ['technical'],
    body: [
      'The three project case study pages were showing stale tech stack tables. Since the products themselves have continued evolving after launch, the portfolio needed to catch up.',
      'Path now credits its PWA / Service Worker layer in the frontend stack: offline-first is a user-facing promise and should show up in the tech stack that backs it. Plutus Trade\'s data sources were expanded from "FinMind API, Redis" to include Yahoo Finance API for global quotes alongside the Taiwan-specific FinMind feed. The product actually covers both markets but the page didn\'t reflect that.',
      'Product Playbook got the biggest rewrite, pulled directly from the current GitHub README. The distribution channel was listed as "npm, GitHub" but has since expanded to three delivery surfaces (Claude.ai Custom Skill, Claude Code Plugin, and Claude Code Skill), each meeting users inside a different part of their workflow. The document processing pipeline (Playwright for Chromium PDF rendering, Pandoc for format conversion, pymupdf for text extraction, Tesseract OCR as the fallback layer, pikepdf for bookmarks, Claude Vision for semantic parsing) was missing entirely. Added 6-language internationalization, the MIT license, and the +69% quality improvement benchmark to the Impact section.',
      'Also renamed the 6 execution modes with their actual production names (Quick, Full, Revision, Custom, Build, Feature Expansion). The page previously carried a vague "from lightweight to comprehensive" description.',
    ],
  },
  {
    id: 'footer-portaly-link',
    date: '2026-04-17',
    title: 'Footer — Portaly Link Added',
    tags: ['feature'],
    body: [
      'Added Portaly (portaly.cc/charleschen) as a fourth social link in the Contact Footer, alongside LinkedIn, GitHub, and Threads. Portaly is the primary link-in-bio hub, so surfacing it from the portfolio consolidates the cross-platform presence.',
      'The icon uses the official Portaly brand mark (apple-touch-icon), processed locally to strip the white background and crop tight to the logo edges so it renders cleanly at the 20×20 size used by the other social icons.',
    ],
  },
  {
    id: 'scroll-restoration-fix',
    date: '2026-04-15',
    title: 'Scroll Restoration — Fixing the Refresh Problem',
    tags: ['technical'],
    body: [
      'Refreshing the page at any scroll position always jumped to the wrong section, sometimes the About section, sometimes the top. The root cause was lazy loading every homepage section with React.lazy() wrapped in Suspense boundaries.',
      'Browser scroll restoration works by saving the scroll position and restoring it after the page renders. But with Suspense, the page first renders a compact fallback (a single h-screen div), then expands to its real height when all sections load. By the time the real content appears, the browser has already attempted restoration against the wrong page height, and the position gets clamped to 0.',
      'The fix was straightforward: remove lazy() from all homepage sections and import them directly. These sections are always visible as the user scrolls, so lazy loading them provided no real benefit but broke scroll restoration. Route-level pages (About, Changelog, Case Studies) remain lazy-loaded since visitors may never navigate to them.',
      'The bundle increased from 233KB to 313KB (gzip 75KB → 102KB), but eliminated 7 separate chunk requests. Net effect on real-world load time is negligible. One larger request is often faster than many small ones due to HTTP round-trip overhead.',
    ],
  },
  {
    id: 'responsive-layout-fixes',
    date: '2026-04-14',
    title: 'Responsive Layout — Hero & About Alignment',
    tags: ['design', 'technical'],
    body: [
      'Two layout consistency issues fixed. The Hero section text container was max-w-[900px] while About used max-w-[1400px], so the left edge of content jumped between sections. Unified Hero to the same max-w-[1400px] px-6 md:px-12 container, with the h1 itself capped at max-w-[900px] to maintain comfortable line length.',
      'The About section switched to horizontal layout at md (768px), but the photo with side annotations needed ~728px of space. On tablet screens (768-1024px), the text column was crushed to near-zero width. Pushed the horizontal breakpoint from md to lg (1024px), and added responsive photo sizing: 350×480 at lg, expanding to the full 440×600 at xl.',
    ],
  },
  {
    id: 'blog-xai-redesign',
    date: '2026-04-13',
    title: 'Blog Section — xAI-Style Article List',
    tags: ['feature', 'design'],
    body: [
      'The blog section previously showed just two platform buttons (Medium, Substack), with no article titles, no descriptions, no value to visitors or search engines. Redesigned it as a full article list inspired by xAI\'s news page layout.',
      'Each article now displays as a row with date, title, subtitle, platform tag, cover image, and a READ button. The cover images use background-size: cover in a 16:10 aspect container. Articles without covers show a dimmed platform logo as fallback. The featured article (Uber L4 Offer) gets a mars-colored badge next to the date.',
      'Subtitles were initially generic one-line summaries. Replaced them with the real Substack subtitles, which are much more compelling. For example, the CS153 article went from "探討 AI 發展的真正限制與突破方向" to "這堂被戲稱為「AI Coachella」的課，可能是目前全世界最搶手的一堂課。"',
      'Sorting puts featured articles first, then the rest in reverse chronological order. 13 articles total: 7 from Substack with cover images, 6 from Medium.',
    ],
  },
  {
    id: 'case-study-pages',
    date: '2026-04-12',
    title: 'Case Study Pages — SEO Topic Cluster',
    tags: ['feature', 'technical'],
    body: [
      'Added dedicated case study pages at /projects/path, /projects/plutus-trade, and /projects/product-playbook. Each page has structured sections (Problem, Solution, Tech Stack, Impact, and Learnings) with proper meta titles, descriptions, and dynamic canonical URLs.',
      'The project cards on the home page now link to these case study pages (the prior destinations were external URLs). This creates an internal topic cluster for SEO: the home page links to case studies, case studies link back, and each page targets different long-tail keywords.',
      'Also added a dedicated /about page with full career history, product philosophy (outcomes over outputs, strong opinions loosely held, strong product sense, build to learn), AI workflow breakdown, skill set, and a Chinese bio section with lang="zh-TW" for Taiwan search traffic.',
      'All new pages use dynamic canonical URLs and structured meta tags. Fixed an issue where Google Search Console flagged subpages as "Alternate page with proper canonical tag", since they were all sharing the hardcoded root canonical.',
    ],
  },
  {
    id: 'geo-seo-optimization',
    date: '2026-04-11',
    title: 'GEO & SEO — Making the Portfolio Discoverable by AI',
    tags: ['feature', 'technical'],
    body: [
      'The portfolio looked great to humans but was invisible to search engines and AI systems. As a React SPA, the entire page rendered client-side. Crawlers that don\'t execute JavaScript saw an empty <div id="root"></div> and nothing else. No structured data, no meta strategy, no sitemap.',
      'The first layer was mechanical: added JSON-LD structured data (Person, FAQPage, ItemList schemas), Open Graph tags, Twitter Cards, canonical URL, author metadata, and freshness signals (published/modified dates). Created robots.txt explicitly allowing all 14 major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.), a sitemap.xml, and an experimental llms.txt for direct AI consumption.',
      'The second layer solved the SPA visibility problem. Added a complete HTML fallback inside a <noscript> tag: crawlers that don\'t run JS get full semantic content with proper H1/H2/H3 hierarchy, achievement lists, skill tables, project descriptions, and FAQ sections. React replaces the visible DOM on mount, so users never see the fallback. Initially put the fallback inside #root, which caused a flash of unstyled HTML before React hydrated. Moving it to <noscript> fixed that.',
      'The third layer was keyword strategy. A GEO audit showed the content was structured as a "who I am" brand page; the target structure for search is "what problems I solve". "AI Product Manager" has significantly higher search volume than "AI Product Builder", but appeared only 4 times vs 19. Rebalanced to 15 mentions of "AI Product Manager" across title, JSON-LD, noscript headings, and FAQ content. Added geographic signal "Taiwan" to key positions. The title shifted from name-first ("Charles Chen — AI Product Builder") to keyword-first ("AI Product Manager | Charles Chen Portfolio").',
      'Also added X-Robots-Tag headers in vercel.json, internal linking from noscript fallback to /changelog, and a new FAQ targeting long-tail keywords: "how to become an AI product builder", "AI product manager portfolio example", "generative AI product case study", and "difference between AI PM and AI Product Builder".',
    ],
  },
  {
    id: 'playbook-animation-fixes',
    date: '2026-04-09',
    title: 'Product Playbook — Connection Line Fixes',
    tags: ['design', 'technical'],
    body: [
      'The orange bezier lines connecting framework badges (JTBD, Persona, RICE, PRD) to SPEC.md sections had three issues. First, they were nearly invisible on the dark background. The effective opacity was only ~18% from stacked alpha values (globalAlpha 0.3 \u00d7 marsA(0.6)). Raised the values to 0.55 and 0.9 respectively, bringing effective visibility to ~50%.',
      'Second, each line was animating twice per cycle. The root cause was a "peek-ahead" branch in the lineProgress calculation that pre-drew the next line before its section started. When the section index advanced, sectionLocalProgress reset to zero, causing the line to jump from fully drawn back to empty and animate all over again. Removed the peek-ahead branch so each line animates exactly once.',
      'Third, the Dev Handoff section (the last one) never showed a completion checkmark. The isComplete condition was si < activeSectionIndex, but the last section index equals the maximum activeSectionIndex, so 3 < 3 was always false. Added a progress >= 1 check to handle the final section.',
    ],
  },
  {
    id: 'changelog-page',
    date: '2026-04-09',
    title: 'Changelog — Building in Public',
    tags: ['feature', 'design'],
    body: [
      'Added a dedicated /changelog page to document the design decisions, technical iterations, and thinking behind every part of this portfolio. Inspired by Linear\'s changelog: clean single-column layout with generous spacing and natural prose (the format that bullet-point changelogs replace).',
      'This required introducing React Router to what was previously a single-page scroll app. The home page works exactly as before. All sections scroll vertically with the same nav behavior. The changelog lives at its own URL with proper SPA fallback for Vercel deployment.',
      'The Nav component became route-aware: on the home page, section buttons scroll as before. On the changelog page, they navigate back to /#section with automatic scroll-to after the page loads. The changelog entry point lives in the footer: a subtle link alongside the technical metadata, for visitors who want to dig deeper.',
      'Each entry is written as natural prose. The goal is to share the why behind decisions: why the About section went through five background animation iterations, why Fibonacci distribution solved the Universe sphere, why the card animations needed a full state machine lifecycle. Release-note style is what this format replaces.',
    ],
  },
  {
    id: 'animation-module-extraction',
    date: '2026-04-09',
    title: 'Animation Architecture Refactor',
    tags: ['technical'],
    body: [
      'The three card animation systems had grown to 1,240 lines in a single file. Each animation (Path\'s S-curve route, Plutus Trade\'s K-line ticker, and Product Playbook\'s spec assembly) was a self-contained system with its own constants, state machine, and draw functions. They just happened to live in the same file.',
      'Extracted each into dedicated modules: pathAnimation.ts, plutusAnimation.ts, playbookAnimation.ts, with a shared.ts for common utilities. ProjectCards.tsx dropped from 1,240 to 593 lines.',
      'Also centralized all hardcoded rgba() strings into two helper functions (whiteA() and marsA()), making 56 replacements across the codebase. If the accent color ever changes, it\'s a single constant update; no need to hunt through draw functions.',
      'The badge metrics computation for the Playbook animation was previously a module-level mutable cache. Moved it into a useRef scoped to the component, with no more shared mutable state.',
    ],
  },
  {
    id: 'product-playbook-card',
    date: '2026-04-08',
    title: 'Product Playbook — Spec Assembly Animation',
    tags: ['feature', 'design'],
    body: [
      'Added the third side project card for Product Playbook, an AI-powered product planning skill for Claude Code. The animation needed to visualize the core concept: frameworks go in, a complete spec comes out.',
      'The design shows four framework badges on the left (JTBD, Persona, RICE, PRD) connected by curved bezier lines to a document on the right. As each section fills in (Overview, User Stories, Architecture, Dev Handoff), the corresponding framework badge lights up with an accent-mars pulse.',
      'Inside the document, content lines fill progressively with a typing cursor blinking at ~0.6Hz. Completed sections get a checkmark. A progress bar at the bottom uses easeInOutCubic for a polished feel; the prior linear growth read as mechanical.',
      'The entrance choreography was important for first impression: badges stagger in with a fade + slide-up (120ms apart), then the document outline fades in. This gives the animation a "reveal" moment that the other two cards didn\'t initially have.',
      'Went through multiple audit cycles to refine: reduced frameworks from 6 to 4 for cleaner 1:1 section mapping, switched the connection lines from flat horizontals to curves, smoothed partial curve endpoints with fractional interpolation.',
    ],
  },
  {
    id: 'mobile-card-autoplay',
    date: '2026-04-08',
    title: 'Mobile Auto-Play for Card Animations',
    tags: ['feature', 'technical'],
    body: [
      'The canvas card animations were triggered by onMouseEnter and onMouseLeave, which never fire on touch devices. On mobile, the illustrations were permanently frozen in their static state.',
      'The fix detects touch devices with matchMedia("(hover: none)") and uses an IntersectionObserver with threshold 0.3 as an alternative trigger. When a card scrolls into view on mobile, the animation plays automatically. When it scrolls out, it stops.',
      'Desktop behavior is unchanged: animations still trigger on hover.',
    ],
  },
  {
    id: 'canvas-card-animations',
    date: '2026-04-07',
    title: 'Interactive Canvas Animations for Project Cards',
    tags: ['feature', 'design'],
    body: [
      'The project cards originally had static SVG illustrations, generic and lifeless. Replaced all three with interactive Canvas 2D animations that each tell the story of their project.',
      'Path\'s animation traces an S-curve bezier route with a glowing comet trail. As the light point passes each waypoint, arrival ripples expand and the corresponding itinerary card (Day 1, Day 2, Day 3) lights up with progressive checkmark animations. The whole cycle runs: travel → pause at endpoint → fade out → reset.',
      'Plutus Trade shows a live K-line ticker. Bull candles glow in accent-mars, bear candles in white. New candles scroll in from the right, with periodic surge events creating dramatic tall candles. The trade day has its own lifecycle: 8 seconds of trading → closing deceleration → fade out → fresh day.',
      'The card UI itself was inspired by xAI: sharp borders with corner square decorations, gradient overlay on hover, and a subtle scale transform. Each animation only runs on hover (desktop) or viewport visibility (mobile), with the static state always showing a dim preview of the full illustration.',
    ],
  },
  {
    id: 'nav-footer-cleanup',
    date: '2026-04-07',
    title: 'Navigation & Footer Polish',
    tags: ['design'],
    body: [
      'Two small but important layout fixes. The mobile hamburger menu was positioned before the CONTACT button. Moved it to the rightmost position where users expect it.',
      'The About section had a "Let\'s Connect" link that duplicated the nav bar\'s CONTACT button. Removed it. One clear call-to-action is better than two competing ones.',
    ],
  },
  {
    id: 'about-hero-photo',
    date: '2026-03-28',
    title: 'About Section — Photo with Achievement Annotations',
    tags: ['design'],
    body: [
      'Redesigned the About section to feature a large profile photo with achievement annotations flanking it on desktop. The photo uses a CSS radial gradient mask for a natural edge fade into the dark background, much cleaner than attempting programmatic background removal.',
      'Desktop layout places the photo center with "6M+ Users Impacted" on the left and "85% Revenue Impact" plus "5x Faster with AI" on the right. Mobile stacks the photo above a compact metrics row.',
      'The copy was refined from a generic introduction to "What I bring to the table.": direct and confident, letting the metrics speak alongside it.',
    ],
  },
  {
    id: 'universe-section-evolution',
    date: '2026-03-25',
    title: 'Universe Section — The 3D Sphere Journey',
    tags: ['feature', 'design', 'technical'],
    body: [
      'The skills section went through more iterations than any other part of the site. It started as a basic canvas with scattered lines and evolved into a full 3D sphere visualization.',
      'The distribution of lines on the sphere was the hardest problem. Random placement looked uneven. Tried grid-based approaches that looked artificial. Eventually landed on a Fibonacci sphere algorithm (the same math sunflowers use to arrange seeds), which produces perfectly uniform distribution.',
      'Rendering order matters for 3D: particles closer to the viewer need to draw on top of farther ones. Implemented z-sorted rendering with a pre-allocated sort array to avoid garbage collection pressure on every frame.',
      'The scroll-driven text spread was inspired by xAI\'s visual language: skill labels positioned around the sphere that move outward as the user scrolls, creating a sense of expansion and exploration. Labels auto-cycle through categories to show the full skill set without overwhelming the initial view.',
      'Fine-tuned the sphere proportions, line density, particle brightness, and center-dense distribution across dozens of commits to match the xAI aesthetic.',
    ],
  },
  {
    id: 'particle-hero-rings',
    date: '2026-03-22',
    title: 'ParticleHero — Ring Particle System',
    tags: ['feature', 'design'],
    body: [
      'The hero section started with a Perlin noise flow field: particles drifting in organic streams. It looked fine but generic. Replaced it with an Antigravity-style ring particle algorithm where particles orbit in concentric rings with gentle pulsation.',
      'Clicking anywhere on the hero creates a ripple effect that propagates outward through the particles. The ring center stays fixed at screen center (the click position does not move it), which keeps the composition stable while still feeling responsive.',
      'Tuned the parameters extensively: slowed pulsation from 0.008 to 0.003 for subtlety, reduced density from 80×25 to 40×15 particles to avoid overwhelming the hero text.',
      'There\'s an easter egg hidden here: clicking the logo rapidly 5 times triggers the particles to rearrange into a profile photo silhouette using edge detection. The face scales with viewport size so it reads clearly on both desktop and mobile.',
    ],
  },
  {
    id: 'about-neural-network',
    date: '2026-03-20',
    title: 'About Section — Background Animation Evolution',
    tags: ['design', 'technical'],
    body: [
      'The About section background went through rapid iteration. Started with connected particles, tried hexagonal nodes (too busy), evolved into a "quantum neural network" concept, and finally settled on simple glowing dots connected by pulsing lines.',
      'The final implementation uses 80 regular nodes and 10 hub nodes. Hubs are larger, brighter, and slower-moving, acting as visual anchors in the network. The blue-purple color palette (#6BA3D6, #4E8FD4, #8B9FD6) was chosen to complement the warm accent-mars without competing with it.',
      'Performance was a concern with 80 nodes potentially needing O(n²) distance checks for connections. Implemented a spatial grid that reduces this to O(n): each node only checks its neighboring grid cells. The grid containers are reused across frames to avoid garbage collection pressure.',
      'The entire animation pauses via IntersectionObserver when the section scrolls off-screen. No point burning CPU cycles for something nobody can see.',
    ],
  },
  {
    id: 'space-grotesk-typography',
    date: '2026-03-18',
    title: 'Space Grotesk — Typography Foundation',
    tags: ['design'],
    body: [
      'Switched from system fonts to Space Grotesk as the primary typeface. The geometric yet warm character of Space Grotesk matches the xAI-inspired visual language: technical but approachable.',
      'Paired with SF Mono for monospace accents in section labels, tags, and technical UI elements. The section headers were unified to a consistent [ SECTION ] format with tracking-[2px], a small detail that ties the whole site together.',
    ],
  },
  {
    id: 'initial-launch',
    date: '2026-03-15',
    title: 'Portfolio Launch',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Initial launch of charles-chen.com. Built with React 19, Vite, Tailwind 4, and Canvas 2D for animations. The dark theme (#0A0A0A background with warm accent-mars #E8652B) was established as the foundation.',
      'Design tokens for colors, borders, and typography live in Tailwind\'s @theme directive: a single source of truth. Every section is lazy-loaded with React.lazy() and code-split automatically by Vite.',
      'Accessibility was baked in from the start: skip-to-content link, focus-visible outlines, prefers-reduced-motion support that disables all animations, and ARIA labels on every interactive element. The View Transitions API provides smooth crossfades when navigating between sections.',
    ],
  },
]
