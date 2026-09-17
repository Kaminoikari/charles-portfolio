// The chunk → Qdrant payload half of the wiring. extract.ts putting a field on
// a ChunkRecord means nothing if the writer drops it on the way into the store,
// and that failure is silent: retrieval reads `undefined`, the prompt omits the
// line, and every test that builds its own Document still passes.
//
//   npm run rag:test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hashPayload, toPoint } from './payload.js'
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
  const { date: _date, ...undated } = BLOG
  assert.equal('date' in point(undated as ChunkRecord).payload, false)
})

test('hashPayload folds the date in, so correcting a date re-ingests the chunk', () => {
  assert.notDeepEqual(hashPayload(BLOG), hashPayload({ ...BLOG, date: '2026-09-15' }))
})
