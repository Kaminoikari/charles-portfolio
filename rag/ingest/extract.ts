// Extract the portfolio corpus from the typed data modules into flat chunk
// records, one set per locale. We import the real TS modules (run via tsx) so
// the chunk content can never drift from what the site renders — no brittle
// source-file regex parsing.
//
// Chunking strategy: the data is already semantically bounded (one project, one
// role, one philosophy bullet), so those boundaries ARE the chunks. Long
// case-study prose becomes one chunk per (project, section) — small enough to
// embed well, large enough to stay self-contained. Each child chunk carries a
// parent_id so the generate step could expand context if needed.

import { createHash } from 'node:crypto'

import type { Locale } from '../../src/i18n/config.js'
import { config } from '../config.js'
import { chunkText } from './chunk.js'
import { getBlogBody } from './blog-bodies.js'

export interface ChunkRecord {
  id: string
  parentId: string | null
  sourceType: 'project' | 'about' | 'experience' | 'skill' | 'changelog' | 'blog' | 'playbook' | 'knowledge'
  projectId: string | null
  locale: string
  title: string
  content: string
  // External article URL — set only on blog chunks so the chat UI can link a
  // cited blog source straight to the original post.
  url?: string
}

const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']

// Dynamic imports keep this file decoupled from the per-locale module names and
// let one loop cover all three languages.
async function loadLocale(locale: Locale) {
  const suffix = locale === 'en' ? 'en' : locale // files are *.en.ts / *.zh-TW.ts / *.ja.ts
  const [projects, about, experience, skills, changelog, blog, agentPatterns] = await Promise.all([
    import(`../../src/data/projects.${suffix}.ts`),
    import(`../../src/data/aboutContent.${suffix}.ts`),
    import(`../../src/data/experience.${suffix}.ts`),
    import(`../../src/data/skills.${suffix}.ts`),
    import(`../../src/data/changelog.${suffix}.ts`),
    import(`../../src/data/blog.${suffix}.ts`),
    import(`../../src/data/agentPatterns.${suffix}.ts`),
  ])
  return { projects, about, experience, skills, changelog, blog, agentPatterns }
}

// Flatten a changelog body (string | block objects) into plain text.
function changelogBodyText(body: unknown[]): string {
  return body
    .map((b) => {
      if (typeof b === 'string') return b
      const blk = b as { kind: string; text?: string; items?: unknown[] }
      if (blk.kind === 'heading') return blk.text ?? ''
      if (blk.kind === 'list') return (blk.items as string[]).join(' ')
      if (blk.kind === 'stats') {
        return (blk.items as { value: string; label: string }[])
          .map((s) => `${s.value} ${s.label}`)
          .join(', ')
      }
      return ''
    })
    .join('\n')
    // strip the inline markdown-lite the renderer supports
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
}

// A chunk id has to name the thing it holds, never its slot in an array. Every
// list the corpus is built from grows at the FRONT (newest article, newest role),
// so an index-derived id renames everything below the insertion point: the whole
// tail gets re-embedded, the points behind the old ids are orphaned, and the
// golden eval set — which pins ids — starts silently grading a different chunk.
// Nothing fails loudly, which is why it went unnoticed for months.
//
// So each source derives its id from whatever already owns its identity, and a
// collision is a build error rather than a last-write-wins overwrite.
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '')
}

// Guards a per-source id space: same key twice means two entries would overwrite
// each other's chunks, which is a data bug the build should refuse to encode.
function uniqueKey(seen: Set<string>, key: string, source: string, what: string): string {
  if (seen.has(key)) throw new Error(`duplicate ${source} key "${key}" — ${what} collides with an earlier entry`)
  seen.add(key)
  return key
}

// Blog identity is the article URL: blog-bodies.json is keyed by it and the
// fetcher dedupes on it, so it already owns the article and nothing new has to
// be invented. Retitling or rewriting an article therefore leaves its id alone.
//
// Substack paths give a clean human slug ("/p/outcome" → "outcome"). Medium
// percent-encodes a Chinese title and appends its own post id, and the CJK runs
// collapse to separators, leaving that trailing hex as the distinguishing part —
// hence the 64-char budget, which is wide enough to keep it.
export function blogSlug(url: string): string {
  const last = decodeURIComponent(new URL(url).pathname.replace(/\/+$/, '').split('/').pop() ?? '')
  // Nothing survived (e.g. an all-CJK path with no id): fall back to the URL
  // digest, which is stable and unique even though it reads as noise.
  return slugify(last) || createHash('sha1').update(url).digest('hex').slice(0, 12)
}

