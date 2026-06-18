// Unit tests for the long-form chunker. No secrets / network:
//   npx tsx --test rag/ingest/chunk.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { chunkText } from './chunk.js'

test('returns a single chunk when text fits', () => {
  assert.deepEqual(chunkText('short text', { maxChars: 100, overlap: 10 }), ['short text'])
})

test('returns nothing for empty / whitespace input', () => {
  assert.deepEqual(chunkText('', { maxChars: 100, overlap: 10 }), [])
  assert.deepEqual(chunkText('   \n\n  ', { maxChars: 100, overlap: 10 }), [])
})

test('splits long prose into multiple chunks, each within maxChars', () => {
  const para = 'The quick brown fox jumps over the lazy dog. '.repeat(20)
  const chunks = chunkText(para, { maxChars: 200, overlap: 30 })
  assert.ok(chunks.length > 1)
  for (const c of chunks) assert.ok(c.length <= 200, `chunk too long: ${c.length}`)
})

test('splits CJK text on full-width sentence enders', () => {
  const cjk = '這是第一句話。這是第二句話!這是第三句話?'.repeat(10)
  const chunks = chunkText(cjk, { maxChars: 120, overlap: 20 })
  assert.ok(chunks.length > 1)
  for (const c of chunks) {
    assert.ok(c.length <= 120, `chunk too long: ${c.length}`)
    assert.ok(c.trim().length > 0)
  }
})

test('carries an overlap window between consecutive chunks', () => {
  const sentences = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} here.`).join(' ')
  const chunks = chunkText(sentences, { maxChars: 150, overlap: 40 })
  assert.ok(chunks.length > 2)
  // at least one consecutive pair should share a trailing token (the overlap)
  let shared = 0
  for (let i = 1; i < chunks.length; i++) {
    const prevWords = chunks[i - 1].split(' ')
    const tail = prevWords.slice(-2).join(' ')
    if (tail && chunks[i].includes(tail)) shared++
  }
  assert.ok(shared > 0, 'expected overlap between consecutive chunks')
})

test('hard-cuts a single token longer than maxChars', () => {
  const blob = 'x'.repeat(500)
  const chunks = chunkText(blob, { maxChars: 100, overlap: 0 })
  assert.equal(chunks.length, 5)
  for (const c of chunks) assert.ok(c.length <= 100)
})
