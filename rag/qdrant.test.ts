// Unit tests for the FAQ cache's accept/reject rule. No secrets / network:
//   npm run rag:test
//
// The FAQ cache is the only path in the pipeline that reaches the visitor with
// no grounding check at all: a hit returns a hand-written answer without grading,
// without generation, and without sources. A wrong hit is therefore a confident,
// fluent, completely wrong answer the visitor has no way to spot.
//
// That matters because of what the cache holds: hundreds of paraphrases across
// dozens of topics, many of them structurally identical but factually different
// ("what did he do at USPACE" vs "what did he do at NUEIP"). Those sit close
// together in embedding space, so a single global threshold is not enough — two
// candidates can BOTH clear it, and the one that wins by a hair may be the wrong
// topic. The margin rule below is what separates "clearly this topic" from
// "somewhere between two topics", and the second case belongs in RAG, which
// retrieves, grades, and cites.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_FAQ_DEPS, faqLookup, type FaqSearchDeps } from './qdrant.js'
import { config } from './config.js'
import { faqEntries } from './faq-cache.js'

const hit = (faqId: string, score: number) => ({
  score,
  payload: { faq_id: faqId, answer: `answer for ${faqId}`, locale: 'en' },
})

// The cache stores one point per PARAPHRASE, so several neighbours of a query
// routinely belong to the same entry (build-faq-cache.ts flatten()). Same id,
// same answer, near-identical score.
const paraphrases = (faqId: string, ...scores: number[]) => scores.map((s) => hit(faqId, s))

// Drives the real faqLookup; only the Qdrant round-trip is stubbed.
const lookupOver = (points: ReturnType<typeof hit>[], seen?: { body?: Record<string, unknown> }) =>
  faqLookup(
    [0.1, 0.2],
    'en',
    // These cases are about the dense accept/reject rule, so the lexical veto is
    // off: with it on, every one of them would need a second stubbed round-trip
    // to say something they are not testing.
    { queryText: 'q', sparseVeto: false },
    {
      search: async (_collection, body) => {
        if (seen) seen.body = body
        return { points }
      },
    },
  )

test('faqLookup: a clear winner is served from cache', async () => {
  const res = await lookupOver([hit('uspace-role', 0.91), hit('nueip-role', 0.71)])
  assert.equal(res?.id, 'uspace-role')
})

test('faqLookup: two candidates separated by a hair fall through to RAG', async () => {
  // Both clear the 0.7 threshold, so the old single-threshold rule served the
  // first one. Being between two topics is exactly when the cache must not answer.
  const res = await lookupOver([hit('uspace-role', 0.82), hit('nueip-role', 0.81)])
  assert.equal(res, null)
})

test('faqLookup: a lone candidate has nothing to be confused with', async () => {
  const res = await lookupOver([hit('uspace-role', 0.91)])
  assert.equal(res?.id, 'uspace-role')
})

test('faqLookup: a top hit below the threshold is still rejected', async () => {
  const res = await lookupOver([hit('uspace-role', 0.5), hit('nueip-role', 0.1)])
  assert.equal(res, null)
})

test('faqLookup: an empty collection returns null', async () => {
  assert.equal(await lookupOver([]), null)
})

test('faqLookup: two paraphrases of the SAME entry are not a tie to be broken', async () => {
  // The regression this rule nearly introduced. An entry earns its paraphrases by
  // being asked in many ways, so its best-covered questions return several of its
  // own points at almost identical scores. Reading that as ambiguity would make
  // the cache refuse precisely the entries it covers best — the opposite of the
  // rule's purpose, which is to catch a question sitting BETWEEN two topics.
  const res = await lookupOver([...paraphrases('best-project', 0.88, 0.879, 0.877), hit('ai-usage', 0.4)])
  assert.equal(res?.id, 'best-project')
})

test('faqLookup: the runner-up that counts is the best one from another entry', async () => {
  // Same shape as above, except a different topic is genuinely close behind. The
  // near-identical sibling must not hide it.
  const res = await lookupOver([...paraphrases('uspace-role', 0.82, 0.819), hit('nueip-role', 0.81)])
  assert.equal(res, null)
})

test('faqLookup: a window of same-entry paraphrases does not hide the rival', async () => {
  // Sized against the real corpus: the window has to reach past the largest
  // paraphrase set an entry can have, or the rival never enters the comparison.
  const widest = Math.max(
    ...faqEntries.flatMap((e) => (['en', 'zh-TW', 'ja'] as const).map((l) => e.questions[l].length)),
  )
  assert.ok(
    config.faqCandidateK > widest,
    `faqCandidateK (${config.faqCandidateK}) must exceed the widest paraphrase set (${widest})`,
  )
  const seen: { body?: Record<string, unknown> } = {}
  await lookupOver([hit('a', 0.9), hit('b', 0.5)], seen)
  assert.equal(seen.body?.limit, config.faqCandidateK)
})

