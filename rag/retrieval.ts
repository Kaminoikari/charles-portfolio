// Hybrid retrieval over Supabase pgvector: dense (HNSW cosine) + sparse
// (Postgres full-text), fused with Reciprocal Rank Fusion, then optionally
// reranked by a cross-encoder. On a small corpus the marginal lift of each
// layer is measurable — that's exactly what the LangSmith ablation quantifies.

import { createClient } from '@supabase/supabase-js'
import { Document } from '@langchain/core/documents'

import { config } from './config'
import { embedOne, rerank } from './embeddings'

const supabase = () =>
  createClient(config.supabaseUrl, process.env.SUPABASE_SERVICE_KEY ?? '')

interface Row {
  id: string
  parent_id: string | null
  source_type: string
  project_id: string | null
  locale: string
  title: string | null
  content: string
  rank: number
}

// Reciprocal Rank Fusion: merge multiple ranked lists into one. Robust and
// tuning-free — an item ranked high in either list floats up.
function rrf(lists: Row[][], k: number): Map<string, { row: Row; score: number }> {
  const fused = new Map<string, { row: Row; score: number }>()
  for (const list of lists) {
    list.forEach((row, i) => {
      const prev = fused.get(row.id)
      const inc = 1 / (k + i + 1)
      if (prev) prev.score += inc
      else fused.set(row.id, { row, score: inc })
    })
  }
  return fused
}

// Which retrieval layers are active. The Phase 1 ablation toggles these to
// measure each layer's marginal lift (dense → +sparse → +rerank). Production
// uses the default (everything on, mirroring config).
export interface RetrievalConfig {
  dense: boolean
  sparse: boolean
  rerank: boolean
}

export const DEFAULT_RETRIEVAL: RetrievalConfig = {
  dense: true,
  sparse: true,
  rerank: config.rerankEnabled,
}

function toDocument(row: Row, score: number): Document {
  return new Document({
    pageContent: row.content,
    metadata: {
      id: row.id,
      parentId: row.parent_id,
      sourceType: row.source_type,
      projectId: row.project_id,
      locale: row.locale,
      title: row.title,
      score,
    },
  })
}

// One round of retrieval for a single query string. Layers are configurable so
// the same code path serves both production (full hybrid) and the ablation.
export async function retrieveWith(
  query: string,
  locale: string,
  cfg: RetrievalConfig,
): Promise<Document[]> {
  if (!cfg.dense && !cfg.sparse) {
    throw new Error('retrieveWith: at least one of dense/sparse must be enabled')
  }

  const db = supabase()

  // Only embed when the dense arm is active (saves an API call in sparse-only).
  const lists: Row[][] = []
  const calls: Promise<void>[] = []

  if (cfg.dense) {
    calls.push(
      (async () => {
        const queryVec = await embedOne(query, 'query')
        const res = await db.rpc('match_chunks_dense', {
          query_embedding: queryVec,
          match_count: config.candidateK,
          filter_locale: locale,
        })
        if (res.error) throw res.error
        lists.push(res.data as Row[])
      })(),
    )
  }
  if (cfg.sparse) {
    calls.push(
      (async () => {
        const res = await db.rpc('match_chunks_fts', {
          query_text: query,
          match_count: config.candidateK,
          filter_locale: locale,
        })
        if (res.error) throw res.error
        lists.push(res.data as Row[])
      })(),
    )
  }
  await Promise.all(calls)

  // RRF over whichever lists are present (one list = identity ranking).
  const fused = rrf(lists, config.rrfK)
  const ordered = [...fused.values()].sort((a, b) => b.score - a.score)

  if (cfg.rerank && ordered.length > 0) {
    const ranked = await rerank(
      query,
      ordered.map((o) => o.row.content),
      config.topK,
    )
    return ranked.map((r) => toDocument(ordered[r.index].row, r.score))
  }
  return ordered.slice(0, config.topK).map(({ row, score }) => toDocument(row, score))
}

// Production entry point: full hybrid retrieval. Used by the graph's retrieve
// node. Thin wrapper over retrieveWith so there is a single code path.
export function hybridRetrieve(query: string, locale: string): Promise<Document[]> {
  return retrieveWith(query, locale, DEFAULT_RETRIEVAL)
}
