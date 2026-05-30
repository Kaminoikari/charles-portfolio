// Node implementations for the corrective RAG graph (see graph.ts for topology).
//
// Each node takes the current state and returns a partial state update. The
// LLM-using nodes default to the fast model (Haiku) and only escalate to the
// strong model (Sonnet) for the final synthesis of a hard question.

import { ChatAnthropic } from '@langchain/anthropic'
import { Document } from '@langchain/core/documents'
import { z } from 'zod'

import { config } from './config'
import type { RAGStateType, Source } from './state'
import { hybridRetrieve } from './retrieval'
import { portfolioMap } from './portfolio-map'
import { sanitize } from './guardrails'

const fast = () => new ChatAnthropic({ model: config.modelFast, temperature: 0 })
const strong = () => new ChatAnthropic({ model: config.modelStrong, temperature: 0.2 })

// --- retrieve ------------------------------------------------------------
// Hybrid (dense+sparse) → RRF → rerank. Uses the latest query (original or the
// most recent rewrite).
export async function retrieve(state: RAGStateType): Promise<Partial<RAGStateType>> {
  const queries = state.queries?.length ? state.queries : [state.question]
  const query = queries[queries.length - 1]
  const documents = await hybridRetrieve(query, state.language ?? config.defaultLocale)
  return { documents }
}

// --- gradeDocuments ------------------------------------------------------
// CRAG core: an LLM grades whether the retrieved set actually answers the
// question. Sets `route` to "generate" if good enough, else "rewrite".
const gradeSchema = z.object({
  relevant: z
    .boolean()
    .describe('true if the documents collectively can answer the question'),
})

export async function gradeDocuments(state: RAGStateType): Promise<Partial<RAGStateType>> {
  const docs = state.documents ?? []
  if (docs.length === 0) return { graded: [], route: 'rewrite' }

  const grader = fast().withStructuredOutput(gradeSchema, { name: 'grade' })
  const context = docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join('\n\n')
  const { relevant } = await grader.invoke([
    {
      role: 'system',
      content:
        'You assess whether retrieved documents can answer a question about ' +
        "Charles Chen's portfolio. Be lenient — the goal is to filter out " +
        'clearly off-topic retrievals, not to demand perfection.',
    },
    { role: 'user', content: `Question: ${state.question}\n\nDocuments:\n${context}` },
  ])

  return { graded: docs, route: relevant ? 'generate' : 'rewrite' }
}

// --- rewriteQuery --------------------------------------------------------
// Reformulate the question to retrieve better on the next loop. Increments the
// loop counter (the graph caps total loops via config.maxLoops).
export async function rewriteQuery(state: RAGStateType): Promise<Partial<RAGStateType>> {
  const res = await fast().invoke([
    {
      role: 'system',
      content:
        'Rewrite the user question to improve retrieval against a product ' +
        "manager's portfolio (projects, work experience, skills, blog). Keep " +
        'the original language. Return only the rewritten query.',
    },
    { role: 'user', content: state.question },
  ])
  const rewritten = String(res.content).trim()
  return { queries: [rewritten], loops: (state.loops ?? 0) + 1 }
}

// --- generate ------------------------------------------------------------
// Answer grounded ONLY in the graded chunks + the always-injected portfolio map
// (which rescues global "what's his overall style?" questions that chunking
// would otherwise starve). Emits citations + source metadata for the UI.
export async function generate(state: RAGStateType): Promise<Partial<RAGStateType>> {
  const docs = state.graded ?? []
  const context = docs
    .map((d, i) => `[${i + 1}] (${d.metadata.sourceType}) ${d.pageContent}`)
    .join('\n\n')

  // Escalate to the strong model when the question is broad/synthetic.
  const broad = /overall|philosophy|style|compare|風格|整體|哲学|全体/i.test(state.question)
  const llm = broad ? strong() : fast()

  const res = await llm.invoke([
    {
      role: 'system',
      content:
        'You answer questions about Charles Chen using ONLY the provided ' +
        'context and portfolio map. Never invent roles, employers, dates, or ' +
        'credentials. If the context does not contain the answer, say so ' +
        'plainly. Cite sources inline as [n]. Reply in the language of the ' +
        'question.\n\nPortfolio map:\n' +
        portfolioMap,
    },
    { role: 'user', content: `Question: ${sanitize(state.question)}\n\nContext:\n${context}` },
  ])

  const sources: Source[] = docs.map((d) => ({
    id: d.metadata.id,
    title: d.metadata.title ?? d.metadata.sourceType,
    score: d.metadata.score ?? 0,
    locale: d.metadata.locale,
  }))

  return { answer: String(res.content), sources }
}

// --- fallback ------------------------------------------------------------
// Reached when retrieval keeps failing after maxLoops rewrites. Refusing
// honestly is the correct behavior for a public, identity-bound bot.
export async function fallback(state: RAGStateType): Promise<Partial<RAGStateType>> {
  void state
  return {
    answer:
      "I couldn't find that in Charles's portfolio. Try asking about his " +
      'projects (Path, Plutus Trade, Product Playbook, House Ops, Job Ops), ' +
      'his work experience, or how he uses AI in his product workflow.',
    sources: [],
  }
}

// Re-export so a Document type import isn't unused when nodes are tree-shaken.
export type { Document }
