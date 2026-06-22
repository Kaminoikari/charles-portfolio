// Control-flow tests for the corrective RAG graph, driven by stub nodes so the
// whole topology runs with no API keys. Run with:  npx tsx --test rag/*.test.ts
//
// These verify the three routing outcomes and — critically — that the
// corrective loop actually loops and is capped by config.maxLoops.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Document } from '@langchain/core/documents'
import { buildGraph, answer, type NodeSet } from './graph.js'
import { detectLanguage } from './language.js'
import { config } from './config.js'

// A stub node set whose `gradeDocuments` is scripted per-test. Counters let each
// test assert how many times retrieve / rewrite actually ran.
function makeNodes(grades: Array<'generate' | 'rewrite' | 'off_topic'>): {
  nodes: NodeSet
  counts: { retrieve: number; rewrite: number; generate: number; fallback: number }
} {
  const counts = { retrieve: 0, rewrite: 0, generate: 0, fallback: 0 }
  let gradeCall = 0
  const doc = new Document({
    pageContent: 'stub',
    metadata: { id: 's1', title: 'Stub', score: 1, locale: 'en', sourceType: 'about' },
  })
  const nodes: NodeSet = {
    // Pass-through triage: always route on to retrieval (the LLM-path tests
    // exercise retrieve→grade; triage's own logic is unit-tested in triage.test).
    triage: async () => ({ route: 'retrieve' }),
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
