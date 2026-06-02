# Portfolio RAG Chatbot — Design Doc

**Goal:** a public chatbot on the portfolio site that answers any question about
Charles Chen, grounded *only* in the portfolio corpus. The deliverable being
showcased is the **retrieval engineering** — a corrective, agentic RAG pipeline
built on mainstream tooling (LangGraph + LangChain) with measured quality
(LangSmith eval) — not the Q&A feature itself.

> **Framing for interviews (important):** the corpus is small enough that
> context-stuffing would "work". We deliberately build a real Agentic RAG
> pipeline because the *artifact is the pipeline*. The honest answer to "why not
> just stuff the context?" is: "this project exists to demonstrate
> production-grade retrieval engineering and its evaluation, not to answer
> questions." That turns over-engineering into deliberate design.

---

**Stack decision:** TypeScript end-to-end (LangGraph.js + LangChain.js). One
language, one repo, one platform — the whole thing collapses onto **Vercel**
(the chat endpoint is a Node serverless function), no separate Python service to
operate. Aligns with the existing Vite + React + TS app.

---

> **Status — shipped (doc updated 2026-06-02).** Live in production behind the
> "問這個作品集 / Chat with AI" widget. This file began as the design plan; the
> sections below are now reconciled with what actually shipped. Biggest deltas
> from the original plan:
> - A **`triage`** node runs first — deterministic regex + a **semantic FAQ
>   cache** — so most common questions are answered for **$0** (no generation LLM).
> - Generation is **two-tier Gemini 2.5 Flash → Claude** (plan said Haiku/Sonnet);
>   grade & rewrite run on Gemini's free tier only.
> - `grade_documents` returns a **three-way verdict** (answerable /
>   on_topic_no_data / off_topic), not a binary relevant/weak.
> - **Prompt-injection defense is 3 layers** (input regex, generate scope-lock,
>   output slur filter), not just input stripping.
> - Rate limiting is **in-memory** per instance (Upstash noted as the upgrade,
>   not wired); **no API prompt caching** (rationale in `rag/llm.ts`, §11).
> - The index is built by a **GitHub Action** (`workflow_dispatch`) — the runtime
>   container has no outbound network. Real index: **309 doc chunks + 755 FAQ
>   paraphrases across 52 topics**, all in en/zh-TW/ja.

## 1. Architecture

```
                         BUILD TIME  (rag/ingest/)  — run locally / CI
  src/data/*.{en,zh-TW,ja}.ts ─┐
  product-playbook README      ├─► extract ─► semantic split ─► voyage-3 embed ─► Qdrant (hybrid)
  entities/relations.json      ┘   (parent/child)  (dense)  +  BM25 sparse (Cloud Inference)

                         QUERY TIME  (api/chat.ts — Vercel Node fn + LangGraph.js)
  question
     │
     ▼
  ┌────────────────────────────  LangGraph StateGraph  ───────────────────────────┐
  │  [triage] ── regex (injection / privacy) + semantic FAQ-cache lookup           │
  │       ├─ injection / privacy / FAQ hit ──────────────────► answered ($0) ─► END│
  │       └─ pass ► [retrieve] ── Qdrant hybrid (dense+sparse, server RRF) + rerank │
  │                      │                                                          │
  │                 [grade_documents] ── LLM 3-way verdict  (CRAG)                  │
  │                      ├─ answerable ─────────────────► [generate] ─► answer      │
  │                      ├─ on_topic_no_data ─► [rewrite_query] ─► retrieve (≤ N)   │
  │                      └─ off_topic ──────────────────► [fallback] (honest)       │
  └────────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
  generate: Gemini 2.5 Flash → Claude fallback (SSE streaming)
     ─► answer + retrieved sources + scores  → React widget
```

### Deployment
- **`api/chat.ts`** — Vercel Node serverless function. Imports the compiled
  LangGraph.js graph and streams the answer back over SSE. Same platform as the
  site; no extra service to run.
- **Frontend widget** — React component in the existing Vite app, calls
  `POST /api/chat` (SSE streaming) on the same origin (no CORS).
- **Qdrant Cloud** (free tier) — purpose-built vector DB holding a named dense
  vector (Voyage) + named sparse vector (BM25). Hybrid fusion (RRF) runs
  server-side in the Query API; the BM25 model runs on Qdrant Cloud Inference
  (the free sparse model), so no sparse encoder ships in the serverless bundle.
  A second collection (`chat_logs`) holds append-only analytics.
