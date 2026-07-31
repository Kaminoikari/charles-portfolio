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
  assert.equal(out.includes(`Assistant: ${'a'.repeat(10)}\n`), true)
  assert.equal(out.includes('a'.repeat(11)), false)
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
