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

// Race a single iterator step against a deadline, clearing the timer either way
// so a settled step never leaves a dangling timeout holding the event loop.
function raceStep<T>(
  step: Promise<IteratorResult<T>>,
  ms: number,
  message: string,
): Promise<IteratorResult<T>> {
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([step.finally(() => clearTimeout(timer)), deadline])
}

// Consume a streamed chat response under a FIRST-TOKEN gate.
//
// The fallback decision is made before anything is shown to the user, which is
// the streaming-UX invariant we want: a provider switch must never replace text
// already on screen.
//
//   Phase 1 (gate): wait for the first NON-EMPTY token within firstTokenMs.
//     If none arrives — quota/hang/empty — THROW. Nothing has been streamed to
//     the client yet, so the caller can fall back to Claude with zero perceived
//     switch. We cancel the stream so a late token can't leak out afterwards.
//   Phase 2 (committed): a visible token has been emitted, so we never swap it
//     out. A later stall or error ends the stream with the partial answer (best
//     effort) instead of throwing — falling back here would replace on-screen
//     text, the exact artifact we are avoiding.
export async function consumeGated(
  stream: AsyncIterable<{ content: unknown }>,
  opts: { firstTokenMs: number; stallMs: number; label: string },
): Promise<string> {
  const it = stream[Symbol.asyncIterator]()
  const asText = (chunk: { content: unknown }): string =>
    typeof chunk?.content === 'string' ? chunk.content : ''
  let text = ''

  // Phase 1 — first-token gate. Throwing is safe: nothing visible emitted yet.
  try {
    for (;;) {
      const r = await raceStep(it.next(), opts.firstTokenMs, `${opts.label} produced no first token in ${opts.firstTokenMs}ms`)
      if (r.done) throw new Error(`${opts.label} produced no output`)
      const t = asText(r.value)
      if (t) {
        text = t
        break
      }
    }
  } catch (err) {
    await it.return?.()
    throw err
  }

  // Phase 2 — committed to this provider. Stall/error ends with partial text.
  try {
    for (;;) {
      const r = await raceStep(it.next(), opts.stallMs, `${opts.label} stalled (no token in ${opts.stallMs}ms)`)
      if (r.done) break
      text += asText(r.value)
    }
  } catch (err) {
    console.warn(`${opts.label} stalled after first token, returning partial answer:`, (err as Error).message)
  } finally {
    await it.return?.()
  }
  return text
}

// Gemini factory — used directly by grade/rewrite, and as tier 1 of generate.
//
// Eval-only escape hatch: with RAG_FORCE_CLAUDE=1 this returns Claude, so the
// eval suite runs every step (grade/rewrite/generate) on Claude and never hits
// Gemini's free-tier 5-req/min quota. Production leaves the flag unset and keeps
// the Gemini-first cost cascade unchanged.
export function gemini(temperature = 0): BaseChatModel {
  if (process.env.RAG_FORCE_CLAUDE === '1') return claude(false, temperature)
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

// Per-call deadlines (ms). Both Gemini windows are per-chunk, not caps on total
// generation — a steadily streaming answer runs to completion regardless of
// length, staying under the 60s function limit. GEMINI_FIRST_TOKEN_MS gates the
// fallback-to-Claude decision (time to the first visible token); GEMINI_STALL_MS
// bounds an inter-token gap AFTER the stream has committed (ends with the partial
// answer, never falls back). CLAUDE_TIMEOUT_MS caps the .invoke fallback.
const GEMINI_FIRST_TOKEN_MS = Number.parseInt(process.env.RAG_GEMINI_TIMEOUT_MS ?? '8000', 10)
const GEMINI_STALL_MS = Number.parseInt(process.env.RAG_GEMINI_STALL_MS ?? '8000', 10)
const CLAUDE_TIMEOUT_MS = Number.parseInt(process.env.RAG_CLAUDE_TIMEOUT_MS ?? '15000', 10)

export interface GenerateResult {
  text: string
  provider: 'gemini' | 'claude'
}

// Tier-1 → tier-2 fallback for the final answer, under a first-token gate.
//
// Gemini streams the answer. The fallback to Claude only fires while Gemini has
// shown nothing yet (no first token within the gate, a quota/5xx/empty error) —
// so the visitor never sees one answer get replaced by another. Once Gemini
// emits a visible token we commit to it; a later stall ends with the partial
// answer rather than swapping providers. `strong` picks Sonnet over Haiku for
// the fallback when the question is broad/synthetic.
export async function generateWithFallback(
  messages: BaseMessageLike[],
  opts: { strong?: boolean; temperature?: number } = {},
): Promise<GenerateResult> {
  const temperature = opts.temperature ?? 0.2
  try {
    const stream = await gemini(temperature).stream(messages)
    const text = await consumeGated(stream, {
      firstTokenMs: GEMINI_FIRST_TOKEN_MS,
      stallMs: GEMINI_STALL_MS,
      label: 'Gemini',
    })
    return { text, provider: 'gemini' }
  } catch (err) {
    console.warn('Gemini generation failed before first token, falling back to Claude:', (err as Error).message)
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
