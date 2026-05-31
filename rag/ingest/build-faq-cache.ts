// Builds the semantic FAQ cache: embeds every pre-written question paraphrase
// (rag/faq-cache.ts) and upserts it into the `faq_cache` Qdrant collection, one
// point per (entry × locale × paraphrase). At query time triage embeds the
// visitor's question and matches against these (see qdrant.ts faqLookup).
//
// Run via the RAG Ingest workflow or locally (needs VOYAGE_API_KEY + QDRANT_*):
//   npx tsx rag/ingest/build-faq-cache.ts
//   npx tsx rag/ingest/build-faq-cache.ts --dry-run   # count only, no writes
//
// Re-run after editing faq-cache.ts. Idempotent: point ids are deterministic
// (UUIDv5 of entry/locale/index), so edits upsert in place.

import { config } from '../config.js'
import { embed } from '../embeddings.js'
import { qdrant, ensureCollections, toPointId, DENSE } from '../qdrant.js'
import { faqEntries, type Locale } from '../faq-cache.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 32
const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']

interface Row {
  id: string // deterministic point id
  text: string // the paraphrase to embed
  faqId: string
  locale: Locale
  answer: string
}

function flatten(): Row[] {
  const rows: Row[] = []
  for (const entry of faqEntries) {
    for (const locale of LOCALES) {
      const answer = entry.answers[locale]
      entry.questions[locale].forEach((q, i) => {
        rows.push({
          id: toPointId(`faq:${entry.id}:${locale}:${i}`),
          text: q,
          faqId: entry.id,
          locale,
          answer,
        })
      })
    }
  }
  return rows
}

async function main() {
  const rows = flatten()
  console.log(
    `FAQ cache: ${faqEntries.length} entries → ${rows.length} question paraphrases ` +
      `(${LOCALES.map((l) => `${l}=${rows.filter((r) => r.locale === l).length}`).join(' ')})`,
  )

  if (DRY_RUN) {
    console.log('\n[dry-run] no embeddings computed, no points written.')
    return
  }

  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required (omit them with --dry-run)')
  }
  const db = qdrant()
  console.log('Ensuring Qdrant collections …')
  await ensureCollections()

  console.log(`\nEmbedding ${rows.length} paraphrases with ${config.embedModel} (batch ${BATCH}) …`)
  type Point = { id: string; vector: { [DENSE]: number[] }; payload: Record<string, unknown> }
  const points: Point[] = []
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const vectors = await embed(batch.map((r) => r.text), 'query')
    batch.forEach((r, j) => {
      points.push({
        id: r.id,
        vector: { [DENSE]: vectors[j] },
        payload: { faq_id: r.faqId, locale: r.locale, question: r.text, answer: r.answer },
      })
    })
    process.stdout.write(`\r  embedded ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }
  console.log('')

  console.log(`Upserting into ${config.qdrantFaqCollection} …`)
  for (let i = 0; i < points.length; i += 64) {
    await db.upsert(config.qdrantFaqCollection, { points: points.slice(i, i + 64), wait: true })
  }
  console.log(`Done. ${points.length} FAQ points indexed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
