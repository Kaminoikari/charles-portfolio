// The conversational gate decides which messages get answered from the
// transcript instead of from retrieval. It has to be precise in both
// directions: a miss sends "我剛剛問了什麼" into a vector search that cannot
// possibly answer it, and a false positive sends a real portfolio question to a
// node that has no documents.
//   npx tsx --test rag/history.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  looksConversational,
  excerpt,
  formatHistory,
  shouldAnswerFromHistory,
  ordinalReference,
  replayTarget,
} from './history.js'

test('looksConversational: fires on questions whose answer is the conversation', () => {
  for (const q of [
    '你記得我剛剛說的話嗎',
    '請重複我剛剛說的話',
    '我第一輪問題問了你什麼',
    '你還記得我剛剛問你的問題嗎？請重複一遍',
    '剛剛我說的那兩家公司是哪兩家？',
    '我上面已經問過你很多問題了',
    'What did I just ask you?',
    'Can you repeat what I said?',
    'Do you remember my first question?',
    'さっき何を聞いたか覚えていますか',
  ]) {
    assert.equal(looksConversational(q), true, `should fire: ${q}`)
  }
})

test('looksConversational: does not fire on real portfolio questions', () => {
  for (const q of [
    '他在 USPACE 做了什麼?',
    '他在工作上怎麼運用 AI?',
    '你是怎麼被打造出來的?',
    '他如何做產品決策?',
    '那個專案解決什麼問題?',
    '為什麼團隊該錄取他?',
    'What did he do at USPACE?',
    'How does he make product decisions?',
    'How were you built?',
    'USPACE で何をしましたか?',
  ]) {
    assert.equal(looksConversational(q), false, `should not fire: ${q}`)
  }
})

test('formatHistory: keeps the last turns and truncates assistant answers', () => {
  const turns = [
    { role: 'user' as const, content: 'q1' },
    { role: 'assistant' as const, content: 'a'.repeat(500) },
    { role: 'user' as const, content: 'q2' },
  ]
  const out = formatHistory(turns, { maxTurns: 2, assistantChars: 10 })
  // Only the last 2 turns survive, so q1 is gone.
  assert.equal(out.includes('q1'), false)
  assert.equal(out.includes('User (question 2): q2'), true)
  assert.equal(out.includes(`Assistant: ${'a'.repeat(10)}…`), true)
  assert.equal(out.includes('a'.repeat(11)), false)
  // Shortening it is fine; hiding that it was shortened is not.
  assert.match(out, /excerpt: first 10 of 500 chars/)
})

test('formatHistory: no turns is an empty string, never a stray label', () => {
  assert.equal(formatHistory([], { maxTurns: 6, assistantChars: 300 }), '')
})

// streamAnswer and triage both gate on this. They have to agree: if the rewrite
// step does not skip a conversational message, contextualize resolves its
// referents and the rewritten text no longer matches the gate triage reads —
// which is exactly how "剛剛我說的那兩家公司是哪兩家?" reached retrieval and got
// refused in production, while "請重複我剛剛說的話" (which the rewriter left
// alone) came through fine.
test('shouldAnswerFromHistory: needs both a conversational message and a transcript', () => {
  const h = [{ role: 'user' as const, content: '他在 USPACE 做什麼?' }]
  assert.equal(shouldAnswerFromHistory('剛剛我說的那兩家公司是哪兩家？', h), true)
  assert.equal(shouldAnswerFromHistory('剛剛我說的那兩家公司是哪兩家？', []), false)
  assert.equal(shouldAnswerFromHistory('他在 USPACE 做什麼?', h), false)
})

// Phrasings from today's transcript that fell through to retrieval and came
// back as invention or refusal.
test('looksConversational: covers corrections and questions about the visitor’s own message', () => {
  for (const q of [
    '那你知道為什麼我問這句話嗎',
    '我沒有提供給你任何部落格文章',
    '不對，是因為你剛剛用英文回答我，所以我才問了那句話',
    '你剛剛用英文回答我',
  ]) {
    assert.equal(looksConversational(q), true, `should fire: ${q}`)
  }
})

