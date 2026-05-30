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

// One round of hybrid retrieval for a single query string.
export async function hybridRetrieve(query: string, locale: string): Promise<Document[]> {
  const db = supabase()
  const queryVec = await embedOne(query)

  // Dense + sparse run in parallel via two Postgres RPCs (see schema §5).
  const [dense, sparse] = await Promise.all([
    db.rpc('match_chunks_dense', {
      query_embedding: queryVec,
      match_count: config.candidateK,
      filter_locale: locale,
    }),
    db.rpc('match_chunks_fts', {
      query_text: query,
      match_count: config.candidateK,
      filter_locale: locale,
    }),
  ])
  if (dense.error) throw dense.error
  if (sparse.error) throw sparse.error

  const fused = rrf([dense.data as Row[], sparse.data as Row[]], config.rrfK)
  const ordered = [...fused.values()].sort((a, b) => b.score - a.score)

  // Optional cross-encoder rerank over the fused candidates.
  let finalRows: { row: Row; score: number }[]
  if (config.rerankEnabled && ordered.length > 0) {
    const ranked = await rerank(
      query,
      ordered.map((o) => o.row.content),
      config.topK,
    )
    finalRows = ranked.map((r) => ({ row: ordered[r.index].row, score: r.score }))
  } else {
    finalRows = ordered.slice(0, config.topK)
  }

  return finalRows.map(
    ({ row, score }) =>
      new Document({
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
      }),
  )
}
