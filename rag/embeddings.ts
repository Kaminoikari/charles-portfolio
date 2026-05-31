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
  })
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data.map((d) => d.embedding)
}

export async function embedOne(text: string, inputType: InputType = 'query'): Promise<number[]> {
  return (await embed([text], inputType))[0]
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
  })
  if (!res.ok) throw new Error(`rerank failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    data: { index: number; relevance_score: number }[]
  }
  return json.data.map((r) => ({ index: r.index, score: r.relevance_score }))
}
