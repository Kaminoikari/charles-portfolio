// Offline grounding of hand-written text against the corpus it claims to quote.
//
// Three surfaces in rag/ are written by hand and served as fact without passing
// through retrieval: the FAQ cache's answers, the entity graph's notes, and the
// portfolio map. Each one goes stale the same way, silently, when src/data moves
// and the hand-written copy does not. This module is the one definition of
// "this sentence's facts are still in the corpus", shared by the tests that
// guard those surfaces and by the FAQ ingest that derives each cached answer's
// sources from it, so the check and the citations can never disagree about
// what grounds an answer.
//
// A fact here is a number or a month-and-year, because those are what a visitor
// acts on and what copy-editing gets wrong: "+40%", "15-person", "NT$450M",
// "since August 2026". Prose claims have no verbatim counterpart to compare
// against and are out of scope.
//
// Known weaknesses, stated so nobody mistakes the check for more than it is: a
// bare two-digit number can be matched by an unrelated chunk that happens to
// contain it, and a single digit is not checked at all ("3 tiers", "(1)" would
// match nearly every chunk). Facts that carry a unit (%, x, +, M, K) are matched
// with the unit, which is where the claims that matter live.

import { sourceUrl } from './source-url.js'

export interface GroundingChunk {
  id: string
  locale: string
  sourceType: string
  projectId: string | null
  title: string
  content: string
  url?: string
}

// Unicode minus and en dash are how the answers write "−40%"; the corpus writes
// "-40%". Bold markers split a number from its unit ("**+40%**"). Neither is a
// difference in the fact.
function normalise(text: string): string {
  return text.replace(/[−–]/g, '-').replace(/\*\*/g, '')
}

const URL_RE = /https?:\/\/[^\s)\]>"'`，。、]+/g
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g

// Links and addresses carry digits ("charles-chen-809a2043") that are not facts.
// They are checked by extractUrls against the set of links the site publishes.
function withoutLinks(text: string): string {
  return text.replace(URL_RE, ' ').replace(EMAIL_RE, ' ')
}

// A sign belongs to the number only where it starts a token: "+40%" is a claim,
// the "-2" in "gemini-2.5" is part of a model name.
const FACT_RE = /(?:(?<=^|[\s(（:：、,，/])[+-])?(?:NT\$)?\d+(?:[.,]\d+)*(?:\s?(?:%|x|K\+?|M\+?|\+))?/g

export function extractFacts(text: string): string[] {
  const out = new Set<string>()
  for (const m of withoutLinks(normalise(text)).matchAll(FACT_RE)) {
    const fact = m[0].trim()
    // A single digit is a list marker or a count written in passing ("3 tiers",
    // "(1)"), and would match nearly every chunk in the corpus.
    if (/^\d$/.test(fact)) continue
    out.add(fact)
  }
  return [...out]
}

// A month-and-year is its own kind of fact. As a bare number "2026" is stated by
// some changelog entry or other, so a promotion date nobody recorded passed as
// grounded the first time this ran. Dates are compared as YYYY-MM and only
// against the curated records (DATE_SOURCES), never a changelog's or blog's own
// publication date.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (m: number) => String(m).padStart(2, '0')
// Every spelling the copy uses, and only those: a prefix match read "Marketing
// 2024" as March 2024.
const MONTH_YEAR_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{4})\b/gi

export function extractDates(text: string): string[] {
  const t = normalise(text)
  const out = new Set<string>()
  for (const m of t.matchAll(MONTH_YEAR_RE)) {
    out.add(`${m[2]}-${pad(MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1)}`)
  }
  for (const m of t.matchAll(/(\d{4})\s*年\s*(\d{1,2})\s*月/g)) out.add(`${m[1]}-${pad(Number(m[2]))}`)
  return [...out]
}

const DATE_SOURCES = new Set(['experience', 'about', 'project'])

