// BGE-M3 embedding + bge-reranker-v2-m3 clients over an OpenAI-compatible HTTP
// API (SiliconFlow / DeepInfra / HF TEI). Swappable via config — no GPU needed
// on Vercel. BGE-M3 is multilingual (EN/zh-TW/ja in one model), which is why it
// fits a tri-locale corpus without bolting two models together.

import { config } from './config'

const embedKey = () => process.env.EMBEDDING_API_KEY ?? ''

// Dense embedding for a batch of texts. Returns one vector per input.
export async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${config.embedBaseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${embedKey()}`,
    },
    body: JSON.stringify({ model: config.embedModel, input: texts }),
  })
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { data: { embedding: number[] }[] }
  return json.data.map((d) => d.embedding)
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0]
}

// Cross-encoder rerank: scores each document against the query directly. More
// accurate than embedding cosine because query+doc are encoded together.
// Returns indices into `docs` ordered best-first, with scores.
export async function rerank(
  query: string,
  docs: string[],
  topN: number,
): Promise<{ index: number; score: number }[]> {
  const res = await fetch(`${config.embedBaseUrl}/rerank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${embedKey()}`,
    },
    body: JSON.stringify({
      model: config.rerankModel,
      query,
      documents: docs,
      top_n: topN,
    }),
  })
  if (!res.ok) throw new Error(`rerank failed: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as {
    results: { index: number; relevance_score: number }[]
  }
  return json.results.map((r) => ({ index: r.index, score: r.relevance_score }))
}
