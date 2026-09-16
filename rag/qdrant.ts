// Qdrant client + collection bootstrap. Single place that knows how the vector
// store is shaped, so retrieval / ingest / logging / insights all agree.
//
// Hybrid layout per chunk: a named DENSE vector (Voyage voyage-3-large, cosine)
// and a named SPARSE vector (BM25 lexical, computed server-side by Qdrant Cloud
// Inference). Fusion (RRF) also happens server-side in the Query API — see
// retrieval.ts.

import { QdrantClient } from '@qdrant/js-client-rest'
import { createHash } from 'node:crypto'

import { config } from './config.js'

// Named-vector keys, referenced by every read/write path.
export const DENSE = 'dense'
export const SPARSE = 'sparse'

export function qdrant(): QdrantClient {
  return new QdrantClient({
    url: config.qdrantUrl,
    apiKey: process.env.QDRANT_API_KEY,
    // Cloud Inference + larger upserts can exceed the default check-compatibility
    // timeout; bump it modestly.
    timeout: 30_000,
    checkCompatibility: false,
  })
}

// Qdrant point IDs must be uint or UUID, but our chunk IDs are strings
// ("about-en-0"). Deterministically map string → UUIDv5 so re-ingesting the
// same chunk upserts in place. The original ID is preserved in the payload.
export function toPointId(stringId: string): string {
  const h = createHash('sha1').update(`charles-portfolio:${stringId}`).digest()
  const b = Buffer.from(h.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50 // version 5
  b[8] = (b[8] & 0x3f) | 0x80 // RFC-4122 variant
  const x = b.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

// Create the two collections if absent. Idempotent — safe to call on every
// ingest run. doc_chunks holds the hybrid index; chat_logs is an append-only
// analytics store (a size-1 dummy vector since it's only ever scrolled, never
// searched by similarity — keeps logging free of an extra embedding call).
export async function ensureCollections(): Promise<void> {
  const db = qdrant()

  if (!(await db.collectionExists(config.qdrantCollection)).exists) {
    await db.createCollection(config.qdrantCollection, {
      vectors: { [DENSE]: { size: config.embedDim, distance: 'Cosine' } },
      // BM25 needs server-side IDF → the 'idf' modifier (Cloud Inference emits
      // term frequencies; Qdrant applies IDF at query time). A learned-sparse
      // model like SPLADE++ would omit this.
      sparse_vectors: { [SPARSE]: { modifier: 'idf' } },
    })
    // Locale filter is applied on every query → index the payload key.
    await db.createPayloadIndex(config.qdrantCollection, {
      field_name: 'locale',
      field_schema: 'keyword',
    })
  }

  if (!(await db.collectionExists(config.qdrantLogsCollection)).exists) {
    await db.createCollection(config.qdrantLogsCollection, {
      vectors: { [DENSE]: { size: 1, distance: 'Cosine' } },
    })
  }

  // Semantic FAQ cache: one point per pre-written question paraphrase, carrying
  // both a dense vector and a BM25 sparse vector.
  //
  // It was dense-only until 2026-09-16, and that is a ranking bias, not a
  // saving: a sentence embedding scores the FRAME of a question, so
  // 「Charles 在 NUEIP 做什麼?」 landed on the general career summary's
  // 「Charles 是做什麼的」 ahead of the NUEIP entry's 「他在 NUEIP 做什麼」. The
  // proper noun that is the entire difference between those two questions is
  // what IDF weights and what a sentence embedding averages away. The sparse
  // arm is consulted as a veto rather than fused, so the cosine threshold and
  // the cross-entry margin keep meaning what they say (see faqLookup).
  if (!(await db.collectionExists(config.qdrantFaqCollection)).exists) {
    await db.createCollection(config.qdrantFaqCollection, {
      vectors: { [DENSE]: { size: config.embedDim, distance: 'Cosine' } },
      sparse_vectors: { [SPARSE]: { modifier: 'idf' } },
    })
    await db.createPayloadIndex(config.qdrantFaqCollection, {
      field_name: 'locale',
      field_schema: 'keyword',
    })
  } else {
    // The collection predates the sparse arm. createCollection above only runs
    // for a collection that does not exist, so without this the config change
    // would apply to a fresh index and to nobody's production one — the veto
    // would query a vector field that is not there and quietly find nothing,
    // which reads exactly like "the lexical arm had no opinion".
    const info = await db.getCollection(config.qdrantFaqCollection)
    const sparse = info.config?.params?.sparse_vectors ?? {}
    if (!(SPARSE in sparse)) {
      console.log(`Adding the ${SPARSE} vector to ${config.qdrantFaqCollection} …`)
      await db.updateCollection(config.qdrantFaqCollection, {
        sparse_vectors: { [SPARSE]: { modifier: 'idf' } },
      })
    }
  }
}

// Incremental ingest — read every point's (chunk_id → stored chunk_hash) so the
// reconciler can diff the corpus against Qdrant before spending a single
// embedding/LLM token. with_vector:false keeps this cheap: we pull only the two
// bookkeeping keys, paginating so a growing corpus never blows the page limit.
// The collection is assumed to exist (call ensureCollections first); an empty
// collection simply yields an empty map, which makes a cold start build all.
export async function scrollHashes(collection: string): Promise<Map<string, string>> {
  const db = qdrant()
  const out = new Map<string, string>()
  let offset: string | number | undefined | null = undefined
  do {
    const res = await db.scroll(collection, {
      limit: 256,
      offset: offset ?? undefined,
      with_payload: ['chunk_id', 'chunk_hash'],
      with_vector: false,
    })
    for (const p of res.points) {
      const pl = (p.payload ?? {}) as { chunk_id?: string; chunk_hash?: string }
      // Points written by the pre-incremental pipeline carry chunk_id but no
      // chunk_hash. Map those to '' so the first incremental run rebuilds them
      // (populating the hash) and reclaims any that the corpus no longer emits.
      if (pl.chunk_id) out.set(pl.chunk_id, pl.chunk_hash ?? '')
    }
    offset = res.next_page_offset as string | number | null | undefined
  } while (offset !== null && offset !== undefined)
  return out
}

// Reclaim points whose logical chunk_id the corpus no longer produces (a deleted
// blog post, a renamed section). Maps each chunk_id back through the same
// deterministic UUIDv5 the writer used, then deletes in pages.
export async function deleteByChunkIds(collection: string, chunkIds: string[]): Promise<void> {
  if (chunkIds.length === 0) return
  const db = qdrant()
  const ids = chunkIds.map(toPointId)
  for (let i = 0; i < ids.length; i += 128) {
    await db.delete(collection, { points: ids.slice(i, i + 128), wait: true })
  }
}

// The Qdrant round-trip behind faqLookup, injectable so the accept/reject rule
// can be driven without a live collection. Production always uses the client.
export interface FaqSearchDeps {
  search: (
    collection: string,
    body: Record<string, unknown>,
  ) => Promise<{ points: { score?: number; payload?: Record<string, unknown> | null }[] }>
}

const faqIdOf = (p?: { payload?: Record<string, unknown> | null }): string | undefined =>
  ((p?.payload ?? {}) as { faq_id?: string }).faq_id

export const DEFAULT_FAQ_DEPS: FaqSearchDeps = {
  search: (collection, body) => qdrant().query(collection, body as never),
}

// Look up the closest pre-written FAQ answer for a query embedding. Returns the
// cached answer when the top hit is BOTH similar enough and unambiguously ahead
// of the runner-up, else null (caller falls through to RAG). Locale-filtered so
// each language matches its own paraphrases. Dense-only, single round-trip — no
// generation LLM involved.
//
// The margin exists because a hit here bypasses every grounding check the
// pipeline has: no grading, no generation, no sources shown. The cache holds
// many paraphrases whose wording is near-identical across topics that differ
// only in the fact being asked for, and those land close together in embedding
// space. When two TOPICS are effectively tied, the question sits between them
// and the winner is decided by noise — so the safe move is to hand it to RAG,
// which retrieves, grades, and cites. A single global threshold cannot express
// that: both candidates clear it.
//
// The runner-up must come from a different entry. Points are one per paraphrase
// (ingest/build-faq-cache.ts), so an entry that is asked in many ways returns
// several of its own points, at almost identical scores, exactly when it is the
// right answer. Treating those as a tie would make the cache refuse the entries
// it covers best. Hence the window: it is sized to reach past the widest
// paraphrase set rather than to the next result.
export interface FaqLookupOptions {
  // The visitor's question as text. The dense arm only ever sees its embedding;
  // the lexical arm needs the words.
  queryText: string
  // Both fields are REQUIRED on purpose. Reading config in here would let a
  // caller silently run without the veto, and every seam in this pipeline that
  // could be forgotten has been forgotten at least once. Omitting it is a type
  // error instead.
  sparseVeto: boolean
}

export async function faqLookup(
  queryVec: number[],
  locale: string,
  opts: FaqLookupOptions,
  deps: FaqSearchDeps = DEFAULT_FAQ_DEPS,
): Promise<{ answer: string; id: string; score: number } | null> {
  const filter = { must: [{ key: 'locale', match: { value: locale } }] }
  const res = await deps.search(config.qdrantFaqCollection, {
    query: queryVec,
    using: DENSE,
    filter,
    limit: config.faqCandidateK,
    with_payload: true,
  })
  const [top, ...rest] = res.points
  const topScore = top?.score ?? 0
  const topId = faqIdOf(top)
  // The best candidate belonging to some OTHER entry; points come back ordered,
  // so the first one is it. Nothing to compare against — a lone entry, or a
  // window filled entirely by its own paraphrases — cannot be confused with
  // anything, so Infinity keeps it out of the margin comparison entirely.
  // Only points that name an entry can stand for a competing topic. A payload
  // without a faq_id is malformed data, not a rival: counting it would let one
  // bad point suppress an unambiguous hit, and the suppression is invisible —
  // the answer simply costs a generation from then on.
  const rival = rest.find((p) => faqIdOf(p) !== undefined && faqIdOf(p) !== topId)
  const margin = rival ? topScore - (rival.score ?? 0) : Number.POSITIVE_INFINITY
  // Diagnostic: always log both candidates and the gap, so both knobs stay
  // tunable from logs (e.g. "top=0.820 next=0.810 gap=0.010" names a near-tie;
  // "top=0.690 next=0.300" names a threshold that is merely too high).
  const payload = (top?.payload ?? {}) as { answer?: string; faq_id?: string }
  console.log(
    `[chat] faqprobe top=${topScore.toFixed(3)} id=${topId ?? '-'} ` +
      `rival=${(rival?.score ?? 0).toFixed(3)} rival_id=${faqIdOf(rival) ?? '-'} ` +
      `gap=${Number.isFinite(margin) ? margin.toFixed(3) : 'none'} ` +
      `thr=${config.faqCacheThreshold} min_gap=${config.faqCacheMargin} ` +
      `hits=${res.points.length} locale=${locale}`,
  )
  if (!top || topScore < config.faqCacheThreshold) return null
  // A top hit that names no entry would be served with id '', which the logs and
  // the insights report would then carry as a hit from an entry nobody can look
  // up. Let it fall through to RAG instead.
  if (topId === undefined) return null
  // Strictly greater, per the rule as specified: a gap that only equals the
  // minimum has not cleared it.
  if (margin <= config.faqCacheMargin) return null
  if (!payload.answer) return null

  // A second, purely lexical opinion on the same question. The dense arm ranks
  // by sentence frame: 「Charles 在 NUEIP 做什麼?」 sits almost on top of
  // overall-summary's 「Charles 是做什麼的」, and the proper noun that is the
  // whole difference between the two questions barely moves a sentence
  // embedding. BM25 with IDF weights precisely that noun. So when the lexical
  // arm has an opinion and the dense winner is not in it, the frame won over the
  // subject and the cache should not answer.
  //
  // An empty lexical result is silence, not dissent: a short or generic question
  // gives BM25 nothing to weigh, and refusing on that would cost the cache the
  // very questions it exists to answer.
  if (opts.sparseVeto) {
    const lex = await deps.search(config.qdrantFaqCollection, {
      query: { text: opts.queryText, model: config.sparseModel },
      using: SPARSE,
      filter,
      limit: config.faqVetoK,
      with_payload: true,
    })
    const ranked = lex.points.map(faqIdOf).filter((id): id is string => id !== undefined)
    if (ranked.length > 0 && !ranked.includes(topId)) {
      console.log(`[chat] faqveto top=${topId} lexical=${ranked.slice(0, 3).join(',')} locale=${locale}`)
      return null
    }
  }
  return { answer: payload.answer, id: topId, score: topScore }
}
