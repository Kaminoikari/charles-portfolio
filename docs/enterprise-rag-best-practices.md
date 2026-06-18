# Enterprise RAG Architecture — Best Practices (sourced)

> Research note. Compiled from a multi-source survey of cloud-vendor reference
> architectures, primary papers, and standards bodies. Every claim is tagged
> with a confidence level:
>
> - 🟢 **Verified primary source** (fetched, or corroborated across independent sources)
> - 🟡 **Vendor doc** (authoritative but the vendor sells the product — may have a slant)
> - 🔴 **Search-snippet only** (the primary page blocked automated fetch; verify wording before quoting)
>
> Several arxiv and vendor pages return HTTP 403 to automated fetchers; some
> claims were verified via official GitHub mirrors (e.g. `MicrosoftDocs/azure-ai-docs`,
> `OWASP/CheatSheetSeries`) or multi-source corroboration. Date of survey: 2026-06.

## TL;DR — the canonical enterprise RAG pipeline

There is no single trick; the major vendors (AWS Bedrock Knowledge Bases, Azure
AI Search, Google Vertex AI RAG Engine, Databricks Mosaic AI) converge on the
same layered pipeline:

```
sources → connectors / incremental sync → chunking + context enrichment → embed → vector store (+ permission metadata)
                                                                                          ↓
answer ← generation (grounded + citations) ← rerank ← hybrid retrieval (dense+sparse, RRF) ← query
                                                              ↑
                                          permission filter / agentic corrective loop
```

| Layer | Best practice | Confidence |
|---|---|---|
| Chunking | recursive split → **contextual retrieval (LLM-added context)** → parent-doc | 🟢 |
| Indexing | HNSW default; metadata for permission/tenant; IVF at large scale | 🟡 |
| Retrieval | **hybrid (dense + BM25) + RRF fusion** is the baseline, not a bonus | 🟢🟡 |
| Reranking | **cross-encoder rerank** as a second stage | 🟢 |
| Structure | GraphRAG only for **multi-hop / global-aggregation** queries at scale | 🟢 |
| Permissions | enforce ACLs **at retrieval time**, sync with source | 🟢 (OWASP) |
| Freshness | high-water-mark / CDC incremental indexing | 🟢 |
| Correction | **corrective / agentic RAG loop** | 🟢 |
| Evaluation | RAGAS / RAG-Triad + golden set, monitored continuously | 🟢 |

---

## 1. Retrieval — hybrid + rerank is the default

- 🟡 **Hybrid (vector + keyword/BM25) beats pure vector.** Azure states hybrid +
  semantic ranker gives "significant benefits in search relevance," and keyword
  matching is specifically better for product codes, jargon, dates, and names —
  content embeddings represent poorly.
  [Azure hybrid-search overview](https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview)
