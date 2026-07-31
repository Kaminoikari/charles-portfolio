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

import { gradeDocuments, rewriteQuery, converse, triage, generate } from './nodes.js'
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

// --- conversational path ---------------------------------------------------
// "我剛剛問了什麼" has no answer in the corpus, so the normal pipeline retrieves
// nothing, grades it unanswerable and refuses — while the answer was sitting in
// the history the request already carried. These pin the separate route.

const HISTORY = [
  { role: 'user' as const, content: '他在 USPACE 做什麼?' },
  { role: 'assistant' as const, content: 'Charles 在 USPACE 帶 15 人的 Scrum 團隊。' },
]

test('triage: a conversational message with history routes to converse', async () => {
  const out = await triage({ question: '我剛剛問了你什麼?', language: 'zh-TW', history: HISTORY } as never)
  assert.equal(out.route, 'converse')
})

test('triage: the same message with no history takes the normal path', async () => {
  // Nothing to answer from, so it must not claim a memory it does not have.
  const out = await triage({ question: '我剛剛問了你什麼?', language: 'zh-TW', history: [] } as never)
  assert.notEqual(out.route, 'converse')
})

test('converse: answers from the transcript, falling back to Claude', async () => {
  const out = await converse(
    { question: '我剛剛問了你什麼?', language: 'zh-TW', history: HISTORY } as never,
    tiers(failing('[429] quota exceeded'), answering('你剛剛問的是他在 USPACE 做什麼。')),
  )
  assert.equal(out.answer, '你剛剛問的是他在 USPACE 做什麼。')
  assert.equal(out.outcome, 'converse')
  assert.deepEqual(out.sources, [])
})

test('converse: both tiers down still answers, without inventing anything', async () => {
  const out = await converse(
    { question: '我剛剛問了你什麼?', language: 'zh-TW', history: HISTORY } as never,
    tiers(failing('gemini 429'), failing('claude 529')),
  )
  assert.equal(out.outcome, 'fallback')
  assert.equal(typeof out.answer, 'string')
  assert.equal((out.answer ?? '').length > 0, true)
})

// The generation prompt carries the transcript too, so a follow-up that DOES
// retrieve something still reads as part of a thread. Asserted on the real node
// by capturing the messages it hands the generator: the block is easy to add and
// just as easy to drop in a later prompt edit, and nothing else would notice.
test('generate: the prompt carries the transcript, marked as uncitable', async () => {
  let system = ''
  await generate({ question: '那團隊多大?', language: 'zh-TW', history: HISTORY, graded: [] } as never, async (
    messages: { role: string; content: string }[],
  ) => {
    system = messages[0].content
    return { text: '15 人。', provider: 'gemini' as const }
  })
  assert.equal(system.includes('User: 他在 USPACE 做什麼?'), true)
  assert.equal(system.includes('Assistant: Charles 在 USPACE 帶 15 人的 Scrum 團隊。'), true)
  // It must be fenced off from the citation rules, or the model starts citing it.
  assert.match(system, /never be cited/)
})

test('generate: a first turn carries no transcript block at all', async () => {
  let system = ''
  await generate({ question: '他在 USPACE 做什麼?', language: 'zh-TW', history: [], graded: [] } as never, async (
    messages: { role: string; content: string }[],
  ) => {
    system = messages[0].content
    return { text: 'ok', provider: 'gemini' as const }
  })
  assert.equal(system.includes('Recent conversation'), false)
})

// --- prompt hygiene --------------------------------------------------------
// From today's transcript: asked "為什麼你是用英文回答", the bot replied "我注意到
// 你貼了一段長的背景資料" and later "你提供的那些部落格文章內容…確實反映了 Charles
// 的思考方式", then admitted "我憑空捏造了一些內容，然後假裝你提供過". Nothing was
// pasted. The retrieved chunks were sitting inside the USER turn, so from the
// model's side the visitor had indeed just sent it several blog articles.
const DOC = {
  pageContent: 'Charles writes about the automation trap in his blog.',
  metadata: { sourceType: 'blog', id: 'b1', title: 'Blog', score: 1, locale: 'zh-TW' },
}

