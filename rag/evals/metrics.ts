// Evaluation metrics. The retrieval metrics (recall@k, MRR) are pure functions
// of ids — deterministic, unit-testable with no secrets. The answer metrics
// (faithfulness, correctness) are computed by the runner: faithfulness via an
// LLM judge, correctness via the golden item's mustInclude/mustDecline rules.

// recall@k: did at least one relevant chunk surface in the top-k retrieved?
// (Binary per query — averaged across the set it becomes "hit rate", the
// metric that actually matters for a RAG answer: was the evidence present?)
export function recallAtK(retrievedIds: string[], relevantPrefixes: string[]): number {
  if (relevantPrefixes.length === 0) return 1 // out-of-corpus: nothing to recall
  const hit = retrievedIds.some((id) => relevantPrefixes.some((p) => id.startsWith(p)))
  return hit ? 1 : 0
}

// Mean Reciprocal Rank: 1/rank of the FIRST relevant chunk (0 if none). Rewards
// putting the right chunk near the top, which is what the reranker is for.
export function reciprocalRank(retrievedIds: string[], relevantPrefixes: string[]): number {
  if (relevantPrefixes.length === 0) return 1
  for (let i = 0; i < retrievedIds.length; i++) {
    if (relevantPrefixes.some((p) => retrievedIds[i].startsWith(p))) return 1 / (i + 1)
  }
  return 0
}

// Deterministic correctness check from the golden rules:
//   - mustInclude: every listed substring must appear (case-insensitive)
//   - mustDecline: the answer must signal "not in the portfolio"
export function correctness(
  answer: string,
  rules: { mustInclude?: string[]; mustDecline?: boolean },
): number {
  const a = answer.toLowerCase()
  if (rules.mustDecline) {
    return DECLINE_MARKERS.some((m) => a.includes(m)) ? 1 : 0
  }
  if (rules.mustInclude && rules.mustInclude.length > 0) {
    return rules.mustInclude.every((s) => a.includes(s.toLowerCase())) ? 1 : 0
  }
  return 1
}

// Phrases that count as an honest decline, across the three locales. The
// fallback node and a faithful generate both produce one of these.
export const DECLINE_MARKERS = [
  "couldn't find",
  'could not find',
  "don't have",
  'do not have',
  'not in',
  'no information',
  '沒有',
  '找不到',
  '無法',
  'ありません',
  '見つかりません',
  'わかりません',
]

export interface Aggregate {
  recall: number
  mrr: number
  correctness: number
  faithfulness: number
  n: number
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}
