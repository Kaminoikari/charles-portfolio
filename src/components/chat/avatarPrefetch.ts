// Warms the HTTP cache for a body the visitor is about to pick.
//
// /avatar/* is served immutable, so a plain GET here is what the engine's own
// loader finds when the tap lands: the swap then costs a parse, not a
// download. It fires on hover or focus of a look chip rather than for everyone
// on page load, because a body is 5.5MB (and an outfit can be twice that) and
// most visitors never touch the strip.
const warmed = new Set<string>()

export function prefetchBody(url: string, fetchFn: typeof fetch | undefined = globalThis.fetch): void {
  if (warmed.has(url) || typeof fetchFn !== 'function') return
  warmed.add(url)
  // Low priority so it never competes with a clip or an answer in flight. The
  // response body is dropped; only the cache entry matters. A failed fetch is
  // forgotten so the next hover tries again.
  fetchFn(url, { priority: 'low' }).then(
    (r) => {
      if (!r.ok) warmed.delete(url)
    },
    () => warmed.delete(url),
  )
}

/** Test seam: the set is module state, and tests share the module. */
export function resetPrefetchForTests(): void {
  warmed.clear()
}
