// Unit tests for the FAQ cache's accept/reject rule. No secrets / network:
//   npm run rag:test
//
// The FAQ cache is the only path in the pipeline that reaches the visitor with
// no grounding check at all: a hit returns a hand-written answer without grading,
// without generation, and without sources. A wrong hit is therefore a confident,
// fluent, completely wrong answer the visitor has no way to spot.
//
// That matters because of what the cache holds: hundreds of paraphrases across
// dozens of topics, many of them structurally identical but factually different
// ("what did he do at USPACE" vs "what did he do at NUEIP"). Those sit close
// together in embedding space, so a single global threshold is not enough — two
// candidates can BOTH clear it, and the one that wins by a hair may be the wrong
// topic. The margin rule below is what separates "clearly this topic" from
// "somewhere between two topics", and the second case belongs in RAG, which
// retrieves, grades, and cites.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_FAQ_DEPS, faqLookup } from './qdrant.js'
import { config } from './config.js'

const hit = (faqId: string, score: number) => ({
  score,
  payload: { faq_id: faqId, answer: `answer for ${faqId}`, locale: 'en' },
})

// Drives the real faqLookup; only the Qdrant round-trip is stubbed.
const lookupOver = (points: ReturnType<typeof hit>[], seen?: { body?: Record<string, unknown> }) =>
  faqLookup([0.1, 0.2], 'en', {
    search: async (_collection, body) => {
      if (seen) seen.body = body
      return { points }
    },
  })

test('faqLookup: a clear winner is served from cache', async () => {
  const res = await lookupOver([hit('uspace-role', 0.91), hit('nueip-role', 0.71)])
  assert.equal(res?.id, 'uspace-role')
})

test('faqLookup: two candidates separated by a hair fall through to RAG', async () => {
  // Both clear the 0.7 threshold, so the old single-threshold rule served the
  // first one. Being between two topics is exactly when the cache must not answer.
  const res = await lookupOver([hit('uspace-role', 0.82), hit('nueip-role', 0.81)])
  assert.equal(res, null)
})

test('faqLookup: a lone candidate has nothing to be confused with', async () => {
  const res = await lookupOver([hit('uspace-role', 0.91)])
  assert.equal(res?.id, 'uspace-role')
})

test('faqLookup: a top hit below the threshold is still rejected', async () => {
  const res = await lookupOver([hit('uspace-role', 0.5), hit('nueip-role', 0.1)])
  assert.equal(res, null)
})

test('faqLookup: an empty collection returns null', async () => {
  assert.equal(await lookupOver([]), null)
})

// The margin rule is only reachable if the query actually asks for a runner-up.
// With limit 1 every lookup looks like the lone-candidate case above and the
// rule silently never fires.
test('faqLookup: the query asks Qdrant for a runner-up', async () => {
  const seen: { body?: Record<string, unknown> } = {}
  await lookupOver([hit('uspace-role', 0.91), hit('nueip-role', 0.71)], seen)
  assert.ok((seen.body?.limit as number) >= 2, `limit was ${seen.body?.limit}`)
})

test('faqLookup: the margin is a real threshold, not zero', () => {
  // A zero margin would make the near-tie test above pass only by luck of float
  // comparison, and would ship the rule as a no-op.
  assert.ok(config.faqCacheMargin > 0)
})

// Every test above stubs the round-trip, so all of them would keep passing if
// the production default were quietly replaced by canned points. Pin that the
// default actually reaches a Qdrant client: with no QDRANT_URL configured it
// fails to connect (in milliseconds — no real host is involved), where a stub
// would happily resolve.
test('faqLookup: the default search really goes to Qdrant', async () => {
  await assert.rejects(DEFAULT_FAQ_DEPS.search(config.qdrantFaqCollection, { query: [0.1], limit: 2 }))
})
