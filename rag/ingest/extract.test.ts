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
  extractAll,
  blogChunks,
  blogSlug,
  experienceChunks,
  timelineChunk,
  type AboutContentInput,
  type BlogArticleInput,
  type ExperienceInput,
} from './extract.js'

const CHUNKS = await extractAll()
import { blogArticles } from '../../src/data/blog.en.ts'
import { aboutContent } from '../../src/data/aboutContent.en.ts'
import { aboutContent as aboutContentZh } from '../../src/data/aboutContent.zh-TW.ts'
import { experience } from '../../src/data/experience.en.ts'
import { experience as experienceZh } from '../../src/data/experience.zh-TW.ts'
import { experience as experienceJa } from '../../src/data/experience.ja.ts'

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

// ── about: one chunk for the whole AI table ───────────────────────────────
// "Charles は仕事でどのように AI を活用していますか" asks about the table as a
// whole, and each row answers one narrow part of it. In Japanese none of the
// four retrieval arms found any row (runs 36868407205, 36887255550); hybrid+rerank
// reached one only when a row happened to enter its candidates, which is why the
// experiment index passed the gate and the production index did not. The table is
// now also indexed whole under the site's own section heading, as skills are.

test('the AI table is also indexed whole, under the site\'s heading, in every locale', async () => {
  for (const locale of ['en', 'zh-TW', 'ja'] as const) {
    const heading = (await import(`../../src/i18n/strings/${locale}.ts`)).default.about.sectionAi as string
    const about = (await import(`../../src/data/aboutContent.${locale}.ts`)).aboutContent as AboutContentInput
    const overview = CHUNKS.find((c) => c.id === `about:ai:overview:${locale}`)
    assert.ok(overview, `no AI overview chunk for ${locale}`)
    assert.equal(overview.content.split('\n')[0], heading, locale)
    for (const row of about.aiTable) assert.ok(overview.content.includes(row.body), `${locale}: overview lacks ${row.id}`)
  }
})

test('an AI-table row cannot take the overview\'s id', () => {
  const row = { id: 'overview', label: 'Overview', body: 'clash' }
  assert.throws(() => aboutChunks({ whoIAm: [], philosophyBullets: [], aiTable: [row] }, 'en', 'How I use AI'), /duplicate/i)
})

// ── experience timeline ───────────────────────────────────────────────────
// Each role chunk carries its own dates, and nothing else says where it falls.
// Asked for the earliest role, retrieval had to land on the FLUX chunk with no
// word in it meaning "earliest", and it did not: `first-role` failed in every
// locale of two corrective runs (36811880858, 36857502362). The timeline chunk
// states the order once, sorted by start date. The site lists roles by its own
// choice (USPACE above XChange School, which started later), so position is
// not the order.

const lineOf = (content: string, needle: string) => content.split('\n').find((l) => l.includes(needle)) ?? ''

test('the timeline lists roles by start date, earliest first, whatever order the site uses', () => {
  const [chunk] = timelineChunk(ROLES, 'en')
  const orgs = chunk.content.split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^.*? at /, '').replace(/ \(.*$/, ''))
  assert.deepEqual(orgs, [
    'FLUX Technology Inc.',
    'PXPay Plus Co., Ltd.',
    'NUEIP Technology Co., Ltd.',
    'USPACE Tech Co., Ltd.',
    'XChange School',
  ])
})

test('the earliest role is named as the earliest, in every locale', () => {
  const cases: [ExperienceInput[], string, string][] = [
    [ROLES, 'en', 'earliest role on the site'],
    [experienceZh as ExperienceInput[], 'zh-TW', '網站上最早的一份工作'],
    [experienceJa as ExperienceInput[], 'ja', 'サイトで一番古い職歴'],
  ]
  for (const [roles, locale, marker] of cases) {
    const [chunk] = timelineChunk(roles, locale)
    assert.ok(chunk, `no timeline chunk for ${locale}`)
    const line = lineOf(chunk.content, marker)
    assert.match(line, /FLUX/, `${locale}: the earliest marker is on ${line || 'no line'}`)
    assert.match(line, /2019/, locale)
  }
})

test('the most recent start is the last line, not the first role the site lists', () => {
  const [chunk] = timelineChunk(ROLES, 'en')
  assert.match(lineOf(chunk.content, 'most recent start'), /XChange School/)
})

test('roles still running are listed together as current', () => {
  const [chunk] = timelineChunk(ROLES, 'en')
  const current = lineOf(chunk.content, 'Current roles')
  assert.match(current, /USPACE/)
  assert.match(current, /XChange School/)
  assert.doesNotMatch(current, /NUEIP|PXPay|FLUX/)
})

