// chat-logs insights — the HTML BI dashboard (the email's rich body). Renders a
// dark, email-safe report: KPI strip, a Recent-questions feed (the headline
// section), donut charts for answer-mix and language, a daily-activity trend,
// and top-question / corpus-gap lists.
//
// Donuts are rasterized to PNG (Gmail strips inline SVG and data: URIs), written
// next to the HTML and referenced by filename; send_email.py rewrites those
// references to inline CID attachments. All metrics come from collect.ts.
// Run:  npx tsx rag/insights/dashboard.ts --assets <dir> > report.html
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { gatherInsights, TIME_ZONE, type Insights, type Metric } from './collect.js'

// ── palette (dark cinematic, matching the site brand) ───────────────────────
const C = {
  page: '#0a0a0c',
  card: '#141419',
  cardHero: '#131318',
  line: '#23232b',
  lineHero: '#26262f',
  track: '#22222b',
  text: '#f2f2f5',
  soft: '#c6c6cf',
  muted: '#8b8b96',
  faint: '#6c6c76',
  mars: '#E8652B',
  cyan: '#00D9FF',
  blue: '#4f8cff',
  green: '#35c46a',
  violet: '#b57cff',
}
const ROUTE_COLOR: Record<string, string> = {
  faq: C.cyan,
  generate: C.blue,
  canned: C.muted,
  blocked: C.violet,
  fallback: C.mars,
}
const LANG_COLORS = [C.cyan, C.mars, C.blue, C.green, C.violet]
const FONT_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const FONT_MONO = "ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace"
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtWhen = (ms: number) => dateFmt.format(new Date(ms))
const esc = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const clamp = (n: number) => Math.max(0, Math.min(100, n))
const monthDay = (day: string) => {
  const [, m, d] = day.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${d}`
}

// ── donut rasterization ─────────────────────────────────────────────────────
interface Segment {
  count: number
  color: string
}

function donutSvg(segments: Segment[], big: string, small: string): string {
  const cx = 66
  const cy = 66
  const r = 52
  const sw = 15
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.count, 0) || 1
  let offset = 0
  const rings = segments
    .map((s) => {
      const len = (s.count / total) * circ
      const ring = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`
      offset += len
      return ring
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="132" viewBox="0 0 132 132">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.track}" stroke-width="${sw}"/>
    <g transform="rotate(-90 ${cx} ${cy})">${rings}</g>
    <text x="${cx}" y="${cy - 1}" text-anchor="middle" fill="${C.text}" font-family="Menlo,monospace" font-size="22" font-weight="600">${esc(big)}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="${C.muted}" font-family="Helvetica,Arial,sans-serif" font-size="9" letter-spacing="1">${esc(small)}</text>
  </svg>`
}

function donutImg(assetDir: string, name: string, segments: Segment[], big: string, small: string, alt: string): string {
  if (segments.length === 0) return ''
  const png = new Resvg(donutSvg(segments, big, small), {
    fitTo: { mode: 'width', value: 256 },
    background: C.card,
  })
    .render()
    .asPng()
  writeFileSync(join(assetDir, `${name}.png`), png)
  return `<img src="${name}.png" width="120" height="120" alt="${esc(alt)}" style="display:block;border:0;outline:none">`
}

// ── reusable fragments ──────────────────────────────────────────────────────
function sectionHeader(label: string, opts: { tick?: string; note?: string; rightNote?: string } = {}): string {
  const tick = opts.tick ?? C.cyan
  const title = `<span style="color:${tick}">▍</span> ${esc(label)}`
  if (opts.rightNote) {
    return `<tr><td style="padding:30px 22px 10px"><table role="presentation" width="100%"><tr>
      <td style="font-family:${FONT_SANS};font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.text}">${title}</td>
      <td align="right" style="font-family:${FONT_SANS};font-size:11px;color:${C.faint}">${esc(opts.rightNote)}</td>
    </tr></table></td></tr>`
  }
  const note = opts.note
    ? `<span style="font-family:${FONT_SANS};font-size:11px;color:${C.faint};font-weight:400;letter-spacing:0;text-transform:none">&nbsp; ${esc(opts.note)}</span>`
    : ''
  return `<tr><td style="padding:30px 22px 10px">
    <div style="font-family:${FONT_SANS};font-size:12px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.text}">${title}${note}</div>
  </td></tr>`
}

function card(inner: string, opts: { bg?: string; border?: string; pad?: string } = {}): string {
  const bg = opts.bg ?? C.card
  const border = opts.border ?? C.line
  const pad = opts.pad ?? '18px 18px'
  return `<tr><td style="padding:0 22px">
    <table role="presentation" width="100%" style="background:${bg};border:1px solid ${border};border-radius:12px">
      <tr><td style="padding:${pad}">${inner}</td></tr>
    </table>
  </td></tr>`
}

function kpiCard(value: string, unit: string, label: string, sub: string, accent: string): string {
  const unitHtml = unit ? `<span style="font-size:13px;color:${C.muted};font-weight:400"> ${esc(unit)}</span>` : ''
  return `<td class="kpi" width="25%" valign="top" style="padding:5px">
    <table role="presentation" width="100%" style="background:${C.card};border:1px solid ${C.line};border-radius:12px">
      <tr><td style="padding:15px 14px">
        <div style="font-family:${FONT_MONO};color:${accent};line-height:1"><span style="font-size:27px;font-weight:600">${esc(value)}</span>${unitHtml}</div>
        <div style="font-family:${FONT_SANS};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.muted};margin-top:9px">${esc(label)}</div>
        <div style="font-family:${FONT_SANS};font-size:12px;color:${C.faint};margin-top:3px">${esc(sub)}</div>
      </td></tr>
    </table>
  </td>`
}

// ── sections ────────────────────────────────────────────────────────────────
function header(ins: Insights): string {
  const range = ins.hasTimes
    ? `${fmtWhen(ins.earliestMs)} &nbsp;→&nbsp; ${fmtWhen(ins.latestMs)}`
    : 'no parseable timestamps'
  const spanLabel = ins.spanDays < 1 ? 'under 1 day' : `${Math.round(ins.spanDays)}-day span`
  const trunc = ins.truncated
    ? `<div style="font-family:${FONT_SANS};font-size:11px;color:${C.mars};margin-top:8px">⚠ hit the 5000-row scan cap; range and totals cover only the newest slice</div>`
    : ''
  return `<tr><td style="padding:26px 22px 4px">
    <div style="font-family:${FONT_SANS};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.muted}">Chatbot Analytics</div>
    <div style="font-family:${FONT_SANS};font-size:25px;font-weight:700;color:${C.text};margin-top:6px">Chat Insights</div>
    <div style="font-family:${FONT_MONO};font-size:12px;color:${C.soft};margin-top:9px">${range}</div>
    <div style="font-family:${FONT_MONO};font-size:11px;color:${C.faint};margin-top:4px">${esc(spanLabel)} &nbsp;·&nbsp; ${ins.identifiedCount} events &nbsp;·&nbsp; ${esc(ins.timeZone)}</div>
    ${trunc}
  </td></tr>`
}

function kpis(ins: Insights): string {
  const conv = ins.conversionPct == null ? '—' : ins.conversionPct.toFixed(0)
  const answered = 100 - ins.fallbackPct
  return `<tr><td style="padding:14px 17px 0"><table role="presentation" width="100%"><tr>
    ${kpiCard(String(ins.questions.total), '', 'Questions', `${ins.questions.perDay.toFixed(1)} / day`, C.cyan)}
    ${kpiCard(String(ins.questions.unique), '', 'Askers', `of ${ins.opens.unique} openers`, C.text)}
    ${kpiCard(conv, conv === '—' ? '' : '%', 'Open → ask', 'conversion', C.mars)}
    ${kpiCard(answered.toFixed(0), '%', 'Answered', `${ins.fallbacks} fell back`, C.green)}
  </tr></table></td></tr>`
}

// The complete chronological question log. Rendered as a compact
// one-line-per-question table (time · route-dot · text) so the full set — every
// question ever asked, newest first — stays readable without a wall of cards.
// Render the full stored answer for the email: strip markdown emphasis/code
// marks and turn [label](url) into just the label, but KEEP the full text and
// its line breaks (→ <br>) so the reader sees the complete reply, untruncated.
function answerHtml(md: string): string {
  const plain = md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`_#>]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
  return esc(plain).replace(/\n/g, '<br>')
}

