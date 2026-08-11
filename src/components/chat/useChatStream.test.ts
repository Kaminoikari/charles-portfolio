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

describe('useChatStream pipeline trace', () => {
  beforeEach(() => vi.restoreAllMocks())

  function run(frames: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: sseStream(frames) })) as unknown as typeof fetch,
    )
    return renderHook(() => useChatStream())
  }

  it('records each node in the order it ran, with its duration', async () => {
    const { result } = run([
      frame('node', { id: 'triage', status: 'start' }),
      frame('node', { id: 'triage', status: 'done', ms: 12 }),
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('node', { id: 'retrieve', status: 'done', ms: 176 }),
      frame('done', { sources: [], answer: 'ok' }),
    ])
    await act(async () => {
      await result.current.send('q', 'error')
    })

    expect(result.current.trace.map((s) => [s.id, s.status, s.ms])).toEqual([
      ['triage', 'done', 12],
      ['retrieve', 'done', 176],
    ])
  })

  it('marks the node currently running', async () => {
    // A stream that stops mid-node: the last step must still read as running,
    // never silently as finished.
    const { result } = run([
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('node', { id: 'retrieve', status: 'done', ms: 90 }),
      frame('node', { id: 'generate', status: 'start' }),
      frame('done', { sources: [], answer: 'ok' }),
    ])
    await act(async () => {
      await result.current.send('q', 'error')
    })

    const last = result.current.trace.at(-1)
    expect(last?.id).toBe('generate')
    expect(last?.status).toBe('running')
  })

  // The corrective loop revisits retrieve, and that repeat is the interesting
  // part of the pipeline — collapsing it would hide the correction happening.
  it('keeps a revisited node as a separate step', async () => {
    const { result } = run([
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('node', { id: 'retrieve', status: 'done', ms: 100 }),
      frame('node', { id: 'rewriteQuery', status: 'start' }),
      frame('node', { id: 'rewriteQuery', status: 'done', ms: 300 }),
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('node', { id: 'retrieve', status: 'done', ms: 120 }),
      frame('done', { sources: [], answer: 'ok' }),
    ])
    await act(async () => {
      await result.current.send('q', 'error')
    })

    expect(result.current.trace.map((s) => s.id)).toEqual([
      'retrieve',
      'rewriteQuery',
      'retrieve',
    ])
    expect(result.current.trace.filter((s) => s.id === 'retrieve').map((s) => s.ms)).toEqual([100, 120])
  })

  // Asserting only the final state would pass even if sources still arrived
  // solely on `done`, since `done` carries the same list. The point of the early
  // event is the timing, so the stream is held open and inspected mid-flight.
  // Sibling of the test above, and it has to exist separately: there are two
  // routes that can put a repeat visit into the log — the `start` append, and
  // the fallback that logs a `done` arriving with no matching `start`. With
  // both present, removing either one alone still leaves the completed-loop
  // test passing, so neither is actually pinned. This one ends while the second
  // visit is still running, which only the `start` route can satisfy.
  it('logs a second visit to a node while it is still running', async () => {
    const { result } = run([
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('node', { id: 'retrieve', status: 'done', ms: 100 }),
      frame('node', { id: 'rewriteQuery', status: 'start' }),
      frame('node', { id: 'rewriteQuery', status: 'done', ms: 300 }),
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('done', { sources: [], answer: 'ok' }),
    ])
    await act(async () => {
      await result.current.send('q', 'error')
    })

    expect(result.current.trace.map((s) => [s.id, s.status])).toEqual([
      ['retrieve', 'done'],
      ['rewriteQuery', 'done'],
      ['retrieve', 'running'],
    ])
  })

  it('shows sources before the answer has streamed', async () => {
    const early = [{ id: 'a', title: 'USPACE', score: 0.9, locale: 'en' }]
    const enc = new TextEncoder()
    let push!: (f: string) => void
    let close!: () => void
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (f) => controller.enqueue(enc.encode(f))
        close = () => controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body })) as unknown as typeof fetch,
    )

    const { result } = renderHook(() => useChatStream())
    let sending!: Promise<void>
    await act(async () => {
      sending = result.current.send('q', 'error')
      push(frame('sources', { sources: early }))
      await new Promise((r) => setTimeout(r, 20))
    })

    const midFlight = result.current.messages.at(-1)
    expect(midFlight?.sources?.map((s) => s.title)).toEqual(['USPACE'])
    expect(midFlight?.text).toBe('')

    await act(async () => {
      push(frame('done', { sources: early, answer: 'He led it.' }))
      close()
      await sending
    })
    expect(result.current.messages.at(-1)?.text).toBe('He led it.')
  })

  it('starts each question from a clean trace', async () => {
    const { result } = run([
      frame('node', { id: 'triage', status: 'done', ms: 5 }),
      frame('done', { sources: [], answer: 'one' }),
    ])
    await act(async () => {
      await result.current.send('first', 'error')
    })
    expect(result.current.trace).toHaveLength(1)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: sseStream([
          frame('node', { id: 'retrieve', status: 'done', ms: 7 }),
          frame('done', { sources: [], answer: 'two' }),
        ]),
      })) as unknown as typeof fetch,
    )
    await act(async () => {
      await result.current.send('second', 'error')
    })
    expect(result.current.trace.map((s) => s.id)).toEqual(['retrieve'])
  })
})
