// Hybrid retrieval over Qdrant: dense (Voyage voyage-3-large, cosine) + sparse
// (BM25 lexical via Qdrant Cloud Inference), fused server-side with Reciprocal
// Rank Fusion in the Query API, then optionally reranked by a cross-encoder
// (Voyage rerank). On a small corpus the marginal lift of each layer is
// measurable — that's exactly what the LangSmith ablation quantifies.

import { Document } from '@langchain/core/documents'

import { config } from './config.js'
import { embedOne, rerank } from './embeddings.js'
import { qdrant, chunkSparse, DENSE, SPARSE } from './qdrant.js'
import { callSupplier, SupplierError } from './supplier.js'

// Payload stored per chunk at ingest (see ingest/payload.ts, which writes it).
interface Payload {
  chunk_id: string
  parent_id: string | null
  source_type: string
  project_id: string | null
  locale: string
  title: string | null
  content: string
  url?: string | null // external article URL, present only on blog chunks
  date?: string | null // publication date (YYYY-MM-DD), present only on blog chunks
}

// Which retrieval layers are active. The Phase 1 ablation toggles these to
// measure each layer's marginal lift (dense → +sparse → +rerank). Production
// uses the default (everything on, mirroring config).
export interface RetrievalConfig {
  dense: boolean
  sparse: boolean
  rerank: boolean
  // Measurement mode: re-throw a rerank failure instead of degrading to RRF.
  // Serving prefers a degraded answer to no answer, but an eval arm that
  // silently reports the `hybrid` ranking under the `hybrid+rerank` label is
  // worse than a failed run — the number survives into a report and nobody can
  // tell. Off in production; the ablation turns it on.
  strictRerank?: boolean
  // The same, for the query embedding: serving degrades a hybrid query whose
  // embedding failed to the sparse arm alone, and an ablation arm must not.
  strictDense?: boolean
}

// What a retrieval round gave up to return anything at all. Reported rather than
// hidden: a degraded answer is still an answer, but it is a lower-quality one,
// and chat_logs is where somebody notices that an outage is going on.
//   dense-unavailable  → Voyage could not embed the query; BM25 alone ranked it
//   rerank-unavailable → Voyage could not rerank; RRF order was used
export type Degradation = 'dense-unavailable' | 'rerank-unavailable'
export type DegradationReport = (d: Degradation) => void
const ignore: DegradationReport = () => {}

export const DEFAULT_RETRIEVAL: RetrievalConfig = {
  dense: true,
  sparse: true,
  rerank: config.rerankEnabled,
}

function localeFilter(locale: string) {
  return { must: [{ key: 'locale', match: { value: locale } }] }
}

// The sparse query is raw text; Qdrant Cloud Inference runs BM25 on it with the
// same options the locale's chunks were indexed with (qdrant.ts chunkSparse).
const sparseQuery = chunkSparse

export interface ScoredPoint {
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
      url: pl.url ?? null,
      date: pl.date ?? null,
      score: p.score ?? 0,
    },
  })
}

// The Qdrant half of a retrieval round: the candidate set, before any rerank.
// Layers are configurable so the same code path serves both production (full
// hybrid) and the ablation:
//   dense+sparse → prefetch both arms, fuse with RRF server-side
//   dense only / sparse only → a single-arm query (the ablation's isolation)
// Split out from retrieveWith so the rerank's failure handling is testable
// without a live Qdrant or Voyage key — the two suppliers it guards against.
//
// The hybrid path survives Voyage. The sparse arm is BM25 computed by Qdrant
// Cloud Inference, so it needs nothing from Voyage, and when the query
// embedding cannot be had the round runs on that arm alone. The ablation
// measures that ranking as the `sparse-only` arm, so the cost of the
// degradation is a number in docs/rag-ablation-report.md, not a guess. Before
// this, the embedding was the one call with no fallback: Voyage down meant the
// candidate set was empty and the request ended as an outage.
export interface CandidateDeps {
  embedOne: typeof embedOne
  query: (body: Record<string, unknown>) => Promise<{ points: ScoredPoint[] }>
}

export const DEFAULT_CANDIDATE_DEPS: CandidateDeps = {
  embedOne,
  query: (body) => callSupplier('qdrant', () => qdrant().query(config.qdrantCollection, body as never)),
}

