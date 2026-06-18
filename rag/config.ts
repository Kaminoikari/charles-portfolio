// Central configuration. Every tunable is one env-overridable setting so that
// "fewer loops in a demo" / "smaller k in CI" never requires a code change.
// (Same central-config discipline used in product-playbook's _config.py.)

const int = (key: string, def: number): number => {
  const v = process.env[key]
  return v === undefined ? def : Number.parseInt(v, 10)
}
const float = (key: string, def: number): number => {
  const v = process.env[key]
  return v === undefined ? def : Number.parseFloat(v)
}
const bool = (key: string, def: boolean): boolean => {
  const v = process.env[key]
  return v === undefined ? def : v === '1' || v === 'true'
}

export const config = {
  // --- retrieval ---
  topK: int('RAG_TOP_K', 6), // final chunks after rerank
  candidateK: int('RAG_CANDIDATE_K', 20), // per-retriever before fusion
  rrfK: int('RAG_RRF_K', 60), // RRF damping constant
  rerankEnabled: bool('RAG_RERANK', true),
  // Bias retrieval toward first-party, curated portfolio content (about /
  // project / experience / skill / changelog) over blog articles, applied as a
  // score multiplier before the final top-k cut. The site's own source-of-truth
  // should outrank tangential blog bodies on the same topic. 1.0 = off.
  firstPartyBoost: float('RAG_FIRST_PARTY_BOOST', 1.2),

  // --- corrective loop ---
  maxLoops: int('RAG_MAX_LOOPS', 2), // query-rewrite attempts
  gradeThreshold: float('RAG_GRADE_THRESHOLD', 0.5),

  // --- models ---
  // Generation is two-tier: Gemini free-tier first, Anthropic as paid fallback.
  // grade/rewrite are internal steps → Gemini only (no fallback) to conserve the
  // paid Claude budget for the user-facing final answer.
  geminiModel: process.env.RAG_GEMINI_MODEL ?? 'gemini-2.5-flash',
  modelFast: process.env.RAG_MODEL_FAST ?? 'claude-haiku-4-5-20251001',
  modelStrong: process.env.RAG_MODEL_STRONG ?? 'claude-sonnet-4-6',
  embedModel: process.env.RAG_EMBED_MODEL ?? 'voyage-3-large',
  rerankModel: process.env.RAG_RERANK_MODEL ?? 'rerank-2.5',
  embedDim: int('RAG_EMBED_DIM', 1024),
  // Sparse model, run server-side by Qdrant Cloud Inference (free tier). BM25 is
  // the free sparse model (SPLADE++ is $0.06/1M tokens); it's true BM25 with
  // server-side IDF — language-agnostic and no 128-token truncation, which suits
  // our multilingual, longer-than-128-token chunks. Swap to
  // 'prithivida/splade-pp-en-v1' for learned sparse (paid; also drop the IDF
  // modifier in qdrant.ts).
  sparseModel: process.env.RAG_SPARSE_MODEL ?? 'qdrant/bm25',

  // --- endpoints (secrets read lazily by clients) ---
  embedBaseUrl: process.env.EMBEDDING_BASE_URL ?? 'https://api.voyageai.com/v1',
  qdrantUrl: process.env.QDRANT_URL ?? '',
  qdrantCollection: process.env.QDRANT_COLLECTION ?? 'doc_chunks',
  qdrantLogsCollection: process.env.QDRANT_LOGS_COLLECTION ?? 'chat_logs',
  qdrantFaqCollection: process.env.QDRANT_FAQ_COLLECTION ?? 'faq_cache',

  // --- blog full-text ---
  // When on, ingest emits body chunks for blog articles whose full text has been
  // cached (rag/ingest/blog-bodies.json) by the fetcher. Off / empty cache → only
  // the title+subtitle chunk is indexed (the prior behaviour), so this is inert
  // until the cache is populated. Bodies are Traditional Chinese; the multilingual
  // dense embedding lets en/ja queries still retrieve them.
  blogBodyEnabled: bool('RAG_BLOG_BODY', true),
  blogChunkChars: int('RAG_BLOG_CHUNK_CHARS', 900),
  blogChunkOverlap: int('RAG_BLOG_CHUNK_OVERLAP', 150),

  // --- semantic FAQ cache ---
  // A query whose embedding is at least this cosine-similar to a pre-written FAQ
  // question is answered from cache with NO generation LLM call. Tuned high so
  // only genuine matches hit; everything else falls through to RAG.
  faqCacheEnabled: bool('RAG_FAQ_CACHE', true),
  faqCacheThreshold: float('RAG_FAQ_THRESHOLD', 0.7),

  // --- behavior ---
  defaultLocale: process.env.RAG_DEFAULT_LOCALE ?? 'en',
} as const
