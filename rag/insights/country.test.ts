// Guards the report's country column against the ambiguity that motivated it:
// a bare "IN" is unreadable at a glance (India vs Indonesia's "ID"), so every
// insights surface renders the resolved name instead of the raw code.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { countryLabel } from './country.js'

test('the confusable alpha-2 pair resolves to distinct names', () => {
  assert.equal(countryLabel('IN'), 'India')
  assert.equal(countryLabel('ID'), 'Indonesia')
})

test('common visitor origins resolve to readable names', () => {
  assert.equal(countryLabel('TW'), 'Taiwan')
  assert.equal(countryLabel('US'), 'United States')
})

test('a missing country renders as Unknown rather than an empty column', () => {
  assert.equal(countryLabel(''), 'Unknown')
  assert.equal(countryLabel(null), 'Unknown')
})

// The requirement is that the column is never empty and never throws, whatever
// the header carried. ICU splits these cases: it maps 'ZZ' to a readable
// placeholder, echoes an unassigned-but-well-formed code like 'QQ', and throws
// RangeError on anything malformed.
test('an unresolvable code still yields readable, non-empty text', () => {
  assert.equal(countryLabel('ZZ'), 'Unknown Region')
  assert.equal(countryLabel('QQ'), 'QQ')
})

test('a malformed code falls back to the raw value instead of throwing', () => {
  assert.equal(countryLabel('not-a-code'), 'not-a-code')
})
