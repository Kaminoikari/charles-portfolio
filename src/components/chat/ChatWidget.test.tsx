import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ChatWidget from './ChatWidget'
import {
  avatarColumnBox,
  avatarColumnRightInset,
  CHAT_PANEL_HEIGHT_CLASS,
} from './avatarMode'
import { VOICE_LINES } from './avatarVoice'
import { PAT_EMOTION } from './avatarMode'

// The head-pat detector lives in AvatarGuide (tested there against real
// pointer maths); what this file owns is the other half — what the widget
// PLAYS when a pat is reported. The stub hands the callback back out.
// Same reason as AvatarGuide.test.tsx: sentinel values nothing else uses, so
// the head-pat performance assertion below fails if CUE_PERFORMANCE.giggle goes
// back to an inline ('happy', 0.9, 1.8) that can drift from the detector's.
vi.mock('./avatarMode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./avatarMode')>()),
  PAT_EMOTION: {
    happy: ['nagomi', 0.42, 3.75],
    annoyed: ['surprised', 0.37, 2.25],
  },
}))

type PatCallback = (kind: 'happy' | 'annoyed') => void
const avatarStub = vi.hoisted(() => ({
  onPat: null as PatCallback | null,
  handle: {
    setMode: vi.fn(),
    setActive: vi.fn(),
    setSpeech: vi.fn(),
    setEmotion: vi.fn(),
    playGesture: vi.fn(),
    playMotion: vi.fn(() => true),
    setFraming: vi.fn(),
    setPlacement: vi.fn(),
    dispose: vi.fn(),
  },
}))

// Read through a function on purpose: assigning `avatarStub.onPat = null` in a
// setup helper narrows the property to `null` for the rest of THAT function, so
// reading it there would need a cast that lies. The stub fills it in from a
// React render, which the type checker cannot see either way.
function takePatCallback(): PatCallback {
  const pat = avatarStub.onPat
  if (!pat) throw new Error('the avatar stub never handed its pat callback out')
  return pat
}

