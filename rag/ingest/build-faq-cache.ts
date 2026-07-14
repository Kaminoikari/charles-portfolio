// Builds the semantic FAQ cache: embeds every pre-written question paraphrase
// (rag/faq-cache.ts) and upserts it into the `faq_cache` Qdrant collection, one
// point per (entry × locale × paraphrase). At query time triage embeds the
// visitor's question and matches against these (see qdrant.ts faqLookup).
//
// Run via the RAG Ingest workflow or locally (needs VOYAGE_API_KEY + QDRANT_*):
//   npx tsx rag/ingest/build-faq-cache.ts
//   npx tsx rag/ingest/build-faq-cache.ts --dry-run   # count / diff only, no writes
//
// Incremental (rag/ingest/reconcile.ts): each point's payload carries a
// chunk_hash over its paraphrase text AND its answer, so editing one FAQ answer
// re-embeds only that point — and, crucially, no longer leaves the deployed bot
// serving the stale cached answer (the old full-rebuild pipeline required a
// manual re-run to propagate an answer edit). Deleting an entry reclaims its
// points instead of orphaning them.

import { config } from '../config.js'
import { embed } from '../embeddings.js'
import {
  qdrant,
  ensureCollections,
  toPointId,
  scrollHashes,
  deleteByChunkIds,
  DENSE,
} from '../qdrant.js'
import { chunkHash, reconcile, isPruneSafe, type DesiredChunk } from './reconcile.js'
import { faqEntries, type Locale } from '../faq-cache.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 32
const UPSERT_PAGE = 64
const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']
const EMBED_MODELS = [config.embedModel, String(config.embedDim)]

interface Row {
  chunkId: string // logical id, stable across runs — the reconcile key
  pointId: string // deterministic Qdrant point id (UUIDv5 of chunkId)
  text: string // the paraphrase to embed
  faqId: string
  locale: Locale
  answer: string
  hash: string
}

function flatten(): Row[] {
  const rows: Row[] = []
  for (const entry of faqEntries) {
    for (const locale of LOCALES) {
      const answer = entry.answers[locale]
      entry.questions[locale].forEach((q, i) => {
        const chunkId = `faq:${entry.id}:${locale}:${i}`
        rows.push({
          chunkId,
          pointId: toPointId(chunkId),
          text: q,
          faqId: entry.id,
          locale,
          answer,
          // The answer is part of the stored state, so fold it in: an answer edit
          // must re-upsert the point even though the embedded question is the same.
          hash: chunkHash({
            content: q,
            contextSource: '',
            models: EMBED_MODELS,
            payload: { faq_id: entry.id, locale, answer },
          }),
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

  const canReachQdrant = Boolean(config.qdrantUrl && process.env.QDRANT_API_KEY)
  if (DRY_RUN && !canReachQdrant) {
    console.log('\n[dry-run] no Qdrant creds — showing the desired FAQ set only.')
    return
  }
  if (!canReachQdrant) {
    throw new Error('QDRANT_URL and QDRANT_API_KEY are required (omit them with --dry-run)')
  }

  const db = qdrant()
  console.log('Ensuring Qdrant collections …')
  await ensureCollections()

  console.log(`Reading existing point hashes from ${config.qdrantFaqCollection} …`)
  const existing = await scrollHashes(config.qdrantFaqCollection)
  const byId = new Map(rows.map((r) => [r.chunkId, r]))
  const desired: DesiredChunk[] = rows.map((r) => ({ chunkId: r.chunkId, hash: r.hash }))
  const plan = reconcile(existing, desired)
  console.log(
    `Incremental plan vs ${existing.size} existing point(s): ` +
      `build=${plan.toBuild.length} (new/changed)  unchanged=${plan.unchanged.length}  delete=${plan.toDelete.length}`,
  )

  if (DRY_RUN) {
    console.log('\n[dry-run] no embeddings computed, no points written or deleted.')
    return
  }

  const build = plan.toBuild.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r))
  type Point = { id: string; vector: { [DENSE]: number[] }; payload: Record<string, unknown> }
  if (build.length === 0) {
    console.log('Nothing to embed — FAQ cache already current.')
  } else {
    console.log(`\nEmbedding ${build.length} new/changed paraphrase(s) with ${config.embedModel} (batch ${BATCH}) …`)
    const points: Point[] = []
    for (let i = 0; i < build.length; i += BATCH) {
      const batch = build.slice(i, i + BATCH)
      const vectors = await embed(batch.map((r) => r.text), 'query')
      batch.forEach((r, j) => {
        points.push({
          id: r.pointId,
          vector: { [DENSE]: vectors[j] },
          payload: {
            chunk_id: r.chunkId,
            chunk_hash: r.hash,
            faq_id: r.faqId,
            locale: r.locale,
            question: r.text,
            answer: r.answer,
          },
        })
      })
      process.stdout.write(`\r  embedded ${Math.min(i + BATCH, build.length)}/${build.length}`)
    }
    console.log('')

    console.log(`Upserting ${points.length} point(s) into ${config.qdrantFaqCollection} …`)
    for (let i = 0; i < points.length; i += UPSERT_PAGE) {
      await db.upsert(config.qdrantFaqCollection, { points: points.slice(i, i + UPSERT_PAGE), wait: true })
    }
  }

  let deleted = 0
  if (plan.toDelete.length > 0) {
    const force = process.env.RAG_PRUNE === '1'
    if (force || isPruneSafe(plan.toDelete.length, config.ingestPruneMax)) {
      console.log(`Deleting ${plan.toDelete.length} stale point(s) …`)
      await deleteByChunkIds(config.qdrantFaqCollection, plan.toDelete)
      deleted = plan.toDelete.length
    } else {
      console.warn(
        `⚠ Refusing to delete ${plan.toDelete.length} point(s) (> RAG_PRUNE_MAX=${config.ingestPruneMax}); ` +
          `looks misconfigured, not a content edit — skipping. Set RAG_PRUNE=1 to force.`,
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
