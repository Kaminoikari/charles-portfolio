// Control-flow tests for the corrective RAG graph, driven by stub nodes so the
// whole topology runs with no API keys. Run with:  npx tsx --test rag/*.test.ts
//
// These verify the three routing outcomes and — critically — that the
// corrective loop actually loops and is capped by config.maxLoops.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Document } from '@langchain/core/documents'
import { buildGraph, answer, type NodeSet } from './graph'
import { detectLanguage } from './language'
import { config } from './config'

// A stub node set whose `gradeDocuments` is scripted per-test. Counters let each
// test assert how many times retrieve / rewrite actually ran.
function makeNodes(grades: Array<'generate' | 'rewrite'>): {
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
      return { answer: 'stub answer', sources: [{ id: 's1', title: 'Stub', score: 1, locale: 'en' }] }
    },
    fallback: async () => {
      counts.fallback++
      return { answer: 'no info', sources: [] }
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
  assert.equal(counts.fallback, 1)
  assert.equal(counts.generate, 0)
  // rewrite runs exactly maxLoops times, then routeAfterGrade -> fallback
  assert.equal(counts.rewrite, config.maxLoops)
  assert.equal(counts.retrieve, config.maxLoops + 1)
})

test('language detection seeds state', async () => {
  assert.equal(detectLanguage('What did he build?'), 'en')
  assert.equal(detectLanguage('他在 USPACE 做了什麼?'), 'zh-TW')
  assert.equal(detectLanguage('彼は何を作りましたか?'), 'ja')

  const { nodes } = makeNodes(['generate'])
  const res = await answer('他的產品風格是什麼?', buildGraph(nodes))
  assert.equal(res.language, 'zh-TW')
})
