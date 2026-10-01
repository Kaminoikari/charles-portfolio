// Phase 1 ablation runner. Runs the golden set through progressively richer
// retrieval arms and reports each layer's marginal lift — the same "+X%" story
// as product-playbook's eval tables, applied to RAG.
//
//   npx tsx rag/evals/run-eval.ts                 # all arms, all locales
//   npx tsx rag/evals/run-eval.ts --locale en     # one locale
//   npx tsx rag/evals/run-eval.ts --arm hybrid    # one arm
//   npx tsx rag/evals/run-eval.ts --out docs/...   # write markdown report
//
// Needs EMBEDDING_API_KEY + QDRANT_* (retrieval) and ANTHROPIC_API_KEY
// (corrective arm + faithfulness judge). Retrieval-only arms skip the LLM, so
// the four retrieval arms run without an Anthropic key.
//
// LangSmith: set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY to capture every
// arm's runs as a traced experiment (no code change — the SDK auto-instruments).

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { retrieveWith, type RetrievalConfig } from '../retrieval.js'
import { graph } from '../graph.js'
import { evidenceBlock } from '../nodes.js'
import { detectLanguage, type Locale } from '../language.js'
import { GOLDEN, type EvalCategory, type GoldenItem } from './golden.js'
import { judgeFaithfulness, judgeStatement, type FaithfulnessVerdict } from './judge.js'
import {
  itemRecall,
  reciprocalRank,
  correctnessMiss,
  scoreCorrectness,
  mean,
  type Aggregate,
} from './metrics.js'

// ── arms ────────────────────────────────────────────────────────────────
// Each arm is a retrieval config; the final "corrective" arm runs the full
// graph (retrieve → grade → rewrite → generate) instead of one-shot retrieval.
export interface Arm {
  name: string
  retrieval?: RetrievalConfig // present for retrieval-only arms
  corrective?: boolean // present for the full-graph arm
}

export const ARMS: Arm[] = [
  // BM25 alone. Nobody is served this on a good day; it is the ranking a visitor
  // gets while Voyage is down (retrieval.ts fetchCandidates), so this arm is
  // what that degradation costs.
  { name: 'sparse-only', retrieval: { dense: false, sparse: true, rerank: false } },
  { name: 'dense-only', retrieval: { dense: true, sparse: false, rerank: false } },
  // strictDense / strictRerank: serving degrades a failed embedding to BM25 and
  // a failed rerank to the RRF order on purpose, which for an ablation would
  // mean an arm quietly reporting another arm's ranking under its own name. A
  // measurement run must fail instead of publishing a number nobody can trace.
  { name: 'hybrid', retrieval: { dense: true, sparse: true, rerank: false, strictDense: true } },
  { name: 'hybrid+rerank', retrieval: { dense: true, sparse: true, rerank: true, strictDense: true, strictRerank: true } },
  { name: 'corrective', corrective: true },
]

const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

// Per-category scores, so a category that regresses cannot be absorbed by the
// mean. It exists for `near-miss`, and the 2026-09-16 run showed that recall
// alone cannot serve it: the sibling's chunk IS one of the item's relevant ids,
// so retrieving the wrong one of the pair scores 100% recall while the answer
// quotes the other company's number. Correctness is the column where that shows,
// which is why it is split out alongside recall rather than left to the mean.
//
// Correctness is null, not 0, for a category no arm answered. The retrieval arms
// never generate, so averaging their absence as failure would print three arms
// flunking every category beside the one arm that actually answered.
export function byCategory(
  hits: { category: EvalCategory; recall?: number; correctness?: number }[],
): { category: EvalCategory; recall: number; correctness: number | null; n: number }[] {
  const groups = new Map<EvalCategory, { recall: number[]; correctness: number[]; n: number }>()
  for (const h of hits) {
    const g = groups.get(h.category) ?? { recall: [], correctness: [], n: 0 }
    g.n++
    if (h.recall !== undefined) g.recall.push(h.recall)
    if (h.correctness !== undefined) g.correctness.push(h.correctness)
    groups.set(h.category, g)
  }
  // NaN for a category none of whose runs retrieved; pct() renders it as —.
  const avg = (xs: number[]) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length)
  return [...groups.entries()]
    .map(([category, g]) => ({
      category,
      recall: avg(g.recall),
      correctness: g.correctness.length > 0 ? avg(g.correctness) : null,
      n: g.n,
    }))
    .sort((a, b) => a.category.localeCompare(b.category))
}