export async function fetchCandidates(
  query: string,
  locale: string,
  cfg: RetrievalConfig,
  report: DegradationReport = ignore,
  deps: CandidateDeps = DEFAULT_CANDIDATE_DEPS,
): Promise<ScoredPoint[]> {
  if (!cfg.dense && !cfg.sparse) {
    throw new Error('fetchCandidates: at least one of dense/sparse must be enabled')
  }

  const filter = localeFilter(locale)
  let points: ScoredPoint[]

  let denseVec: number[] | null = null
  if (cfg.dense) {
    try {
      denseVec = await deps.embedOne(query, 'query')
    } catch (err) {
      // Only a hybrid round has an arm left to answer with, and only a
      // supplier's failure is a reason to use it. Our own bug propagates.
      if (!(err instanceof SupplierError) || !cfg.sparse || cfg.strictDense) throw err
      console.warn(`[chat] degraded dense-unavailable, ranking by BM25 alone: ${err.message}`)
      report('dense-unavailable')
    }
  }

  if (denseVec && cfg.sparse) {
    // Hybrid: both arms prefetched, fused with RRF inside Qdrant.
    const res = await deps.query({
      prefetch: [
        { query: denseVec, using: DENSE, filter, limit: config.candidateK },
        { query: sparseQuery(query, locale), using: SPARSE, filter, limit: config.candidateK },
      ],
      query: { fusion: 'rrf' },
      filter,
      limit: config.candidateK,
      with_payload: true,
    })
    points = res.points
  } else if (denseVec) {
    const res = await deps.query({
      query: denseVec,
      using: DENSE,
      filter,
      limit: config.candidateK,
      with_payload: true,
    })
    points = res.points
  } else {
    const res = await deps.query({
      query: sparseQuery(query, locale),
      using: SPARSE,
      filter,
      limit: config.candidateK,
      with_payload: true,
    })
    points = res.points
  }

  return points
}

// The two external suppliers a retrieval round depends on, injectable so a test
// can drive the failure paths. Production always uses DEFAULT_RETRIEVAL_DEPS.
export interface RetrievalDeps {
  fetchCandidates: typeof fetchCandidates
  rerank: typeof rerank
}

export const DEFAULT_RETRIEVAL_DEPS: RetrievalDeps = { fetchCandidates, rerank }

// One round of retrieval for a single query string: candidates, then rerank.
//
// The rerank is allowed to fail. Voyage supplies both the query embedding and
// the rerank, so a Voyage blip used to propagate out of here as a generic SSE
// error, taking the whole bot down to regex triage while a usable RRF-fused
// candidate set sat in `points`. Degrading to that RRF order costs ranking
// quality that the ablation has actually measured (the `hybrid` arm), which is a
// far better answer than no answer. A failed embedding degrades one step
// earlier, in fetchCandidates. What still throws is Qdrant itself being
// unreachable: with no index there are no points, and the retrieve node turns
// that into the honest outage reply.
export async function retrieveWith(
  query: string,
  locale: string,
  cfg: RetrievalConfig,
  deps: RetrievalDeps = DEFAULT_RETRIEVAL_DEPS,
  report: DegradationReport = ignore,
): Promise<Document[]> {
  const points = await deps.fetchCandidates(query, locale, cfg, report)

  if (cfg.rerank && points.length > 0) {
    // Only the supplier call is guarded. Ranking the response is our own code,
    // and a bug there (an out-of-range index, say) must not spend the rest of
    // its life logged as somebody else's outage.
    let ranked: { index: number; score: number }[] | null = null
    try {
      // Rerank the full candidate set (not just top-k) so source weighting can
      // still pull a lower-ranked first-party chunk into the final top-k.
      ranked = await deps.rerank(query, points.map(contentOf), Math.min(points.length, config.candidateK))
    } catch (err) {
      if (!(err instanceof SupplierError) || cfg.strictRerank) throw err
      console.warn(`[chat] degraded rerank-unavailable, keeping RRF order: ${err.message}`)
      report('rerank-unavailable')
    }
    if (ranked) return weightAndTrim(ranked.map((r) => ({ point: points[r.index], base: r.score })))
  }
  return weightAndTrim(points.map((p) => ({ point: p, base: p.score ?? 0 })))
}

// Production entry point: full hybrid retrieval. Used by the graph's retrieve
// node. Thin wrapper over retrieveWith so there is a single code path.
export function hybridRetrieve(query: string, locale: string, report: DegradationReport = ignore): Promise<Document[]> {
  return retrieveWith(query, locale, DEFAULT_RETRIEVAL, DEFAULT_RETRIEVAL_DEPS, report)
}

// Round-robin merge of per-sub-question retrievals for multi-question fan-out
// (see nodes.ts:retrieve). Takes each list's rank-0 doc, then rank-1, etc.,
// deduping by chunk id, until `cap`. Interleaving (not concatenation) guarantees
// every sub-question contributes its strongest hits before any single one fills
// the budget — the whole point of fanning out — while `cap` keeps the merged
// context bounded so the generation prompt stays lean.
export function mergeInterleaved(lists: Document[][], cap: number): Document[] {
  const seen = new Set<string>()
  const out: Document[] = []
  const depth = Math.max(0, ...lists.map((l) => l.length))
  for (let rank = 0; rank < depth && out.length < cap; rank++) {
    for (const list of lists) {
      if (out.length >= cap) break
      const d = list[rank]
      if (!d) continue
      const id = String(d.metadata?.id ?? '')
      if (id && seen.has(id)) continue
      if (id) seen.add(id)
      out.push(d)
    }
  }
  return out
}
