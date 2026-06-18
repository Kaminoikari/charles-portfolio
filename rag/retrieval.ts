// Hybrid retrieval over Qdrant: dense (Voyage voyage-3-large, cosine) + sparse
// (BM25 lexical via Qdrant Cloud Inference), fused server-side with Reciprocal
// Rank Fusion in the Query API, then optionally reranked by a cross-encoder
// (Voyage rerank). On a small corpus the marginal lift of each layer is
// measurable — that's exactly what the LangSmith ablation quantifies.

import { Document } from '@langchain/core/documents'

import { config } from './config.js'
import { embedOne, rerank } from './embeddings.js'
import { qdrant, DENSE, SPARSE } from './qdrant.js'

// Payload stored per chunk at ingest (see ingest/build-index.ts).
interface Payload {
  chunk_id: string
  parent_id: string | null
  source_type: string
  project_id: string | null
  locale: string
  title: string | null
  content: string
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

function localeFilter(locale: string) {
  return { must: [{ key: 'locale', match: { value: locale } }] }
}

// The sparse query is raw text; Qdrant Cloud Inference runs BM25 on it.
function sparseQuery(query: string) {
  return { text: query, model: config.sparseModel }
}

interface ScoredPoint {
  payload?: Record<string, unknown> | null
  score?: number
}

// First-party, self-authored portfolio sources. Everything else (i.e. blog) is
// a third-party article and is left at weight 1 so curated content wins ties.
const FIRST_PARTY_SOURCES = new Set(['about', 'project', 'experience', 'skill', 'changelog'])

function contentOf(p: ScoredPoint): string {
  return ((p.payload ?? {}) as unknown as Payload).content
}

function sourceWeightOf(p: ScoredPoint): number {
  const st = ((p.payload ?? {}) as unknown as Payload).source_type
  return FIRST_PARTY_SOURCES.has(st) ? config.firstPartyBoost : 1
}

// Re-rank a scored candidate set by (base score × source weight) and keep the
// top-k. With firstPartyBoost = 1 this preserves the incoming order (scores are
// distinct), so the weighting is inert until the knob is raised.
function weightAndTrim(scored: { point: ScoredPoint; base: number }[]): Document[] {
  return scored
    .map((s) => ({ point: s.point, w: s.base * sourceWeightOf(s.point) }))
    .sort((a, b) => b.w - a.w)
    .slice(0, config.topK)
    .map((s) => toDocument(s.point))
}

function toDocument(p: ScoredPoint): Document {
  const pl = (p.payload ?? {}) as unknown as Payload
  return new Document({
    pageContent: pl.content,
    metadata: {
      id: pl.chunk_id,
      parentId: pl.parent_id,
      sourceType: pl.source_type,
      projectId: pl.project_id,
      locale: pl.locale,
      title: pl.title,
      score: p.score ?? 0,
    },
  })
}

// One round of retrieval for a single query string. Layers are configurable so
// the same code path serves both production (full hybrid) and the ablation:
//   dense+sparse → prefetch both arms, fuse with RRF server-side
//   dense only / sparse only → a single-arm query (the ablation's isolation)
export async function retrieveWith(
  query: string,
  locale: string,
  cfg: RetrievalConfig,
): Promise<Document[]> {
  if (!cfg.dense && !cfg.sparse) {
    throw new Error('retrieveWith: at least one of dense/sparse must be enabled')
  }

  const db = qdrant()
  const filter = localeFilter(locale)
  let points: ScoredPoint[]

  if (cfg.dense && cfg.sparse) {
    // Hybrid: both arms prefetched, fused with RRF inside Qdrant.
    const denseVec = await embedOne(query, 'query')
    const res = await db.query(config.qdrantCollection, {
      prefetch: [
        { query: denseVec, using: DENSE, filter, limit: config.candidateK },
        { query: sparseQuery(query), using: SPARSE, filter, limit: config.candidateK },
      ],
      query: { fusion: 'rrf' },
      filter,
      limit: config.candidateK,
      with_payload: true,
    })
    points = res.points
  } else if (cfg.dense) {
    const denseVec = await embedOne(query, 'query')
    const res = await db.query(config.qdrantCollection, {
      query: denseVec,
      using: DENSE,
      filter,
      limit: config.candidateK,
      with_payload: true,
    })
    points = res.points
  } else {
    const res = await db.query(config.qdrantCollection, {
      query: sparseQuery(query),
      using: SPARSE,
      filter,
      limit: config.candidateK,
      with_payload: true,
    })
    points = res.points
  }

  if (cfg.rerank && points.length > 0) {
    // Rerank the full candidate set (not just top-k) so source weighting can
    // still pull a lower-ranked first-party chunk into the final top-k.
    const ranked = await rerank(query, points.map(contentOf), Math.min(points.length, config.candidateK))
    return weightAndTrim(ranked.map((r) => ({ point: points[r.index], base: r.score })))
  }
  return weightAndTrim(points.map((p) => ({ point: p, base: p.score ?? 0 })))
}

// Production entry point: full hybrid retrieval. Used by the graph's retrieve
// node. Thin wrapper over retrieveWith so there is a single code path.
export function hybridRetrieve(query: string, locale: string): Promise<Document[]> {
  return retrieveWith(query, locale, DEFAULT_RETRIEVAL)
}