// One record per question run. Every number the report prints is derived from
// this list, which is the point: the headline correctness and the per-category
// correctness used to be accumulated separately, so an arm could contribute to
// one and not the other. It did — the corrective arm's category column read "—"
// while its headline correctness was fine, and no test could see the difference.
// A score that is absent here is absent everywhere, and present here is present
// everywhere.
export interface ItemResult {
  // `${golden id}/${locale}`: what a baseline is keyed by.
  key?: string
  category: EvalCategory
  // Absent for a run that was answered without retrieving (see Aggregate).
  recall?: number
  mrr?: number
  correctness?: number // corrective arm only: retrieval arms generate no answer
  faithfulness?: number
}

// A run the judge could not read produces no faithfulness datum, the same way a
// retrieval-only arm produces no correctness. Scoring it 1 made the headline a
// function of how often the FAQ cache answered: the lexical veto sent five more
// questions to generation, the free passes fell 28 → 23, and the reported figure
// fell 91.9% → 85.4% with no answer getting worse (judge.test.ts).
export function scoreFaithfulness(verdict: FaithfulnessVerdict): number | undefined {
  return verdict.judged ? (verdict.grounded ? 1 : 0) : undefined
}

export function aggregate(items: ItemResult[]): Aggregate {
  const present = (f: (i: ItemResult) => number | undefined) =>
    items.map(f).filter((v): v is number => v !== undefined)
  const corr = present((i) => i.correctness)
  const faith = present((i) => i.faithfulness)
  const recall = present((i) => i.recall)
  const mrr = present((i) => i.mrr)
  return {
    recall: recall.length ? mean(recall) : NaN,
    mrr: mrr.length ? mean(mrr) : NaN,
    withoutRetrieval: items.filter((i) => i.recall === undefined).length,
    // NaN, not 0: an arm that never generated has no correctness to report, and
    // pct() renders it as the em dash the table needs.
    correctness: corr.length ? mean(corr) : NaN,
    faithfulness: faith.length ? mean(faith) : NaN,
    n: items.length,
    categories: byCategory(items),
  }
}

// Recall and MRR for one full-graph run, or neither when retrieve never ran. A
// FAQ hit now carries citations, so its sources would otherwise be scored as a
// retrieval result; before that it carried none and was scored as a miss. Either
// way it measured the cache, not retrieval, and 23 of 123 runs were served so.
export function retrievalScores(
  final: { sources?: { id: string }[]; documents?: unknown[] },
  item: Pick<GoldenItem, 'relevantIds' | 'needsEvery'>,
): { recall?: number; mrr?: number } {
  if (!Array.isArray(final.documents)) return {}
  const ids = (final.sources ?? []).map((s) => s.id)
  return { recall: itemRecall(ids, item), mrr: reciprocalRank(ids, item.relevantIds) }
}

