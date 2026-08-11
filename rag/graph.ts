// The corrective / agentic RAG pipeline as a LangGraph.js StateGraph.
//
// Flow:
//   START -> triage                              (deterministic, no LLM/embed)
//     personal / canned FAQ        -> END        (answered for $0)
//     otherwise                    -> retrieve -> gradeDocuments
//       route == "generate"          -> generate -> END
//       route == "rewrite" & loops<N -> rewriteQuery -> retrieve  (corrective loop)
//       otherwise                     -> fallback -> END
//
// This file declares the graph topology + the public `answer()` entry point.
// Node implementations live in `nodes.ts`. `buildGraph` accepts node overrides
// so the control flow can be exercised with stubs (no API keys) in tests.
// Requires `@langchain/langgraph` + `@langchain/core` and the runtime secrets in
// docs/rag-chatbot-design.md §10 to actually answer.

import { StateGraph, START, END } from '@langchain/langgraph'

import { config } from './config.js'
import { detectLanguage } from './language.js'
import { RAGState, type RAGStateType, type Source, type Outcome } from './state.js'
import { contextualizeQuestion } from './contextualize.js'
import { shouldAnswerFromHistory, replayTarget } from './history.js'
import { decomposeQuestion } from './decompose.js'
import type { ChatTurn } from './api-helpers.js'
import * as defaultNodes from './nodes.js'

// A node is an (async) function from state to a partial state update.
export type Node = (state: RAGStateType) => Promise<Partial<RAGStateType>>

export interface NodeSet {
  triage: Node
  converse: Node
  retrieve: Node
  gradeDocuments: Node
  rewriteQuery: Node
  generate: Node
  fallback: Node
}

// Conditional edge: triage either answered the question (deterministically, no
// LLM) or passes it on to retrieval.
function routeAfterTriage(state: RAGStateType): 'answered' | 'converse' | 'retrieve' {
  if (state.route === 'answered') return 'answered'
  // Questions about the conversation itself: the corpus has nothing to retrieve
  // for them, so they skip the whole retrieval half (see nodes.ts:converse).
  if (state.route === 'converse') return 'converse'
  return 'retrieve'
}

// Conditional edge: where to go after grading the retrieved chunks.
//   generate    — docs answer the question
//   off_topic   — question isn't about Charles at all → fall back immediately
//                 (skip the rewrite loop; rewriting an off-topic question never
//                 finds Charles data and just burns LLM calls)
//   else        — on-topic but weak retrieval → rewrite and retry, capped
function routeAfterGrade(state: RAGStateType): 'generate' | 'rewriteQuery' | 'fallback' {
  if (state.route === 'generate') return 'generate'
  if (state.route === 'off_topic') return 'fallback'
  if ((state.loops ?? 0) < config.maxLoops) return 'rewriteQuery'
  return 'fallback'
}

export function buildGraph(nodes: NodeSet = defaultNodes) {
  return new StateGraph(RAGState)
    .addNode('triage', nodes.triage)
    .addNode('converse', nodes.converse)
    .addNode('retrieve', nodes.retrieve)
    .addNode('gradeDocuments', nodes.gradeDocuments)
    .addNode('rewriteQuery', nodes.rewriteQuery)
    .addNode('generate', nodes.generate)
    .addNode('fallback', nodes.fallback)
    .addEdge(START, 'triage')
    .addConditionalEdges('triage', routeAfterTriage, {
      answered: END,
      converse: 'converse',
      retrieve: 'retrieve',
    })
    .addEdge('converse', END)
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
  outcome: Outcome
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
    outcome: final.outcome ?? 'fallback',
  }
}

// Streaming entry point for the SSE endpoint. Yields token chunks as the
// generate/fallback node produces them, then a final event carrying sources +
// metadata. Uses LangGraph's streamEvents (v2): we forward chat-model token
// chunks and read the terminal state for sources. Tracing still auto-attaches.
export type StreamEvent =
  | { type: 'token'; text: string }
  // Pipeline trace. One `start` and one matching `done` per node that actually
  // executed — the graph is not a fixed line of stages: triage can answer
  // outright and skip retrieval, and the corrective loop can revisit a node.
  | { type: 'node'; id: GraphNodeId; status: 'start' | 'done'; ms?: number }
  // Sources as soon as a node produces them, ahead of the answer finishing.
  // They also still ride on `done`, which stays the authoritative copy.
  | { type: 'sources'; sources: Source[] }
  | { type: 'done'; sources: Source[]; language: string; loops: number; answer: string; outcome: Outcome }

export type GraphNodeId = keyof NodeSet

// Only these names are reported as pipeline steps. streamEvents also fires
// chain events for the graph itself and for inner runnables (prompts, models,
// parsers); without this allow-list the trace would fill with implementation
// detail nobody asked to see.
const GRAPH_NODE_IDS = new Set<string>([
  'triage',
  'converse',
  'retrieve',
  'gradeDocuments',
  'rewriteQuery',
  'generate',
  'fallback',
])

function asGraphNodeId(value: unknown): GraphNodeId | null {
  return typeof value === 'string' && GRAPH_NODE_IDS.has(value) ? (value as GraphNodeId) : null
}

// The two preprocessing steps, injectable so the seeding logic below can be
// tested without reaching for a model (mirrors buildGraph's node overrides).
export interface StreamDeps {
  contextualize: typeof contextualizeQuestion
  decompose: typeof decomposeQuestion
}
const DEFAULT_DEPS: StreamDeps = {
  contextualize: contextualizeQuestion,
  decompose: decomposeQuestion,
}

