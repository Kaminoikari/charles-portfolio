// LLM provider layer — two-tier generation with cost-aware routing.
//
//   grade / rewrite (internal steps)  → Gemini free tier only (no fallback)
//   generate (the user-facing answer) → Gemini free tier, falling back to
//                                       Anthropic Claude on ANY Gemini failure
//
// Rationale: keep the paid Claude budget for the answer the visitor actually
// reads; let the cheap internal steps ride entirely on Gemini's free tier. This
// mirrors how real products tier model spend (free-first, paid as backstop).

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatAnthropic } from '@langchain/anthropic'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseMessageLike } from '@langchain/core/messages'

import { config } from './config.js'

const geminiKey = () => process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? ''

// LangChain chat models retry 6× with exponential backoff by default. On Gemini
// free-tier 429s that means a single call can hang 30s+, and one RAG request
// makes several — which blows past Vercel's function timeout (the 504s seen in
// prod). We want fail-fast: one quick attempt, then move on / fall back.
const MAX_RETRIES = 0

// Wrap any model promise in a hard timeout so a single slow/limited provider
// can never stall the whole request. Rejects (doesn't hang) past the deadline.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ])
}

// Per-CHUNK deadline for a streaming model, NOT a total-completion deadline. The
// timer is reset on every chunk, so a healthy stream that keeps producing tokens
// is allowed to run to completion (broad questions legitimately need far longer
// than any single fail-fast window), while a provider that hangs or is quota-
// limited — producing no first token, or stalling mid-stream — still fails over
// fast. A total-time race here used to kill Gemini mid-stream on every long
// answer, wasting the work and always paying for the Claude fallback.
export async function* withStallTimeout<T>(
  stream: AsyncIterable<T>,
  ms: number,
  label: string,
): AsyncGenerator<T> {
  const it = stream[Symbol.asyncIterator]()
  try {
    for (;;) {
      const res = await Promise.race([
        it.next(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} stalled (no token in ${ms}ms)`)), ms),
        ),
      ])
      if (res.done) return
      yield res.value
    }
  } finally {
    // Cancel the upstream stream on timeout/early-exit so the provider connection
    // is not left dangling for the rest of the serverless invocation.
    await it.return?.()
  }
}

// Gemini factory — used directly by grade/rewrite, and as tier 1 of generate.
export function gemini(temperature = 0): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: config.geminiModel,
    temperature,
    apiKey: geminiKey(),
    maxRetries: MAX_RETRIES,
  })
}

// Anthropic factory — tier 2 (paid fallback) of generate only.
//
// Deliberately NO prompt caching here. Anthropic prompt caching pays off for
// high-frequency apps that resend a large, fixed prompt prefix within the 5-min
// cache TTL. This bot is the opposite: Claude is only the tier-2 fallback (most
// requests are answered by the FAQ cache, triage, or Gemini and never reach
// Claude at all), portfolio traffic is sparse (consecutive Claude calls are
// almost always > 5 min apart, so a cached prefix expires before the next hit),
// and the system prefix is below Opus's 4096-token cache minimum. Adding
// cache_control here would mostly just incur the 1.25x write premium with ~0
// reads. Cost is controlled upstream (FAQ cache + Gemini free tier) instead.
function claude(strong: boolean, temperature: number): ChatAnthropic {
  return new ChatAnthropic({
    model: strong ? config.modelStrong : config.modelFast,
    temperature,
    maxRetries: MAX_RETRIES,
  })
}

// Per-call deadlines (ms). GEMINI_STALL_MS is a per-chunk stall window (see
// withStallTimeout), not a cap on total generation — a steadily streaming answer
// runs to completion regardless of length, staying under the 60s function limit.
// CLAUDE_TIMEOUT_MS is a total-completion cap on the .invoke fallback.
const GEMINI_STALL_MS = Number.parseInt(process.env.RAG_GEMINI_TIMEOUT_MS ?? '8000', 10)
const CLAUDE_TIMEOUT_MS = Number.parseInt(process.env.RAG_CLAUDE_TIMEOUT_MS ?? '15000', 10)

export interface GenerateResult {
  text: string
  provider: 'gemini' | 'claude'
}

// Tier-1 → tier-2 fallback for the final answer. Tries Gemini; on ANY error
// (quota 429, timeout, 5xx, malformed) falls back to Claude so the visitor
// never sees a generation failure. `strong` picks Sonnet over Haiku for the
// fallback when the question is broad/synthetic.
export async function generateWithFallback(
  messages: BaseMessageLike[],
  opts: { strong?: boolean; temperature?: number } = {},
): Promise<GenerateResult> {
  const temperature = opts.temperature ?? 0.2
  try {
    // Stream the free tier so the deadline guards token cadence, not total
    // length: a long but healthy answer finishes on Gemini instead of being
    // killed mid-stream and re-generated (and re-billed) on Claude.
    const stream = await gemini(temperature).stream(messages)
    let text = ''
    for await (const chunk of withStallTimeout(stream, GEMINI_STALL_MS, 'Gemini')) {
      if (typeof chunk.content === 'string') text += chunk.content
    }
    if (!text.trim()) throw new Error('Gemini produced no output')
    return { text, provider: 'gemini' }
  } catch (err) {
    console.warn('Gemini generation failed, falling back to Claude:', (err as Error).message)
    const res = await withTimeout(
      claude(opts.strong ?? false, temperature).invoke(messages),
      CLAUDE_TIMEOUT_MS,
      'Claude',
    )
    return { text: String(res.content), provider: 'claude' }
  }
}

// Re-export the structured-output type helper shape used by grade.
export type { BaseChatModel }
