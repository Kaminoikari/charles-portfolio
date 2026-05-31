// Unit tests for the deterministic eval metrics. No secrets needed:
//   npx tsx --test rag/evals/metrics.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { recallAtK, reciprocalRank, correctness } from './metrics.js'

test('recallAtK: hit when a relevant prefix matches', () => {
  assert.equal(recallAtK(['experience:0:en', 'about:ai:1:en'], ['experience:0']), 1)
  assert.equal(recallAtK(['project:path:tech:en'], ['experience:0']), 0)
})

test('recallAtK: out-of-corpus (no relevant ids) always counts as recalled', () => {
  assert.equal(recallAtK(['anything:en'], []), 1)
  assert.equal(recallAtK([], []), 1)
})

test('reciprocalRank: 1/rank of first relevant chunk', () => {
  assert.equal(reciprocalRank(['x:en', 'experience:0:en'], ['experience:0']), 0.5)
  assert.equal(reciprocalRank(['experience:0:en', 'x:en'], ['experience:0']), 1)
  assert.equal(reciprocalRank(['a:en', 'b:en'], ['experience:0']), 0)
})

test('correctness: mustInclude requires every substring (case-insensitive)', () => {
  assert.equal(correctness('He is a Product Manager at USPACE', { mustInclude: ['product manager', 'uspace'] }), 1)
  assert.equal(correctness('He works at USPACE', { mustInclude: ['product manager', 'uspace'] }), 0)
})

test('correctness: mustDecline passes only on a decline marker', () => {
  assert.equal(correctness("I couldn't find that in the portfolio.", { mustDecline: true }), 1)
  assert.equal(correctness('沒有相關資訊', { mustDecline: true }), 1)
  assert.equal(correctness('His salary is $200k', { mustDecline: true }), 0)
})
