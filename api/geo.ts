// GET /api/geo — tells the chat widget whether the visitor's region is served.
// The launcher stays clickable everywhere; a blocked region just opens to a
// disabled, "not available here" state. Geo comes from Vercel's edge header
// (x-vercel-ip-country), so this costs nothing extra and needs no datastore.
//
// The real gate lives in /api/chat (a direct API call can't bypass it). This
// endpoint only drives the widget's UI, so it can stay cheap and cacheable-per
// -request.
//
// It also doubles as the "chat opened" analytics beacon: the widget calls it
// exactly once per page session on first open, passing an anonymous visitor id
// (?vid=). We log that as a type:'open' row in chat_logs so opens (and unique
// openers) are countable without any third-party analytics plan — the insights
// report separates these from question rows.

import type { IncomingMessage, ServerResponse } from 'node:http'

import { clientCountry, clientId, isBlockedCountry } from '../rag/api-helpers.js'
import { logChatEvent } from '../rag/chatlog.js'

const BLOCKED_COUNTRIES = process.env.RAG_BLOCKED_COUNTRIES ?? 'CN'
const MAX_VISITOR_ID_LEN = 64

// Pull a sane ?vid= from the request URL, or undefined. Mirrors the visitor-id
// sanitising in api-helpers so a junk query string is never logged verbatim.
function visitorIdFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const raw = new URL(url, 'http://localhost').searchParams.get('vid')
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_VISITOR_ID_LEN) return undefined
  return trimmed
}

export default async function handler(
  req: IncomingMessage & { method?: string; url?: string; headers: Record<string, string | string[] | undefined> },
  res: ServerResponse,
) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const country = clientCountry(req.headers)
  const blocked = isBlockedCountry(country, BLOCKED_COUNTRIES)

  // Log the open event best-effort. Awaited before res.end() because the Vercel
  // instance freezes on return, which would sever a still-pending upsert.
  const ip = clientId(req.headers)
  const logged = logChatEvent({
    type: 'open',
    visitor_id: visitorIdFromUrl(req.url) ?? null,
    country: country || null,
    ip: ip === 'unknown' ? null : ip,
    blocked,
  })

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  await logged
  res.end(JSON.stringify({ blocked }))
}
