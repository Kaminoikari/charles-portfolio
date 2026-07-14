// Qdrant client + collection bootstrap. Single place that knows how the vector
// store is shaped, so retrieval / ingest / logging / insights all agree.
//
// Hybrid layout per chunk: a named DENSE vector (Voyage voyage-3-large, cosine)
// and a named SPARSE vector (BM25 lexical, computed server-side by Qdrant Cloud
// Inference). Fusion (RRF) also happens server-side in the Query API — see
// retrieval.ts.

import { QdrantClient } from '@qdrant/js-client-rest'
import { createHash } from 'node:crypto'

import { config } from './config.js'

// Named-vector keys, referenced by every read/write path.
export const DENSE = 'dense'
export const SPARSE = 'sparse'

export function qdrant(): QdrantClient {
  return new QdrantClient({
    url: config.qdrantUrl,
    apiKey: process.env.QDRANT_API_KEY,
    // Cloud Inference + larger upserts can exceed the default check-compatibility
    // timeout; bump it modestly.
    timeout: 30_000,
    checkCompatibility: false,
  })
}

// Qdrant point IDs must be uint or UUID, but our chunk IDs are strings
// ("about-en-0"). Deterministically map string → UUIDv5 so re-ingesting the
// same chunk upserts in place. The original ID is preserved in the payload.
export function toPointId(stringId: string): string {
  const h = createHash('sha1').update(`charles-portfolio:${stringId}`).digest()
  const b = Buffer.from(h.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50 // version 5
  b[8] = (b[8] & 0x3f) | 0x80 // RFC-4122 variant
  const x = b.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

// Create the two collections if absent. Idempotent — safe to call on every
// ingest run. doc_chunks holds the hybrid index; chat_logs is an append-only
// analytics store (a size-1 dummy vector since it's only ever scrolled, never
// searched by similarity — keeps logging free of an extra embedding call).
export async function ensureCollections(): Promise<void> {
  const db = qdrant()

  if (!(await db.collectionExists(config.qdrantCollection)).exists) {
    await db.createCollection(config.qdrantCollection, {
      vectors: { [DENSE]: { size: config.embedDim, distance: 'Cosine' } },
      // BM25 needs server-side IDF → the 'idf' modifier (Cloud Inference emits
      // term frequencies; Qdrant applies IDF at query time). A learned-sparse
      // model like SPLADE++ would omit this.
      sparse_vectors: { [SPARSE]: { modifier: 'idf' } },
    })
    // Locale filter is applied on every query → index the payload key.
    await db.createPayloadIndex(config.qdrantCollection, {
      field_name: 'locale',
      field_schema: 'keyword',
    })
  }

  if (!(await db.collectionExists(config.qdrantLogsCollection)).exists) {
    await db.createCollection(config.qdrantLogsCollection, {
      vectors: { [DENSE]: { size: 1, distance: 'Cosine' } },
    })
  }

  // Semantic FAQ cache: one dense vector per pre-written question paraphrase.
  // Dense-only (no sparse) — matching is pure embedding similarity.
  if (!(await db.collectionExists(config.qdrantFaqCollection)).exists) {
    await db.createCollection(config.qdrantFaqCollection, {
      vectors: { [DENSE]: { size: config.embedDim, distance: 'Cosine' } },
    })
    await db.createPayloadIndex(config.qdrantFaqCollection, {
      field_name: 'locale',
      field_schema: 'keyword',
    })
  }
}

// Incremental ingest — read every point's (chunk_id → stored chunk_hash) so the
// reconciler can diff the corpus against Qdrant before spending a single
// embedding/LLM token. with_vector:false keeps this cheap: we pull only the two
// bookkeeping keys, paginating so a growing corpus never blows the page limit.
// The collection is assumed to exist (call ensureCollections first); an empty
// collection simply yields an empty map, which makes a cold start build all.
export async function scrollHashes(collection: string): Promise<Map<string, string>> {
  const db = qdrant()
  const out = new Map<string, string>()
  let offset: string | number | undefined | null = undefined
  do {
    const res = await db.scroll(collection, {
      limit: 256,
      offset: offset ?? undefined,
      with_payload: ['chunk_id', 'chunk_hash'],
      with_vector: false,
    })
    for (const p of res.points) {
      const pl = (p.payload ?? {}) as { chunk_id?: string; chunk_hash?: string }
      // Points written by the pre-incremental pipeline carry chunk_id but no
      // chunk_hash. Map those to '' so the first incremental run rebuilds them
      // (populating the hash) and reclaims any that the corpus no longer emits.
      if (pl.chunk_id) out.set(pl.chunk_id, pl.chunk_hash ?? '')
    }
    offset = res.next_page_offset as string | number | null | undefined
  } while (offset !== null && offset !== undefined)
  return out
}

// Reclaim points whose logical chunk_id the corpus no longer produces (a deleted
// blog post, a renamed section). Maps each chunk_id back through the same
// deterministic UUIDv5 the writer used, then deletes in pages.
export async function deleteByChunkIds(collection: string, chunkIds: string[]): Promise<void> {
  if (chunkIds.length === 0) return
  const db = qdrant()
  const ids = chunkIds.map(toPointId)
  for (let i = 0; i < ids.length; i += 128) {
    await db.delete(collection, { points: ids.slice(i, i + 128), wait: true })
  }
}

// Look up the closest pre-written FAQ answer for a query embedding. Returns the
// cached answer when the top hit clears the similarity threshold, else null
// (caller falls through to RAG). Locale-filtered so each language matches its
// own paraphrases. Dense-only, single round-trip — no generation LLM involved.
export async function faqLookup(
  queryVec: number[],
  locale: string,
): Promise<{ answer: string; id: string; score: number } | null> {
  const db = qdrant()
  const res = await db.query(config.qdrantFaqCollection, {
    query: queryVec,
    using: DENSE,
    filter: { must: [{ key: 'locale', match: { value: locale } }] },
    limit: 1,
    with_payload: true,
  })
  const top = res.points[0]
  // Diagnostic: always log the best candidate so a near-miss is tunable from
  // logs (e.g. "score=0.79 id=remote" tells us the threshold is just too high).
  const payload = (top?.payload ?? {}) as { answer?: string; faq_id?: string }
  console.log(
    `[chat] faqprobe score=${(top?.score ?? 0).toFixed(3)} thr=${config.faqCacheThreshold} ` +
      `id=${payload.faq_id ?? '-'} hits=${res.points.length} locale=${locale}`,
  )
  if (!top || (top.score ?? 0) < config.faqCacheThreshold) return null
  if (!payload.answer) return null
  return { answer: payload.answer, id: payload.faq_id ?? '', score: top.score ?? 0 }
}
