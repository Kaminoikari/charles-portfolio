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
  the `corrective` row and the correctness figures are from run 35110389098, a
  corrective-only re-run with the FAQ lexical veto on and the skills chunk
  rebuilt. Both with blog full-text indexing on (`RAG_BLOG_BODY=1`) and
  first-party weighting at `RAG_FIRST_PARTY_BOOST=1.2`.

## Current results

| Arm | recall@k | MRR | correctness | faithfulness |
|---|---|---|---|---|
| dense-only | 97.6% | 0.821 | — | — |
| hybrid | 92.7% | 0.649 | — | — |
| hybrid+rerank | 96.7% | 0.873 | — | — |
| corrective | 80.5% | 0.724 | 100.0% | 85.4% |

Recall stopped being 100% when the set grew from 29 to 41 questions, which is
the point of having grown it: the old set could not fail. The added items are
blog-body questions, agentic-pattern questions (22 chunks that had no coverage
at all), and four near-miss pairs.

**The corrective arm's 80.5% recall is not a retrieval result.** The FAQ cache
answered 23 of its 123 runs, and a cached answer carries no retrieved sources,
which the harness scores as a recall miss. 80.5% + 18.7% = 99.2%, in line with
`hybrid+rerank`'s 96.7% (slightly above it because the corrective loop's rewrite
recovers a few). The metric cannot separate "the cache answered" from "retrieval
found nothing"; read the retrieval arms for retrieval quality.

**Faithfulness moved from 91.9% to 85.4% with no answer getting worse, because
the denominator changed.** The judge is only meaningful for an answer that HAS
retrieved context: an empty context short-circuits to `grounded: true` as
vacuously faithful (`rag/evals/judge.ts`), and a FAQ cache hit, a decline, and
an outage notice all have one. Those free passes fell from 28 to 23 when the
lexical veto sent five more questions to generation, so the judged answers now
carry more of the mean. The two figures are not measured over the same set, and
the headline rises whenever the cache answers more often. Read it as a quality
trend only once the vacuous passes are dropped from the mean instead of scored
as 1.

### By category

`recall` (hybrid+rerank) and `correctness` (corrective):

| Category | n | recall | correctness |
|---|---|---|---|
| single-fact | 66 | 95.5% | 100.0% |
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

### The four misses, and what closed them

Correctness read 96.7% with four misses. All four were one symptom, **the FAQ
cache serving a broad entry for a specific question**, and they turned out to
have two different causes.

| Item | Locale | Served | Should have served | Closed by |
|---|---|---|---|---|
| `nueip-role` | zh-TW | `overall-summary` | `exp-nueip` | the lexical veto |
| `skills-listed` | en, zh-TW, ja | `why-hire` | the skills chunk | the chunk heading |

Both were verified against production first: the answer to "what skills does
Charles list on his site?" was byte-identical to the `why-hire` entry, a hiring
pitch that never lists a skill; the answer to 「Charles 在 NUEIP 做什麼?」 ran 626
characters without naming NUEIP once. The English NUEIP question was fine, so it
was the zh embedding neighbourhood that ranked the broad entry first.

The margin rule does not catch either. It refuses a top hit that fails to beat
the best DIFFERENT entry by `RAG_FAQ_MARGIN`, and here the broad entry won
comfortably. Being confidently wrong is the case it was never designed to see.

**The lexical veto** (`RAG_FAQ_SPARSE_VETO`, default on since 9fa5756) is the
second opinion that does see it. The FAQ collection carries a `qdrant/bm25`
sparse vector beside its dense one, and a dense winner the lexical arm does not
rank at all is refused and falls through to RAG. It fired 5 times in 123 runs
and closed `nueip-role`. IDF is the reason it works where another embedding
would not: a dense vector scores the FRAME of 「Charles 在 NUEIP 做什麼?」, which
is nearly the frame of 「Charles 是做什麼的」, while BM25 weights the one rare
proper noun that tells the two apart.

**`skills-listed` was never a cache problem.** The veto did refuse `why-hire`
on the en run, and the answer was still wrong, because retrieval had nothing to
offer either: the skills chunk held the bare list of labels
("GPS for chaos", "Talking to humans, professionally") with no word saying what
the list was, so no phrasing of "what skills does he list" matched it. Giving
the chunk a per-locale heading (`SKILLS_HEADING` in `rag/ingest/extract.ts`,
ca3e211) made it the top source, and the three misses went with it.

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
