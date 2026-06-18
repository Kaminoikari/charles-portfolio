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

import type { Locale } from '../../src/i18n.js'
import { config } from '../config.js'
import { chunkText } from './chunk.js'
import { getBlogBody } from './blog-bodies.js'

export interface ChunkRecord {
  id: string
  parentId: string | null
  sourceType: 'project' | 'about' | 'experience' | 'skill' | 'changelog' | 'blog' | 'playbook'
  projectId: string | null
  locale: string
  title: string
  content: string
}

const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']

// Dynamic imports keep this file decoupled from the per-locale module names and
// let one loop cover all three languages.
async function loadLocale(locale: Locale) {
  const suffix = locale === 'en' ? 'en' : locale // files are *.en.ts / *.zh-TW.ts / *.ja.ts
  const [projects, about, experience, skills, changelog, blog] = await Promise.all([
    import(`../../src/data/projects.${suffix}.ts`),
    import(`../../src/data/aboutContent.${suffix}.ts`),
    import(`../../src/data/experience.${suffix}.ts`),
    import(`../../src/data/skills.${suffix}.ts`),
    import(`../../src/data/changelog.${suffix}.ts`),
    import(`../../src/data/blog.${suffix}.ts`),
  ])
  return { projects, about, experience, skills, changelog, blog }
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

export async function extractAll(): Promise<ChunkRecord[]> {
  const out: ChunkRecord[] = []

  for (const locale of LOCALES) {
    const { projects, about, experience, skills, changelog, blog } = await loadLocale(locale)

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

    // ── about (who-I-am paras + philosophy + AI table + skills table) ──
    const a = about.aboutContent
    a.whoIAm.forEach((p: string, i: number) =>
      out.push({ id: `about:whoiam:${i}:${locale}`, parentId: null, sourceType: 'about', projectId: null, locale, title: 'About — Who I Am', content: p }),
    )
    a.philosophyBullets.forEach((b: { title: string; body: string }, i: number) =>
      out.push({ id: `about:philosophy:${i}:${locale}`, parentId: null, sourceType: 'about', projectId: null, locale, title: `Product philosophy — ${b.title}`, content: `${b.title}: ${b.body}` }),
    )
    a.aiTable.forEach((r: { label: string; body: string }, i: number) =>
      out.push({ id: `about:ai:${i}:${locale}`, parentId: null, sourceType: 'about', projectId: null, locale, title: `How I use AI — ${r.label}`, content: `${r.label}: ${r.body}` }),
    )

    // ── experience (one chunk per role) ──
    experience.experience.forEach((e: { dateRange: string; title: string; organization: string; bullets: string[] }, i: number) =>
      out.push({ id: `experience:${i}:${locale}`, parentId: null, sourceType: 'experience', projectId: null, locale, title: `${e.title} @ ${e.organization}`, content: `${e.title} at ${e.organization} (${e.dateRange})\n${e.bullets.join('\n')}` }),
    )

    // ── skills (single rolled-up chunk — each item is tiny) ──
    out.push({ id: `skills:all:${locale}`, parentId: null, sourceType: 'skill', projectId: null, locale, title: 'Skills', content: skills.skills.map((s: { name: string }) => s.name).join('; ') })

    // ── changelog (one chunk per entry) ──
    changelog.changelog.forEach((c: { id: string; date: string; title: string; body: unknown[] }) =>
      out.push({ id: `changelog:${c.id}:${locale}`, parentId: null, sourceType: 'changelog', projectId: null, locale, title: c.title, content: `${c.title} (${c.date})\n${changelogBodyText(c.body)}` }),
    )

    // ── blog (title+subtitle parent chunk + optional full-text body chunks) ──
    // The title+subtitle chunk keeps the stable `blog:<i>` id (acts as the parent
    // for deep-linking and citations). When the article's full text has been
    // fetched into blog-bodies.json, it's split into `blog:<i>:body:<j>` child
    // chunks so the bot can answer questions whose answer lives in the body, not
    // just the headline. Bodies are Traditional Chinese for every locale (the
    // source articles are written once, in Chinese); the multilingual dense
    // embedding still lets en/ja queries retrieve them.
    blog.blogArticles.forEach((b: { title: string; subtitle: string; date: string; url: string }, i: number) => {
      const parentId = `blog:${i}:${locale}`
      out.push({ id: parentId, parentId: null, sourceType: 'blog', projectId: null, locale, title: b.title, content: `${b.title}\n${b.subtitle}` })

      if (!config.blogBodyEnabled) return
      const body = getBlogBody(b.url)
      if (!body) return
      const pieces = chunkText(body, { maxChars: config.blogChunkChars, overlap: config.blogChunkOverlap })
      pieces.forEach((piece, j) =>
        out.push({
          id: `blog:${i}:body:${j}:${locale}`,
          parentId,
          sourceType: 'blog',
          projectId: null,
          locale,
          title: `${b.title} — part ${j + 1}`,
          content: piece,
        }),
      )
    })
  }

  return out
}
