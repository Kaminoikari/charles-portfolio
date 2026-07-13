// POST /api/chat — the public RAG endpoint. Streams the answer over SSE while
// the corrective LangGraph pipeline runs, then logs the question for analytics.
//
// Vercel Node serverless function (same platform as the site, so the widget
// calls it same-origin — no CORS). Needs GEMINI_API_KEY / ANTHROPIC_API_KEY /
// EMBEDDING_API_KEY / QDRANT_* at runtime; see docs/rag-chatbot-design.md §10.

import type { IncomingMessage, ServerResponse } from 'node:http'

import { streamAnswer } from '../rag/graph.js'
import { logChatEvent } from '../rag/chatlog.js'
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

export default async function handler(req: IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('Allow', 'POST')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // Captured once: gates blocked regions AND is logged on each question event so
  // the by-day insights view can show where every asker came from (open events
  // are too rare to join against — most questions carry no visitor_id at all).
  const country = clientCountry(req.headers)
  if (isBlockedCountry(country, BLOCKED_COUNTRIES)) {
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
  // Held so we can await the analytics upsert before res.end(): the serverless
  // instance freezes on return, so a fire-and-forget upsert would be cut off.
  let logged: Promise<void> = Promise.resolve()
  try {
    for await (const ev of streamAnswer(parsed.question)) {
      if (ev.type === 'token') {
        res.write(sse('token', { text: ev.text }))
      } else {
        res.write(sse('done', { sources: ev.sources, language: ev.language, answer: ev.answer }))
        logged = logChatEvent({
          type: 'question',
          question: parsed.question,
          // Persist the full answer so chat_logs holds complete Q&A transcripts,
          // not just the questions. Same text already streamed to the visitor
          // (the `done` event above), captured here before the instance freezes.
          answer: ev.answer,
          language: ev.language,
          // The graph's own terminal outcome (canned | faq | generate | blocked
          // | fallback) — NOT re-derived from sources.length, which mislabeled
          // every canned/FAQ answer (sources: []) as a fallback.
          route: ev.outcome,
          loops: ev.loops,
          latency_ms: Date.now() - started,
          sources: ev.sources,
          visitor_id: parsed.visitorId ?? null,
          country: country || null,
          // `id` is the client IP (clientId = first x-forwarded-for hop), already
          // computed above for rate-limiting. 'unknown' in local dev → null.
          ip: id === 'unknown' ? null : id,
        })
      }
    }
  } catch (err) {
    res.write(sse('error', { message: 'Generation failed. Please try again.' }))
    console.error('chat handler error:', err)
  } finally {
    await logged
    res.end()
  }
}
