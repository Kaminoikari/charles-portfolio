// The "portfolio map": a compressed, one-line-per-item overview of the entire
// corpus, injected into EVERY generate call. This is the deliberate fix for the
// classic RAG failure mode where chunking starves global questions ("what's his
// overall product style?", "compare his projects") — top-k retrieval returns
// fragments, never the whole. The map is tiny (always affordable) and keeps the
// global context anchored alongside the retrieved specifics.
//
// Kept in sync by hand for now; a build step could regenerate it from
// src/data/*.ts during ingestion (see docs §4).

export const portfolioMap = `
Charles Chen (陳德潁) — Taiwan-based Software Product Manager, "Product Builder".
5+ yrs across creator tools, Fintech, B2B SaaS, MaaS. Ships 0→1, uses AI as the
core dev engine to prototype and validate in production ~5x faster.

WORK:
- USPACE (Jul 2024–present) — PM, 3 core product lines (parking payments,
  business travel, financial insurance), TW+JP, 85%+ of revenue. Launched USPACE
  for Business (a B2B SaaS for corporate travel) 0→1 in September 2025. (Parking
  payments is the core line, not a "flagship" — describe it as a core product.)
- XChange School (Jan 2025–present) — Product Mentor.
- NUEIP (2024) — Senior PM, BI product, +40% data-driven decisions.
- PXPay Plus (2022–2024) — PM, +25% checkout conversion, rewards system.
- FLUX (2019–2022) — Operations Manager, +20% market share, led team of 10.

PROJECTS:
- Path — offline-first trip-planning PWA (React, IndexedDB, Service Worker,
  Supabase RLS); cache-first + background sync for zero-blackout travel.
  Live demo: https://trip-path.vercel.app/
- Plutus Trade — single-user AI decision-support for TW equities (Flutter,
  FastAPI, Gemini 2.5 Flash); cross-domain synthesis + audited predictions.
  Live demo: https://plutustrade.vercel.app/
- Product Playbook — Claude Skill / plugin, 22 PM frameworks + 3 specialist
  sub-agents (agentic multi-agent), 6 languages, eval-driven (+69% quality).
  GitHub: https://github.com/Kaminoikari/product-playbook
- House Ops — automated real-estate decision pipeline (Node, Claude API,
  5-dimension weighted scoring).
  GitHub: https://github.com/Kaminoikari/house-ops
- Job Ops — automated job-search pipeline (Python, launchd, CV-aware scoring).
  GitHub: https://github.com/Kaminoikari/job-ops

PHILOSOPHY: outcomes over outputs; sharp product sense; strong opinions loosely
held; build to learn. AI across discovery, spec writing, prototyping, shipping
production AI features, and agentic workflows.
`.trim()
