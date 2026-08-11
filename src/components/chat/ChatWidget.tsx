// Floating AI chat widget. A launcher (bottom-right, "live" status dot) opens a
// panel that streams grounded answers from /api/chat and shows the retrieved
// chunks + scores — the retrieval engineering made visible ("show, don't tell").
//
// Mounted once, globally (see AppRoutes). All copy is i18n; the panel reads in
// the visitor's locale and the backend answers in the question's language.

import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { useChatStream, type ChatMessage } from './useChatStream'
import { useChatMode } from './useChatMode'
import { PipelineTrace } from './PipelineTrace'
import { getVisitorId } from './visitorId'
import { Markdown } from './Markdown'

function LiveDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-mars opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-mars" />
    </span>
  )
}

// Retrieval transparency: the retrieved chunks with their fused scores. This is
// the showcase — it makes the RAG pipeline legible to a recruiter.
function Sources({ message }: { message: ChatMessage }) {
  const t = useT()
  if (!message.sources || message.sources.length === 0) return null
  return (
    <details className="mt-2.5 overflow-hidden rounded-lg border border-border" open>
      <summary className="flex cursor-pointer items-center justify-between bg-bg-tertiary px-3 py-2 font-mono text-[11px] uppercase tracking-[0.5px] text-text-muted">
        <span>
          {t('chat.sourcesLabel')} · {t('chat.sourcesCount', { count: String(message.sources.length) })}
        </span>
      </summary>
      <ul>
        {message.sources.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 border-t border-border px-3 py-2 text-[12px]"
          >
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-white underline decoration-border underline-offset-2 transition-colors hover:text-accent-cyan hover:decoration-accent-cyan"
              >
                {s.title}
              </a>
            ) : (
              <span className="flex-1 truncate text-white">{s.title}</span>
            )}
            <span className="hidden h-[3px] max-w-[80px] flex-1 rounded-full bg-border sm:block">
              <span
                className="block h-full rounded-full bg-accent-mars"
                style={{ width: `${Math.round(Math.min(1, Math.max(0, s.score)) * 100)}%` }}
              />
            </span>
            <span className="min-w-[38px] text-right font-mono text-[11px] text-accent-cyan">
              {s.score.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

// A static teaser of the retrieval-transparency UI, rendered in the empty state
// so the widget's differentiator — real retrieved chunks with relevance scores —
// is visible before the visitor asks anything ("show, don't tell"). Mirrors the
// live Sources markup exactly so it's an honest preview, not a mockup.
const PREVIEW_ROWS = [
  { title: 'USPACE · Case Study', score: 0.92 },
  { title: 'Product Playbook', score: 0.78 },
]

function PreviewScores() {
  const t = useT()
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] leading-[1.6] text-text-muted">{t('chat.previewLabel')}</p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="bg-bg-tertiary px-3 py-2 font-mono text-[11px] uppercase tracking-[0.5px] text-text-muted">
          {t('chat.sourcesLabel')}
        </div>
        <ul>
          {PREVIEW_ROWS.map((s) => (
            <li
              key={s.title}
              className="flex items-center gap-3 border-t border-border px-3 py-2 text-[12px]"
            >
              <span className="flex-1 truncate text-white/90">{s.title}</span>
              <span className="h-[3px] max-w-[80px] flex-1 rounded-full bg-border">
                <span
                  className="block h-full rounded-full bg-accent-mars"
                  style={{ width: `${Math.round(s.score * 100)}%` }}
                />
              </span>
              <span className="min-w-[38px] text-right font-mono text-[11px] text-accent-cyan">
                {s.score.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Message({ message, onRetry }: { message: ChatMessage; onRetry?: () => void }) {
  const t = useT()
  if (message.role === 'user') {
    return (
      <div className="max-w-[85%] self-end rounded-[14px_14px_4px_14px] border border-border bg-bg-tertiary px-3.5 py-2.5 text-[14px] leading-[1.7] text-white">
        {message.text}
      </div>
    )
  }
  return (
    <div className="w-full self-stretch text-[14px] leading-[1.7]">
      <div className={message.error ? 'text-text-muted' : 'text-white'}>
        {message.error ? message.text : <Markdown text={message.text} />}
      </div>
      {message.error && onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-3 py-1 font-mono text-[11px] uppercase tracking-[0.5px] text-accent-cyan transition-colors hover:border-accent-cyan"
        >
          ↻ {t('chat.retry')}
        </button>
      )}
      <Sources message={message} />
    </div>
  )
}

export default function ChatWidget() {
  const t = useT()
  // Size state lives in useChatMode; the conversation lives in useChatStream
  // right here. Both stay mounted across every size change, which is what
  // makes stowing the panel non-destructive.
  const { mode, open: openPanel, minimise, toggleFullscreen } = useChatMode()
  const open = mode !== 'minimised'
  const fullscreen = mode === 'fullscreen'
  const [input, setInput] = useState('')
  // Region gate: blocked visitors (e.g. CN) can still open the panel, but it
  // lands in a disabled "not available here" state. Checked once on first open
  // via /api/geo; any failure leaves the assistant usable (fail open).
  const [regionBlocked, setRegionBlocked] = useState(false)
  const geoCheckedRef = useRef(false)
  const { messages, status, trace, send, retry, clear } = useChatStream()
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Tracks whether the panel has ever been open, so the first render doesn't
  // steal focus onto the launcher — but every route that stows the panel
  // (button or Escape) does return focus there rather than losing it to <body>.
  const wasOpenRef = useRef(false)

  // Auto-scroll to the newest message. Jump instantly while streaming (a smooth
  // scroll fired on every token fights itself and janks); smooth-scroll only
  // once the answer settles.
  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: status === 'streaming' ? 'auto' : 'smooth',
    })
  }, [messages, status])

  // Focus the input when the panel opens; return focus to the launcher when it
  // closes via keyboard/button so keyboard users aren't dropped onto <body>.
  // Autofocus only on fine-pointer (desktop) devices: on touch, focusing the
  // input pops the soft keyboard before the visitor has chosen to type, covering
  // the panel. Touch users tap the field when they actually want to type.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      const isFinePointer = window.matchMedia('(pointer: fine)').matches
      if (isFinePointer) inputRef.current?.focus()
    } else if (wasOpenRef.current) {
      launcherRef.current?.focus()
    }
  }, [open])

  // Pin the page behind the fullscreen takeover. Position-fixed rather than
  // `overflow: hidden` because iOS Safari ignores the latter on <body>; the
  // offset is carried on `top` so the page doesn't jump to 0 while pinned.
  //
  // The restore asks for 'instant' deliberately: index.css sets
  // `scroll-behavior: smooth` on <html>, which would otherwise animate the
  // restore and let the visitor watch the page scroll back.
  useEffect(() => {
    if (!fullscreen) return
    const y = window.scrollY
    const previous = document.body.style.cssText
    document.body.style.position = 'fixed'
    document.body.style.top = `-${y}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    return () => {
      document.body.style.cssText = previous
      window.scrollTo({ top: y, behavior: 'instant' })
    }
  }, [fullscreen])

  // Keep Tab inside the takeover. The docked panel deliberately does not trap:
  // it is a small overlay beside a usable page, whereas fullscreen covers
  // everything and tabbing to hidden content behind it would strand the focus.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      // Focus sitting outside the panel is the common case, not an edge one: a
      // click on non-focusable panel chrome leaves it on <body>, and on touch
      // devices the open-time autofocus is deliberately skipped. Both
      // directions have to reel it back in, or the next Tab walks into the page
      // behind the scrim.
      const outside = !panelRef.current.contains(active)
      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // Resolve the visitor's region the first time the panel opens. Kept lazy so a
  // visitor who never opens chat never triggers the request. This fires exactly
  // once per page session on first open, so it doubles as the "chat opened"
  // analytics beacon — the visitor id lets the backend count opens (and unique
  // openers) without any third-party analytics plan.
  useEffect(() => {
    if (!open || geoCheckedRef.current) return
    geoCheckedRef.current = true
    fetch(`/api/geo?vid=${encodeURIComponent(getVisitorId())}`)
      .then((r) => (r.ok ? r.json() : { blocked: false }))
      .then((d: { blocked?: boolean }) => setRegionBlocked(Boolean(d.blocked)))
      .catch(() => setRegionBlocked(false))
  }, [open])

  const submit = (question: string) => {
    if (regionBlocked) return
    const q = question.trim()
    if (!q) return
    setInput('')
    void send(q, t('chat.errorMessage'))
  }

  const suggestions = [
    t('chat.suggested1'),
    t('chat.suggested2'),
    t('chat.suggested3'),
    t('chat.suggested4'),
    t('chat.suggested5'),
    t('chat.suggested6'),
  ]

  if (!open) {
    // Single floating CTA (bottom-right): one click opens chat. The ambient-music
    // toggle is its own bottom-left FAB (MusicToggle), so this stays a clean
    // single-purpose launcher — left = music, right = AI.
    return (
      <button
        ref={launcherRef}
        onClick={openPanel}
        aria-label={t('chat.openAriaLabel')}
        className="fixed bottom-5 right-5 z-50 inline-flex cursor-pointer items-center gap-2.5 rounded-full border border-border bg-bg-secondary py-3.5 pl-4 pr-4 text-[14px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent-cyan"
      >
        <LiveDot />
        <span>{t('chat.launcherLabel')}</span>
        <span className="rounded bg-accent-cyan/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[1px] text-accent-cyan">
          {t('chat.launcherTag')}
        </span>
      </button>
    )
  }

  return (
    <>
      {/* Scrim: only fullscreen takes the page over, so only fullscreen dims it. */}
      {fullscreen && (
        <div
          aria-hidden="true"
          onClick={toggleFullscreen}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[3px] animate-chat-scrim"
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={fullscreen || undefined}
        aria-label={t('chat.title')}
        className={
          'fixed z-50 flex flex-col overflow-hidden border border-border bg-bg-secondary shadow-[0_24px_60px_rgba(0,0,0,0.5)] ' +
          (fullscreen
            ? // Edge-to-edge on phones: an inset takeover on a 390px screen is
              // only a few px wider than the docked panel, which reads as no
              // change at all.
              'inset-4 rounded-2xl max-md:inset-0 max-md:rounded-none max-md:border-0 animate-chat-panel-grow'
            : 'bottom-5 right-5 h-[min(560px,80vh)] w-[min(400px,calc(100vw-2.5rem))] rounded-2xl')
        }
      >
        {/* Header — title leads; the tech-stack line sits under it as a subtitle
            that still signals the engineering ("show, don't tell"). */}
        <div className="flex flex-none items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <LiveDot />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold text-white">{t('chat.title')}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.5px] text-text-muted">
                {t('chat.subtitle')}
              </div>
            </div>
          </div>
          <div className="flex flex-none items-center gap-0.5">
            <button
              onClick={toggleFullscreen}
              aria-label={fullscreen ? t('chat.collapseAriaLabel') : t('chat.expandAriaLabel')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-tertiary transition-colors hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                {fullscreen ? (
                  <>
                    <path d="M4 14h6v6" />
                    <path d="M20 10h-6V4" />
                    <path d="M14 10l7-7" />
                    <path d="M3 21l7-7" />
                  </>
                ) : (
                  <>
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </>
                )}
              </svg>
            </button>
            <button
              onClick={minimise}
              aria-label={t('chat.minimiseAriaLabel')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-tertiary transition-colors hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className={
            'min-h-0 flex-1 ' +
            (fullscreen ? 'grid grid-cols-[236px_minmax(0,1fr)] max-md:grid-cols-1' : 'flex flex-col')
          }
        >
          {/* Left rail: only fullscreen has the room for it. On a phone even
              fullscreen doesn't, so it stays out of the way there too. */}
          {fullscreen && (
            <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-r border-border p-4 max-md:hidden animate-chat-rail">
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-[10px] font-medium uppercase tracking-[1.1px] text-text-tertiary">
                  {t('chat.suggestionsTitle')}
                </h3>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    // Unlike the empty-state chips, these stay on screen during
                    // a stream — where send() ignores them. Disable rather than
                    // let a click do nothing with no explanation.
                    disabled={status === 'streaming' || regionBlocked}
                    className="cursor-pointer rounded-[10px] border border-border bg-transparent px-2.5 py-2 text-left text-[12.5px] leading-snug text-text-muted transition-colors hover:border-border-hover hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {/* The reason fullscreen exists: the retrieval pipeline, visible
                  while it runs. The docked panel has no room for it. */}
              <PipelineTrace trace={trace} />
            </aside>
          )}

          {/* Centre column: the composer sits with the thread rather than on the
              panel, so the two stay on the same axis when the rail is present. */}
          <div className="flex min-h-0 min-w-0 flex-col">
            {/* Body — aria-live so streamed answers reach screen readers. */}
            <div
              ref={bodyRef}
              aria-live="polite"
              aria-atomic="false"
              className={
                'flex flex-1 flex-col gap-4 overflow-y-auto ' +
                (fullscreen ? 'mx-auto w-full max-w-[760px] px-6 py-7' : 'p-4')
              }
            >
        {regionBlocked ? (
          <p className="text-[14px] leading-[1.7] text-text-muted">{t('chat.regionBlocked')}</p>
        ) : messages.length === 0 ? (
          <>
            <p className="text-[14px] leading-[1.7] text-white/85">{t('chat.emptyMessage')}</p>
            <PreviewScores />
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="cursor-pointer rounded-full border border-border bg-transparent px-3 py-2 text-[12px] text-text-muted transition-colors hover:border-border-hover hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          messages.map((m, i) => (
            <Message
              key={i}
              message={m}
              onRetry={status !== 'streaming' ? () => retry(t('chat.errorMessage')) : undefined}
            />
          ))
        )}
        {status === 'streaming' && messages[messages.length - 1]?.text === '' && (
          <div
            role="status"
            className="flex items-center gap-2 self-start font-mono text-[11px] text-text-muted"
          >
            <span className="chat-dots flex gap-1">
              <span className="h-1.5 w-1.5 animate-chat-wave rounded-full bg-accent-cyan" />
              <span className="h-1.5 w-1.5 animate-chat-wave rounded-full bg-accent-cyan" />
              <span className="h-1.5 w-1.5 animate-chat-wave rounded-full bg-accent-cyan" />
            </span>
            {t('chat.thinking')}
          </div>
        )}
        {messages.length > 0 && status !== 'streaming' && (
          <button
            onClick={() => {
              clear()
              inputRef.current?.focus()
            }}
            className="mt-1 cursor-pointer self-start text-[12px] text-text-tertiary underline decoration-border underline-offset-4 transition-colors hover:text-text-muted hover:decoration-text-muted"
          >
            {t('chat.clearLabel')}
          </button>
        )}
      </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit(input)
              }}
              className={
                'flex flex-none gap-2.5 border-t border-border ' +
                (fullscreen ? 'mx-auto w-full max-w-[760px] px-6 pb-5 pt-3.5' : 'p-3.5')
              }
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={regionBlocked ? t('chat.regionBlocked') : t('chat.inputPlaceholder')}
                aria-label={regionBlocked ? t('chat.regionBlocked') : t('chat.inputPlaceholder')}
                maxLength={200}
                disabled={regionBlocked}
                // 16px keeps iOS Safari from auto-zooming the viewport on focus (it
                // zooms whenever a focused input is under 16px); the rest of the widget
                // keeps its denser 14px scale.
                className="flex-1 rounded-[10px] border border-border bg-bg-primary px-3.5 py-2.5 text-[16px] text-white outline-none transition-colors placeholder:text-text-tertiary focus:border-accent-cyan disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === 'streaming' || input.trim() === '' || regionBlocked}
                aria-label={t('chat.sendAriaLabel')}
                className="cursor-pointer rounded-[10px] border-none bg-accent-mars px-4 text-[14px] font-semibold text-bg-primary transition-opacity disabled:cursor-default disabled:opacity-40"
              >
                {t('chat.send')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
