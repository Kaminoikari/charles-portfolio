// Unit tests for the deterministic triage layer (no API keys, no network).
// Run with:  npx tsx --test rag/*.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { triage, personalRedirect, genericFallback, CONTACT } from './triage.js'

test('personal/privacy questions are redirected, not passed to RAG', () => {
  for (const q of [
    'Is Charles single?',
    'how old is he?',
    'does he have a girlfriend?',
    'what is his salary?',
    'Charles 單身嗎',
    '他幾歲',
    '他結婚了嗎',
    '彼は結婚していますか',
    '年齢は?',
  ]) {
    const r = triage(q, 'en')
    assert.equal(r.kind, 'personal', `expected personal for: ${q}`)
  }
})

test('personal redirect replies in the question language and includes contact', () => {
  assert.match(triage('他單身嗎', 'zh-TW').kind === 'personal' ? personalRedirect('zh-TW') : '', /Email/)
  const ja = personalRedirect('ja')
  assert.ok(ja.includes(CONTACT.email))
  assert.ok(ja.includes('メール'))
})

test('greetings and contact questions are canned (zero-LLM)', () => {
  assert.equal(triage('hello', 'en').kind, 'canned')
  assert.equal(triage('你好', 'zh-TW').kind, 'canned')
  assert.equal(triage('how can I contact him?', 'en').kind, 'canned')
  assert.equal(triage('聯絡方式', 'zh-TW').kind, 'canned')
})

test('content questions pass through to the RAG pipeline', () => {
  for (const q of [
    'What did he do at USPACE?',
    'Tell me about Product Playbook',
    '介紹一下 Product Playbook',
    'How does he use AI?',
    '他的產品風格是什麼?',
  ]) {
    assert.equal(triage(q, 'en').kind, 'pass', `expected pass for: ${q}`)
  }
})

test('no false positive: "single source of truth" is not personal', () => {
  // "single" appears in a technical phrase, but our patterns shouldn't fire on a
  // content question. (If this ever regresses, tighten the \bsingle\b rule.)
  const r = triage('Does he believe in a single source of truth for design tokens?', 'en')
  assert.notEqual(r.kind, 'personal')
})

test('generic fallback is localized and includes a contact CTA', () => {
  assert.ok(genericFallback('zh-TW').includes(CONTACT.email))
  assert.match(genericFallback('en'), /portfolio/i)
  assert.ok(genericFallback('ja').includes('Charles'))
})
