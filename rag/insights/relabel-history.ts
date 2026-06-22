// One-off migration: re-label historical chat_logs question rows with the true
// answer outcome. Rows logged before the outcome fix recorded `route` as
// `sources.length > 0 ? 'generate' : 'fallback'`, which mislabeled every canned
// and FAQ-cache answer (both carry sources: []) as a fallback. There is no stored
// field that recovers the real path, so we reconstruct it by re-running the same
// triage logic the bot used:
//
//   sources non-empty            -> generate   (was already correct)
//   triage regex hits            -> canned     (greeting / contact / personal)
//   FAQ-cache lookup hits         -> faq
//   none of the above            -> fallback   (a genuine miss)
//
// Caveat: triage rules and the faq_cache contents have changed since these rows
// were written, so this is a faithful-as-possible reconstruction, not a perfect
// replay. The original value is preserved in `route_original` so the relabel is
// reversible.
//
// Dry-run (default):  npx tsx rag/insights/relabel-history.ts
// Apply the writes:   npx tsx rag/insights/relabel-history.ts --apply
// Needs QDRANT_* and VOYAGE_API_KEY (the FAQ step embeds each question).

import { config } from '../config.js'
import { qdrant } from '../qdrant.js'
import { faqLookup } from '../qdrant.js'
import { embedOne } from '../embeddings.js'
import { triage } from '../triage.js'
import type { Locale } from '../language.js'
import type { Outcome } from '../state.js'

interface LogPoint {
  id: string | number
  type: 'open' | 'question' | null
  question: string | null
  language: string | null
  route: string | null
  sources: unknown
}

const NEW_SCHEMA: Outcome[] = ['canned', 'faq', 'blocked']

function toLocale(lang: string | null): Locale {
  return lang === 'zh-TW' || lang === 'ja' ? lang : 'en'
}

// Reconstruct the true outcome for one historical question row.
async function reconstruct(row: LogPoint): Promise<Outcome> {
  if (Array.isArray(row.sources) && row.sources.length > 0) return 'generate'
  const locale = toLocale(row.language)
  const q = row.question ?? ''
  if (triage(q, locale).kind !== 'pass') return 'canned'
  try {
    const hit = await faqLookup(await embedOne(q, 'query'), locale)
    if (hit) return 'faq'
  } catch (err) {
    console.warn(`faq lookup failed for "${q.slice(0, 40)}":`, (err as Error).message)
  }
  return 'fallback'
}

async function main() {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required.')
  }
  if (!process.env.VOYAGE_API_KEY && !process.env.EMBEDDING_API_KEY) {
    throw new Error('VOYAGE_API_KEY (or EMBEDDING_API_KEY) is required for the FAQ re-check.')
  }
  const apply = process.argv.includes('--apply')
  const db = qdrant()

  // Pull the whole collection (id + payload).
  const rows: LogPoint[] = []
  let offset: string | number | undefined | null = undefined
  while (rows.length < 5000) {
    const res = await db.scroll(config.qdrantLogsCollection, {
      limit: 256,
      with_payload: true,
      with_vector: false,
      offset: offset ?? undefined,
    })
    for (const p of res.points) {
      const pl = (p.payload ?? {}) as Record<string, unknown>
      rows.push({
        id: p.id,
        type: (pl.type as LogPoint['type']) ?? null,
        question: (pl.question as string) ?? null,
        language: (pl.language as string) ?? null,
        route: (pl.route as string) ?? null,
        sources: pl.sources,
      })
    }
    offset = res.next_page_offset as string | number | null
    if (!offset) break
  }

  const questions = rows.filter((r) => r.type !== 'open')
  const counts = { canned: 0, faq: 0, generate: 0, blocked: 0, fallback: 0 } as Record<Outcome, number>
  let changed = 0
  let skipped = 0

  for (const row of questions) {
    // Already carries a post-fix label — leave it untouched.
    if (row.route && NEW_SCHEMA.includes(row.route as Outcome)) {
      skipped++
      continue
    }
    const outcome = await reconstruct(row)
    counts[outcome]++
    if (outcome === row.route) continue // no change needed
    changed++
    if (apply) {
      await db.setPayload(config.qdrantLogsCollection, {
        payload: { route: outcome, route_original: row.route, relabeled_at: new Date().toISOString() },
        points: [row.id],
      })
    }
  }

  console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'} — ${questions.length} question rows scanned, ${skipped} already up to date`)
  console.log('Reconstructed outcome distribution:')
  for (const k of ['canned', 'faq', 'generate', 'blocked', 'fallback'] as Outcome[]) {
    console.log(`  ${k}: ${counts[k]}`)
  }
  console.log(`Rows ${apply ? 'updated' : 'that would change'}: ${changed}`)
  if (!apply) console.log('\nRe-run with --apply to write these changes.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
