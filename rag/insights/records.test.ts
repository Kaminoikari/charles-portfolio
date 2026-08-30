import assert from 'node:assert/strict'
import { test } from 'node:test'

import { newSnapshots, questionSnapshots, snapshotsAfterLegacyPulse } from './records.js'
import type { QuestionRecordSource } from './records.js'

const question = (overrides: Partial<QuestionRecordSource> = {}): QuestionRecordSource => ({
  type: 'question',
  visitor_id: 'visitor-1',
  question: 'What did Charles build?',
  answer: 'A portfolio chatbot.',
  language: 'en',
  route: 'generate',
  loops: 0,
  latency_ms: 120,
  country: 'TW',
  ts: '2026-08-18T01:00:00.000Z',
  ...overrides,
})

test('a previously sent question is excluded while a new question remains', () => {
  const sent = questionSnapshots([question()])
  const current = questionSnapshots([question(), question({ question: 'What is the Product Playbook?', ts: '2026-08-18T01:15:00.000Z' })])

  assert.deepEqual(newSnapshots(current, sent), [current.find((record) => record.hash !== sent[0]?.hash)])
})

test('a changed stored answer counts as a new record', () => {
  const sent = questionSnapshots([question()])
  const current = questionSnapshots([question({ answer: 'An AI portfolio chatbot.' })])

  assert.equal(newSnapshots(current, sent).length, 1)
})

test('legacy pulse migration keeps only records newer than the last emailed timestamp', () => {
  const current = questionSnapshots([
    question({ ts: '2026-08-18T01:00:00.000Z' }),
    question({ question: 'New question', ts: '2026-08-18T02:00:00.000Z' }),
  ])

  const added = snapshotsAfterLegacyPulse(current, 'questions=4 latest=2026-08-18T01:30:00.000Z')
  assert.equal(added.length, 1)
  assert.equal(added[0]?.timestamp, '2026-08-18T02:00:00.000Z')
})

test('opens never appear in the comparison snapshot', () => {
  const records = questionSnapshots([question({ type: 'open', question: undefined })])
  assert.deepEqual(records, [])
})
