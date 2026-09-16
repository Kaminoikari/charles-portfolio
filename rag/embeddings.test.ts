// Unit tests for the query-embedding cache. No secrets / network:
//   npm run rag:test
//
// One visitor message embeds the same string at least twice: triage embeds it to
// probe the FAQ cache, and — on a miss — retrieve embeds it again for the dense
// arm (nodes.ts). Each call is a round trip to Voyage on the request hot path,
// billed, and covered by a 10s timeout that is the single largest latency risk
// in the pipeline. The second one answers a question the first already answered.
//
// The cache is deliberately per-instance and small. It is a within-request (and,
// on a warm Vercel instance, within-session) memo, not a store: correctness can
// never depend on a hit, because the instance is frozen on return and may be
// discarded at any time.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { embedOne, __resetQueryCache } from './embeddings.js'
import { config } from './config.js'

const counting = (vec = [0.1, 0.2]) => {
  let calls = 0
  return {
    calls: () => calls,
    deps: {
      embed: async (texts: string[]) => {
        calls += texts.length
        return texts.map(() => vec)
      },
    },
  }
}

test('embedOne: the same query is embedded once, not once per node', async () => {
  __resetQueryCache()
  const c = counting()
  const first = await embedOne('what does he do at USPACE?', 'query', c.deps)
  const second = await embedOne('what does he do at USPACE?', 'query', c.deps)
  assert.deepEqual(second, first)
  assert.equal(c.calls(), 1)
})

test('embedOne: different queries are not conflated', async () => {
  __resetQueryCache()
  const c = counting()
  await embedOne('question one', 'query', c.deps)
  await embedOne('question two', 'query', c.deps)
  assert.equal(c.calls(), 2)
})

test('embedOne: a document embedding is never served from the query cache', async () => {
  // Asymmetric encoding: Voyage returns a DIFFERENT vector for the same text
  // depending on input_type. Sharing one cache across both would hand the
  // indexer a query-encoded vector and silently degrade the whole index.
  __resetQueryCache()
  const c = counting()
  await embedOne('same text', 'query', c.deps)
  await embedOne('same text', 'document', c.deps)
  assert.equal(c.calls(), 2)
})

test('embedOne: the cache is bounded and evicts the oldest entry', async () => {
  __resetQueryCache()
  const c = counting()
  for (let i = 0; i < config.queryCacheMax + 1; i++) await embedOne(`q${i}`, 'query', c.deps)
  const before = c.calls()
  await embedOne('q0', 'query', c.deps) // evicted by the overflow above
  assert.equal(c.calls(), before + 1)
  await embedOne(`q${config.queryCacheMax}`, 'query', c.deps) // the newest, still resident
  assert.equal(c.calls(), before + 1)
})

test('embedOne: a failed embed is not cached as a result', async () => {
  __resetQueryCache()
  let calls = 0
  const flaky = {
    embed: async (texts: string[]) => {
      calls++
      if (calls === 1) throw new Error('voyage 503')
      return texts.map(() => [0.3])
    },
  }
  await assert.rejects(embedOne('q', 'query', flaky))
  assert.deepEqual(await embedOne('q', 'query', flaky), [0.3])
})