- **Embeddings + rerank** — Voyage AI (voyage-3-large / rerank-2.5) over its
  HTTP API. US provider, SOTA retrieval, 1024-dim. The client is swappable via
  `config.ts`.

*Alternative on file:* a persistent Fly.io service (like the Plutus Trade
backend) if cold starts or long-running eval jobs become a problem. Chosen
against initially for single-platform simplicity; ingestion + eval scripts run
locally / in CI where warm runtime isn't needed.

---

## 2. Component choices (and why)

| Layer | Choice | Why for this corpus | Showcase point |
|---|---|---|---|
| Orchestration | **LangGraph** `StateGraph` | corrective loop needs state + branching, not a linear chain | "agentic / corrective RAG, not naive single-shot" |
| Retrieval primitives | **Qdrant** `@qdrant/js-client-rest` Query API, LangChain `Document` | hybrid (dense+sparse prefetch + RRF) in one server-side request | "I drive a purpose-built vector DB the way teams do" |
| Embedding | **voyage-3-large** (Voyage AI, US) | SOTA multilingual retrieval (EN/zh-TW/ja); asymmetric `document`/`query` encoding; 1024-dim dense vector | US provider, top-tier quality, no data-residency concern |
| Vector store | **Qdrant Cloud** (HNSW, free tier) | named dense + sparse vectors; server-side hybrid fusion; payload filtering by locale | dedicated vector DB, learned-sparse hybrid |
| Sparse | **BM25** (true BM25, server-side IDF) via **Qdrant Cloud Inference** | language-agnostic lexical recall (beats Postgres `ts_rank`); free model, runs on Qdrant not in our serverless fn; no 128-token truncation | real BM25 hybrid, server-side |
| Rerank | **rerank-2.5** (Voyage AI, US) | small corpus makes rerank lift measurable | cross-encoder reranking |
| Fusion | **RRF** server-side in Qdrant's Query API | robust, no tuning, one round-trip | hybrid fusion without hand-rolling |
| Global-question guard | top-k **+ injected "portfolio map"** (one-line summary of every project/role) | chunking starves "what's his overall style?" questions | knows RAG failure modes |
| Graph relations | hand-written `entities/relations.json`, injected — **no Neo4j** | the entity graph is ~dozens of edges | **knowing when *not* to use GraphRAG** |
| Generation | **Two-tier: Gemini 2.5 Flash (free) → Claude (paid fallback)** | grade/rewrite ride Gemini's free tier; the user-facing answer tries Gemini, falls back to Claude on any failure | real-world cost tiering: free-first, paid as backstop |
| Observability / eval | **LangSmith** | tracing + datasets + ablation | the scarce skill: *measuring* RAG, not just building it |

---

## 3. LangGraph state & nodes

State is a LangGraph.js `Annotation.Root` schema (channels + reducers). The
`queries` channel uses an append reducer so each rewrite is preserved for the
LangSmith trace; everything else is last-write-wins.

```typescript
import { Annotation } from "@langchain/langgraph";
import type { Document } from "@langchain/core/documents";

export const RAGState = Annotation.Root({
  question: Annotation<string>,
  language: Annotation<string>,                 // detected: en | zh-TW | ja
  queries: Annotation<string[]>({               // original + every rewrite
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  documents: Annotation<Document[]>,            // current candidate set
  graded: Annotation<Document[]>,               // relevance-filtered
  loops: Annotation<number>({ default: () => 0, reducer: (_, b) => b }),
  answer: Annotation<string>,
  sources: Annotation<Array<{ id: string; title: string; score: number; locale: string }>>,
  route: Annotation<string>,                    // generate | rewrite | fallback
});
```

| Node | Does | LLM? |
|---|---|---|
| `triage` | regex (injection / personal-privacy) + **semantic FAQ-cache** probe; on a hit sets `route="answered"` and short-circuits to END | no LLM (embed-only for the cache probe) |
| `retrieve` | hybrid (dense+sparse) → RRF → rerank top-k | embed + rerank API |
| `grade_documents` | grades the set with a **3-way verdict**; sets `route` | yes (Gemini, structured output, 4s timeout, degrades to `generate` on error) |
| `rewrite_query` | reformulate using what's missing; `loops += 1` | yes (Gemini) |
| `generate` | answer grounded in `graded` + portfolio map; **scope-locked**; output slur-filtered | yes (Gemini → Claude fallback) |
| `fallback` | honest "the portfolio doesn't cover that" | no |

