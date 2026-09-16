// Unit tests for the pure merge helper used by multi-question fan-out. The
// retrieval itself needs Qdrant/Voyage and is covered live; this locks in the
// interleave + dedup + cap semantics that keep the merged context lean.
//   npx tsx --test rag/retrieval.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Document } from '@langchain/core/documents'
import { DEFAULT_RETRIEVAL_DEPS, fetchCandidates, mergeInterleaved, retrieveWith } from './retrieval.js'
import { rerank } from './embeddings.js'

const doc = (id: string) => new Document({ pageContent: id, metadata: { id } })
const ids = (docs: Document[]) => docs.map((d) => d.metadata.id)

test('mergeInterleaved: round-robins across lists and dedups by id', () => {
  const a = [doc('a1'), doc('a2'), doc('shared')]
  const b = [doc('b1'), doc('shared'), doc('b3')]
  // rank0: a1,b1 · rank1: a2, shared · rank2: a's shared (dup→skip), b3
  assert.deepEqual(ids(mergeInterleaved([a, b], 8)), ['a1', 'b1', 'a2', 'shared', 'b3'])
})

test('mergeInterleaved: respects the cap (bounds generation context)', () => {
  const lists = [
    [doc('a1'), doc('a2')],
    [doc('b1'), doc('b2')],
    [doc('c1'), doc('c2')],
  ]
  const merged = mergeInterleaved(lists, 4)
  assert.equal(merged.length, 4)
  assert.deepEqual(ids(merged), ['a1', 'b1', 'c1', 'a2']) // one per list, then next rank
})

test('mergeInterleaved: handles empty and ragged lists', () => {
  assert.deepEqual(mergeInterleaved([], 8), [])
  assert.deepEqual(mergeInterleaved([[], []], 8), [])
  // A sub-question that returned nothing must not stall the others.
  assert.deepEqual(ids(mergeInterleaved([[], [doc('b1'), doc('b2')]], 8)), ['b1', 'b2'])
})

// --- rerank failure degrades to RRF order --------------------------------
// Voyage is the single supplier of BOTH the query embedding and the rerank, and
// each call is one shot (AbortSignal.timeout, maxRetries 0). A rerank outage
// used to take the whole request down: the exception left retrieveWith, left the
// retrieve node (whose single-query path has no catch), and surfaced as a generic
// SSE error — the bot reduced to regex triage while a perfectly good RRF-fused
// candidate set sat one line away in `points`.
//
// The degraded ranking is the same one the `hybrid` ablation arm measures, so
// this is a known-quality fallback, not a guess.

const point = (id: string, sourceType: string, score: number) => ({
  payload: { chunk_id: id, content: id, source_type: sourceType, locale: 'en', title: id, parent_id: null, project_id: null },
  score,
})

test('retrieveWith: a failed rerank degrades to RRF order instead of failing the request', async () => {
  const points = [point('rrf-1', 'blog', 0.9), point('rrf-2', 'blog', 0.8), point('rrf-3', 'blog', 0.7)]
  const docs = await retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
    fetchCandidates: async () => points,
    rerank: async () => {
      throw new Error('voyage 503')
    },
  })
  assert.deepEqual(ids(docs), ['rrf-1', 'rrf-2', 'rrf-3'])
})

test('retrieveWith: a working rerank still decides the order', async () => {
  // Without this, "always ignore the reranker" would pass the test above.
  const points = [point('rrf-1', 'blog', 0.9), point('rrf-2', 'blog', 0.8), point('rrf-3', 'blog', 0.7)]
  const docs = await retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
    fetchCandidates: async () => points,
    rerank: async () => [
      { index: 2, score: 0.99 },
      { index: 0, score: 0.5 },
      { index: 1, score: 0.1 },
    ],
  })
  assert.deepEqual(ids(docs), ['rrf-3', 'rrf-1', 'rrf-2'])
})

test('retrieveWith: the degraded path still applies the first-party boost', async () => {
  // weightAndTrim is what applies it, and the fallback must go through the same
  // trimming the reranked path uses — not a raw `points` passthrough.
  const points = [point('blog-top', 'blog', 0.9), point('curated', 'project', 0.8)]
  const docs = await retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
    fetchCandidates: async () => points,
    rerank: async () => {
      throw new Error('voyage 503')
    },
  })
  assert.deepEqual(ids(docs), ['curated', 'blog-top']) // 0.8 × 1.2 = 0.96 > 0.9
})

// The stubs above never touch Voyage or Qdrant, so they would keep passing if
// the production defaults were swapped for stubs. Pin the wiring itself.
test('retrieveWith: the default deps are the real Voyage and Qdrant calls', () => {
  assert.equal(DEFAULT_RETRIEVAL_DEPS.rerank, rerank)
  assert.equal(DEFAULT_RETRIEVAL_DEPS.fetchCandidates, fetchCandidates)
})

test('retrieveWith: a failed candidate fetch still throws', async () => {
  // The degrade is scoped to the rerank on purpose. With no candidates there is
  // no RRF order to fall back to, and silently returning [] would hand the grade
  // node an empty set — turning a supplier outage into a confident "I have no
  // information about that", which is worse than an error the caller can see.
  await assert.rejects(
    retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
      fetchCandidates: async () => {
        throw new Error('qdrant unreachable')
      },
      rerank: async () => [],
    }),
    /qdrant unreachable/,
  )
})
