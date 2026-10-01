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

test('no paraphrase belongs to two entries in the same locale', () => {
  // The FAQ calibration (rag/evals/faq-calibration.ts) found eight that did:
  // "why Qdrant?" was a question of both bot-why-qdrant and tech-why-choices.
  // Which one a visitor gets for it is then decided by embedding noise, and no
  // threshold or margin can make that choice correctly.
  const seen = new Map<string, string>()
  const shared: string[] = []
  for (const e of faqEntries) {
    for (const [locale, qs] of Object.entries(e.questions)) {
      for (const q of qs) {
        const key = `${locale}\u0000${q.trim().toLowerCase().replace(/[?？。!！\s]+$/u, '')}`
        const owner = seen.get(key)
        if (owner && owner !== e.id) shared.push(`[${locale}] "${q}": ${owner} and ${e.id}`)
        else seen.set(key, e.id)
      }
    }
  }
  assert.deepEqual(shared, [])
})
