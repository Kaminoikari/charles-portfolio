# Portfolio RAG — Improvement Roadmap

> A concrete, code-grounded plan for evolving `rag/` toward enterprise-RAG best
> practice. Companion to [`enterprise-rag-best-practices.md`](./enterprise-rag-best-practices.md).
> Scope check: this is a **single-tenant, public** portfolio chatbot over a small,
> self-authored corpus — so several "enterprise" best practices (per-user ACLs,
> GraphRAG) do **not** apply here. This roadmap calls those out explicitly rather
> than cargo-culting them.

## Where we already stand (no work needed)

The pipeline already matches the industry baseline on most layers:

| Best practice | Status in `rag/` |
|---|---|
| Hybrid dense + sparse | ✅ Voyage `voyage-3-large` + Qdrant BM25, fused with RRF (`retrieval.ts`) |
| RRF fusion, k=60 | ✅ `config.rrfK = 60` |
| Cross-encoder rerank | ✅ Voyage `rerank-2.5`, `topK=6` from `candidateK=20` |
| Corrective / agentic loop | ✅ triage → retrieve → grade → rewrite → generate (`graph.ts`, `maxLoops=2`) |
| Semantic cache | ✅ FAQ cache at cosine ≥ 0.7 (answers common Qs for $0) |
| Parent-doc chunking | ✅ project chunks carry `parent_id` (`extract.ts`) |
| Eval harness | ✅ golden set + ablation arms + recall@k / MRR / correctness / faithfulness judge + LangSmith (`rag/evals/`) |

So the eval pipeline best practice is **already done**. The roadmap below is about
the one high-value gap (Contextual Retrieval) plus targeted extensions.

## Implemented — blog full-text indexing

Previously only each article's **title + subtitle** was indexed (the bodies live
on Substack/Medium), so the bot couldn't answer questions whose answer is in the
article body. That is now addressed:

- `rag/ingest/fetch-blog-bodies.ts` (`npm run rag:blog`) fetches each article's
  full text into `rag/ingest/blog-bodies.json` (committed, keyed by URL). Substack
  uses the RSS `content:encoded` body with a page fallback; Medium uses the
  article page. HTML is stripped to text dependency-free.
- `rag/ingest/chunk.ts` splits long bodies (CJK-aware recursive splitter, default
  900 chars / 150 overlap — `RAG_BLOG_CHUNK_CHARS` / `RAG_BLOG_CHUNK_OVERLAP`).
- `rag/ingest/extract.ts` emits `blog:<i>:body:<j>:<locale>` child chunks (parent =
  the `blog:<i>` title chunk). Inert until the cache is populated, so it never
  breaks a build.

**Operating it:** `npm run rag:blog` → commit the refreshed JSON → `npm run rag:ingest`.

**Two deliberate decisions:**
1. **No translation — rely on multilingual embeddings.** Article bodies are
   Traditional Chinese and are indexed once per locale (same Chinese text). The
   multilingual Voyage dense embedding lets en/ja queries still retrieve them; the
   BM25 sparse arm only helps zh-TW queries (different script). Translating bodies
   per locale would improve en/ja answer fidelity but is costly — revisit only if
   eval shows a cross-lingual gap.
2. **Fetch is separated from ingest** so the index is reproducible and a build
   never depends on a live (rate-limited) fetch.

**Operational dependency — network egress:** in a remote environment with an
egress allowlist, the fetch step fails with `Host not in allowlist` unless the
article hosts (`*.substack.com`, `*.medium.com`) are added to the environment's
network egress settings. Run `npm run rag:blog` locally, or allowlist the hosts.

## Not recommended for this corpus (and why)

- **GraphRAG / SAG / knowledge-graph retrieval.** These earn their cost only on
  multi-hop / global-aggregation queries over large corpora. This corpus is small
  and questions are overwhelmingly single-hop ("what did Charles build / do?").
  Adding it would increase ingest cost and latency with no measurable accuracy gain.
  See best-practices §3.
- **Permission-aware retrieval / document-level ACLs.** The entire corpus is public,
  single-tenant. There is nothing to security-trim. (Revisit only if private/gated
  content is ever added.) See best-practices §4.
- **Incremental / CDC indexing.** The corpus is tiny and rebuilt from typed TS
  modules; a full re-index is cheap. A high-water-mark sync would be over-engineering.

---

## Priority 1 — Contextual Retrieval (highest ROI)

