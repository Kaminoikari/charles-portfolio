// Reconstruct the templated (non-LLM) answers the bot gave to historical
// questions, into an HTML comparison table. chat_logs never stored the answer
// text (only the question + metadata), but four of the five terminal routes are
// deterministic templates we can faithfully replay from the question + language:
//
//   canned   — triage() regex tier: greeting/contact canned reply, personal
//              redirect, or injection refusal (all logged as route 'canned')
//   faq      — semantic FAQ-cache hit (re-embed the question + faqLookup)
//   fallback — genericFallback() "not enough info" reply
//   blocked  — fixed output-guardrail refusal (trusted from the stored route;
//              it depends on the generated output, so it can't be re-derived
//              from the question alone)
//
// generate rows (a real LLM answer, marked by non-empty sources) are the one
// route we cannot recover — that text was streamed to the visitor and never
// stored. They are listed with the answer column marked unrecoverable.
//
// Caveat: triage rules and faq_cache contents evolve, so this is a faithful-as-
// possible replay against TODAY's logic, not a byte-perfect record of what the
// visitor saw at the time.
//
//   tsx rag/insights/reconstruct-templated-qa.ts --out <dir>
//
// Needs QDRANT_URL, QDRANT_API_KEY and VOYAGE_API_KEY (the faq step re-embeds).

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { config } from '../config.js'
import { qdrant, faqLookup } from '../qdrant.js'
import { embedOne } from '../embeddings.js'
import { triage, genericFallback } from '../triage.js'
import type { Locale } from '../language.js'

const TIME_ZONE = 'Asia/Taipei'

interface LogRow {
  type: 'open' | 'question' | null
  question: string | null
  language: string | null
  route: string | null
  sources: unknown
  visitor_id: string | null
  ts: string
}

// One reconstructed conversation turn.
interface Turn {
  ts: string
  clock: string
  day: string
  language: string
  visitor: string
  question: string
  route: 'canned' | 'faq' | 'fallback' | 'blocked' | 'generate'
  kind: string // extra label for canned (injection/personal/canned) or ''
  answer: string | null // null = unrecoverable (generate)
}

function toLocale(lang: string | null): Locale {
  return lang === 'zh-TW' || lang === 'ja' ? lang : 'en'
}

