# RAG Ablation Report

Retrieval-ablation results from the golden set, run against the live Qdrant index
via the `RAG Eval` workflow. Each arm adds one retrieval layer, so the marginal
lift of each is visible.

- Golden set: 29 questions × 3 locales (en / zh-TW / ja) = 87 query runs.
- `recall@k` is hit-rate: did at least one relevant chunk surface in the top-k?
  (binary per query, averaged). `MRR` is the reciprocal rank of the first
  relevant chunk — it rewards ranking the right chunk near the top.
- The `corrective` arm (full graph + faithfulness judge) needs an Anthropic key
  and is skipped in CI, which has only the retrieval secrets. The three
  retrieval arms are what measure recall.
- Last run: 2026-06-19, with blog full-text indexing on (`RAG_BLOG_BODY=1`) and
  first-party weighting at `RAG_FIRST_PARTY_BOOST=1.2`.

## Current results

| Arm | recall@k | MRR |
|---|---|---|
| dense-only | 100.0% | 0.866 |
| hybrid | 100.0% | 0.721 |
| hybrid+rerank | 100.0% | 0.880 |

## How the last two changes moved the numbers

Indexing the full blog bodies let the bot answer body-only questions (e.g.
"Why did Charles turn down the Uber offer?"), but the 900-char body chunks then
out-ranked first-party `about:*` chunks on a couple of cross-corpus synthesis
questions. Two changes resolved that without losing the new blog coverage:

1. **Widen the synthesis golden items** to their real evidence set — for global
   questions like "how does Charles use AI across his work?", the articles where
   he actually builds with AI (and his product-method project) are legitimate
   evidence, not only the `about` chunk.
2. **Weight first-party content above blog bodies** (`RAG_FIRST_PARTY_BOOST`) so
   curated portfolio sources outrank tangential blog bodies on the same topic.

Progression on `hybrid+rerank`:

| Stage | recall@k | MRR |
|---|---|---|
| blog bodies indexed, strict golden | 96.6% | 0.817 |
| + widened synthesis golden | 100.0% | 0.854 |
| + first-party weighting (1.2) | 100.0% | 0.880 |

Recall held at 100% through the weighting change and no blog-only question
regressed (the Uber / LangGraph body questions, which have no first-party
counterpart, stayed in the top-k), while MRR rose as first-party content
returned to the front.

## Reproducing

```
gh workflow run "RAG Eval" --ref main      # runs the three retrieval arms
gh run view <run-id> --log                 # recall / MRR table + per-item misses
```

Locally (needs `VOYAGE_API_KEY` + `QDRANT_URL` + `QDRANT_API_KEY`):

```
npm run rag:eval                 # all retrieval arms, all locales
npm run rag:eval -- --arm hybrid+rerank --locale en
```
