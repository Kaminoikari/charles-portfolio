// Control-flow tests for the corrective RAG graph, driven by stub nodes so the
// whole topology runs with no API keys. Run with:  npx tsx --test rag/*.test.ts
//
// These verify the three routing outcomes and — critically — that the
// corrective loop actually loops and is capped by config.maxLoops.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Document } from '@langchain/core/documents'
import { buildGraph, answer, streamAnswer, type NodeSet, type StreamEvent } from './graph.js'
import { shouldAnswerFromHistory } from './history.js'
import type { ChatTurn } from './api-helpers.js'
import { detectLanguage } from './language.js'
import { config } from './config.js'

// A stub node set whose `gradeDocuments` is scripted per-test. Counters let each
// test assert how many times retrieve / rewrite actually ran.
function makeNodes(
  grades: Array<'generate' | 'rewrite' | 'off_topic'>,
  triageRoute = 'retrieve',
): {
  nodes: NodeSet
  counts: { retrieve: number; rewrite: number; generate: number; fallback: number; converse: number }
} {
  const counts = { retrieve: 0, rewrite: 0, generate: 0, fallback: 0, converse: 0 }
  let gradeCall = 0
  const doc = new Document({
    pageContent: 'stub',
    metadata: { id: 's1', title: 'Stub', score: 1, locale: 'en', sourceType: 'about' },
  })
  const nodes: NodeSet = {
    // Pass-through triage: always route on to retrieval (the LLM-path tests
    // exercise retrieve→grade; triage's own logic is unit-tested in triage.test).
    triage: async () => ({ route: triageRoute }),
    converse: async () => {
      counts.converse++
      return { answer: 'stub transcript answer', sources: [], outcome: 'converse' }
    },
    retrieve: async () => {
      counts.retrieve++
      return { documents: [doc] }
    },
    gradeDocuments: async () => {
      const route = grades[Math.min(gradeCall, grades.length - 1)]
      gradeCall++
      return { graded: [doc], route }
    },
    rewriteQuery: async (state) => {
      counts.rewrite++
      return { queries: [`rewrite ${counts.rewrite}`], loops: (state.loops ?? 0) + 1 }
    },
    generate: async () => {
      counts.generate++
      return { answer: 'stub answer', sources: [{ id: 's1', title: 'Stub', score: 1, locale: 'en' }], outcome: 'generate' }
    },
    fallback: async () => {
      counts.fallback++
      return { answer: 'no info', sources: [], outcome: 'fallback' }
    },
  }
  return { nodes, counts }
}

test('happy path: grade says generate on first try', async () => {
  const { nodes, counts } = makeNodes(['generate'])
  const res = await answer('What did Charles do at USPACE?', buildGraph(nodes))
  assert.equal(res.answer, 'stub answer')
  assert.equal(counts.retrieve, 1)
  assert.equal(counts.rewrite, 0)
  assert.equal(counts.generate, 1)
  assert.equal(counts.fallback, 0)
  assert.equal(res.sources.length, 1)
  assert.equal(res.outcome, 'generate')
})

test('corrective loop: rewrite once, then generate', async () => {
  const { nodes, counts } = makeNodes(['rewrite', 'generate'])
  const res = await answer('vague question', buildGraph(nodes))
  assert.equal(res.answer, 'stub answer')
  assert.equal(counts.retrieve, 2) // initial + 1 after rewrite
  assert.equal(counts.rewrite, 1)
  assert.equal(counts.generate, 1)
  assert.equal(counts.fallback, 0)
})

test('fallback: keeps failing, capped by maxLoops', async () => {
  const { nodes, counts } = makeNodes(['rewrite']) // always rewrite
  const res = await answer('unanswerable', buildGraph(nodes))
  assert.equal(res.answer, 'no info')
  assert.equal(res.outcome, 'fallback')
  assert.equal(counts.fallback, 1)
  assert.equal(counts.generate, 0)
  // rewrite runs exactly maxLoops times, then routeAfterGrade -> fallback
  assert.equal(counts.rewrite, config.maxLoops)
  assert.equal(counts.retrieve, config.maxLoops + 1)
})

test('off-topic: declines immediately, no rewrite loop', async () => {
  const { nodes, counts } = makeNodes(['off_topic'])
  const res = await answer('What is the capital of Taiwan?', buildGraph(nodes))
  assert.equal(res.answer, 'no info') // fallback message
  assert.equal(counts.fallback, 1)
  assert.equal(counts.generate, 0)
  assert.equal(counts.rewrite, 0) // crucially: NO rewrite loop for off-topic
  assert.equal(counts.retrieve, 1) // retrieved once, then straight to fallback
})

test('triage-answered question reports its outcome, not a sources-derived fallback', async () => {
  // Regression: canned/FAQ answers legitimately carry sources: [], so the old
  // `sources.length > 0 ? generate : fallback` logging mislabeled every one of
  // them as a fallback. The terminal node's own `outcome` is the source of truth.
  const { nodes, counts } = makeNodes(['generate'])
  nodes.triage = async () => ({ answer: 'I am Charles.', sources: [], route: 'answered', outcome: 'canned' })
  const res = await answer('你是誰?', buildGraph(nodes))
  assert.equal(res.answer, 'I am Charles.')
  assert.equal(res.sources.length, 0) // no sources, yet...
  assert.equal(res.outcome, 'canned') // ...NOT a fallback
  assert.equal(counts.retrieve, 0) // never touched RAG
  assert.equal(counts.generate, 0)
  assert.equal(counts.fallback, 0)
})

