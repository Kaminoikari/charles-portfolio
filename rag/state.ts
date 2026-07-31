// Graph state schema for the corrective RAG pipeline (LangGraph.js).
//
// `queries` uses an append reducer so the original question + every rewrite are
// all preserved in the LangSmith trace; the rest are last-write-wins channels.

import { Annotation } from '@langchain/langgraph'
import type { Document } from '@langchain/core/documents'
import type { ChatTurn } from './api-helpers.js'

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
  // Standalone sub-questions for a multi-part message. Empty for a single
  // question — the retrieve node fans out only when this has 2+ entries. Set once
  // up front (see graph.ts); last-write-wins.
  subQuestions: Annotation<string[]>({ reducer: (_a, b) => b, default: () => [] }),
  // Recent conversation, clamped by the API layer. Read by the converse node
  // (which answers from it) and by generate (which uses it to keep a follow-up
  // coherent). Empty on a first turn, which is why every reader must treat an
  // empty transcript as "no memory" rather than as "nothing was said".
  history: Annotation<ChatTurn[]>({ reducer: (_a, b) => b, default: () => [] }),
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
//   converse — answered from the conversation transcript, no retrieval
//   blocked  — generation produced offensive output, dropped by the guardrail
//   fallback — retrieval failed after the corrective loop; honest refusal
export type Outcome = 'canned' | 'faq' | 'generate' | 'converse' | 'blocked' | 'fallback'

export type RAGStateType = typeof RAGState.State
