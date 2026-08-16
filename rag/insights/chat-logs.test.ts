// The report epoch is the entire mechanism for "start fresh, stop showing the
// old conversations" — nothing is deleted, so if this boundary is off by a
// timezone the old era silently reappears in the daily email. No secrets /
// network:  npm run rag:test

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { REPORT_EPOCH_MS, withinReportWindow } from './chat-logs.js'

const epochIso = new Date(REPORT_EPOCH_MS).toISOString()

test('the epoch sits at a Taipei midnight', () => {
  const taipeiHour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(REPORT_EPOCH_MS))
  assert.equal(taipeiHour, '00:00', `epoch ${epochIso} is not a Taipei midnight`)
})

// Pins the reset itself, not just its arithmetic. Every test below is written
// relative to REPORT_EPOCH_MS and so would survive the constant sliding back to
// a previous era; this one would not. Update it deliberately when resetting.
test('the current reset starts on 2026-08-16 (Taipei)', () => {
  const taipeiDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date(REPORT_EPOCH_MS))
  assert.equal(taipeiDate, '2026-08-16')
  // Conversations logged before the reset stay in chat_logs but must not surface.
  assert.equal(withinReportWindow('2026-08-15T09:33:00.000Z'), false)
  assert.equal(withinReportWindow('2026-08-14T09:33:00.000Z'), false)
  assert.equal(withinReportWindow('2026-07-27T02:11:00.000Z'), false)
  assert.equal(withinReportWindow('2026-07-13T05:00:00.000Z'), false)
})

test('a conversation from the day before the epoch is hidden', () => {
  const dayBefore = REPORT_EPOCH_MS - 1
  assert.equal(withinReportWindow(new Date(dayBefore).toISOString()), false)
  assert.equal(withinReportWindow(new Date(REPORT_EPOCH_MS - 86_400_000).toISOString()), false)
})

test('a conversation at or after the epoch is shown', () => {
  assert.equal(withinReportWindow(epochIso), true)
  assert.equal(withinReportWindow(new Date(REPORT_EPOCH_MS + 60_000).toISOString()), true)
})

// Rows are written as UTC ISO strings, so the cut has to be applied on the
// instant, not on a naive date string.
test('the cut is applied on the instant, not the calendar-date text', () => {
  const justAfter = new Date(REPORT_EPOCH_MS + 1000).toISOString()
  assert.ok(justAfter.endsWith('Z'))
  assert.equal(withinReportWindow(justAfter), true)
  assert.equal(withinReportWindow(new Date(REPORT_EPOCH_MS - 1000).toISOString()), false)
})

test('a missing or unparseable timestamp is never shown', () => {
  assert.equal(withinReportWindow(null), false)
  assert.equal(withinReportWindow(undefined), false)
  assert.equal(withinReportWindow(''), false)
  assert.equal(withinReportWindow('not a date'), false)
})