**Edges:** `START → triage`; conditional: `route=="answered" → END` (injection /
privacy / FAQ, answered for $0), else `→ retrieve → grade_documents`; conditional
from `grade_documents`: `answerable → generate`,
`on_topic_no_data and loops<MAX → rewrite_query → retrieve`,
`off_topic (or loops exhausted) → fallback`; `generate → END`, `fallback → END`.

> Demo trick: ask something the corpus lacks → watch it grade `off_topic` and
> *honestly decline* immediately (no wasted rewrite loop). Refusing well is more
> impressive than answering.

---

## 4. Ingestion & chunking

- **Sources:** `src/data/*.ts` (projects, about, experience, skills, changelog,
  blog) parsed per-locale; product-playbook `README.md`; `entities/relations.json`.
- **Chunking:** the data is already semantically bounded (one project / one role
  / one philosophy bullet). Use those boundaries as **parent** docs; split long
  case-study prose into **child** chunks (`RecursiveCharacterTextSplitter`,
  ~500 tok / 80 overlap) that point back to the parent for context expansion.
- **Metadata per chunk:** `{id, source_type, project_id, locale, parent_id, title}`.
- **Locale policy:** embed all three locales; filter by detected query language
  at retrieve time, fall back to EN. Mirrors the existing site i18n model.

---

## 5. Qdrant collections

No SQL — collections are created in code by `ensureCollections()` (`rag/qdrant.ts`),
called at the top of every ingest run (idempotent).

```
doc_chunks                              # the hybrid index — 309 chunks (en/zh-TW/ja)
  vectors:        { dense: { size: 1024, distance: Cosine } }   # voyage-3-large
  sparse_vectors: { sparse: { modifier: idf } }                 # BM25 (Cloud Inference)
  payload index:  locale (keyword)                              # filtered on every query
  payload:        { chunk_id, parent_id, source_type, project_id, locale, title, content }
  point id:       UUIDv5(chunk_id)      # Qdrant needs uint/UUID; original kept in payload

faq_cache                               # semantic cache — 755 paraphrases / 52 topics
  vectors:        { dense: { size: 1024, distance: Cosine } }   # voyage-3-large (query-encoded)
  payload index:  locale (keyword)
  payload:        { topic_id, locale, question, answer }        # answer is pre-written, returned verbatim
  matched at:     cosine ≥ 0.7 (RAG_FAQ_THRESHOLD), locale-filtered → 0 generation LLM

chat_logs                               # free product insight: what recruiters ask
  vectors:        { dense: { size: 1, distance: Cosine } }      # size-1 dummy [1] — never searched, only scrolled
  payload:        { ts, question, language, route, loops, latency_ms, sources }
```

Hybrid retrieval = one Query-API request: a dense prefetch (Voyage vector) + a
sparse prefetch (raw text → BM25 via Cloud Inference), fused by **RRF
server-side**, then a Voyage cross-encoder rerank in the function. The ablation
(`retrieveWith`) toggles each arm to measure its marginal lift.

> `chat_logs` uses the dummy vector `[1]`, not `[0]`: a zero vector has an
> undefined cosine and Qdrant rejects the upsert. The write is fire-and-forget
> (`.catch()`), so a logging failure never breaks a reply.

---

## 6. Guardrails (public endpoint — also showcase points)

1. **Faithfulness lock** — the `generate` prompt answers only from retrieved
   context + the portfolio map; never invents roles/credentials; unknown ⇒
   decline. Backed by a LangSmith faithfulness eval.
2. **Prompt-injection defense — 3 layers:** (a) input regex in `triage`
   (ignore-instructions, dev-mode, roleplay/multi-persona, decode/compute —
   base64·hex·binary, run-code, repeat-N-times, etc.) → instant refusal;
   (b) a **scope-lock** system prompt in `generate` that treats all input +
   context as *data*, never instructions, and refuses code/decoding/puzzles/
   roleplay/fill-in-the-blank; (c) an **output filter** (`isOffensiveOutput`)
   that drops any answer containing slurs. Layer (b) is the real backstop.
