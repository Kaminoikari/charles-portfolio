// The supplier boundary: classification, one retry, circuit breaker. No network:
//   npx tsx --test rag/supplier.test.ts

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import { callSupplier, isTransient, SupplierError, SupplierHttpError, __resetBreakers } from './supplier.js'
import { config } from './config.js'

// A controllable clock and a sleep that only records, so the breaker's cooldown
// and the retry's pause are exercised without waiting for either.
function clock() {
  let t = 1_000_000
  const sleeps: number[] = []
  return {
    sleeps,
    advance: (ms: number) => (t += ms),
    deps: { now: () => t, sleep: async (ms: number) => void sleeps.push(ms) },
  }
}

function calls<T>(...results: (T | Error)[]) {
  let n = 0
  const fn = async () => {
    const r = results[Math.min(n++, results.length - 1)]
    if (r instanceof Error) throw r
    return r
  }
  return { fn, count: () => n }
}

const networkDown = () => new TypeError('fetch failed')
const timeout = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })

beforeEach(() => __resetBreakers())

test('a network-level failure comes out as the supplier\'s, not as a TypeError', async () => {
  // Node's fetch reports DNS failures and refused connections as
  // `TypeError: fetch failed`, measured against both the Qdrant client and bare
  // fetch. The retrieve node rethrows TypeErrors as our own bugs, so before this
  // boundary an unreachable store skipped the outage reply entirely.
  const c = clock()
  const err = await callSupplier('qdrant', calls<number>(networkDown()).fn, c.deps).catch((e: unknown) => e)
  assert.ok(err instanceof SupplierError, 'err instanceof SupplierError')
  assert.equal(err instanceof TypeError, false)
  assert.equal(err.supplier, 'qdrant')
})

test('a failure a retry can fix is retried once, after the backoff', async () => {
  const c = clock()
  const call = calls<number>(networkDown(), 42)
  assert.equal(await callSupplier('voyage', call.fn, c.deps), 42)
  assert.equal(call.count(), 2)
  assert.deepEqual(c.sleeps, [config.supplierRetryBackoffMs])
})

test('only once: a second failure is final', async () => {
  const c = clock()
  const call = calls<number>(networkDown(), networkDown(), 42)
  await assert.rejects(callSupplier('voyage', call.fn, c.deps), SupplierError)
  assert.equal(call.count(), 2)
})

test('a timeout and a 4xx are not retried', async () => {
  for (const err of [timeout(), new SupplierHttpError(401, 'unauthorized')]) {
    __resetBreakers()
    const c = clock()
    const call = calls<number>(err, 42)
    await assert.rejects(callSupplier('voyage', call.fn, c.deps), SupplierError)
    assert.equal(call.count(), 1, err.message)
  }
})

test('which failures count as transient', () => {
  assert.equal(isTransient(new SupplierHttpError(429, '')), true)
  assert.equal(isTransient(new SupplierHttpError(503, '')), true)
  assert.equal(isTransient(new SupplierHttpError(400, '')), false)
  assert.equal(isTransient(Object.assign(new Error('x'), { status: 502 })), true)
  assert.equal(isTransient(networkDown()), true)
  assert.equal(isTransient(timeout()), false)
})

test('after a failure the supplier is skipped for the cooldown, without being called', async () => {
  const c = clock()
  await assert.rejects(callSupplier('voyage', calls<number>(timeout()).fn, c.deps))
  const next = calls<number>(42)
  await assert.rejects(callSupplier('voyage', next.fn, c.deps), /circuit open/)
  assert.equal(next.count(), 0)
  // One supplier's outage does not close the other.
  assert.equal(await callSupplier('qdrant', calls<number>(7).fn, c.deps), 7)
})

test('the circuit closes once the cooldown has passed', async () => {
  const c = clock()
  await assert.rejects(callSupplier('voyage', calls<number>(timeout()).fn, c.deps))
  c.advance(config.supplierCooldownMs - 1)
  await assert.rejects(callSupplier('voyage', calls<number>(42).fn, c.deps), /circuit open/)
  c.advance(1)
  assert.equal(await callSupplier('voyage', calls<number>(42).fn, c.deps), 42)
})

test('a 4xx does not open the circuit: the supplier answered, only that request was wrong', async () => {
  // The FAQ probe and retrieval share the qdrant circuit. A 404 from a missing
  // FAQ collection, or a 400 from one built before its sparse vector, used to
  // open it, so retrieve then failed fast and every visitor got the outage reply
  // for as long as the FAQ side stayed broken.
  const c = clock()
  for (const status of [400, 404]) {
    await assert.rejects(callSupplier('qdrant', calls<number>(new SupplierHttpError(status, 'no such collection')).fn, c.deps))
    const next = calls<number>(42)
    assert.equal(await callSupplier('qdrant', next.fn, c.deps), 42, `after a ${status}`)
    assert.equal(next.count(), 1)
  }
})

test('a supplier that cannot be reached opens the circuit, whether it timed out or the retry failed too', async () => {
  for (const err of [timeout(), networkDown(), new SupplierHttpError(503, 'unavailable')]) {
    __resetBreakers()
    const c = clock()
    await assert.rejects(callSupplier('voyage', calls<number>(err).fn, c.deps))
    await assert.rejects(callSupplier('voyage', calls<number>(42).fn, c.deps), /circuit open/, err.message)
  }
})
