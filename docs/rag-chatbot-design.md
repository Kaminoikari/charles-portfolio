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

## 1. Architecture

```
                         BUILD TIME  (rag/ingest/)  — run locally / CI
  src/data/*.{en,zh-TW,ja}.ts ─┐
  product-playbook README      ├─► extract ─► semantic split ─► BGE-M3 embed ─► Supabase pgvector
  entities/relations.json      ┘   (parent/child)  (dense+sparse)        (HNSW + FTS + RLS)

                         QUERY TIME  (api/chat.ts — Vercel Node fn + LangGraph.js)
  question
     │
     ▼
  ┌──────────────────────  LangGraph StateGraph  ──────────────────────┐
  │  [retrieve] ── LangChain SupabaseVectorStore hybrid + bge-reranker  │
  │       │                                                             │
  │  [grade_documents] ── LLM grades each chunk's relevance  (CRAG)     │
  │       ├─ relevant ───────────────► [generate] ─► answer + citations │
  │       └─ weak/off-topic ─► [rewrite_query] ─► retrieve (≤ N loops)  │
  │                                  └─ still fails ─► [fallback] honest │
  └────────────────────────────────────────────────────────────────────┘
     │
     ▼
  Claude (streaming) ─► answer + retrieved sources + scores  → React widget
```

### Deployment
- **`api/chat.ts`** — Vercel Node serverless function. Imports the compiled
  LangGraph.js graph and streams the answer back over SSE. Same platform as the
  site; no extra service to run.
- **Frontend widget** — React component in the existing Vite app, calls
  `POST /api/chat` (SSE streaming) on the same origin (no CORS).
- **Supabase pgvector** — already in the stack; one Postgres holds vectors +
  full-text index + chat logs.
- **Embeddings + rerank** — hosted BGE-M3 / bge-reranker-v2-m3 over an
  OpenAI-compatible HTTP API (no GPU on Vercel, so self-hosting the model is out;
  the client is swappable via `config.ts`).

*Alternative on file:* a persistent Fly.io service (like the Plutus Trade
backend) if cold starts or long-running eval jobs become a problem. Chosen
against initially for single-platform simplicity; ingestion + eval scripts run
locally / in CI where warm runtime isn't needed.

---

## 2. Component choices (and why)

| Layer | Choice | Why for this corpus | Showcase point |
|---|---|---|---|
| Orchestration | **LangGraph** `StateGraph` | corrective loop needs state + branching, not a linear chain | "agentic / corrective RAG, not naive single-shot" |
| Retrieval primitives | **LangChain** `SupabaseVectorStore`, `RecursiveCharacterTextSplitter`, `Document` | standard interfaces over pgvector + hybrid | "I use the LangChain ecosystem the way teams do" |
| Embedding | **BGE-M3** (hosted, OpenAI-compatible) | one model covers EN/zh-TW/ja + emits dense **and** sparse → free hybrid | multilingual + hybrid without bolting two models together |
| Vector store | **Supabase pgvector** (HNSW) | already in stack; hybrid = one SQL (vector + `tsvector`) | real vector DB, SQL hybrid, RLS |
| Rerank | **bge-reranker-v2-m3** (hosted) | small corpus makes rerank lift measurable | cross-encoder reranking |
| Fusion | **RRF** (Reciprocal Rank Fusion) of dense + sparse | robust, no tuning | hybrid fusion |
| Global-question guard | top-k **+ injected "portfolio map"** (one-line summary of every project/role) | chunking starves "what's his overall style?" questions | knows RAG failure modes |
| Graph relations | hand-written `entities/relations.json`, injected — **no Neo4j** | the entity graph is ~dozens of edges | **knowing when *not* to use GraphRAG** |
| Generation | **Claude** (Haiku default → Sonnet on hard) | multilingual, faithfulness guardrails, streaming | model routing + cost awareness |
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
| `retrieve` | hybrid (dense+sparse) → RRF → rerank top-k | embed + rerank API |
| `grade_documents` | per-chunk relevance grade; sets `route` | yes (Haiku, structured output) |
| `rewrite_query` | reformulate using what's missing; `loops += 1` | yes (Haiku) |
| `generate` | answer grounded in `graded` + portfolio map; emit citations | yes (Haiku→Sonnet) |
| `fallback` | honest "the portfolio doesn't cover that" | no |

