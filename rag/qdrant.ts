// Qdrant client + collection bootstrap. Single place that knows how the vector
// store is shaped, so retrieval / ingest / logging / insights all agree.
//
// Hybrid layout per chunk: a named DENSE vector (Voyage voyage-3-large, cosine)
// and a named SPARSE vector (BM25 lexical, computed server-side by Qdrant Cloud
// Inference). Fusion (RRF) also happens server-side in the Query API — see
// retrieval.ts.

import { QdrantClient } from '@qdrant/js-client-rest'
import { createHash } from 'node:crypto'

import { config } from './config'

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
}
