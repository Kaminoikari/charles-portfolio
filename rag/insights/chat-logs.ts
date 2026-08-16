// The one way to read chat_logs for a report.
//
// Two rules decide which rows a report may show, and both used to be re-stated at
// every call site: drop rows with no visitor_id (pre-upgrade anonymous logs), and
// drop anything older than the report epoch. A renderer that forgot either one
// would quietly resurrect a prior era, and nothing would fail — so the rules live
// here, applied by the loader, instead of in each renderer.

import { config } from '../config.js'
import { qdrant } from '../qdrant.js'

// Reports show only activity from this instant onward. Everything earlier stays
// in chat_logs untouched; it is hidden from reports, never deleted. Moving this
// line IS the reset — there is nothing else to clear.
//
// Reset history: 2026-07-13 12:00 (once answers began being stored) → 2026-07-30
// 00:00 (fresh start on the conversations that follow the id/eval cleanup) →
// 2026-08-15 00:00 (clear out everything logged up to the avatar-guide launch) →
// 2026-08-16 00:00 (drop the avatar-tuning day's own traffic).
export const REPORT_EPOCH_MS = Date.parse('2026-08-16T00:00:00+08:00')

export function withinReportWindow(ts: string | null | undefined): boolean {
  const t = Date.parse(ts ?? '')
  return !Number.isNaN(t) && t >= REPORT_EPOCH_MS
}

// The payload fields the two rules need. Renderers pass their own richer row type.
export interface ReportableRow {
  visitor_id: string | null
  ts: string | null
}

// `truncated` reports whether the scroll hit its ceiling with pages still
// pending, so a renderer can say the numbers are a floor rather than a total.
export async function scrollReportableLogs<T extends ReportableRow>(
  maxRows = 5000,
): Promise<{ rows: T[]; truncated: boolean }> {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required.')
  }

  const db = qdrant()
  const rows: T[] = []
  let offset: string | number | undefined | null = undefined
  while (rows.length < maxRows) {
    const res = await db.scroll(config.qdrantLogsCollection, {
      limit: 256,
      with_payload: true,
      with_vector: false,
      offset: offset ?? undefined,
    })
    for (const p of res.points) rows.push((p.payload ?? {}) as unknown as T)
    offset = res.next_page_offset as string | number | null
    if (!offset) break
  }

  return {
    rows: rows.filter((r) => r.visitor_id && withinReportWindow(r.ts)),
    truncated: Boolean(offset),
  }
}