test('language detection seeds state', async () => {
  assert.equal(detectLanguage('What did he build?'), 'en')
  assert.equal(detectLanguage('他在 USPACE 做了什麼?'), 'zh-TW')
  assert.equal(detectLanguage('彼は何を作りましたか?'), 'ja')

  const { nodes } = makeNodes(['generate'])
  const res = await answer('他的產品風格是什麼?', buildGraph(nodes))
  assert.equal(res.language, 'zh-TW')
})

// A conversational message must never touch retrieval: there is no chunk that
// answers "what did I just ask", so retrieving for it wastes an embedding call
// and lands in grade, which correctly calls it unanswerable and refuses.
test('triage routing to converse answers without retrieving', async () => {
  const { nodes, counts } = makeNodes(['generate'], 'converse')
  const res = await answer('我剛剛問了你什麼?', buildGraph(nodes))
  assert.equal(res.answer, 'stub transcript answer')
  assert.equal(res.outcome, 'converse')
  assert.equal(counts.retrieve, 0)
  assert.equal(counts.generate, 0)
  assert.equal(counts.converse, 1)
})

// --- what streamAnswer seeds the graph with ---------------------------------
// The preprocessing in front of the graph decides WHICH question gets answered,
// and until 2026-07-31 nothing pinned that down: "請回答我剛剛問你的第二個問題"
// went to retrieval as its own literal text and came back about whichever topic
// the search happened to like — the fourth question in one live run, the second
// in the next.

const SESSION: ChatTurn[] = [
  { role: 'user', content: '他在 USPACE 做了什麼?' },
  { role: 'assistant', content: 'USPACE …' },
  { role: 'user', content: '那團隊多大?' },
  { role: 'assistant', content: '15 人 …' },
  { role: 'user', content: '他在工作上怎麼運用 AI?' },
  { role: 'assistant', content: 'AI …' },
  { role: 'user', content: '那個 Playbook 是什麼?' },
  { role: 'assistant', content: 'Playbook …' },
]

// Records what the graph was seeded with, and routes for real so the split
// between the two paths is exercised rather than asserted.
function recordingNodes() {
  const seen: Array<{ question: string; queries: string[] }> = []
  const counts = { converse: 0, retrieve: 0 }
  const nodes: NodeSet = {
    triage: async (state) => {
      seen.push({ question: state.question, queries: state.queries ?? [] })
      return shouldAnswerFromHistory(state.question, state.history ?? [])
        ? { route: 'converse' }
        : { route: 'retrieve' }
    },
    converse: async () => {
      counts.converse++
      return { answer: 'from the transcript', sources: [], outcome: 'converse' }
    },
    retrieve: async () => {
      counts.retrieve++
      return { documents: [] }
    },
    gradeDocuments: async () => ({ graded: [], route: 'generate' }),
    rewriteQuery: async () => ({}),
    generate: async () => ({ answer: 'grounded answer', sources: [], outcome: 'generate' }),
    fallback: async () => ({ answer: 'no info', sources: [], outcome: 'fallback' }),
  }
  return { nodes, seen, counts }
}

function stubDeps() {
  const rewrites: Array<{ question: string; turns: number }> = []
  const deps = {
    contextualize: async (question: string, history: ChatTurn[]) => {
      rewrites.push({ question, turns: history.length })
      return `search:${question}`
    },
    decompose: async () => [],
  }
  return { deps, rewrites }
}

async function drain(gen: AsyncGenerator<StreamEvent>) {
  const events: StreamEvent[] = []
  for await (const ev of gen) events.push(ev)
  return events
}

test('streamAnswer: a request to answer the Nth question replays that question', async () => {
  const { nodes, seen, counts } = recordingNodes()
  const { deps, rewrites } = stubDeps()
  await drain(streamAnswer('請回答我剛剛問你的第二個問題', SESSION, buildGraph(nodes), deps))

  // The graph is asked the earlier question, in the visitor's own words.
  assert.equal(seen[0].question, '那團隊多大?')
  assert.deepEqual(seen[0].queries, ['search:那團隊多大?'])
  // Rewritten against the two turns that preceded it, not the whole session —
  // otherwise "那團隊" binds to the Playbook they asked about last.
  assert.deepEqual(rewrites, [{ question: '那團隊多大?', turns: 2 }])
  assert.equal(counts.retrieve, 1)
  assert.equal(counts.converse, 0)
})

test('streamAnswer: asking WHAT the Nth question was stays on the transcript path', async () => {
  const { nodes, seen, counts } = recordingNodes()
  const { deps, rewrites } = stubDeps()
  const events = await drain(
    streamAnswer('我剛剛問你的第二個問題是什麼?', SESSION, buildGraph(nodes), deps),
  )

  assert.equal(seen[0].question, '我剛剛問你的第二個問題是什麼?')
  assert.deepEqual(seen[0].queries, ['我剛剛問你的第二個問題是什麼?'])
  assert.deepEqual(rewrites, []) // no rewrite: it would erase the reference
  assert.equal(counts.converse, 1)
  assert.equal(counts.retrieve, 0)
  const last = events.at(-1)
  assert.equal(last?.type === 'done' ? last.outcome : null, 'converse')
})

test('streamAnswer: an ordinary follow-up is still rewritten against the whole session', async () => {
  const { nodes, seen, counts } = recordingNodes()
  const { deps, rewrites } = stubDeps()
  await drain(streamAnswer('那個專案解決什麼問題?', SESSION, buildGraph(nodes), deps))

  assert.equal(seen[0].question, '那個專案解決什麼問題?')
  assert.deepEqual(seen[0].queries, ['search:那個專案解決什麼問題?'])
  assert.deepEqual(rewrites, [{ question: '那個專案解決什麼問題?', turns: SESSION.length }])
  assert.equal(counts.retrieve, 1)
})