// The fixed output-guardrail refusal, mirrored from rag/nodes.ts (blocked path).
// Kept in sync by hand; it is a constant on the live path.
function blockedMessage(locale: Locale): string {
  if (locale === 'zh-TW')
    return '我只能回答關於 Charles 工作與背景的問題,這個我沒辦法幫忙。歡迎問我他的專案、經歷或他如何運用 AI。'
  if (locale === 'ja')
    return 'Charles の仕事や経歴に関するご質問にのみお答えできます。プロジェクトや経歴、AI の活用についてどうぞ。'
  return "I can only help with questions about Charles's work and background. Ask me about his projects, experience, or how he uses AI."
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

// Semantic FAQ answers need the question re-embedded, so they only reconstruct
// when an embedding key is present. Without one, faq rows (identified by the
// stored route) are surfaced with this note instead of a silent blank.
function faqPendingNote(locale: Locale): string {
  if (locale === 'zh-TW') return '（FAQ 快取命中；本機無 embedding key，需重新 embed 問題才能還原當時的確切答案）'
  if (locale === 'ja') return '（FAQ キャッシュのヒット。ローカルに embedding key が無いため、正確な回答の復元には再 embed が必要）'
  return '(FAQ-cache hit; needs an embedding key to re-embed the question and recover the exact answer)'
}

// Reconstruct the answer the visitor most likely saw for one question row.
async function reconstruct(
  row: LogRow,
  hasEmbedKey: boolean,
): Promise<{ route: Turn['route']; kind: string; answer: string | null }> {
  const locale = toLocale(row.language)
  const q = (row.question ?? '').trim()

  // blocked can't be re-derived from the question (it hinges on the generated
  // output), so trust the stored label and replay the fixed refusal.
  if (row.route === 'blocked') return { route: 'blocked', kind: '', answer: blockedMessage(locale) }

  // A real generation is marked by retrieved sources — unrecoverable.
  if (Array.isArray(row.sources) && row.sources.length > 0)
    return { route: 'generate', kind: '', answer: null }

  // Tier 1: deterministic triage (injection / personal / canned FAQ).
  const t = triage(q, locale)
  if (t.kind !== 'pass') return { route: 'canned', kind: t.kind, answer: t.answer }

  // Tier 2: semantic FAQ cache — re-embed + lookup when a key is available.
  if (hasEmbedKey) {
    try {
      const hit = await faqLookup(await embedOne(q, 'query'), locale)
      if (hit) return { route: 'faq', kind: '', answer: hit.answer }
    } catch (err) {
      console.warn(`faq lookup failed for "${q.slice(0, 40)}":`, (err as Error).message)
    }
  } else if (row.route === 'faq') {
    // No key to replay the semantic match, but the stored route says it hit.
    return { route: 'faq', kind: '', answer: faqPendingNote(locale) }
  }

  // Everything else was a genuine miss → generic fallback.
  return { route: 'fallback', kind: '', answer: genericFallback(locale) }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ROUTE_COLOR: Record<Turn['route'], string> = {
  canned: '#00D9FF',
  faq: '#8B5CF6',
  fallback: '#E8652B',
  blocked: '#EF4444',
  generate: '#6B7280',
}

function renderHtml(turns: Turn[], stats: { total: number; counts: Record<string, number> }): string {
  const rows = turns
    .map((t) => {
      const routeLabel = t.kind ? `${t.route} · ${t.kind}` : t.route
      const answerCell =
        t.answer === null
          ? '<span style="color:#6B7280;font-style:italic">not stored (LLM answer, unrecoverable)</span>'
          : `<div style="white-space:pre-wrap">${esc(t.answer)}</div>`
      return `
      <tr>
        <td style="white-space:nowrap;color:#9CA3AF;font-family:ui-monospace,Menlo,monospace;font-size:12px">${t.day}<br>${t.clock}</td>
        <td style="color:#9CA3AF;font-size:12px">${esc(t.language || '—')}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-family:ui-monospace,Menlo,monospace;color:${ROUTE_COLOR[t.route]};border:1px solid ${ROUTE_COLOR[t.route]}40;white-space:nowrap">${esc(routeLabel)}</span></td>
        <td style="min-width:220px"><div style="white-space:pre-wrap;color:#F3F4F6">${esc(t.question)}</div></td>
        <td style="min-width:320px;color:#D1D5DB;font-size:13px;line-height:1.5">${answerCell}</td>
      </tr>`
    })
    .join('')

  const summary = ['canned', 'faq', 'fallback', 'blocked', 'generate']
    .map(
      (k) =>
        `<span style="color:${ROUTE_COLOR[k as Turn['route']]};margin-right:16px">${k}: <b>${stats.counts[k] ?? 0}</b></span>`,
    )
    .join('')

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Chat Q&A · reconstructed templated answers</title></head>
<body style="margin:0;background:#0A0A0B;color:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif;padding:28px">
  <h1 style="font-size:20px;margin:0 0 6px">Chat 對話紀錄 — 反推的模板類答案</h1>
  <p style="color:#9CA3AF;font-size:13px;margin:0 0 4px">
    ${stats.total} 筆提問。canned / faq / fallback / blocked 為 deterministic 反推（faithful replay，非當下逐字存檔）；
    generate 為 LLM 即時生成，未儲存、無法還原。
  </p>
  <p style="font-size:13px;margin:0 0 18px">${summary}</p>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <thead>
      <tr style="text-align:left;color:#9CA3AF;font-size:11px;text-transform:uppercase;letter-spacing:.5px">
        <th style="padding:8px;border-bottom:1px solid #262626">時間</th>
        <th style="padding:8px;border-bottom:1px solid #262626">語言</th>
        <th style="padding:8px;border-bottom:1px solid #262626">路由</th>
        <th style="padding:8px;border-bottom:1px solid #262626">問題</th>
        <th style="padding:8px;border-bottom:1px solid #262626">反推的答案</th>
      </tr>
    </thead>
    <tbody style="vertical-align:top">${rows}
    </tbody>
  </table>
</body></html>`
}

async function main() {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY)
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required.')
  // The faq tier re-embeds; without a key it degrades to a note on faq rows
  // rather than failing the whole export (canned/fallback/blocked need no key).
  const hasEmbedKey = Boolean(process.env.VOYAGE_API_KEY || process.env.EMBEDDING_API_KEY)
  if (!hasEmbedKey)
    console.warn('No VOYAGE_API_KEY/EMBEDDING_API_KEY — faq answers will be noted as needing re-embed.\n')

  const outArg = process.argv.indexOf('--out')
  const outDir = outArg >= 0 ? process.argv[outArg + 1] : '.'

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

  const questionRows = rows
    .filter((r) => r.type !== 'open' && r.question && !Number.isNaN(Date.parse(r.ts ?? '')))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))

  const turns: Turn[] = []
  const counts: Record<string, number> = {}
  for (const r of questionRows) {
    const { route, kind, answer } = await reconstruct(r, hasEmbedKey)
    counts[route] = (counts[route] ?? 0) + 1
    const ms = Date.parse(r.ts)
    turns.push({
      ts: r.ts,
      clock: clockFmt.format(new Date(ms)),
      day: dayFmt.format(new Date(ms)),
      language: r.language ?? '',
      visitor: r.visitor_id ? r.visitor_id.slice(0, 8) : 'legacy',
      question: String(r.question ?? '').trim(),
      route,
      kind,
      answer,
    })
  }

  const html = renderHtml(turns, { total: questionRows.length, counts })
  const outPath = join(outDir, 'chat-qa-reconstructed.html')
  writeFileSync(outPath, html, 'utf8')

  console.log(`\n${questionRows.length} question rows`)
  for (const k of ['canned', 'faq', 'fallback', 'blocked', 'generate'])
    console.log(`  ${k}: ${counts[k] ?? 0}`)
  const recoverable = questionRows.length - (counts.generate ?? 0)
  console.log(`\nReconstructed answers: ${recoverable} · unrecoverable (generate): ${counts.generate ?? 0}`)
  console.log(`→ ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
