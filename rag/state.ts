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
})

export type RAGStateType = typeof RAGState.State
