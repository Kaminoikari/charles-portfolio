// The incident counters in the insights report, over rows a test controls.
//   npx tsx --test rag/insights/collect.test.ts
//
// gatherInsights read Qdrant directly, so the outage count added on 2026-09-16
// had no test (the review's follow-up listed it as a known gap). The load is
// now injectable and both incident counters are pinned here.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gatherInsights, type LogRow } from './collect.js'

const row = (route: string, degraded?: string[]): LogRow => ({
  type: 'question',
  question: `q-${route}-${Math.random()}`,
  answer: 'a',
  language: 'en',
  route,
  loops: 0,
  latency_ms: 100,
  visitor_id: 'v1',
  country: 'TW',
  degraded,
  ts: new Date().toISOString(),
})

const load = (rows: LogRow[]) => async () => ({ rows, truncated: false })

test('an outage and a degraded answer are counted apart, and apart from fallbacks', async () => {
  const ins = await gatherInsights({
    load: load([
      row('generate'),
      row('generate', ['dense-unavailable']),
      row('faq', []),
      row('unavailable'),
      row('fallback'),
    ]),
  })
  assert.ok(ins)
  assert.equal(ins.outages, 1)
  assert.equal(ins.degradedAnswers, 1)
  assert.equal(ins.fallbacks, 1)
  assert.equal(ins.degradedPct, 20)
})

test('rows written before degradations were logged count as healthy', async () => {
  const ins = await gatherInsights({ load: load([row('generate'), { ...row('generate'), degraded: null }]) })
  assert.equal(ins?.degradedAnswers, 0)
})