3. **Personal / privacy redirect** — family / private-life questions are
   redirected to contact channels (education is kept deliberately private).
4. **Rate limiting** — in-memory sliding window per serverless instance
   (`RateLimiter`, unit-tested). Best-effort; Upstash Redis is the noted
   production upgrade for cross-instance limits (not wired).
5. **Cost control** — three tiers before any paid token (deterministic triage →
   semantic FAQ cache $0 → Gemini free → Claude paid). **No API prompt caching**
   — deliberate; see §11.
6. **Logging** — every Q → `chat_logs` for retrieval analytics
   (`npm run rag:insights`).

---

## 7. LangSmith evaluation (the differentiator) — IMPLEMENTED (`rag/evals/`)

Reuse the product-playbook eval culture (ablation + lift numbers) on RAG:

- **Golden set** (`rag/evals/golden.ts`): single-fact / local / global /
  out-of-corpus questions, each in all three locales, grounded in the real
  corpus so expected ids and answer facts are verifiable.
- **Metrics** (`rag/evals/metrics.ts`, unit-tested): `recall@k` + `MRR`
  (deterministic id matching), `correctness` (golden mustInclude/mustDecline),
  `faithfulness` (LLM judge in `rag/evals/judge.ts`).
- **Ablation arms** (`rag/evals/run-eval.ts`): dense-only → +sparse (hybrid +
  RRF) → +reranker → +corrective-loop. Per-layer Δ-recall column, same "+X%"
  story as the playbook's tables. `retrieveWith(query, locale, cfg)` makes the
  layers toggleable from one code path.
- **Output:** prints a markdown table; `--out` writes it to a committed file.
  LangSmith tracing turns on via `LANGCHAIN_TRACING_V2` + `LANGCHAIN_API_KEY`
  (the SDK auto-instruments every run — no code change).
- **Run:** `npm run rag:eval` (needs secrets + a built index);
  `npm run rag:test` runs the metric unit tests with no secrets. See
  `rag/evals/README.md`.

---

## 8. Frontend (existing Vite app)

- Floating chat widget; **SSE streaming** answers.
- **Retrieval transparency UI:** expandable "Sources" showing each retrieved
  chunk, its score, and fused rank — makes the engineering *visible*
  (CLAUDE.md principle #1: show, don't tell).
- Suggested starter questions ("What did he do at USPACE?", "他整體的產品風格是什麼?").

---

## 9. Build phases

0. ✅ Ingestion + chunking + voyage-3 embed → Qdrant (`rag/ingest/`).
1. ✅ Hybrid (+sparse +RRF +reranker) + LangSmith ablation harness (`rag/evals/`).
2. ✅ LangGraph corrective graph + language detection + `answer()` entry,
   stub-tested (`rag/graph.ts`, `rag/nodes.ts`, `rag/language.ts`).
3. ✅ `api/chat.ts` Vercel Node SSE + guardrails + logging.
4. ✅ React widget + retrieval-transparency UI + suggested questions.
5. ✅ relations.json entity-graph injection (`rag/entities/`) + chat-logs
   insights (`rag/insights/report.ts`, `npm run rag:insights`).
6. ✅ Post-launch hardening (shipped): semantic FAQ cache (`rag/faq-cache.ts`,
   `rag/triage.ts`, `rag/ingest/build-faq-cache.ts`), 3-way grade verdict,
   3-layer injection defense, two-tier Gemini→Claude generation with per-call
   timeouts + `maxRetries=0`, and `workflow_dispatch` ingestion
   (`.github/workflows/rag-ingest.yml`).

---

## 10. Required secrets

`GEMINI_API_KEY` (free-tier generation + grade/rewrite), `ANTHROPIC_API_KEY`
(paid generation fallback), `VOYAGE_API_KEY` (embeddings + rerank), `QDRANT_URL`
+ `QDRANT_API_KEY` (vector store; Cloud Inference must be enabled for the BM25
sparse model). Optional: `LANGSMITH_API_KEY` (tracing / eval). No Upstash key —
rate limiting is in-memory.

The index is **not** built in the runtime container (it has no outbound
network); it's built by the **`rag-ingest` GitHub Action** (`workflow_dispatch`,
`.github/workflows/rag-ingest.yml`), which runs `npm run rag:ingest` then
`npm run rag:faq` against the secrets above. Preview and Production share the
same Qdrant index, so a re-index is not needed per deploy.

