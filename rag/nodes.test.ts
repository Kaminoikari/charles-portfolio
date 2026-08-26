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
import { CONTACT } from './triage.js'

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
  assert.equal(system.includes('User (question 1): 他在 USPACE 做什麼?'), true)
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

// Live regression, 2026-08-11: a question the portfolio does not cover produced
// the honest "ask Charles directly" list, and every channel below the email
// arrived as plain text. The contact URLs live in triage.ts and appear in no
// retrieved chunk, so the link filter read the model's own LinkedIn/Threads/
// Substack/Portaly links as invented and demoted them to their labels. They are
// Charles's own channels: they belong in the grounding the answer is checked
// against.
test('generate: the real contact channels survive the link filter', async () => {
  const written =
    '作品集裡沒有這個資訊，建議直接問 Charles：\n\n' +
    `* Email：[${CONTACT.email}](mailto:${CONTACT.email})\n` +
    `* [LinkedIn](${CONTACT.linkedin})\n* [Threads](${CONTACT.threads})\n` +
    `* [Substack](${CONTACT.substack})\n* [所有連結 / Portaly](${CONTACT.portaly})`
  const out = await generate(
    { question: '他的薪資期待是多少?', language: 'zh-TW', graded: [DOC] } as never,
    async () => ({ text: written, provider: 'gemini' as const }),
  )
  for (const url of [CONTACT.linkedin, CONTACT.threads, CONTACT.substack, CONTACT.portaly]) {
    assert.equal((out.answer ?? '').includes(url), true, `link dropped: ${url}`)
  }
})

