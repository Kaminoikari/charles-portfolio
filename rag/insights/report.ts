// chat-logs insights — the plain-text renderer (CLI + the email's text/plain
// fallback). All metrics come from collect.ts so this file is pure formatting.
// Run:  npx tsx rag/insights/report.ts  (needs QDRANT_*).
import { gatherInsights, TIME_ZONE } from './collect.js'

// Emitted as monospace text (and wrapped by the HTML dashboard's <pre> fallback),
// so space-padded columns line up. One label width keeps every block left-aligned.
const LABEL_WIDTH = 20
const padR = (s: string | number, n: number) => String(s).padEnd(n)
const padL = (s: string | number, n: number) => String(s).padStart(n)

const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtWhen = (ms: number) => dateFmt.format(new Date(ms))
const spanLabel = (days: number) => (days < 1 ? 'under 1 day' : `${Math.round(days)}-day span`)
const pct1 = (n: number) => `${n.toFixed(1)}%`
const pct0 = (n: number) => `${n.toFixed(0)}%`

async function main() {
  const ins = await gatherInsights()
  if (!ins) {
    console.log('No chat logs with a visitor id yet.')
    return
  }

  console.log(
    `# Chat Insights · ${ins.questions.total} questions · ${ins.opens.total} opens · ${spanLabel(ins.spanDays)}\n`,
  )

  if (ins.hasTimes) {
    console.log(`Range      ${fmtWhen(ins.earliestMs)} → ${fmtWhen(ins.latestMs)}  (${ins.timeZone})`)
    console.log(`Span       ${ins.spanDays.toFixed(1)} days  ·  ${ins.identifiedCount} identified events`)
  } else {
    console.log(`Range      no parseable timestamps  ·  ${ins.identifiedCount} identified events`)
  }
  console.log(`Generated  ${fmtWhen(Date.now())}`)
  if (ins.truncated) {
    console.log('Note       hit the 5000-row scan cap; range and totals cover only the newest slice')
  }
  console.log()

  console.log('## People (the funnel)')
  console.log(
    `  ${padR('Opened chat', LABEL_WIDTH)}${padL(ins.opens.total, 5)}   ·  ${padL(ins.opens.unique, 3)} unique  ·  ${padL(ins.opens.perDay.toFixed(1), 5)} / day`,
  )
  console.log(
    `  ${padR('Asked a question', LABEL_WIDTH)}${padL(ins.questions.total, 5)}   ·  ${padL(ins.questions.unique, 3)} unique  ·  ${padL(ins.questions.perDay.toFixed(1), 5)} / day`,
  )
  console.log(
    `  ${padR('Open → ask', LABEL_WIDTH)}${padL(ins.conversionPct == null ? '—' : pct0(ins.conversionPct), 5)}   (unique visitors)`,
  )
  console.log(
    `  ${padR('Questions / asker', LABEL_WIDTH)}${padL(ins.perAsker == null ? '—' : ins.perAsker.toFixed(1), 5)}`,
  )
  console.log()

  console.log('## How questions were answered')
  for (const m of ins.routes) {
    console.log(`  ${padR(m.label, LABEL_WIDTH)}${padL(m.count, 5)}   ${padL(pct1(m.pct), 6)}`)
  }
  if (!ins.newSchema) {
    console.log('  (legacy logs: only generate/fallback recorded, fallback over-counts; re-check after new traffic lands)')
  }
  console.log()

  console.log('## Coverage')
  console.log(`  ${padR('Fallback (no answer)', LABEL_WIDTH)}${padL(ins.fallbacks, 5)}   ${padL(pct1(ins.fallbackPct), 6)}`)
  console.log(`  ${padR('Corrective rewrite', LABEL_WIDTH)}${padL(ins.corrective, 5)}   ${padL(pct1(ins.correctivePct), 6)}`)
  console.log(`  ${padR('Median latency', LABEL_WIDTH)}${padL(`${ins.medianLatencyMs} ms`, 8)}`)
  console.log()

  console.log('## Language split')
  for (const m of ins.languages) {
    console.log(`  ${padR(m.label, LABEL_WIDTH)}${padL(m.count, 5)}   ${padL(pct0(m.pct), 5)}`)
  }

  console.log('\n## Most-asked questions')
  for (const q of ins.topQuestions) console.log(`  ${padL(q.count, 3)}×  ${q.text}`)

  console.log('\n## Questions that hit fallback (corpus gaps to consider filling)')
  if (ins.gaps.length === 0) {
    console.log('  (none; every asked question got an answer)')
  } else {
    for (const q of ins.gaps) console.log(`  ${padL(q.count, 3)}×  ${q.text}`)
  }

  console.log(`\n## All questions (newest first, ${ins.recent.length} total)`)
  for (const r of ins.recent) {
    console.log(`  ${r.day} ${r.clock}  ${r.text}`)
    // Full stored bot reply, indented, line breaks preserved (rows logged since
    // answers were kept). Not truncated — the whole reply is shown.
    if (r.answer) {
      const plain = r.answer.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`_#>]/g, '').replace(/[ \t]+/g, ' ').trim()
      const lines = plain.split('\n')
      console.log(`             ↳ ${lines[0]}`)
      for (const l of lines.slice(1)) console.log(`               ${l}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
