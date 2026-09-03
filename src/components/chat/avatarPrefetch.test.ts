// The cache warm-up is a plain GET the engine's loader later finds in the HTTP
// cache. What can go wrong is on this side: firing it twice for one body
// (hover, then focus, then hover again is three events), or never again after
// a failure.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { prefetchBody, resetPrefetchForTests } from './avatarPrefetch'

const URL_A = '/avatar/a.vrm'

function fetching(outcome: 'ok' | 'not-ok' | 'reject') {
  return vi.fn(() =>
    outcome === 'reject'
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({ ok: outcome === 'ok' } as Response),
  ) as unknown as typeof fetch
}

beforeEach(resetPrefetchForTests)

describe('prefetchBody', () => {
  it('fetches a body once, at low priority, however often it is asked', async () => {
    const f = fetching('ok')
    prefetchBody(URL_A, f)
    prefetchBody(URL_A, f)
    await Promise.resolve()
    prefetchBody(URL_A, f)
    expect(f).toHaveBeenCalledTimes(1)
    expect(f).toHaveBeenCalledWith(URL_A, { priority: 'low' })
  })

  it('forgets a failed fetch so the next hover tries again', async () => {
    const rejected = fetching('reject')
    prefetchBody(URL_A, rejected)
    await new Promise((r) => setTimeout(r, 0))
    const notOk = fetching('not-ok')
    prefetchBody(URL_A, notOk)
    await new Promise((r) => setTimeout(r, 0))
    const ok = fetching('ok')
    prefetchBody(URL_A, ok)
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(notOk).toHaveBeenCalledTimes(1)
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('does nothing, quietly, where there is no fetch', () => {
    expect(() => prefetchBody(URL_A, undefined)).not.toThrow()
  })
})
