// Unit tests for the output-side guardrails (no API keys, no network).
// Run with:  npx tsx --test rag/*.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripInvalidCitations, isOffensiveOutput, stripUngroundedLinks } from './guardrails.js'

test('strips a hallucinated descriptive citation tag, with its leading space', () => {
  // The exact failure from the live bot: a claim grounded on the (unnumbered)
  // portfolio map gets tagged with an invented "[Charles Chen description]".
  const input = '他以約 5 倍的速度進行原型開發和產品驗證 [Charles Chen description]。'
  assert.equal(
    stripInvalidCitations(input),
    '他以約 5 倍的速度進行原型開發和產品驗證。',
  )
})

test('keeps real numeric citations untouched', () => {
  assert.equal(stripInvalidCitations('He raised conversion by 25% [1].'), 'He raised conversion by 25% [1].')
  assert.equal(stripInvalidCitations('Two sources back this [1, 2].'), 'Two sources back this [1, 2].')
})

test('never eats markdown links', () => {
  const link = 'See [Path](https://trip-path.vercel.app/) for the demo.'
  assert.equal(stripInvalidCitations(link), link)
})

test('drops any non-numeric bracket tag the model invents', () => {
  assert.equal(stripInvalidCitations('grounded text [portfolio map] more'), 'grounded text more')
  assert.equal(stripInvalidCitations('grounded text [source: about] more'), 'grounded text more')
})

test('leaves ordinary prose with no bracket tags unchanged', () => {
  const prose = 'Charles is an AI Product Manager with 5+ years of experience.'
  assert.equal(stripInvalidCitations(prose), prose)
})

test('offensive output guard still works (regression guard for the shared module)', () => {
  assert.equal(isOffensiveOutput('a perfectly normal answer about his work'), false)
})

// --- stripUngroundedLinks --------------------------------------------------
// Live regression, 2026-07-31: asked whether Charles fits a robotics PM role,
// the bot wrote "查看他的[作品集](https://charleschen.tw)". That domain exists
// nowhere in the corpus — the model assembled a plausible URL from his name. It
// admitted as much when challenged: "它是我自己編造的". A prompt rule cannot make
// this impossible; comparing against the material actually supplied can.
test('stripUngroundedLinks: keeps links whose URL is in the grounding material', () => {
  const grounding = 'Product Playbook — https://github.com/Kaminoikari/product-playbook'
  const text = 'See [Product Playbook](https://github.com/Kaminoikari/product-playbook) for details.'
  assert.equal(stripUngroundedLinks(text, grounding), text)
})

test('stripUngroundedLinks: demotes an invented link to its plain label', () => {
  const grounding = 'His site is https://charles-chen.com'
  const out = stripUngroundedLinks('查看他的[作品集](https://charleschen.tw)和專案', grounding)
  assert.equal(out, '查看他的作品集和專案')
})

test('stripUngroundedLinks: drops a bare URL that is not in the grounding', () => {
  const out = stripUngroundedLinks('詳見 https://charleschen.tw 這個網站', 'nothing relevant here')
  assert.equal(out.includes('charleschen.tw'), false)
})

test('stripUngroundedLinks: a trailing slash is not a different URL', () => {
  const grounding = 'https://trip-path.vercel.app/'
  const text = '[Path](https://trip-path.vercel.app)'
  assert.equal(stripUngroundedLinks(text, grounding), text)
})

test('stripUngroundedLinks: leaves link-free prose exactly as written', () => {
  const text = 'Charles 在 USPACE 帶 15 人團隊 [1]。'
  assert.equal(stripUngroundedLinks(text, ''), text)
})
