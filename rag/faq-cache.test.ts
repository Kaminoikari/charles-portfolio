// Integrity tests for the pre-written FAQ cache (no network, no API keys).
// Guards against the easy mistakes: a missing locale, an empty answer, a blank
// paraphrase, or duplicate entry ids. Run:  npx tsx --test rag/*.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { faqEntries } from './faq-cache.js'

const LOCALES = ['en', 'zh-TW', 'ja'] as const

test('at least 50 answer sets (entries x locales)', () => {
  assert.ok(
    faqEntries.length * LOCALES.length >= 50,
    `expected >=50 answer sets, got ${faqEntries.length * LOCALES.length}`,
  )
})

test('every entry has all three locales, non-empty, with paraphrases', () => {
  for (const e of faqEntries) {
    for (const loc of LOCALES) {
      assert.ok(e.answers[loc]?.trim(), `${e.id}: empty answer for ${loc}`)
      const qs = e.questions[loc]
      assert.ok(Array.isArray(qs) && qs.length > 0, `${e.id}: no paraphrases for ${loc}`)
      for (const q of qs) assert.ok(q.trim(), `${e.id}: blank paraphrase for ${loc}`)
    }
  }
})

test('entry ids are unique', () => {
  const ids = faqEntries.map((e) => e.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate FAQ entry id')
})
