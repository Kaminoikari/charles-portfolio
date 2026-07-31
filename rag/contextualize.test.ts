// Unit tests for conversation memory. Two guarantees are locked in here:
//   no history  →  the question is returned unchanged, with NO model call.
//   Gemini down →  the rewrite still happens, on the Claude tier.
// The second one is the whole point of the fallback: Gemini's free tier is
// capped at 20 requests/day, and memory is the only step with no paid backstop,
// so a quota-exhausted Gemini used to silently disable memory for the rest of
// the day. Model tiers are injected (same pattern as graph.test.ts's stub nodes)
// so neither test needs a network call or an API key.
//   npx tsx --test rag/contextualize.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { contextualizeQuestion } from './contextualize.js'
import type { Tier } from './llm.js'

const HISTORY = [
  { role: 'user' as const, content: '介紹一下 Product Playbook' },
  { role: 'assistant' as const, content: 'Product Playbook 是 Charles 做的 Claude Code plugin。' },
]

// A tier that always fails, the way a quota-exhausted Gemini does.
const failing = (message: string): Tier => ({
  invoke: () => Promise.reject(new Error(message)),
  withStructuredOutput: () => ({ invoke: () => Promise.reject(new Error(message)) }),
})
const answering = (content: string): Tier => ({
  invoke: () => Promise.resolve({ content }),
  withStructuredOutput: <T>() => ({ invoke: () => Promise.resolve({} as T) }),
})

test('contextualizeQuestion: empty history is a no-op (no model call)', async () => {
  // If this touched the LLM it would throw/hang here (no GEMINI_API_KEY in CI).
  assert.equal(await contextualizeQuestion('他在 USPACE 做了什麼?', []), '他在 USPACE 做了什麼?')
  assert.equal(
    await contextualizeQuestion('What did Charles build?', undefined as never),
    'What did Charles build?',
  )
})

test('contextualizeQuestion: falls back to Claude when Gemini is quota-exhausted', async () => {
  const rewritten = 'Product Playbook 解決什麼問題?'
  const out = await contextualizeQuestion('那個專案解決什麼問題?', HISTORY, {
    primary: () => failing('[429 Too Many Requests] quota exceeded'),
    fallback: () => answering(rewritten),
  })
  assert.equal(out, rewritten)
})

test('contextualizeQuestion: both tiers down keeps the original question', async () => {
  const original = '那個專案解決什麼問題?'
  const out = await contextualizeQuestion(original, HISTORY, {
    primary: () => failing('gemini 429'),
    fallback: () => failing('claude 529'),
  })
  assert.equal(out, original)
})
