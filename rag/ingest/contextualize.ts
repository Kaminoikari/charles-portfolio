// Contextual Retrieval (Anthropic, 2024). Before embedding a chunk that is a
// FRAGMENT of a larger document (a blog body slice, a project case-study
// section), prepend a short LLM-generated sentence situating it within the whole
// document, then embed context+chunk. Anthropic report this cuts top-20
// retrieval failures ~35% for embeddings and ~49% when the same context is also
// fed to BM25 — so we prepend it to BOTH the dense input and the sparse text.
// The real lift on our own corpus is measured by the golden-set ablation
// (rag/evals), which is why this ships OFF by default until the numbers justify
// flipping it on.
//
// Cost is controlled two ways: (1) the incremental reconciler only ever asks us
// to contextualise NEW or CHANGED chunks, never the whole corpus; (2) the parent
// document is sent with an Anthropic prompt-cache breakpoint, so a document's
// 2nd..Nth chunk reuse the cached prefix instead of re-sending it (the cost
// optimisation from Anthropic's own recipe). Generator is the cheap fast model.

import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, type MessageContent } from '@langchain/core/messages'

import { config } from '../config.js'

// Bounded concurrency across DISTINCT parent documents. Chunks of the SAME parent
// run sequentially within a group so the cached document prefix is warm before
// the next chunk reuses it.
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.RAG_CONTEXT_CONCURRENCY ?? '4', 10))
const MAX_TOKENS = Math.max(64, Number.parseInt(process.env.RAG_CONTEXT_MAX_TOKENS ?? '160', 10))

let client: ChatAnthropic | null = null
function model(): ChatAnthropic {
  if (!client) {
    client = new ChatAnthropic({
      model: config.contextModel,
      temperature: 0,
      maxTokens: MAX_TOKENS,
      maxRetries: 2,
    })
  }
  return client
}

// A text content block optionally carrying an Anthropic prompt-cache breakpoint.
// @langchain/core's ContentBlock union doesn't surface the provider-specific
// cache_control field, so we build the block precisely and cast once at the
// message boundary — the Anthropic client forwards cache_control on text blocks.
type CacheableText = {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
}

function instruction(chunk: string): string {
  return (
    `Here is a chunk we want to situate within the document above:\n<chunk>\n${chunk}\n</chunk>\n\n` +
    `In 1-2 short sentences, in the SAME language as the document, state what this chunk is about ` +
    `and where it sits in the document, so a search engine can retrieve it accurately. ` +
    `Answer with ONLY that context, no preamble.`
  )
}

function textOf(content: MessageContent): string {
  if (typeof content === 'string') return content
  return content
    .map((b) => (typeof b === 'string' ? b : 'text' in b && typeof b.text === 'string' ? b.text : ''))
    .join('')
}

async function contextualizeOne(parentDoc: string, chunk: string): Promise<string> {
  // Shared document FIRST (the cacheable prefix) with the breakpoint on it;
  // varying instruction+chunk LAST so it never pollutes the cache key.
  const content: CacheableText[] = [
    { type: 'text', text: `<document>\n${parentDoc}\n</document>`, cache_control: { type: 'ephemeral', ttl: '1h' } },
    { type: 'text', text: instruction(chunk) },
  ]
  const res = await model().invoke([new HumanMessage({ content: content as unknown as MessageContent })])
  return textOf(res.content).trim()
}

export interface ContextItem {
  key: string // the chunk's logical id, used as the result-map key
  parentId: string // groups chunks of one document for cache reuse
  parentDoc: string // the whole document text (the cacheable prefix)
  chunk: string // this chunk's raw content
}

// Generate a situating context for each item. Returns key → context ONLY for the
// items that succeeded; a failed item is omitted so the caller indexes it raw and
// the reconciler retries it next run — one flaky LLM call must never abort the
// whole ingest.
export async function contextualize(items: ContextItem[]): Promise<Map<string, string>> {
  const groups = new Map<string, ContextItem[]>()
  for (const it of items) {
    const g = groups.get(it.parentId) ?? []
    g.push(it)
    groups.set(it.parentId, g)
  }
  const queue = [...groups.values()]
  const out = new Map<string, string>()
  let failures = 0
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const group = queue[cursor++]
      for (const it of group) {
        try {
          const ctx = await contextualizeOne(it.parentDoc, it.chunk)
          if (ctx) out.set(it.key, ctx)
        } catch (err) {
          failures++
          console.warn(`  context gen failed for ${it.key}: ${(err as Error).message}`)
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()))
  if (failures > 0) {
    console.warn(`  ${failures} context generation(s) failed — those chunks indexed raw, retried next run.`)
  }
  return out
}
