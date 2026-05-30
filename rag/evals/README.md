# RAG Evaluation Harness (Phase 1)

Measures the portfolio RAG pipeline the same way `product-playbook` measures the
skill: a golden set, deterministic + LLM-judge metrics, and an **ablation** that
isolates each retrieval layer's marginal lift.

## What it measures

| Metric | How | LLM? |
|---|---|---|
| `recall@k` | did a relevant chunk surface in top-k? (id prefix match) | no |
| `MRR` | reciprocal rank of the first relevant chunk | no |
| `correctness` | golden `mustInclude` substrings present / `mustDecline` honored | no |
| `faithfulness` | every claim grounded in retrieved context (strict judge) | yes (Haiku) |

## Ablation arms

Each arm adds one layer, so the delta column shows what that layer bought:

1. `dense-only` — pgvector HNSW cosine only
2. `hybrid` — + sparse (Postgres FTS), fused with RRF
3. `hybrid+rerank` — + voyage rerank-2.5 cross-encoder
4. `corrective` — + the full LangGraph loop (grade → rewrite → generate / fallback)

Arms 1–3 are retrieval-only (no Anthropic key needed). Arm 4 runs the graph and
adds correctness + faithfulness.

## Run

```bash
npm run rag:eval                      # all arms × all locales, prints table
npm run rag:eval -- --locale en       # one locale
npm run rag:eval -- --arm hybrid      # one arm
npm run rag:eval -- --out docs/rag-ablation.md   # write the markdown report
npm run rag:test                      # unit tests for the metrics (no secrets)
```

## Required env

- Retrieval arms: `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
  (plus a built index — run `npm run rag:ingest` first).
- Corrective arm + faithfulness: `ANTHROPIC_API_KEY`.
- LangSmith tracing (optional): `LANGCHAIN_TRACING_V2=true` + `LANGCHAIN_API_KEY`
  — every arm's runs are captured as a traced experiment, no code change.

## Files

- `golden.ts` — the eval set (single-fact / local / global / out-of-corpus × 3 locales), grounded in the real corpus
- `metrics.ts` — pure recall/MRR/correctness (unit-tested in `metrics.test.ts`)
- `judge.ts` — LLM faithfulness judge
- `run-eval.ts` — the ablation runner + markdown report
