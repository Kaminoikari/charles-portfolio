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

  // Only the last 60 turns survive.
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
  // A user turn stays on the low bound and, when clamped, says so. The two
  // roles get different bounds; that split has its own test below.
  const longTurn = parseChatRequest({ question: 'hi', history: [{ role: 'user', content: 'x'.repeat(600) }] })
  assert.equal(longTurn.ok, true)
  if (longTurn.ok) {
    assert.equal(longTurn.history?.[0].content.includes('x'.repeat(501)), false)
    assert.match(longTurn.history?.[0].content ?? '', /excerpt: first 500 of 600 chars/)
  }

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

// The transport used to clamp every turn at 500 chars, which on its own would
// have cut the ten-item list of the 2026-08-19 incident (649 chars) before the
// prompt was ever built. This bound is payload protection, not the memory
// window: it has to sit far above any answer the bot actually writes, so the
// single place that decides how much of a turn the prompt sees is
// formatHistory. What it does clamp carries the excerpt marker, so a shortened
// turn is never presented downstream as a whole one.
test('parseChatRequest: a real-length answer survives the transport, and a clamped one says so', () => {
  const real = 'a'.repeat(2000)
  const kept = parseChatRequest({ question: 'hi', history: [{ role: 'assistant', content: real }] })
  assert.equal(kept.ok, true)
  if (kept.ok) assert.equal(kept.history?.[0].content, real)

  const huge = 'b'.repeat(9000)
  const clamped = parseChatRequest({ question: 'hi', history: [{ role: 'assistant', content: huge }] })
  assert.equal(clamped.ok, true)
  if (clamped.ok) {
    assert.match(clamped.history?.[0].content ?? '', /excerpt: first 8000 of 9000 chars/)
    assert.equal((clamped.history?.[0].content ?? '').includes('b'.repeat(8001)), false)
  }
})

// The length bound is per role, because only one of the two roles is bounded
// anywhere else. A visitor's question is capped at MAX_QUESTION_LEN on the way
// in, so a user turn in history is a replay of something already ≤200 chars and
// 500 is generous. An ASSISTANT turn has no such upstream cap and is the thing
// the 2026-08-19 incident was about, so it gets room.
//
// Keeping them on one number is not a simplification, it is a hole:
// formatHistory clamps assistant turns and renders user turns whole, so the
// transport bound IS the prompt bound for user text. Raising both to 8000 let a
// crafted 60-turn body render a 128,957-char transcript, up from ~8,100 —
// measured, on a paid tier-2 fallback behind a 20-req/min limiter.
test('parseChatRequest: the length bound is per role, since only user turns are capped upstream', () => {
  const hostile = Array.from({ length: 60 }, () => ({ role: 'user' as const, content: 'x'.repeat(20000) }))
  const parsed = parseChatRequest({ question: 'hi', history: hostile })
  assert.equal(parsed.ok, true)
  if (parsed.ok) {
    // Comfortably above MAX_QUESTION_LEN, nowhere near the assistant bound.
    assert.ok((parsed.history?.[0].content.length ?? 0) <= 600, 'a user turn must stay near its upstream cap')
    assert.match(parsed.history?.[0].content ?? '', /excerpt: first 500 of 20000 chars/)
  }

  // The assistant bound is what the incident needed, and it is unaffected.
  const answer = 'b'.repeat(2000)
  const kept = parseChatRequest({ question: 'hi', history: [{ role: 'assistant', content: answer }] })
  assert.equal(kept.ok, true)
  if (kept.ok) assert.equal(kept.history?.[0].content, answer)
})
