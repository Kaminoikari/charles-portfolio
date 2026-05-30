// SSE client for POST /api/chat. The endpoint streams `token` events while the
// answer generates, then a final `done` event carrying the retrieved sources
// (and `error` on failure). We POST + read the response body as a stream rather
// than using EventSource because EventSource is GET-only.

import { useCallback, useRef, useState } from 'react'

export interface ChatSource {
  id: string
  title: string
  score: number
  locale: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  sources?: ChatSource[]
  error?: boolean
}

export type ChatStatus = 'idle' | 'streaming' | 'error'

interface SSEEvent {
  event: string
  data: unknown
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
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(
    async (question: string, errorText: string) => {
      const q = question.trim()
      if (!q || status === 'streaming') return

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Push the user message + an empty assistant message we'll fill as tokens arrive.
      setMessages((prev) => [...prev, { role: 'user', text: q }, { role: 'assistant', text: '' }])
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
          body: JSON.stringify({ question: q }),
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
            } else if (ev.event === 'done') {
              const sources = (ev.data as { sources?: ChatSource[] }).sources ?? []
              patchAssistant((m) => ({ ...m, sources }))
            } else if (ev.event === 'error') {
              patchAssistant((m) => ({ ...m, text: errorText, error: true }))
            }
          }
        }
        setStatus('idle')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        patchAssistant((m) => ({ ...m, text: m.text || errorText, error: true }))
        setStatus('error')
      }
    },
    [status],
  )

  return { messages, status, send }
}
