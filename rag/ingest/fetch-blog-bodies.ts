// Fetch full article bodies for the blog corpus into blog-bodies.json.
//
// This is the ONLY network-dependent ingest step. Run it occasionally (when you
// publish or edit an article), commit the refreshed JSON, then run the normal
// `npm run rag:ingest`. Separating fetch from ingest keeps the index
// reproducible and never blocks a build on a live (possibly rate-limited) fetch.
//
//   npx tsx rag/ingest/fetch-blog-bodies.ts            # fetch missing only
//   npx tsx rag/ingest/fetch-blog-bodies.ts --force    # refetch everything
//   npx tsx rag/ingest/fetch-blog-bodies.ts --dry-run  # list URLs, no network
//
// NETWORK NOTE: in a remote environment with an egress allowlist, the article
// hosts (e.g. *.substack.com, *.medium.com) must be allowlisted or every fetch
// returns "Host not in allowlist". Run locally, or add the hosts to the env's
// network egress settings.

import { writeFileSync } from 'node:fs'

import type { Locale } from '../../src/i18n/config.js'
import { loadBlogBodies, BODIES_PATH, type BlogBodyCache, type BlogBody } from './blog-bodies.js'

const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')
const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15'

interface Article { title: string; url: string }

// Collect every unique article URL across all locale blog modules (locales may
// in principle point at different URLs; in practice they share the originals).
async function collectArticles(): Promise<Map<string, Article>> {
  const byUrl = new Map<string, Article>()
  for (const locale of LOCALES) {
    const suffix = locale === 'en' ? 'en' : locale
    const mod = await import(`../../src/data/blog.${suffix}.ts`)
    for (const a of mod.blogArticles as Article[]) {
      if (!byUrl.has(a.url)) byUrl.set(a.url, { title: a.title, url: a.url })
    }
  }
  return byUrl
}

function classify(url: string): BlogBody['source'] {
  const h = new URL(url).hostname
  if (h.endsWith('substack.com')) return 'substack'
  if (h.endsWith('medium.com')) return 'medium'
  return 'other'
}

async function httpGet(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url} — ${(await res.text()).slice(0, 120)}`)
  return res.text()
}

// Minimal, dependency-free HTML → text. Drops scripts/styles, turns block-level
// tags into newlines, strips remaining tags, decodes common entities.
function htmlToText(html: string): string {
  // Prefer the <article> region when present — cuts most site chrome.
  const article = /<article[\s\S]*?<\/article>/i.exec(html)
  let s = article ? article[0] : html
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

// Substack feeds embed the full post HTML in <content:encoded>. Build a
// link→text map for one publication's feed (best source when the post is recent
// enough to still be in the feed window).
async function substackFeedMap(origin: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const xml = await httpGet(`${origin}/feed`)
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
    for (const it of items) {
      const link = /<link>(.*?)<\/link>/.exec(it)?.[1]?.trim()
      const enc = /<content:encoded>([\s\S]*?)<\/content:encoded>/.exec(it)?.[1] ?? ''
      const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(enc)?.[1] ?? enc
      if (link && cdata) map.set(link.replace(/\/$/, ''), htmlToText(cdata))
    }
  } catch (e) {
    console.warn(`  [feed] ${origin}/feed unavailable: ${(e as Error).message}`)
  }
  return map
}

async function main() {
  const articles = await collectArticles()
  console.log(`Found ${articles.size} unique article URLs across ${LOCALES.length} locales.`)

  if (DRY_RUN) {
    for (const a of articles.values()) console.log(`  [${classify(a.url)}] ${a.url}`)
    console.log('\n[dry-run] no network calls made.')
    return
  }

  const cache: BlogBodyCache = loadBlogBodies()
  const feedCache = new Map<string, Map<string, string>>() // origin → link→text
  let fetched = 0
  let skipped = 0
  let failed = 0

  for (const a of articles.values()) {
    if (!FORCE && cache[a.url]?.text) { skipped++; continue }
    const source = classify(a.url)
    try {
      let text = ''
      if (source === 'substack') {
        const origin = new URL(a.url).origin
        if (!feedCache.has(origin)) feedCache.set(origin, await substackFeedMap(origin))
        text = feedCache.get(origin)!.get(a.url.replace(/\/$/, '')) ?? ''
        if (!text) text = htmlToText(await httpGet(a.url)) // fallback: page
      } else {
        text = htmlToText(await httpGet(a.url))
      }
      if (!text || text.length < 200) throw new Error(`extracted text too short (${text.length} chars)`)
      cache[a.url] = { url: a.url, title: a.title, text, fetchedAt: new Date().toISOString(), source }
      fetched++
      console.log(`  ✓ [${source}] ${a.url}  (${text.length} chars)`)
    } catch (e) {
      failed++
      console.warn(`  ✗ ${a.url} — ${(e as Error).message}`)
    }
  }

  writeFileSync(BODIES_PATH, JSON.stringify(cache, null, 2) + '\n')
  console.log(`\nDone. fetched=${fetched} skipped=${skipped} failed=${failed} → ${BODIES_PATH}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
