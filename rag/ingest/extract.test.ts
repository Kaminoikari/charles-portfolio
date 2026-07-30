// Unit tests for blog chunk identity. No secrets / network:
//   npm run rag:test
//
// The property under test is the one the ingest reconciler depends on: a chunk
// id must name the ARTICLE, not its position in the feed. When ids were derived
// from the array index, publishing a post (which goes in at the top) rewrote the
// id of every older post — silently re-embedding the whole blog corpus, orphaning
// the points behind the old ids, and invalidating the golden eval set, which
// pins ids. Nothing failed loudly, so nothing caught it.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  aboutChunks,
  blogChunks,
  blogSlug,
  experienceChunks,
  type AboutContentInput,
  type BlogArticleInput,
  type ExperienceInput,
} from './extract.js'
import { blogArticles } from '../../src/data/blog.en.ts'
import { aboutContent } from '../../src/data/aboutContent.en.ts'
import { aboutContent as aboutContentZh } from '../../src/data/aboutContent.zh-TW.ts'
import { experience } from '../../src/data/experience.en.ts'
import { experience as experienceZh } from '../../src/data/experience.zh-TW.ts'

const ARTICLES = blogArticles as BlogArticleInput[]
const ABOUT = aboutContent as AboutContentInput
const ROLES = experience as ExperienceInput[]

const NEW_POST: BlogArticleInput = {
  title: 'A brand new post',
  subtitle: 'Published today, so it lands at the top of the feed.',
  date: '2026-07-30',
  url: 'https://charlestychen.substack.com/p/a-brand-new-post',
}

test('publishing a post leaves every existing article chunk untouched', () => {
  const before = blogChunks(ARTICLES, 'en')
  // A new post is inserted right after the pinned Featured entry, which is how
  // every real publish lands in src/data/blog.*.ts.
  const after = blogChunks([ARTICLES[0], NEW_POST, ...ARTICLES.slice(1)], 'en')
  const byId = new Map(after.map((c) => [c.id, c]))

  // Both halves matter. A missing id orphans the point behind it; an id that
  // survives while its content moves to a different article is worse — the
  // reconciler re-embeds it and the citation now points somewhere else.
  const moved = before.filter((c) => {
    const now = byId.get(c.id)
    return !now || now.content !== c.content || now.url !== c.url
  })
  assert.deepEqual(moved, [], `${moved.length} existing chunk(s) changed identity, e.g. ${moved.slice(0, 3).map((c) => c.id).join(', ')}`)
})

test('body chunks stay attached to their own article after a publish', () => {
  const after = blogChunks([ARTICLES[0], NEW_POST, ...ARTICLES.slice(1)], 'en')
  const byId = new Map(after.map((c) => [c.id, c]))

  for (const chunk of after) {
    if (!chunk.parentId) continue
    const parent = byId.get(chunk.parentId)
    assert.ok(parent, `orphan body chunk ${chunk.id}`)
    assert.equal(chunk.url, parent.url, `body chunk ${chunk.id} points at a different article than its parent`)
  }
})

test('every article in the real feed gets a distinct id', () => {
  const parents = blogChunks(ARTICLES, 'en').filter((c) => !c.parentId)
  assert.equal(new Set(parents.map((c) => c.id)).size, ARTICLES.length)
})

test('two articles sharing a slug fail loudly instead of overwriting each other', () => {
  const dupe: BlogArticleInput = { ...NEW_POST, title: 'Different title, same URL' }
  assert.throws(() => blogChunks([NEW_POST, dupe], 'en'), /duplicate blog/i)
})

test('a slug survives a trailing slash and is derived from the article URL', () => {
  assert.equal(blogSlug('https://charlestychen.substack.com/p/outcome'), 'outcome')
  assert.equal(blogSlug('https://charlestychen.substack.com/p/outcome/'), 'outcome')
})

// ── experience ────────────────────────────────────────────────────────────
// A new role goes in at index 0, and `experience:0` / `experience:2` are pinned
// in the golden set, so an index-derived id silently repoints those evals.

