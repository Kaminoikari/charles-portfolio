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

import { judgeFaithfulness, unsupportedClaims } from './judge.js'
import { todayISO } from '../nodes.js'

test('judgeFaithfulness: an answer with no retrieved context is not judged', async () => {
  const verdict = await judgeFaithfulness('Charles led the parking product.', '')
  assert.equal(verdict.judged, false)
})

test('judgeFaithfulness: whitespace is not context either', async () => {
  const verdict = await judgeFaithfulness('anything', '  \n  ')
  assert.equal(verdict.judged, false)
})

// ── the verdict is the list, not a boolean beside it ──────────────────────
// Run 36857502362 judged `before-pxpay` ungrounded with the reason "these are
// equivalent, so this is actually grounded": the model filled a boolean and a
// sentence independently, and they disagreed. The judge now names the claims
// the context does not support, and the verdict is whether that list is empty,
// so the two cannot disagree. The model is faked here, at the network boundary;
// everything from the messages it receives to the verdict is the real code.

type Messages = { role: string; content: string }[]
const fakeModel = (out: { unsupported: string[]; reason: string }) => {
  const seen: Messages[] = []
  return { seen, invoke: async (messages: Messages) => (seen.push(messages), out) }
}

test('judgeFaithfulness: no unsupported claims is grounded, whatever the reason sentence says', async () => {
  const model = fakeModel({ unsupported: [], reason: 'not grounded' })
  const verdict = await judgeFaithfulness('answer', 'context', { invoke: model.invoke })
  assert.deepEqual(verdict.judged && verdict.grounded, true)
})

test('judgeFaithfulness: a listed claim is ungrounded, and the claim is in the reason', async () => {
  const model = fakeModel({ unsupported: ['Plutus has an appeal feature'], reason: 'one invented feature' })
  const verdict = await judgeFaithfulness('answer', 'context', { invoke: model.invoke })
  assert.equal(verdict.judged && verdict.grounded, false)
  assert.match(verdict.reason, /appeal feature/)
})

test('judgeFaithfulness: blank entries in the list are not claims', async () => {
  const model = fakeModel({ unsupported: ['', '  '], reason: 'all supported' })
  const verdict = await judgeFaithfulness('answer', 'context', { invoke: model.invoke })
  assert.equal(verdict.judged && verdict.grounded, true)
})

// Run 36857502362 also judged `concurrent-roles` ungrounded for "Head of Product
// since August 2026", calling it a future date: the judge was never told what
// day it is, while the generator is (nodes.ts todayISO).
test('judgeFaithfulness: the judge is told the date it is judging on', async () => {
  const model = fakeModel({ unsupported: [], reason: 'ok' })
  // Not today's date, so a judge that ignores the injected one is caught.
  await judgeFaithfulness('answer', 'context', { invoke: model.invoke, today: '2031-02-03' })
  assert.match(model.seen[0].map((m) => m.content).join('\n'), /2031-02-03/)
})

test('judgeFaithfulness: without an injected date it uses the same clock as the generator', async () => {
  const model = fakeModel({ unsupported: [], reason: 'ok' })
  const before = todayISO()
  await judgeFaithfulness('answer', 'context', { invoke: model.invoke })
  const after = todayISO()
  const text = model.seen[0].map((m) => m.content).join('\n')
  assert.ok(text.includes(before) || text.includes(after), 'no date in the judge prompt')
})

test('judgeFaithfulness: the answer and the context both reach the model', async () => {
  const model = fakeModel({ unsupported: [], reason: 'ok' })
  await judgeFaithfulness('THE-ANSWER', 'THE-CONTEXT', { invoke: model.invoke })
  const text = model.seen[0].map((m) => m.content).join('\n')
  assert.match(text, /THE-ANSWER/)
  assert.match(text, /THE-CONTEXT/)
})

// Run 36867749603 died on the first ungrounded answer: the model put its one
// claim in `unsupported` as a string, not a list, the structured-output parser
// threw, and the whole eval stopped with nothing reported. A string is read as
// claims; any other failure leaves that one run unjudged and says so.
test('unsupportedClaims: a list, a JSON-encoded list, a bare string and an empty string', () => {
  assert.deepEqual(unsupportedClaims(['a', ' ', 'b']), ['a', 'b'])
  assert.deepEqual(unsupportedClaims('["a","b"]'), ['a', 'b'])
  assert.deepEqual(unsupportedClaims('[]'), [])
  assert.deepEqual(unsupportedClaims('  '), [])
  const malformed = '["corporate travel" as three separate core product lines]'
  assert.deepEqual(unsupportedClaims(malformed), [malformed])
  assert.deepEqual(unsupportedClaims('[1, 2]'), ['[1, 2]'])
})

test('judgeFaithfulness: a string from the model is still a verdict', async () => {
  const model = { invoke: async () => ({ unsupported: 'Plutus has an appeal feature', reason: 'r' }) }
  const verdict = await judgeFaithfulness('answer', 'context', model)
  assert.equal(verdict.judged && verdict.grounded, false)
})

test('judgeFaithfulness: a judge that cannot be read leaves the run unjudged instead of ending the eval', async () => {
  const model = { invoke: async () => { throw new Error('Failed to parse') } }
  const verdict = await judgeFaithfulness('answer', 'context', model)
  assert.equal(verdict.judged, false)
  assert.match(verdict.reason, /judge failed: Failed to parse/)
})
