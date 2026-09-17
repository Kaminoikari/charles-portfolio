// How a corpus chunk becomes a Qdrant point: the payload it carries and the
// hashed subset of that payload.
//
// This lives outside build-index.ts because that file runs main() at import
// time — a test that imported it would kick off a real ingest — and the
// chunk → payload → retrieval → prompt chain is exactly the wiring that fails
// silently when a new field is added to one end only.

import { config } from '../config.js'
import { DENSE, SPARSE, toPointId } from '../qdrant.js'
import type { ChunkRecord } from './extract.js'

export type Point = {
  id: string
  vector: { [DENSE]: number[]; [SPARSE]: { text: string; model: string } }
  payload: Record<string, unknown>
}

// The metadata subset folded into the hash: payload minus the volatile keys the
// writer adds (chunk_hash, context) and content (hashed via its own field). A
// displayed title / url / date changing is a real change even when the body didn't.
export function hashPayload(r: ChunkRecord): Record<string, unknown> {
  return {
    parent_id: r.parentId,
    source_type: r.sourceType,
    project_id: r.projectId,
    locale: r.locale,
    title: r.title,
    ...(r.url ? { url: r.url } : {}),
    ...(r.date ? { date: r.date } : {}),
  }
}

export function toPoint(
  r: ChunkRecord,
  vector: number[],
  hash: string,
  embedText: string,
  context: string,
): Point {
  return {
    id: toPointId(r.id),
    vector: {
      [DENSE]: vector,
      // Sparse (BM25) sees the SAME context-prefixed text as the dense embedding
      // — Anthropic's "contextual BM25" half of the technique.
      [SPARSE]: { text: embedText, model: config.sparseModel },
    },
    payload: {
      chunk_id: r.id,
      chunk_hash: hash,
      parent_id: r.parentId,
      source_type: r.sourceType,
      project_id: r.projectId,
      locale: r.locale,
      title: r.title,
      content: r.content, // raw content stays for citation / display
      ...(context ? { context } : {}), // the generated situating context, for transparency
      ...(r.url ? { url: r.url } : {}),
      // Publication date, blog chunks only. The generator reads it out of the
      // evidence block to date-anchor what an article says.
      ...(r.date ? { date: r.date } : {}),
    },
  }
}
