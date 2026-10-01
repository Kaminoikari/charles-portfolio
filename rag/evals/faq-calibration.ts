// FAQ cache calibration: what each (threshold, margin) setting would serve, and
// how often what it serves is the wrong entry.
//
//   npx tsx rag/evals/faq-calibration.ts [--out report.md] [--dump observations.json] [--judge [--verdicts verdicts.json]]
//
// Needs QDRANT_* (and ANTHROPIC_API_KEY with --judge). No embedding call: every query is a paraphrase already in
// the cache, re-asked with its own point excluded (leave-one-out), using the
// vector stored on that point. That makes the labels free and exact. The right
// answer to a paraphrase of entry E is E. A setting that serves anything else
// served a confident wrong answer; one that serves nothing fell through to RAG,
// which costs a generation and nothing more. Entries with a single paraphrase in
// a locale have no sibling left after exclusion, so for them every serve is
// wrong, which is what makes them the negatives in this set.
//
// What it cannot see: phrasings unlike any paraphrase in the file. Those are
// what production logs (`faqprobe`) are for. This harness answers the question
// the 2026-09-16 review left open, whether 0.02 is a good margin, on the one set
// where the right answer is known for every query.

import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { config } from '../config.js'
import { qdrant, denseVerdict, lexicalVeto, DENSE, SPARSE, type FaqParams } from '../qdrant.js'
import { judgeResponsive } from './judge.js'
import { triage as classifyQuestion } from '../triage.js'
import type { Locale } from '../language.js'
import { faqEntries, type FaqEntry } from '../faq-cache.js'

// One leave-one-out query and what Qdrant returned for it. Stored as plain data
// so the sweep below is pure and testable without a cluster.
export interface Observation {
  expected: string
  locale: string
  question: string
  // The deterministic tier answers this question before the FAQ cache is asked
  // (triage.ts: privacy, education, contact, greetings), so in production no
  // FAQ setting can serve it. Left out of every count.
  triaged?: boolean
  dense: { score: number; payload: Record<string, unknown> }[]
  lexicalIds: string[]
}

export interface Confusion {
  question: string
  expected: string
  served: string
  locale: string
  answer: string
}

export interface Outcome {
  threshold: number
  margin: number
  veto: boolean
  served: number
  correct: number
  wrong: number
  // Wrong serves whose answer a judge read as not answering the question
  // (judge.ts judgeResponsive). A wrong entry on an overlapping topic often
  // still answers; these are the ones that do not. null when no judge ran.
  harmful: number | null
  // The wrong serves themselves, so a reader can see what the setting confuses.
  confusions: Confusion[]
}

// Verdicts are keyed by what was asked and what was served, so one judgement
// covers that pair at every setting that serves it.
export const confusionKey = (c: Pick<Confusion, 'locale' | 'question' | 'served'>) =>
  `${c.locale}\u0000${c.question}\u0000${c.served}`

export function evaluate(
  observations: Observation[],
  params: FaqParams,
  veto: boolean,
  responsive?: Map<string, boolean>,
): Outcome {
  const out: Outcome = { ...params, veto, served: 0, correct: 0, wrong: 0, harmful: responsive ? 0 : null, confusions: [] }
  for (const o of observations) {
    if (o.triaged) continue
    const v = denseVerdict(o.dense, params)
    if (!v.ok) continue
    if (veto && lexicalVeto(v.topId, o.lexicalIds)) continue
    out.served++
    if (v.topId === o.expected) out.correct++
    else {
      out.wrong++
      const c = { question: o.question, expected: o.expected, served: v.topId, locale: o.locale, answer: v.answer }
      out.confusions.push(c)
      // An unjudged pair counts as harmful: the safe reading of a missing verdict.
      if (responsive && responsive.get(confusionKey(c)) !== true) out.harmful = (out.harmful ?? 0) + 1
    }
  }
  return out
}

export const THRESHOLDS = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]
export const MARGINS = [0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.12, 0.15]

export function sweep(observations: Observation[], veto: boolean, responsive?: Map<string, boolean>): Outcome[] {
  return THRESHOLDS.flatMap((threshold) =>
    MARGINS.map((margin) => evaluate(observations, { threshold, margin }, veto, responsive)),
  )
}

