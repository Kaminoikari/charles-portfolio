# charles-chen.com

Personal portfolio site for Charles Chen — AI Product Manager from Taiwan who builds software products end-to-end with AI tools. Showcases case studies, an AI-built tech stack, a build-in-public changelog, and a retrieval-augmented AI chatbot, all through interactive Canvas animations.

**Live:** [charles-chen.com](https://charles-chen.com)

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite** — build tooling with code-splitting via `React.lazy()`
- **Tailwind CSS 4** — styling with `@theme` design tokens
- **Canvas 2D** — interactive animations for hero, skills sphere, project cards
- **React Router** — SPA routing (`/`, `/changelog`)
- **Vercel Analytics** — web analytics
- **Vercel** — hosting with SPA fallback + serverless function (`/api/chat` SSE streaming)

### AI Chatbot (Corrective RAG)

- **LangGraph.js** — agentic state machine: triage → retrieve → grade → generate, with a rewrite loop and an honest fallback
- **Qdrant Cloud** — hybrid retrieval: dense (Voyage `voyage-3-large`) + server-side BM25 sparse, fused with RRF
- **Voyage AI** — multilingual embeddings + `rerank-2.5` reranking
- **Gemini 2.5 Flash → Claude** — two-tier generation (free model first, paid fallback)
- **Semantic FAQ cache** — common questions return pre-written answers at zero generation-LLM cost
- **Guardrails** — three-layer prompt-injection defense (input detection, scope-locked prompt, output filtering)

## Sections

| Section | Description |
|---------|-------------|
| **ParticleHero** | Ring-based particle system with click ripple effects |
| **About** | Profile photo with achievement annotations, neural network background animation |
| **Universe** | 3D Fibonacci sphere with scroll-driven skill labels |
| **Experience** | Timeline with staggered reveal animations |
| **Project Cards** | Canvas-animated cards for all five projects — Path (route tracer), Plutus Trade (K-line ticker), Product Playbook (spec assembly), House Ops, Job Ops |
| **Blog** | Platform links to external posts |
| **Contact** | Social links with gradient footer |
| **Changelog** | Linear-inspired changelog with tag filtering (`/changelog`) |
| **AI Chatbot** | Floating widget ("Ask this portfolio") with streaming answers, markdown rendering, and multilingual (en / zh-TW / ja) support |

## Features

- Scroll-triggered animations via `IntersectionObserver`
- Mobile auto-play for canvas animations (`hover: none` detection)
- `prefers-reduced-motion` support — all animations disabled
- View Transitions API for smooth navigation
- Easter egg: rapid-click logo for particle photo reveal

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build
npm run preview   # preview production build
```

### RAG pipeline

```bash
npm run rag:ingest   # build the Qdrant vector index from portfolio content
npm run rag:faq      # build the semantic FAQ cache
npm run rag:eval     # run retrieval/answer evals
npm run rag:test     # run the RAG unit tests
```

The vector index is built via a manual GitHub Action (`rag-ingest.yml`, `workflow_dispatch`) since the runtime container has no outbound network. Requires `QDRANT_URL`, `QDRANT_API_KEY`, `VOYAGE_API_KEY`, `GEMINI_API_KEY`, and `ANTHROPIC_API_KEY`.

## Project Structure

```
src/
├── components/          # React components
│   ├── animations/      # Canvas modules (path, plutus, playbook, houseOps, jobOps)
│   └── chat/            # AI chatbot widget, streaming hook, markdown renderer
├── data/                # Static data (projects, experience, skills, changelog)
├── App.tsx              # Home page layout
├── main.tsx             # Router + analytics entry point
└── index.css            # Tailwind + design tokens

rag/                     # Corrective RAG pipeline (LangGraph.js)
├── graph.ts             # State machine: triage → retrieve → grade → generate
├── nodes.ts             # Graph node implementations
├── triage.ts            # Deterministic triage + injection/privacy detection
├── faq-cache.ts         # Semantic FAQ cache (pre-written answers)
├── guardrails.ts        # Input sanitization + output filtering
├── retrieval.ts         # Qdrant hybrid retrieval + reranking
├── ingest/              # Index + FAQ-cache build scripts
└── evals/               # Retrieval/answer evaluation harness

api/
└── chat.ts              # Vercel serverless SSE streaming endpoint
```

## Deployment

Deployed on Vercel. SPA fallback is configured in `vercel.json` (scoped so it doesn't swallow `/api/*`), and the chatbot runs as a serverless function at `/api/chat` with SSE streaming (`maxDuration: 60`).
