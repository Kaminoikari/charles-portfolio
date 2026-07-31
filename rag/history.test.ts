// The conversational gate decides which messages get answered from the
// transcript instead of from retrieval. It has to be precise in both
// directions: a miss sends "我剛剛問了什麼" into a vector search that cannot
// possibly answer it, and a false positive sends a real portfolio question to a
// node that has no documents.
//   npx tsx --test rag/history.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { looksConversational, formatHistory } from './history.js'

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
