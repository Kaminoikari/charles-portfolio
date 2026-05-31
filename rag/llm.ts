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

// Gemini factory — used directly by grade/rewrite, and as tier 1 of generate.
export function gemini(temperature = 0): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    model: config.geminiModel,
    temperature,
    apiKey: geminiKey(),
  })
}

// Anthropic factory — tier 2 (paid fallback) of generate only.
function claude(strong: boolean, temperature: number): ChatAnthropic {
  return new ChatAnthropic({
    model: strong ? config.modelStrong : config.modelFast,
    temperature,
  })
}

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
    const res = await gemini(temperature).invoke(messages)
    return { text: String(res.content), provider: 'gemini' }
  } catch (err) {
    console.warn('Gemini generation failed, falling back to Claude:', (err as Error).message)
    const res = await claude(opts.strong ?? false, temperature).invoke(messages)
    return { text: String(res.content), provider: 'claude' }
  }
}

// Re-export the structured-output type helper shape used by grade.
export type { BaseChatModel }
