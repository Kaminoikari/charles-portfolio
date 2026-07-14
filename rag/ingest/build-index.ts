// Incremental index builder: extract corpus → diff against Qdrant by content
// hash → embed ONLY the new/changed chunks with voyage-3-large → upsert (Qdrant
// Cloud Inference computes the BM25 sparse vector server-side from each chunk's
// text) → delete chunks the corpus no longer emits. Run locally / in CI (needs
// EMBEDDING_API_KEY + QDRANT_URL + QDRANT_API_KEY):
//
//   npx tsx rag/ingest/build-index.ts            # incremental build
//   npx tsx rag/ingest/build-index.ts --dry-run  # extract + diff report, no writes
//
// The old pipeline re-embedded and re-upserted the whole corpus on every run.
// Now a content-hash reconciler (rag/ingest/reconcile.ts) makes an unchanged
// chunk cost nothing: no embedding call, no upsert. Editing one blog post only
// reprocesses that post's chunks; a rerun with no content change writes zero
// points. It also deletes stale points — the upsert-only pipeline could never
// remove a chunk whose source was deleted.
//
// --dry-run reports the incremental plan (new / changed / unchanged / delete)
// when Qdrant creds are present, else just the desired corpus — so you see
// exactly what would change before spending any tokens.

import { config } from '../config.js'
import { embed } from '../embeddings.js'
import {
  qdrant,
  ensureCollections,
  toPointId,
  scrollHashes,
  deleteByChunkIds,
  DENSE,
  SPARSE,
} from '../qdrant.js'
import { extractAll, type ChunkRecord } from './extract.js'
import { chunkHash, reconcile, isPruneSafe, type DesiredChunk } from './reconcile.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 32 // embedding requests per call
const UPSERT_PAGE = 64 // points per upsert page (stay under request-size limits)

// Model identifiers folded into every chunk's hash so a model / dimension swap
// invalidates the whole corpus and forces a re-embed (see reconcile.ts).
const EMBED_MODELS = [config.embedModel, String(config.embedDim), config.sparseModel]

type Point = {
  id: string
  vector: { [DENSE]: number[]; [SPARSE]: { text: string; model: string } }
  payload: Record<string, unknown>
}

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

// The metadata subset we fold into the hash: the payload minus the volatile
// bookkeeping keys the writer adds (chunk_hash) and content (hashed separately).
// A displayed title / url changing is a real change even when the body didn't.
function hashPayload(r: ChunkRecord): Record<string, unknown> {
  return {
    parent_id: r.parentId,
    source_type: r.sourceType,
    project_id: r.projectId,
    locale: r.locale,
    title: r.title,
    ...(r.url ? { url: r.url } : {}),
  }
}

function desiredHash(r: ChunkRecord): string {
  return chunkHash({
    content: r.content,
    contextSource: '', // contextualisation lands in a later layer
    models: EMBED_MODELS,
    payload: hashPayload(r),
  })
}

function toPoint(r: ChunkRecord, vector: number[], hash: string): Point {
  return {
    id: toPointId(r.id),
    vector: {
      [DENSE]: vector,
      [SPARSE]: { text: r.content, model: config.sparseModel },
    },
    payload: {
      chunk_id: r.id,
      chunk_hash: hash,
      parent_id: r.parentId,
      source_type: r.sourceType,
      project_id: r.projectId,
      locale: r.locale,
      title: r.title,
      content: r.content,
      // Only blog chunks carry a url; omit the key entirely otherwise.
      ...(r.url ? { url: r.url } : {}),
    },
  }
}

async function main() {
  console.log('Extracting corpus from src/data/*.ts …')
  const records = await extractAll()
  console.log(summarize(records))

  const byId = new Map(records.map((r) => [r.id, r]))
  const hashById = new Map(records.map((r) => [r.id, desiredHash(r)]))
  const desired: DesiredChunk[] = records.map((r) => ({ chunkId: r.id, hash: hashById.get(r.id)! }))

  // The incremental diff needs to read Qdrant's current state. Always possible in
  // the live path; in a dry-run only when creds are present — otherwise fall back
  // to reporting the desired corpus (the old dry-run behaviour, still key-free).
  const canReachQdrant = Boolean(config.qdrantUrl && process.env.QDRANT_API_KEY)
  if (DRY_RUN && !canReachQdrant) {
    console.log(
      '\n[dry-run] no Qdrant creds — showing the desired corpus only. Run live (or with creds) for the incremental diff.',
    )
    return
  }
  if (!canReachQdrant) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required (omit them with --dry-run)')
  }

  const db = qdrant()
  console.log('Ensuring Qdrant collections …')
  await ensureCollections()

  console.log(`Reading existing point hashes from ${config.qdrantCollection} …`)
  const existing = await scrollHashes(config.qdrantCollection)
  const plan = reconcile(existing, desired)
  console.log(
    `Incremental plan vs ${existing.size} existing point(s): ` +
      `build=${plan.toBuild.length} (new/changed)  unchanged=${plan.unchanged.length}  delete=${plan.toDelete.length}`,
  )

  if (DRY_RUN) {
    console.log('\n[dry-run] no embeddings computed, no rows written or deleted.')
    return
  }

  const build = plan.toBuild.map((id) => byId.get(id)).filter((r): r is ChunkRecord => Boolean(r))
  if (build.length === 0) {
    console.log('Nothing to embed — corpus already current.')
  } else {
    console.log(`\nEmbedding ${build.length} new/changed chunk(s) with ${config.embedModel} (batch ${BATCH}) …`)
    // 'document' side of Voyage's asymmetric encoding (queries use 'query').
    const points: Point[] = []
    for (let i = 0; i < build.length; i += BATCH) {
      const batch = build.slice(i, i + BATCH)
      const vectors = await embed(batch.map((r) => r.content), 'document')
      batch.forEach((r, j) => points.push(toPoint(r, vectors[j], hashById.get(r.id)!)))
      process.stdout.write(`\r  embedded ${Math.min(i + BATCH, build.length)}/${build.length}`)
    }
    console.log('')

    console.log(`Upserting ${points.length} point(s) into ${config.qdrantCollection} …`)
    for (let i = 0; i < points.length; i += UPSERT_PAGE) {
      await db.upsert(config.qdrantCollection, { points: points.slice(i, i + UPSERT_PAGE), wait: true })
    }
  }

  let deleted = 0
  if (plan.toDelete.length > 0) {
    const force = process.env.RAG_PRUNE === '1'
    if (force || isPruneSafe(plan.toDelete.length, config.ingestPruneMax)) {
      console.log(`Deleting ${plan.toDelete.length} stale point(s) …`)
      await deleteByChunkIds(config.qdrantCollection, plan.toDelete)
      deleted = plan.toDelete.length
    } else {
      console.warn(
        `⚠ Refusing to delete ${plan.toDelete.length} point(s) (> RAG_PRUNE_MAX=${config.ingestPruneMax}). ` +
          `This looks like a misconfigured run (e.g. RAG_BLOG_BODY=0 against ${config.qdrantCollection}), ` +
          `not a content edit — skipping the delete pass. Set RAG_PRUNE=1 to force.`,
      )
    }
  }

  console.log(
    `Done. +${build.length} built, =${plan.unchanged.length} unchanged, -${deleted} deleted.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
