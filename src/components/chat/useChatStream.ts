// SSE client for POST /api/chat. The endpoint streams `token` events while the
// answer generates, then a final `done` event carrying the retrieved sources
// (and `error` on failure). We POST + read the response body as a stream rather
// than using EventSource because EventSource is GET-only.

import { useCallback, useRef, useState } from 'react'
import { getVisitorId } from './visitorId'

// Assistant answers are truncated: their topic disambiguates a follow-up, their
// full text is dead weight on a request that carries it every time.
//
// The turn COUNT is deliberately not trimmed here. The server numbers the
// visitor's questions from the start of what it receives (rag/history.ts) and
// marks the transcript partial when its own window drops turns — both of which
// are lies if the client silently dropped turns first. Trimming is the server's
// job, at a bound wider than the window it renders, so it can tell.
const HISTORY_ASSISTANT_CHARS = 300

function buildHistory(msgs: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return msgs
    .filter((m) => !m.error && m.text.trim())
    .map((m) => ({
      role: m.role,
      content: m.role === 'assistant' ? m.text.slice(0, HISTORY_ASSISTANT_CHARS) : m.text,
    }))
}

export interface ChatSource {
  id: string
  title: string
  score: number
  locale: string
  // Public page this source links to; absent/null when it has no page.
  url?: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  sources?: ChatSource[]
  error?: boolean
}

export type ChatStatus = 'idle' | 'streaming' | 'error'

// One pass through one graph node. The pipeline is not a fixed list of stages:
// triage can answer outright and skip retrieval entirely, and the corrective
// loop can send retrieve through a second time. So the trace is an ordered log
// of what actually ran — a revisited node is a separate step, not an update to
// the earlier one, because that repeat IS the correction worth showing.
export interface TraceStep {
  id: string
  status: 'running' | 'done'
  ms?: number
}

function applyNodeEvent(trace: TraceStep[], raw: unknown): TraceStep[] {
  if (typeof raw !== 'object' || raw === null) return trace
  const { id, status, ms } = raw as Record<string, unknown>
  if (typeof id !== 'string') return trace

  if (status === 'start') return [...trace, { id, status: 'running' }]
  if (status !== 'done') return trace

  const duration = typeof ms === 'number' && Number.isFinite(ms) ? ms : undefined
  // Close this node's open pass. Nodes run one at a time, so a corrective
  // loop's second visit only starts after the first has closed and there is at
  // most one open pass per id; scanning from the end just keeps that true if a
  // future graph ever overlaps them.
  for (let i = trace.length - 1; i >= 0; i--) {
    if (trace[i].id === id && trace[i].status === 'running') {
      const next = [...trace]
      next[i] = { id, status: 'done', ms: duration }
      return next
    }
  }
  // A done with no matching start (a truncated stream, an older server) still
  // belongs in the log rather than being dropped.
  return [...trace, { id, status: 'done', ms: duration }]
}

interface SSEEvent {
  event: string
  data: unknown
}

// Coerce the server's `done.sources` into well-formed ChatSource records. The
// payload is untrusted at the type level (parsed JSON), and the UI renders
// score.toFixed(2) — a missing/non-number score would throw during render and,
// with no error boundary above, blank the whole SPA. Drop malformed entries and
// default a non-numeric score to 0.
function toSources(raw: unknown): ChatSource[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((s): ChatSource[] => {
    if (typeof s !== 'object' || s === null) return []
    const { id, title, score, locale, url } = s as Record<string, unknown>
    if (typeof id !== 'string' || typeof title !== 'string') return []
    return [
      {
        id,
        title,
        score: typeof score === 'number' && Number.isFinite(score) ? score : 0,
        locale: typeof locale === 'string' ? locale : '',
        url: typeof url === 'string' && url ? url : null,
      },
    ]
  })
}