export async function* streamAnswer(
  question: string,
  history: ChatTurn[] = [],
  compiled: ReturnType<typeof buildGraph> = graph,
  deps: StreamDeps = DEFAULT_DEPS,
): AsyncGenerator<StreamEvent> {
  // Detect language from the ORIGINAL message (what the visitor typed), then
  // resolve any follow-up into a standalone question the pipeline can retrieve
  // and answer on its own. With no history this is a no-op — first turns cost
  // exactly what they did before. The original text is still what gets logged
  // (see api/chat.ts), so analytics keeps the visitor's verbatim wording.
  const language = detectLanguage(question)
  // A message ASKING ABOUT the conversation skips both preprocessing steps and
  // reaches triage verbatim. Rewriting it would resolve exactly the references
  // that mark it as conversational ("剛剛我說的那兩家公司是哪兩家?" becomes
  // "華碩和鴻海是哪兩家公司?"), so triage would no longer recognise it and would
  // send it to a retrieval that has nothing to find. Decomposing it is pointless
  // for the same reason, and skipping both saves two model calls.
  const fromHistory = shouldAnswerFromHistory(question, history)
  // "請回答我剛剛問你的第二個問題" is a request for an answer, not for a recital,
  // so the pipeline runs the earlier question again under its own words. Which
  // question that is gets counted in history.ts, because leaving the arithmetic
  // to the model made the same request resolve to a different turn run to run.
  // Its own references resolve against the turns that preceded IT — rewriting it
  // against the whole transcript would bind it to the latest topic instead.
  const replay = replayTarget(question, history)
  const asked = replay?.question ?? question
  const query = fromHistory ? asked : await deps.contextualize(asked, replay?.priorTurns ?? history)
  // Gated decomposition: single questions return [] with no LLM call, so the
  // common case is free; a genuine multi-part message is split so retrieve can
  // fan out one search per sub-question (see nodes.ts:retrieve).
  const subQuestions = fromHistory ? [] : await deps.decompose(query)
  let answerText = ''
  let sources: Source[] = []
  let loops = 0
  let outcome: Outcome = 'fallback'

  // `question` carries words the visitor actually typed — this message, or the
  // earlier one they asked us to answer again — and `queries` carries the
  // rewrite. Seeding `question` with the rewrite is what let a rewrite's
  // mistakes become the question being answered: "他在工作上怎麼運用 AI?" was
  // rewritten to "他在 USPACE 帶的團隊怎麼運用 AI?" and answered as such, and the
  // next turn inherited it. The rewrite is a search string; the visitor's words,
  // plus the transcript, are what generation answers.
  const events = compiled.streamEvents(
    { question: asked, language, queries: [query], subQuestions, history },
    { version: 'v2' },
  )

  // Wall-clock per node, keyed by node id. A corrective loop revisits a node,
  // so each `start` overwrites the previous mark and each `done` reports the
  // duration of that pass rather than a running total.
  const startedAt = new Map<GraphNodeId, number>()

  for await (const ev of events) {
    // Token chunks from the user-facing answer node ONLY. The grade/rewrite
    // nodes also run chat models (grade emits structured JSON like
    // {"relevant":true}); without this node filter their tokens would leak into
    // the streamed answer. `langgraph_node` lives on the event metadata (its key
    // has varied across langgraph versions — accept the known aliases).
    const node =
      ev.metadata?.langgraph_node ??
      (ev.metadata as Record<string, unknown> | undefined)?.['langgraph_node'] ??
      ev.name

    // Pipeline trace. `ev.name` is the node's own name on the chain events the
    // graph emits for its nodes; the metadata lookup above resolves to the same
    // name for inner runnables, so match on ev.name to avoid reporting a step
    // once per nested runnable.
    const traced = asGraphNodeId(ev.name)
    if (traced && ev.event === 'on_chain_start') {
      startedAt.set(traced, Date.now())
      yield { type: 'node', id: traced, status: 'start' }
    }

    if (ev.event === 'on_chat_model_stream' && node === 'generate') {
      const chunk = ev.data?.chunk
      const text = typeof chunk?.content === 'string' ? chunk.content : ''
      if (text) {
        answerText += text
        yield { type: 'token', text }
      }
    }
    // When a node finishes, capture any state it produced (sources/answer/loops).
    // The terminal answer comes from generate / triage / fallback; this is the
    // safety net that guarantees a non-empty `answer` on `done` even if token
    // streaming above matched nothing.
    if (ev.event === 'on_chain_end') {
      const raw = ev.data?.output as unknown
      const out = (raw && typeof raw === 'object' ? raw : {}) as Partial<RAGStateType>
      if (Array.isArray(out.sources)) {
        const isNew = out.sources !== sources
        sources = out.sources
        // Push sources the moment a node yields them, so the trace rail can
        // show what retrieval settled on before the answer has finished.
        if (isNew && sources.length > 0) yield { type: 'sources', sources }
      }
      if (typeof out.loops === 'number') loops = out.loops
      if (typeof out.answer === 'string' && out.answer) answerText = out.answer
      if (out.outcome) outcome = out.outcome

      if (traced) {
        const began = startedAt.get(traced)
        yield {
          type: 'node',
          id: traced,
          status: 'done',
          ms: began === undefined ? 0 : Math.max(0, Date.now() - began),
        }
      }
    }
  }

  // Diagnostic: surfaces in Vercel runtime logs so an empty answer is debuggable
  // without reproducing locally. Cheap (one line per request).
  console.log(`[chat] done lang=${language} loops=${loops} outcome=${outcome} answerLen=${answerText.length} sources=${sources.length}`)

  yield { type: 'done', sources, language, loops, answer: answerText, outcome }
}