async function runArm(arm: Arm, locales: Locale[]): Promise<{ agg: Aggregate; items: ItemResult[] }> {
  const items: ItemResult[] = []

  for (const locale of locales) {
    for (const item of GOLDEN) {
      const question = item.question[locale]
      // relevantIds are locale-agnostic prefixes; recall/MRR do prefix matching
      // against the per-locale chunk ids, so no expansion is needed here.
      const relevant = item.relevantIds

      if (arm.corrective) {
        // Full graph, invoked directly to read the FINAL STATE. answer() returns
        // only Source metadata (id/title/score) and drops `graded`, so a prior
        // version judged faithfulness against bare titles and the number read far
        // too low. The generator's real evidence is the graded chunks'
        // pageContent; ctx below rebuilds that, mirroring generate()'s "Context"
        // block. (Fixed 2026-06-28.)
        const language = detectLanguage(question)
        const final = await graph.invoke({ question, language, queries: [question] })
        const answerText = final.answer ?? ''
        const graded = final.graded ?? []
        // The SAME list the generator was given (nodes.ts). Judging against the
        // chunks alone reported every claim resting on the portfolio map or the
        // entity block as invention, which on 2026-09-17 was most of the
        // ungrounded verdicts in a full run.
        const ctx = graded.length === 0 ? '' : evidenceBlock(graded, final.queries?.at(-1) ?? question)
        // A claim is judged in whatever language the answer is written, so the
        // same one declaration serves all three locales. scoreCorrectness throws
        // if an item carries a claim and this is still null, which is the only
        // reason the call cannot be quietly dropped later.
        const judged = item.mustState ? (await judgeStatement(answerText, item.mustState)).states : null
        const faith = await judgeFaithfulness(answerText, ctx)
        items.push({
          key: `${item.id}/${locale}`,
          category: item.category,
          ...retrievalScores(final, item),
          correctness: scoreCorrectness(answerText, item, judged),
          faithfulness: scoreFaithfulness(faith),
        })
        // The same reason correctness prints its misses: a mean cannot tell an
        // invented fact from an answer the judge simply could not read.
        if (faith.judged && !faith.grounded) {
          console.log(`    \u2717 ungrounded [${arm.name}/${locale}] ${item.id} \u2014 ${faith.reason}`)
        }
        // Say why, next to the miss. Without this the only debuggable number
        // this arm produced was the category mean, and a mean cannot tell a bad
        // answer from a rule that asks an English word of a Japanese answer.
        const why = correctnessMiss(answerText, item, judged)
        if (why) console.log(`    ✗ wrong [${arm.name}/${locale}] ${item.id} — ${why}`)
      } else {
        // Retrieval-only arm: measure recall/MRR directly. No generation, so
        // correctness/faithfulness are not applicable (left out of their means).
        const docs = await retrieveWith(question, locale, arm.retrieval!)
        const ids = docs.map((d) => d.metadata.id as string)
        const r = itemRecall(ids, item)
        items.push({ key: `${item.id}/${locale}`, category: item.category, recall: r, mrr: reciprocalRank(ids, relevant) })
        // Surface misses so a high aggregate can't hide a specific failing item
        // (e.g. the blog body-chunk questions we just added).
        if (r < 1) console.log(`    ✗ miss [${arm.name}/${locale}] ${item.id} — want ${relevant.join(',')}, got ${ids.slice(0, 6).join(',')}`)
      }
    }
  }

  return { agg: aggregate(items), items }
}

// ── per-item baseline ─────────────────────────────────────────────────────
// The recall floor catches a collapse and nothing smaller: it was set with two
// points of headroom, so a content edit could lose any two questions and pass.
// A baseline records each question's recall per locale from a known-good run,
// and the gate fails on any question that scores lower than it did, naming it.
// Questions added since the baseline are reported, not judged; a baseline is
// refreshed on purpose (--write-baseline), in a commit that says why.
export interface Baseline {
  arm: string
  recall: Record<string, number>
}

export function parseBaseline(raw: unknown): Baseline {
  const b = raw as { arm?: unknown; recall?: unknown } | null
  const recall = b?.recall
  if (
    typeof b?.arm !== 'string' ||
    typeof recall !== 'object' ||
    recall === null ||
    !Object.values(recall).every((v) => typeof v === 'number')
  ) {
    throw new Error('baseline file is not { arm: string, recall: { [key]: number } }')
  }
  return { arm: b.arm, recall: recall as Record<string, number> }
}

export function toBaseline(arm: string, items: ItemResult[]): Baseline {
  const recall: Record<string, number> = {}
  for (const i of items) if (i.key !== undefined && i.recall !== undefined) recall[i.key] = i.recall
  return { arm, recall }
}

export interface BaselineVerdict {
  ok: boolean
  regressions: { key: string; was: number; now: number }[]
  unbaselined: string[]
}

export function baselineGate(baseline: Baseline, arm: string, items: ItemResult[]): BaselineVerdict {
  if (baseline.arm !== arm) throw new Error(`baseline is for arm ${baseline.arm}, this run is ${arm}`)
  const regressions: BaselineVerdict['regressions'] = []
  const unbaselined: string[] = []
  for (const i of items) {
    if (i.key === undefined || i.recall === undefined) continue
    const was = baseline.recall[i.key]
    if (was === undefined) unbaselined.push(i.key)
    else if (i.recall < was) regressions.push({ key: i.key, was, now: i.recall })
  }
  return { ok: regressions.length === 0, regressions, unbaselined }
}

// Every category present in any arm, in a stable order, so the table has the
// same columns on every row even when one arm measured fewer items.
function categoriesOf(rows: { agg: Aggregate }[]): string[] {
  return [...new Set(rows.flatMap((r) => r.agg.categories.map((c) => c.category)))].sort()
}

