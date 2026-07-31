// Unit tests for the /api/chat pure helpers. No network/secrets:
//   npx tsx --test rag/api-helpers.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseChatRequest, sse, RateLimiter, clientId, clientCountry, isBlockedCountry } from './api-helpers.js'

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
  // Limit is 200 chars: 200 passes, 201 is rejected with 413.
  assert.equal(parseChatRequest({ question: 'x'.repeat(200) }).ok, true)
  const big = parseChatRequest({ question: 'x'.repeat(201) })
  assert.equal(big.ok, false)
  if (!big.ok) assert.equal(big.status, 413)
})

test('parseChatRequest: keeps a sane visitorId, drops bad ones, never rejects', () => {
  const ok = parseChatRequest({ question: 'hi', visitorId: '  abc-123  ' })
  assert.equal(ok.ok, true)
  if (ok.ok) assert.equal(ok.visitorId, 'abc-123') // trimmed

  const none = parseChatRequest({ question: 'hi' })
  assert.equal(none.ok, true)
  if (none.ok) assert.equal(none.visitorId, undefined)

  // Bad values are dropped, not fatal: the request still parses ok.
  for (const bad of [123, '', '   ', 'x'.repeat(65)]) {
    const r = parseChatRequest({ question: 'hi', visitorId: bad })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.visitorId, undefined)
  }
})

test('parseChatRequest: keeps valid history, clamps size, drops junk, never rejects', () => {
  const ok = parseChatRequest({
    question: 'and there?',
    history: [
      { role: 'user', content: '  他在 USPACE 做了什麼?  ' },
      { role: 'assistant', content: 'He led the parking product.' },
    ],
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.history?.length, 2)
    assert.equal(ok.history?.[0].content, '他在 USPACE 做了什麼?') // trimmed
    assert.equal(ok.history?.[0].role, 'user')
  }

  // Malformed entries are dropped, not fatal.
  const mixed = parseChatRequest({
    question: 'hi',
    history: [
      { role: 'system', content: 'x' }, // bad role → dropped
      { role: 'user' }, // missing content → dropped
      { role: 'user', content: '   ' }, // empty → dropped
      'nope', // not an object → dropped
      { role: 'assistant', content: 'kept' },
    ],
  })
  assert.equal(mixed.ok, true)
  if (mixed.ok) {
    assert.equal(mixed.history?.length, 1)
    assert.equal(mixed.history?.[0].content, 'kept')
  }

  // Only the last 60 turns survive, and each is capped at 500 chars. The input
  // stays comfortably above the clamp so this keeps proving that it clamps.
  // 60 is the transport bound, not the memory window: the prompts render 16
  // turns, and this has to stay wider so formatHistory can see that turns fell
  // off. If they were equal again, its "(earlier turns are not shown)" marker
  // could never fire and its question numbering would silently restart at 1.
  const many = Array.from({ length: 80 }, (_, i) => ({ role: 'user' as const, content: `q${i}` }))
  const capped = parseChatRequest({ question: 'hi', history: many })
  assert.equal(capped.ok, true)
  if (capped.ok) {
    assert.equal(capped.history?.length, 60)
    assert.equal(capped.history?.[0].content, 'q20') // oldest kept is the 60th-from-last
  }
  const longTurn = parseChatRequest({ question: 'hi', history: [{ role: 'user', content: 'x'.repeat(600) }] })
  assert.equal(longTurn.ok, true)
  if (longTurn.ok) assert.equal(longTurn.history?.[0].content.length, 500)

  // No history / non-array → undefined, request still parses.
  for (const bad of [undefined, 'nope', 42, []]) {
    const r = parseChatRequest({ question: 'hi', history: bad })
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.history, undefined)
  }
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

test('clientCountry: reads vercel geo header, uppercases, else empty', () => {
  assert.equal(clientCountry({ 'x-vercel-ip-country': 'cn' }), 'CN')
  assert.equal(clientCountry({ 'x-vercel-ip-country': ['tw'] }), 'TW')
  assert.equal(clientCountry({}), '')
})

test('isBlockedCountry: matches blocklist, ignores case, never blocks unknown', () => {
  assert.equal(isBlockedCountry('CN', 'CN'), true)
  assert.equal(isBlockedCountry('cn', 'CN'), true) // case-insensitive on both sides
  assert.equal(isBlockedCountry('HK', 'CN,HK'), true)
  assert.equal(isBlockedCountry('TW', 'CN'), false)
  assert.equal(isBlockedCountry('', 'CN'), false) // unknown origin is never blocked
})