function recentActivity(ins: Insights): string {
  if (ins.recent.length === 0) return ''
  const answered = ins.recent.filter((r) => r.answer).length
  const rows = ins.recent
    .map((r, i) => {
      const border = i === 0 ? '' : `border-top:1px solid ${C.line};`
      const dot = r.route ? `<span style="color:${ROUTE_COLOR[r.route] ?? C.blue}">●</span>&nbsp; ` : ''
      // Full bot reply beneath the question (only rows logged since answers were kept).
      const answer = r.answer
        ? `<div style="margin-top:4px;padding-left:14px;border-left:2px solid ${C.line};font-family:${FONT_SANS};font-size:12px;line-height:1.5;color:${C.muted}">${answerHtml(r.answer)}</div>`
        : ''
      return `<table role="presentation" width="100%" style="${border}"><tr>
        <td width="92" valign="top" style="padding:7px 0;font-family:${FONT_MONO};font-size:11px;color:${C.muted};white-space:nowrap">${esc(monthDay(r.day))} · ${esc(r.clock)}</td>
        <td valign="top" style="padding:7px 0 7px 12px;font-family:${FONT_SANS};font-size:13px;line-height:1.45;color:${C.soft}">${dot}${esc(truncate(r.text, 120))}${answer}</td>
      </tr></table>`
    })
    .join('')
  const note = answered > 0 ? `${ins.recent.length} · ${answered} with answers` : `${ins.recent.length} · newest first`
  return (
    sectionHeader('All questions', { rightNote: note }) +
    card(rows, { bg: C.cardHero, border: C.lineHero, pad: '4px 18px 6px' })
  )
}

