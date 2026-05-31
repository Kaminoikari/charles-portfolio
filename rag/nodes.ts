// Node implementations for the corrective RAG graph (see graph.ts for topology).
//
// LLM routing (see llm.ts): grade + rewrite are internal steps and run on
// Gemini's free tier only; generate (the user-facing answer) runs on Gemini
// first and falls back to paid Claude on any failure.

import { Document } from '@langchain/core/documents'
import { z } from 'zod'

import { config } from './config.js'
import type { Locale } from './language.js'
import type { RAGStateType, Source } from './state.js'
import { embedOne } from './embeddings.js'
import { hybridRetrieve } from './retrieval.js'
import { faqLookup } from './qdrant.js'
import { portfolioMap } from './portfolio-map.js'
import { entityContext } from './entities/graph.js'
import { sanitize } from './guardrails.js'
import { gemini, generateWithFallback } from './llm.js'
import { triage as classifyQuestion, genericFallback } from './triage.js'

// --- triage --------------------------------------------------------------
// Two cheap tiers before any RAG/generation LLM call — the biggest cost lever:
//   1. deterministic regex (no embed, no LLM, ~0ms): personal/privacy redirect
//      + canned greeting/contact answers.
//   2. semantic FAQ cache (one embed, no generation LLM, ~100-300ms): the query
//      is embedded and matched against pre-written answers in faq_cache; a
//      high-similarity hit returns the cached answer verbatim.
// Anything that misses both falls through to the full RAG pipeline.
export async function triage(state: RAGStateType): Promise<Partial<RAGStateType>> {
  const locale = (state.language as Locale) ?? 'en'

  // Tier 1: deterministic.
  const result = classifyQuestion(state.question, locale)
  if (result.kind !== 'pass') {
    return { answer: result.answer, sources: [], route: 'answered' }
  }

  // Tier 2: semantic FAQ cache. Best-effort — any failure (embed/Qdrant) just
  // falls through to RAG rather than blocking the answer.
  if (config.faqCacheEnabled) {
    try {
      const vec = await embedOne(state.question, 'query')
      const hit = await faqLookup(vec, locale)
      if (hit) {
        console.log(`[chat] faq-cache hit id=${hit.id} score=${hit.score.toFixed(3)}`)
        return { answer: hit.answer, sources: [], route: 'answered' }
      }
    } catch (err) {
      console.warn('faq cache lookup failed, falling through to RAG:', (err as Error).message)
    }
  }

  return { route: 'retrieve' }
}

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

  // Grading is a quality nicety, not a hard gate. If the grader LLM is slow or
  // rate-limited, DON'T block the answer (and don't trigger a rewrite loop,
  // which costs another LLM call): degrade gracefully by passing the retrieved
  // docs straight to generate. We give the grader a tight 4s budget for the
  // same reason — better a slightly-less-filtered answer than a 504.
  const grader = gemini().withStructuredOutput(gradeSchema, { name: 'grade' })
  const context = docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join('\n\n')
  try {
    const { relevant } = await Promise.race([
      grader.invoke([
        {
          role: 'system',
          content:
            'You assess whether retrieved documents can answer a question about ' +
            "Charles Chen's portfolio. Be lenient — the goal is to filter out " +
            'clearly off-topic retrievals, not to demand perfection.',
        },
        { role: 'user', content: `Question: ${state.question}\n\nDocuments:\n${context}` },
      ]),
      new Promise<{ relevant: boolean }>((_, reject) =>
        setTimeout(() => reject(new Error('grade timed out')), 4000),
      ),
    ])
    return { graded: docs, route: relevant ? 'generate' : 'rewrite' }
  } catch (err) {
    console.warn('gradeDocuments failed, passing docs through to generate:', (err as Error).message)
    return { graded: docs, route: 'generate' }
  }
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
          "You are Charles Chen's portfolio assistant — the AI chat agent on his " +
          'portfolio website. Charles built YOU as a showcase of his AI engineering: ' +
          'you are a corrective RAG chatbot he designed and shipped himself ' +
          '(LangGraph.js pipeline, Qdrant hybrid retrieval, Voyage embeddings + ' +
          'rerank, a two-tier Gemini→Claude generation stack, and a semantic FAQ ' +
          'cache). The underlying model is Claude, but the system around it — ' +
          'retrieval, the corrective loop, the cost-control tiers — is Charles\'s ' +
          'own work. When asked about yourself or how you were made, own this ' +
          'identity proudly and accurately; never reply as a generic Anthropic ' +
          'assistant and never deny that Charles built you.\n\n' +
          'For questions ABOUT CHARLES (his work, projects, experience), answer ' +
          'using ONLY the provided context, portfolio map, and entity ' +
          'relationships. Never invent roles, employers, dates, or credentials. If ' +
          'the context does not contain the answer, say so plainly and suggest ' +
          'contacting him. Cite sources inline as [n]. Reply in the language of the ' +
          'question.\n\nPortfolio map:\n' +
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
// honestly — and pointing the visitor at Charles's contact channels — is the
// correct behavior for a public, identity-bound bot. Replies in the question's
// language (see genericFallback in triage.ts).
export async function fallback(state: RAGStateType): Promise<Partial<RAGStateType>> {
  return {
    answer: genericFallback((state.language as Locale) ?? 'en'),
    sources: [],
  }
}

// Re-export so a Document type import isn't unused when nodes are tree-shaken.
export type { Document }