---

## 11. Cost control & semantic FAQ cache (as shipped)

The headline post-launch feature. Goal: answer common questions at **zero
generation-LLM cost** and decline off-topic ones fast, with no misfire risk.

- **Semantic FAQ cache** (`rag/faq-cache.ts`): 52 hand-written topics spanning 5
  personas (general visitor, PM/HR interviewer, tech enthusiast, red-teamer,
  founder/investor), expanded to **755 paraphrases** across en/zh-TW/ja. Each
  question is embedded once at build time (`npm run rag:faq`) into the
  `faq_cache` collection. At query time `triage` embeds the question, runs a
  locale-filtered nearest-neighbour lookup, and on **cosine ≥ 0.7** returns the
  pre-written answer verbatim — no retrieval, no generation LLM, no streaming
  cost. Cache misses fall through to the full RAG pipeline.
- **Three-tier cost ladder:** (1) deterministic regex triage (injection /
  privacy) → canned reply; (2) semantic FAQ cache → pre-written reply ($0);
  (3) full RAG, where grade/rewrite ride Gemini's free tier and only a hard
  synthesis question Gemini can't serve falls back to paid Claude.
- **Three-way grade verdict** lets an off-topic question route straight to
  `fallback` with no rewrite loop, so declining is both cheap and fast.
- **No API prompt caching** (`rag/llm.ts`, deliberate): traffic is low and
  bursty (hits usually > 5 min apart, past the cache TTL), most requests never
  reach Claude at all, and the system prefix is below the cache minimum — so
  `cache_control` would mostly incur the 1.25× write premium with ~0 reads.
- **Two-tier generation** (`generateWithFallback`): Gemini 2.5 Flash first
  (8s timeout) → Claude on any error (15s timeout); `maxRetries=0` so a provider
  429 fails over immediately instead of stacking LangChain's default six retries
  (which had caused intermittent 504s).

---

## Directory layout (as built — TypeScript)

```
api/
└── chat.ts                   # Vercel Node serverless fn: rate-limit → SSE → log
rag/
├── graph.ts                  # LangGraph StateGraph spine + answer()/streamAnswer()
├── state.ts                  # Annotation.Root state schema
├── nodes.ts                  # triage / retrieve / grade / rewrite / generate / fallback
├── triage.ts                 # regex injection+privacy detection, canned replies, contact block
├── faq-cache.ts              # 52 topics / 755 paraphrases (en/zh-TW/ja) + answers
├── retrieval.ts              # Qdrant hybrid (dense+sparse, server RRF) + rerank (retrieveWith)
├── qdrant.ts                 # Qdrant client + collection bootstrap + faqLookup + point-id hashing
├── embeddings.ts             # Voyage embed + rerank client (swappable)
├── llm.ts                    # two-tier LLM: Gemini free → Claude paid fallback (+ why no caching)
├── language.ts               # deterministic en/zh-TW/ja detection
├── guardrails.ts             # input sanitize + isOffensiveOutput() output filter
├── portfolio-map.ts          # always-injected global-question rescue
├── config.ts                 # central settings + env overrides (incl. faq cache)
├── api-helpers.ts            # request validation, SSE framing, in-memory rate limiter
├── *.test.ts                 # node --test units: triage, faq-cache, faq-audit, graph, api-helpers
├── entities/
│   └── relations.json        # lightweight entity graph (no Neo4j), injected at generate
├── ingest/
│   ├── extract.ts            # parse src/data/*.ts → records (no regex drift)
│   ├── build-index.ts        # chunk → voyage embed → upsert Qdrant (sparse via Cloud Inference)
│   └── build-faq-cache.ts    # embed FAQ paraphrases → upsert faq_cache collection
├── insights/
│   └── report.ts             # chat_logs analytics (npm run rag:insights)
└── evals/
    ├── golden.ts             # eval set (single-fact/local/global/out-of-corpus)
    ├── metrics.ts            # recall@k / MRR / correctness (unit-tested)
    ├── judge.ts              # LLM faithfulness judge
    └── run-eval.ts           # ablation runner + markdown report
```
