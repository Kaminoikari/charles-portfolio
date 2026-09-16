// Structural guards on the golden set. No secrets / network:
//   npm run rag:test
//
// `relevantIds` are STRING PREFIXES matched against stored chunk ids, so a stale
// or mistyped prefix does not fail — it silently becomes a permanent miss, and
// the eval reports a recall drop that looks like a retrieval regression. The
// ingest is the only source of truth for which ids exist, so these tests check
// the golden set against the chunks `extractAll()` actually produces.
//
// The locale-by-locale check matters because the eval runs every item in all
// three locales: a prefix that only exists in `en` (a blog slug that differs per
// locale, say) scores 0 on two thirds of its runs while reading as one item.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { GOLDEN } from './golden.js'
import { extractAll } from '../ingest/extract.js'

const CHUNKS = await extractAll()

const LOCALES = [...new Set(CHUNKS.map((c) => c.locale))].sort()
const IDS_BY_LOCALE = new Map<string, string[]>(
  LOCALES.map((loc) => [loc, CHUNKS.filter((c) => c.locale === loc).map((c) => c.id)]),
)

test('the corpus really has all three locales', () => {
  assert.deepEqual(LOCALES, ['en', 'ja', 'zh-TW'])
})

test('every relevantIds prefix matches a real chunk in every locale', () => {
  const dead: string[] = []
  for (const item of GOLDEN) {
    for (const prefix of item.relevantIds) {
      const missing = LOCALES.filter((loc) => !IDS_BY_LOCALE.get(loc)!.some((id) => id.startsWith(prefix)))
      if (missing.length > 0) dead.push(`${item.id}: "${prefix}" missing in ${missing.join(', ')}`)
    }
  }
  assert.deepEqual(dead, [], `golden prefixes matching no chunk:\n  ${dead.join('\n  ')}`)
})

test('blog prefixes are pinned with a trailing colon', () => {
  // One slug can prefix another (`blog:ai` also matches `blog:ai-286`), so an
  // unpinned blog prefix credits the wrong article as a hit.
  const unpinned = GOLDEN.flatMap((item) =>
    item.relevantIds.filter((p) => p.startsWith('blog:') && !p.endsWith(':')).map((p) => `${item.id}: ${p}`),
  )
  assert.deepEqual(unpinned, [])
})

test('item ids are unique', () => {
  const ids = GOLDEN.map((i) => i.id)
  assert.deepEqual([...new Set(ids)].sort(), [...ids].sort())
})

test('out-of-corpus items are exactly the ones that decline and cite nothing', () => {
  for (const item of GOLDEN) {
    const isOut = item.category === 'out-of-corpus'
    assert.equal(item.mustDecline === true, isOut, `${item.id}: mustDecline must be set iff out-of-corpus`)
    assert.equal(item.relevantIds.length === 0, isOut, `${item.id}: relevantIds must be empty iff out-of-corpus`)
  }
})

test('every item asks the question in all three locales', () => {
  for (const item of GOLDEN) {
    for (const loc of ['en', 'zh-TW', 'ja'] as const) {
      assert.ok(item.question[loc]?.trim().length > 0, `${item.id}: missing ${loc} question`)
    }
  }
})
