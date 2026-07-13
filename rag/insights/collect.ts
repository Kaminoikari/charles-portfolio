// Shared data layer for the chat-insights renderers. Scrolls chat_logs once and
// computes every metric the plain-text report and the HTML dashboard need, so
// both renderers stay pure presentation over a single source of truth.
import { config } from '../config.js'
import { qdrant } from '../qdrant.js'

export const TIME_ZONE = 'Asia/Taipei'

// The report shows only activity from this instant onward — a deliberate fresh
// start on 2026-07-13 12:00 (Asia/Taipei), once answers began being stored.
// Everything earlier stays in chat_logs; it is hidden from the report only.
const REPORT_EPOCH_MS = Date.parse('2026-07-13T12:00:00+08:00')

const withinEpoch = (ts: string | null | undefined): boolean => {
  const t = Date.parse(ts ?? '')
  return !Number.isNaN(t) && t >= REPORT_EPOCH_MS
}

interface LogRow {
  type: 'open' | 'question' | null
  question: string | null
  answer: string | null // stored since 2026-07-13; null on older rows
  language: string | null
  route: string | null
  loops: number | null
  latency_ms: number | null
  visitor_id: string | null
  country: string | null
  ts: string
}

export interface Metric {
  label: string
  count: number
  pct: number
}
export interface DayBucket {
  day: string // "2026-07-09"
  weekday: string // "Wed"
  questions: number
  opens: number
}
export interface RecentItem {
  clock: string // "14:32"
  day: string // "2026-07-09"
  visitor: string
  country: string
  language: string
  route: string
  text: string
  answer: string // stored bot reply, '' on rows logged before answers were kept
}
export interface QuestionTally {
  text: string
  count: number
}

export interface Insights {
  timeZone: string
  hasTimes: boolean
  earliestMs: number
  latestMs: number
  spanDays: number
  truncated: boolean
  identifiedCount: number
  opens: { total: number; unique: number; perDay: number }
  questions: { total: number; unique: number; perDay: number }
  conversionPct: number | null // unique askers / unique openers
  perAsker: number | null
  routes: Metric[]
  newSchema: boolean
  fallbacks: number
  fallbackPct: number
  corrective: number
  correctivePct: number
  medianLatencyMs: number
  languages: Metric[]
  topQuestions: QuestionTally[]
  gaps: QuestionTally[]
  daily: DayBucket[]
  recent: RecentItem[]
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const clockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})
const weekdayFmt = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' })

const dayKey = (ms: number) => dayFmt.format(new Date(ms))
const clock = (ms: number) => clockFmt.format(new Date(ms))
const weekday = (dateKey: string) => weekdayFmt.format(new Date(`${dateKey}T12:00:00+08:00`))
const shortVid = (v: string | null) => (v ? v.slice(0, 8) : 'anonymous')

// Group questions by normalized text but keep a real sample for display, so the
// dashboard shows the original casing instead of a lowercased key.
function tallyQuestions(rows: LogRow[]): QuestionTally[] {
  const m = new Map<string, QuestionTally>()
  for (const r of rows) {
    const raw = r.question?.trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    const seen = m.get(key)
    if (seen) seen.count += 1
    else m.set(key, { text: raw, count: 1 })
  }
  return [...m.values()].sort((a, b) => b.count - a.count)
}

function tallyMetric(
  rows: LogRow[],
  key: (r: LogRow) => string | null,
  base: number,
  n: number,
): Metric[] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count, pct: base > 0 ? (count / base) * 100 : 0 }))
}

