// Unit tests for the pure merge helper used by multi-question fan-out. The
// retrieval itself needs Qdrant/Voyage and is covered live; this locks in the
// interleave + dedup + cap semantics that keep the merged context lean.
//   npx tsx --test rag/retrieval.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Document } from '@langchain/core/documents'
import {
  DEFAULT_RETRIEVAL,
  DEFAULT_RETRIEVAL_DEPS,
  fetchCandidates,
  mergeInterleaved,
  retrieveWith,
  type Degradation,
} from './retrieval.js'
import { SupplierError, callSupplier, __resetBreakers } from './supplier.js'
import { hybridRetrieve } from './retrieval.js'
import { rerank } from './embeddings.js'
import { toPoint } from './ingest/payload.js'
import type { ChunkRecord } from './ingest/extract.js'

const CHUNK: ChunkRecord = { id: 'about:ai:overview:en', parentId: null, sourceType: 'about', projectId: null, locale: 'en', title: 't', content: 'x' }
import { config } from './config.js'

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
      throw new SupplierError('voyage', '503', true)
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
      throw new SupplierError('voyage', '503', true)
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

test('retrieveWith: the degraded path still trims to topK', async () => {
  // Separate from the boost test: that one has fewer candidates than topK, so it
  // would pass with no slice at all. The fallback must hand generation the same
  // bounded context the reranked path does, or an outage quietly triples the
  // prompt.
  const points = Array.from({ length: config.topK + 5 }, (_, i) => point(`c${i}`, 'blog', 1 - i / 100))
  const docs = await retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
    fetchCandidates: async () => points,
    rerank: async () => {
      throw new SupplierError('voyage', '503', true)
    },
  })
  assert.equal(docs.length, config.topK)
})

test('retrieveWith: a bug inside the ranking is not disguised as a supplier outage', async () => {
  // Only the supplier call belongs in the try. An out-of-range index from a
  // reranker response is our bug, and swallowing it would log "rerank failed"
  // while quietly serving degraded results forever.
  await assert.rejects(
    retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
      fetchCandidates: async () => [point('only', 'blog', 0.9)],
      rerank: async () => [{ index: 7, score: 1 }],
    }),
  )
})

test('retrieveWith: strictRerank makes a rerank failure fail loudly', async () => {
  // Measurement, not production. The eval's `hybrid+rerank` arm must never
  // silently report the `hybrid` arm's ranking because Voyage blipped mid-run.
  await assert.rejects(
    retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true, strictRerank: true }, {
      fetchCandidates: async () => [point('a', 'blog', 0.9), point('b', 'blog', 0.8)],
      rerank: async () => {
        throw new SupplierError('voyage', '503', true)
      },
    }),
    /voyage: 503/,
  )
})

test('retrieveWith: production retrieval does not run in strict mode', () => {
  assert.notEqual(DEFAULT_RETRIEVAL.strictRerank, true)
})

test('retrieveWith: the ablation arm that measures rerank runs strict', async () => {
  // Pins the wiring, not the flag: the eval is the one caller that must not
  // inherit the serving default, and a test on DEFAULT_RETRIEVAL alone would not
  // notice if run-eval stopped asking for it.
  const { ARMS } = await import('./evals/run-eval.js')
  const arm = ARMS.find((a) => a.name === 'hybrid+rerank')
  assert.equal(arm?.retrieval?.strictRerank, true)
})

// The payload → Document half of the wiring. A field the ingest writes but
// toDocument never copies is invisible to every downstream node, and nothing
// fails: the metadata key just reads undefined.
test('retrieveWith: a blog point carries its publication date into the document', async () => {
  const dated = {
    payload: { chunk_id: 'b1', content: 'nine months ago …', source_type: 'blog', locale: 'zh-TW', title: 'AI in production', parent_id: null, project_id: null, date: '2026-09-14' },
    score: 0.9,
  }
  const docs = await retrieveWith('q', 'zh-TW', { dense: true, sparse: false, rerank: false }, {
    fetchCandidates: async () => [dated],
    rerank: async () => {
      throw new Error('rerank is off in this arm')
    },
  })
  assert.equal(docs[0].metadata.date, '2026-09-14')
})

// --- the embedding is no longer the single point ------------------------------
// BM25 runs inside Qdrant, so a query whose embedding Voyage cannot produce can
// still be ranked. Before this, the embed call was the one supplier call on the
// hot path with no fallback.

const voyageDown = async (): Promise<number[]> => {
  throw new SupplierError('voyage', 'fetch failed', true)
}

function recordingQuery() {
  const bodies: Record<string, unknown>[] = []
  return {
    bodies,
    query: async (body: Record<string, unknown>) => {
      bodies.push(body)
      return { points: [point('bm25-hit', 'project', 12.5)] }
    },
  }
}

test('fetchCandidates: a hybrid round whose embedding fails is ranked by BM25 alone, and says so', async () => {
  const q = recordingQuery()
  const reported: Degradation[] = []
  const points = await fetchCandidates('q', 'en', { dense: true, sparse: true, rerank: false }, (d) => reported.push(d), {
    embedOne: voyageDown,
    query: q.query,
  })
  assert.equal(points.length, 1)
  assert.equal(q.bodies.length, 1)
  assert.equal(q.bodies[0].using, 'sparse')
  assert.equal('prefetch' in q.bodies[0], false)
  assert.deepEqual(reported, ['dense-unavailable'])
})

