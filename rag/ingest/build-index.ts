// Incremental + contextual index builder:
//   extract corpus
//   → diff against Qdrant by content hash (only new/changed chunks cost tokens)
//   → for new/changed FRAGMENT chunks, generate an Anthropic-style situating
//     context (rag/ingest/contextualize.ts) and prepend it to the embed + BM25 text
//   → embed the changed chunks with voyage-3-large (Qdrant Cloud Inference builds
//     the sparse vector server-side)
//   → upsert, then delete chunks the corpus no longer emits.
//
//   npx tsx rag/ingest/build-index.ts            # incremental build
//   npx tsx rag/ingest/build-index.ts --dry-run  # extract + diff report, no writes
//
// Needs EMBEDDING_API_KEY + QDRANT_URL + QDRANT_API_KEY; ANTHROPIC_API_KEY too
// when RAG_CONTEXTUAL=1. The old pipeline re-embedded the whole corpus on every
// run — now a content-hash reconciler makes an unchanged chunk cost nothing, and
// stale points are reclaimed (the upsert-only pipeline could only ever add).
// Contextualisation is OFF by default until the golden-set ablation proves the
// lift (see rag/evals); flip it on with RAG_CONTEXTUAL=1.
//
// --dry-run reports the incremental plan (new / changed / unchanged / delete)
// when Qdrant creds are present, else just the desired corpus.

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
import { contextualize, type ContextItem } from './contextualize.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 32 // embedding requests per call
const UPSERT_PAGE = 64 // points per upsert page (stay under request-size limits)

// Model identifiers folded into every chunk's hash so a model / dimension swap
// invalidates the whole corpus and forces a re-embed (see reconcile.ts).
const EMBED_MODELS = [config.embedModel, String(config.embedDim), config.sparseModel]

// Only FRAGMENT chunks — a slice of a longer document that has lost its parent
// context — benefit from contextualisation. Self-contained chunks (about paras,
// experience, skills, changelog entries, agent-pattern children) are left as-is.
function needsContext(r: ChunkRecord): boolean {
  return config.contextualEnabled && r.parentId !== null && (r.sourceType === 'blog' || r.sourceType === 'project')
}

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

// parentId → the whole document text (parent chunk head + its children in order),
// which is the cacheable prefix fed to the context generator.
function buildParentDocs(records: ChunkRecord[]): Map<string, string> {
  const head = new Map<string, string>() // chunk id → its own content
  const parts = new Map<string, string[]>() // parentId → child contents, in order
  for (const r of records) {
    head.set(r.id, r.content)
    if (r.parentId) {
      const arr = parts.get(r.parentId) ?? []
      arr.push(r.content)
      parts.set(r.parentId, arr)
    }
  }
  const docs = new Map<string, string>()
  for (const [pid, childContents] of parts) {
    docs.set(pid, [head.get(pid) ?? '', ...childContents].join('\n\n'))
  }
  return docs
}

// The metadata subset folded into the hash: payload minus the volatile keys the
// writer adds (chunk_hash, context) and content (hashed via its own field). A
// displayed title / url changing is a real change even when the body didn't.
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

// Hash of the NON-contextual state — the fingerprint a chunk gets when it is
// stored raw (never contextualised, or context generation failed this run).
function rawHash(r: ChunkRecord): string {
  return chunkHash({ content: r.content, contextSource: '', models: EMBED_MODELS, payload: hashPayload(r) })
}

// Hash of the INTENDED state used for the reconcile diff: contextual when the
// chunk qualifies (so turning contextualisation on/off re-ingests exactly the
// fragment chunks), else identical to rawHash.
function desiredHash(r: ChunkRecord, parentDocs: Map<string, string>): string {
  if (!needsContext(r)) return rawHash(r)
  return chunkHash({
    content: r.content,
    contextSource: parentDocs.get(r.parentId!) ?? '',
    models: [...EMBED_MODELS, config.contextModel],
    payload: hashPayload(r),
  })
}

function toPoint(r: ChunkRecord, vector: number[], hash: string, embedText: string, context: string): Point {
  return {
    id: toPointId(r.id),
    vector: {
      [DENSE]: vector,
      // Sparse (BM25) sees the SAME context-prefixed text as the dense embedding
      // — Anthropic's "contextual BM25" half of the technique.
      [SPARSE]: { text: embedText, model: config.sparseModel },
    },
    payload: {
      chunk_id: r.id,
      chunk_hash: hash,
      parent_id: r.parentId,
      source_type: r.sourceType,
      project_id: r.projectId,
      locale: r.locale,
      title: r.title,
      content: r.content, // raw content stays for citation / display
      ...(context ? { context } : {}), // the generated situating context, for transparency
      ...(r.url ? { url: r.url } : {}),
    },
  }
}

async function main() {
  console.log('Extracting corpus from src/data/*.ts …')
  const records = await extractAll()
  console.log(summarize(records))

  const byId = new Map(records.map((r) => [r.id, r]))
  const parentDocs = buildParentDocs(records)
  const desired: DesiredChunk[] = records.map((r) => ({ chunkId: r.id, hash: desiredHash(r, parentDocs) }))

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
      `build=${plan.toBuild.length} (new/changed)  unchanged=${plan.unchanged.length}  delete=${plan.toDelete.length}` +
      (config.contextualEnabled ? '  [contextual ON]' : ''),
  )

  if (DRY_RUN) {
    console.log('\n[dry-run] no embeddings computed, no rows written or deleted.')
    return
  }

  const build = plan.toBuild.map((id) => byId.get(id)).filter((r): r is ChunkRecord => Boolean(r))
  if (build.length === 0) {
    console.log('Nothing to embed — corpus already current.')
  } else {
    // Generate situating context for the changed FRAGMENT chunks only.
    const ctxItems: ContextItem[] = build
      .filter(needsContext)
      .map((r) => ({ key: r.id, parentId: r.parentId!, parentDoc: parentDocs.get(r.parentId!) ?? '', chunk: r.content }))
    let contexts = new Map<string, string>()
    if (ctxItems.length > 0) {
      console.log(`Generating context for ${ctxItems.length} fragment chunk(s) with ${config.contextModel} …`)
      contexts = await contextualize(ctxItems)
    }

    // Assemble each chunk's embed text + the hash that reflects what we ACTUALLY
    // store: contextual hash when context succeeded, raw hash otherwise — so a
    // failed contextualisation self-heals (its raw hash won't match the desired
    // contextual hash, so next run retries it).
    const prepared = build.map((r) => {
      const context = needsContext(r) ? (contexts.get(r.id) ?? '') : ''
      const embedText = context ? `${context}\n\n${r.content}` : r.content
      const hash = context ? desiredHash(r, parentDocs) : rawHash(r)
      return { r, context, embedText, hash }
    })

    console.log(`\nEmbedding ${prepared.length} new/changed chunk(s) with ${config.embedModel} (batch ${BATCH}) …`)
    const points: Point[] = []
    for (let i = 0; i < prepared.length; i += BATCH) {
      const batch = prepared.slice(i, i + BATCH)
      // 'document' side of Voyage's asymmetric encoding (queries use 'query').
      const vectors = await embed(batch.map((p) => p.embedText), 'document')
      batch.forEach((p, j) => points.push(toPoint(p.r, vectors[j], p.hash, p.embedText, p.context)))
      process.stdout.write(`\r  embedded ${Math.min(i + BATCH, prepared.length)}/${prepared.length}`)
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
