// Pure, testable helpers for the /api/chat serverless function. Kept separate
// from the handler so request validation, SSE framing, and rate limiting can be
// unit-tested with no network or runtime.

// One prior conversation turn, sent by the client so the server can resolve
// follow-up questions against recent context (see rag/contextualize.ts).
export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedRequest {
  ok: true
  question: string
  // Anonymous client id (see src/components/chat/visitorId.ts), used only to
  // distinguish unique visitors from raw question counts in chat_logs. Optional:
  // an old client or a bad value simply omits it — it never fails the request.
  visitorId?: string
  // Recent conversation turns (oldest → newest), already trimmed to a small
  // budget. Undefined for the first turn or an old client. Like visitorId, a
  // malformed value is dropped, never a request error.
  history?: ChatTurn[]
}
export interface ParseError {
  ok: false
  status: number
  message: string
}

const MAX_QUESTION_LEN = 200
const MAX_VISITOR_ID_LEN = 64
// Bound the transport server-side regardless of what the client sends. This is
// a payload limit, NOT the memory window: the prompts render the last 16 turns
// (rag/nodes.ts), and this has to stay comfortably wider than that so
// formatHistory can see that turns fell off and say so. When the two were both
// 16 the "(earlier turns are not shown)" marker could never fire, and a
// transcript whose oldest visible line was the visitor's third question was
// numbered as their first. 60 turns is thirty exchanges. Each turn is capped
// too, so a pasted wall of text cannot blow up the prompts this rides on.
const MAX_HISTORY_TURNS = 60
const MAX_TURN_LEN = 500

// Accept a client-supplied visitor id only if it is a plausibly-sane string
// (a UUID is 36 chars); anything else is dropped rather than logged verbatim.
function sanitizeVisitorId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_VISITOR_ID_LEN) return undefined
  return trimmed
}

// Coerce a client-supplied history array into well-formed, budget-capped turns.
// Anything malformed is dropped silently (never a request error); returns
// undefined when nothing usable survives so callers can treat it as "no history".
function sanitizeHistory(raw: unknown): ChatTurn[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const turns: ChatTurn[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { role, content } = item as Record<string, unknown>
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string') continue
    const trimmed = content.trim()
    if (!trimmed) continue
    turns.push({ role, content: trimmed.slice(0, MAX_TURN_LEN) })
  }
  return turns.length ? turns.slice(-MAX_HISTORY_TURNS) : undefined
}

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
  return {
    ok: true,
    question: trimmed,
    visitorId: sanitizeVisitorId((body as Record<string, unknown>).visitorId),
    history: sanitizeHistory((body as Record<string, unknown>).history),
  }
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
