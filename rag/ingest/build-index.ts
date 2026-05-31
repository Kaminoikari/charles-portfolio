// Phase 0 index builder: extract corpus → embed dense with voyage-3-large →
// upsert into Qdrant, where Cloud Inference computes the SPLADE++ sparse vector
// server-side from each chunk's text. Run locally / in CI (needs
// EMBEDDING_API_KEY + QDRANT_URL + QDRANT_API_KEY):
//
//   npx tsx rag/ingest/build-index.ts            # build
//   npx tsx rag/ingest/build-index.ts --dry-run  # extract + report, no writes
//
// --dry-run mirrors the product-playbook discipline: see exactly what would be
// written (chunk counts per source_type / locale) before spending any tokens.

import { config } from '../config'
import { embed } from '../embeddings'
import { qdrant, ensureCollections, toPointId, DENSE, SPARSE } from '../qdrant'
import { extractAll, type ChunkRecord } from './extract'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 32 // embedding requests per call

function summarize(records: ChunkRecord[]): string {
  const byType = new Map<string, number>()
  const byLocale = new Map<string, number>()
  for (const r of records) {
    byType.set(r.sourceType, (byType.get(r.sourceType) ?? 0) + 1)
    byLocale.set(r.locale, (byLocale.get(r.locale) ?? 0) + 1)
  }
  const fmt = (m: Map<string, number>) =>
    [...m.entries()].map(([k, v]) => `${k}=${v}`).join(' ')
  return `  total=${records.length}\n  by type:   ${fmt(byType)}\n  by locale: ${fmt(byLocale)}`
}

async function main() {
  console.log('Extracting corpus from src/data/*.ts …')
  const records = await extractAll()
  console.log(summarize(records))

  if (DRY_RUN) {
    console.log('\n[dry-run] no embeddings computed, no rows written.')
    return
  }

  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required (omit them with --dry-run)')
  }
  const db = qdrant()
  console.log('Ensuring Qdrant collections …')
  await ensureCollections()

  console.log(`\nEmbedding ${records.length} chunks with ${config.embedModel} (batch ${BATCH}) …`)
  // A point's dense vector is the Voyage embedding; its sparse vector is raw
  // text + model, which Qdrant Cloud Inference turns into SPLADE++ weights on
  // upsert (so the sparse model never runs in our process).
  type Point = {
    id: string
    vector: { [DENSE]: number[]; [SPARSE]: { text: string; model: string } }
    payload: Record<string, unknown>
  }
  const points: Point[] = []
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    // 'document' side of Voyage's asymmetric encoding (queries use 'query').
    const vectors = await embed(batch.map((r) => r.content), 'document')
    batch.forEach((r, j) => {
      points.push({
        id: toPointId(r.id),
        vector: {
          [DENSE]: vectors[j],
          [SPARSE]: { text: r.content, model: config.sparseModel },
        },
        payload: {
          chunk_id: r.id,
          parent_id: r.parentId,
          source_type: r.sourceType,
          project_id: r.projectId,
          locale: r.locale,
          title: r.title,
          content: r.content,
        },
      })
    })
    process.stdout.write(`\r  embedded ${Math.min(i + BATCH, records.length)}/${records.length}`)
  }
  console.log('')

  console.log(`Upserting into ${config.qdrantCollection} …`)
  // Upsert in pages to stay under request-size limits.
  for (let i = 0; i < points.length; i += 64) {
    await db.upsert(config.qdrantCollection, { points: points.slice(i, i + 64), wait: true })
  }
  console.log(`Done. ${points.length} chunks indexed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