// The real guide builds a WebGL renderer, which jsdom has none of. Every other
// test in this file leaves the capability gate closed and never reaches it; the
// column-placement test below opens the gate deliberately, so the component it
// mounts has to be a stub. The wrapper DIV that carries the positioning is
// ChatWidget's own, so stubbing the canvas away costs the assertion nothing.
vi.mock('./AvatarGuide', async () => {
  const { useEffect } = await import('react')
  return {
    default: ({
      onLoaded,
      onPat,
      onHandle,
    }: {
      onLoaded?: () => void
      onPat?: (kind: 'happy' | 'annoyed') => void
      onHandle?: (handle: unknown) => void
    }) => {
      // The widget keeps the corner EMPTY until the guide reports its first
      // frame, so a stub that never loads takes the launcher button with it.
      useEffect(() => {
        onLoaded?.()
        // The real engine handle is what receives the performance beats; the
        // spy stands in for it so a cue's face can be asserted.
        onHandle?.(avatarStub.handle)
      }, [onLoaded, onHandle])
      avatarStub.onPat = onPat ?? null
      return null
    },
  }
})

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
  it('wraps long drafts and grows the composer to their content height', async () => {
    const singleLineHeight = 46
    const wrappedContentHeight = 72
    let scrollHeight = singleLineHeight
    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'scrollHeight',
    )
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    })

    try {
      const user = userEvent.setup()
      render(<ChatWidget />)
      await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))

      const composer = screen.getByLabelText(/ask anything about his work/i)
      expect(composer.tagName).toBe('TEXTAREA')
      expect(composer).toHaveAttribute('wrap', 'soft')

      scrollHeight = wrappedContentHeight
      await user.type(composer, 'A draft that needs more than one line.')
      expect(composer).toHaveStyle({ height: `${wrappedContentHeight}px` })
    } finally {
      if (scrollHeightDescriptor) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', scrollHeightDescriptor)
      } else {
        delete (HTMLTextAreaElement.prototype as { scrollHeight?: number }).scrollHeight
      }
    }
  })

  it('sends a draft when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    await user.type(screen.getByLabelText(/ask anything about his work/i), 'what did he do?')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByText(ANSWER)).toBeTruthy())
  })

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

  // avatarMode.test.ts proves avatarColumnRightInset lands her body on the
  // panel's inner right edge, but only the widget decides what to feed it.
  // Passing a constant here — which is what this was until 2026-08-19 — would
  // satisfy that unit test while leaving her 194px short on a desktop. This
  // drives the real component at a real viewport and reads the style that
  // reached the DOM.
  it('hangs the fullscreen avatar canvas out by the inset for its own width', async () => {
    const vw = 1920
    const vh = 1080
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: vw,
      configurable: true,
    })
    Object.defineProperty(window, 'innerHeight', { value: vh, configurable: true })
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(min-width: 768px)' || query === '(min-width: 880px)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia,
    )
    // Opens the capability gate: it probes for a WebGL2 context and nothing else.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      ((kind: string) =>
        kind === 'webgl2'
          ? { getExtension: () => null }
          : null) as unknown as typeof HTMLCanvasElement.prototype.getContext,
    )

    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(await screen.findByRole('button', { name: /open the ai assistant/i }))
    await user.click(screen.getByRole('button', { name: /expand to fullscreen/i }))

    // The gate runs behind a 400ms latch, so she is not in the DOM on the first
    // frame. z-[55] is the column wrapper's own layer.
    const wrapper = await waitFor(
      () => {
        const el = document.querySelector<HTMLElement>('.z-\\[55\\]')
        expect(el).toBeTruthy()
        return el as HTMLElement
      },
      { timeout: 2000 },
    )

    const expected = avatarColumnRightInset(avatarColumnBox(vw, vh).w)
    expect(expected).toBeLessThan(-100)
    expect(wrapper.style.right).toBe(`${expected}px`)
  })

  describe('head pats', () => {
    // Every clip the widget starts goes through `new Audio(src)`; jsdom has no
    // media stack, so this stand-in is both the recorder and the stub.
    class FakeAudio {
      static created: FakeAudio[] = []
      src: string
      paused = false
      ended = false
      play = vi.fn(() => Promise.resolve())
      pause = vi.fn()
      addEventListener = vi.fn()
      constructor(src: string) {
        this.src = src
        FakeAudio.created.push(this)
      }
    }

    // Renders the widget with the capability gate open and waits for the guide
    // to hand its pat callback out. Nothing has been clicked at this point, so
    // no voice line is in flight.
    async function mountPattable() {
      FakeAudio.created = []
      avatarStub.onPat = null
      avatarStub.handle.setEmotion.mockClear()
      avatarStub.handle.playGesture.mockClear()
      vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        ((kind: string) =>
          kind === 'webgl2'
            ? { getExtension: () => null }
            : null) as unknown as typeof HTMLCanvasElement.prototype.getContext,
      )
      render(<ChatWidget />)
      // Two waits, and the second one is load-bearing. The gate runs behind a
      // 400ms latch before she is mounted at all; the FIRST render after that
      // still has avatarLoaded false (the stub reports its first frame from an
      // effect), and the pat callback captured in that render closes over a
      // speakCue that refuses to play — she is not on duty yet. This test was
      // flaky (2 failures in 5 runs) until it waited for the render that comes
      // AFTER the load: the character launcher button, which is the only DOM
      // node gated on avatarIsLauncher, and so on avatarLoaded.
      await waitFor(() => expect(avatarStub.onPat).toBeTruthy(), { timeout: 2000 })
      await waitFor(() => expect(document.querySelector('[data-own-focus-ring]')).toBeTruthy(), {
        timeout: 2000,
      })
      // Read at call time rather than captured here: the stub replaces the
      // callback on every render, and only the latest one is the live wiring.
      return (kind: 'happy' | 'annoyed') => takePatCallback()(kind)
    }

    it('answers a happy pat with a giggle from the locale-shared pool', async () => {
      const pat = await mountPattable()

      act(() => pat('happy'))

      expect(FakeAudio.created).toHaveLength(1)
      // Asserting membership of the JAPANESE pool is the point: the laugh is
      // wordless, so every locale plays these same five files.
      expect(VOICE_LINES.giggle).toContain(FakeAudio.created[0].src)
      expect(FakeAudio.created[0].play).toHaveBeenCalledTimes(1)
      // The cue's face comes from the pat's shared constant, so the detector
      // and the cue cannot set two different faces on one pat.
      expect(avatarStub.handle.setEmotion).toHaveBeenCalledWith(...PAT_EMOTION.happy)
      // The wiggle is AvatarGuide's; performing it here again would double it.
      expect(avatarStub.handle.playGesture).not.toHaveBeenCalled()
    })

    it('answers the annoyed third pat with the complaint, not the giggle', async () => {
      const pat = await mountPattable()

      act(() => pat('annoyed'))

      // It used to be silent, which read as nothing happening. A laugh would be
      // worse than silence here: it cancels out the one beat that says
      // "enough", so the third pat gets its own line.
      expect(FakeAudio.created).toHaveLength(1)
      expect(FakeAudio.created[0].src).toContain('mika-huff-1')
      expect(FakeAudio.created[0].src).not.toContain('giggle')
    })

    it('yields the giggle to a line she is already speaking', async () => {
      const pat = await mountPattable()
      act(() => pat('happy'))
      expect(FakeAudio.created).toHaveLength(1)

      // Second pat while the first giggle is still running: cutting her off to
      // laugh again reads as an interruption, and the visible beat (face plus
      // head wiggle) has already landed inside AvatarGuide either way.
      act(() => pat('happy'))

      expect(FakeAudio.created).toHaveLength(1)
      expect(FakeAudio.created[0].pause).not.toHaveBeenCalled()
    })

    it('lets the complaint talk over a laugh, so a fast triple pat still sounds', async () => {
      const pat = await mountPattable()
      act(() => pat('happy'))
      expect(FakeAudio.created).toHaveLength(1)

      // Three pats in a row is a fast gesture and the giggles are under a
      // second each. If the complaint queued behind them it would come out
      // silent exactly when the visitor pats quickest, which is the beat this
      // whole cue exists for.
      act(() => pat('annoyed'))

      expect(FakeAudio.created).toHaveLength(2)
      expect(FakeAudio.created[1].src).toContain('mika-huff-1')
      expect(FakeAudio.created[0].pause).toHaveBeenCalled()
    })

    it('still holds the complaint back while she is speaking a LINE', async () => {
      const pat = await mountPattable()
      // Opening the panel starts a real line; a pat landing on top of one must
      // not cut her off, which is the rule the giggle has always followed and
      // the only part of it talking over a laugh is meant to relax.
      await act(async () => {
        ;(document.querySelector('[data-own-focus-ring]') as HTMLElement).click()
      })
      expect(FakeAudio.created).toHaveLength(1)
      expect(FakeAudio.created[0].src).not.toContain('mika-giggle')

      act(() => pat('annoyed'))

      expect(FakeAudio.created).toHaveLength(1)
      expect(FakeAudio.created[0].pause).not.toHaveBeenCalled()
    })
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
