// chat-logs insights — the "free product analytics" half of Phase 5. Every
// question hitting /api/chat is logged (see api/chat.ts → chat_logs). This
// script summarizes them: what recruiters actually ask, language split, how
// often the bot had to decline (fallback rate = a corpus-coverage signal), and
// latency. Run:  npx tsx rag/insights/report.ts  (needs SUPABASE_*).

import { createClient } from '@supabase/supabase-js'

import { config } from '../config'

interface LogRow {
  question: string | null
  language: string | null
  route: string | null
  loops: number | null
  latency_ms: number | null
  ts: string
}

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
  if (!config.supabaseUrl || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.')
  }
  const db = createClient(config.supabaseUrl, process.env.SUPABASE_SERVICE_KEY)
  const { data, error } = await db
    .from('chat_logs')
    .select('question, language, route, loops, latency_ms, ts')
    .order('ts', { ascending: false })
    .limit(5000)
  if (error) throw error
  const rows = (data ?? []) as LogRow[]

  if (rows.length === 0) {
    console.log('No chat logs yet.')
    return
  }

  const fallbacks = rows.filter((r) => r.route === 'fallback').length
  const corrective = rows.filter((r) => (r.loops ?? 0) > 0).length
  const latencies = rows.map((r) => r.latency_ms).filter((x): x is number => x != null)

  console.log(`# Chat Insights  (${rows.length} questions)\n`)

  console.log('## Coverage')
  console.log(`- Fallback (no answer found): ${fallbacks} (${((fallbacks / rows.length) * 100).toFixed(1)}%)`)
  console.log(`- Needed a corrective rewrite: ${corrective} (${((corrective / rows.length) * 100).toFixed(1)}%)`)
  console.log(`- Median latency: ${median(latencies)} ms\n`)

  console.log('## Language split')
  for (const [lang, n] of topN(tally(rows, (r) => r.language), 5)) {
    console.log(`- ${lang}: ${n} (${((n / rows.length) * 100).toFixed(0)}%)`)
  }

  console.log('\n## Most-asked questions')
  for (const [q, n] of topN(tally(rows, (r) => r.question?.trim().toLowerCase() ?? null), 15)) {
    console.log(`- ${n}× ${q}`)
  }

  console.log('\n## Questions that hit fallback (corpus gaps to consider filling)')
  const gaps = rows.filter((r) => r.route === 'fallback' && r.question)
  for (const [q, n] of topN(tally(gaps, (r) => r.question?.trim().toLowerCase() ?? null), 10)) {
    console.log(`- ${n}× ${q}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