async function promptFor(state: Record<string, unknown>) {
  let messages: { role: string; content: string }[] = []
  await generate(state as never, async (m: { role: string; content: string }[]) => {
    messages = m
    return { text: 'ok', provider: 'gemini' as const }
  })
  return { system: messages[0].content, user: messages[messages.length - 1].content }
}

test('generate: the visitor turn holds the question alone, never the retrieved context', async () => {
  const { user } = await promptFor({ question: '為什麼你是用英文回答', language: 'zh-TW', graded: [DOC] })
  assert.equal(user.includes('automation trap'), false)
  assert.equal(user.includes('Context:'), false)
  assert.equal(user.trim(), '為什麼你是用英文回答')
})

test('generate: the context is carried as retrieved material, not as the visitor’s', async () => {
  const { system } = await promptFor({ question: '他寫過什麼?', language: 'zh-TW', graded: [DOC] })
  assert.equal(system.includes('automation trap'), true)
  // The rule that stops "你提供的那些部落格文章".
  assert.match(system, /did not provide|never describe .* as something the visitor/i)
})

test('generate: the reply language is named, not left to inference', async () => {
  const zh = await promptFor({ question: '他做什麼?', language: 'zh-TW', graded: [DOC] })
  assert.match(zh.system, /Traditional Chinese/)
  const ja = await promptFor({ question: '何をしましたか?', language: 'ja', graded: [DOC] })
  assert.match(ja.system, /Japanese/)
  const en = await promptFor({ question: 'What did he do?', language: 'en', graded: [DOC] })
  assert.match(en.system, /English/)
})

test('generate: an invented link is demoted before the answer leaves the node', async () => {
  const out = await generate(
    { question: '他的作品集在哪?', language: 'zh-TW', graded: [DOC] } as never,
    async () => ({ text: '查看他的[作品集](https://charleschen.tw)。', provider: 'gemini' as const }),
  )
  assert.equal((out.answer ?? '').includes('charleschen.tw'), false)
  assert.equal((out.answer ?? '').includes('作品集'), true)
})

test('converse: an invented link is demoted there too', async () => {
  const out = await converse(
    { question: '我剛剛說了什麼?', language: 'zh-TW', history: HISTORY } as never,
    tiers(failing('429'), answering('你剛剛問了 [這個](https://charleschen.tw)。')),
  )
  assert.equal((out.answer ?? '').includes('charleschen.tw'), false)
})

// Live regression, 2026-07-31: "他在工作上怎麼運用 AI?" — already a complete
// question — was rewritten into "他在 USPACE 帶的團隊怎麼運用 AI?" and answered as
// such, and the next turn inherited the distortion, describing Product Playbook
// as something built for that team. The rewrite exists so retrieval has a
// standalone string to embed; it was never meant to replace the visitor's
// words. Generation reads the original and resolves references from the
// transcript, which it now has.
test('generate: answers the visitor’s own words, not the retrieval rewrite', async () => {
  const { user, system } = await promptFor({
    question: '他在工作上怎麼運用 AI?',
    queries: ['他在 USPACE 帶的團隊怎麼運用 AI?'],
    language: 'zh-TW',
    history: HISTORY,
    graded: [DOC],
  })
  assert.equal(user.trim(), '他在工作上怎麼運用 AI?')
  assert.equal(user.includes('USPACE 帶的團隊'), false)
  // The transcript is what lets it resolve references without the rewrite.
  assert.equal(system.includes('User: 他在 USPACE 做什麼?'), true)
})

test('gradeDocuments: grades against the retrieval query, which is what was searched', async () => {
  let prompt = ''
  const capture: Tier = {
    invoke: (m) => {
      prompt = m.map((x) => String((x as { content: unknown }).content)).join('\n')
      return Promise.resolve({ content: 'answerable' })
    },
    withStructuredOutput: () => ({ invoke: () => Promise.reject(new Error('force text tier')) }),
  }
  await gradeDocuments(
    { question: '那團隊多大?', queries: ['Charles 在 USPACE 帶的團隊多大?'], documents: DOCS } as never,
    { primary: () => failing('429'), fallback: () => capture },
  )
  assert.equal(prompt.includes('Charles 在 USPACE 帶的團隊多大?'), true)
})
