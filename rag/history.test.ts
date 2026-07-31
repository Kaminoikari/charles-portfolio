// The conversational gate decides which messages get answered from the
// transcript instead of from retrieval. It has to be precise in both
// directions: a miss sends "我剛剛問了什麼" into a vector search that cannot
// possibly answer it, and a false positive sends a real portfolio question to a
// node that has no documents.
//   npx tsx --test rag/history.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { looksConversational, formatHistory, shouldAnswerFromHistory } from './history.js'

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
  assert.equal(out.includes('User: q2'), true)
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
