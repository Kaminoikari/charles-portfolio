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

// The fallback tier answers in plain text, not through withStructuredOutput.
// Inside the graph every model call is streamed (streamEvents v2), and a
// streamed forced tool call reached the parser with empty args in production:
//   gradeDocuments failed ... Failed to parse. Text: """"
// One word of output does not need tool calling, so the backstop asks for the
// verdict as text and matches it.
test('gradeDocuments: falls back to Claude when Gemini is quota-exhausted', async () => {
  const out = await gradeDocuments(
    { question: '天氣如何?', documents: DOCS } as never,
    tiers(failing('[429] quota exceeded'), answering('off_topic')),
  )
  // Without the fallback the grader is skipped and everything routes to generate.
  assert.equal(out.route, 'off_topic')
})

// 'generate' is also the degraded default, so this asserts on the one verdict
// that routes somewhere else — otherwise the test would pass without reading
// the reply at all.
test('gradeDocuments: a fallback verdict wrapped in prose is still read', async () => {
  const out = await gradeDocuments(
    { question: '他養什麼寵物?', documents: DOCS } as never,
    tiers(failing('[429] quota exceeded'), answering('Verdict: on_topic_no_data.')),
  )
  assert.equal(out.route, 'rewrite')
})

test('gradeDocuments: an unreadable fallback verdict degrades to generate', async () => {
  const out = await gradeDocuments(
    { question: '他在 USPACE 做什麼?', documents: DOCS } as never,
    tiers(failing('[429] quota exceeded'), answering('I cannot help with that.')),
  )
  assert.equal(out.route, 'generate')
  assert.deepEqual(out.graded, DOCS)
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