- 🟡 AWS Bedrock, Databricks Mosaic, and Elastic all ship hybrid. Databricks names
  "SKUs or identifiers not well suited to pure similarity search" as the core
  motivation, fusing **BM25 + RRF**.
  [Databricks hybrid search GA](https://www.databricks.com/blog/announcing-hybrid-search-general-availability-mosaic-ai-vector-search)
- 🟢 **Fusion via RRF** — the original paper proves it "outperforms Condorcet and
  individual rank learning methods."
  [Cormack et al., SIGIR 2009 (PDF)](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf).
  Azure documents the `1/(rank+k)` formula and the common **k=60**.
  [Azure hybrid-search-ranking](https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking)
- 🟢 **Second-stage cross-encoder rerank is standard.** Google notes "up to 70% of
  retrieved passages lack a true answer"; reranking is the final precision filter
  and sending fewer, better docs *reduces* latency and cost.
  [Vertex AI Ranking API (2025-05)](https://cloud.google.com/blog/products/ai-machine-learning/launching-our-new-state-of-the-art-vertex-ai-ranking-api).
  AWS, Azure (semantic ranker), and Elastic (Elastic Rerank) have equivalents.
- 🟡 **Pick embeddings via MTEB, decide on your own corpus** (MRR/NDCG). Dimensions
  multiply storage/latency; gains flatten past ~768.
  [Weaviate embedding guide](https://weaviate.io/blog/how-to-choose-an-embedding-model)
  (blog-level; dimension thresholds are directional).

## 2. Chunking & indexing — context enrichment is the biggest recent gain

- 🟢/🔴 **Anthropic Contextual Retrieval** (Anthropic page 403'd; numbers
  corroborated by InfoQ, Simon Willison, others): prepend a 50–100 token
  LLM-generated, chunk-specific context before embedding *and* before BM25.
  Reported: Contextual Embeddings cut top-20 retrieval failure **35%**
  (5.7%→3.7%); + Contextual BM25 **49%**; + reranking **67%** (→1.9%). Made
  affordable with prompt caching at ~**$1.02 / million document tokens**.
  [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- 🟢 **Default to recursive splitting**; reach for semantic chunking only when a
  measured problem isn't solved otherwise.
  [LangChain recursive splitter](https://docs.langchain.com/oss/python/integrations/splitters/recursive_text_splitter)
- 🟢 **Parent-document / hierarchical chunking** (index small child chunks for
  precision, return large parent chunks for context) is often more impactful than
  changing the chunking algorithm. LlamaIndex hierarchy defaults `[2048, 512, 128]`;
  default node `chunk_size` 1024.
  [LlamaIndex repo](https://github.com/run-llama/llama_index)
- 🟡 **Vendor starting points:** Azure **512 tokens / 25% overlap**
  ([Azure chunking](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents));
  AWS Bedrock offers fixed/hierarchical/semantic
  ([AWS kb-chunking](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-chunking.html));
  Google Vertex offers layout-based chunking. (Specific numbers are snippet-level — verify.)
- 🟡 **Index types:** HNSW is the de-facto default (fast, high recall, memory-heavy);
  IVF is lower-memory and friendlier to filtered search but needs tuning.
  [Milvus HNSW vs IVF](https://milvus.io/blog/understanding-ivf-vector-index-how-It-works-and-when-to-choose-it-over-hnsw.md)
- 🟡 **Metadata filtering** shrinks the search space and is the basis of multi-tenant
  / permission isolation; strict filters can hurt recall on IVF.
  [Pinecone metadata filtering](https://docs.pinecone.io/guides/search/filter-by-metadata) ·
  [Pinecone Research, ICML 2025](https://www.pinecone.io/research/accurate-and-efficient-metadata-filtering-in-pinecones-serverless-vector-database/)

## 3. GraphRAG vs vector — decide by query shape, not hype

- 🟢 **GraphRAG targets global sensemaking / multi-hop** ("what are the main themes
  in the corpus?"). Naive vector RAG only sees top-k similar chunks and "fails" or
  gives "misleading answers" on these — Microsoft's own framing.
  [MS Research — From Local to Global](https://www.microsoft.com/en-us/research/publication/from-local-to-global-a-graph-rag-approach-to-query-focused-summarization/) ·
  [GraphRAG GitHub blog](https://www.microsoft.com/en-us/research/blog/graphrag-new-tool-for-complex-data-discovery-now-on-github/)
- 🟢 **The cost is real.** Full GraphRAG's LLM-heavy indexing is "prohibitive" for
  some use cases — which is *why Microsoft built LazyGraphRAG*, whose indexing cost
  is "identical to vector RAG and 0.1% of full GraphRAG," with ">700x lower" global
  query cost.
  [LazyGraphRAG (2024-11)](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/)
  - 🔴 The viral "$10,000→$10" / "$33,000 to index" dollar figures are **not** in the
    primary pages — treat as secondary embellishment.
- 🟢 **Incremental updates are GraphRAG's pain point** (interlinked entities → rebuilds).
  LightRAG's set-merge update and HippoRAG 2's lighter offline indexing exist to
  address exactly this.
  [LightRAG repo](https://github.com/HKUDS/LightRAG) ·
  [HippoRAG 2 repo](https://github.com/OSU-NLP-Group/HippoRAG)
- 🔴 **Balanced independent finding** (arxiv, snippet-only): vector wins single-hop /
  specific-document (~54% vs 35%), graph wins multi-hop / aggregation, **hybrid wins
  overall**.
  [Vector/Graph/Hybrid benchmark](https://arxiv.org/abs/2507.03608)
- ⚠️ Neo4j's "3x accuracy" / GraphRAG Manifesto is **vendor marketing** — qualitative only.
  [Neo4j manifesto](https://neo4j.com/blog/genai/graphrag-manifesto/)

## 4. Permission-aware retrieval — where enterprises leak

- 🟢 **OWASP rule:** "Enforce access control checks at retrieval time, not just at
  ingestion time" and "before content reaches the model." Root cause: chunking /
  embedding strips source ACLs, so permissions must be (i) carried into chunk
  metadata, (ii) re-enforced at retrieval, (iii) re-synced when source perms change.
  [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
- 🟢 Two industry models:
  1. **Token-validated, source-synced ACLs at query time** — Azure native
     document-level ACLs (via `x-ms-query-source-authorization`)
     [Azure doc-level access](https://learn.microsoft.com/en-us/azure/search/search-document-level-access-overview);
     Google Vertex `acl_info`; M365 Copilot inheriting Graph permissions; Glean
     enforcing source ACLs at both index and query time.
  2. **Application-supplied metadata filters** — AWS Bedrock puts owner/role/tenant
     in chunk metadata and passes a per-request `filter`
     [AWS metadata-filtering ACL](https://aws.amazon.com/blogs/machine-learning/access-control-for-vector-stores-using-metadata-filtering-with-knowledge-bases-for-amazon-bedrock/).
     (Model 2 puts the burden of getting the filter right on the application.)
- 🟢 **Embeddings are not anonymous** — vulnerable to inversion / membership
  inference (OWASP LLM08). Multi-tenant needs namespace isolation; caches must be
  scoped by access rights.
  [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

## 5. Freshness & incremental indexing

- 🟢 **High-water-mark incremental sync.** Azure indexers track a high-water mark and
  resume; for SQL use `SqlIntegratedChangeTrackingPolicy` (detects deletes) —
  `HighWaterMark` misses deletes (use soft-delete).
  [Azure indexers](https://learn.microsoft.com/en-us/azure/search/search-how-to-create-indexers) ·
  [Azure SQL indexing](https://learn.microsoft.com/en-us/azure/search/search-how-to-index-sql-database)
- 🟡 AWS Bedrock crawls new/modified/deleted content per sync; Glean uses webhooks /
  incremental crawl and reflects permission changes.
  [Glean connectors](https://docs.glean.com/connectors/connectors-power-glean)

## 6. Evaluation & correction

- 🟢 **LLM-as-judge triads.** RAGAS: faithfulness / answer relevancy / context
  precision / recall. TruLens "RAG Triad": context relevance + groundedness +
  answer relevance.
  [RAGAS metrics](https://docs.ragas.io/en/v0.1.21/concepts/metrics/) ·
  [TruLens RAG Triad](https://www.trulens.org/getting_started/core_concepts/rag_triad/).
  Azure, Databricks, OpenAI all ship evaluators + golden-dataset workflows.
- 🟢 **CRAG benchmark (Meta) calibrates difficulty:** top LLMs ≤34% bare, ~44% with
  simple RAG, best industry systems 63% hallucination-free.
  [CRAG benchmark, arxiv 2406.04744](https://arxiv.org/abs/2406.04744)
  (figures from abstract; "4,409 pairs" unverified from primary).
- 🟢 **Corrective RAG** = lightweight retrieval evaluator → Correct (refine) /
  Incorrect (web search) / Ambiguous (both); plug-and-play over an existing pipeline.
  [Corrective RAG, arxiv 2401.15884](https://arxiv.org/abs/2401.15884) ·
  [repo](https://github.com/HuskyInSalt/CRAG)
- 🟡 End-to-end reference architectures:
  [AWS Bedrock KB](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html) ·
  [Azure RAG overview](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview) ·
  [Google Vertex AI RAG Engine](https://cloud.google.com/blog/products/ai-machine-learning/introducing-vertex-ai-rag-engine) ·
  [Databricks Mosaic Agent](https://www.databricks.com/blog/announcing-mosaic-ai-agent-framework-and-agent-evaluation)

---

## Note on "CRAG" — two different things

There are two unrelated things abbreviated "CRAG":

- **Corrective RAG** (a *method*, arxiv 2401.15884) — the corrective grade→rewrite
  loop this portfolio's `rag/graph.ts` implements.
- **Comprehensive RAG Benchmark** (a *dataset*, Meta KDD Cup 2024, arxiv 2406.04744).

Papers comparing structured retrieval (e.g. SAG / GraphRAG / HippoRAG) typically use
the *benchmark*, on multi-hop datasets (HotpotQA, 2WikiMultiHop, MuSiQue) — a
different axis from the corrective-loop *method*. Don't conflate the two when
reading comparison tables.