// The setting to run: at most `maxHarmRate` of what it serves fails to answer
// the question (every wrong serve counts when no judge ran), then the most
// answers that do. Ties go to the stricter setting, since two settings serving
// the same answers differ only in what they would do with a phrasing this set
// does not contain.
//
// Why a budget and not zero: on the 2026-10-01 data no setting in the grid
// reaches zero, and the last one or two harmful serves at the strict end are
// within what a single judge's misreading can account for. 1% keeps the rule
// strict enough that the current production setting (5.7%) is nowhere near it.
export const MAX_HARM_RATE = 0.01

export function recommend(outcomes: Outcome[], maxHarmRate = MAX_HARM_RATE): Outcome | null {
  const bad = (o: Outcome) => o.harmful ?? o.wrong
  const good = (o: Outcome) => o.served - bad(o)
  const safe = outcomes.filter((o) => o.served > 0 && bad(o) <= maxHarmRate * o.served)
  if (safe.length === 0) return null
  return safe.reduce((best, o) =>
    good(o) > good(best) ||
    (good(o) === good(best) && (o.threshold > best.threshold || (o.threshold === best.threshold && o.margin > best.margin)))
      ? o
      : best,
  )
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`)

export function report(observations: Observation[], current: FaqParams, responsive?: Map<string, boolean>): string {
  const answerable = observations.filter((o) => !o.triaged).length
  const lines: string[] = [
    '# FAQ cache calibration',
    '',
    `${answerable} leave-one-out queries (every paraphrase in the cache, its own point excluded), ` +
      `after ${observations.length - answerable} that the deterministic triage tier answers before the cache is asked.`,
    'A serve is **correct** when it names the entry the paraphrase belongs to, **wrong** otherwise.',
    responsive
      ? 'A wrong serve is **harmful** when a judge read the served answer as not answering the question (judge.ts judgeResponsive).'
      : 'No judge ran, so every wrong serve is treated as harmful.',
    '',
  ]
  for (const veto of [true, false]) {
    const outcomes = sweep(observations, veto, responsive)
    const rec = recommend(outcomes)
    const cur = outcomes.find((o) => o.threshold === current.threshold && o.margin === current.margin)
    lines.push(`## Lexical veto ${veto ? 'on (production)' : 'off'}`, '')
    lines.push('| threshold \\ margin | ' + MARGINS.join(' | ') + ' |')
    lines.push('|---|' + MARGINS.map(() => '---').join('|') + '|')
    for (const t of THRESHOLDS) {
      const row = MARGINS.map((m) => {
        const o = outcomes.find((x) => x.threshold === t && x.margin === m)!
        return o.harmful === null ? `${o.correct} ✓ / ${o.wrong} ✗` : `${o.correct} ✓ / ${o.wrong} ✗ (${o.harmful} harmful)`
      })
      lines.push(`| ${t} | ${row.join(' | ')} |`)
    }
    lines.push('')
    if (cur) {
      lines.push(
        `Current (${current.threshold} / ${current.margin}): serves ${cur.served}, ` +
          `${cur.correct} correct (${pct(cur.correct, answerable)} coverage), ${cur.wrong} wrong (${pct(cur.wrong, cur.served)} of serves)` +
          (cur.harmful === null ? '.' : `, ${cur.harmful} harmful (${pct(cur.harmful, cur.served)} of serves).`),
      )
    }
    lines.push(
      rec
        ? `Recommended (harmful at most ${MAX_HARM_RATE * 100}% of serves): threshold ${rec.threshold}, margin ${rec.margin}: ` +
            `serves ${rec.served}, ${rec.correct} correct, ${rec.wrong} wrong, ${rec.harmful ?? rec.wrong} harmful.`
        : `No setting in the grid keeps harmful serves at or under ${MAX_HARM_RATE * 100}%.`,
      '',
    )
    if (cur && cur.confusions.length > 0) {
      lines.push('Wrong serves at the current setting:', '')
      for (const c of cur.confusions) {
        const verdict = responsive ? (responsive.get(confusionKey(c)) === true ? ' (answers it)' : ' (**harmful**)') : ''
        lines.push(`- [${c.locale}] "${c.question}": wanted \`${c.expected}\`, served \`${c.served}\`${verdict}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}

function idOf(payload: Record<string, unknown> | null | undefined): string | undefined {
  const id = payload?.faq_id
  return typeof id === 'string' ? id : undefined
}

// What the scratch collection holds that this ref's FAQ does not, and the
// reverse. The build into it is incremental and prune-capped, so it can keep
// another revision's points; a sweep over those measures entries that no longer
// exist (2026-10-01: 109 stale points, refused by RAG_PRUNE_MAX).
export function collectionDrift(
  points: { faq_id?: unknown; locale?: unknown; question?: unknown }[],
  entries: FaqEntry[],
): { stale: string[]; missing: string[] } {
  const key = (locale: unknown, id: unknown, question: unknown) => `${locale} ${id}: ${question}`
  const want = new Set(
    entries.flatMap((e) =>
      (['en', 'zh-TW', 'ja'] as const).flatMap((l) => e.questions[l].map((q) => key(l, e.id, q))),
    ),
  )
  const have = new Set(points.map((p) => key(p.locale, p.faq_id, p.question)))
  return {
    stale: [...have].filter((k) => !want.has(k)),
    missing: [...want].filter((k) => !have.has(k)),
  }
}

async function collect(): Promise<Observation[]> {
  const db = qdrant()
  const points: { id: string | number; vector: number[]; payload: Record<string, unknown> }[] = []
  let offset: string | number | null | undefined = undefined
  do {
    const res = await db.scroll(config.qdrantFaqCollection, {
      limit: 256,
      offset: offset ?? undefined,
      with_payload: true,
      with_vector: [DENSE],
    })
    for (const p of res.points) {
      const v = (p.vector as Record<string, unknown> | undefined)?.[DENSE]
      if (Array.isArray(v) && p.payload) points.push({ id: p.id, vector: v as number[], payload: p.payload })
    }
    offset = res.next_page_offset as string | number | null | undefined
  } while (offset !== null && offset !== undefined)

  const drift = collectionDrift(
    points.map((p) => p.payload),
    faqEntries,
  )
  if (drift.stale.length || drift.missing.length) {
    throw new Error(
      `${config.qdrantFaqCollection} is not this ref's FAQ: ${drift.stale.length} stale point(s), ` +
        `${drift.missing.length} missing (first: ${[...drift.stale, ...drift.missing].slice(0, 3).join(' | ')}). ` +
        'Rebuild it with RAG_PRUNE=1.',
    )
  }

  const observations: Observation[] = []
  const queue = [...points]
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const expected = idOf(p.payload)
      const locale = String(p.payload.locale ?? '')
      const question = String(p.payload.question ?? '')
      if (!expected || !locale || !question) continue
      const filter = { must: [{ key: 'locale', match: { value: locale } }], must_not: [{ has_id: [p.id] }] }
      const [dense, lex] = await Promise.all([
        db.query(config.qdrantFaqCollection, { query: p.vector, using: DENSE, filter, limit: config.faqCandidateK, with_payload: true }),
        db.query(config.qdrantFaqCollection, {
          query: { text: question, model: config.sparseModel } as never,
          using: SPARSE,
          filter,
          limit: config.faqVetoK,
          with_payload: true,
        }),
      ])
      observations.push({
        expected,
        locale,
        question,
        triaged: classifyQuestion(question, locale as Locale).kind !== 'pass',
        dense: dense.points.map((x) => ({ score: x.score ?? 0, payload: x.payload ?? {} })),
        lexicalIds: lex.points.map((x) => idOf(x.payload)).filter((id): id is string => id !== undefined),
      })
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return observations
}

async function main() {
  const flag = (name: string) => {
    const i = process.argv.indexOf(name)
    return i >= 0 ? process.argv[i + 1] : undefined
  }
  const out = flag('--out')
  // The raw observations, so a rule change can be scored offline against the
  // same queries without another pass over the cluster.
  const dump = flag('--dump')
  const observations = await collect()
  if (dump) writeFileSync(dump, JSON.stringify(observations))
  // --judge: read every distinct wrong serve any production-veto setting makes,
  // once, and score settings by the ones that fail to answer the question.
  let responsive: Map<string, boolean> | undefined
  if (process.argv.includes('--judge')) {
    const pairs = new Map<string, Confusion>()
    for (const o of sweep(observations, true)) for (const c of o.confusions) pairs.set(confusionKey(c), c)
    console.log(`Judging ${pairs.size} distinct wrong serves …`)
    responsive = new Map()
    const queue = [...pairs.entries()]
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const [key, c] = next
        responsive!.set(key, (await judgeResponsive(c.question, c.answer)).responsive)
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
  }
  const verdicts = flag('--verdicts')
  if (verdicts && responsive) writeFileSync(verdicts, JSON.stringify([...responsive.entries()]))
  const md = report(observations, { threshold: config.faqCacheThreshold, margin: config.faqCacheMargin }, responsive)
  console.log(md)
  if (out) writeFileSync(out, md + '\n')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
