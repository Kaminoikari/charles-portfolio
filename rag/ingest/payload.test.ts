// The chunk → Qdrant payload half of the wiring. extract.ts putting a field on
// a ChunkRecord means nothing if the writer drops it on the way into the store,
// and that failure is silent: retrieval reads `undefined`, the prompt omits the
// line, and every test that builds its own Document still passes.
//
//   npm run rag:test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hashModels, hashPayload, rawHash, toPoint } from './payload.js'
import type { ChunkRecord } from './extract.js'

const BLOG: ChunkRecord = {
  id: 'blog:ai-production:body:0:zh-TW',
  parentId: 'blog:ai-production:zh-TW',
  sourceType: 'blog',
  projectId: null,
  locale: 'zh-TW',
  title: '我為什麼敢讓 AI 寫的程式碼進公司 Production？ — part 1',
  content: '九個月前，我開始讓 AI 寫的程式碼進 Production。',
  url: 'https://charlestychen.substack.com/p/ai-production',
  date: '2026-09-14',
}

const point = (r: ChunkRecord) => toPoint(r, [0.1], 'hash', r.content, '')

test('toPoint stores the publication date the chunk carries', () => {
  assert.equal(point(BLOG).payload.date, '2026-09-14')
})

test('toPoint leaves the date key off a chunk that has none', () => {
  const undated: ChunkRecord = { ...BLOG }
  delete undated.date
  assert.equal('date' in point(undated).payload, false)
})

test('hashPayload folds the date in, so correcting a date re-ingests the chunk', () => {
  assert.notDeepEqual(hashPayload(BLOG), hashPayload({ ...BLOG, date: '2026-09-15' }))
})

// BM25's default `word` tokenizer splits on spaces and punctuation, so a
// Chinese or Japanese sentence reaches the index as a handful of long tokens
// that no question will ever repeat. The CJK locales ask for the multilingual
// tokenizer; the same options must reach the query (retrieval.test.ts pins that
// half), or the two sides tokenise differently and match nothing.
test('toPoint asks BM25 to segment Chinese and Japanese, and leaves English on the default', () => {
  const sparse = (locale: string) => point({ ...BLOG, locale }).vector.sparse
  const zh = sparse('zh-TW').options as { tokenizer: string; stopwords: { languages: string[]; custom: string[] } }
  const ja = sparse('ja').options as typeof zh
  assert.equal(zh.tokenizer, 'multilingual')
  assert.equal(ja.tokenizer, 'multilingual')
  assert.deepEqual(zh.stopwords.languages, ['english', 'chinese'])
  assert.deepEqual(ja.stopwords.languages, ['english', 'japanese'])
  // The question words the built-in lists let through (run 36895598684).
  for (const w of ['什麼', '做什麼', '多大']) assert.ok(zh.stopwords.custom.includes(w), w)
  for (const w of ['いました', 'どのくらい']) assert.ok(ja.stopwords.custom.includes(w), w)
  assert.equal('options' in sparse('en'), false)
})

test('hashModels changes for a CJK locale and not for English, so only CJK chunks re-ingest', () => {
  assert.deepEqual(hashModels('en'), ['voyage-3-large', '1024', 'qdrant/bm25'])
  assert.notDeepEqual(hashModels('ja'), hashModels('en'))
  assert.notDeepEqual(hashModels('zh-TW'), hashModels('en'))
})

// Hashes this record had before the CJK tokenizer (computed on 2a17816 with the
// hash inputs build-index used then). English must still match, or every
// English chunk is re-embedded for nothing; zh-TW and ja must not, or their
// points keep the old one-token-per-sentence sparse vectors forever.
test('rawHash keeps English chunks as they were and re-ingests the CJK ones', () => {
  const r = (locale: string): ChunkRecord => ({ id: 'about:ai:overview:x', parentId: null, sourceType: 'about', projectId: null, title: 't', content: 'AI の使い方', locale })
  assert.equal(rawHash(r('en')), '7a315c9156c7cd8c0a6d50125f27a1110dd34454f0afcdfa8708c64acf361eff')
  assert.notEqual(rawHash(r('zh-TW')), '9ad561f0e7a055fe8d664184987f2704d66cff339e79f3d06fa446ac070a692f')
  assert.notEqual(rawHash(r('ja')), '68eb68c975e566c696bf91576d2b649b98ae9f6999c48c5992fbde3f1e5c5785')
})
