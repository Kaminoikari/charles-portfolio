// Unit tests for the /api/chat pure helpers. No network/secrets:
//   npx tsx --test rag/api-helpers.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseChatRequest, sse, RateLimiter, clientId } from './api-helpers'

test('parseChatRequest: accepts and trims a valid question', () => {
  const r = parseChatRequest({ question: '  hello?  ' })
  assert.equal(r.ok, true)
  if (r.ok) assert.equal(r.question, 'hello?')
})

test('parseChatRequest: rejects non-object, missing, empty, oversize', () => {
  assert.equal(parseChatRequest(null).ok, false)
  assert.equal(parseChatRequest('nope').ok, false)
  assert.equal(parseChatRequest({}).ok, false)
  assert.equal(parseChatRequest({ question: '   ' }).ok, false)
  const big = parseChatRequest({ question: 'x'.repeat(1001) })
  assert.equal(big.ok, false)
  if (!big.ok) assert.equal(big.status, 413)
})

test('sse: frames event + json data with blank-line terminator', () => {
  assert.equal(sse('token', { t: 'hi' }), 'event: token\ndata: {"t":"hi"}\n\n')
})

test('RateLimiter: allows up to limit, then blocks within window', () => {
  const rl = new RateLimiter(2, 10_000)
  const t0 = 1_000_000
  assert.equal(rl.check('ip', t0).allowed, true)
  assert.equal(rl.check('ip', t0 + 1).allowed, true)
  const blocked = rl.check('ip', t0 + 2)
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.retryAfter >= 1)
})

test('RateLimiter: window slides — old hits expire', () => {
  const rl = new RateLimiter(1, 10_000)
  const t0 = 2_000_000
  assert.equal(rl.check('ip', t0).allowed, true)
  assert.equal(rl.check('ip', t0 + 5_000).allowed, false) // still within window
  assert.equal(rl.check('ip', t0 + 10_001).allowed, true) // window passed
})

test('RateLimiter: keys are independent', () => {
  const rl = new RateLimiter(1, 10_000)
  const t0 = 3_000_000
  assert.equal(rl.check('a', t0).allowed, true)
  assert.equal(rl.check('b', t0).allowed, true) // different key, fresh budget
})

test('clientId: first x-forwarded-for ip, else unknown', () => {
  assert.equal(clientId({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }), '1.2.3.4')
  assert.equal(clientId({ 'x-forwarded-for': ['9.9.9.9'] }), '9.9.9.9')
  assert.equal(clientId({}), 'unknown')
})