export interface BlogArticleInput {
  title: string
  subtitle: string
  date: string
  url: string
}

// Blog chunks: a title+subtitle parent chunk (the id cited and deep-linked) plus,
// when the article's full text has been fetched into blog-bodies.json, one child
// chunk per body slice so the bot can answer questions whose answer lives in the
// body rather than the headline. Bodies are Traditional Chinese for every locale
// (the source articles are written once, in Chinese); the multilingual dense
// embedding still lets en/ja queries retrieve them.
export function blogChunks(articles: BlogArticleInput[], locale: string): ChunkRecord[] {
  const out: ChunkRecord[] = []
  const seen = new Set<string>()

  articles.forEach((b) => {
    const slug = uniqueKey(seen, blogSlug(b.url), 'blog', b.url)
    const parentId = `blog:${slug}:${locale}`
    out.push({ id: parentId, parentId: null, sourceType: 'blog', projectId: null, locale, title: b.title, content: `${b.title}\n${b.subtitle}`, url: b.url })

    if (!config.blogBodyEnabled) return
    const body = getBlogBody(b.url)
    if (!body) return
    const pieces = chunkText(body, { maxChars: config.blogChunkChars, overlap: config.blogChunkOverlap })
    pieces.forEach((piece, j) =>
      out.push({
        id: `blog:${slug}:body:${j}:${locale}`,
        parentId,
        sourceType: 'blog',
        projectId: null,
        locale,
        title: `${b.title} — part ${j + 1}`,
        content: piece,
        url: b.url,
      }),
    )
  })

  return out
}

export interface AboutContentInput {
  whoIAm: string[]
  philosophyBullets: { id: string; title: string; body: string }[]
  aiTable: { id: string; label: string; body: string }[]
}

// About identity comes from the `id` each bullet and table row now carries. The
// visible title/label cannot serve: philosophy titles are already translated per
// locale, and the AI-table labels are only English by coincidence — they are view
// copy, so keying on them would make the id a hostage to a copy edit. The who-I-am
// paragraphs are the exception: they are bare prose in a `string[]` with nothing
// to key on, so the paragraph is its own identity via a digest. That costs one
// swapped point per copy edit (the reconciler's ordinary prune clears it, being
// far under RAG_PRUNE_MAX) and in exchange an inserted paragraph never disturbs
// the others. Give whoIAm real keys if it ever needs to be cited or eval-pinned.
export function aboutChunks(about: AboutContentInput, locale: string): ChunkRecord[] {
  const out: ChunkRecord[] = []
  const base = { parentId: null, sourceType: 'about' as const, projectId: null, locale }

  const paragraphs = new Set<string>()
  about.whoIAm.forEach((p) => {
    const key = uniqueKey(paragraphs, createHash('sha1').update(p).digest('hex').slice(0, 12), 'about:whoiam', p.slice(0, 40))
    out.push({ ...base, id: `about:whoiam:${key}:${locale}`, title: 'About — Who I Am', content: p })
  })

  const bullets = new Set<string>()
  about.philosophyBullets.forEach((b) => {
    const key = uniqueKey(bullets, b.id, 'about:philosophy', b.title)
    out.push({ ...base, id: `about:philosophy:${key}:${locale}`, title: `Product philosophy — ${b.title}`, content: `${b.title}: ${b.body}` })
  })

  const rows = new Set<string>()
  about.aiTable.forEach((r) => {
    const key = uniqueKey(rows, r.id, 'about:ai', r.label)
    out.push({ ...base, id: `about:ai:${key}:${locale}`, title: `How I use AI — ${r.label}`, content: `${r.label}: ${r.body}` })
  })

  return out
}

export interface ExperienceInput {
  dateRange: string
  title: string
  organization: string
  orgKey?: string
  bullets: string[]
}

