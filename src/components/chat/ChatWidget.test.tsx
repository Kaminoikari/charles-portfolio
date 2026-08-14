import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ChatWidget from './ChatWidget'
import { CHAT_PANEL_HEIGHT_CLASS } from './avatarMode'

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
function stubFetch(frames: string[] = [frame('done', { sources: [], answer: ANSWER })]) {
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.startsWith('/api/geo')) {
      return { ok: true, json: async () => ({ blocked: false }) } as unknown as Response
    }
    return { ok: true, body: sseStream(frames) } as unknown as Response
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
  await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
  await user.type(screen.getByLabelText(/ask anything about his work/i), 'what did he do?')
  await user.click(screen.getByRole('button', { name: /send question/i }))
  await waitFor(() => expect(screen.getByText(ANSWER)).toBeTruthy())
}

describe('ChatWidget size modes', () => {
  it('rests as a launcher pill once the avatar gate settles, never flashing it before', async () => {
    render(<ChatWidget />)
    // Fresh visit: while the avatar gate is still unasked, the corner stays
    // EMPTY — the old capsule must not flash first and get replaced seconds
    // later (real-iPhone report, 2026-08-13). jsdom has no WebGL2, so the
    // gate settles to "off" ~400ms later and the capsule then appears.
    expect(screen.queryByRole('button', { name: /open the ai assistant/i })).toBeNull()
    expect(await screen.findByRole('button', { name: /open the ai assistant/i })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers minimise rather than close, because stowing keeps the conversation', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
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

    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    expect(screen.getByText(ANSWER)).toBeTruthy()
  })

  it('keeps the conversation when Escape stows the panel', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await openAndAsk(user)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
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

describe('ChatWidget fullscreen', () => {
  it('shows the pipeline rail only in fullscreen', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    expect(screen.queryByRole('complementary')).toBeNull()

    await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
    expect(screen.getByRole('complementary')).toBeTruthy()
  })

  it('collapses back to the docked panel through the same control', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
    await user.click(screen.getByRole('button', { name: /exit fullscreen/i }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('keeps the conversation across every size change', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await openAndAsk(user)

    await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
    expect(screen.getByText(ANSWER)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /minimise the ai assistant/i }))
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    // Re-opens at the last size in use, which was fullscreen.
    expect(screen.getByRole('complementary')).toBeTruthy()
    expect(screen.getByText(ANSWER)).toBeTruthy()
  })

  // End-to-end for the feature fullscreen exists to show: server node events
  // reaching the rail as named steps with their measured cost.
  describe('pipeline trace', () => {
    it('invites a question before anything has run', async () => {
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))

      expect(screen.getByText(/the pipeline runs here/i)).toBeTruthy()
    })

    it('draws each node the server reported, with its latency', async () => {
      stubFetch([
        frame('node', { id: 'triage', status: 'start' }),
        frame('node', { id: 'triage', status: 'done', ms: 12 }),
        frame('node', { id: 'retrieve', status: 'start' }),
        frame('node', { id: 'retrieve', status: 'done', ms: 176 }),
        frame('node', { id: 'generate', status: 'start' }),
        frame('node', { id: 'generate', status: 'done', ms: 611 }),
        frame('done', { sources: [], answer: ANSWER }),
      ])
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
      await user.type(screen.getByLabelText(/ask anything about his work/i), 'q')
      await user.click(screen.getByRole('button', { name: /send question/i }))

      await waitFor(() => expect(screen.getByText('Triage')).toBeTruthy())
      expect(screen.getByText('Vector search')).toBeTruthy()
      expect(screen.getByText('Generate answer')).toBeTruthy()
      expect(screen.getByText('176 ms')).toBeTruthy()
      // Total of the completed passes, shown against the pipeline heading.
      expect(screen.getByText('799 ms')).toBeTruthy()
    })

    // The rail used to swap the suggestions out for the trace, because the
    // character stood at its foot and the two stacked pushed the last stations
    // behind her. She moved to her own column on 2026-08-14 and they now
    // coexist. Asserted through a real answered question, since the old
    // behaviour only showed itself after one.
    it('keeps the suggestions in the rail after a question has been answered', async () => {
      // Node frames are load-bearing: the old rule hid the suggestions while
      // the TRACE was non-empty, so a stub that reports no nodes leaves the
      // trace empty and the old behaviour passes this test too. Verified by
      // mutation — with these frames removed, restoring the old condition
      // stayed green.
      stubFetch([
        frame('node', { id: 'retrieve', status: 'start' }),
        frame('node', { id: 'retrieve', status: 'done', ms: 176 }),
        frame('done', { sources: [], answer: ANSWER }),
      ])
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
      const rail = document.querySelector('aside')!
      const inRail = (name: RegExp) =>
        [...rail.querySelectorAll('button')].some((b) => name.test(b.textContent ?? ''))
      expect(inRail(/how were you built/i)).toBe(true)

      await user.type(screen.getByLabelText(/ask anything about his work/i), 'q')
      await user.click(screen.getByRole('button', { name: /send question/i }))
      await waitFor(() => expect(screen.getByText(ANSWER)).toBeTruthy())

      expect(inRail(/how were you built/i)).toBe(true)
    })

    // The corrective loop is the most interesting thing this pipeline does, so
    // a second visit has to read as a second station rather than being folded
    // into the first.
    it('shows a corrective loop as two separate retrieve steps', async () => {
      stubFetch([
        frame('node', { id: 'retrieve', status: 'start' }),
        frame('node', { id: 'retrieve', status: 'done', ms: 100 }),
        frame('node', { id: 'rewriteQuery', status: 'start' }),
        frame('node', { id: 'rewriteQuery', status: 'done', ms: 300 }),
        frame('node', { id: 'retrieve', status: 'start' }),
        frame('node', { id: 'retrieve', status: 'done', ms: 120 }),
        frame('done', { sources: [], answer: ANSWER }),
      ])
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
      await user.type(screen.getByLabelText(/ask anything about his work/i), 'q')
      await user.click(screen.getByRole('button', { name: /send question/i }))

      await waitFor(() => expect(screen.getAllByText('Vector search')).toHaveLength(2))
      expect(screen.getByText('Rewrite query')).toBeTruthy()
      expect(screen.getByText('100 ms')).toBeTruthy()
      expect(screen.getByText('120 ms')).toBeTruthy()
    })
  })

  // The takeover covers the page, so Tab must not reach the nav behind the
  // scrim. Forward Tab from outside the panel is the case that matters: it
  // happens on the very first Tab on a touch device (autofocus is deliberately
  // skipped there) and after any click on non-focusable panel chrome, both of
  // which leave activeElement on <body>.
  describe('focus containment', () => {
    // The page behind the takeover is represented by a focusable element that
    // sits BEFORE the widget in document order, the way the site nav does.
    // Without it there is nowhere for focus to escape to and the test would
    // pass against a trap that does nothing.
    async function openFullscreen() {
      const user = userEvent.setup()
      render(
        <>
          <button type="button">behind the scrim</button>
          <ChatWidget />
        </>,
      )
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
      const panel = screen.getByRole('dialog')
      ;(document.activeElement as HTMLElement | null)?.blur()
      expect(panel.contains(document.activeElement)).toBe(false)
      return { user, panel }
    }

    it('pulls a forward Tab from outside the panel back inside', async () => {
      const { user, panel } = await openFullscreen()
      await user.keyboard('{Tab}')
      expect(panel.contains(document.activeElement)).toBe(true)
    })

    it('pulls a backward Tab from outside the panel back inside', async () => {
      const { user, panel } = await openFullscreen()
      await user.keyboard('{Shift>}{Tab}{/Shift}')
      expect(panel.contains(document.activeElement)).toBe(true)
    })

    // The docked panel deliberately does NOT trap: it is a small overlay beside
    // a page the visitor can still use.
    it('leaves focus free to reach the page from the docked panel', async () => {
      const user = userEvent.setup()
      render(
        <>
          <button type="button">page control</button>
          <ChatWidget />
        </>,
      )
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      const panel = screen.getByRole('dialog')
      ;(document.activeElement as HTMLElement | null)?.blur()

      await user.keyboard('{Tab}')
      expect(panel.contains(document.activeElement)).toBe(false)
    })
  })

  // The avatar canvas is sized to the docked panel so she stands exactly as
  // tall as it. avatarMode.ts holds the two Tailwind literals to each other,
  // but only if the panel actually renders the shared one — spelling
  // 'h-[min(560px,80vh)]' inline here again would satisfy that unit test while
  // letting the panel drift away from her on the next edit. This drives the
  // real component and reads what reached the DOM.
  it('renders the docked panel at the height the avatar is sized to', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    expect(screen.getByRole('dialog').className).toContain(CHAT_PANEL_HEIGHT_CLASS)
  })

  describe('background scroll lock', () => {
    const SCROLL_Y = 320

    beforeEach(() => {
      Object.defineProperty(window, 'scrollY', { value: SCROLL_Y, writable: true, configurable: true })
      window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
      document.body.style.cssText = ''
    })

    it('pins the page while fullscreen is open', async () => {
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))

      expect(document.body.style.position).toBe('fixed')
      expect(document.body.style.top).toBe(`-${SCROLL_Y}px`)
    })

    // The page-level `scroll-behavior: smooth` in index.css turns a plain
    // restore into an animated scroll, so the restore must ask for 'instant'.
    it('restores the exact scroll position without animating it', async () => {
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
      await user.click(screen.getByRole('button', { name: /exit fullscreen/i }))

      expect(document.body.style.position).not.toBe('fixed')
      expect(window.scrollTo).toHaveBeenCalledWith({ top: SCROLL_Y, behavior: 'instant' })
    })

    it('unpins the page when fullscreen is minimised directly', async () => {
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
      await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))
      await user.click(screen.getByRole('button', { name: /minimise the ai assistant/i }))

      expect(document.body.style.position).not.toBe('fixed')
    })
  })
})
