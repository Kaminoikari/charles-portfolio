import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useChatStream, type TraceStep } from './useChatStream'

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

  // A stream held open so the trace can be inspected mid-run. Needed because a
  // finished stream has no `running` steps left by design — anything still open
  // when it ends is failed — so the running state only exists mid-flight.
  function openStream() {
    const enc = new TextEncoder()
    let push!: (f: string) => void
    let close!: () => void
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (f) => controller.enqueue(enc.encode(f))
        close = () => controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, body })) as unknown as typeof fetch)
    return { push, close, hook: renderHook(() => useChatStream()) }
  }

  const settle = () => new Promise((r) => setTimeout(r, 20))

  // Narrow to the done member so a duration can be read at all — the union is
  // what stops a cost being printed for a node that never reported one.
  const durations = (trace: readonly TraceStep[], id: string) =>
    trace.filter((s): s is Extract<TraceStep, { status: 'done' }> => s.status === 'done' && s.id === id).map((s) => s.ms)

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

    expect(
      result.current.trace.map((s) => [s.id, s.status, s.status === 'done' ? s.ms : null]),
    ).toEqual([
      ['triage', 'done', 12],
      ['retrieve', 'done', 176],
    ])
  })

  it('marks the node currently running while the stream is still open', async () => {
    const { push, close, hook } = openStream()
    let sending!: Promise<void>
    await act(async () => {
      sending = hook.result.current.send('q', 'error')
      push(frame('node', { id: 'retrieve', status: 'start' }))
      push(frame('node', { id: 'retrieve', status: 'done', ms: 90 }))
      push(frame('node', { id: 'generate', status: 'start' }))
      await settle()
    })

    const last = hook.result.current.trace.at(-1)
    expect(last?.id).toBe('generate')
    expect(last?.status).toBe('running')

    await act(async () => {
      push(frame('node', { id: 'generate', status: 'done', ms: 400 }))
      push(frame('done', { sources: [], answer: 'ok' }))
      close()
      await sending
    })
    expect(hook.result.current.trace.at(-1)?.status).toBe('done')
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
    expect(durations(result.current.trace, 'retrieve')).toEqual([100, 120])
  })

  // Sibling of the test above, and it has to exist separately: there are two
  // routes that can put a repeat visit into the log — the `start` append, and
  // the fallback that logs a `done` arriving with no matching `start`. With
  // both present, removing either one alone still leaves the completed-loop
  // test passing, so neither is actually pinned. This one inspects the trace
  // while the second visit is open, which only the `start` route can satisfy.
  it('logs a second visit to a node while it is still running', async () => {
    const { push, close, hook } = openStream()
    let sending!: Promise<void>
    await act(async () => {
      sending = hook.result.current.send('q', 'error')
      push(frame('node', { id: 'retrieve', status: 'start' }))
      push(frame('node', { id: 'retrieve', status: 'done', ms: 100 }))
      push(frame('node', { id: 'rewriteQuery', status: 'start' }))
      push(frame('node', { id: 'rewriteQuery', status: 'done', ms: 300 }))
      push(frame('node', { id: 'retrieve', status: 'start' }))
      await settle()
    })

    expect(hook.result.current.trace.map((s) => [s.id, s.status])).toEqual([
      ['retrieve', 'done'],
      ['rewriteQuery', 'done'],
      ['retrieve', 'running'],
    ])

    await act(async () => {
      push(frame('done', { sources: [], answer: 'ok' }))
      close()
      await sending
    })
  })

  // Asserting only the final state would pass even if sources still arrived
  // solely on `done`, since `done` carries the same list. The point of the early
  // event is the timing, so the stream is held open and inspected mid-flight.
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

  // A node that was running when the stream died must reach a terminal state.
  // Otherwise the rail spins its arc forever and keeps aria-busy set, which is
  // exactly what a Gemini free-tier 429 on gradeDocuments produces in practice.
  it('marks an unfinished node as failed when the server reports an error', async () => {
    const { result } = run([
      frame('node', { id: 'retrieve', status: 'start' }),
      frame('node', { id: 'retrieve', status: 'done', ms: 176 }),
      frame('node', { id: 'gradeDocuments', status: 'start' }),
      frame('error', { message: 'boom' }),
    ])
    await act(async () => {
      await result.current.send('q', 'error copy')
    })

    expect(result.current.trace.map((s) => [s.id, s.status])).toEqual([
      ['retrieve', 'done'],
      ['gradeDocuments', 'failed'],
    ])
    expect(result.current.trace.some((s) => s.status === 'running')).toBe(false)
  })

  it('marks an unfinished node as failed when the stream just stops', async () => {
    const { result } = run([
      frame('node', { id: 'generate', status: 'start' }),
      // No done, no error — the connection simply ends.
    ])
    await act(async () => {
      await result.current.send('q', 'error copy')
    })

    expect(result.current.trace.map((s) => s.status)).toEqual(['failed'])
  })

  it('marks an unfinished node as failed when the request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }) as unknown as typeof fetch,
    )
    const { result } = renderHook(() => useChatStream())
    await act(async () => {
      await result.current.send('q', 'error copy')
    })
    expect(result.current.trace.some((s) => s.status === 'running')).toBe(false)
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

describe('useChatStream history payload', () => {
  beforeEach(() => vi.restoreAllMocks())

  // 2026-08-19, production. Mika wrote out ten suggested questions, 649 chars,
  // and the visitor saw all ten. When they asked her to answer number 8, the
  // copy this hook sent back had been sliced to 300 chars, ending inside item 5.
  // She reported the list as five items long, then explained the ragged edge as
  // "我的回應被截斷了" — a failure that never happened, about an answer that had
  // arrived whole.
  //
  // The client is the wrong place to make that call. It cannot know how much of
  // a turn the prompt has room for, and when it shortens one it leaves no trace
  // the server can read. So it sends what was actually said, and the server
  // decides (rag/history.ts formatHistory), the same division of labour that
  // already governs the turn COUNT.
  it('sends prior answers in full, however long they ran', async () => {
    const tenItems = Array.from(
      { length: 10 },
      (_, i) => `${i + 1}. a suggested question about Charles, long enough to be realistic`,
    ).join('\n')
    // The live list ran 649 chars and the old client cut it at 300, mid-item-5.
    expect(tenItems.length).toBeGreaterThan(600)

    const fetchMock = vi.fn(async () => ({
      ok: true,
      body: sseStream([frame('done', { sources: [], answer: tenItems })]),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useChatStream())
    await act(async () => {
      await result.current.send('請列出10個問題可以問 charles 的', 'error')
    })
    await act(async () => {
      await result.current.send('請回答第8題', 'error')
    })

    const second = (fetchMock as unknown as { mock: { calls: [string, { body: string }][] } }).mock.calls[1]
    const sent = JSON.parse(second[1].body) as {
      history: { role: string; content: string }[]
    }
    const answer = sent.history.find((t) => t.role === 'assistant')
    expect(answer?.content).toBe(tenItems)
    expect(answer?.content).toContain('8. a suggested question')
  })
})