// Experience identity is the English company name. `organization` is localized
// (the zh-TW timeline is bilingual), but `orgKey` already exists to hold the
// English name for the career-photo lookup, so `orgKey ?? organization` is the
// same string in all three locales and keeps `experience:uspace…` pinnable in the
// golden set. Two stints at one company would collide; that throws, and the fix
// is to widen the key rather than to fall back on position.
export function experienceChunks(items: ExperienceInput[], locale: string): ChunkRecord[] {
  const seen = new Set<string>()

  return items.map((e) => {
    const org = e.orgKey ?? e.organization
    const key = uniqueKey(seen, slugify(org), 'experience', org)
    return {
      id: `experience:${key}:${locale}`,
      parentId: null,
      sourceType: 'experience' as const,
      projectId: null,
      locale,
      title: `${e.title} @ ${e.organization}`,
      content: `${e.title} at ${e.organization} (${e.dateRange})\n${e.bullets.join('\n')}`,
    }
  })
}

export async function extractAll(): Promise<ChunkRecord[]> {
  const out: ChunkRecord[] = []

  for (const locale of LOCALES) {
    const { projects, about, experience, skills, changelog, blog, agentPatterns } = await loadLocale(locale)

    // ── projects (one parent per project; one child chunk per section) ──
    for (const d of projects.projectDetails) {
      const parentId = `project:${d.id}:${locale}`
      out.push({
        id: parentId,
        parentId: null,
        sourceType: 'project',
        projectId: d.id,
        locale,
        title: d.title,
        content: `${d.title}\n${d.subtitle}`,
      })
      const sections: [string, string[]][] = [
        ['problem', d.problem],
        ['solution', d.solution],
        ['impact', d.impact],
        ['learnings', d.learnings],
      ]
      for (const [section, lines] of sections) {
        out.push({
          id: `project:${d.id}:${section}:${locale}`,
          parentId,
          sourceType: 'project',
          projectId: d.id,
          locale,
          title: `${d.title} — ${section}`,
          content: lines.join('\n'),
        })
      }
      out.push({
        id: `project:${d.id}:tech:${locale}`,
        parentId,
        sourceType: 'project',
        projectId: d.id,
        locale,
        title: `${d.title} — tech stack`,
        content: d.techStack.map((t: { category: string; items: string }) => `${t.category}: ${t.items}`).join('\n'),
      })
    }

    // ── about (who-I-am paras + philosophy + AI table; see aboutChunks) ──
    out.push(...aboutChunks(about.aboutContent, locale))

    // ── experience (one chunk per role; see experienceChunks) ──
    out.push(...experienceChunks(experience.experience, locale))

    // ── skills (single rolled-up chunk — each item is tiny) ──
    out.push({ id: `skills:all:${locale}`, parentId: null, sourceType: 'skill', projectId: null, locale, title: 'Skills', content: skills.skills.map((s: { name: string }) => s.name).join('; ') })

    // ── changelog (one chunk per entry) ──
    changelog.changelog.forEach((c: { id: string; date: string; title: string; body: unknown[] }) =>
      out.push({ id: `changelog:${c.id}:${locale}`, parentId: null, sourceType: 'changelog', projectId: null, locale, title: c.title, content: `${c.title} (${c.date})\n${changelogBodyText(c.body)}` }),
    )

    // ── blog (see blogChunks) ──
    out.push(...blogChunks(blog.blogArticles, locale))

    // ── agentic design patterns (Charles's curated knowledge; one chunk per
    // pattern + an umbrella intro chunk). Lets the bot answer "does Charles know
    // agentic design patterns / how does he apply X" from his real practice. ──
    const patternsIntroId = `pattern:overview:${locale}`
    out.push({
      id: patternsIntroId,
      parentId: null,
      sourceType: 'knowledge',
      projectId: null,
      locale,
      title: 'Agentic design patterns — overview',
      content: agentPatterns.agentPatternsIntro,
    })
    agentPatterns.agentPatterns.forEach((p: { id: string; name: string; body: string }) =>
      out.push({
        id: `pattern:${p.id}:${locale}`,
        parentId: patternsIntroId,
        sourceType: 'knowledge',
        projectId: null,
        locale,
        title: `Agentic design pattern — ${p.name}`,
        content: `${p.name}\n${p.body}`,
      }),
    )
  }

  return out
}
