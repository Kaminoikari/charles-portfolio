// Evaluation metrics. The retrieval metrics (recall@k, MRR) are pure functions
// of ids — deterministic, unit-testable with no secrets. The answer metrics
// (faithfulness, correctness) are computed by the runner: faithfulness via an
// LLM judge, correctness via the golden item's mustInclude/mustDecline rules.

import { personalRedirect, genericFallback, serviceUnavailable } from '../triage.js'

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
  if (rules.mustDecline) {
    return declinesAnswer(answer) ? 1 : 0
  }
  const a = answer.toLowerCase()
  if (rules.mustInclude && rules.mustInclude.length > 0) {
    return rules.mustInclude.every((s) => a.includes(s.toLowerCase())) ? 1 : 0
  }
  return 1
}

// Wordings that count as an honest decline when the answer was GENERATED. The
// deterministic replies are not in this list and must not be: they are taken
// from the functions that produce them, just below.
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

// The deterministic declines, taken from the functions that emit them instead of
// transcribed into the list above. Transcription is what went stale: that list's
// own comment claimed the fallback node produced one of its phrases, and
// genericFallback matched none. Triage's personal redirect, which is what
// actually answers the out-of-corpus items, matched none either — so the
// category read 0% correctness for as long as it existed, and the per-category
// correctness table was what finally showed it.
const DECLINE_LOCALES = ['en', 'zh-TW', 'ja'] as const
const cannedDeclines = () =>
  DECLINE_LOCALES.flatMap((l) => [personalRedirect(l), genericFallback(l)])
const outageReplies = () => DECLINE_LOCALES.map((l) => serviceUnavailable(l))

// Why an item scored 0, in the form the eval log prints. The corrective arm used
// to print nothing per item, so a category resting at 66% could only be
// explained by re-deriving the failures by hand — and the explanation turned out
// to be about the RULES, not the answers: a mustInclude of one English word is
// checked against answers generated in three languages, so 「結果重於產出」, a
// correct rendering of "outcomes over outputs", scores as wrong.
export function correctnessMiss(
  answer: string,
  rules: CorrectnessRules,
  judged: boolean | null = null,
): string | null {
  if (rules.mustDecline) return declinesAnswer(answer) ? null : 'did not decline'
  const reasons: string[] = []
  if (rules.mustInclude?.length) {
    const a = answer.toLowerCase()
    const absent = rules.mustInclude.filter((sub) => !a.includes(sub.toLowerCase()))
    if (absent.length > 0) reasons.push(`missing: ${absent.join(', ')}`)
  }
  if (rules.mustState && judged === false) reasons.push('claim not stated')
  return reasons.length > 0 ? reasons.join('; ') : null
}

export interface CorrectnessRules {
  mustInclude?: string[]
  mustState?: string
  mustDecline?: boolean
}

// The whole correctness verdict: the deterministic rules AND the judged claim.
//
// `judged` is REQUIRED rather than optional, and an item carrying a mustState
// refuses to be scored without one. Every injection seam in this eval has broken
// at least once by being declared and never called — the retrieve node's deps,
// the per-category correctness, the decline check — and each time the symptom
// was a number that looked plausible. Forgetting the judge call here would score
// every claim-bearing item 1 and read as correctness improving.
export function scoreCorrectness(
  answer: string,
  rules: CorrectnessRules,
  judged: boolean | null,
): number {
  if (rules.mustState && judged === null) {
    throw new Error(`a judged verdict is required for an item with mustState: ${rules.mustState}`)
  }
  if (rules.mustDecline) return declinesAnswer(answer) ? 1 : 0
  if (rules.mustState && judged === false) return 0
  return correctness(answer, rules)
}

// Did the answer honestly say the portfolio does not cover this?
export function declinesAnswer(answer: string): boolean {
  const a = answer.trim()
  // An outage is not a decline. "I could not look" says nothing about whether
  // the portfolio covers the question, and the run where every retrieval failed
  // is the run where EVERY answer is that reply — scoring it as a decline would
  // report a total outage as perfect out-of-corpus handling.
  if (outageReplies().some((r) => a === r.trim())) return false
  if (cannedDeclines().some((r) => a === r.trim())) return true
  const lower = a.toLowerCase()
  return DECLINE_MARKERS.some((m) => lower.includes(m))
}

export interface Aggregate {
  recall: number
  mrr: number
  correctness: number
  faithfulness: number
  n: number
  // Recall AND correctness split by golden-set category. The mean alone hides
  // the case this whole split exists for: a near-miss item is answerable, so
  // retrieving its SIBLING still counts as a hit and recall stays flat while the
  // index quietly becomes confusable. Which is why correctness is here too —
  // recall cannot see that failure, so a recall-only split could not report on
  // the one category it was added for. Correctness is null for a category no
  // arm answered; the retrieval arms never generate.
  categories: { category: string; recall: number; correctness: number | null; n: number }[]
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}
