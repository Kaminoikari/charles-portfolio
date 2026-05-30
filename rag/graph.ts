// The corrective / agentic RAG pipeline as a LangGraph.js StateGraph.
//
// Flow:
//   START -> retrieve -> gradeDocuments
//     route == "generate"          -> generate -> END
//     route == "rewrite" & loops<N -> rewriteQuery -> retrieve  (corrective loop)
//     otherwise                     -> fallback -> END
//
// This file declares only the graph topology so the control flow is readable at
// a glance. Node implementations live in `nodes.ts`. Requires
// `@langchain/langgraph` + `@langchain/core` and the runtime secrets in
// docs/rag-chatbot-design.md §10 to execute.

import { StateGraph, START, END } from '@langchain/langgraph'

import { config } from './config'
import { RAGState, type RAGStateType } from './state'
import { retrieve, gradeDocuments, rewriteQuery, generate, fallback } from './nodes'

// Conditional edge: where to go after grading the retrieved chunks.
function routeAfterGrade(state: RAGStateType): 'generate' | 'rewriteQuery' | 'fallback' {
  if (state.route === 'generate') return 'generate'
  if ((state.loops ?? 0) < config.maxLoops) return 'rewriteQuery'
  return 'fallback'
}

export function buildGraph() {
  return new StateGraph(RAGState)
    .addNode('retrieve', retrieve)
    .addNode('gradeDocuments', gradeDocuments)
    .addNode('rewriteQuery', rewriteQuery)
    .addNode('generate', generate)
    .addNode('fallback', fallback)
    .addEdge(START, 'retrieve')
    .addEdge('retrieve', 'gradeDocuments')
    .addConditionalEdges('gradeDocuments', routeAfterGrade, {
      generate: 'generate',
      rewriteQuery: 'rewriteQuery',
      fallback: 'fallback',
    })
    .addEdge('rewriteQuery', 'retrieve') // corrective loop
    .addEdge('generate', END)
    .addEdge('fallback', END)
    .compile()
}

// Module-level singleton so the API route imports a ready-compiled graph.
export const graph = buildGraph()
