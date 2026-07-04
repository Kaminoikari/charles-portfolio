// Per-day chat-log breakdown — the "who asked what, on which day" view that the
// aggregate report.ts can't show. Scrolls the same chat_logs collection and
// prints, for each day (Asia/Taipei): the opens, then each visitor grouped with
// the questions they asked (time · language · route · text).
//
// Data reality (see api/chat.ts + api/geo.ts):
//   - No IP is ever stored. Vercel only exposes a country header.
//   - country lives ONLY on 'open' events; we join it onto a visitor by id.
//   - visitor_id is null on pre-upgrade question logs → shown as "anonymous".
//
// Run:  npx tsx rag/insights/by-day.ts [--days N]   (needs QDRANT_*).

import { config } from '../config.js'
import { qdrant } from '../qdrant.js'

const TIME_ZONE = 'Asia/Taipei'

interface LogRow {
  type: 'open' | 'question' | null
  question: string | null
  language: string | null
  route: string | null
  visitor_id: string | null
  country: string | null
  ip: string | null
  blocked: boolean | null
  ts: string
}

// "2026-06-23" and "14:32" in Taipei time, from an ISO timestamp.
function dayKey(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts))
}

function clockTime(ts: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

function weekday(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'short' }).format(
    new Date(`${dateKey}T12:00:00+08:00`),
  )
}

function shortVid(vid: string | null): string {
  return vid ? vid.slice(0, 8) : 'anonymous'
}

async function scrollAll(): Promise<LogRow[]> {
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
  return rows
}

async function main() {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required.')
  }

  const daysArgIdx = process.argv.indexOf('--days')
  const daysLimit = daysArgIdx >= 0 ? Number(process.argv[daysArgIdx + 1]) : Infinity

  // Only identified visitors — rows with no visitor_id (pre-upgrade anonymous
  // logs) are dropped, so nothing shows up as "anonymous".
  const rows = (await scrollAll()).filter((r) => r.ts && r.visitor_id)
  if (rows.length === 0) {
    console.log('No chat logs with a visitor id yet.')
    return
  }

  // country lives only on 'open' events → build visitor_id → country lookup.
  const countryByVisitor = new Map<string, string>()
  for (const r of rows) {
    if (r.type === 'open' && r.visitor_id && r.country) countryByVisitor.set(r.visitor_id, r.country)
  }

  // Bucket every row by Taipei day.
  const byDay = new Map<string, LogRow[]>()
  for (const r of rows) {
    const key = dayKey(r.ts)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(r)
    else byDay.set(key, [r])
  }

  const sortedDays = [...byDay.keys()].sort((a, b) => b.localeCompare(a)).slice(0, daysLimit)

  console.log(`# Chat Log by Day  (${rows.length} events across ${byDay.size} days, ${TIME_ZONE})\n`)

  for (const day of sortedDays) {
    const dayRows = byDay.get(day) ?? []
    const opens = dayRows.filter((r) => r.type === 'open')
    const questions = dayRows.filter((r) => r.type !== 'open' && r.question)

    console.log(`## ${day} (${weekday(day)})  — ${questions.length} questions, ${opens.length} opens`)

    // Opens: who opened the panel and from where.
    for (const o of opens.sort((a, b) => a.ts.localeCompare(b.ts))) {
      const where = o.country ?? '?'
      const ip = o.ip ?? '?'
      const flags = o.blocked ? ' [blocked region]' : ''
      console.log(`- ${clockTime(o.ts)}  opened · ${shortVid(o.visitor_id)} · ${where} · ${ip}${flags}`)
    }

    // Questions grouped by visitor, each visitor's questions in time order.
    const visitors = new Map<string, LogRow[]>()
    for (const q of questions) {
      const id = q.visitor_id ?? '∅anonymous'
      const arr = visitors.get(id)
      if (arr) arr.push(q)
      else visitors.set(id, [q])
    }

    for (const [id, qs] of visitors) {
      const realId = id === '∅anonymous' ? null : id
      // Prefer a country recorded directly on the question (newer logs); fall back
      // to one joined from this visitor's open event; '?' if neither exists.
      const where =
        qs.find((q) => q.country)?.country ??
        (realId ? (countryByVisitor.get(realId) ?? '?') : '?')
      const ips = [...new Set(qs.map((q) => q.ip).filter(Boolean))]
      const ipLabel = ips.length ? ips.join(', ') : '?'
      console.log(
        `\n  ▸ ${shortVid(realId)} · ${where} · ${ipLabel} · ${qs.length} question${qs.length > 1 ? 's' : ''}`,
      )
      for (const q of qs.sort((a, b) => a.ts.localeCompare(b.ts))) {
        const meta = [q.language, q.route].filter(Boolean).join(' · ')
        console.log(`    ${clockTime(q.ts)}  [${meta}]  ${q.question}`)
      }
    }
    console.log()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
