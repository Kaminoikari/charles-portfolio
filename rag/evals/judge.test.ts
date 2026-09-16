// What the faithfulness judge does when there is nothing to judge. Offline, no
// network: the case under test is the one that short-circuits before the model
// call.
//   npm run rag:test
//
// This used to score 1. A FAQ cache hit, a canned decline and an outage notice
// all reach the visitor with no retrieved context, and calling that "vacuously
// faithful" put them in the mean as passes. The effect is a headline that moves
// with the cache hit rate rather than with quality: turning the FAQ lexical veto
// on sent five more questions to generation, free passes fell 28 → 23, and the
// reported faithfulness fell 91.9% → 85.4% without a single answer getting
// worse. A metric that drops when the system improves is worse than no metric.
//
// So an unjudged run is now absent from the mean rather than a pass in it, and
// the verdict says which it is in the type, so a caller cannot read `grounded`
// off a verdict that never had one.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { judgeFaithfulness } from './judge.js'

test('judgeFaithfulness: an answer with no retrieved context is not judged', async () => {
  const verdict = await judgeFaithfulness('Charles led the parking product.', '')
  assert.equal(verdict.judged, false)
})

test('judgeFaithfulness: whitespace is not context either', async () => {
  const verdict = await judgeFaithfulness('anything', '  \n  ')
  assert.equal(verdict.judged, false)
})
