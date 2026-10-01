// The calibration sweep on synthetic observations. No network:
//   npx tsx --test rag/evals/faq-calibration.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  evaluate,
  recommend,
  sweep,
  confusionKey,
  collectionDrift,
  THRESHOLDS,
  MARGINS,
  type Observation,
} from './faq-calibration.js'
import { flatten, toPoint } from '../ingest/build-faq-cache.js'
import { faqEntries } from '../faq-cache.js'

const pt = (faq_id: string, score: number) => ({ score, payload: { faq_id, answer: `a:${faq_id}` } })

const obs = (expected: string, dense: ReturnType<typeof pt>[], lexicalIds: string[] = []): Observation => ({
  expected,
  locale: 'en',
  question: `q:${expected}`,
  dense,
  lexicalIds,
})

// A clear hit, a near tie that picks the wrong entry, and a lone paraphrase
// whose nearest neighbour is another entry entirely.
const SET: Observation[] = [
  obs('nueip', [pt('nueip', 0.92), pt('nueip', 0.9), pt('pxpay', 0.75)]),
  obs('nueip', [pt('pxpay', 0.84), pt('nueip', 0.83)]),
  obs('contact', [pt('hiring', 0.78), pt('availability', 0.6)]),
]

test('a serve that names another entry is counted wrong, and listed', () => {
  const o = evaluate(SET, { threshold: 0.7, margin: 0 }, false)
  assert.equal(o.correct, 1)
  assert.equal(o.wrong, 2)
  assert.deepEqual(
    o.confusions.map((c) => `${c.expected}->${c.served}`),
    ['nueip->pxpay', 'contact->hiring'],
  )
})

test('the margin removes the near tie and nothing else', () => {
  const o = evaluate(SET, { threshold: 0.7, margin: 0.02 }, false)
  assert.equal(o.correct, 1)
  assert.equal(o.wrong, 1)
})

test('the sweep applies the lexical veto when asked, and only then', () => {
  const vetoed = [obs('contact', [pt('hiring', 0.9)], ['contact'])]
  assert.equal(evaluate(vetoed, { threshold: 0.7, margin: 0 }, true).served, 0)
  assert.equal(evaluate(vetoed, { threshold: 0.7, margin: 0 }, false).wrong, 1)
})

test('the recommendation is the setting with no wrong serves that serves the most correct ones', () => {
  const rec = recommend(sweep(SET, false))
  assert.ok(rec)
  assert.equal(rec.wrong, 0)
  assert.equal(rec.correct, 1)
  // Ties go to the strictest setting that still serves as many, which for this
  // set (one clear hit at 0.92, 0.17 ahead) is the strictest in the grid.
  assert.equal(rec.threshold, THRESHOLDS.at(-1))
  assert.equal(rec.margin, MARGINS.at(-1))
})

test('no recommendation when every setting serves a wrong answer', () => {
  const hopeless = [obs('a', [pt('b', 0.99)])]
  assert.equal(recommend(sweep(hopeless, false)), null)
})

test('a wrong serve the judge read as answering the question is not harmful; an unjudged one is', () => {
  const near = obs('nueip', [pt('pxpay', 0.84), pt('nueip', 0.7)])
  const key = confusionKey({ locale: 'en', question: 'q:nueip', served: 'pxpay' })
  assert.equal(evaluate([near], { threshold: 0.7, margin: 0 }, false, new Map([[key, true]])).harmful, 0)
  assert.equal(evaluate([near], { threshold: 0.7, margin: 0 }, false, new Map([[key, false]])).harmful, 1)
  assert.equal(evaluate([near], { threshold: 0.7, margin: 0 }, false, new Map()).harmful, 1)
  assert.equal(evaluate([near], { threshold: 0.7, margin: 0 }, false).harmful, null)
})

test('with verdicts, the recommendation weighs harm, not every wrong serve', () => {
  // The near tie serves the wrong entry but answers the question, so the most
  // permissive safe setting is the one that keeps it.
  const near = obs('nueip', [pt('pxpay', 0.84), pt('nueip', 0.83)])
  const responsive = new Map([[confusionKey({ locale: 'en', question: 'q:nueip', served: 'pxpay' }), true]])
  const rec = recommend(sweep([SET[0], near], false, responsive))
  assert.equal(rec?.served, 2)
  assert.equal(rec?.harmful, 0)
  assert.equal(recommend(sweep([SET[0], near], false))?.served, 1)
})

test('a question the deterministic tier answers first is counted nowhere', () => {
  const triaged = { ...obs('no-data-redirect', [pt('overall-summary', 0.9)]), triaged: true }
  const o = evaluate([triaged], { threshold: 0.7, margin: 0 }, false)
  assert.equal(o.served, 0)
  assert.equal(o.wrong, 0)
})

test('the harm budget is a share of what a setting serves', () => {
  // 1 harmful in 120 served is under 1%; the same one harmful in 50 is not.
  const clear = (n: number) => Array.from({ length: n }, (_, i) => obs(`e${i}`, [pt(`e${i}`, 0.95)]))
  const bad = obs('x', [pt('y', 0.95)])
  assert.equal(recommend(sweep([...clear(119), bad], false))?.served, 120)
  assert.equal(recommend(sweep([...clear(49), bad], false)), null)
})

test('a scratch collection that is not the FAQ being calibrated is named, both ways', () => {
  // 2026-10-01: the build refused to prune 109 stale points (RAG_PRUNE_MAX), and
  // the sweep measured the merged FAQ against the entries it had just removed,
  // reporting serves of overall-summary from a cache with no such entry.
  const entries = [
    { id: 'a', questions: { en: ['q1', 'q2'], 'zh-TW': [], ja: [] }, answers: { en: '', 'zh-TW': '', ja: '' } },
  ]
  const point = (faq_id: string, question: string) => ({ faq_id, locale: 'en', question })
  assert.deepEqual(collectionDrift([point('a', 'q1'), point('a', 'q2')], entries), { stale: [], missing: [] })
  assert.deepEqual(collectionDrift([point('a', 'q1'), point('gone', 'q3')], entries), {
    stale: ['en gone: q3'],
    missing: ['en a: q2'],
  })
})

test('the points the FAQ build writes are exactly what the drift check expects', () => {
  // Writer and reader name the same three payload fields; a rename on either side
  // would make every point read as stale.
  const payloads = flatten(faqEntries, []).map((r) => toPoint(r, []).payload)
  assert.deepEqual(collectionDrift(payloads, faqEntries), { stale: [], missing: [] })
  assert.equal(collectionDrift(payloads.slice(1), faqEntries).missing.length, 1)
})
