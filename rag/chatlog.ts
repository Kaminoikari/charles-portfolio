// Shared best-effort writer for the chat_logs analytics collection — the "free
// product analytics" pipeline. Both /api/chat (question events) and /api/geo
// (chat-opened events) append here, discriminated by a `type` field on the
// payload ('question' | 'open'); rows logged before this field existed are
// treated as questions by the insights report.
//
// Never throws: a rejected upsert is logged and swallowed. Returns the in-flight
// promise so a serverless handler can AWAIT it before returning — on Vercel the
// instance is frozen the moment the handler returns, which would sever a still
// -pending upsert (the cause of past "chat_logs upsert failed" warnings).

import { randomUUID } from 'node:crypto'

import { config } from './config.js'
import { qdrant, DENSE } from './qdrant.js'

export function logChatEvent(payload: Record<string, unknown>): Promise<void> {
  if (!config.qdrantUrl || !process.env.QDRANT_API_KEY) return Promise.resolve()
  return qdrant()
    .upsert(config.qdrantLogsCollection, {
      // Dummy size-1 vector: chat_logs is only ever scrolled, never similarity
      // -searched. It must be non-zero — chat_logs uses Cosine distance and the
      // cosine of an all-zero vector is undefined (norm 0), so Qdrant rejects
      // [0]; [1] has norm 1 and passes.
      points: [{ id: randomUUID(), vector: { [DENSE]: [1] }, payload: { ...payload, ts: new Date().toISOString() } }],
    })
    .then(() => undefined)
    .catch((err) => console.warn('chat_logs upsert failed (non-fatal):', (err as Error).message))
}