function pct(x: number): string {
  return Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`
}

function buildReport(rows: { arm: string; agg: Aggregate }[]): string {
  const header =
    '| Arm | recall@k | MRR | correctness | faithfulness | Δ recall | answered without retrieval |\n' +
    '|---|---|---|---|---|---|---|'
  let prev = NaN
  const lines = rows.map(({ arm, agg }) => {
    const delta = Number.isNaN(prev) ? '—' : `${((agg.recall - prev) * 100).toFixed(1)}pp`
    prev = agg.recall
    const mrr = Number.isNaN(agg.mrr) ? '—' : agg.mrr.toFixed(3)
    return `| ${arm} | ${pct(agg.recall)} | ${mrr} | ${pct(agg.correctness)} | ${pct(agg.faithfulness)} | ${delta} | ${agg.withoutRetrieval} of ${agg.n} |`
  })
  return [
    '# RAG Ablation Report',
    '',
    `Golden set: ${GOLDEN.length} questions × locales. Each arm adds one layer.`,
    '',
    header,
    ...lines,
    '',
    '> recall@k / MRR are deterministic (id matching). correctness/faithfulness',
    '> apply only to the corrective arm (the one that generates an answer).',
    '> recall/MRR cover only runs that retrieved: a FAQ hit or canned reply is',
    '> counted in the last column instead of as a miss. comparison/temporal items',
    '> that need two chunks score the share of them retrieved.',
    '',
    '### Recall by category',
    '',
    '| Arm | ' + categoriesOf(rows).join(' | ') + ' |',
    '|---|' + categoriesOf(rows).map(() => '---').join('|') + '|',
    ...rows.map(({ arm, agg }) => {
      const byName = new Map(agg.categories.map((c) => [c.category, c]))
      const cells = categoriesOf(rows).map((c) => {
        const hit = byName.get(c)
        return hit ? `${pct(hit.recall)} (${hit.n})` : '—'
      })
      return `| ${arm} | ${cells.join(' | ')} |`
    }),
    '',
    '### Correctness by category',
    '',
    '| Arm | ' + categoriesOf(rows).join(' | ') + ' |',
    '|---|' + categoriesOf(rows).map(() => '---').join('|') + '|',
    ...rows.map(({ arm, agg }) => {
      const byName = new Map(agg.categories.map((c) => [c.category, c]))
      const cells = categoriesOf(rows).map((c) => {
        const hit = byName.get(c)
        return hit && hit.correctness !== null ? `${pct(hit.correctness)} (${hit.n})` : '—'
      })
      return `| ${arm} | ${cells.join(' | ')} |`
    }),
    '',
    '> `near-miss` items have a sibling question with the same shape and a',
    '> different fact. Watch them in THIS table, not the one above: the sibling',
    '> chunk is one of the item\'s own relevant ids, so retrieving the wrong one',
    '> of the pair still scores full recall while the answer quotes the other',
    '> company\'s number. Correctness is where the confusion surfaces.',
  ].join('\n')
}

// Which arms fell below the floor.
export function recallFailures(
  rows: { arm: string; recall: number }[],
  minRecall: number,
): { arm: string; recall: number }[] {
  return rows.filter((r) => r.recall < minRecall)
}

export type GateVerdict =
  | { ok: true }
  | { ok: false; reason: 'no-arms-ran' }
  | { ok: false; reason: 'below-floor'; failures: { arm: string; recall: number }[] }

// The whole gate decision, pure, so both ways it can fail are driven by data
// rather than inferred from the shape of main(). The empty case is the one worth
// stating out loud: a gate over zero arms is not a passing gate, it is an absent
// one, and a filter alone cannot tell "everything passed" from "nothing ran".
export function recallGate(rows: { arm: string; recall: number }[], minRecall: number): GateVerdict {
  if (rows.length === 0) return { ok: false, reason: 'no-arms-ran' }
  const failures = recallFailures(rows, minRecall)
  return failures.length > 0 ? { ok: false, reason: 'below-floor', failures } : { ok: true }
}

async function main() {
  const onlyLocale = arg('--locale') as Locale | undefined
  const onlyArm = arg('--arm')
  const out = arg('--out')
  // Retrieval-only: run the deterministic recall@k / MRR arms and skip the
  // corrective (LLM) arm. This is what the contextual A/B uses — a fast, cheap,
  // reproducible measure of how an ingest-side change moves retrieval, with no
  // LLM-judge variance in the comparison.
  const retrievalOnly = process.argv.includes('--retrieval-only')

  const locales = onlyLocale ? [onlyLocale] : LOCALES
  let arms = onlyArm ? ARMS.filter((a) => a.name === onlyArm) : ARMS
  if (arms.length === 0) throw new Error(`unknown --arm; choose from ${ARMS.map((a) => a.name).join(', ')}`)
  if (retrievalOnly) arms = arms.filter((a) => !a.corrective)

  // The corrective arm generates an answer and runs the faithfulness judge, so
  // it needs an Anthropic key. When none is set (e.g. CI with only the retrieval
  // secrets), skip it rather than crash — the retrieval arms still report
  // recall/MRR. An explicit `--arm corrective` overrides this on purpose.
  if (!process.env.ANTHROPIC_API_KEY && !onlyArm) {
    const dropped = arms.filter((a) => a.corrective).map((a) => a.name)
    arms = arms.filter((a) => !a.corrective)
    if (dropped.length) console.log(`No ANTHROPIC_API_KEY — skipping ${dropped.join(', ')} (retrieval arms only).\n`)
  }

  console.log(`Running ${arms.length} arm(s) × ${GOLDEN.length} questions × ${locales.length} locale(s)…\n`)
  const rows: { arm: string; agg: Aggregate; items: ItemResult[] }[] = []
  for (const arm of arms) {
    process.stdout.write(`  ${arm.name}… `)
    const { agg, items } = await runArm(arm, locales)
    rows.push({ arm: arm.name, agg, items })
    console.log(`recall=${pct(agg.recall)} mrr=${agg.mrr.toFixed(3)}`)
  }

  const report = buildReport(rows)
  console.log('\n' + report)
  if (out) {
    writeFileSync(out, report + '\n')
    console.log(`\nWrote ${out}`)
  }

  // Regression gate. The ingest rebuilds the production index on every content
  // push with nothing checking the result, so a content edit that wrecks
  // retrieval has, until now, shipped silently and stayed shipped. A floor is
  // crude, but "recall fell off a cliff" is the failure it has to catch, and
  // that one is loud.
  const minRecall = arg('--min-recall')
  if (minRecall !== undefined) {
    const floor = Number.parseFloat(minRecall)
    if (!Number.isFinite(floor)) throw new Error(`--min-recall must be a number, got ${minRecall}`)
    const verdict = recallGate(
      rows.map(({ arm, agg }) => ({ arm, recall: agg.recall })),
      floor,
    )
    if (!verdict.ok) {
      if (verdict.reason === 'no-arms-ran') {
        console.error('FAIL: --min-recall was requested but no arm ran')
      } else {
        for (const f of verdict.failures) {
          console.error(`FAIL ${f.arm}: recall ${pct(f.recall)} is below the ${pct(floor)} floor`)
        }
      }
      process.exit(1)
    }
    console.log(`\nAll arms at or above the ${pct(floor)} recall floor.`)
  }

  // A baseline judges, or is written from, exactly one arm, so which one is
  // never inferred.
  const writeBaseline = arg('--write-baseline')
  const baselinePath = arg('--baseline')
  if ((writeBaseline || baselinePath) && rows.length !== 1) {
    throw new Error('--baseline / --write-baseline need exactly one --arm')
  }
  if (writeBaseline) {
    writeFileSync(writeBaseline, JSON.stringify(toBaseline(rows[0].arm, rows[0].items), null, 2) + '\n')
    console.log(`\nWrote baseline ${writeBaseline}`)
  }
  if (baselinePath) {
    const baseline = parseBaseline(JSON.parse(readFileSync(baselinePath, 'utf8')))
    const verdict = baselineGate(baseline, rows[0].arm, rows[0].items)
    if (verdict.unbaselined.length > 0) {
      console.log(`\nNot in the baseline yet (not judged): ${verdict.unbaselined.join(', ')}`)
    }
    if (!verdict.ok) {
      for (const r of verdict.regressions) console.error(`REGRESSED ${r.key}: recall ${r.was} → ${r.now}`)
      process.exit(1)
    }
    console.log(`\nNo question scored below its baseline (${Object.keys(baseline.recall).length} baselined).`)
  }
}

// Run only when invoked as the CLI. Importing this module (the arm table is the
// single definition of what each arm measures, so a test pins it there rather
// than restating it) must not kick off a live eval against Qdrant and Voyage.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
