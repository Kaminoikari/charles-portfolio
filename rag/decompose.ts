// Gated question decomposition — the token-efficient form of the frontier
// "decompose → per-question retrieve → synthesize" pattern.
//
// A single compound message ("他做什麼?他的風格是?為什麼該錄取他?") is one string
// to the pipeline: a single retrieval splits its top-k budget across every
// sub-topic, starving the weaker ones. Splitting it into standalone
// sub-questions lets each get its own retrieval (see the fan-out in
// nodes.ts:retrieve), then one grounded generation answers them all with
// citations and honestly disclaims whatever the corpus doesn't cover.
//
// The cost discipline: a CHEAP heuristic gate runs first, so the overwhelming
// majority of traffic (one question) never pays for the decomposition LLM call.
// Only a plausibly-multi message spends one model call (free-tier Gemini, with
// Claude Haiku as the backstop when Gemini's daily quota is gone), and even that
// short-circuits to the single-question path if the split yields < 2 parts.

import { z } from 'zod'

import { config } from './config.js'
import { withTierFallback, DEFAULT_TIERS, type Tiers } from './llm.js'

const TIMEOUT_MS = 6000

// High-precision gate: fire only when the message very likely holds more than one
// question, so a false positive (a wasted LLM call) is rare. Two or more question
// marks, or explicit enumeration, are strong multi-question signals; a plain
// compound clause ("介紹他的背景和專案") is deliberately NOT caught — a single
// retrieval handles those well enough, and catching them would cost calls on the
// common case. Exported for unit testing.
export function looksMultiQuestion(q: string): boolean {
  const marks = (q.match(/[?？]/g) ?? []).length
  if (marks >= 2) return true
  // Enumerated list: "1. … 2. …" / "1、…2、…" (ASCII or full-width digits).
  const enumerated = q.match(/(?:^|[\s(（])[1-9１-９][.．、)）]/g) ?? []
  return enumerated.length >= 2
}

const schema = z.object({
  questions: z
    .array(z.string())
    .describe(
      'Each distinct question the message asks, rewritten as a standalone, ' +
        'self-contained question in the original language.',
    ),
})

// Split a compound message into standalone sub-questions. Returns [] when the
// message is a single question (heuristic gate), when decomposition fails or
// times out, or when the split yields fewer than 2 parts — callers treat that as
// "no fan-out, use the normal single-question path". Never throws.
export async function decomposeQuestion(
  question: string,
  tiers: Tiers = DEFAULT_TIERS,
): Promise<string[]> {
  if (!looksMultiQuestion(question)) return [] // common case — zero added cost

  try {
    const res = await withTierFallback(
      (tier) =>
        tier.withStructuredOutput<{ questions?: unknown }>(schema, { name: 'decompose' }).invoke([
          {
            role: 'system',
            content:
              'Split the user message into the distinct questions it asks. Rewrite ' +
              'each as a standalone, self-contained question in the ORIGINAL ' +
              'language, preserving the asker\'s intent. Do NOT invent questions they ' +
              'did not ask, and do NOT split a single question into pieces. If the ' +
              'message really asks only one thing, return that one question.',
          },
          { role: 'user', content: question },
        ]),
      { timeoutMs: TIMEOUT_MS, label: 'decompose' },
      tiers,
    )
    const qs = res.questions
    if (!Array.isArray(qs)) return []
    const cleaned = qs
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, config.maxSubQuestions)
    return cleaned.length > 1 ? cleaned : []
  } catch (err) {
    console.warn('decompose failed, using single-question path:', (err as Error).message)
    return []
  }
}
