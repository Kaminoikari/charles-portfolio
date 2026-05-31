// Node implementations for the corrective RAG graph (see graph.ts for topology).
//
// LLM routing (see llm.ts): grade + rewrite are internal steps and run on
// Gemini's free tier only; generate (the user-facing answer) runs on Gemini
// first and falls back to paid Claude on any failure.

import { Document } from '@langchain/core/documents'
import { z } from 'zod'

import { config } from './config.js'
import type { RAGStateType, Source } from './state.js'
import { hybridRetrieve } from './retrieval.js'
import { portfolioMap } from './portfolio-map.js'
import { entityContext } from './entities/graph.js'
import { sanitize } from './guardrails.js'
import { gemini, generateWithFallback } from './llm.js'

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

  const grader = gemini().withStructuredOutput(gradeSchema, { name: 'grade' })
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
  const res = await gemini().invoke([
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

  // Broad/synthetic questions get the stronger model IF we fall back to Claude.
  const broad = /overall|philosophy|style|compare|風格|整體|哲学|全体/i.test(state.question)

  // Multi-hop entity relationships for whatever the question references — the
  // lightweight-graph half of the retrieval (see entities/graph.ts). Empty for
  // questions that mention no known entity, so generic questions pay nothing.
  const entities = entityContext(state.question)
  const entityBlock = entities ? `\n\n${entities}` : ''

  // Tier 1 Gemini (free) → tier 2 Claude (paid) on any Gemini failure.
  const { text } = await generateWithFallback(
    [
      {
        role: 'system',
        content:
          'You answer questions about Charles Chen using ONLY the provided ' +
          'context, portfolio map, and entity relationships. Never invent roles, ' +
          'employers, dates, or credentials. If the context does not contain the ' +
          'answer, say so plainly. Cite sources inline as [n]. Reply in the ' +
          'language of the question.\n\nPortfolio map:\n' +
          portfolioMap +
          entityBlock,
      },
      { role: 'user', content: `Question: ${sanitize(state.question)}\n\nContext:\n${context}` },
    ],
    { strong: broad },
  )

  const sources: Source[] = docs.map((d) => ({
    id: d.metadata.id,
    title: d.metadata.title ?? d.metadata.sourceType,
    score: d.metadata.score ?? 0,
    locale: d.metadata.locale,
  }))

  return { answer: text, sources }
}

// --- fallback ------------------------------------------------------------
// Reached when retrieval keeps failing after maxLoops rewrites. Refusing
// honestly is the correct behavior for a public, identity-bound bot. Replies in
// the question's language so an out-of-corpus zh/ja question doesn't get an
// English refusal.
const FALLBACK: Record<string, string> = {
  en:
    "I couldn't find that in Charles's portfolio. Try asking about his projects " +
    '(Path, Plutus Trade, Product Playbook, House Ops, Job Ops), his work ' +
    'experience, or how he uses AI in his product workflow.',
  'zh-TW':
    '這個問題在 Charles 的作品集裡找不到答案。你可以問問他的專案' +
    '(Path、Plutus Trade、Product Playbook、House Ops、Job Ops)、' +
    '工作經歷,或他如何在產品流程中運用 AI。',
  ja:
    'その内容は Charles のポートフォリオには見つかりませんでした。彼の' +
    'プロジェクト(Path、Plutus Trade、Product Playbook、House Ops、Job Ops)、' +
    '職務経歴、またはプロダクト業務での AI 活用について聞いてみてください。',
}

export async function fallback(state: RAGStateType): Promise<Partial<RAGStateType>> {
  return {
    answer: FALLBACK[state.language ?? 'en'] ?? FALLBACK.en,
    sources: [],
  }
}

// Re-export so a Document type import isn't unused when nodes are tree-shaken.
export type { Document }