// "Answer my earlier question" is the opposite instruction: the visitor wants
// the portfolio answer they never got, not a recital of what they asked. That
// one belongs in the rewrite-and-retrieve path, which resolves it into the
// earlier question.
test('looksConversational: a request to ANSWER the earlier question is not conversational', () => {
  for (const q of [
    '請回答我剛剛的問題',
    '請回答我剛剛問你的問題',
    '那所以你現在要回答我的問題了嗎',
    'Please answer my previous question',
  ]) {
    assert.equal(looksConversational(q), false, `should not fire: ${q}`)
  }
})

// A 6-turn window is three exchanges, and the visitor asking "what did I ask
// first" on their fifth question is past it. Live run, 2026-07-31: the bot
// answered with the earliest turn it could still see and presented it as the
// first, then apologised for an error that never happened. The window has to be
// wide enough to cover a real session, and what falls off it has to be visible
// to the reader rather than silently absent.
test('formatHistory: marks the transcript as partial only when turns were dropped', () => {
  const turn = (i: number) => ({ role: 'user' as const, content: `q${i}` })
  const many = Array.from({ length: 10 }, (_, i) => turn(i))
  const clipped = formatHistory(many, { maxTurns: 4, assistantChars: 300 })
  assert.match(clipped, /earlier turns are not shown/i)
  assert.equal(clipped.includes('q0'), false)
  assert.equal(clipped.includes('q9'), true)

  const whole = formatHistory(many.slice(0, 3), { maxTurns: 4, assistantChars: 300 })
  assert.doesNotMatch(whole, /earlier turns are not shown/i)
})

// Question numbers are counted over the whole history, not over the window. A
// clipped transcript renumbered from 1 would tell the model that the oldest line
// it can see is the visitor's first question, which is the same lie the
// "(earlier turns are not shown)" header exists to prevent.
test('formatHistory: numbers the visitor’s turns from the true start of the conversation', () => {
  const turns = [
    { role: 'user' as const, content: 'q1' },
    { role: 'assistant' as const, content: 'a1' },
    { role: 'user' as const, content: 'q2' },
    { role: 'assistant' as const, content: 'a2' },
    { role: 'user' as const, content: 'q3' },
  ]
  const whole = formatHistory(turns, { maxTurns: 10, assistantChars: 300 })
  assert.match(whole, /User \(question 1\): q1/)
  assert.match(whole, /User \(question 3\): q3/)

  const clipped = formatHistory(turns, { maxTurns: 2, assistantChars: 300 })
  assert.match(clipped, /User \(question 3\): q3/)
  assert.equal(clipped.includes('question 1'), false)
})

// --- positional references -------------------------------------------------
// Four questions, so an ordinal has something to land on. This is the shape of
// the live session where "請回答我剛剛問你的第二個問題" answered about the fourth.
const SESSION = [
  { role: 'user' as const, content: '他在 USPACE 做了什麼?' },
  { role: 'assistant' as const, content: 'USPACE …' },
  { role: 'user' as const, content: '那團隊多大?' },
  { role: 'assistant' as const, content: '15 人 …' },
  { role: 'user' as const, content: '他在工作上怎麼運用 AI?' },
  { role: 'assistant' as const, content: 'AI …' },
  { role: 'user' as const, content: '那個 Playbook 是什麼?' },
  { role: 'assistant' as const, content: 'Playbook …' },
]

