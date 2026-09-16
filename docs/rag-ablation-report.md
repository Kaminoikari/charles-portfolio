# RAG Ablation Report

Retrieval-ablation results from the golden set, run against the live Qdrant index
via the `RAG Eval` workflow. Each arm adds one retrieval layer, so the marginal
lift of each is visible.

- Golden set: **41 questions × 3 locales** (en / zh-TW / ja) = 123 query runs,
  across five categories (single-fact, global, local, near-miss, out-of-corpus).
- `recall@k` is hit-rate: did at least one relevant chunk surface in the top-k?
  (binary per query, averaged). `MRR` is the reciprocal rank of the first
  relevant chunk — it rewards ranking the right chunk near the top.
- The `corrective` arm runs the full graph and scores `correctness` and
  `faithfulness` too. It needs an Anthropic key, so it is skipped in the
  post-ingest gate, which has only the retrieval secrets.
- Last run: **2026-09-16**. The three retrieval arms are from run 35059505617;
  the `corrective` row and the correctness figures are from run 35077918161, a
  corrective-only re-run after the correctness rules were fixed. Both with blog
  full-text indexing on (`RAG_BLOG_BODY=1`) and first-party weighting at
  `RAG_FIRST_PARTY_BOOST=1.2`.

## Current results

| Arm | recall@k | MRR | correctness | faithfulness |
|---|---|---|---|---|
| dense-only | 97.6% | 0.821 | — | — |
| hybrid | 92.7% | 0.649 | — | — |
| hybrid+rerank | 96.7% | 0.873 | — | — |
| corrective | 75.6% | 0.689 | 96.7% | 91.9% |

Recall stopped being 100% when the set grew from 29 to 41 questions, which is
the point of having grown it: the old set could not fail. The added items are
blog-body questions, agentic-pattern questions (22 chunks that had no coverage
at all), and four near-miss pairs.

**The corrective arm's 75.6% recall is not a retrieval result.** The FAQ cache
answered 28 of its 123 runs, and a cached answer carries no retrieved sources,
which the harness scores as a recall miss. 75.6% + 22.8% = 98.4%, in line with
`hybrid+rerank`'s 96.7% (slightly above it because the corrective loop's rewrite
recovers a few). The metric cannot separate "the cache answered" from "retrieval
found nothing"; read the retrieval arms for retrieval quality.

### By category

`recall` (hybrid+rerank) and `correctness` (corrective):

| Category | n | recall | correctness |
|---|---|---|---|
| single-fact | 66 | 95.5% | 93.9% |
| global | 18 | 94.4% | 100.0% |
| local | 15 | 100.0% | 100.0% |
| near-miss | 12 | 100.0% | 100.0% |
| out-of-corpus | 12 | 100.0% | 100.0% |

Read near-miss in the correctness column, not recall. A near-miss item's sibling
chunk is one of its own relevant ids, so retrieving the wrong one of the pair
scores full recall while the answer quotes the other company's number — which is
why recall reads 100% there and cannot be read as reassurance.

`local` and `global` correctness read 66.7% and 77.8% before the rules were
fixed. Nine of the sixteen misses in that run were the metric: `mustInclude` is
a substring check, and the site's zh/ja copy keeps English terms inline
(「重成果，不重產出 (Outcomes over outputs)」), so the rule quietly required the
generator to carry the parenthetical through. Those facts moved to `mustState`,
judged by meaning in any language, and both categories went to 100%.

### The four misses that are left

All four are one defect, and it is not a metric problem: **the FAQ cache serves
a broad entry for a specific question.**

| Item | Locale | Served | Should have served |
|---|---|---|---|
| `skills-listed` | en, zh-TW, ja | `why-hire` | `skills-product` / `skills-ai` / `skills-engineering` |
| `nueip-role` | zh-TW | `overall-summary` | `exp-nueip` |

Both verified against production: the answer to "what skills does Charles list
on his site?" is byte-identical to the `why-hire` entry, a hiring pitch that
never lists a skill; the answer to 「Charles 在 NUEIP 做什麼?」 runs 626
characters without naming NUEIP once. The English NUEIP question is fine, so it
is the zh embedding neighbourhood that ranks the broad entry first.

The margin rule added in the same batch does not catch this. It refuses a top
hit that fails to beat the best DIFFERENT entry by `RAG_FAQ_MARGIN`; here the
broad entry wins comfortably. Being confidently wrong is the case it was never
designed to see.

## How two earlier changes moved the numbers (2026-06, 29-question set)

Historical: every figure in this section was measured on the 29-question set
against the corpus as it stood in June, so it is not comparable to the table
above. Kept because it records why `RAG_FIRST_PARTY_BOOST` is 1.2.

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
gh workflow run "RAG Eval" --ref main      # all four arms, all three locales
gh run view <run-id> --log                 # the three tables + per-item misses
```

Locally (needs `VOYAGE_API_KEY` + `QDRANT_URL` + `QDRANT_API_KEY`):

```
npm run rag:eval                 # all retrieval arms, all locales
npm run rag:eval -- --arm hybrid+rerank --locale en
```
