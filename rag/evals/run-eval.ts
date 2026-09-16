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
// the first three arms run without an Anthropic key.
//
// LangSmith: set LANGCHAIN_TRACING_V2=true + LANGCHAIN_API_KEY to capture every
// arm's runs as a traced experiment (no code change — the SDK auto-instruments).

import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { retrieveWith, type RetrievalConfig } from '../retrieval.js'
import { graph } from '../graph.js'
import { detectLanguage, type Locale } from '../language.js'
import { GOLDEN, type EvalCategory } from './golden.js'
import { judgeFaithfulness } from './judge.js'
import {
  recallAtK,
  reciprocalRank,
  correctness,
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
  { name: 'dense-only', retrieval: { dense: true, sparse: false, rerank: false } },
  { name: 'hybrid', retrieval: { dense: true, sparse: true, rerank: false } },
  // strictRerank: serving degrades a failed rerank to the RRF order on purpose
  // (retrieval.ts), which for an ablation would mean this arm quietly reporting
  // the `hybrid` arm's ranking under its own name. A measurement run must fail
  // instead of publishing a number nobody can trace back.
  { name: 'hybrid+rerank', retrieval: { dense: true, sparse: true, rerank: true, strictRerank: true } },
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
  hits: { category: EvalCategory; recall: number; correctness?: number }[],
): { category: EvalCategory; recall: number; correctness: number | null; n: number }[] {
  const groups = new Map<EvalCategory, { recall: number[]; correctness: number[] }>()
  for (const h of hits) {
    const g = groups.get(h.category) ?? { recall: [], correctness: [] }
    g.recall.push(h.recall)
    if (h.correctness !== undefined) g.correctness.push(h.correctness)
    groups.set(h.category, g)
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  return [...groups.entries()]
    .map(([category, g]) => ({
      category,
      recall: avg(g.recall),
      correctness: g.correctness.length > 0 ? avg(g.correctness) : null,
      n: g.recall.length,
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
  category: EvalCategory
  recall: number
  mrr: number
  correctness?: number // corrective arm only: retrieval arms generate no answer
  faithfulness?: number
}

export function aggregate(items: ItemResult[]): Aggregate {
  const present = (f: (i: ItemResult) => number | undefined) =>
    items.map(f).filter((v): v is number => v !== undefined)
  const corr = present((i) => i.correctness)
  const faith = present((i) => i.faithfulness)
  return {
    recall: mean(items.map((i) => i.recall)),
    mrr: mean(items.map((i) => i.mrr)),
    // NaN, not 0: an arm that never generated has no correctness to report, and
    // pct() renders it as the em dash the table needs.
    correctness: corr.length ? mean(corr) : NaN,
    faithfulness: faith.length ? mean(faith) : NaN,
    n: items.length,
    categories: byCategory(items),
  }
}

async function runArm(arm: Arm, locales: Locale[]): Promise<Aggregate> {
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
        const ids = (final.sources ?? []).map((s) => s.id)
        const graded = final.graded ?? []
        const ctx = graded
          .map((d, i) => `[${i + 1}] (${d.metadata.sourceType}) ${d.pageContent}`)
          .join('\n\n')
        items.push({
          category: item.category,
          recall: recallAtK(ids, relevant),
          mrr: reciprocalRank(ids, relevant),
          correctness: correctness(answerText, item),
          faithfulness: (await judgeFaithfulness(answerText, ctx)).grounded ? 1 : 0,
        })
      } else {
        // Retrieval-only arm: measure recall/MRR directly. No generation, so
        // correctness/faithfulness are not applicable (left out of their means).
        const docs = await retrieveWith(question, locale, arm.retrieval!)
        const ids = docs.map((d) => d.metadata.id as string)
        const r = recallAtK(ids, relevant)
        items.push({ category: item.category, recall: r, mrr: reciprocalRank(ids, relevant) })
        // Surface misses so a high aggregate can't hide a specific failing item
        // (e.g. the blog body-chunk questions we just added).
        if (r < 1) console.log(`    ✗ miss [${arm.name}/${locale}] ${item.id} — want ${relevant.join(',')}, got ${ids.slice(0, 6).join(',')}`)
      }
    }
  }

  return aggregate(items)
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
    '| Arm | recall@k | MRR | correctness | faithfulness | Δ recall |\n' +
    '|---|---|---|---|---|---|'
  let prev = NaN
  const lines = rows.map(({ arm, agg }) => {
    const delta = Number.isNaN(prev) ? '—' : `${((agg.recall - prev) * 100).toFixed(1)}pp`
    prev = agg.recall
    return `| ${arm} | ${pct(agg.recall)} | ${agg.mrr.toFixed(3)} | ${pct(agg.correctness)} | ${pct(agg.faithfulness)} | ${delta} |`
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
  const rows: { arm: string; agg: Aggregate }[] = []
  for (const arm of arms) {
    process.stdout.write(`  ${arm.name}… `)
    const agg = await runArm(arm, locales)
    rows.push({ arm: arm.name, agg })
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
