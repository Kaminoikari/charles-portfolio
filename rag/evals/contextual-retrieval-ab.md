# Contextual Retrieval — A/B on the golden set

An ingest-side implementation of Anthropic's [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
ships behind the `RAG_CONTEXTUAL` flag (`rag/ingest/contextualize.ts`). Before
committing it to production we measured its effect on the golden set. This is the
record of that measurement and the decision it drove.

## Method

Both arms use a throwaway Qdrant collection (`doc_chunks_ctx_ab`), so production
`doc_chunks` is never touched:

1. **Baseline** — build the collection raw (`RAG_CONTEXTUAL=0`), 960 chunks.
2. **Contextual** — rebuild with `RAG_CONTEXTUAL=1`. The incremental reconciler
   re-embeds only the 627 fragment chunks (blog body slices, project case-study
   sections); the 333 self-contained chunks are left untouched. Each fragment
   gets a Claude Haiku situating sentence prepended to both its dense embedding
   and its BM25 text.
3. Run the deterministic retrieval ablation (`--retrieval-only`) against each,
   comparing `recall@k` and `MRR` on the same 29-question × 3-locale golden set.

## Result

| Arm | recall@k (raw → ctx) | MRR (raw → ctx) | MRR Δ |
|---|---|---|---|
| dense-only | 100.0% → 100.0% | 0.859 → 0.861 | +0.002 |
| hybrid | 93.1% → 93.1% | 0.616 → 0.715 | **+0.099** |
| hybrid+rerank (**production**) | 100.0% → 100.0% | 0.877 → 0.880 | +0.003 |

## Reading

- **Recall is at the ceiling.** dense-only and hybrid+rerank already recall a
  relevant chunk for every question, so the golden set has no room to show a
  recall improvement. It is not discriminating enough to fully judge contextual
  retrieval on recall.
- **Contextual clearly helps the un-reranked hybrid arm** (MRR +0.099, ~16%
  relative): the situating context sharpens where the right chunk lands in the
  raw fusion ranking.
- **The production arm barely moves** (+0.003). The cross-encoder reranker
  (`rerank-2.5`) already re-scores query and document together, recovering the
  same ranking that contextual gives the un-reranked arm. The two techniques
  target the same failure, so stacked on top of the reranker contextual adds
  almost nothing here.

## Decision

**Keep `RAG_CONTEXTUAL` off in production.** On this golden set the production
`hybrid+rerank` pipeline gains no material lift, so the per-fragment Claude calls
and the longer ingest are not yet justified by evidence. The capability stays
fully implemented and measured behind the flag; revisit if the golden set grows,
if the corpus shifts toward fragment-heavy content where recall has room to move,
or if the reranker is ever dropped for cost.

## Reproduce

```bash
# baseline
gh workflow run "RAG Ingest" -f collection=doc_chunks_ctx_ab -f contextual=false -f prune=true
gh workflow run "RAG Eval"   -f collection=doc_chunks_ctx_ab -f retrieval_only=true
# contextual
gh workflow run "RAG Ingest" -f collection=doc_chunks_ctx_ab -f contextual=true  -f prune=true
gh workflow run "RAG Eval"   -f collection=doc_chunks_ctx_ab -f retrieval_only=true
# cleanup
gh workflow run "RAG Drop Collection" -f collection=doc_chunks_ctx_ab
```
