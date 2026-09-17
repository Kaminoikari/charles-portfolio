// LLM provider layer — two-tier generation with cost-aware routing.
//
//   contextualize / grade / rewrite / → Gemini free tier, falling back to
//   decompose (internal steps)          Claude Haiku (see withTierFallback)
//   generate + converse (the answers  → Gemini free tier, falling back to
//   a visitor reads)                    Claude under a first-token gate
//                                       (generateWithFallback). Sonnet serves a
//                                       broad generate; everything else Haiku.
//
// Rationale: Gemini's free tier is the first choice everywhere, so a normal day
// costs nothing. What it is NOT is a single point of failure: that tier is
// capped at 20 requests/day, and ordinary traffic exhausts it, at which point
// every step above would otherwise degrade to its no-op at once. The internal
// steps each degrade quietly (grade waves the docs through, rewrite keeps the
// query, decompose stops fanning out, contextualize forgets the conversation),
// so the visitor gets a worse answer with nothing on screen explaining why.
// Haiku costs a fraction of a cent per call and keeps that from happening.
//
// The paid tier is a backstop, never the default: it is only reached after
// Gemini has actually failed, and the FAQ cache and triage still answer most
// questions before any of this runs.

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
//
// `stalled` reports which of the two Phase-2 exits happened, because the partial
// answer does not stop at the screen: it is persisted to chat_logs and replayed
// as history on the following turn, where the model meets its own unfinished
// sentence. On 2026-08-19 an unmarked ragged edge in exactly that position was
// read as evidence of a failed send and explained to the visitor as one. A
// caller that knows can say what happened; a caller handed a bare string cannot.
export interface GatedResult {
  text: string
  /** True when Phase 2 ended on the stall deadline rather than end-of-stream. */
  stalled: boolean
}

