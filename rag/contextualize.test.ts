// Unit tests for the conversation-memory no-op path. The LLM rewrite itself
// needs Gemini and is covered by the live pipeline; here we lock in the
// zero-cost guarantee that matters for every first turn:
//   no history  →  the question is returned unchanged, with NO model call.
//   npx tsx --test rag/contextualize.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { contextualizeQuestion } from './contextualize.js'

test('contextualizeQuestion: empty history is a no-op (no model call)', async () => {
  // If this touched the LLM it would throw/hang here (no GEMINI_API_KEY in CI).
  assert.equal(await contextualizeQuestion('他在 USPACE 做了什麼?', []), '他在 USPACE 做了什麼?')
  assert.equal(
    await contextualizeQuestion('What did Charles build?', undefined as never),
    'What did Charles build?',
  )
})
