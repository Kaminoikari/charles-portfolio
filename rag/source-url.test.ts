// Unit tests for the source → page URL mapping (no network, no keys).
// Run with:  npm run rag:test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { sourceUrl } from './source-url.js'

test('project links to its locale-aware detail page', () => {
  assert.equal(
    sourceUrl({ sourceType: 'project', projectId: 'plutus-trade', url: null, locale: 'en' }),
    '/projects/plutus-trade',
  )
  assert.equal(
    sourceUrl({ sourceType: 'project', projectId: 'plutus-trade', url: null, locale: 'ja' }),
    '/ja/projects/plutus-trade',
  )
  assert.equal(
    sourceUrl({ sourceType: 'project', projectId: 'path', url: null, locale: 'zh-TW' }),
    '/zh-TW/projects/path',
  )
})

test('project without an id falls back to the #projects section', () => {
  assert.equal(
    sourceUrl({ sourceType: 'project', projectId: null, url: null, locale: 'en' }),
    '/#projects',
  )
})

test('blog links to the external article url verbatim', () => {
  const url = 'https://charlestychen.substack.com/p/ai-e32'
  assert.equal(sourceUrl({ sourceType: 'blog', projectId: null, url, locale: 'en' }), url)
  // Same external url regardless of locale.
  assert.equal(sourceUrl({ sourceType: 'blog', projectId: null, url, locale: 'ja' }), url)
})

test('blog with no stored url yields null (pre-reingest chunks)', () => {
  assert.equal(sourceUrl({ sourceType: 'blog', projectId: null, url: null, locale: 'en' }), null)
})

test('dedicated pages: about and changelog are locale-prefixed', () => {
  assert.equal(sourceUrl({ sourceType: 'about', projectId: null, locale: 'en' }), '/about')
  assert.equal(sourceUrl({ sourceType: 'about', projectId: null, locale: 'ja' }), '/ja/about')
  assert.equal(sourceUrl({ sourceType: 'changelog', projectId: null, locale: 'zh-TW' }), '/zh-TW/changelog')
})

test('home sections: experience and skills hash onto the locale home, no double slash', () => {
  assert.equal(sourceUrl({ sourceType: 'experience', projectId: null, locale: 'en' }), '/#experience')
  assert.equal(sourceUrl({ sourceType: 'experience', projectId: null, locale: 'ja' }), '/ja#experience')
  assert.equal(sourceUrl({ sourceType: 'skill', projectId: null, locale: 'zh-TW' }), '/zh-TW#skills')
})

test('knowledge (agent-patterns) has no public page', () => {
  assert.equal(sourceUrl({ sourceType: 'knowledge', projectId: null, locale: 'en' }), null)
  assert.equal(sourceUrl({ sourceType: 'playbook', projectId: null, locale: 'en' }), null)
})

test('unknown locale degrades to no prefix', () => {
  assert.equal(sourceUrl({ sourceType: 'about', projectId: null, locale: 'fr' }), '/about')
  assert.equal(sourceUrl({ sourceType: 'experience', projectId: null, locale: 'fr' }), '/#experience')
})