test('ordinalReference: resolves a named position to the question actually asked', () => {
  for (const [message, index] of [
    ['請回答我剛剛問你的第二個問題', 2],
    ['我剛剛問你的第二個問題是什麼?', 2],
    ['第2題你還沒回覆', 2],
    ['第一個問題是什麼?', 1],
    ['最後一個問題是什麼?', 4],
    ['上一個問題你答錯了', 4],
    ['what was my second question?', 2],
    ['answer question 3', 3],
    ['my first question, please', 1],
    ['2番目の質問は何ですか', 2],
    ['最初の質問は何でしたか', 1],
  ] as Array<[string, number]>) {
    const ref = ordinalReference(message, SESSION)
    assert.equal(ref?.index, index, `wrong index for: ${message}`)
    assert.equal(ref?.total, 4)
    assert.equal(ref?.question, SESSION[(index - 1) * 2].content, `wrong target for: ${message}`)
  }
})

test('ordinalReference: null when the message names no position, or there is nothing to count', () => {
  assert.equal(ordinalReference('他在 USPACE 做了什麼?', SESSION), null)
  assert.equal(ordinalReference('我第一輪問題問了你什麼', []), null)
})

// The direction that shipped broken: 問題 is also "problem", and "最後一個問題" /
// "one last question" is the standard preface to a BRAND-NEW question. Routing
// these to the transcript means the visitor asks what Charles's tech stack is
// and gets told what their own earlier question was, having retrieved nothing.
test('ordinalReference: a question-shaped phrase that points at nothing earlier is not a reference', () => {
  for (const q of [
    // A politeness opener in front of a new question.
    '最後一個問題，他現在在找什麼機會?',
    '第二個問題：他的技術棧是什麼?',
    'One last question: what is he looking for next?',
    'Second question: how big was the team?',
    '最後の質問ですが、彼は何を作りましたか',
    // 問題 as "problem", and questions about Charles's own practice.
    'USPACE 遇到的第一個問題是什麼?',
    '他在 USPACE 解決的第一個問題是什麼?',
    '你做用戶訪談第一個問題會問什麼?',
    "what's the first question you'd ask a new user?",
  ]) {
    assert.equal(ordinalReference(q, SESSION), null, `should not be a reference: ${q}`)
    assert.equal(shouldAnswerFromHistory(q, SESSION), false, `should reach retrieval: ${q}`)
  }
})

// …without losing the ones that do point backwards. A leading connective is
// still the visitor talking about this conversation.
test('ordinalReference: still fires when the phrase leads the sentence or points back', () => {
  for (const q of ['所以第二個問題是什麼?', '那第一個問題是什麼?', '第2題你還沒回覆', '上一個問題你答錯了']) {
    assert.notEqual(ordinalReference(q, SESSION), null, `should be a reference: ${q}`)
  }
})

// Naming a question that was never asked is not a licence to pick another one.
test('ordinalReference: an out-of-range position resolves with no target', () => {
  const ref = ordinalReference('第十個問題是什麼?', SESSION)
  assert.equal(ref?.index, 10)
  assert.equal(ref?.total, 4)
  assert.equal(ref?.question, null)
})

// The replayed question can itself be a follow-up ("那團隊多大?"), so it has to be
// rewritten against the turns that preceded IT — not against the whole
// transcript, whose latest topic would pull the rewrite somewhere else.
test('replayTarget: hands back the earlier question plus the turns it referred to', () => {
  const target = replayTarget('請回答我剛剛問你的第二個問題', SESSION)
  assert.equal(target?.question, '那團隊多大?')
  assert.deepEqual(
    target?.priorTurns.map((t) => t.content),
    ['他在 USPACE 做了什麼?', 'USPACE …'],
  )
})

test('replayTarget: only for messages asking for the answer, and only in range', () => {
  // Asking WHAT it was is a question about the conversation, not a replay.
  assert.equal(replayTarget('我剛剛問你的第二個問題是什麼?', SESSION), null)
  // Nothing to replay when they name a question they never asked.
  assert.equal(replayTarget('請回答我第十個問題', SESSION), null)
  assert.equal(replayTarget('他在 USPACE 做了什麼?', SESSION), null)
})