// Parse a chunk of the SSE byte stream into complete events. Returns the events
// found plus any trailing partial frame to carry into the next chunk.
function parseSSE(buffer: string): { events: SSEEvent[]; rest: string } {
  const events: SSEEvent[] = []
  const frames = buffer.split('\n\n')
  const rest = frames.pop() ?? '' // last item is incomplete unless buffer ended with \n\n
  for (const frame of frames) {
    let event = 'message'
    let data = ''
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (data) {
      try {
        events.push({ event, data: JSON.parse(data) })
      } catch {
        // ignore malformed frame
      }
    }
  }
  return { events, rest }
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [trace, setTrace] = useState<TraceStep[]>([])
  const abortRef = useRef<AbortController | null>(null)
  // Mirror of `messages` for reading the pre-send conversation inside send()
  // without adding `messages` to its dependency list (which would re-create the
  // callback on every token). Refs aren't reactive, so this is safe to read.
  const messagesRef = useRef<ChatMessage[]>([])
  messagesRef.current = messages

  const send = useCallback(
    async (question: string, errorText: string) => {
      const q = question.trim()
      if (!q || status === 'streaming') return

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Snapshot the conversation BEFORE appending this turn — that's the history
      // the server resolves the follow-up against (the current question is sent
      // separately as `question`, so it must not appear in `history`).
      const history = buildHistory(messagesRef.current)

      // Push the user message + an empty assistant message we'll fill as tokens arrive.
      setMessages((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', text: '' }])
      // Each question runs its own pipeline, so the trace starts empty rather
      // than accumulating across turns.
      setTrace([])
      setStatus('streaming')

      // Mutates the trailing assistant message in place (last array item).
      const patchAssistant = (fn: (m: ChatMessage) => ChatMessage) =>
        setMessages((prev) => {
          const next = [...prev]
          const i = next.length - 1
          if (i >= 0 && next[i].role === 'assistant') next[i] = fn(next[i])
          return next
        })

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q, visitorId: getVisitorId(), history }),
          signal: ctrl.signal,
        })
        if (!res.ok || !res.body) throw new Error(`chat request failed: ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let done = false

        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
          const parsed = parseSSE(buffer)
          buffer = parsed.rest
          for (const ev of parsed.events) {
            if (ev.event === 'token') {
              const t = (ev.data as { text?: string }).text ?? ''
              patchAssistant((m) => ({ ...m, text: m.text + t }))
            } else if (ev.event === 'node') {
              setTrace((prev) => applyNodeEvent(prev, ev.data))
            } else if (ev.event === 'sources') {
              // Retrieval has settled; show what it found without waiting for
              // the answer to finish streaming. `done` re-sends the same set as
              // the authoritative copy.
              const early = toSources((ev.data as { sources?: unknown }).sources)
              if (early.length > 0) patchAssistant((m) => ({ ...m, sources: early }))
            } else if (ev.event === 'done') {
              const data = ev.data as { sources?: unknown; answer?: string }
              const sources = toSources(data.sources)
              // `done.answer` is the server's single authoritative answer; the
              // streamed tokens are only an optimistic preview. Reconcile to the
              // authoritative answer here — otherwise a Gemini→Claude fallback
              // (which streams BOTH providers' tokens on the generate node) leaves
              // two answers concatenated in the bubble. Fall back to the streamed
              // text only if the server somehow sent no answer.
              patchAssistant((m) => ({ ...m, sources, text: data.answer || m.text || '' }))
            } else if (ev.event === 'error') {
              patchAssistant((m) => ({ ...m, text: errorText, error: true }))
            }
          }
        }
        // Never leave an empty assistant bubble (e.g. an unexpected empty done).
        patchAssistant((m) => (m.text ? m : { ...m, text: errorText, error: true }))
        setStatus('idle')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        patchAssistant((m) => ({ ...m, text: m.text || errorText, error: true }))
        setStatus('error')
      }
    },
    [status],
  )

  // Re-run the last question after a failure. Drops the trailing failed pair
  // (user + error assistant) so send() re-adds a fresh pair instead of leaving a
  // duplicate question bubble. Both functional updates apply in order.
  const retry = useCallback(
    (errorText: string) => {
      if (status === 'streaming') return
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      if (!lastUser) return
      setMessages((prev) => {
        let end = prev.length
        if (end > 0 && prev[end - 1].role === 'assistant') end -= 1
        if (end > 0 && prev[end - 1].role === 'user') end -= 1
        return prev.slice(0, end)
      })
      void send(lastUser.text, errorText)
    },
    [messages, send, status],
  )

  // Reset the conversation: abort any in-flight stream and drop all messages.
  const clear = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setTrace([])
    setStatus('idle')
  }, [])

  return { messages, status, trace, send, retry, clear }
}
