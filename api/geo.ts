// GET /api/geo — tells the chat widget whether the visitor's region is served.
// The launcher stays clickable everywhere; a blocked region just opens to a
// disabled, "not available here" state. Geo comes from Vercel's edge header
// (x-vercel-ip-country), so this costs nothing extra and needs no datastore.
//
// The real gate lives in /api/chat (a direct API call can't bypass it). This
// endpoint only drives the widget's UI, so it can stay cheap and cacheable-per
// -request.

import type { IncomingMessage, ServerResponse } from 'node:http'

import { clientCountry, isBlockedCountry } from '../rag/api-helpers.js'

const BLOCKED_COUNTRIES = process.env.RAG_BLOCKED_COUNTRIES ?? 'CN'

export default function handler(
  req: IncomingMessage & { method?: string; headers: Record<string, string | string[] | undefined> },
  res: ServerResponse,
) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const blocked = isBlockedCountry(clientCountry(req.headers), BLOCKED_COUNTRIES)
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ blocked }))
}