export async function consumeGated(
  stream: AsyncIterable<{ content: unknown }>,
  opts: { firstTokenMs: number; stallMs: number; label: string },
): Promise<GatedResult> {
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
  let stalled = false
  try {
    for (;;) {
      const r = await raceStep(it.next(), opts.stallMs, `${opts.label} stalled (no token in ${opts.stallMs}ms)`)
      if (r.done) break
      text += asText(r.value)
    }
  } catch (err) {
    stalled = true
    console.warn(`${opts.label} stalled after first token, returning partial answer:`, (err as Error).message)
  } finally {
    await it.return?.()
  }
  return { text, stalled }
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

// Anthropic factory — the paid tier wherever one is reached: generate and
// converse through generateWithFallback, and every internal step through
// `claudeFast` below.
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

// Per-call deadlines (ms). Every window here is per-chunk, not a cap on total
// generation — a steadily streaming answer runs to completion regardless of
// length, staying under the 60s function limit. *_FIRST_TOKEN_MS gates the
// decision to give up on that tier (time to the first visible token);
// *_STALL_MS bounds an inter-token gap AFTER the stream has committed (ends
// with the partial answer, never falls back).
//
// Claude used to be asked with a plain invoke under a 15s cap on the WHOLE
// answer, which made the deadline a function of answer length: on 2026-09-17,
// with Gemini's free tier exhausted, a 1,184-character answer finished in
// 14.8s and the same question a minute earlier died on the cap. Streaming it
// under the same gate as Gemini removes length from the equation.
//
// The old RAG_CLAUDE_TIMEOUT_MS is gone rather than aliased: the deadline it
// reported in production on 2026-09-17 was 15000ms, the default, so nothing
// anywhere was overriding it and a compatibility branch would guard nothing.
const GEMINI_FIRST_TOKEN_MS = Number.parseInt(process.env.RAG_GEMINI_TIMEOUT_MS ?? '8000', 10)
const GEMINI_STALL_MS = Number.parseInt(process.env.RAG_GEMINI_STALL_MS ?? '8000', 10)
const CLAUDE_FIRST_TOKEN_MS = Number.parseInt(process.env.RAG_CLAUDE_FIRST_TOKEN_MS ?? '15000', 10)
const CLAUDE_STALL_MS = Number.parseInt(process.env.RAG_CLAUDE_STALL_MS ?? '8000', 10)

export interface GenerateResult {
  text: string
  provider: 'gemini' | 'claude'
  /**
   * The answer stopped arriving rather than finishing. Either tier can report
   * it: both are streamed under the same gate. See GatedResult for why it
   * travels with the text.
   */
  stalled: boolean
}

// Tier-1 → tier-2 fallback for the final answer, under a first-token gate.
//
// Gemini streams the answer. The fallback to Claude only fires while Gemini has
// shown nothing yet (no first token within the gate, a quota/5xx/empty error) —
// so the visitor never sees one answer get replaced by another. Once Gemini
// emits a visible token we commit to it; a later stall ends with the partial
// answer rather than swapping providers. `strong` picks Sonnet over Haiku for
// the fallback when the question is broad/synthetic.
//
// Claude is streamed through the same gate. It is the last tier, so its gate
// has nothing left to fall back to and a breach fails the request; what it buys
// is that a long answer can no longer breach it by being long. Its tokens also
// reach the visitor as they arrive, because graph.ts forwards every
// on_chat_model_stream chunk the generate node produces.
//
// Both nodes that write an answer the visitor reads come through here: generate
// and, since converse was moved off its whole-reply invoke, converse. Only
// generate's tokens are forwarded to the browser; graph.ts matches on the node
// name, and converse's reply is short enough that it arrives with `done`.
// The slice of a tier this function uses: one streaming call. Structural, and
// injectable for the same reason `Tier` is — the tier-to-caller wiring needs a
// test of its own. Without one, a stub generator injected at the node layer
// (resolveGenerator) skips this function entirely, and dropping the stall signal
// here would be invisible: exactly the gap that let the ceilings in nodes.ts go
// unpinned until a review caught them.
export interface StreamTier {
  stream(messages: BaseMessageLike[]): Promise<AsyncIterable<{ content: unknown }>>
}

export async function generateWithFallback(
  messages: BaseMessageLike[],
  opts: { strong?: boolean; temperature?: number } = {},
  primary: (temperature: number) => StreamTier = gemini,
  fallback: (strong: boolean, temperature: number) => StreamTier = claude,
): Promise<GenerateResult> {
  const temperature = opts.temperature ?? 0.2
  try {
    const stream = await primary(temperature).stream(messages)
    const { text, stalled } = await consumeGated(stream, {
      firstTokenMs: GEMINI_FIRST_TOKEN_MS,
      stallMs: GEMINI_STALL_MS,
      label: 'Gemini',
    })
    return { text, provider: 'gemini', stalled }
  } catch (err) {
    console.warn('Gemini generation failed before first token, falling back to Claude:', (err as Error).message)
    const stream = await fallback(opts.strong ?? false, temperature).stream(messages)
    const { text, stalled } = await consumeGated(stream, {
      firstTokenMs: CLAUDE_FIRST_TOKEN_MS,
      stallMs: CLAUDE_STALL_MS,
      label: 'Claude',
    })
    return { text, provider: 'claude', stalled }
  }
}

// The slice of a chat model the non-streaming internal steps actually use: a
// plain invoke (contextualize, rewrite) and the structured-output wrapper
// (grade, decompose). Structural rather than `BaseChatModel` so tests can inject
// a stub tier — same spirit as buildGraph's stub nodes.
export interface Tier {
  invoke(messages: BaseMessageLike[]): Promise<{ content: unknown }>
  withStructuredOutput<T>(
    schema: unknown,
    config?: { name?: string },
  ): { invoke(messages: BaseMessageLike[]): Promise<T> }
}

export interface Tiers {
  primary: (temperature: number) => Tier
  fallback: (temperature: number) => Tier
}

// LangGraph invokes a node as `node(state, config)`, so any node that accepts
// injected tiers in its second parameter receives that RunnableConfig in
// production instead. The mistake is invisible from the outside — a config in
// place of tiers throws inside the try and the node degrades to its no-op, the
// same result it would give if the provider were simply down — so the second
// slot is read through this guard rather than trusted.
export type Generator = typeof generateWithFallback

// Same guard as resolveTiers, for the generate node's injectable generator: the
// RunnableConfig LangGraph passes is an object, never a function, so it can
// never be mistaken for one.
export function resolveGenerator(candidate: unknown): Generator {
  return typeof candidate === 'function' ? (candidate as Generator) : generateWithFallback
}

export function resolveTiers(candidate: unknown): Tiers {
  const t = candidate as Partial<Tiers> | null | undefined
  return typeof t?.primary === 'function' && typeof t?.fallback === 'function'
    ? (t as Tiers)
    : DEFAULT_TIERS
}

// Default tiering for a small internal step: free Gemini first, paid Haiku as
// the backstop. `claudeFast` is deliberately Haiku — these steps grade or
// rewrite one short string, so Sonnet's quality would buy nothing.
const claudeFast = (temperature: number): Tier => claude(false, temperature)
export const DEFAULT_TIERS: Tiers = { primary: gemini, fallback: claudeFast }

// Non-streaming tier-1 → tier-2 fallback for a small internal step (the
// streaming, first-token-gated equivalent is generateWithFallback above).
// `call` receives the tier and does whatever that step needs with it, so the
// same cascade serves plain invokes and structured output alike.
//
// Both tiers get their own `timeoutMs`, so the worst case is bounded at twice
// that — acceptable here because the failure that motivated this (a 429 with
// MAX_RETRIES=0) rejects immediately rather than burning the deadline. THROWS
// when both tiers fail; the caller decides what degrading gracefully means.
// `fallbackCall` overrides how the paid tier is asked, for steps where the two
// providers need different mechanics. grade uses it: inside the graph every
// model call is streamed, and a streamed forced tool call reached Anthropic's
// parser with empty args in production, so its backstop asks for text instead
// of structured output.
export async function withTierFallback<T>(
  call: (tier: Tier) => Promise<T>,
  opts: {
    timeoutMs: number
    label: string
    temperature?: number
    fallbackCall?: (tier: Tier) => Promise<T>
  },
  tiers: Tiers = DEFAULT_TIERS,
): Promise<T> {
  const temperature = opts.temperature ?? 0
  // Constructing the tier is inside the try on purpose: a missing or malformed
  // API key throws right here, and that must degrade like any other provider
  // failure instead of escaping as an unhandled error from the node.
  try {
    return await withTimeout(call(tiers.primary(temperature)), opts.timeoutMs, `${opts.label} (Gemini)`)
  } catch (err) {
    console.warn(`${opts.label}: Gemini failed, falling back to Claude:`, (err as Error).message)
    const onFallback = opts.fallbackCall ?? call
    return await withTimeout(
      onFallback(tiers.fallback(temperature)),
      opts.timeoutMs,
      `${opts.label} (Claude)`,
    )
  }
}

// Text-answer convenience wrapper over withTierFallback.
export async function invokeWithFallback(
  messages: BaseMessageLike[],
  opts: { timeoutMs: number; label: string; temperature?: number },
  tiers: Tiers = DEFAULT_TIERS,
): Promise<string> {
  const res = await withTierFallback((tier) => tier.invoke(messages), opts, tiers)
  return String(res.content)
}

// Re-export the structured-output type helper shape used by grade.
export type { BaseChatModel }
