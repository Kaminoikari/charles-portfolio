// "Has anyone asked anything since last time?" — the smallest useful read of
// chat_logs. The wrapper polls this every few minutes and only renders and
// emails the dashboard when the line it prints differs from the line it sent
// last, so a quiet poll costs one scroll and nothing else.
//
// The line must change only when real activity changes. Nothing derived from
// the wall clock may enter it: the dashboard's own range ends at "now" and so
// differs on every single run, which is exactly why the trigger cannot be a
// diff of the rendered report.
//
// Run:  npx tsx rag/insights/pulse.ts   (needs QDRANT_URL / QDRANT_API_KEY)
import { pathToFileURL } from 'node:url'

import { scrollReportableLogs } from './chat-logs.js'

export interface PulseRow {
  type: 'open' | 'question' | null
  visitor_id: string | null
  ts: string | null
}

export interface Pulse {
  questions: number
  latestMs: number | null
}

// A question is any row that is not an 'open' — the same rule collect.ts uses,
// because rows logged before the type field existed carry a null type and still
// represent a real question. Counting them differently here would let the
// trigger and the count in the email's own headline disagree.
export function summarizePulse(rows: PulseRow[]): Pulse {
  let questions = 0
  let latestMs: number | null = null
  for (const r of rows) {
    if (r.type === 'open') continue
    questions += 1
    const t = Date.parse(r.ts ?? '')
    if (!Number.isNaN(t) && (latestMs === null || t > latestMs)) latestMs = t
  }
  return { questions, latestMs }
}

export function formatPulse(p: Pulse): string {
  const latest = p.latestMs === null ? 'none' : new Date(p.latestMs).toISOString()
  return `questions=${p.questions} latest=${latest}`
}

async function main() {
  // The loader applies the report epoch and drops anonymous rows, so a reset
  // silences the poller the same way it silences the report.
  const { rows } = await scrollReportableLogs<PulseRow>()
  console.log(formatPulse(summarizePulse(rows)))
}

// Guarded so the test can import the pure helpers without opening a connection.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