test('fetchCandidates: a healthy round fuses both arms and reports nothing', async () => {
  const q = recordingQuery()
  const reported: Degradation[] = []
  await fetchCandidates('q', 'en', { dense: true, sparse: true, rerank: false }, (d) => reported.push(d), {
    embedOne: async () => [0.1],
    query: q.query,
  })
  assert.ok(Array.isArray(q.bodies[0].prefetch), 'Array.isArray(q.bodies[0].prefetch)')
  assert.deepEqual(reported, [])
})

test('fetchCandidates: a bug in our own code is not mistaken for Voyage being down', async () => {
  await assert.rejects(
    fetchCandidates('q', 'en', { dense: true, sparse: true, rerank: false }, undefined, {
      embedOne: async () => {
        throw new TypeError('vec.map is not a function')
      },
      query: recordingQuery().query,
    }),
    TypeError,
  )
})

test('fetchCandidates: a measurement arm never degrades, and a dense-only round has nothing to degrade to', async () => {
  const deps = { embedOne: voyageDown, query: recordingQuery().query }
  await assert.rejects(fetchCandidates('q', 'en', { dense: true, sparse: true, rerank: false, strictDense: true }, undefined, deps), SupplierError)
  await assert.rejects(fetchCandidates('q', 'en', { dense: true, sparse: false, rerank: false }, undefined, deps), SupplierError)
})

// The query half of the BM25 tokenizer wiring (payload.test.ts pins the ingest
// half). Both branches that send a sparse query must carry exactly the options
// the stored points were built with, or the two sides tokenise differently.
// Everything BM25 tokenises by, which is all of the document but its text.
const settings = (d: { model?: unknown; options?: unknown }) => ({ model: d.model, options: d.options })

test('fetchCandidates: the sparse query carries the same BM25 options the ingest wrote, per locale', async () => {
  for (const locale of ['en', 'zh-TW', 'ja']) {
    const want = settings(toPoint({ ...CHUNK, locale }, [0.1], 'hash', 'x', '').vector.sparse)

    const hybrid = recordingQuery()
    await fetchCandidates('q', locale, { dense: true, sparse: true, rerank: false }, undefined, { embedOne: async () => [0.1], query: hybrid.query })
    const prefetch = hybrid.bodies[0].prefetch as Array<{ using: string; query: Record<string, unknown> }>
    assert.deepEqual(settings(prefetch.find((p) => p.using === 'sparse')!.query), want, `hybrid ${locale}`)

    const alone = recordingQuery()
    await fetchCandidates('q', locale, { dense: false, sparse: true, rerank: false }, undefined, { embedOne: voyageDown, query: alone.query })
    assert.deepEqual(settings(alone.bodies[0].query as Record<string, unknown>), want, `sparse-only ${locale}`)
  }
})

test('retrieveWith: a rerank outage is reported as one', async () => {
  const reported: Degradation[] = []
  await retrieveWith(
    'q',
    'en',
    { dense: true, sparse: true, rerank: true },
    {
      fetchCandidates: async () => [point('a', 'blog', 0.9)],
      rerank: async () => {
        throw new SupplierError('voyage', '503', true)
      },
    },
    (d) => reported.push(d),
  )
  assert.deepEqual(reported, ['rerank-unavailable'])
})

test('retrieveWith: a rerank that fails for any reason but the supplier propagates', async () => {
  await assert.rejects(
    retrieveWith('q', 'en', { dense: true, sparse: true, rerank: true }, {
      fetchCandidates: async () => [point('a', 'blog', 0.9)],
      rerank: async () => {
        throw new RangeError('our bug')
      },
    }),
    RangeError,
  )
})

test('the ablation measures the degraded ranking, and its other arms never fall into it', async () => {
  const { ARMS } = await import('./evals/run-eval.js')
  const sparse = ARMS.find((a) => a.name === 'sparse-only')
  assert.deepEqual(sparse?.retrieval, { dense: false, sparse: true, rerank: false })
  for (const name of ['hybrid', 'hybrid+rerank']) {
    assert.equal(ARMS.find((a) => a.name === name)?.retrieval?.strictDense, true, name)
  }
})

test('retrieveWith: the report reaches the candidate fetch', async () => {
  const reported: Degradation[] = []
  await retrieveWith(
    'q',
    'en',
    { dense: true, sparse: true, rerank: false },
    {
      fetchCandidates: async (_q, _l, _c, report) => {
        report?.('dense-unavailable')
        return [point('a', 'blog', 0.9)]
      },
      rerank: async () => [],
    },
    (d) => reported.push(d),
  )
  assert.deepEqual(reported, ['dense-unavailable'])
})

test('hybridRetrieve: the production wiring degrades through the supplier boundary, without touching the network', async () => {
  // Every layer above runs for real: hybridRetrieve → retrieveWith → the default
  // fetchCandidates → embedOne → embed → the supplier boundary. Both circuits are
  // opened first, so no request leaves the process: Voyage fails fast, the round
  // reports the degradation and asks Qdrant for BM25, and Qdrant fails fast too.
  // Unwrap any one supplier call and this either reaches the network (with no
  // key, so it fails as something other than a SupplierError) or loses the report.
  __resetBreakers()
  const down = async () => {
    throw Object.assign(new Error('down'), { name: 'TimeoutError' })
  }
  const real = { now: () => Date.now(), sleep: async () => {} }
  await assert.rejects(callSupplier('voyage', down, real))
  await assert.rejects(callSupplier('qdrant', down, real))
  const reported: Degradation[] = []
  await assert.rejects(hybridRetrieve(`wiring probe ${Date.now()}`, 'en', (d) => reported.push(d)), (err: unknown) => {
    assert.ok(err instanceof SupplierError, String(err))
    assert.equal(err.supplier, 'qdrant')
    return true
  })
  assert.deepEqual(reported, ['dense-unavailable'])
  __resetBreakers()
})