export async function gatherInsights(): Promise<Insights | null> {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required.')
  }
  const db = qdrant()
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
  const truncated = Boolean(offset)

  // Only identified visitors from the report epoch onward. Pre-upgrade rows carry
  // no visitor_id, and anything before the epoch is a prior era we've reset past;
  // both stay in chat_logs but are excluded from the report.
  const identified = rows.filter((r) => r.visitor_id && withinEpoch(r.ts))
  if (identified.length === 0) return null

  const openRows = identified.filter((r) => r.type === 'open')
  const questionRows = identified.filter((r) => r.type !== 'open')
  const distinct = (rs: LogRow[]) => new Set(rs.map((r) => r.visitor_id).filter(Boolean)).size
  const uniqueOpeners = distinct(openRows)
  const uniqueAskers = distinct(questionRows)
  const qCount = questionRows.length || 1

  const times = identified.map((r) => Date.parse(r.ts ?? '')).filter((t) => !Number.isNaN(t))
  const hasTimes = times.length > 0
  const earliestMs = hasTimes ? Math.min(...times) : 0
  const latestMs = hasTimes ? Math.max(...times) : 0
  const spanDays = hasTimes ? (latestMs - earliestMs) / 86_400_000 : 0
  // Floor the denominator at one day so a same-day report shows the raw count as
  // its rate instead of extrapolating wildly from a few hours of traffic.
  const perDay = (n: number) => n / Math.max(spanDays, 1)

  const fallbacks = questionRows.filter((r) => r.route === 'fallback').length
  const corrective = questionRows.filter((r) => (r.loops ?? 0) > 0).length
  const latencies = questionRows.map((r) => r.latency_ms).filter((x): x is number => x != null)
  const newSchema = questionRows.some(
    (r) => r.route === 'canned' || r.route === 'faq' || r.route === 'blocked',
  )

  // country lives on 'open' events → join by visitor for question rows lacking it.
  const countryByVisitor = new Map<string, string>()
  for (const r of identified) {
    if (r.type === 'open' && r.visitor_id && r.country) countryByVisitor.set(r.visitor_id, r.country)
  }

  // Daily activity, oldest → newest, capped to the last 21 active days.
  const byDay = new Map<string, { questions: number; opens: number }>()
  for (const r of identified) {
    const t = Date.parse(r.ts ?? '')
    if (Number.isNaN(t)) continue
    const key = dayKey(t)
    const b = byDay.get(key) ?? { questions: 0, opens: 0 }
    if (r.type === 'open') b.opens += 1
    else b.questions += 1
    byDay.set(key, b)
  }
  const daily: DayBucket[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-21)
    .map(([day, v]) => ({ day, weekday: weekday(day), questions: v.questions, opens: v.opens }))

  // Full question activity, newest first — the complete chronological log.
  // Uncapped on purpose: the caller wants every asked question in time order,
  // and the dashboard renders it as a compact one-line-per-question list so the
  // full set stays readable without ballooning the email.
  const recent: RecentItem[] = questionRows
    .filter((r) => r.question && !Number.isNaN(Date.parse(r.ts ?? '')))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .map((r) => {
      const ms = Date.parse(r.ts)
      return {
        clock: clock(ms),
        day: dayKey(ms),
        visitor: shortVid(r.visitor_id),
        country: r.country ?? (r.visitor_id ? (countryByVisitor.get(r.visitor_id) ?? '') : ''),
        language: r.language ?? '',
        route: r.route ?? '',
        text: String(r.question ?? '').trim(),
        answer: String(r.answer ?? '').trim(),
      }
    })

  return {
    timeZone: TIME_ZONE,
    hasTimes,
    earliestMs,
    latestMs,
    spanDays,
    truncated,
    identifiedCount: identified.length,
    opens: { total: openRows.length, unique: uniqueOpeners, perDay: perDay(openRows.length) },
    questions: {
      total: questionRows.length,
      unique: uniqueAskers,
      perDay: perDay(questionRows.length),
    },
    conversionPct: uniqueOpeners > 0 ? (uniqueAskers / uniqueOpeners) * 100 : null,
    perAsker: uniqueAskers > 0 ? questionRows.length / uniqueAskers : null,
    routes: tallyMetric(questionRows, (r) => r.route, qCount, 6),
    newSchema,
    fallbacks,
    fallbackPct: (fallbacks / qCount) * 100,
    corrective,
    correctivePct: (corrective / qCount) * 100,
    medianLatencyMs: median(latencies),
    languages: tallyMetric(questionRows, (r) => r.language, qCount, 5),
    topQuestions: tallyQuestions(questionRows).slice(0, 15),
    gaps: tallyQuestions(questionRows.filter((r) => r.route === 'fallback')).slice(0, 10),
    daily,
    recent,
  }
}