test('one unreadable date range drops the whole timeline rather than misplacing a role', () => {
  // Sorting around a role whose start is unknown would put it somewhere, and a
  // wrong "earliest" reads exactly like a right one.
  const odd = (dateRange: string): ExperienceInput => ({ ...NEW_ROLE, organization: `Odd ${dateRange}`, dateRange })
  for (const bad of ['SPRING 2020 — PRESENT', 'JUNK 2020 — PRESENT', 'JA 2020 — PRESENT', '2020 — PRESENT', 'JAN 2020 — LATER', 'JAN 2020 — FOO 2021', 'JAN 2020']) {
    assert.deepEqual(timelineChunk([...ROLES, odd(bad)], 'en'), [], bad)
  }
})

test('roles that start the same month keep the order the site gives them', () => {
  const first: ExperienceInput = { ...NEW_ROLE, organization: 'Listed First', dateRange: 'MAR 2010 — APR 2011' }
  const second: ExperienceInput = { ...NEW_ROLE, organization: 'Listed Second', dateRange: 'MAR 2010 — MAY 2012' }
  const [chunk] = timelineChunk([first, second, ...ROLES], 'en')
  assert.ok(chunk.content.indexOf('Listed First') < chunk.content.indexOf('Listed Second'))
  const [flipped] = timelineChunk([second, first, ...ROLES], 'en')
  assert.ok(flipped.content.indexOf('Listed Second') < flipped.content.indexOf('Listed First'))
})

test('full and short month names both read', () => {
  const a: ExperienceInput = { ...NEW_ROLE, organization: 'Full', dateRange: 'SEPTEMBER 2018 — JULY 2019' }
  const [chunk] = timelineChunk([...ROLES, a], 'en')
  assert.match(lineOf(chunk.content, 'earliest role on the site'), /Full/)
})

test('the real experience data reads in every locale, so a date format change fails here', () => {
  for (const [roles, locale] of [[ROLES, 'en'], [experienceZh, 'zh-TW'], [experienceJa, 'ja']] as const) {
    const [chunk] = timelineChunk(roles as ExperienceInput[], locale)
    assert.ok(chunk, `${locale}: the timeline was dropped, so some dateRange no longer parses`)
    assert.equal(chunk.content.split('\n').filter((l) => /^\d+\. /.test(l)).length, roles.length, locale)
  }
})

test('the ingest indexes a timeline chunk for every locale', () => {
  for (const locale of ['en', 'zh-TW', 'ja']) {
    const chunk = CHUNKS.find((c) => c.id === `experience-timeline:${locale}`)
    assert.ok(chunk, `no experience-timeline chunk for ${locale}`)
    assert.equal(chunk.sourceType, 'experience')
  }
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

test('every chunk names its own topic in the text that gets embedded', () => {
  // The skills chunk was a bare list of jokes — "GPS for chaos; Professional cat
  // herding" — with the word skills nowhere in it. Every other chunk type folds
  // its title into the content; that one did not, so neither retrieval arm could
  // reach it: the dense arm had no topic to be near and BM25 had no term to
  // weigh. Asked "what skills does Charles list on his site?", the bot retrieved
  // about/changelog chunks instead and answered that the site has no skills
  // section, which is false and was live.
  const topic: Record<string, string[]> = {
    en: ['skill'],
    'zh-TW': ['技能'],
    ja: ['スキル'],
  }
  const missing: string[] = []
  for (const c of CHUNKS.filter((x) => x.sourceType === 'skill')) {
    const words = topic[c.locale] ?? []
    if (!words.some((w) => c.content.toLowerCase().includes(w.toLowerCase()))) {
      missing.push(`${c.id}: content never says ${words.join('/')}`)
    }
  }
  assert.deepEqual(missing, [])
})

// A body chunk's text is the article's prose and nothing else, so a sentence
// like "nine months ago" inside it has no anchor once it is separated from the
// feed entry. Asked on 2026-09-17 what that phrase meant, the bot answered that
// the article "carries no publication date" — true of what it retrieved, false
// of src/data/blog.*.ts, which has carried the date all along.
test('every blog chunk carries its article publication date', () => {
  const chunks = blogChunks(ARTICLES, 'en')
  assert.ok(
    chunks.some((c) => c.parentId),
    'no body chunks were produced, so this test would pass without covering them',
  )
  const byUrl = new Map(ARTICLES.map((a) => [a.url, a.date]))
  for (const c of chunks) {
    assert.equal(c.date, byUrl.get(c.url ?? ''), `chunk ${c.id} lost its publication date`)
  }
})

// A tech chunk was the stack table alone ("Frontend Framework: React 18, …"),
// with the project's name only in its title, which is neither embedded nor
// indexed by BM25. "How do the tech stacks of Path and Plutus Trade differ?"
// then retrieved a changelog entry that names both projects and the words
// "tech stack", and neither table, in every locale (run 36906401188).
test('every project tech chunk names its project in the text that gets embedded', () => {
  const tech = CHUNKS.filter((c) => c.sourceType === 'project' && /:tech:[^:]+$/.test(c.id))
  assert.equal(tech.length > 0, true)
  const missing = tech.filter((c) => !c.content.includes(c.title.split(' — ')[0].trim())).map((c) => c.id)
  assert.deepEqual(missing, [])
})