// A replay belongs to retrieval; a message that says it is looking back belongs
// to the transcript.
test('shouldAnswerFromHistory: splits replay from talk-about-the-conversation', () => {
  assert.equal(shouldAnswerFromHistory('請回答我剛剛問你的第二個問題', SESSION), false)
  assert.equal(shouldAnswerFromHistory('我剛剛問你的第二個問題是什麼?', SESSION), true)
})

// Naming a position, on its own, must NOT claim the message for the transcript.
// It did for one deploy on 2026-07-31, and the cost was that any message opening
// with a positional phrase and continuing into a NEW question stopped
// retrieving: the visitor asked what made Charles leave USPACE and was told
// which question they had asked earlier. Two rounds of narrowing the words that
// may follow the phrase each fixed the examples in hand and left the neighbours
// open, so the rule is now that the message has to say it is looking back.
test('shouldAnswerFromHistory: a positional phrase alone never diverts a question from retrieval', () => {
  for (const q of [
    'Second question: is he open to relocating?',
    'Last question: was the team remote?',
    'Question 2: is he still at USPACE?',
    'My second question: how did he measure success?',
    "Last question: what's the answer to scaling a PM team?",
    '最後一個問題，是什麼讓他離開 USPACE?',
    '第二個問題，是什麼讓他決定做 AI PM?',
    '最後一個問題，他現在在找什麼機會?',
    'USPACE 遇到的第一個問題是什麼?',
    // Out of range, and not looking back: retrieval will find nothing and say
    // so, which beats converse claiming to know how many questions there were.
    '請回答我第十個問題',
  ]) {
    assert.equal(shouldAnswerFromHistory(q, SESSION), false, `should reach retrieval: ${q}`)
  }
})

// …and the phrasings that DO look back still reach the transcript.
test('shouldAnswerFromHistory: a positional phrase that says it looks back still reaches converse', () => {
  for (const q of [
    '我剛剛問你的第一個問題是什麼?',
    '你還記得我剛剛問你的問題嗎？請重複一遍',
    'What was my first question?',
    'Do you remember my first question?',
  ]) {
    assert.equal(shouldAnswerFromHistory(q, SESSION), true, `should reach converse: ${q}`)
  }
})

// 2026-08-19, production. A visitor asked Mika to answer "第 8 題" from a
// ten-item list she had just written. Her reply had been delivered whole — 649
// chars, all ten items, on screen in front of them — but the copy that came
// back on the next turn had been sliced to 300 chars, cutting mid-way through
// item 5. She first said the list "只列出了前五個問題", true of what she could
// see, and then invented a cause for it: "我的回應被截斷了". Nothing had been cut
// off; the shortening happened on the way back in, silently, and she filled the
// gap with a failure she never had.
//
// Two rules come out of that, and both are needed. The recent answers go back
// whole, because that is where a follow-up points. And any turn that IS
// shortened says so in the transcript, because no ceiling is high enough
// forever — when one is finally passed, the model has to be able to report an
// excerpt rather than invent an explanation for the ragged edge it sees.
test('formatHistory: the most recent assistant turns go back whole', () => {
  const long = 'x'.repeat(2000)
  const out = formatHistory(
    [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: long },
      { role: 'user', content: 'q2' },
    ],
    { maxTurns: 16, assistantChars: 300, recentAssistantTurns: 2, recentAssistantChars: 4000 },
  )
  assert.equal(out.includes(long), true, 'the recent answer must survive intact')
  assert.doesNotMatch(out, /excerpt/, 'nothing was shortened, so nothing may claim it was')
})

