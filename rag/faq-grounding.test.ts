// Binds every FAQ answer back to src/data. No network:
//   npx tsx --test rag/faq-grounding.test.ts
//
// A FAQ hit is served verbatim with no retrieval, no grading and no generation,
// so these answers are the one place a stale number reaches a visitor with
// nothing downstream to catch it. faq-audit.test.ts checks the answers' voice and
// coverage; this file checks that what they state is still true. When it was
// first run it found two: the zh-TW answers wrote 1M+ where the zh-TW site
// writes 100 萬+, and the cost answer quoted 52 cached topics when there were 58.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { faqEntries, type Locale } from './faq-cache.js'
import { groundFacts, extractUrls, citeFacts } from './grounding.js'
import { OFF_CORPUS_FACTS } from './off-corpus-facts.js'
import { CONTACT } from './triage.js'
import { extractAll } from './ingest/extract.js'
import { portfolioMap } from './portfolio-map.js'
import { sourceUrl } from './source-url.js'
import { socialLinks } from '../src/data/social.ts'
import { projects, projectDetails } from '../src/data/projects.en.ts'
import { blogArticles, platformLinks } from '../src/data/blog.en.ts'

const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']
const chunks = await extractAll()

// The cost answer quotes how many entries this file has. That count belongs to
// the cache, not to src/data, so it is pinned to faqEntries.length by its own
// test below rather than grounded here.
const SELF_COUNT = { surface: 'faq:bot-cost-control', fact: String(faqEntries.length) }

const exempt = (surface: string, fact: string) =>
  (surface === SELF_COUNT.surface && fact === SELF_COUNT.fact) ||
  OFF_CORPUS_FACTS.some((o) => o.fact === fact && o.surfaces.includes(surface as never))

test('every number and date a FAQ answer states is one its own locale of src/data states', () => {
  const stale: string[] = []
  for (const entry of faqEntries) {
    for (const locale of LOCALES) {
      for (const fact of groundFacts(entry.answers[locale], locale, chunks).ungrounded) {
        if (!exempt(`faq:${entry.id}`, fact)) stale.push(`${entry.id} [${locale}] ${fact}`)
      }
    }
  }
  assert.deepEqual(stale, [])
})

test('every off-corpus exception is still needed, and still published where it says', () => {
  // An exception outlives its reason silently: the site starts stating the
  // fact, or the surface stops quoting it, and the entry goes on exempting
  // whatever arrives next under the same number.
  const text = (surface: string, locale: Locale) =>
    surface === 'portfolio-map' ? portfolioMap : faqEntries.find((e) => `faq:${e.id}` === surface)?.answers[locale]
  const unneeded: string[] = []
  for (const o of OFF_CORPUS_FACTS) {
    for (const surface of o.surfaces) {
      const locales: Locale[] = surface === 'portfolio-map' ? ['en'] : LOCALES
      const needed = locales.some((l) => {
        const t = text(surface, l)
        assert.ok(t !== undefined, `${surface} names no surface`)
        return groundFacts(t, l, chunks).ungrounded.includes(o.fact)
      })
      if (!needed) unneeded.push(`${o.fact} on ${surface}`)
    }
    if (o.publishedIn) {
      const file = readFileSync(new URL(`../${o.publishedIn.file}`, import.meta.url), 'utf8')
      assert.ok(file.includes(o.publishedIn.text), `${o.publishedIn.file} no longer says "${o.publishedIn.text}"`)
    }
  }
  assert.deepEqual(unneeded, [])
})

test('every link a FAQ answer gives is a link the site itself publishes', () => {
  const published = new Set(
    [
      ...socialLinks.map((l) => l.url),
      ...Object.values(CONTACT),
      ...Object.values(platformLinks),
      ...projects.map((p) => p.ctaUrl),
      ...projectDetails.flatMap((d) => d.links.map((l) => l.url)),
      ...blogArticles.map((a) => a.url),
    ].map((u) => u.replace(/\/$/, '')),
  )
  const foreign = faqEntries.flatMap((e) =>
    LOCALES.flatMap((l) =>
      extractUrls(e.answers[l])
        .filter((u) => !published.has(u.replace(/\/$/, '')))
        .map((u) => `${e.id} [${l}] ${u}`),
    ),
  )
  assert.deepEqual(foreign, [])
})

test('the cost answer quotes the number of cached topics there are', () => {
  // A count of this file's own entries, which no src/data record can ground.
  const answers = faqEntries.find((e) => e.id === 'bot-cost-control')!.answers
  for (const locale of LOCALES) {
    assert.ok(
      answers[locale].includes(String(faqEntries.length)),
      `bot-cost-control [${locale}] does not quote ${faqEntries.length} topics`,
    )
  }
})

test('the citations a cached answer carries are the chunks that ground it, with their public links', () => {
  // The cache serves exactly these (ingest/build-faq-cache.ts writes them into
  // each point), so they come from the same grounding the tests above run and
  // cannot cite a chunk that does not state the fact.
  for (const entry of faqEntries) {
    for (const locale of LOCALES) {
      const g = groundFacts(entry.answers[locale], locale, chunks)
      const cited = citeFacts(entry.answers[locale], locale, chunks)
      assert.deepEqual(
        cited.map((c) => c.id),
        g.sources.map((s) => s.id),
      )
      for (const c of cited) {
        const chunk = chunks.find((x) => x.id === c.id)!
        assert.equal(c.url, sourceUrl({ ...chunk, url: chunk.url ?? null }))
        assert.equal(c.locale, locale)
      }
    }
  }
})
