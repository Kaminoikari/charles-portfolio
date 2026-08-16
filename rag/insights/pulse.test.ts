// The pulse line is the whole trigger for the polling wrapper: if it changes on
// a quiet run, every poll emails; if it fails to change when someone asks, the
// question is never reported. No secrets / network:  npm run rag:test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatPulse, summarizePulse, type PulseRow } from './pulse.js'

const row = (over: Partial<PulseRow>): PulseRow => ({
  type: 'question',
  visitor_id: 'v1',
  ts: '2026-08-16T10:00:00.000Z',
  ...over,
})

test('opens on their own leave the line unchanged', () => {
  const quiet = summarizePulse([
    row({ type: 'open', ts: '2026-08-16T10:00:00.000Z' }),
    row({ type: 'open', ts: '2026-08-16T11:00:00.000Z' }),
  ])
  assert.equal(quiet.questions, 0)
  assert.equal(quiet.latestMs, null)
  assert.equal(formatPulse(quiet), 'questions=0 latest=none')
})

// collect.ts counts questions as "not an open", so rows written before the type
// field existed are questions. If this drifts, the trigger and the count in the
// email's headline disagree.
test('a row with no type counts as a question, matching the report', () => {
  const p = summarizePulse([row({ type: null }), row({ type: 'question' }), row({ type: 'open' })])
  assert.equal(p.questions, 2)
})

test('latest is the newest question, whatever order the rows arrive in', () => {
  const p = summarizePulse([
    row({ ts: '2026-08-16T10:00:00.000Z' }),
    row({ ts: '2026-08-16T18:30:00.000Z' }),
    row({ ts: '2026-08-16T12:00:00.000Z' }),
  ])
  assert.equal(p.latestMs, Date.parse('2026-08-16T18:30:00.000Z'))
  assert.equal(formatPulse(p), 'questions=3 latest=2026-08-16T18:30:00.000Z')
})

// An open logged after the last question must not move `latest`, or the line
// would change and mail a dashboard whose question list is identical.
test('an open later than the last question does not move the line', () => {
  const asked = [row({ ts: '2026-08-16T10:00:00.000Z' })]
  const before = formatPulse(summarizePulse(asked))
  const after = formatPulse(summarizePulse([...asked, row({ type: 'open', ts: '2026-08-16T23:00:00.000Z' })]))
  assert.equal(after, before)
})

test('a new question changes the line', () => {
  const before = formatPulse(summarizePulse([row({ ts: '2026-08-16T10:00:00.000Z' })]))
  const after = formatPulse(
    summarizePulse([row({ ts: '2026-08-16T10:00:00.000Z' }), row({ ts: '2026-08-16T10:05:00.000Z' })]),
  )
  assert.notEqual(after, before)
})

// Two identical questions a minute apart share no distinguishing text, so the
// count has to carry the difference on its own.
test('a repeat of the same question still changes the line', () => {
  const one = [row({ ts: '2026-08-16T10:00:00.000Z' })]
  const twice = [...one, row({ ts: '2026-08-16T10:01:00.000Z' })]
  assert.notEqual(formatPulse(summarizePulse(twice)), formatPulse(summarizePulse(one)))
})

test('an unparseable timestamp still counts but never becomes latest', () => {
  const p = summarizePulse([row({ ts: 'not a date' }), row({ ts: '2026-08-16T09:00:00.000Z' })])
  assert.equal(p.questions, 2)
  assert.equal(p.latestMs, Date.parse('2026-08-16T09:00:00.000Z'))
})

// Pins the line as a pure function of the rows. Anything wall-clock derived
// slipping into it would make every poll look like new activity.
test('the same rows always render the same line', () => {
  const rows = [row({ ts: '2026-08-16T10:00:00.000Z' }), row({ type: 'open' })]
  assert.equal(formatPulse(summarizePulse(rows)), 'questions=1 latest=2026-08-16T10:00:00.000Z')
  assert.equal(formatPulse(summarizePulse(rows)), 'questions=1 latest=2026-08-16T10:00:00.000Z')
})