**Why:** Anthropic reports prepending an LLM-generated, chunk-specific context
before embedding *and* before BM25 cuts retrieval-failure ~35–49%
(best-practices §2). Our chunks lose context when split — e.g.
`project:<id>:impact` is just impact bullets with the project name only in the
sibling parent chunk. Adding one line of context ("This is the impact section of
<project>, an AI tool that …") should raise recall, especially for the sparse/BM25
arm and for cross-lingual queries.

**Where it plugs in:** ingest only — `rag/ingest/extract.ts` →
`rag/ingest/build-index.ts`. Retrieval/query path is unchanged. We already have a
free LLM (Gemini `gemini-2.5-flash`) and parent linkage (`parent_id`).

**Plan:**

1. **New module `rag/ingest/contextualize.ts`.** For each child chunk, build a
   short context string (target 50–100 tokens) from its parent document:
   - For `project:*` chunks → use the parent project (`title`, `subtitle`, and the
     section name) as the document; ask the LLM for one sentence situating this
     chunk within that project.
   - For already-self-contained chunks (`about`, `experience`, `skill`, `changelog`,
     `blog` — all `parentId === null`) → context adds little; **skip the LLM call**
     and either no-op or prepend a cheap deterministic prefix (e.g. the `title`).
     This keeps cost and latency down.
2. **Wire into `build-index.ts`** between extract and embed: produce
   `contextualizedContent = context + "\n\n" + r.content`. Embed *that* for the
   dense vector and pass *that* as the BM25 `text`. Keep the **original** `content`
   in the payload (the generate step and citations should show the real text, not
   the synthetic prefix).
3. **Config flag** in `rag/config.ts`: `contextualEnabled: bool('RAG_CONTEXTUAL', false)`
   — off by default so the change is inert until proven by eval, on the same
   env-override discipline as every other tunable.
4. **Cost control:** batch by parent document and rely on Gemini free-tier; only
   `project:*` children call the LLM (a few dozen calls total across locales). No
   prompt-cache plumbing needed at this corpus size.

**Acceptance:** the ablation report (Priority 2) shows a positive Δrecall and ΔMRR
for a new `+contextual` arm vs `hybrid+rerank`, with no correctness/faithfulness
regression. If it doesn't help, the flag stays off and we keep the finding.

## Priority 2 — Extend the eval harness to measure P1

The harness exists; it needs one arm and a bigger golden set.

1. **Add a retrieval arm** in `rag/evals/run-eval.ts`. The arms there are retrieval
   configs (`dense`/`sparse`/`rerank` toggles); Contextual Retrieval is an
   *ingest-time* change, so measuring it means indexing a contextualized collection
   and pointing retrieval at it. Two options:
   - **(a)** Add a `RAG_CONTEXTUAL=1` build into a separate Qdrant collection and a
     `--collection` override on the eval, then compare `hybrid+rerank` across the two
     collections. (Cleanest; recommended.)
   - **(b)** Parameterize the arm to select collection. Either way, report it as a
     new row so the existing Δrecall column tells the story.
2. **Grow `rag/evals/golden.ts`.** Best practice is a golden set that covers the
   real query distribution. Add questions per `source_type` (project impact,
   experience, philosophy, blog) and per locale, with `relevantIds`. Aim for enough
   items that a single flaky question doesn't swing the mean.
3. **Wire `--out` into CI** (optional) so `docs/rag-ablation-report.md` is refreshed
   on a schedule and regressions are visible.

## Priority 3 — Cheap robustness wins (optional, after P1/P2)

- **Query reformulation on the first pass**, not only after a failed grade. The
  corrective loop currently rewrites *reactively*; vendors (Azure agentic retrieval,
  Vertex) also expand/decompose the query up front. Could be a 5th eval arm to test
  whether proactive expansion beats the reactive loop on recall.
- **Surface citations in the UI** with the original chunk text (already stored in
  payload) — groundedness/traceability is a best practice and a nice trust signal
  for recruiters.

---

## Suggested sequencing

1. P2.2 first (expand golden set) — you want a trustworthy baseline before changing retrieval.
2. P1 (Contextual Retrieval) behind `RAG_CONTEXTUAL`, into a separate collection.
3. P2.1 (contextual eval arm) — measure the lift. Promote the flag only if the
   numbers justify it.
4. P3 items as time allows.

Each step is independently shippable and reversible (env flags + separate
collections), matching the repo's existing config discipline.
