// A stable, anonymous id sent with every chat question so the chat_logs
// analytics can tell unique visitors apart from raw question counts (one person
// asking five things is five log rows but one visitor). It is a random UUID with
// no PII, persisted in localStorage so it survives reloads and return visits.
//
// Storage can throw (Safari private mode, blocked cookies/storage): we fall back
// to an in-memory id so a request still carries a value — it just won't persist
// across reloads in that session.

const STORAGE_KEY = 'cc_chat_vid'

let memoryFallback: string | null = null

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    if (!memoryFallback) memoryFallback = crypto.randomUUID()
    return memoryFallback
  }
}
