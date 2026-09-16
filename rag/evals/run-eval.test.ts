// Unit tests for the recall regression gate. No secrets / network:
//   npm run rag:test
//
// The ingest rebuilds the production index on every content push to main, with
// nothing between the push and a live retrieval change. The gate is what turns
// that into a checked deploy, so the gate itself is the piece that must not be
// quietly wrong: a comparison that never fires looks exactly like a healthy run.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { recallFailures, byCategory } from './run-eval.js'
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

test('recallFailures: zero rows produce zero failures, so the caller must catch it', () => {
  // Documents the sharp edge rather than hiding it: the predicate cannot
  // distinguish "nothing ran" from "everything passed", which is why main()
  // rejects an empty row set before consulting it.
  assert.deepEqual(recallFailures([], 0.95), [])
  const source = readFileSync(new URL('./run-eval.ts', import.meta.url), 'utf8')
  assert.match(source, /rows\.length === 0[\s\S]{0,200}process\.exit\(1\)/)
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
