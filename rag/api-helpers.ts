// Pure, testable helpers for the /api/chat serverless function. Kept separate
// from the handler so request validation, SSE framing, and rate limiting can be
// unit-tested with no network or runtime.

export interface ParsedRequest {
  ok: true
  question: string
}
export interface ParseError {
  ok: false
  status: number
  message: string
}

const MAX_QUESTION_LEN = 50

// Validate and normalize an incoming chat request body.
export function parseChatRequest(body: unknown): ParsedRequest | ParseError {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, status: 400, message: 'Body must be a JSON object.' }
  }
  const q = (body as Record<string, unknown>).question
  if (typeof q !== 'string') {
    return { ok: false, status: 400, message: 'Field "question" (string) is required.' }
  }
  const trimmed = q.trim()
  if (trimmed.length === 0) {
    return { ok: false, status: 400, message: 'Question must not be empty.' }
  }
  if (trimmed.length > MAX_QUESTION_LEN) {
    return { ok: false, status: 413, message: `Question exceeds ${MAX_QUESTION_LEN} characters.` }
  }
  return { ok: true, question: trimmed }
}

// Server-Sent Events frame. Each event is `event: <name>\ndata: <json>\n\n`.
export function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// Best-effort in-memory sliding-window rate limiter, keyed by client id (IP).
// Serverless instances are ephemeral, so this caps abuse per warm instance
// rather than globally — the honest production upgrade is Upstash Redis (noted
// in the design doc). Returned `retryAfter` is seconds until the window frees.
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): { allowed: boolean; retryAfter: number } {
    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff)
    if (recent.length >= this.limit) {
      const retryAfter = Math.ceil((recent[0] + this.windowMs - now) / 1000)
      return { allowed: false, retryAfter: Math.max(1, retryAfter) }
    }
    recent.push(now)
    this.hits.set(key, recent)
    return { allowed: true, retryAfter: 0 }
  }
}

// Pull a client identifier from proxy headers (Vercel sets x-forwarded-for).
export function clientId(headers: Record<string, string | string[] | undefined>): string {
  const fwd = headers['x-forwarded-for']
  const raw = Array.isArray(fwd) ? fwd[0] : fwd
  return (raw?.split(',')[0]?.trim()) || 'unknown'
}

// ISO-3166-1 alpha-2 country of the request, from Vercel's edge geo header
// (x-vercel-ip-country, set on every request at no extra cost). Returns '' when
// unknown (local dev, or the header is absent) so an unknown origin is never
// treated as blocked.
export function clientCountry(headers: Record<string, string | string[] | undefined>): string {
  const c = headers['x-vercel-ip-country']
  const raw = Array.isArray(c) ? c[0] : c
  return (raw ?? '').trim().toUpperCase()
}

// Whether a country sits on the comma-separated blocklist (ISO alpha-2 codes,
// e.g. "CN" or "CN,HK"). An empty/unknown country is never blocked.
export function isBlockedCountry(country: string, blocklist: string): boolean {
  const code = country.trim().toUpperCase()
  if (!code) return false
  return blocklist
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .includes(code)
}
