// Unit tests for the recall regression gate. No secrets / network:
//   npm run rag:test
//
// The ingest rebuilds the production index on every content push to main, with
// nothing between the push and a live retrieval change. The gate is what turns
// that into a checked deploy, so the gate itself is the piece that must not be
// quietly wrong: a comparison that never fires looks exactly like a healthy run.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { recallFailures, recallGate, byCategory, aggregate, scoreFaithfulness } from './run-eval.js'
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
    { category: 'near-miss', recall: 0.5, correctness: null, n: 2 },
    { category: 'single-fact', recall: 1, correctness: null, n: 1 },
  ])
})

test('byCategory: correctness is split out too, because recall cannot see a near-miss', () => {
  // The whole point of the near-miss pairs, and the live run proved it: the
  // sibling's chunk IS a relevant id, so retrieving the wrong one of the pair
  // scores full recall while the answer states the other company's number.
  // Correctness is the only column where that shows, so a table without it
  // cannot report on the category it was added for.
  const out = byCategory([
    { category: 'near-miss', recall: 1, correctness: 1 },
    { category: 'near-miss', recall: 1, correctness: 0 },
    { category: 'single-fact', recall: 1, correctness: 1 },
  ])
  assert.deepEqual(out, [
    { category: 'near-miss', recall: 1, correctness: 0.5, n: 2 },
    { category: 'single-fact', recall: 1, correctness: 1, n: 1 },
  ])
})

test('byCategory: an arm that generates no answer reports no correctness, not zero', () => {
  // The retrieval arms never generate, so they have nothing to be correct about.
  // Averaging their absent correctness as 0 would print three arms failing every
  // category next to the one arm that actually answered. The `global` row here
  // carries no correctness at all — a category that has one cannot tell an empty
  // average from a real one, which is why this needs both shapes.
  const out = byCategory([
    { category: 'global', recall: 1 },
    { category: 'single-fact', recall: 0, correctness: 1 },
  ])
  assert.deepEqual(out, [
    { category: 'global', recall: 1, correctness: null, n: 1 },
    { category: 'single-fact', recall: 0, correctness: 1, n: 1 },
  ])
})

test('aggregate: the headline correctness and the category column come from one field', () => {
  // Nothing pinned that runArm actually hands correctness to byCategory: the
  // function was unit-tested, the wiring was not, and dropping `correctness` from
  // the record it pushes left every test green while the column silently read
  // "—" for the only arm that answers. Deriving both numbers from one per-item
  // record is what makes that unexpressible, and this is the assertion that says
  // so: they move together or not at all.
  const agg = aggregate([
    { category: 'near-miss', recall: 1, mrr: 1, correctness: 0 },
    { category: 'near-miss', recall: 1, mrr: 1, correctness: 1 },
  ])
  assert.equal(agg.correctness, 0.5)
  assert.equal(agg.categories[0].correctness, 0.5)
  assert.equal(agg.n, 2)
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

// --- faithfulness is scored only where there was something to judge ----------
// See judge.test.ts for why. The mapping lives here because the runner is what
// turns a verdict into a datum, and `undefined` is what aggregate() already
// treats as "this arm produced no such score" for correctness.

test('scoreFaithfulness: an unjudged verdict is absent, not a pass', () => {
  assert.equal(scoreFaithfulness({ judged: false, reason: 'no context' }), undefined)
})

test('scoreFaithfulness: a judged verdict scores 1 or 0', () => {
  assert.equal(scoreFaithfulness({ judged: true, grounded: true, reason: 'ok' }), 1)
  assert.equal(scoreFaithfulness({ judged: true, grounded: false, reason: 'invented' }), 0)
})

test('aggregate: cached answers do not lift faithfulness by being unjudgeable', () => {
  // Three runs the judge could read, one of them unfaithful, plus two that were
  // served from the FAQ cache and carry no context. The honest figure is 2/3.
  // Counting the cache hits as passes would report 4/5 and would rise further
  // every time the cache answered more often.
  const item = (faithfulness?: number) => ({ category: 'single-fact' as const, recall: 1, mrr: 1, faithfulness })
  const agg = aggregate([item(1), item(0), item(1), item(undefined), item(undefined)])
  assert.equal(agg.faithfulness, 2 / 3)
  assert.equal(agg.n, 5, 'the cached runs still count as runs everywhere else')
})
