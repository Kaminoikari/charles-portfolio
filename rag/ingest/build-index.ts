// Phase 0 index builder: extract corpus → embed with BGE-M3 → upsert into
// Supabase pgvector. Run locally / in CI (needs EMBEDDING_API_KEY +
// SUPABASE_URL + SUPABASE_SERVICE_KEY):
//
//   npx tsx rag/ingest/build-index.ts            # build
//   npx tsx rag/ingest/build-index.ts --dry-run  # extract + report, no writes
//
// --dry-run mirrors the product-playbook discipline: see exactly what would be
// written (chunk counts per source_type / locale) before spending any tokens.

import { createClient } from '@supabase/supabase-js'

import { config } from '../config'
import { embed } from '../embeddings'
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

  if (!config.supabaseUrl || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required (omit them with --dry-run)')
  }
  const db = createClient(config.supabaseUrl, process.env.SUPABASE_SERVICE_KEY)

  console.log(`\nEmbedding ${records.length} chunks with ${config.embedModel} (batch ${BATCH}) …`)
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const vectors = await embed(batch.map((r) => r.content))
    batch.forEach((r, j) => {
      rows.push({
        id: r.id,
        parent_id: r.parentId,
        source_type: r.sourceType,
        project_id: r.projectId,
        locale: r.locale,
        title: r.title,
        content: r.content,
        embedding: vectors[j],
      })
    })
    process.stdout.write(`\r  embedded ${Math.min(i + BATCH, records.length)}/${records.length}`)
  }
  console.log('')

  console.log('Upserting into doc_chunks …')
  // Upsert in pages to stay under request-size limits.
  for (let i = 0; i < rows.length; i += 100) {
    const page = rows.slice(i, i + 100)
    const { error } = await db.from('doc_chunks').upsert(page, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`Done. ${rows.length} chunks indexed.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
