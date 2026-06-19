import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useChatStream } from './useChatStream'

// Build a ReadableStream that emits the given SSE frames then closes.
function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const f of frames) controller.enqueue(enc.encode(f))
      controller.close()
    },
  })
}

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

describe('useChatStream done reconciliation', () => {
  beforeEach(() => vi.restoreAllMocks())

  // Regression: a Gemini→Claude fallback streams tier-1 tokens AND tier-2 tokens
  // (both arrive on the generate node), so the raw token stream contains two
  // different answers. The server still reports a single authoritative answer in
  // the `done` event; the client must render THAT, not the concatenation.
  it('renders the authoritative done.answer, not the concatenated token stream', async () => {
    const frames = [
      frame('token', { text: 'GEMINI partial answer. ' }),
      frame('token', { text: 'CLAUDE full answer.' }),
      frame('done', { sources: [], answer: 'CLAUDE full answer.' }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: sseStream(frames) })) as unknown as typeof fetch,
    )

    const { result } = renderHook(() => useChatStream())
    await act(async () => {
      await result.current.send('what experiments did he run?', 'error')
    })

    const assistant = result.current.messages.at(-1)
    expect(assistant?.role).toBe('assistant')
    expect(assistant?.text).toBe('CLAUDE full answer.')
  })

  // Sanity: when there are no token events (e.g. the canned/fallback node returns
  // a static string), the done.answer must still populate the bubble.
  it('backfills from done.answer when no tokens streamed', async () => {
    const frames = [frame('done', { sources: [], answer: 'A canned answer.' })]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: sseStream(frames) })) as unknown as typeof fetch,
    )

    const { result } = renderHook(() => useChatStream())
    await act(async () => {
      await result.current.send('hello', 'error')
    })

    expect(result.current.messages.at(-1)?.text).toBe('A canned answer.')
  })
})
