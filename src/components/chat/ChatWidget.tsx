// Floating AI chat widget. A launcher (bottom-right, "live" status dot) opens a
// panel that streams grounded answers from /api/chat and shows the retrieved
// chunks + scores — the retrieval engineering made visible ("show, don't tell").
//
// Mounted once, globally (see AppRoutes). All copy is i18n; the panel reads in
// the visitor's locale and the backend answers in the question's language.

import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { useChatStream, type ChatMessage } from './useChatStream'
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
            <span className="flex-1 truncate text-white">{s.title}</span>
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
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  // Region gate: blocked visitors (e.g. CN) can still open the panel, but it
  // lands in a disabled "not available here" state. Checked once on first open
  // via /api/geo; any failure leaves the assistant usable (fail open).
  const [regionBlocked, setRegionBlocked] = useState(false)
  const geoCheckedRef = useRef(false)
  const { messages, status, send, retry, clear } = useChatStream()
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  // Set when the panel is closed via Escape / the close button, so focus returns
  // to the launcher (which only mounts once the panel is closed) rather than
  // being lost to <body>.
  const restoreFocusRef = useRef(false)

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
      const isFinePointer = window.matchMedia('(pointer: fine)').matches
      if (isFinePointer) inputRef.current?.focus()
    } else if (restoreFocusRef.current) {
      launcherRef.current?.focus()
      restoreFocusRef.current = false
    }
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        restoreFocusRef.current = true
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Resolve the visitor's region the first time the panel opens. Kept lazy so a
  // visitor who never opens chat never triggers the request.
  useEffect(() => {
    if (!open || geoCheckedRef.current) return
    geoCheckedRef.current = true
    fetch('/api/geo')
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

  const suggestions = [t('chat.suggested1'), t('chat.suggested2'), t('chat.suggested3')]

  if (!open) {
    // Single floating CTA (bottom-right): one click opens chat. The ambient-music
    // toggle is its own bottom-left FAB (MusicToggle), so this stays a clean
    // single-purpose launcher — left = music, right = AI.
    return (
      <button
        ref={launcherRef}
        onClick={() => setOpen(true)}
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
    <div
      role="dialog"
      aria-label={t('chat.title')}
      className="fixed bottom-5 right-5 z-50 flex h-[min(560px,80vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
    >
      {/* Header — title leads; the tech-stack line sits under it as a subtitle
          that still signals the engineering ("show, don't tell"). */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LiveDot />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-semibold text-white">{t('chat.title')}</div>
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.5px] text-text-muted">
              {t('chat.subtitle')}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            restoreFocusRef.current = true
            setOpen(false)
          }}
          aria-label={t('chat.closeAriaLabel')}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[18px] leading-none text-text-tertiary transition-colors hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Body — aria-live so streamed answers reach screen readers. */}
      <div
        ref={bodyRef}
        aria-live="polite"
        aria-atomic="false"
        className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
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
        className="flex gap-2.5 border-t border-border p-3.5"
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
  )
}