const NEW_ROLE: ExperienceInput = {
  dateRange: 'AUG 2026 — PRESENT',
  title: 'Head of Product',
  organization: 'Somewhere New Inc.',
  bullets: ['Joined most recently, so this role sorts to the top.'],
}

test('taking a new job leaves every existing role chunk untouched', () => {
  const before = experienceChunks(ROLES, 'en')
  const after = experienceChunks([NEW_ROLE, ...ROLES], 'en')
  const byId = new Map(after.map((c) => [c.id, c]))

  const moved = before.filter((c) => byId.get(c.id)?.content !== c.content)
  assert.deepEqual(moved, [], `${moved.length} role chunk(s) changed identity, e.g. ${moved.map((c) => c.id).join(', ')}`)
})

test('a role keeps one id across locales even where the company name is localized', () => {
  const en = experienceChunks(ROLES, 'en').map((c) => c.id.replace(/:en$/, ''))
  const zh = experienceChunks(experienceZh as ExperienceInput[], 'zh-TW').map((c) => c.id.replace(/:zh-TW$/, ''))
  assert.deepEqual(zh, en)
})

test('two stints at one company fail loudly instead of overwriting each other', () => {
  const again: ExperienceInput = { ...NEW_ROLE, title: 'Promoted', dateRange: 'AUG 2027 — PRESENT' }
  assert.throws(() => experienceChunks([NEW_ROLE, again], 'en'), /duplicate experience/i)
})

// ── about ─────────────────────────────────────────────────────────────────
// `about:ai:1` is pinned in the golden set, and the visible title/label is
// localized, so the id has to come from the explicit per-entry key.

test('inserting an about entry leaves every existing about chunk untouched', () => {
  const before = aboutChunks(ABOUT, 'en')
  const after = aboutChunks(
    {
      whoIAm: ['A newly added opening paragraph.', ...ABOUT.whoIAm],
      philosophyBullets: [{ id: 'ship-early', title: 'Ship early', body: 'A newly added bullet.' }, ...ABOUT.philosophyBullets],
      aiTable: [{ id: 'research', label: 'Research', body: 'A newly added row.' }, ...ABOUT.aiTable],
    },
    'en',
  )
  const byId = new Map(after.map((c) => [c.id, c]))

  const moved = before.filter((c) => byId.get(c.id)?.content !== c.content)
  assert.deepEqual(moved, [], `${moved.length} about chunk(s) changed identity, e.g. ${moved.map((c) => c.id).join(', ')}`)
})

// Philosophy titles are genuinely translated, so this pins them. The AI-table
// labels happen to be English in all three files today, so for those rows this
// only asserts that a future translation would not split the id.
test('philosophy and AI-table ids match across locales even though the copy does not', () => {
  const en = aboutChunks(ABOUT, 'en')
    .filter((c) => !c.id.startsWith('about:whoiam:'))
    .map((c) => c.id.replace(/:en$/, ''))
  const zh = aboutChunks(aboutContentZh as AboutContentInput, 'zh-TW')
    .filter((c) => !c.id.startsWith('about:whoiam:'))
    .map((c) => c.id.replace(/:zh-TW$/, ''))
  assert.deepEqual(zh, en)
})

test('two about entries sharing a key fail loudly instead of overwriting each other', () => {
  const row = { id: 'discovery', label: 'Discovery', body: 'first' }
  assert.throws(
    () => aboutChunks({ whoIAm: [], philosophyBullets: [], aiTable: [row, { ...row, body: 'second' }] }, 'en'),
    /duplicate about:ai/i,
  )
})

test('a URL with no usable slug characters still yields a stable non-empty id', () => {
  const url = 'https://example.com/%E4%B8%AD%E6%96%87'
  const slug = blogSlug(url)
  assert.ok(slug.length > 0)
  assert.equal(slug, blogSlug(url))
  assert.notEqual(slug, blogSlug('https://example.com/%E6%97%A5%E6%9C%AC%E8%AA%9E'))
})
