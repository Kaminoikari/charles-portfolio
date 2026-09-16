// Unit tests for the deterministic eval metrics. No secrets needed:
//   npx tsx --test rag/evals/metrics.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { recallAtK, reciprocalRank, correctness, declinesAnswer, DECLINE_MARKERS } from './metrics.js'
import { personalRedirect, genericFallback, serviceUnavailable } from '../triage.js'

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

// --- what counts as a decline -------------------------------------------
// The out-of-corpus category read 0% correctness on every run since it was
// added, and nobody could see it until correctness was split per category on
// 2026-09-16. The cause: DECLINE_MARKERS is a transcribed phrase list, and its
// own comment claimed "the fallback node and a faithful generate both produce
// one of these" while genericFallback matched none of them. Triage's personal
// redirect, which is what actually answers these four questions, matched none
// either. So a perfect, in-character decline scored as a leak.

test('declinesAnswer: triage\'s personal redirect is a decline, in every locale', () => {
  for (const locale of ['en', 'zh-TW', 'ja'] as const) {
    assert.equal(declinesAnswer(personalRedirect(locale)), true, locale)
  }
})

test('declinesAnswer: the corpus-gap reply is a decline, in every locale', () => {
  for (const locale of ['en', 'zh-TW', 'ja'] as const) {
    assert.equal(declinesAnswer(genericFallback(locale)), true, locale)
  }
})

test('declinesAnswer: an outage reply is NOT a decline', () => {
  // "I could not look" says nothing about whether the portfolio covers the
  // question. Counting it would let a total retrieval failure score as perfect
  // out-of-corpus handling — the one run shape where every answer is that reply.
  for (const locale of ['en', 'zh-TW', 'ja'] as const) {
    assert.equal(declinesAnswer(serviceUnavailable(locale)), false, locale)
  }
})

test('the outage copy carries no generated-decline wording, which is what makes the guard idle', () => {
  // Deleting the outage guard in declinesAnswer leaves this file green, because
  // today's copy matches no phrase in DECLINE_MARKERS and so falls through to
  // the same answer. The guard is not pointless — it is one rewording away from
  // load-bearing, and the wordings are close: en says "I can't look that up"
  // where "could not find" would match, zh says 查不到 where 找不到 would, ja
  // says 調べられない where わかりません would. This pins the premise instead, so
  // an edit to that copy fails here and names the guard that then starts
  // carrying the rule, rather than silently scoring an outage as a clean
  // decline.
  for (const locale of ['en', 'zh-TW', 'ja'] as const) {
    const copy = serviceUnavailable(locale).toLowerCase()
    const matched = DECLINE_MARKERS.filter((m) => copy.includes(m))
    assert.deepEqual(matched, [], `the ${locale} outage reply now reads as a decline: ${matched.join(', ')}`)
  }
})

test('declinesAnswer: a generated decline still counts, and a real answer does not', () => {
  assert.equal(declinesAnswer("I couldn't find anything about that in the portfolio."), true)
  assert.equal(declinesAnswer('He led a 15-person team at USPACE.'), false)
})

test('correctness: a mustDecline item is scored by the same rule', () => {
  assert.equal(correctness(personalRedirect('en'), { mustDecline: true }), 1)
  assert.equal(correctness(serviceUnavailable('en'), { mustDecline: true }), 0)
})