function donutBlock(img: string, metrics: Metric[], colorOf: (m: Metric, i: number) => string): string {
  const legend = metrics
    .map(
      (m, i) =>
        `<div style="margin-bottom:9px;white-space:nowrap"><span style="color:${colorOf(m, i)}">●</span> <span style="font-family:${FONT_SANS};font-size:12px;color:${C.soft}">${esc(m.label)}</span> <span style="font-family:${FONT_MONO};font-size:11px;color:${C.muted}">&nbsp;${m.count} · ${m.pct.toFixed(0)}%</span></div>`,
    )
    .join('')
  return `<td class="donut" width="50%" valign="top" style="padding:4px 8px">
    <table role="presentation" width="100%"><tr>
      <td width="128" valign="middle">${img}</td>
      <td valign="middle" style="padding-left:10px;white-space:nowrap">${legend}</td>
    </tr></table>
  </td>`
}

function donutSection(assetDir: string, ins: Insights): string {
  const answerSegs = ins.routes.map((m) => ({ count: m.count, color: ROUTE_COLOR[m.label] ?? C.blue }))
  const langSegs = ins.languages.map((m, i) => ({ count: m.count, color: LANG_COLORS[i % LANG_COLORS.length] }))
  if (answerSegs.length === 0 && langSegs.length === 0) return ''
  const answerImg = donutImg(assetDir, 'donut-answer', answerSegs, String(ins.questions.total), 'ASKED', 'answer mix')
  const langImg = donutImg(assetDir, 'donut-language', langSegs, String(ins.languages.length), ins.languages.length === 1 ? 'LANG' : 'LANGS', 'language split')
  const inner = `<table role="presentation" width="100%"><tr>
    ${donutBlock(answerImg, ins.routes, (m) => ROUTE_COLOR[m.label] ?? C.blue)}
    ${donutBlock(langImg, ins.languages, (_m, i) => LANG_COLORS[i % LANG_COLORS.length])}
  </tr></table>`
  return sectionHeader('Answer mix & language') + card(inner, { pad: '18px 14px' })
}

function dailyTrend(ins: Insights): string {
  if (ins.daily.length === 0) return ''
  const maxTotal = Math.max(1, ...ins.daily.map((d) => d.questions + d.opens))
  const rows = ins.daily
    .map((d) => {
      const total = d.questions + d.opens
      const qW = Math.round((d.questions / maxTotal) * 100)
      const oW = Math.round((d.opens / maxTotal) * 100)
      const rest = clamp(100 - qW - oW)
      const label = `${d.day.slice(5)} ${d.weekday}`
      const qCell = qW > 0 ? `<td width="${qW}%" style="height:9px;background:${C.cyan};font-size:0;line-height:0">&nbsp;</td>` : ''
      const oCell = oW > 0 ? `<td width="${oW}%" style="height:9px;background:${C.blue}99;font-size:0;line-height:0">&nbsp;</td>` : ''
      const restCell = `<td width="${rest}%" style="height:9px;background:${C.track};font-size:0;line-height:0">&nbsp;</td>`
      return `<div style="margin-bottom:9px">
        <table role="presentation" width="100%"><tr>
          <td width="80" style="font-family:${FONT_MONO};font-size:11px;color:${C.muted};white-space:nowrap">${esc(label)}</td>
          <td style="padding-left:10px">
            <table role="presentation" width="100%" style="border-radius:3px;overflow:hidden"><tr>${qCell}${oCell}${restCell}</tr></table>
          </td>
          <td width="30" align="right" style="font-family:${FONT_MONO};font-size:12px;color:${C.soft}">${total}</td>
        </tr></table>
      </div>`
    })
    .join('')
  const legend = `<div style="margin-top:4px"><span style="color:${C.cyan}">■</span> <span style="font-family:${FONT_SANS};font-size:11px;color:${C.faint}">questions</span> &nbsp; <span style="color:${C.blue}">■</span> <span style="font-family:${FONT_SANS};font-size:11px;color:${C.faint}">opens</span></div>`
  return sectionHeader('Daily activity', { note: `${ins.daily.length} active days` }) + card(rows + legend, { pad: '16px 16px' })
}

