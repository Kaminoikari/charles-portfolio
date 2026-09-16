// Voyage AI embedding (voyage-3-large) + reranker (rerank-2.5) clients.
//
// Voyage is a US provider with SOTA retrieval quality, and voyage-3-large is
// 1024-dim so it drops into the existing `vector(1024)` schema unchanged. We use
// Voyage's asymmetric input_type ("document" when indexing, "query" when
// retrieving) — embedding the two sides differently measurably improves
// retrieval over a single symmetric encoding.
//
// (Previously BGE-M3 via a CN-hosted inference endpoint; swapped to keep all
// query + corpus traffic on a US provider.)

import { config } from './config.js'

const apiKey = () => process.env.VOYAGE_API_KEY ?? process.env.EMBEDDING_API_KEY ?? ''

export type InputType = 'document' | 'query'

// Embed a batch of texts. `inputType` selects Voyage's asymmetric encoding:
// 'document' for indexing (build-index.ts), 'query' for retrieval.
export async function embed(texts: string[], inputType: InputType = 'query'): Promise<number[][]> {
  const res = await fetch(`${config.embedBaseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: config.embedModel,
      input: texts,
      input_type: inputType,
      output_dimension: config.embedDim,
    }),
    signal: AbortSignal.timeout(config.embedTimeoutMs),
  })
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data.map((d) => d.embedding)
}

// Bounded, insertion-ordered memo of single-text embeddings. A Map iterates in
// insertion order, so the first key is the oldest — enough for a cache this size
// without carrying an LRU implementation. Keyed by input_type as well as text:
// Voyage encodes the same string differently for 'query' and 'document', and
// serving one for the other would silently corrupt whichever side lost.
const queryCache = new Map<string, number[]>()

// Test-only: the cache outlives a module import, so a test that counts calls
// must start from a known state.
export function __resetQueryCache(): void {
  queryCache.clear()
}

export interface EmbedDeps {
  embed: (texts: string[], inputType: InputType) => Promise<number[][]>
}

export const DEFAULT_EMBED_DEPS: EmbedDeps = { embed }

export async function embedOne(
  text: string,
  inputType: InputType = 'query',
  deps: EmbedDeps = DEFAULT_EMBED_DEPS,
): Promise<number[]> {
  const key = `${inputType}\u0000${text}`
  const cached = queryCache.get(key)
  if (cached) return cached

  // Awaited before the write, so a failed call leaves nothing behind: caching a
  // rejection would turn one Voyage blip into a permanently broken query for as
  // long as the instance lives.
  const vec = (await deps.embed([text], inputType))[0]
  queryCache.set(key, vec)
  if (queryCache.size > config.queryCacheMax) {
    const oldest = queryCache.keys().next().value
    if (oldest !== undefined) queryCache.delete(oldest)
  }
  return vec
}

// Cross-encoder rerank: scores each document against the query directly. More
// accurate than embedding cosine because query+doc are encoded together.
// Returns indices into `docs` ordered best-first, with scores.
//
// Voyage specifics vs the old BGE endpoint: param is `top_k` (not top_n) and
// results come back under `data` (not `results`).
export async function rerank(
  query: string,
  docs: string[],
  topN: number,
): Promise<{ index: number; score: number }[]> {
  const res = await fetch(`${config.embedBaseUrl}/rerank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: config.rerankModel,
      query,
      documents: docs,
      top_k: topN,
    }),
    signal: AbortSignal.timeout(config.embedTimeoutMs),
  })
  if (!res.ok) throw new Error(`rerank failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    data: { index: number; relevance_score: number }[]
  }
  return json.data.map((r) => ({ index: r.index, score: r.relevance_score }))
}
