// chat-logs insights — the "free product analytics" half of Phase 5. Every
// question hitting /api/chat is logged (see api/chat.ts → chat_logs). This
// script summarizes them: what recruiters actually ask, language split, how
// often the bot had to decline (fallback rate = a corpus-coverage signal), and
// latency. Run:  npx tsx rag/insights/report.ts  (needs QDRANT_*).

import { config } from '../config.js'
import { qdrant } from '../qdrant.js'

interface LogRow {
  type: 'open' | 'question' | null
  question: string | null
  language: string | null
  route: string | null
  loops: number | null
  latency_ms: number | null
  visitor_id: string | null
  ts: string
}

// The report is emailed as monospace `<pre>` (send_email.py wraps it with
// white-space:pre-wrap), so space-padded columns line up in the inbox. Keep one
// label width across sections so every metric block shares a left edge.
const LABEL_WIDTH = 20
const padR = (s: string | number, n: number) => String(s).padEnd(n)
const padL = (s: string | number, n: number) => String(s).padStart(n)

const TIME_ZONE = 'Asia/Taipei'
const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
// "2026-07-10 22:08" in Taipei time, matching by-day.ts's timezone convention.
const fmtWhen = (ms: number) => dateFmt.format(new Date(ms))

function tally<T extends string>(rows: LogRow[], key: (r: LogRow) => T | null): Map<T, number> {
  const m = new Map<T, number>()
  for (const r of rows) {
    const k = key(r)
    if (k != null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function topN<T extends string>(m: Map<T, number>, n: number): [T, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

async function main() {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required.')
  }
  const db = qdrant()
  // Scroll the append-only chat_logs collection (payload only — no vectors).
  const rows: LogRow[] = []
  let offset: string | number | undefined | null = undefined
  while (rows.length < 5000) {
    const res = await db.scroll(config.qdrantLogsCollection, {
      limit: 256,
      with_payload: true,
      with_vector: false,
      offset: offset ?? undefined,
    })
    for (const p of res.points) rows.push((p.payload ?? {}) as unknown as LogRow)
    offset = res.next_page_offset as string | number | null
    if (!offset) break
  }
  // If the loop stopped because the 5000-row cap was hit while more pages remain,
  // the time range and totals below cover only the newest slice, not all history.
  const truncated = Boolean(offset)
  rows.sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''))

  // Only report on identified visitors. Pre-upgrade rows carry no visitor_id and
  // are excluded entirely — they can't be attributed to a person or a funnel.
  const identified = rows.filter((r) => r.visitor_id)

  if (identified.length === 0) {
    console.log('No chat logs with a visitor id yet.')
    return
  }

  // chat_logs holds two event types: 'open' (the widget panel was opened) and
  // 'question' (something was actually asked). Rows from before the `type` field
  // existed have none and are questions, so anything not explicitly 'open' counts
  // as a question.
  const openRows = identified.filter((r) => r.type === 'open')
  const questionRows = identified.filter((r) => r.type !== 'open')
  const distinct = (rs: LogRow[]) => new Set(rs.map((r) => r.visitor_id).filter(Boolean)).size

  const uniqueOpeners = distinct(openRows)
  const uniqueAskers = distinct(questionRows)
  const conversion =
    uniqueOpeners > 0 ? `${((uniqueAskers / uniqueOpeners) * 100).toFixed(0)}%` : '—'
  const perAsker = uniqueAskers > 0 ? (questionRows.length / uniqueAskers).toFixed(1) : '—'

  const fallbacks = questionRows.filter((r) => r.route === 'fallback').length
  const corrective = questionRows.filter((r) => (r.loops ?? 0) > 0).length
  const latencies = questionRows.map((r) => r.latency_ms).filter((x): x is number => x != null)
  const qCount = questionRows.length || 1 // avoid /0 in the percentages below

  // Time window the numbers cover — without it a reader can't tell whether
  // "272 questions" spans a day or a year. Rates normalize counts to per-day.
  const times = identified
    .map((r) => Date.parse(r.ts ?? ''))
    .filter((t) => !Number.isNaN(t))
  const hasTimes = times.length > 0
  const earliest = hasTimes ? Math.min(...times) : 0
  const latest = hasTimes ? Math.max(...times) : 0
  const spanDays = hasTimes ? (latest - earliest) / 86_400_000 : 0
  // Floor the denominator at one day so a same-day report reports the raw count
  // as its rate instead of extrapolating wildly from a few hours of traffic.
  const perDay = (n: number) => (n / Math.max(spanDays, 1)).toFixed(1)
  const spanLabel = spanDays < 1 ? 'under 1 day' : `${Math.round(spanDays)}-day span`

  // How each question was answered. `route` now carries the graph's true terminal
  // outcome (canned | faq | generate | blocked | fallback). The richer
  // canned/faq/blocked labels only appear on rows logged after that fix; older
  // rows only ever say 'generate' or 'fallback', and their 'fallback' over-counts
  // (canned/FAQ answers, which carry no sources, were mislabeled as fallback).
  const newSchema = questionRows.some((r) => r.route === 'canned' || r.route === 'faq' || r.route === 'blocked')

  const pct = (n: number, base = qCount, digits = 1) => `${((n / base) * 100).toFixed(digits)}%`

  console.log(`# Chat Insights · ${questionRows.length} questions · ${openRows.length} opens · ${spanLabel}\n`)

  // When the numbers were taken from, and how wide a window they cover.
  if (hasTimes) {
    console.log(`Range      ${fmtWhen(earliest)} → ${fmtWhen(latest)}  (${TIME_ZONE})`)
    console.log(`Span       ${spanDays.toFixed(1)} days  ·  ${identified.length} identified events`)
  } else {
    console.log(`Range      no parseable timestamps  ·  ${identified.length} identified events`)
  }
  console.log(`Generated  ${fmtWhen(Date.now())}`)
  if (truncated) {
    console.log('Note       hit the 5000-row scan cap; range and totals cover only the newest slice')
  }
  console.log()

  console.log('## People (the funnel)')
  console.log(`  ${padR('Opened chat', LABEL_WIDTH)}${padL(openRows.length, 5)}   ·  ${padL(uniqueOpeners, 3)} unique  ·  ${padL(perDay(openRows.length), 5)} / day`)
  console.log(`  ${padR('Asked a question', LABEL_WIDTH)}${padL(questionRows.length, 5)}   ·  ${padL(uniqueAskers, 3)} unique  ·  ${padL(perDay(questionRows.length), 5)} / day`)
  console.log(`  ${padR('Open → ask', LABEL_WIDTH)}${padL(conversion, 5)}   (unique visitors)`)
  console.log(`  ${padR('Questions / asker', LABEL_WIDTH)}${padL(perAsker, 5)}`)
  console.log()

  console.log('## How questions were answered')
  for (const [outcome, n] of topN(tally(questionRows, (r) => r.route), 6)) {
    console.log(`  ${padR(outcome, LABEL_WIDTH)}${padL(n, 5)}   ${padL(pct(n), 6)}`)
  }
  if (!newSchema) {
    console.log('  (legacy logs: only generate/fallback recorded, fallback over-counts; re-check after new traffic lands)')
  }
  console.log()

  console.log('## Coverage')
  console.log(`  ${padR('Fallback (no answer)', LABEL_WIDTH)}${padL(fallbacks, 5)}   ${padL(pct(fallbacks), 6)}`)
  console.log(`  ${padR('Corrective rewrite', LABEL_WIDTH)}${padL(corrective, 5)}   ${padL(pct(corrective), 6)}`)
  console.log(`  ${padR('Median latency', LABEL_WIDTH)}${padL(`${median(latencies)} ms`, 8)}`)
  console.log()

  console.log('## Language split')
  for (const [lang, n] of topN(tally(questionRows, (r) => r.language), 5)) {
    console.log(`  ${padR(lang, LABEL_WIDTH)}${padL(n, 5)}   ${padL(pct(n, qCount, 0), 5)}`)
  }

  console.log('\n## Most-asked questions')
  for (const [q, n] of topN(tally(questionRows, (r) => r.question?.trim().toLowerCase() ?? null), 15)) {
    console.log(`  ${padL(n, 3)}×  ${q}`)
  }

  console.log('\n## Questions that hit fallback (corpus gaps to consider filling)')
  const gaps = questionRows.filter((r) => r.route === 'fallback' && r.question)
  const gapRows = topN(tally(gaps, (r) => r.question?.trim().toLowerCase() ?? null), 10)
  if (gapRows.length === 0) {
    console.log('  (none; every asked question got an answer)')
  } else {
    for (const [q, n] of gapRows) console.log(`  ${padL(n, 3)}×  ${q}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
