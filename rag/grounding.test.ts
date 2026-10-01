// The grounding primitives, on synthetic text. No network:
//   npx tsx --test rag/grounding.test.ts
//
// The tests that run these over the real corpus (faq-grounding, relations) have
// no negative case: every live fact is grounded, so a matcher that accepted
// anything would pass them all. The cases here are what hold the matcher.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractFacts, extractDates, extractUrls, mentionsFact, groundFacts, type GroundingChunk } from './grounding.js'

const chunk = (id: string, content: string, sourceType = 'experience', locale = 'en'): GroundingChunk => ({
  id,
  locale,
  sourceType,
  projectId: null,
  title: id,
  content,
})

test('a fact keeps its sign and unit, and a model name is not a fact', () => {
  assert.deepEqual(extractFacts('**+40%** data-driven decisions on gemini-2.5-flash'), ['+40%', '2.5'])
})

test('the minus the answers write is the minus the corpus writes', () => {
  assert.deepEqual(extractFacts('−40% complaints'), ['-40%'])
})

test('single digits and the digits inside links are not facts', () => {
  assert.deepEqual(
    extractFacts('(1) three tiers, see https://www.linkedin.com/in/charles-chen-809a2043 or mail a1234@x.com'),
    [],
  )
})

test('a number glued to another digit is a different number', () => {
  assert.equal(mentionsFact('reached 150 accounts', '50'), false)
  assert.equal(mentionsFact('reached 1.5x', '5x'), false)
  assert.equal(mentionsFact('reached 50 accounts', '50'), true)
})

test('a number with more digits after its point or comma is a different number', () => {
  // The left side alone was guarded: "25.5%" stated 25 and "1,000,000" stated
  // 1,000, so a hand-written figure could be grounded by a larger one.
  assert.equal(mentionsFact('grew 25.5%', '25'), false)
  assert.equal(mentionsFact('1,000,000 members', '1,000'), false)
  assert.equal(mentionsFact('grew 25. Then', '25'), true)
  assert.equal(mentionsFact('25, then 30', '25'), true)
})

test('"N+" reads as the corpus says it, in each language', () => {
  assert.equal(mentionsFact('more than 5 of them in product', '5+'), true)
  assert.equal(mentionsFact('其中 5 年以上專注於產品', '5+'), true)
  assert.equal(mentionsFact('5 年以上をプロダクトに', '5+'), true)
  assert.equal(mentionsFact('more than 50 of them', '5+'), false)
})

test('a fact no chunk states is reported, and only that one', () => {
  const g = groundFacts('+40% and +99%', 'en', [chunk('a', '+40% decisions')])
  assert.deepEqual(g.ungrounded, ['+99%'])
  assert.deepEqual(
    g.sources.map((s) => s.id),
    ['a'],
  )
})

test('another locale cannot ground a fact', () => {
  const g = groundFacts('+40%', 'zh-TW', [chunk('a', '+40%', 'experience', 'en')])
  assert.deepEqual(g.ungrounded, ['+40%'])
  assert.deepEqual(g.sources, [])
})

test('the citation prefers the curated record when two chunks state the same fact', () => {
  // Three candidates so the tie-break is not first-wins or last-wins by accident.
  const g = groundFacts('+40%', 'en', [
    chunk('blog', '+40%', 'blog'),
    chunk('role', '+40%', 'experience'),
    chunk('log', '+40%', 'changelog'),
  ])
  assert.deepEqual(
    g.sources.map((s) => s.id),
    ['role'],
  )
})

test('the chunk that states more facts is cited before the one that states fewer', () => {
  const g = groundFacts('+40% +35% +50%', 'en', [
    chunk('one', '+50%', 'experience'),
    chunk('two', '+40% and +35%', 'blog'),
  ])
  assert.deepEqual(
    g.sources.map((s) => s.id),
    ['two', 'one'],
  )
})

test('a link loses its trailing punctuation but nothing else', () => {
  assert.deepEqual(extractUrls('see https://github.com/Kaminoikari.'), ['https://github.com/Kaminoikari'])
})

test('a month and year reads the same in every way the copy writes it', () => {
  assert.deepEqual(extractDates('since August 2026, from JULY 2024, Jan. 2025'), ['2026-08', '2024-07', '2025-01'])
  assert.deepEqual(extractDates('2026 年 8 月起，2024年7月'), ['2026-08', '2024-07'])
  assert.deepEqual(extractDates('Sept. 2025, Sep 2025, September 2025'), ['2025-09'])
})

test('a word that only begins like a month is not a month', () => {
  // "Marketing 2024" read as March 2024: a false ungrounded fact in hand-written
  // copy, and a curated chunk that grounds a month it never names.
  assert.deepEqual(extractDates('Marketing 2024, Decision 2025, Mayday 2023, Junior 2022'), [])
})

test('a date is grounded by a curated record, never by a changelog that shares the year and month', () => {
  const text = 'Head of Product since August 2026'
  const fromLog = groundFacts(text, 'en', [chunk('log', 'Shipped on Aug 2026: new hero', 'changelog')])
  assert.deepEqual(fromLog.ungrounded, ['date:2026-08'])
  const fromRole = groundFacts(text, 'en', [chunk('role', 'Head of Product, AUG 2026 — PRESENT', 'experience')])
  assert.deepEqual(fromRole.ungrounded, [])
})
