// Incremental-ingest core: content-hash change detection + three-way
// reconciliation. Pure functions, no I/O — so the whole diff decision is unit
// testable with no secrets or network. This is the same technique LangChain's
// `index()` RecordManager and LlamaIndex's docstore `UPSERTS_AND_DELETE` strategy
// use, implemented natively against our Qdrant point ids.
//
// The idea: fingerprint every chunk's *inputs* (content, the models that will
// embed it, the parent-doc text that will contextualize it, the payload we
// store). The fingerprint is computable WITHOUT calling the embedding or context
// LLM, so on re-ingest we diff the desired corpus against what Qdrant already
// holds and only spend tokens on the chunks that actually changed.

import { createHash } from 'node:crypto'

// Bump when the hashing scheme itself changes (new field folded in, different
// digest) so one deploy re-ingests the whole corpus instead of treating stale
// hashes as current.
export const HASH_VERSION = 'v1'

// Deterministic JSON: keys sorted at every level, so a payload built with its
// keys in a different order still hashes identically. Object.keys order is
// insertion order in JS, and extract.ts builds payloads field-by-field — without
// canonicalising, a harmless refactor that reorders those fields would look like
// a content change and force a full rebuild.
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',')}}`
}

export interface HashInput {
  // The chunk's own text (pre-contextualisation).
  content: string
  // Full parent-document text when this chunk WILL be contextualised, '' when it
  // won't. Folding it in means editing the parent doc re-contextualises its
  // fragments (their situating context can legitimately change), while an
  // untouched doc leaves every fragment's hash — and its cached context — intact.
  contextSource: string
  // Model identifiers whose change must invalidate every affected point: swap the
  // embedding model / dimension / sparse model / context model and the stored
  // vectors are no longer what this corpus would produce.
  models: string[]
  // The metadata we persist to the payload (title, url, source_type, locale,
  // project_id, parent_id …), minus the volatile bookkeeping keys the reconciler
  // itself writes (the hash, the generated context). A displayed title changing
  // is a real change even when the body text didn't.
  payload: Record<string, unknown>
}

// The fingerprint stored on each point as `chunk_hash`. Two chunks with the same
// fingerprint produce byte-identical points, so an unchanged chunk is skipped
// entirely (no context LLM call, no embedding, no upsert) on re-ingest.
export function chunkHash(input: HashInput): string {
  const preimage = canonical({
    v: HASH_VERSION,
    content: input.content,
    contextSource: input.contextSource,
    models: input.models,
    payload: input.payload,
  })
  return createHash('sha256').update(preimage).digest('hex')
}

export interface DesiredChunk {
  chunkId: string
  hash: string
}

export interface ReconcilePlan {
  toBuild: string[] // new or hash-changed → (re)contextualise + embed + upsert
  unchanged: string[] // hash matches Qdrant → skip completely
  toDelete: string[] // in Qdrant but no longer produced by the corpus → delete
}

// Three-way diff between what Qdrant currently holds (chunk_id → stored hash) and
// what the corpus now wants (chunk_id → desired hash). `toDelete` is what fixes
// the upsert-only staleness of the old pipeline: a removed blog post or renamed
// chunk id leaves an orphan point that this pass reclaims.
export function reconcile(existing: Map<string, string>, desired: DesiredChunk[]): ReconcilePlan {
  const toBuild: string[] = []
  const unchanged: string[] = []
  const desiredIds = new Set<string>()

  for (const { chunkId, hash } of desired) {
    desiredIds.add(chunkId)
    if (existing.get(chunkId) === hash) unchanged.push(chunkId)
    else toBuild.push(chunkId)
  }

  const toDelete: string[] = []
  for (const id of existing.keys()) {
    if (!desiredIds.has(id)) toDelete.push(id)
  }

  return { toBuild, unchanged, toDelete }
}

// Safety valve for the delete pass. A normal content edit removes a handful of
// chunks; a MISCONFIGURED run presents hundreds of live points as "stale" — the
// dangerous example being re-ingesting with blog bodies disabled
// (RAG_BLOG_BODY=false) against the production collection, which would drop every
// body chunk. Refuse an oversized delete unless explicitly forced, so a flag
// mistake can never silently wipe the index. Returns true when it is safe to
// proceed automatically.
export function isPruneSafe(deleteCount: number, maxDelete: number): boolean {
  return deleteCount <= maxDelete
}
