// Graph state schema for the corrective RAG pipeline (LangGraph.js).
//
// `queries` uses an append reducer so the original question + every rewrite are
// all preserved in the LangSmith trace; the rest are last-write-wins channels.

import { Annotation } from '@langchain/langgraph'
import type { Document } from '@langchain/core/documents'

export interface Source {
  id: string
  title: string
  score: number
  locale: string
  // Public page this source links to, or null when it has none (see sourceUrl).
  url?: string | null
}

export const RAGState = Annotation.Root({
  question: Annotation<string>,
  language: Annotation<string>, // detected: en | zh-TW | ja
  queries: Annotation<string[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  documents: Annotation<Document[]>, // current candidate set
  graded: Annotation<Document[]>, // relevance-filtered candidates
  loops: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  answer: Annotation<string>,
  sources: Annotation<Source[]>,
  route: Annotation<string>, // set by gradeDocuments: generate | rewrite
  // How the question was ultimately answered, set by whichever terminal node
  // produces the final answer. This is the analytics source of truth — it must
  // NOT be re-derived from sources.length downstream, because canned/FAQ answers
  // legitimately carry no sources yet are NOT fallbacks.
  outcome: Annotation<Outcome>,
})

// Terminal answer paths, distinct for analytics:
//   canned   — triage tier-1 deterministic (greeting / contact / privacy)
//   faq      — semantic FAQ-cache hit (answered for $0, no generation LLM)
//   generate — full RAG generation grounded in retrieved chunks
//   blocked  — generation produced offensive output, dropped by the guardrail
//   fallback — retrieval failed after the corrective loop; honest refusal
export type Outcome = 'canned' | 'faq' | 'generate' | 'blocked' | 'fallback'

export type RAGStateType = typeof RAGState.State
