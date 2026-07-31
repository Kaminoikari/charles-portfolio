// Provider-fallback tests for the two internal steps that live in nodes.ts.
//
// Both used to be Gemini-only, so a 429 on the 20/day free tier silently turned
// them off: grade waved every retrieval through, rewrite kept the query it was
// asked to improve. Neither is a hard gate, so the request still answered — just
// worse, with nothing on screen to say why. These lock in that the paid tier
// picks the work up, and that a total provider outage still degrades safely.
// Model tiers are injected, so no network call and no API key.
//   npx tsx --test rag/nodes.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gradeDocuments, rewriteQuery } from './nodes.js'
import { resolveTiers, DEFAULT_TIERS, type Tier, type Tiers } from './llm.js'

// A tier that fails the way a quota-exhausted Gemini does.
const failing = (message: string): Tier => ({
  invoke: () => Promise.reject(new Error(message)),
  withStructuredOutput: () => ({ invoke: () => Promise.reject(new Error(message)) }),
})
// A tier that answers: `content` for plain invoke, `structured` for the
// structured-output wrapper grade/decompose use.
const answering = (content: string, structured: unknown = {}): Tier => ({
  invoke: () => Promise.resolve({ content }),
  withStructuredOutput: <T>() => ({ invoke: () => Promise.resolve(structured as T) }),
})

const tiers = (primary: Tier, fallback: Tier): Tiers => ({
  primary: () => primary,
  fallback: () => fallback,
})

const DOCS = [{ pageContent: 'Charles worked at USPACE.', metadata: {} }]

// grade and rewrite are graph nodes, and LangGraph invokes a node as
// `node(state, config)`. That RunnableConfig lands in the same slot the tests
// use for stub tiers, so without a guard production would run every grade and
// rewrite against a config object: both tiers throw, the node degrades, and the
// symptom is indistinguishable from the provider being down. Verified against
// the installed LangGraph — its second argument carries keys like
// `configurable` / `signal` / `writer`.
test('resolveTiers: a LangGraph RunnableConfig never passes for tiers', () => {
  const config = { configurable: {}, signal: new AbortController().signal, writer: () => {} }
  assert.equal(resolveTiers(config), DEFAULT_TIERS)
  assert.equal(resolveTiers(undefined), DEFAULT_TIERS)
  // A half-built object is not tiers either — both factories must be present.
  assert.equal(resolveTiers({ primary: () => failing('x') }), DEFAULT_TIERS)

  const real = tiers(failing('a'), failing('b'))
  assert.equal(resolveTiers(real), real)
})

test('gradeDocuments: falls back to Claude when Gemini is quota-exhausted', async () => {
  const out = await gradeDocuments(
    { question: '天氣如何?', documents: DOCS } as never,
    tiers(failing('[429] quota exceeded'), answering('', { verdict: 'off_topic' })),
  )
  // Without the fallback the grader is skipped and everything routes to generate.
  assert.equal(out.route, 'off_topic')
})

test('gradeDocuments: both tiers down still passes docs through to generate', async () => {
  const out = await gradeDocuments(
    { question: '他在 USPACE 做什麼?', documents: DOCS } as never,
    tiers(failing('gemini 429'), failing('claude 529')),
  )
  assert.equal(out.route, 'generate')
  assert.deepEqual(out.graded, DOCS)
})

test('rewriteQuery: falls back to Claude when Gemini is quota-exhausted', async () => {
  const out = await rewriteQuery(
    { question: '他做了什麼?', loops: 0 } as never,
    tiers(failing('[429] quota exceeded'), answering('Charles Chen 的工作經歷與專案')),
  )
  assert.deepEqual(out.queries, ['Charles Chen 的工作經歷與專案'])
  assert.equal(out.loops, 1)
})

test('rewriteQuery: both tiers down keeps the original query', async () => {
  const out = await rewriteQuery(
    { question: '他做了什麼?', loops: 0 } as never,
    tiers(failing('gemini 429'), failing('claude 529')),
  )
  assert.deepEqual(out.queries, ['他做了什麼?'])
  assert.equal(out.loops, 1)
})
