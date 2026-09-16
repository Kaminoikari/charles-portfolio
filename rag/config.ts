// Central configuration. Every tunable is one env-overridable setting so that
// "fewer loops in a demo" / "smaller k in CI" never requires a code change.
// (Same central-config discipline used in product-playbook's _config.py.)

const int = (key: string, def: number): number => {
  const v = process.env[key]
  if (v === undefined) return def
  const n = Number.parseInt(v, 10)
  // A malformed override (e.g. RAG_TOP_K=abc) must fall back to the default, not
  // silently become NaN and poison every comparison/slice downstream.
  return Number.isFinite(n) ? n : def
}
const float = (key: string, def: number): number => {
  const v = process.env[key]
  if (v === undefined) return def
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : def
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

  // --- multi-question fan-out (gated question decomposition) ---
  // A single compound message ("2 題命中 + 1 題 generate + 1 題無資料") is split
  // into standalone sub-questions, retrieved per-question, and merged — the
  // token-efficient form of the frontier "decompose → per-question retrieve →
  // synthesize" pattern. Gated by a cheap heuristic so single questions pay
  // nothing (see decompose.ts).
  maxSubQuestions: int('RAG_MAX_SUBQUESTIONS', 4), // cap the fan-out width
  multiMergeK: int('RAG_MULTI_MERGE_K', 8), // total chunks kept after interleaving

  // --- models ---
  // Every LLM step is two-tier: Gemini free-tier first, Anthropic as the paid
  // backstop (see llm.ts). The internal steps take modelFast (Haiku); only the
  // user-facing answer can escalate to modelStrong.
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

  // --- contextual retrieval (Anthropic-style; ingest-side) ---
  // When on, ingest prepends an LLM-generated situating sentence to each FRAGMENT
  // chunk (blog body slice / project section) before embedding, so a fragment
  // that lost its parent context is still retrievable. OFF by default until the
  // golden-set ablation (rag/evals) proves the lift — a retrieval-quality change
  // must be measured before it ships. Generator is the cheap fast model with
  // prompt caching on the parent doc (rag/ingest/contextualize.ts).
  contextualEnabled: bool('RAG_CONTEXTUAL', false),
  contextModel: process.env.RAG_CONTEXT_MODEL ?? 'claude-haiku-4-5-20251001',

  // --- endpoints (secrets read lazily by clients) ---
  embedBaseUrl: process.env.EMBEDDING_BASE_URL ?? 'https://api.voyageai.com/v1',
  // Hard ceiling on each Voyage embed/rerank fetch. Without it a hung Voyage API
  // would stall triage/retrieve on the request hot path until the platform kills
  // the whole function (severing the SSE stream with no error event, no Claude
  // fallback). Kept well under the 60s Vercel function limit.
  embedTimeoutMs: int('RAG_EMBED_TIMEOUT_MS', 10_000),
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

  // --- incremental ingest ---
  // Mass-delete safety valve for the reconciler's stale-point pass. A normal
  // content edit removes a few chunks; a misconfigured run (e.g. RAG_BLOG_BODY=0
  // against the prod collection) would present hundreds of live points as stale.
  // A delete larger than this is refused unless RAG_PRUNE=1 forces it, so a flag
  // mistake can't silently wipe the index (see rag/ingest/reconcile.ts).
  ingestPruneMax: int('RAG_PRUNE_MAX', 100),

  // --- semantic FAQ cache ---
  // A query whose embedding is at least this cosine-similar to a pre-written FAQ
  // question is answered from cache with NO generation LLM call. Tuned high so
  // only genuine matches hit; everything else falls through to RAG.
  faqCacheEnabled: bool('RAG_FAQ_CACHE', true),
  faqCacheThreshold: float('RAG_FAQ_THRESHOLD', 0.7),
  // How far the best FAQ candidate must beat the runner-up before the cache is
  // allowed to answer without any grounding check. The threshold above asks "is
  // this similar enough"; this asks "is it unambiguously THIS topic", which is
  // the question a corpus of structurally-identical paraphrases across dozens of
  // topics actually raises. Deliberately tight: it should reject near-ties and
  // nothing else, because every rejection costs a cache hit. The faqprobe log
  // line prints top1, top2 and the gap on every lookup, so this can be retuned
  // from the real score distribution rather than from a guess.
  faqCacheMargin: float('RAG_FAQ_MARGIN', 0.02),
  // How many neighbours the lookup fetches to find that runner-up. It is not 2:
  // the cache stores one point per PARAPHRASE, so an entry's own rewordings
  // occupy the first several results whenever it is the right answer. The window
  // has to reach past the widest paraphrase set any single entry has, or the
  // competing TOPIC never enters the comparison and the rule compares an entry
  // against itself. A test in rag/qdrant.test.ts pins this against the real
  // corpus, so growing an entry's paraphrases cannot silently outrun it.
  faqCandidateK: int('RAG_FAQ_CANDIDATE_K', 16),
  // Ask BM25 for a second opinion before serving a cache hit, and decline when
  // the lexical arm does not rank the dense winner at all. The dense arm matches
  // sentence FRAME, so 「Charles 在 NUEIP 做什麼?」 landed on the general career
  // summary rather than the NUEIP entry — the proper noun that is the entire
  // difference between those two questions barely moves a sentence embedding,
  // while it is exactly what IDF weights.
  //
  // ON since 2026-09-16, on the measurement it was gated behind (corrective arm,
  // 123 questions: run 35077918161 off, run 35082510355 on). It fired 5 times,
  // the first two being exactly the known misfires; it removed the wrong answer
  // about NUEIP, introduced no new one, and lifted correctness from 96.7% to
  // 97.6%. The cost is real and it is cache hits: 28 → 23, so about one in six
  // cached answers now pays for a generation instead. That trade is deliberate —
  // a confident wrong answer costs more than a cache miss, which still answers
  // correctly through RAG. Flip it back if generation cost becomes the binding
  // constraint, or if the faqveto log starts naming entries that were right.
  // Requires the FAQ collection to carry sparse vectors.
  faqSparseVeto: bool('RAG_FAQ_SPARSE_VETO', true),
  faqVetoK: int('RAG_FAQ_VETO_K', 5),

  // --- query embedding cache ---
  // A single visitor message is embedded at least twice on the hot path: once by
  // triage to probe the FAQ cache, once by retrieve for the dense arm. Both are
  // the same string with the same input_type, so the second round trip to Voyage
  // buys nothing and costs the one timeout that can stall a request. This bounds
  // the in-process memo; it is a memo and not a store, because a serverless
  // instance is frozen on return and may vanish at any time. Small on purpose:
  // the win is within a request, and anything beyond that is a bonus.
  queryCacheMax: int('RAG_QUERY_CACHE_MAX', 64),

  // --- behavior ---
  defaultLocale: process.env.RAG_DEFAULT_LOCALE ?? 'en',
} as const
