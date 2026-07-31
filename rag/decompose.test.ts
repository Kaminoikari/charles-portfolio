// Unit tests for the multi-question gate. The decomposition LLM itself needs
// Gemini and is exercised by the live pipeline; here we lock in the two
// cost-critical guarantees:
//   - the heuristic gate is precise (no false positives on single questions)
//   - a single question is a no-op with NO model call
//   npx tsx --test rag/decompose.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { looksMultiQuestion, decomposeQuestion } from './decompose.js'
import type { Tier, Tiers } from './llm.js'

test('looksMultiQuestion: fires on 2+ question marks or enumeration only', () => {
  // Single question — must NOT fire (would waste an LLM call).
  assert.equal(looksMultiQuestion('他在 USPACE 做什麼?'), false)
  assert.equal(looksMultiQuestion('介紹一下 Product Playbook'), false)
  assert.equal(looksMultiQuestion('What did Charles build at USPACE?'), false)
  // A compound clause with one '?' is deliberately treated as single.
  assert.equal(looksMultiQuestion('介紹他的背景和產品風格?'), false)

  // Genuine multi-question — fires.
  assert.equal(looksMultiQuestion('他做什麼?他的風格是?為什麼該錄取他?'), true)
  assert.equal(looksMultiQuestion('What did he build? And why does it matter?'), true)
  assert.equal(looksMultiQuestion('請回答:1. 他的背景 2. 他的專案 3. 他的技能'), true)
  assert.equal(looksMultiQuestion('1、他做什麼 2、他的風格'), true)
})

test('decomposeQuestion: single question is a no-op (no model call)', async () => {
  // No GEMINI_API_KEY in CI — reaching the LLM would throw/hang, failing here.
  assert.deepEqual(await decomposeQuestion('介紹一下 Product Playbook'), [])
  assert.deepEqual(await decomposeQuestion('他在 USPACE 做什麼?'), [])
})

// A tier that fails the way a quota-exhausted Gemini does, and one that answers.
const failing = (message: string): Tier => ({
  invoke: () => Promise.reject(new Error(message)),
  withStructuredOutput: () => ({ invoke: () => Promise.reject(new Error(message)) }),
})
const answering = (structured: unknown): Tier => ({
  invoke: () => Promise.resolve({ content: '' }),
  withStructuredOutput: <T>() => ({ invoke: () => Promise.resolve(structured as T) }),
})
const tiers = (primary: Tier, fallback: Tier): Tiers => ({
  primary: () => primary,
  fallback: () => fallback,
})

const MULTI = '他做什麼?他的風格是?'

test('decomposeQuestion: falls back to Claude when Gemini is quota-exhausted', async () => {
  const parts = ['Charles 做什麼?', 'Charles 的產品風格是什麼?']
  const out = await decomposeQuestion(
    MULTI,
    tiers(failing('[429] quota exceeded'), answering({ questions: parts })),
  )
  assert.deepEqual(out, parts)
})

test('decomposeQuestion: both tiers down falls back to the single-question path', async () => {
  const out = await decomposeQuestion(MULTI, tiers(failing('gemini 429'), failing('claude 529')))
  assert.deepEqual(out, [])
})
