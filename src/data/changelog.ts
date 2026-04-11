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
    id: 'geo-seo-optimization',
    date: '2026-04-11',
    title: 'GEO & SEO — Making the Portfolio Discoverable by AI',
    tags: ['feature', 'technical'],
    body: [
      'The portfolio looked great to humans but was invisible to search engines and AI systems. As a React SPA, the entire page rendered client-side — crawlers that don\'t execute JavaScript saw an empty <div id="root"></div> and nothing else. No structured data, no meta strategy, no sitemap.',
      'The first layer was mechanical: added JSON-LD structured data (Person, FAQPage, ItemList schemas), Open Graph tags, Twitter Cards, canonical URL, author metadata, and freshness signals (published/modified dates). Created robots.txt explicitly allowing all 14 major AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.), a sitemap.xml, and an experimental llms.txt for direct AI consumption.',
      'The second layer solved the SPA visibility problem. Added a complete HTML fallback inside a <noscript> tag — crawlers that don\'t run JS get full semantic content with proper H1/H2/H3 hierarchy, achievement lists, skill tables, project descriptions, and FAQ sections. React replaces the visible DOM on mount, so users never see the fallback. Initially put the fallback inside #root, which caused a flash of unstyled HTML before React hydrated — moving it to <noscript> fixed that.',
      'The third layer was keyword strategy. A GEO audit showed the content was structured as "who I am" (brand page) rather than "what problems I solve" (search page). "AI Product Manager" has significantly higher search volume than "AI Product Builder", but appeared only 4 times vs 19. Rebalanced to 15 mentions of "AI Product Manager" across title, JSON-LD, noscript headings, and FAQ content. Added geographic signal "Taiwan" to key positions. The title shifted from name-first (Charles Chen — AI Product Builder) to keyword-first (AI Product Manager | Charles Chen Portfolio).',
      'Also added X-Robots-Tag headers in vercel.json, internal linking from noscript fallback to /changelog, and a new FAQ targeting long-tail keywords: "how to become an AI product builder", "AI product manager portfolio example", "generative AI product case study", and "difference between AI PM and AI Product Builder".',
    ],
  },
  {
    id: 'playbook-animation-fixes',
    date: '2026-04-09',
    title: 'Product Playbook — Connection Line Fixes',
    tags: ['design', 'technical'],
    body: [
      'The orange bezier lines connecting framework badges (JTBD, Persona, RICE, PRD) to SPEC.md sections had three issues. First, they were nearly invisible on the dark background — the effective opacity was only ~18% from stacked alpha values (globalAlpha 0.3 \u00d7 marsA(0.6)). Raised the values to 0.55 and 0.9 respectively, bringing effective visibility to ~50%.',
      'Second, each line was animating twice per cycle. The root cause was a "peek-ahead" branch in the lineProgress calculation that pre-drew the next line before its section started. When the section index advanced, sectionLocalProgress reset to zero, causing the line to jump from fully drawn back to empty and animate all over again. Removed the peek-ahead branch so each line animates exactly once.',
      'Third, the Dev Handoff section (the last one) never showed a completion checkmark. The isComplete condition was si < activeSectionIndex, but the last section index equals the maximum activeSectionIndex — so 3 < 3 was always false. Added a progress >= 1 check to handle the final section.',
    ],
  },
  {
    id: 'changelog-page',
    date: '2026-04-09',
    title: 'Changelog — Building in Public',
    tags: ['feature', 'design'],
    body: [
      'Added a dedicated /changelog page to document the design decisions, technical iterations, and thinking behind every part of this portfolio. Inspired by Linear\'s changelog — clean single-column layout with generous spacing and natural prose, not bullet-point changelogs.',
      'This required introducing React Router to what was previously a single-page scroll app. The home page works exactly as before — all sections scroll vertically with the same nav behavior. The changelog lives at its own URL with proper SPA fallback for Vercel deployment.',
      'The Nav component became route-aware: on the home page, section buttons scroll as before. On the changelog page, they navigate back to /#section with automatic scroll-to after the page loads. The changelog entry point lives in the footer — a subtle link alongside the technical metadata, for visitors who want to dig deeper.',
      'Each entry is written as natural prose rather than release notes. The goal is to share the why behind decisions — why the About section went through five background animation iterations, why Fibonacci distribution solved the Universe sphere, why the card animations needed a full state machine lifecycle.',
    ],
  },
  {
    id: 'animation-module-extraction',
    date: '2026-04-09',
    title: 'Animation Architecture Refactor',
    tags: ['technical'],
    body: [
      'The three card animation systems had grown to 1,240 lines in a single file. Each animation — Path\'s S-curve route, Plutus Trade\'s K-line ticker, and Product Playbook\'s spec assembly — was a self-contained system with its own constants, state machine, and draw functions. They just happened to live in the same file.',
      'Extracted each into dedicated modules: pathAnimation.ts, plutusAnimation.ts, playbookAnimation.ts, with a shared.ts for common utilities. ProjectCards.tsx dropped from 1,240 to 593 lines.',
      'Also centralized all hardcoded rgba() strings into two helper functions — whiteA() and marsA() — making 56 replacements across the codebase. If the accent color ever changes, it\'s a single constant update instead of hunting through draw functions.',
      'The badge metrics computation for the Playbook animation was previously a module-level mutable cache. Moved it into a useRef scoped to the component — no more shared mutable state.',
    ],
  },
  {
    id: 'product-playbook-card',
    date: '2026-04-08',
    title: 'Product Playbook — Spec Assembly Animation',
    tags: ['feature', 'design'],
    body: [
      'Added the third side project card for Product Playbook, an AI-powered product planning skill for Claude Code. The animation needed to visualize the core concept: frameworks go in, a complete spec comes out.',
      'The design shows four framework badges on the left (JTBD, Persona, RICE, PRD) connected by curved bezier lines to a document on the right. As each section fills in — Overview, User Stories, Architecture, Dev Handoff — the corresponding framework badge lights up with an accent-mars pulse.',
      'Inside the document, content lines fill progressively with a typing cursor blinking at ~0.6Hz. Completed sections get a checkmark. A progress bar at the bottom uses easeInOutCubic for a polished feel rather than linear growth.',
      'The entrance choreography was important for first impression — badges stagger in with a fade + slide-up (120ms apart), then the document outline fades in. This gives the animation a "reveal" moment that the other two cards didn\'t initially have.',
      'Went through multiple audit cycles to refine: reduced frameworks from 6 to 4 for cleaner 1:1 section mapping, curved the connection lines instead of flat horizontals, smoothed partial curve endpoints with fractional interpolation.',
    ],
  },
  {
    id: 'mobile-card-autoplay',
    date: '2026-04-08',
    title: 'Mobile Auto-Play for Card Animations',
    tags: ['feature', 'technical'],
    body: [
      'The canvas card animations were triggered by onMouseEnter and onMouseLeave — which never fire on touch devices. On mobile, the illustrations were permanently frozen in their static state.',
      'The fix detects touch devices with matchMedia("(hover: none)") and uses an IntersectionObserver with threshold 0.3 as an alternative trigger. When a card scrolls into view on mobile, the animation plays automatically. When it scrolls out, it stops.',
      'Desktop behavior is unchanged — animations still trigger on hover.',
    ],
  },
  {
    id: 'canvas-card-animations',
    date: '2026-04-07',
    title: 'Interactive Canvas Animations for Project Cards',
    tags: ['feature', 'design'],
    body: [
      'The project cards originally had static SVG illustrations — generic and lifeless. Replaced all three with interactive Canvas 2D animations that each tell the story of their project.',
      'Path\'s animation traces an S-curve bezier route with a glowing comet trail. As the light point passes each waypoint, arrival ripples expand and the corresponding itinerary card (Day 1, Day 2, Day 3) lights up with progressive checkmark animations. The whole cycle runs: travel → pause at endpoint → fade out → reset.',
      'Plutus Trade shows a live K-line ticker. Bull candles glow in accent-mars, bear candles in white. New candles scroll in from the right, with periodic surge events creating dramatic tall candles. The trade day has its own lifecycle: 8 seconds of trading → closing deceleration → fade out → fresh day.',
      'The card UI itself was inspired by xAI — sharp borders with corner square decorations, gradient overlay on hover, and a subtle scale transform. Each animation only runs on hover (desktop) or viewport visibility (mobile), with the static state always showing a dim preview of the full illustration.',
    ],
  },
  {
    id: 'nav-footer-cleanup',
    date: '2026-04-07',
    title: 'Navigation & Footer Polish',
    tags: ['design'],
    body: [
      'Two small but important layout fixes. The mobile hamburger menu was positioned before the CONTACT button — moved it to the rightmost position where users expect it.',
      'The About section had a "Let\'s Connect" link that duplicated the nav bar\'s CONTACT button. Removed it. One clear call-to-action is better than two competing ones.',
    ],
  },
  {
    id: 'about-hero-photo',
    date: '2026-03-28',
    title: 'About Section — Photo with Achievement Annotations',
    tags: ['design'],
    body: [
      'Redesigned the About section to feature a large profile photo with achievement annotations flanking it on desktop. The photo uses a CSS radial gradient mask for a natural edge fade into the dark background — much cleaner than attempting programmatic background removal.',
      'Desktop layout places the photo center with "6M+ Users Impacted" on the left and "85% Revenue Impact" plus "5x Faster with AI" on the right. Mobile stacks the photo above a compact metrics row.',
      'The copy was refined from a generic introduction to "What I bring to the table." — direct and confident, letting the metrics speak alongside it.',
    ],
  },
  {
    id: 'universe-section-evolution',
    date: '2026-03-25',
    title: 'Universe Section — The 3D Sphere Journey',
    tags: ['feature', 'design', 'technical'],
    body: [
      'The skills section went through more iterations than any other part of the site. It started as a basic canvas with scattered lines and evolved into a full 3D sphere visualization.',
      'The distribution of lines on the sphere was the hardest problem. Random placement looked uneven. Tried grid-based approaches that looked artificial. Eventually landed on a Fibonacci sphere algorithm — the same math sunflowers use to arrange seeds — which produces perfectly uniform distribution.',
      'Rendering order matters for 3D: particles closer to the viewer need to draw on top of farther ones. Implemented z-sorted rendering with a pre-allocated sort array to avoid garbage collection pressure on every frame.',
      'The scroll-driven text spread was inspired by xAI\'s visual language — skill labels positioned around the sphere that move outward as the user scrolls, creating a sense of expansion and exploration. Labels auto-cycle through categories to show the full skill set without overwhelming the initial view.',
      'Fine-tuned the sphere proportions, line density, particle brightness, and center-dense distribution across dozens of commits to match the xAI aesthetic.',
    ],
  },
  {
    id: 'particle-hero-rings',
    date: '2026-03-22',
    title: 'ParticleHero — Ring Particle System',
    tags: ['feature', 'design'],
    body: [
      'The hero section started with a Perlin noise flow field — particles drifting in organic streams. It looked fine but generic. Replaced it with an Antigravity-style ring particle algorithm where particles orbit in concentric rings with gentle pulsation.',
      'Clicking anywhere on the hero creates a ripple effect that propagates outward through the particles. The ring center stays fixed at screen center rather than following the click — this keeps the composition stable while still feeling responsive.',
      'Tuned the parameters extensively: slowed pulsation from 0.008 to 0.003 for subtlety, reduced density from 80×25 to 40×15 particles to avoid overwhelming the hero text.',
      'There\'s an easter egg hidden here — clicking the logo rapidly 5 times triggers the particles to rearrange into a profile photo silhouette using edge detection. The face scales with viewport size so it reads clearly on both desktop and mobile.',
    ],
  },
  {
    id: 'about-neural-network',
    date: '2026-03-20',
    title: 'About Section — Background Animation Evolution',
    tags: ['design', 'technical'],
    body: [
      'The About section background went through rapid iteration. Started with connected particles, tried hexagonal nodes (too busy), evolved into a "quantum neural network" concept, and finally settled on simple glowing dots connected by pulsing lines.',
      'The final implementation uses 80 regular nodes and 10 hub nodes. Hubs are larger, brighter, and slower-moving — they act as visual anchors in the network. The blue-purple color palette (#6BA3D6, #4E8FD4, #8B9FD6) was chosen to complement the warm accent-mars without competing with it.',
      'Performance was a concern with 80 nodes potentially needing O(n²) distance checks for connections. Implemented a spatial grid that reduces this to O(n) — each node only checks its neighboring grid cells. The grid containers are reused across frames to avoid garbage collection pressure.',
      'The entire animation pauses via IntersectionObserver when the section scrolls off-screen. No point burning CPU cycles for something nobody can see.',
    ],
  },
  {
    id: 'space-grotesk-typography',
    date: '2026-03-18',
    title: 'Space Grotesk — Typography Foundation',
    tags: ['design'],
    body: [
      'Switched from system fonts to Space Grotesk as the primary typeface. The geometric yet warm character of Space Grotesk matches the xAI-inspired visual language — technical but approachable.',
      'Paired with SF Mono for monospace accents in section labels, tags, and technical UI elements. The section headers were unified to a consistent [ SECTION ] format with tracking-[2px] — a small detail that ties the whole site together.',
    ],
  },
  {
    id: 'initial-launch',
    date: '2026-03-15',
    title: 'Portfolio Launch',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Initial launch of charles-chen.com. Built with React 19, Vite, Tailwind 4, and Canvas 2D for animations. The dark theme (#0A0A0A background with warm accent-mars #E8652B) was established as the foundation.',
      'Design tokens for colors, borders, and typography live in Tailwind\'s @theme directive — a single source of truth. Every section is lazy-loaded with React.lazy() and code-split automatically by Vite.',
      'Accessibility was baked in from the start: skip-to-content link, focus-visible outlines, prefers-reduced-motion support that disables all animations, and ARIA labels on every interactive element. The View Transitions API provides smooth crossfades when navigating between sections.',
    ],
  },
]
