// Floating AI chat widget. A launcher (bottom-right, "live" status dot) opens a
// panel that streams grounded answers from /api/chat and shows the retrieved
// chunks + scores — the retrieval engineering made visible ("show, don't tell").
//
// Mounted once, globally (see AppRoutes). All copy is i18n; the panel reads in
// the visitor's locale and the backend answers in the question's language.

import { useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n'
import { useAmbientAudio } from '../audio/audio-context'
import { MuteIcon } from '../audio/MuteIcon'
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

function Message({ message }: { message: ChatMessage }) {
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
      <Sources message={message} />
    </div>
  )
}

export default function ChatWidget() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const audio = useAmbientAudio()
  const { messages, status, send } = useChatStream()
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to the newest message as tokens stream in.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Close on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // While the chat panel is open, hide the third-party Protico "lobby" widget so
  // the two bottom-corner floating elements don't overlap (the panel is near
  // full-width on mobile and collides with the lobby pill). CSS in index.css
  // keys off body.chat-open; we just toggle the class.
  useEffect(() => {
    document.body.classList.toggle('chat-open', open)
    return () => document.body.classList.remove('chat-open')
  }, [open])

  const submit = (question: string) => {
    const q = question.trim()
    if (!q) return
    setInput('')
    void send(q, t('chat.errorMessage'))
  }

  const suggestions = [t('chat.suggested1'), t('chat.suggested2'), t('chat.suggested3')]

  const musicLabel = audio.muted ? t('chat.unmuteMusic') : t('chat.muteMusic')

  if (!open) {
    // Single floating element: a pill whose body opens chat (primary CTA, one
    // click) with the ambient-music toggle folded in as a secondary icon — so
    // the music control no longer needs its own colliding floating button.
    return (
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-1 rounded-full border border-border bg-bg-secondary pr-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-cyan">
        <button
          onClick={() => setOpen(true)}
          aria-label={t('chat.openAriaLabel')}
          className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-transparent py-3 pl-4 text-[14px] text-white"
        >
          <LiveDot />
          <span>{t('chat.launcherLabel')}</span>
          <span className="font-mono text-[10.5px] text-accent-cyan">{t('chat.launcherLive')}</span>
        </button>
        <button
          onClick={audio.toggle}
          aria-label={musicLabel}
          aria-pressed={!audio.muted}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:text-accent-cyan"
        >
          <MuteIcon muted={audio.muted} size={15} />
        </button>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={t('chat.title')}
      className="fixed bottom-5 right-5 z-50 flex h-[min(560px,80vh)] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <LiveDot />
          <div className="text-[15px] font-semibold text-white">{t('chat.title')}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={audio.toggle}
            aria-label={musicLabel}
            aria-pressed={!audio.muted}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-text-tertiary transition-colors hover:text-accent-cyan"
          >
            <MuteIcon muted={audio.muted} size={15} />
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label={t('chat.closeAriaLabel')}
            className="flex h-8 w-8 cursor-pointer items-center justify-center border-none bg-transparent text-[18px] leading-none text-text-tertiary transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <>
            <p className="text-[14px] leading-[1.7] text-text-muted">{t('chat.emptyMessage')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="cursor-pointer rounded-full border border-border bg-transparent px-3 py-1.5 text-[12px] text-text-muted transition-all hover:border-border-hover hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          messages.map((m, i) => <Message key={i} message={m} />)
        )}
        {status === 'streaming' && messages[messages.length - 1]?.text === '' && (
          <div className="flex items-center gap-2 self-start font-mono text-[11px] text-text-tertiary">
            <span className="chat-dots flex gap-1">
              <span className="h-1.5 w-1.5 animate-chat-wave rounded-full bg-accent-cyan" />
              <span className="h-1.5 w-1.5 animate-chat-wave rounded-full bg-accent-cyan" />
              <span className="h-1.5 w-1.5 animate-chat-wave rounded-full bg-accent-cyan" />
            </span>
            {t('chat.thinking')}
          </div>
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
          placeholder={t('chat.inputPlaceholder')}
          maxLength={1000}
          className="flex-1 rounded-[10px] border border-border bg-bg-primary px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors placeholder:text-text-tertiary focus:border-accent-cyan"
        />
        <button
          type="submit"
          disabled={status === 'streaming' || input.trim() === ''}
          aria-label={t('chat.sendAriaLabel')}
          className="cursor-pointer rounded-[10px] border-none bg-accent-mars px-4 text-[14px] font-semibold text-white transition-opacity disabled:cursor-default disabled:opacity-40"
        >
          {t('chat.send')}
        </button>
      </form>
    </div>
  )
}
