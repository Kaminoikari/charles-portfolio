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
import { todayISO } from '../nodes.js'

test('judgeFaithfulness: an answer with no retrieved context is not judged', async () => {
  const verdict = await judgeFaithfulness('Charles led the parking product.', '')
  assert.equal(verdict.judged, false)
})

test('judgeFaithfulness: whitespace is not context either', async () => {
  const verdict = await judgeFaithfulness('anything', '  \n  ')
  assert.equal(verdict.judged, false)
})

// ── what the judge is told, and what happens when it cannot be read ───────
// The model is faked at the network boundary; everything from the messages it
// receives to the verdict is the real code.

type Messages = { role: string; content: string }[]
const fakeModel = (out: { grounded: boolean; reason: string }) => {
  const seen: Messages[] = []
  return { seen, invoke: async (messages: Messages) => (seen.push(messages), out) }
}

test('judgeFaithfulness: the verdict is the model\'s, with its reason', async () => {
  const no = await judgeFaithfulness('answer', 'context', fakeModel({ grounded: false, reason: 'invented feature' }))
  assert.deepEqual(no, { judged: true, grounded: false, reason: 'invented feature' })
  const yes = await judgeFaithfulness('answer', 'context', fakeModel({ grounded: true, reason: 'ok' }))
  assert.deepEqual(yes, { judged: true, grounded: true, reason: 'ok' })
})

// Run 36857502362 judged `concurrent-roles` ungrounded for "Head of Product since
// August 2026", calling it a future date: the judge was never told what day it
// is, while the generator is (nodes.ts todayISO).
test('judgeFaithfulness: the judge is told the date it is judging on', async () => {
  const model = fakeModel({ grounded: true, reason: 'ok' })
  // Not today's date, so a judge that ignores the injected one is caught.
  await judgeFaithfulness('answer', 'context', { invoke: model.invoke, today: '2031-02-03' })
  assert.match(model.seen[0].map((m) => m.content).join('\n'), /2031-02-03/)
})

test('judgeFaithfulness: without an injected date it uses the same clock as the generator', async () => {
  const model = fakeModel({ grounded: true, reason: 'ok' })
  const before = todayISO()
  await judgeFaithfulness('answer', 'context', { invoke: model.invoke })
  const after = todayISO()
  const text = model.seen[0].map((m) => m.content).join('\n')
  assert.ok(text.includes(before) || text.includes(after), 'no date in the judge prompt')
})

test('judgeFaithfulness: the answer and the context both reach the model', async () => {
  const model = fakeModel({ grounded: true, reason: 'ok' })
  await judgeFaithfulness('THE-ANSWER', 'THE-CONTEXT', { invoke: model.invoke })
  const text = model.seen[0].map((m) => m.content).join('\n')
  assert.match(text, /THE-ANSWER/)
  assert.match(text, /THE-CONTEXT/)
})

// Run 36867749603 died on one verdict the structured-output parser could not
// read, and the eval lost every result after it.
test('judgeFaithfulness: a judge that cannot be read leaves the run unjudged instead of ending the eval', async () => {
  const model = { invoke: async () => { throw new Error('Failed to parse') } }
  const verdict = await judgeFaithfulness('answer', 'context', model)
  assert.equal(verdict.judged, false)
  assert.match(verdict.reason, /judge failed: Failed to parse/)
})