export function extractUrls(text: string): string[] {
  return [...new Set([...text.matchAll(URL_RE)].map((m) => m[0].replace(/[.,;:!?]+$/, '')))]
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Whether `text` states `fact`. The number must stand alone: no digit glued to
// either side, and no further digits after a point or comma on the right.
// "N+" also reads as the corpus's own ways of saying it: "more than N",
// 「N 年以上」, "N 年以上".
export function mentionsFact(text: string, fact: string): boolean {
  const t = normalise(text)
  if (new RegExp(`(?<![\\d.,])${escape(fact)}(?![\\d]|[.,]\\d)`).test(t)) return true
  const plus = fact.match(/^(\d+)\+$/)
  if (plus) {
    const n = plus[1]
    return new RegExp(`more than ${n}\\b|(?<!\\d)${n}\\s*\\S?\\s*以上`).test(t)
  }
  return false
}

// Higher first. When two chunks state the same fact, the citation should be the
// curated record of it (the role, the project) rather than a changelog entry or
// a blog post that happens to repeat the number.
const SOURCE_PRIORITY: Record<string, number> = {
  experience: 6,
  project: 5,
  about: 4,
  skill: 3,
  knowledge: 2,
  changelog: 1,
  blog: 0,
}

export interface Grounding {
  // The chunks that together state every grounded fact, smallest set first-fit.
  sources: GroundingChunk[]
  // Facts no chunk in the locale states. Empty is the only passing state.
  ungrounded: string[]
}

// Greedy set cover: repeatedly take the chunk that states the most facts still
// uncovered, ties broken by source priority. Greedy is not minimal in general,
// and does not need to be: the output is a citation list, and what it must
// guarantee is only that every fact it claims to ground is stated by a chunk on
// the list.
export function groundFacts(text: string, locale: string, chunks: GroundingChunk[]): Grounding {
  const dates = extractDates(text).map((d) => `date:${d}`)
  const facts = [...extractFacts(text), ...dates]
  const pool = chunks.filter((c) => c.locale === locale)
  const states = new Map(
    pool.map((c) => {
      const body = `${c.title}\n${c.content}`
      const stated = DATE_SOURCES.has(c.sourceType) ? new Set(extractDates(body).map((d) => `date:${d}`)) : new Set<string>()
      return [c, facts.filter((f) => (f.startsWith('date:') ? stated.has(f) : mentionsFact(body, f)))]
    }),
  )
  const ungrounded = facts.filter((f) => ![...states.values()].some((fs) => fs.includes(f)))
  const open = new Set(facts.filter((f) => !ungrounded.includes(f)))
  const sources: GroundingChunk[] = []
  while (open.size > 0) {
    let best: GroundingChunk | null = null
    let bestCount = 0
    for (const [c, fs] of states) {
      const count = fs.filter((f) => open.has(f)).length
      if (count === 0) continue
      const better =
        count > bestCount ||
        (count === bestCount && best !== null && (SOURCE_PRIORITY[c.sourceType] ?? 0) > (SOURCE_PRIORITY[best.sourceType] ?? 0))
      if (better) {
        best = c
        bestCount = count
      }
    }
    if (!best) break
    sources.push(best)
    for (const f of states.get(best)!) open.delete(f)
  }
  return { sources, ungrounded }
}

// What a cached answer cites: the grounding chunks, in the shape the chat widget
// renders for a retrieved source. Stored in the FAQ point's payload at ingest,
// so serving a hit costs no lookup.
export interface CitedSource {
  id: string
  title: string
  locale: string
  url: string | null
}

export function citeFacts(text: string, locale: string, chunks: GroundingChunk[]): CitedSource[] {
  return groundFacts(text, locale, chunks).sources.map((c) => ({
    id: c.id,
    title: c.title,
    locale: c.locale,
    url: sourceUrl({ sourceType: c.sourceType, projectId: c.projectId, url: c.url ?? null, locale: c.locale }),
  }))
}
