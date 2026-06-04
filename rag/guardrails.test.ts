// Unit tests for the output-side guardrails (no API keys, no network).
// Run with:  npx tsx --test rag/*.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripInvalidCitations, isOffensiveOutput } from './guardrails.js'

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