function questionList(
  label: string,
  note: string,
  items: { text: string; count: number }[],
  badgeColor: string,
  opts: { tick?: string; bg?: string; border?: string; textColor?: string; emptyMsg?: string } = {},
): string {
  if (items.length === 0) {
    if (!opts.emptyMsg) return ''
    return sectionHeader(label, { tick: opts.tick, note }) + card(`<div style="font-family:${FONT_SANS};font-size:13px;color:${C.faint}">${esc(opts.emptyMsg)}</div>`)
  }
  const textColor = opts.textColor ?? C.soft
  const rows = items
    .map((q, i) => {
      const border = i === 0 ? '' : `border-top:1px solid ${opts.border ?? C.line};`
      return `<table role="presentation" width="100%" style="${border}"><tr>
        <td width="34" valign="top" style="padding:9px 0"><span style="font-family:${FONT_MONO};font-size:12px;font-weight:600;color:${badgeColor}">${q.count}×</span></td>
        <td valign="top" style="padding:9px 0;font-family:${FONT_SANS};font-size:13px;line-height:1.5;color:${textColor}">${esc(truncate(q.text, 140))}</td>
      </tr></table>`
    })
    .join('')
  return sectionHeader(label, { tick: opts.tick, note }) + card(rows, { bg: opts.bg, border: opts.border, pad: '6px 16px' })
}

function footer(ins: Insights): string {
  const speed = `Median latency ${ins.medianLatencyMs} ms · ${ins.corrective} corrective rewrite${ins.corrective === 1 ? '' : 's'}.`
  const legacy = ins.newSchema ? '' : ' Legacy logs: fallback over-counts; re-check after new traffic lands.'
  return `<tr><td style="padding:26px 22px 32px">
    <div style="border-top:1px solid ${C.line};padding-top:14px;font-family:${FONT_SANS};font-size:11px;line-height:1.6;color:${C.faint}">${speed} &nbsp; Source: Qdrant chat_logs, identified visitors only. Times in ${esc(ins.timeZone)}.${legacy}</div>
  </td></tr>`
}

// ── document ────────────────────────────────────────────────────────────────
function renderHtml(ins: Insights, assetDir: string): string {
  const spanLabel = ins.spanDays < 1 ? 'under 1 day' : `${Math.round(ins.spanDays)}-day span`
  const subject = `Chat Insights · ${ins.questions.total} questions · ${ins.opens.total} opens · ${spanLabel}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
<style>
  body{margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{-ms-interpolation-mode:bicubic;}
  @media (max-width:600px){
    .kpi{display:block !important;width:100% !important;padding:5px 0 !important;}
    .donut{display:block !important;width:100% !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page}">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${esc(subject)}</span>
  <table role="presentation" width="100%" style="background:${C.page}"><tr><td align="center" style="padding:10px 0 0">
    <table role="presentation" width="600" style="width:100%;max-width:600px;background:${C.page}">
      ${header(ins)}
      ${kpis(ins)}
      ${recentActivity(ins)}
      ${donutSection(assetDir, ins)}
      ${dailyTrend(ins)}
      ${questionList('Most-asked', 'by frequency', ins.topQuestions, C.cyan)}
      ${questionList('Corpus gaps', 'hit fallback', ins.gaps, C.mars, {
        tick: C.mars,
        bg: '#1a1310',
        border: '#E8652B33',
        textColor: '#e6d9d2',
        emptyMsg: 'None — every asked question got an answer.',
      })}
      ${footer(ins)}
    </table>
  </td></tr></table>
</body>
</html>`
}

function renderEmpty(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Chat Insights · no data</title></head>
<body style="margin:0;background:${C.page}">
  <div style="font-family:${FONT_SANS};color:${C.soft};padding:30px">No chat logs with a visitor id yet.</div>
</body></html>`
}

function resolveAssetDir(): string {
  const i = process.argv.indexOf('--assets')
  const dir = i >= 0 ? process.argv[i + 1] : process.env.INSIGHTS_ASSET_DIR || process.cwd()
  mkdirSync(dir, { recursive: true })
  return dir
}

async function main() {
  const assetDir = resolveAssetDir()
  const ins = await gatherInsights()
  console.log(ins ? renderHtml(ins, assetDir) : renderEmpty())
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
