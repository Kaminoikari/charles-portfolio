// Unit tests for the recall regression gate. No secrets / network:
//   npm run rag:test
//
// The ingest rebuilds the production index on every content push to main, with
// nothing between the push and a live retrieval change. The gate is what turns
// that into a checked deploy, so the gate itself is the piece that must not be
// quietly wrong: a comparison that never fires looks exactly like a healthy run.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { recallFailures, recallGate, byCategory } from './run-eval.js'
import { GOLDEN } from './golden.js'

const rows = [
  { arm: 'dense-only', recall: 1 },
  { arm: 'hybrid', recall: 0.92 },
  { arm: 'hybrid+rerank', recall: 0.8 },
]

test('recallFailures: names every arm under the floor', () => {
  assert.deepEqual(recallFailures(rows, 0.95).map((r) => r.arm), ['hybrid', 'hybrid+rerank'])
})

test('recallFailures: a healthy run reports nothing', () => {
  assert.deepEqual(recallFailures(rows, 0.75), [])
})

test('recallFailures: the floor is inclusive, so an arm exactly at it passes', () => {
  // Otherwise a floor set to the current measurement fails on the very run that
  // established it, and whoever hits that will lower the floor rather than debug.
  assert.deepEqual(recallFailures([{ arm: 'hybrid', recall: 0.92 }], 0.92), [])
})

test('recallGate: a run where no arm executed is a failure, not a pass', () => {
  // The predicate alone cannot tell "everything passed" from "nothing ran": both
  // produce an empty failure list. An arm table emptied by a bad --arm or a
  // missing key would otherwise read as a clean gate.
  assert.deepEqual(recallGate([], 0.95), { ok: false, reason: 'no-arms-ran' })
})

test('recallGate: an arm under the floor fails and names itself', () => {
  const v = recallGate(rows, 0.95)
  assert.equal(v.ok, false)
  assert.deepEqual(v.ok === false && v.reason === 'below-floor' ? v.failures.map((f) => f.arm) : null, [
    'hybrid',
    'hybrid+rerank',
  ])
})

test('recallGate: a healthy run passes', () => {
  assert.deepEqual(recallGate(rows, 0.75), { ok: true })
})

test('byCategory: averages within a category and reports how many items it saw', () => {
  const out = byCategory([
    { category: 'near-miss', recall: 1 },
    { category: 'near-miss', recall: 0 },
    { category: 'single-fact', recall: 1 },
  ])
  assert.deepEqual(out, [
    { category: 'near-miss', recall: 0.5, n: 2 },
    { category: 'single-fact', recall: 1, n: 1 },
  ])
})

test('byCategory: a category that collapses does not hide inside the overall mean', () => {
  // The reason the split exists. Twelve items at full recall and four at zero
  // averages to 75% overall, which reads as a bad day; the category table names
  // which four, and they are the ones whose siblings are being returned instead.
  const items = [
    ...Array.from({ length: 12 }, () => ({ category: 'single-fact' as const, recall: 1 })),
    ...Array.from({ length: 4 }, () => ({ category: 'near-miss' as const, recall: 0 })),
  ]
  const overall = items.reduce((a, b) => a + b.recall, 0) / items.length
  assert.equal(overall, 0.75)
  assert.equal(byCategory(items).find((c) => c.category === 'near-miss')?.recall, 0)
})

test('byCategory: the golden set really has near-miss items to measure', () => {
  // The column is only worth a table if something populates it.
  assert.ok(GOLDEN.filter((g) => g.category === 'near-miss').length >= 4)
})
