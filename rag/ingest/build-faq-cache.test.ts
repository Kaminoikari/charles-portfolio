// What a FAQ point carries, without Qdrant or Voyage. No network:
//   npx tsx --test rag/ingest/build-faq-cache.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { flatten, toPoint } from './build-faq-cache.js'
import { citationsOf } from '../qdrant.js'
import type { FaqEntry } from '../faq-cache.js'
import type { GroundingChunk } from '../grounding.js'

const entry: FaqEntry = {
  id: 'exp-nueip',
  questions: { en: ['What did he do at NUEIP?'], 'zh-TW': ['他在 NUEIP 做什麼'], ja: ['NUEIP で何をした'] },
  answers: { en: '**+40%** data-driven decisions.', 'zh-TW': '無數字', ja: '数字なし' },
}

const role = (content: string): GroundingChunk => ({
  id: 'experience:nueip-technology-co-ltd:en',
  locale: 'en',
  sourceType: 'experience',
  projectId: null,
  title: 'Senior Product Manager @ NUEIP',
  content,
})

test('a point carries the chunks that ground its answer, linked', () => {
  const [en] = flatten([entry], [role('+40% data-driven decisions')]).filter((r) => r.locale === 'en')
  assert.deepEqual(en.sources, [
    { id: 'experience:nueip-technology-co-ltd:en', title: 'Senior Product Manager @ NUEIP', locale: 'en', url: '/#experience' },
  ])
})

test('a corpus edit that moves the citation re-upserts the point even though the answer did not change', () => {
  // Incremental ingest re-embeds only points whose hash moved. Without the
  // citations in the hash, a point would keep citing a chunk that no longer
  // states the fact until somebody happened to edit the answer.
  const before = flatten([entry], [role('+40% data-driven decisions')]).find((r) => r.locale === 'en')!
  const after = flatten([entry], [role('+45% data-driven decisions')]).find((r) => r.locale === 'en')!
  assert.deepEqual(after.sources, [])
  assert.notEqual(after.hash, before.hash)
})

test('the point written to Qdrant is one the serving path reads its citations back from', () => {
  // Round trip: what ingest writes, through the guard faqLookup reads with.
  const [row] = flatten([entry], [role('+40% data-driven decisions')]).filter((r) => r.locale === 'en')
  const point = toPoint(row, [0.1, 0.2])
  assert.deepEqual(citationsOf(point.payload), row.sources)
  assert.equal(point.payload.faq_id, 'exp-nueip')
  assert.equal(point.payload.answer, entry.answers.en)
})
