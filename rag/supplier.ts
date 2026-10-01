// The boundary between this pipeline and the two services it cannot answer
// without: Voyage (query embedding, rerank) and Qdrant (the index).
//
// Every call that answers a visitor goes through callSupplier: the FAQ probe,
// the query embedding, the candidate query and the rerank. The analytics write
// in chatlog.ts does not, on purpose: a failed log write must not open the
// circuit and turn the next visitor's answer into an outage. callSupplier does
// three things the callers used to do inconsistently or not at all:
//
//   1. Classifies. Anything thrown inside the call is the supplier's failure
//      and comes out as a SupplierError. That matters because Node's fetch
//      reports a network-level outage (DNS, refused connection) as
//      `TypeError: fetch failed`, and the retrieve node treats a TypeError as
//      our own bug and rethrows it. So a store that was unreachable, the outage
//      the unavailable node exists for, ended the request as a generic stream
//      error. Callers now decide on `instanceof SupplierError`, never on the
//      shape of an error the platform happened to pick.
//   2. Retries once, for failures that a second attempt can fix: the network
//      dropped, or the supplier said 429/5xx. Not a timeout, which has already
//      spent the whole budget, and not a 4xx, which will say the same again.
//   3. Breaks the circuit. A supplier that has just failed is skipped for a
//      cooldown, per instance. Without it one Voyage outage cost a visitor two
//      full timeouts in a row: the FAQ probe's embed, then retrieve's embed of
//      the same text, before the degraded path got a chance to run.

import { config } from './config.js'

export type SupplierName = 'voyage' | 'qdrant'

export class SupplierError extends Error {
  readonly supplier: SupplierName
  readonly transient: boolean
  constructor(supplier: SupplierName, message: string, transient: boolean, options?: { cause?: unknown }) {
    super(`${supplier}: ${message}`, options)
    this.name = 'SupplierError'
    this.supplier = supplier
    this.transient = transient
  }
}

// An HTTP failure a supplier reported in its response, thrown from inside a
// call so the status reaches the classifier.
export class SupplierHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'SupplierHttpError'
    this.status = status
  }
}

function statusOf(err: unknown): number | undefined {
  if (err instanceof SupplierHttpError) return err.status
  // The Qdrant client's ApiError carries the response status as `status`.
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === 'number' ? s : undefined
}

function isTimeout(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name
  return name === 'TimeoutError' || name === 'AbortError'
}

export function isTransient(err: unknown): boolean {
  if (isTimeout(err)) return false
  const status = statusOf(err)
  if (status !== undefined) return status === 429 || status >= 500
  // No status and not a timeout: the request never got an answer (fetch's
  // "fetch failed", a reset socket). Worth one more try.
  return true
}

// Per-instance, which on serverless is the right scope: an instance that has
// just seen Voyage fail is the one about to ask it again.
const openUntil = new Map<SupplierName, number>()

export function __resetBreakers(): void {
  openUntil.clear()
}

export interface SupplierDeps {
  now: () => number
  sleep: (ms: number) => Promise<void>
}

const DEFAULT_SUPPLIER_DEPS: SupplierDeps = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

export async function callSupplier<T>(
  supplier: SupplierName,
  fn: () => Promise<T>,
  deps: SupplierDeps = DEFAULT_SUPPLIER_DEPS,
): Promise<T> {
  const until = openUntil.get(supplier) ?? 0
  if (deps.now() < until) {
    throw new SupplierError(supplier, `circuit open for ${until - deps.now()}ms after a failure`, true)
  }
  const fail = (err: unknown): never => {
    openUntil.set(supplier, deps.now() + config.supplierCooldownMs)
    throw new SupplierError(supplier, (err as Error)?.message ?? String(err), isTransient(err), { cause: err })
  }
  try {
    const out = await fn()
    openUntil.delete(supplier)
    return out
  } catch (first) {
    if (!isTransient(first)) return fail(first)
  }
  await deps.sleep(config.supplierRetryBackoffMs)
  try {
    const out = await fn()
    openUntil.delete(supplier)
    return out
  } catch (second) {
    return fail(second)
  }
}
