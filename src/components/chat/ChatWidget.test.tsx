import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ChatWidget from './ChatWidget'

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

const ANSWER = 'He led the parking matching system at USPACE.'

// One stub serving both endpoints the widget calls: the region probe on first
// open, and the SSE answer stream on send.
function stubFetch(answer = ANSWER) {
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api/geo')) {
      return { ok: true, json: async () => ({ blocked: false }) } as unknown as Response
    }
    return {
      ok: true,
      body: sseStream([frame('done', { sources: [], answer })]),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', impl as unknown as typeof fetch)
  return impl
}

beforeEach(() => {
  vi.restoreAllMocks()
  // jsdom ships neither of these and the widget uses both on open.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia,
  )
  Element.prototype.scrollTo = vi.fn()
  stubFetch()
})

afterEach(cleanup)

async function openAndAsk(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /open the ai assistant/i }))
  await user.type(screen.getByLabelText(/ask anything about his work/i), 'what did he do?')
  await user.click(screen.getByRole('button', { name: /send question/i }))
  await waitFor(() => expect(screen.getByText(ANSWER)).toBeTruthy())
}

describe('ChatWidget size modes', () => {
  it('rests as a launcher pill with no panel showing', () => {
    render(<ChatWidget />)
    expect(screen.getByRole('button', { name: /open the ai assistant/i })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers minimise rather than close, because stowing keeps the conversation', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(screen.getByRole('button', { name: /open the ai assistant/i }))
    expect(screen.getByRole('button', { name: /minimise the ai assistant/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /close the ai assistant/i })).toBeNull()
  })

  // The whole point of having modes: the conversation lives in ChatWidget's own
  // state, so any size change that unmounted it would silently discard the chat.
  it('keeps the conversation when minimised and re-opened', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await openAndAsk(user)

    await user.click(screen.getByRole('button', { name: /minimise the ai assistant/i }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: /open the ai assistant/i }))
    expect(screen.getByText(ANSWER)).toBeTruthy()
  })

  it('keeps the conversation when Escape stows the panel', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await openAndAsk(user)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: /open the ai assistant/i }))
    expect(screen.getByText(ANSWER)).toBeTruthy()
  })

  // Clearing is the only route that discards a conversation, and it is a
  // separate, explicitly labelled control.
  it('discards the conversation only through the explicit clear control', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await openAndAsk(user)

    await user.click(screen.getByRole('button', { name: /clear this conversation/i }))
    expect(screen.queryByText(ANSWER)).toBeNull()
  })
})
