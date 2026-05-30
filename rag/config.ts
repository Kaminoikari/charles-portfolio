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

  // --- corrective loop ---
  maxLoops: int('RAG_MAX_LOOPS', 2), // query-rewrite attempts
  gradeThreshold: float('RAG_GRADE_THRESHOLD', 0.5),

  // --- models ---
  modelFast: process.env.RAG_MODEL_FAST ?? 'claude-haiku-4-5-20251001',
  modelStrong: process.env.RAG_MODEL_STRONG ?? 'claude-sonnet-4-6',
  embedModel: process.env.RAG_EMBED_MODEL ?? 'BAAI/bge-m3',
  rerankModel: process.env.RAG_RERANK_MODEL ?? 'BAAI/bge-reranker-v2-m3',
  embedDim: int('RAG_EMBED_DIM', 1024),

  // --- endpoints (secrets read lazily by clients) ---
  embedBaseUrl: process.env.EMBEDDING_BASE_URL ?? 'https://api.siliconflow.cn/v1',
  supabaseUrl: process.env.SUPABASE_URL ?? '',

  // --- behavior ---
  defaultLocale: process.env.RAG_DEFAULT_LOCALE ?? 'en',
} as const
