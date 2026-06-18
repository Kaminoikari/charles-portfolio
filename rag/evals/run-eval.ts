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

import { retrieveWith, type RetrievalConfig } from '../retrieval.js'
import { answer as graphAnswer } from '../graph.js'
import { type Locale } from '../language.js'
import { GOLDEN } from './golden.js'
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
interface Arm {
  name: string
  retrieval?: RetrievalConfig // present for retrieval-only arms
  corrective?: boolean // present for the full-graph arm
}

const ARMS: Arm[] = [
  { name: 'dense-only', retrieval: { dense: true, sparse: false, rerank: false } },
  { name: 'hybrid', retrieval: { dense: true, sparse: true, rerank: false } },
  { name: 'hybrid+rerank', retrieval: { dense: true, sparse: true, rerank: true } },
  { name: 'corrective', corrective: true },
]

const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function runArm(arm: Arm, locales: Locale[]): Promise<Aggregate> {
  const recall: number[] = []
  const mrr: number[] = []
  const corr: number[] = []
  const faith: number[] = []

  for (const locale of locales) {
    for (const item of GOLDEN) {
      const question = item.question[locale]
      // relevantIds are locale-agnostic prefixes; recall/MRR do prefix matching
      // against the per-locale chunk ids, so no expansion is needed here.
      const relevant = item.relevantIds

      if (arm.corrective) {
        // Full graph: produces an answer + the chunks it actually used.
        const res = await graphAnswer(question)
        const ids = res.sources.map((s) => s.id)
        recall.push(recallAtK(ids, relevant))
        mrr.push(reciprocalRank(ids, relevant))
        corr.push(correctness(res.answer, item))
        const ctx = res.sources.map((s) => s.title).join('\n')
        faith.push((await judgeFaithfulness(res.answer, ctx)).grounded ? 1 : 0)
      } else {
        // Retrieval-only arm: measure recall/MRR directly. No generation, so
        // correctness/faithfulness are not applicable (left out of their means).
        const docs = await retrieveWith(question, locale, arm.retrieval!)
        const ids = docs.map((d) => d.metadata.id as string)
        const r = recallAtK(ids, relevant)
        recall.push(r)
        mrr.push(reciprocalRank(ids, relevant))
        // Surface misses so a high aggregate can't hide a specific failing item
        // (e.g. the blog body-chunk questions we just added).
        if (r < 1) console.log(`    ✗ miss [${arm.name}/${locale}] ${item.id} — want ${relevant.join(',')}, got ${ids.slice(0, 6).join(',')}`)
      }
    }
  }

  return {
    recall: mean(recall),
    mrr: mean(mrr),
    correctness: corr.length ? mean(corr) : NaN,
    faithfulness: faith.length ? mean(faith) : NaN,
    n: recall.length,
  }
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
  ].join('\n')
}

async function main() {
  const onlyLocale = arg('--locale') as Locale | undefined
  const onlyArm = arg('--arm')
  const out = arg('--out')

  const locales = onlyLocale ? [onlyLocale] : LOCALES
  let arms = onlyArm ? ARMS.filter((a) => a.name === onlyArm) : ARMS
  if (arms.length === 0) throw new Error(`unknown --arm; choose from ${ARMS.map((a) => a.name).join(', ')}`)

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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