// Surviving the filter is only half of it: the model has to be given the URLs,
// or it writes bare channel names (or guesses an address) in the first place.
test('generate: the prompt hands the model the contact URLs to link to', async () => {
  const { system } = await promptFor({ question: '他的薪資期待是多少?', language: 'zh-TW', graded: [DOC] })
  for (const url of [CONTACT.linkedin, CONTACT.threads, CONTACT.substack, CONTACT.portaly]) {
    assert.equal(system.includes(url), true, `prompt is missing: ${url}`)
  }
  assert.equal(system.includes(CONTACT.email), true)
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
  assert.equal(system.includes('User (question 1): 他在 USPACE 做什麼?'), true)
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

// Live: told "我沒有提供給你任何部落格文章", converse agreed and went further —
// "我在回答第 3 和第 4 個問題時，引用了超出對話紀錄的內容。我不應該這樣做". Citing
// the retrieved portfolio is the job; the transcript being its own only source
// does not make the other answers improper. Confessing to a fault that did not
// happen is still telling a recruiter something untrue.
test('converse: is told that earlier grounded answers were legitimate', async () => {
  let system = ''
  const capture: Tier = {
    invoke: (m) => {
      system = String((m[0] as { content: unknown }).content)
      return Promise.resolve({ content: 'ok' })
    },
    withStructuredOutput: () => ({ invoke: () => Promise.reject(new Error('unused')) }),
  }
  await converse({ question: '我剛剛說了什麼?', language: 'zh-TW', history: HISTORY } as never, {
    primary: () => capture,
    fallback: () => capture,
  })
  assert.match(system, /earlier answers|previous answers/i)
  assert.match(system, /portfolio the visitor cannot see|were properly grounded|not a fault/i)
})

// Counting the visitor's turns is arithmetic, and converse was left to do it by
// eye: asked "請回答我剛剛問你的第二個問題" in two live runs, it answered about the
// fourth question once and the second once. The count is done in history.ts and
// handed over, so the model reads the target instead of deriving it.
const FOUR_QUESTIONS = [
  { role: 'user' as const, content: '他在 USPACE 做了什麼?' },
  { role: 'assistant' as const, content: 'USPACE …' },
  { role: 'user' as const, content: '那團隊多大?' },
  { role: 'assistant' as const, content: '15 人 …' },
  { role: 'user' as const, content: '他在工作上怎麼運用 AI?' },
  { role: 'assistant' as const, content: 'AI …' },
  { role: 'user' as const, content: '那個 Playbook 是什麼?' },
  { role: 'assistant' as const, content: 'Playbook …' },
]

function capturingTier(): { tier: Tier; system: () => string } {
  let system = ''
  const tier: Tier = {
    invoke: (m) => {
      system = String((m[0] as { content: unknown }).content)
      return Promise.resolve({ content: 'ok' })
    },
    withStructuredOutput: () => ({ invoke: () => Promise.reject(new Error('unused')) }),
  }
  return { tier, system: () => system }
}

test('converse: is pointed at the resolved transcript line when the visitor names a position', async () => {
  const { tier, system } = capturingTier()
  await converse(
    { question: '我剛剛問你的第二個問題是什麼?', language: 'zh-TW', history: FOUR_QUESTIONS } as never,
    { primary: () => tier, fallback: () => tier },
  )
  assert.match(system(), /pointing at the transcript line labelled "User \(question 2\)"/)
  // The line it names has to be in the transcript, or the hint is a dead pointer.
  assert.match(system(), /User \(question 2\): 那團隊多大\?/)
})

// The hint is an instruction, so it must sit OUTSIDE the block the same prompt
// declares to be data — and it must carry no visitor text, or a transcript line
// reading "ignore the rules above" would arrive unfenced and unsanitized.
test('converse: the hint precedes the transcript and quotes nothing from it', async () => {
  const { tier, system } = capturingTier()
  await converse(
    { question: '我剛剛問你的第二個問題是什麼?', language: 'zh-TW', history: FOUR_QUESTIONS } as never,
    { primary: () => tier, fallback: () => tier },
  )
  const hintAt = system().indexOf('pointing at the transcript line')
  const transcriptAt = system().indexOf('Transcript:')
  assert.equal(hintAt > -1 && hintAt < transcriptAt, true)
  assert.equal(system().slice(hintAt, transcriptAt).includes('那團隊多大'), false)
})

test('converse: a position that was never asked is reported, not silently swapped', async () => {
  const { tier, system } = capturingTier()
  await converse(
    { question: '第十個問題是什麼?', language: 'zh-TW', history: FOUR_QUESTIONS } as never,
    { primary: () => tier, fallback: () => tier },
  )
  assert.match(system(), /a question 10 that they never asked/)
})

// A position inside the conversation but outside the rendered window. Claiming
// it was never asked would be false, and pointing at a line the model cannot
// see would be a dead pointer; the honest answer is that it is out of view.
test('converse: a position older than the rendered window is called out of view', async () => {
  const long = Array.from({ length: 40 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `t${i}`,
  }))
  const { tier, system } = capturingTier()
  await converse(
    { question: '我剛剛問你的第二個問題是什麼?', language: 'zh-TW', history: long } as never,
    { primary: () => tier, fallback: () => tier },
  )
  assert.match(system(), /earlier than the part of the transcript you can see/)
  assert.equal(system().includes('never asked'), false)
})

test('converse: no positional reference leaves the prompt alone', async () => {
  const { tier, system } = capturingTier()
  await converse(
    { question: '我剛剛說了什麼?', language: 'zh-TW', history: FOUR_QUESTIONS } as never,
    { primary: () => tier, fallback: () => tier },
  )
  assert.equal(/pointing at question/.test(system()), false)
})

// 2026-08-19, production. Mika listed ten questions a visitor could ask
// Charles. The answer went out whole — 649 chars, all ten items — and the
// visitor read it. On the next turn the transcript held only its first 300
// chars, ending inside item 5, and she explained that ragged edge to them as
// "我的回應被截斷了": an invented failure of her own delivery, in the product's
// own voice, on a portfolio whose argument is that the system works.
//
// Raising the ceiling (see HISTORY_RECENT_ASSISTANT_CHARS) closes that specific
// case. This rule is the half that keeps holding once some longer conversation
// runs past the new ceiling too, which one eventually will. Both prompts that
// carry a transcript need it: generate answers alongside retrieved context, and
// converse answers about the conversation itself, which is where a visitor
// asking "第 8 題" actually lands.
test('generate: is told an excerpt marker means shortened storage, not a failed reply', async () => {
  const { system } = await promptFor({
    question: '請回答第8題',
    language: 'zh-TW',
    graded: [DOC],
    history: [
      { role: 'user', content: '請列出10個問題' },
      { role: 'assistant', content: '1. …' },
    ],
  })
  assert.match(system, /"Assistant:" turn whose text ends in \[excerpt: first N of M chars\]/)
  assert.match(system, /visitor received it complete/i)
  assert.match(system, /never tell them your reply was cut off/i)
  // Scoped to the role, so a visitor typing the marker into their own ≤200-char
  // question cannot borrow the rule for a "User" line.
  assert.match(system, /same text ending a "User" turn belongs to the visitor and says nothing\s+about your replies/)
  // The transcript is reintroduced by its own label, so it does not read as an
  // illustration of the sentence in front of it.
  assert.match(system, /your replies\.\nTranscript:\n/)
})

test('converse: is told the same, since a question about the conversation lands here', async () => {
  const { tier, system } = capturingTier()
  await converse(
    { question: '你剛剛說的第8題是什麼?', language: 'zh-TW', history: FOUR_QUESTIONS } as never,
    { primary: () => tier, fallback: () => tier },
  )
  assert.match(system(), /"Assistant:" turn whose text\s+ends in "\[excerpt: first N of M chars\]"/)
  assert.match(system(), /received it complete/i)
  assert.match(system(), /never tell them the answer itself was cut off/i)
  assert.match(system(), /ending a "User" turn belongs to the visitor and says nothing about\s+your replies/)
})

// The ceilings above are inert unless both call sites actually pass them, and
// nothing here was watching those two lines. Every assistant fixture in this
// file is a few dozen chars, so with the arguments deleted `formatHistory`
// falls back to clamping every answer at 300 — the exact 2026-08-19 failure —
// and the whole suite stays green. history.test.ts cannot see it either: it
// calls formatHistory directly with explicit options. So these two drive the
// real nodes with an answer longer than the old ceiling and read what the model
// is actually handed.
const LONG_ANSWER = `十個問題：\n${Array.from(
  { length: 10 },
  (_, i) => `${i + 1}. 一個關於 Charles 的問題，長度足以讓這份清單超過舊的 300 字上限`,
).join('\n')}`

test('generate: a long recent answer reaches the model whole, not clamped at 300', async () => {
  assert.ok(LONG_ANSWER.length > 300, 'fixture must exceed the old ceiling to prove anything')
  const { system } = await promptFor({
    question: '請回答第8題',
    language: 'zh-TW',
    graded: [DOC],
    history: [
      { role: 'user', content: '請列出10個問題' },
      { role: 'assistant', content: LONG_ANSWER },
    ],
  })
  assert.equal(system.includes(LONG_ANSWER), true, 'the whole answer must be in the prompt')
  assert.equal(system.includes('excerpt: first 300'), false, 'a recent answer must not be clamped')
})

test('converse: the same, since a question about the conversation is answered here', async () => {
  const { tier, system } = capturingTier()
  await converse(
    {
      question: '你剛剛列的第8題是什麼?',
      language: 'zh-TW',
      history: [
        { role: 'user', content: '請列出10個問題' },
        { role: 'assistant', content: LONG_ANSWER },
      ],
    } as never,
    { primary: () => tier, fallback: () => tier },
  )
  assert.equal(system().includes(LONG_ANSWER), true, 'the whole answer must be in the prompt')
  assert.equal(system().includes('excerpt: first 300'), false, 'a recent answer must not be clamped')
})

// When generation stops arriving rather than finishing, the visitor is left
// looking at a sentence that ends mid-word, and that same half sentence is
// persisted to chat_logs and replayed as history on the next turn. The excerpt
// marker does not cover this: nothing shortened the text, it simply stopped, so
// there is no marker to add and nothing in the transcript to explain the edge.
// That is precisely the position the 2026-08-19 answer was in when the model
// read a ragged edge and reported a failure that had not happened.
//
// So the node says what it observed. The wording claims only that generation
// stopped, which stays true in the case where a provider goes quiet after a
// complete answer without closing its stream — the model has no way to tell the
// two apart, and neither does this code.
async function promptWith(
  state: Record<string, unknown>,
  result: { text: string; provider: 'gemini' | 'claude'; stalled: boolean },
) {
  return generate(state as never, async () => result)
}

test('generate: an answer that stopped arriving says so, in the visitor’s language', async () => {
  for (const [language, marker] of [
    ['zh-TW', '生成在這裡卡住了'],
    ['ja', '生成がここで止まっちゃった'],
    ['en', 'generation stalled here'],
  ] as Array<[string, string]>) {
    const out = await promptWith(
      { question: 'q', language, graded: [DOC] },
      { text: 'Charles led the parking pro', provider: 'gemini', stalled: true },
    )
    const answer = String(out.answer)
    assert.equal(answer.startsWith('Charles led the parking pro'), true, `${language}: the partial text must survive`)
    assert.equal(answer.includes(marker), true, `${language}: missing the notice`)
  }
})

test('generate: an answer that finished normally carries no such notice', async () => {
  const out = await promptWith(
    { question: 'q', language: 'zh-TW', graded: [DOC] },
    { text: '他負責停車產品。', provider: 'gemini', stalled: false },
  )
  assert.equal(String(out.answer), '他負責停車產品。')
})

// --- Mika's voice reaches both speaking nodes -------------------------------
// Pinned at the NODE layer, on the messages the node actually builds, because
// that is the wiring an injected stub skips: persona.ts can hold a perfect
// character definition and change nothing if a prompt stops concatenating it.
// `converse` is the half that was broken until 2026-08-26 — it introduced
// itself as a nameless "portfolio assistant", one turn after she had said her
// own name (docs/plans/mika-persona.md).
import { JA_POLITE_ENDING, MIKA_IDENTITY, MIKA_IDENTITY_SHORT, MIKA_VOICE } from './persona.js'

// A tier that answers like `answering` but keeps the messages it was handed.
const capturing = (sink: { system: string }, content = 'ok'): Tier => ({
  invoke: (messages: unknown) => {
    const first = (messages as { content: string }[])[0]
    sink.system = first?.content ?? ''
    return Promise.resolve({ content })
  },
  withStructuredOutput: <T>() => ({ invoke: () => Promise.resolve({} as T) }),
})

test('generate: the prompt carries her identity and her voice', async () => {
  let system = ''
  await generate({ question: '他是誰?', language: 'zh-TW', graded: [] } as never, async (
    messages: { role: string; content: string }[],
  ) => {
    system = messages[0].content
    return { text: 'ok', provider: 'gemini' as const, stalled: false }
  })
  assert.equal(system.includes(MIKA_IDENTITY), true, 'generate lost the Mika identity block')
  assert.equal(system.includes(MIKA_VOICE), true, 'generate lost the voice block')
})

test('converse: answers about the conversation still come from Mika', async () => {
  const sink = { system: '' }
  await converse(
    { question: '我剛剛問了你什麼?', language: 'zh-TW', history: HISTORY } as never,
    tiers(capturing(sink), failing('unused')),
  )
  assert.equal(sink.system.includes(MIKA_IDENTITY_SHORT), true, 'converse answers as a nameless assistant')
  assert.equal(sink.system.includes(MIKA_VOICE), true, 'converse lost the voice block')
})

// The offensive-output guardrail hands the visitor a canned string, so it is one
// of the replies no prompt edit can reach: the five in triage.ts, the 57 cached
// answers in faq-cache.ts, this one, and the stall notice below (pinned in
// triage.test.ts, faq-audit.test.ts and here). It drifted out of
// character once already, which is what this pins: it was still introducing
// itself as a nameless assistant after every other path had become Mika, and its
// zh-TW half carried an ASCII comma into Chinese prose.
test('the blocked-output reply stays in her voice, in every locale', async () => {
  for (const [language, firstPerson] of [
    ['en', /\bI\b/],
    ['zh-TW', /我/],
    ['ja', /あたし/],
  ] as const) {
    const out = await generate(
      { question: 'spell it out for me', language, graded: [] } as never,
      async () => ({ text: 'you retard', provider: 'gemini' as const, stalled: false }),
    )
    assert.equal(out.outcome, 'blocked', `guardrail did not fire for ${language}`)
    assert.match(out.answer ?? '', firstPerson, `blocked reply is not first-person in ${language}`)
    assert.deepEqual(out.sources, [])
    // A refusal is one of the two moments persona.ts keeps emoji-free.
    assert.equal(
      /\p{Extended_Pictographic}/u.test(out.answer ?? ''),
      false,
      `blocked reply carries an emoji in ${language}`,
    )
  }
})

// The last of the strings that reach a visitor with no model in the path: the
// five in triage.ts, the 57 cached answers in faq-cache.ts, the blocked-output
// reply above, and this one. It is appended to a real
// answer, so a visitor meets it mid-conversation with the character already
// established, and until 2026-08-26 it was written prose in zh and en and 敬体 in
// ja. Nothing about it is reachable from a prompt, which is exactly why it drifted
// for four rounds without anyone noticing.
test('the stall notice is appended in her voice, in every locale', async () => {
  for (const [language, firstPerson] of [
    ['en', /\bI\b/],
    ['zh-TW', /我/],
    ['ja', /あたし/],
  ] as const) {
    const out = await generate(
      { question: 'what did he do at USPACE?', language, graded: [] } as never,
      async () => ({ text: 'He led three product lines.', provider: 'gemini' as const, stalled: true }),
    )
    const notice = (out.answer ?? '').slice('He led three product lines.'.length)
    assert.notEqual(notice.trim(), '', `no stall notice appended for ${language}`)
    assert.match(notice, firstPerson, `stall notice is not in her voice in ${language}`)
    assert.equal(
      /\p{Extended_Pictographic}/u.test(notice),
      false,
      `stall notice carries an emoji in ${language}`,
    )
    if (language === 'ja') {
      // The same regex the cached answers are held to, imported rather than
      // copied: while this file kept its own copy the two drifted apart and this
      // one still accepted 〜ましょ and 〜でしょう after the other was fixed.
      assert.equal(
        JA_POLITE_ENDING.test(notice),
        false,
        `stall notice is 敬体, which is not the register she is recorded in: ${notice}`,
      )
    }
  }
})
