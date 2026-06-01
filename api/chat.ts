// POST /api/chat — the public RAG endpoint. Streams the answer over SSE while
// the corrective LangGraph pipeline runs, then logs the question for analytics.
//
// Vercel Node serverless function (same platform as the site, so the widget
// calls it same-origin — no CORS). Needs GEMINI_API_KEY / ANTHROPIC_API_KEY /
// EMBEDDING_API_KEY / QDRANT_* at runtime; see docs/rag-chatbot-design.md §10.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

import { streamAnswer } from '../rag/graph.js'
import { config } from '../rag/config.js'
import { qdrant, DENSE } from '../rag/qdrant.js'
import { parseChatRequest, sse, RateLimiter, clientId, clientCountry, isBlockedCountry } from '../rag/api-helpers.js'

// One limiter per warm instance (see api-helpers note re: Upstash for global).
const limiter = new RateLimiter(
  Number.parseInt(process.env.RAG_RATE_LIMIT ?? '20', 10),
  Number.parseInt(process.env.RAG_RATE_WINDOW_MS ?? '60000', 10),
)

// Region gate. Comma-separated ISO alpha-2 codes (default: CN). Enforced here
// too, not just in the widget, so a direct API call can't bypass the block.
const BLOCKED_COUNTRIES = process.env.RAG_BLOCKED_COUNTRIES ?? 'CN'

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Fire-and-forget analytics. Never blocks or fails the response. The log point
// carries a size-1 dummy vector (chat_logs is only ever scrolled, not searched)
// so logging costs no extra embedding call.
function logChat(payload: Record<string, unknown>): void {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) return
  // Best-effort: attach .catch so a rejected upsert can't surface as an
  // Unhandled Rejection. A bare `void promise` does NOT swallow async
  // rejections — the try/catch only ever caught synchronous throws.
  qdrant()
    .upsert(config.qdrantLogsCollection, {
      // Dummy vector must be non-zero: chat_logs uses Cosine distance, and the
      // cosine of an all-zero vector is undefined (norm 0), so Qdrant rejects
      // [0]. [1] has norm 1 and passes. (chat_logs is only ever scrolled, never
      // similarity-searched, so the value is irrelevant beyond being valid.)
      points: [{ id: randomUUID(), vector: { [DENSE]: [1] }, payload: { ...payload, ts: new Date().toISOString() } }],
    })
    .catch((err) => console.warn('chat_logs upsert failed (non-fatal):', (err as Error).message))
}

export default async function handler(req: IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  if (isBlockedCountry(clientCountry(req.headers), BLOCKED_COUNTRIES)) {
    res.statusCode = 403
    res.end(JSON.stringify({ error: 'region_not_supported' }))
    return
  }

  const id = clientId(req.headers)
  const gate = limiter.check(id)
  if (!gate.allowed) {
    res.statusCode = 429
    res.setHeader('Retry-After', String(gate.retryAfter))
    res.end(JSON.stringify({ error: 'Too many requests', retryAfter: gate.retryAfter }))
    return
  }

  const parsed = parseChatRequest(await readBody(req))
  if (!parsed.ok) {
    res.statusCode = parsed.status
    res.end(JSON.stringify({ error: parsed.message }))
    return
  }

  // SSE headers.
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')

  const started = Date.now()
  try {
    for await (const ev of streamAnswer(parsed.question)) {
      if (ev.type === 'token') {
        res.write(sse('token', { text: ev.text }))
      } else {
        res.write(sse('done', { sources: ev.sources, language: ev.language, answer: ev.answer }))
        logChat({
          question: parsed.question,
          language: ev.language,
          route: ev.sources.length > 0 ? 'generate' : 'fallback',
          loops: ev.loops,
          latency_ms: Date.now() - started,
          sources: ev.sources,
        })
      }
    }
  } catch (err) {
    res.write(sse('error', { message: 'Generation failed. Please try again.' }))
    console.error('chat handler error:', err)
  } finally {
    res.end()
  }
}