test('faqLookup: the margin is a real threshold, not zero', () => {
  // A zero margin would make the near-tie test above pass only by luck of float
  // comparison, and would ship the rule as a no-op.
  assert.ok(config.faqCacheMargin > 0)
})

// Every test above stubs the round-trip, so all of them would keep passing if
// the production default were quietly replaced by canned points. Pin that the
// default actually reaches a Qdrant client: with no QDRANT_URL configured it
// fails to connect (in milliseconds — no real host is involved), where a stub
// would happily resolve.
test('faqLookup: the default search really goes to Qdrant', async () => {
  await assert.rejects(DEFAULT_FAQ_DEPS.search(config.qdrantFaqCollection, { query: [0.1], limit: 2 }))
})

// A point whose payload lost its faq_id is malformed, not a topic. Both
// directions were previously undefined behaviour that no test described.
test('faqLookup: a point with no faq_id is not evidence of a competing topic', async () => {
  // Treating it as a rival would let one malformed point suppress a cache hit
  // that is otherwise unambiguous, and the suppression would be invisible —
  // the answer just quietly costs a generation from then on.
  const malformed = { score: 0.88, payload: { answer: 'orphan', locale: 'en' } }
  const res = await lookupOver([hit('best-project', 0.89), malformed as ReturnType<typeof hit>])
  assert.equal(res?.id, 'best-project')
})

test('faqLookup: a top hit with no faq_id is not served', async () => {
  // It would have come back with id '', which downstream logs as a cache hit
  // from an entry nobody can look up.
  const malformed = { score: 0.95, payload: { answer: 'orphan', locale: 'en' } }
  const res = await lookupOver([malformed as ReturnType<typeof hit>, hit('nueip-role', 0.2)])
  assert.equal(res, null)
})

// --- the sparse veto -----------------------------------------------------
// The dense arm matches sentence FRAME. 「Charles 在 NUEIP 做什麼?」 is nearly
// identical to overall-summary's 「Charles 是做什麼的」, and the proper noun that
// makes the two questions different carries almost no weight in a sentence
// embedding — so the broad entry won, and the visitor asking about NUEIP got a
// career summary that never named it. BM25 with IDF weights exactly that noun,
// which is why the second opinion is lexical and not another embedding.
//
// sparseVeto is a REQUIRED option rather than a config read inside this module,
// so the caller cannot forget to pass it: omitting it is a type error, which is
// a harder guarantee than a test that someone has to remember to write.

const P = (faq_id: string, score: number, answer = 'a') => ({ score, payload: { faq_id, answer, locale: 'en' } })

function twoArmDeps(dense: ReturnType<typeof P>[], sparse: ReturnType<typeof P>[]) {
  const seen: string[] = []
  return {
    seen,
    deps: {
      search: async (_c: string, body: Record<string, unknown>) => {
        const using = String(body.using)
        seen.push(using)
        return { points: using === 'sparse' ? sparse : dense }
      },
    },
  }
}

const ask = (q: string, sparseVeto: boolean, deps: FaqSearchDeps) =>
  faqLookup([0.1], 'en', { queryText: q, sparseVeto }, deps)

test('faqLookup: the cache declines when the lexical arm does not rank the winner at all', async () => {
  const { deps } = twoArmDeps(
    [P('overall-summary', 0.9), P('exp-nueip', 0.5)],
    [P('exp-nueip', 8), P('exp-history', 3)],
  )
  assert.equal(await ask('Charles 在 NUEIP 做什麼?', true, deps), null)
})

test('faqLookup: the veto stays out of the way when both arms agree', async () => {
  const { deps } = twoArmDeps(
    [P('exp-nueip', 0.9, 'the NUEIP answer'), P('overall-summary', 0.5)],
    [P('exp-nueip', 8), P('exp-history', 3)],
  )
  assert.equal((await ask('Charles 在 NUEIP 做什麼?', true, deps))?.id, 'exp-nueip')
})

test('faqLookup: an empty lexical result vetoes nothing', async () => {
  // A short or generic question gives BM25 nothing to say. Silence is not
  // evidence against the dense winner, and treating it as such would refuse the
  // cache on exactly the questions it exists to answer.
  const { deps } = twoArmDeps([P('overall-summary', 0.9)], [])
  assert.equal((await ask('?', true, deps))?.id, 'overall-summary')
})

test('faqLookup: with the veto off the lexical arm is never queried', async () => {
  const { deps, seen } = twoArmDeps([P('overall-summary', 0.9)], [P('exp-nueip', 8)])
  assert.equal((await ask('Charles 在 NUEIP 做什麼?', false, deps))?.id, 'overall-summary')
  assert.deepEqual(seen, ['dense'], 'the lexical arm must not be queried while the veto is off')
})
