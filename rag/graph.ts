// The corrective / agentic RAG pipeline as a LangGraph.js StateGraph.
//
// Flow:
//   START -> retrieve -> gradeDocuments
//     route == "generate"          -> generate -> END
//     route == "rewrite" & loops<N -> rewriteQuery -> retrieve  (corrective loop)
//     otherwise                     -> fallback -> END
//
// This file declares the graph topology + the public `answer()` entry point.
// Node implementations live in `nodes.ts`. `buildGraph` accepts node overrides
// so the control flow can be exercised with stubs (no API keys) in tests.
// Requires `@langchain/langgraph` + `@langchain/core` and the runtime secrets in
// docs/rag-chatbot-design.md §10 to actually answer.

import { StateGraph, START, END } from '@langchain/langgraph'

import { config } from './config'
import { detectLanguage } from './language'
import { RAGState, type RAGStateType, type Source } from './state'
import * as defaultNodes from './nodes'

// A node is an (async) function from state to a partial state update.
export type Node = (state: RAGStateType) => Promise<Partial<RAGStateType>>

export interface NodeSet {
  retrieve: Node
  gradeDocuments: Node
  rewriteQuery: Node
  generate: Node
  fallback: Node
}

// Conditional edge: where to go after grading the retrieved chunks.
function routeAfterGrade(state: RAGStateType): 'generate' | 'rewriteQuery' | 'fallback' {
  if (state.route === 'generate') return 'generate'
  if ((state.loops ?? 0) < config.maxLoops) return 'rewriteQuery'
  return 'fallback'
}

export function buildGraph(nodes: NodeSet = defaultNodes) {
  return new StateGraph(RAGState)
    .addNode('retrieve', nodes.retrieve)
    .addNode('gradeDocuments', nodes.gradeDocuments)
    .addNode('rewriteQuery', nodes.rewriteQuery)
    .addNode('generate', nodes.generate)
    .addNode('fallback', nodes.fallback)
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

export interface AnswerResult {
  answer: string
  sources: Source[]
  language: string
  loops: number
}

// Public entry point. Detects the question's language up front (deterministic,
// so the trace is reproducible) and seeds `queries` with the original question
// so the first `retrieve` has something to search. LangSmith tracing is enabled
// automatically when LANGCHAIN_TRACING_V2 + LANGCHAIN_API_KEY are set in the
// environment — no code change needed.
export async function answer(
  question: string,
  compiled: ReturnType<typeof buildGraph> = graph,
): Promise<AnswerResult> {
  const language = detectLanguage(question)
  const final = await compiled.invoke({
    question,
    language,
    queries: [question],
  })
  return {
    answer: final.answer ?? '',
    sources: final.sources ?? [],
    language: final.language ?? language,
    loops: final.loops ?? 0,
  }
}

// Streaming entry point for the SSE endpoint. Yields token chunks as the
// generate/fallback node produces them, then a final event carrying sources +
// metadata. Uses LangGraph's streamEvents (v2): we forward chat-model token
// chunks and read the terminal state for sources. Tracing still auto-attaches.
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; sources: Source[]; language: string; loops: number; answer: string }

export async function* streamAnswer(
  question: string,
  compiled: ReturnType<typeof buildGraph> = graph,
): AsyncGenerator<StreamEvent> {
  const language = detectLanguage(question)
  let answerText = ''
  let sources: Source[] = []
  let loops = 0

  const events = compiled.streamEvents(
    { question, language, queries: [question] },
    { version: 'v2' },
  )

  for await (const ev of events) {
    // Token chunks from any chat model node (generate / fallback uses none).
    if (ev.event === 'on_chat_model_stream') {
      const chunk = ev.data?.chunk
      const text = typeof chunk?.content === 'string' ? chunk.content : ''
      if (text) {
        answerText += text
        yield { type: 'token', text }
      }
    }
    // When a node finishes, capture any state it produced (sources/answer/loops).
    if (ev.event === 'on_chain_end') {
      const out = ev.data?.output as Partial<RAGStateType> | undefined
      if (out?.sources) sources = out.sources
      if (typeof out?.loops === 'number') loops = out.loops
      if (typeof out?.answer === 'string' && out.answer) answerText = out.answer
    }
  }

  yield { type: 'done', sources, language, loops, answer: answerText }
}
