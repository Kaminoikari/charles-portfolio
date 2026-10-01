// FAQ cache calibration: what each (threshold, margin) setting would serve, and
// how often what it serves is the wrong entry.
//
//   npx tsx rag/evals/faq-calibration.ts [--out report.md] [--dump observations.json]
//
// Needs QDRANT_* only. No embedding call: every query is a paraphrase already in
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

// One leave-one-out query and what Qdrant returned for it. Stored as plain data
// so the sweep below is pure and testable without a cluster.
export interface Observation {
  expected: string
  locale: string
  question: string
  dense: { score: number; payload: Record<string, unknown> }[]
  lexicalIds: string[]
}

export interface Outcome {
  threshold: number
  margin: number
  veto: boolean
  served: number
  correct: number
  wrong: number
  // The wrong serves themselves, so a reader can see what the setting confuses.
  confusions: { question: string; expected: string; served: string; locale: string }[]
}

export function evaluate(observations: Observation[], params: FaqParams, veto: boolean): Outcome {
  const out: Outcome = { ...params, veto, served: 0, correct: 0, wrong: 0, confusions: [] }
  for (const o of observations) {
    const v = denseVerdict(o.dense, params)
    if (!v.ok) continue
    if (veto && lexicalVeto(v.topId, o.lexicalIds)) continue
    out.served++
    if (v.topId === o.expected) out.correct++
    else {
      out.wrong++
      out.confusions.push({ question: o.question, expected: o.expected, served: v.topId, locale: o.locale })
    }
  }
  return out
}

export const THRESHOLDS = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85]
export const MARGINS = [0, 0.01, 0.02, 0.03, 0.05, 0.08]

export function sweep(observations: Observation[], veto: boolean): Outcome[] {
  return THRESHOLDS.flatMap((threshold) => MARGINS.map((margin) => evaluate(observations, { threshold, margin }, veto)))
}

// The setting to run: no wrong serves, then the most correct ones. Ties go to
// the stricter setting, since two settings serving the same answers differ only
// in what they would do with a phrasing this set does not contain.
export function recommend(outcomes: Outcome[]): Outcome | null {
  const safe = outcomes.filter((o) => o.wrong === 0)
  if (safe.length === 0) return null
  return safe.reduce((best, o) =>
    o.correct > best.correct ||
    (o.correct === best.correct && (o.threshold > best.threshold || (o.threshold === best.threshold && o.margin > best.margin)))
      ? o
      : best,
  )
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`)

export function report(observations: Observation[], current: FaqParams): string {
  const answerable = observations.length
  const lines: string[] = [
    '# FAQ cache calibration',
    '',
    `${answerable} leave-one-out queries (every paraphrase in the cache, its own point excluded).`,
    'A serve is **correct** when it names the entry the paraphrase belongs to, **wrong** otherwise.',
    '',
  ]
  for (const veto of [true, false]) {
    const outcomes = sweep(observations, veto)
    const rec = recommend(outcomes)
    const cur = outcomes.find((o) => o.threshold === current.threshold && o.margin === current.margin)
    lines.push(`## Lexical veto ${veto ? 'on (production)' : 'off'}`, '')
    lines.push('| threshold \\ margin | ' + MARGINS.join(' | ') + ' |')
    lines.push('|---|' + MARGINS.map(() => '---').join('|') + '|')
    for (const t of THRESHOLDS) {
      const row = MARGINS.map((m) => {
        const o = outcomes.find((x) => x.threshold === t && x.margin === m)!
        return `${o.correct} ✓ / ${o.wrong} ✗`
      })
      lines.push(`| ${t} | ${row.join(' | ')} |`)
    }
    lines.push('')
    if (cur) {
      lines.push(
        `Current (${current.threshold} / ${current.margin}): serves ${cur.served}, ` +
          `${cur.correct} correct (${pct(cur.correct, answerable)} coverage), ${cur.wrong} wrong (${pct(cur.wrong, cur.served)} of serves).`,
      )
    }
    lines.push(
      rec
        ? `Recommended: threshold ${rec.threshold}, margin ${rec.margin}: ${rec.correct} correct, 0 wrong.`
        : 'No setting in the grid serves without a wrong answer.',
      '',
    )
    if (cur && cur.confusions.length > 0) {
      lines.push('Wrong serves at the current setting:', '')
      for (const c of cur.confusions) lines.push(`- [${c.locale}] "${c.question}": wanted \`${c.expected}\`, served \`${c.served}\``)
      lines.push('')
    }
  }
  return lines.join('\n')
}

function idOf(payload: Record<string, unknown> | null | undefined): string | undefined {
  const id = payload?.faq_id
  return typeof id === 'string' ? id : undefined
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
  const md = report(observations, { threshold: config.faqCacheThreshold, margin: config.faqCacheMargin })
  console.log(md)
  if (out) writeFileSync(out, md + '\n')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