test('formatHistory: an assistant turn past the recent window is excerpted, and says so', () => {
  const long = 'x'.repeat(2000)
  const out = formatHistory(
    [
      { role: 'assistant', content: long },
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'recent A' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'recent B' },
    ],
    { maxTurns: 16, assistantChars: 300, recentAssistantTurns: 2, recentAssistantChars: 4000 },
  )
  assert.equal(out.includes('x'.repeat(300)), true)
  assert.equal(out.includes('x'.repeat(301)), false)
  assert.match(out, /excerpt: first 300 of 2000 chars/)
  // The two most recent answers are what a follow-up points at, so they stay whole.
  assert.equal(out.includes('recent A'), true)
  assert.equal(out.includes('recent B'), true)
})

test('formatHistory: a recent answer past its own ceiling is still marked as an excerpt', () => {
  const huge = 'y'.repeat(5000)
  const out = formatHistory([{ role: 'assistant', content: huge }], {
    maxTurns: 16,
    assistantChars: 300,
    recentAssistantTurns: 2,
    recentAssistantChars: 4000,
  })
  assert.equal(out.includes('y'.repeat(4000)), true)
  assert.equal(out.includes('y'.repeat(4001)), false)
  assert.match(out, /excerpt: first 4000 of 5000 chars/)
})

// Clipping and the recent window applied together — a long conversation where
// the render window drops turns AND the newest answers must survive whole.
// Every other test here is short enough that only one of the two is active.
//
// It does NOT pin the whole-history basis of `recentFrom`, and no test can,
// because that basis has no failure mode: `numbered.slice(-maxTurns)` is a TAIL
// slice, so the Nth-newest assistant of the whole history and the Nth-newest of
// the tail are the same turn whenever the tail holds N of them, and the `?? 0`
// fallback covers the case where it does not. Probed across 81 shapes (2-61
// turns × maxTurns 2/4/16 × recentTurns 1/2/3): zero shapes render differently.
// Written down so the next reader does not re-derive it, or add a test that can
// only ever pass.
test('formatHistory: a clipped long conversation still returns its newest answers whole', () => {
  const turns = Array.from({ length: 40 }, (_, i) =>
    i % 2 === 0
      ? { role: 'user' as const, content: `q${i}` }
      : { role: 'assistant' as const, content: `answer ${i} ${'z'.repeat(1000)}` },
  )
  const out = formatHistory(turns, {
    maxTurns: 4,
    assistantChars: 300,
    recentAssistantTurns: 2,
    recentAssistantChars: 4000,
  })
  // The window keeps turns 36-39, so both of the two newest answers (37 and 39)
  // are rendered and both must survive whole at 1010 chars each, while
  // everything older is clipped away entirely.
  assert.equal(out.includes(`answer 37 ${'z'.repeat(1000)}`), true)
  assert.equal(out.includes(`answer 39 ${'z'.repeat(1000)}`), true)
  assert.equal(out.includes('answer 35'), false)
  assert.doesNotMatch(out, /excerpt/, 'a rendered answer inside the recent window must not be cut')
  assert.match(out, /earlier turns are not shown/)
})

// A turn can pass two ceilings: the transport bound and then the prompt bound.
// Marking it twice must not corrupt the number, because an inaccurate figure is
// the same class of defect as the silent cut — it hands the model a fact that is
// wrong and invites it to reason from it. Naively re-marking reported "first
// 4000 of 8036", counting the already-shortened body plus its own marker as if
// that were the original length.
test('excerpt: shortening an already-shortened turn still reports the true original length', () => {
  const original = 'z'.repeat(9000)
  const atTransport = excerpt(original, 8000)
  assert.match(atTransport, /excerpt: first 8000 of 9000 chars/)

  const atPrompt = excerpt(atTransport, 4000)
  assert.match(atPrompt, /excerpt: first 4000 of 9000 chars/)
  assert.equal(atPrompt.includes('of 8036'), false)
  // One marker, not a stack of them.
  assert.equal(atPrompt.match(/excerpt:/g)?.length, 1)

  // A marked turn that already fits is left exactly as it is.
  assert.equal(excerpt(atTransport, 20000), atTransport)
})