**Edges:** `START → retrieve → grade_documents`; conditional from
`grade_documents`: `route=="generate" → generate`, `route=="rewrite" and loops<MAX → rewrite_query → retrieve`, else `→ fallback`; `generate → END`, `fallback → END`.

> Demo trick: ask something the corpus lacks → watch it rewrite, fail, and
> *honestly decline*. Refusing well is more impressive than answering.

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

## 5. Supabase schema

```sql
create extension if not exists vector;

create table doc_chunks (
  id          text primary key,
  parent_id   text,
  source_type text not null,         -- project|about|experience|skill|changelog|blog|playbook
  project_id  text,
  locale      text not null,         -- en|zh-TW|ja
  title       text,
  content     text not null,
  embedding   vector(1024),          -- BGE-M3 dense
  fts         tsvector generated always as (to_tsvector('simple', content)) stored
);
create index on doc_chunks using hnsw (embedding vector_cosine_ops);
create index on doc_chunks using gin (fts);

create table chat_logs (              -- free product insight: what recruiters ask
  id uuid default gen_random_uuid() primary key,
  ts timestamptz default now(),
  question text, language text,
  route text, loops int, latency_ms int,
  sources jsonb
);
```

Hybrid retrieval = one RPC running cosine (HNSW) + `ts_rank` (FTS), merged by RRF
in Python.

---

## 6. Guardrails (public endpoint — also showcase points)

1. **Faithfulness lock** — answer only from retrieved context; never hallucinate
   roles/credentials; unknown ⇒ say so. Enforced in the `generate` prompt + a
   LangSmith faithfulness eval.
2. **Prompt-injection defense** — strip/neutralize "ignore previous
   instructions" style payloads; corpus content is data, not instructions.
3. **Rate limiting** — Upstash Redis sliding window per IP.
4. **Cost control** — Haiku default, Sonnet only when `grade` flags a hard
   synthesis question.
5. **Logging** — every Q → `chat_logs` for retrieval analytics.

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

0. ✅ Ingestion + chunking + BGE-M3 embed → pgvector (`rag/ingest/`).
1. ✅ Hybrid (+sparse +RRF +reranker) + LangSmith ablation harness (`rag/evals/`).
2. ✅ LangGraph corrective graph + language detection + `answer()` entry,
   stub-tested (`rag/graph.ts`, `rag/nodes.ts`, `rag/language.ts`).
3. ⬜ `api/chat.ts` Vercel Node SSE + guardrails + logging.
4. ⬜ React widget + retrieval-transparency UI + suggested questions.
5. ⬜ (optional) relations.json graph injection; chat-logs insights dashboard.

---

## 10. Required secrets (none present in this container)

`ANTHROPIC_API_KEY`, `LANGSMITH_API_KEY`, `EMBEDDING_API_KEY` (SiliconFlow/
DeepInfra or self-host on Fly), `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`,
`UPSTASH_REDIS_*`. Until these exist the pipeline can be built but not run
end-to-end.

---

## Directory layout

```
rag-service/
├── pyproject.toml            # langgraph, langchain, langchain-anthropic, supabase, fastapi
├── app/
│   ├── main.py               # FastAPI + SSE /chat
│   ├── graph.py              # LangGraph StateGraph (the spine)
│   ├── nodes.py              # retrieve / grade / rewrite / generate / fallback
│   ├── retrieval.py          # hybrid + RRF + rerank over pgvector
│   ├── embeddings.py         # BGE-M3 client (swappable)
│   ├── config.py             # central settings + env overrides
│   └── guardrails.py         # injection filter, faithfulness prompt
├── ingest/
│   ├── extract_ts.py         # parse src/data/*.ts → records
│   └── build_index.py        # chunk → embed → upsert pgvector
├── entities/relations.json   # lightweight entity graph (no Neo4j)
└── evals/
    ├── golden.jsonl
    └── run_eval.py           # LangSmith ablation harness
```
