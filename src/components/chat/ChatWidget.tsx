// Floating AI chat widget. A launcher (bottom-right, "live" status dot) opens a
// panel that streams grounded answers from /api/chat and shows the retrieved
// chunks + scores — the retrieval engineering made visible ("show, don't tell").
//
// Mounted once, globally (see AppRoutes). All copy is i18n; the panel reads in
// the visitor's locale and the backend answers in the question's language.

import { useEffect, useRef, useState } from 'react'
import { useLocale, useT } from '../../i18n'
import { useChatStream, type ChatMessage } from './useChatStream'
import { useChatMode } from './useChatMode'
import { PipelineTrace } from './PipelineTrace'
import { getVisitorId } from './visitorId'
import { Markdown } from './Markdown'
import { avatarGuideEnabledInBrowser, avatarPlacement, deriveAvatarMode } from './avatarMode'
import { playVoiceCue, type VoiceCue } from './avatarVoice'
import { useHeroIntro } from '../hero/hero-intro-context'
import AvatarGuide from './AvatarGuide'
import { VOICE_VISEMES } from './voiceVisemes.gen'
import type { AvatarGuideHandle, EmotionName, GestureName } from './avatarGuideEngine'

// What Mika performs alongside each voice cue: an expression preset (name,
// weight, hold seconds) and optionally a body gesture. Emotion holds outlast
// their clip slightly so the face doesn't drop the moment the audio ends.
// Applied only when a line actually starts — a skipped cue performs nothing.
const CUE_PERFORMANCE: Record<
  VoiceCue,
  { emotion: readonly [EmotionName, number, number]; gesture?: GestureName }
> = {
  intro: { emotion: ['happy', 1, 3.5], gesture: 'wave' },
  greet: { emotion: ['happy', 1, 2.4], gesture: 'wave' },
  ack: { emotion: ['relaxed', 0.7, 1.8], gesture: 'nod' },
  suggest: { emotion: ['relaxed', 0.7, 1.8], gesture: 'nod' },
  fullscreen: { emotion: ['happy', 0.6, 2.0] },
  bye: { emotion: ['happy', 1, 2.4], gesture: 'bow' },
  done: { emotion: ['happy', 0.8, 2.2], gesture: 'nod' },
  error: { emotion: ['sad', 0.9, 2.6] },
}

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
  // Voice clips are locale-keyed: en gets つむぎ reading katakana-English,
  // ja/zh-TW share the Japanese set (see avatarVoice.ts for the why).
  const { locale } = useLocale()
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
  // True while one of Mika's short voice lines is playing — it borrows the
  // 'speaking' mode so her mouth moves with her own voice, not only with
  // streaming answers.
  const [voiceSpeaking, setVoiceSpeaking] = useState(false)
  const voiceRef = useRef<HTMLAudioElement | null>(null)
  // Live engine handle (null until the engine mounts, and again after
  // teardown) for the imperative performance beats: lip-sync attachment,
  // expressions, gestures. Optional-chained everywhere — the voice works
  // fine before the handle exists, just without the face acting.
  const avatarHandleRef = useRef<AvatarGuideHandle | null>(null)
  const avatarMode = voiceSpeaking ? 'speaking' : deriveAvatarMode(input, status)
  // Viewport class IS tracked live (rotate a phone, resize a window): width
  // moves the avatar between launcher / beside-panel / rail, and height gates
  // the rail stand (a short viewport has no floor space under the pipeline).
  // Height lives in React state, not a CSS media query, because `active` must
  // follow it — display:none alone would leave the engine's rAF loop burning
  // 60fps behind an invisible canvas.
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 880px)').matches)
  const [tall, setTall] = useState(() => window.matchMedia('(min-height: 640px)').matches)
  // md mirrors the rail's own breakpoint (the aside is max-md:hidden): the
  // character stands wherever the rail exists, which starts below `wide`.
  const [md, setMd] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  // The rail's enlarged canvas needs vertical room that the 640px rail floor
  // does not guarantee: at 640 its 330px spacer takes 60% of the visible
  // column and the trace — the reason fullscreen exists, and which the owner
  // asked never be crowded out by her — has ~196px left. Between 640 and 760
  // she keeps the launcher's 180×280 box, which costs 62px of spacer.
  const [roomy, setRoomy] = useState(() => window.matchMedia('(min-height: 760px)').matches)
  useEffect(() => {
    const wq = window.matchMedia('(min-width: 880px)')
    const hq = window.matchMedia('(min-height: 640px)')
    const mq = window.matchMedia('(min-width: 768px)')
    const rq = window.matchMedia('(min-height: 760px)')
    setWide(wq.matches) // re-sync: a flip between first render and this commit would otherwise be lost
    setTall(hq.matches)
    setMd(mq.matches)
    setRoomy(rq.matches)
    const onW = () => setWide(wq.matches)
    const onH = () => setTall(hq.matches)
    const onM = () => setMd(mq.matches)
    const onR = () => setRoomy(rq.matches)
    wq.addEventListener('change', onW)
    hq.addEventListener('change', onH)
    mq.addEventListener('change', onM)
    rq.addEventListener('change', onR)
    return () => {
      wq.removeEventListener('change', onW)
      hq.removeEventListener('change', onH)
      mq.removeEventListener('change', onM)
      rq.removeEventListener('change', onR)
    }
  }, [])
  // 3D avatar guide (docs/plans/avatar-guide.md), on for everyone since the
  // 2026-08-13 launch. Held back while the hero intro owns the screen, for two
  // reasons with one latch: the 5.5MB VRM must not compete with the intro's
  // assets for bandwidth, and the gate's WebGL2 probe (a real GL context, tens
  // of ms on weak mobile GPUs) must not run inside the intro window either —
  // so the gate is evaluated when the latch fires, not in the first render.
  // The 400ms grace covers the first-paint race: HeroIntroProvider starts with
  // introRunning false and FaceHero only flips it true in its first effect
  // pass, which cancels this timer before it fires. Once set, the latch never
  // clears — scrolling back to a replaying hero must not unmount a loaded
  // avatar. Gate inputs (reduced-motion, WebGL2) aren't re-checked afterwards;
  // they don't change mid-session in any way worth re-rendering for.
  const { introRunning } = useHeroIntro()
  const [avatarOn, setAvatarOn] = useState(false)
  // false until the latch has actually evaluated the gate: "gate said no" and
  // "gate not asked yet" must render differently — the capsule shows for the
  // first, and must NOT flash during the second (see capsuleHeldBack below).
  const [gateSettled, setGateSettled] = useState(false)
  useEffect(() => {
    if (introRunning || avatarOn) return
    const id = window.setTimeout(() => {
      setAvatarOn(avatarGuideEnabledInBrowser())
      setGateSettled(true)
    }, 400)
    return () => clearTimeout(id)
  }, [introRunning, avatarOn])
  // The character takes over as the launcher once the VRM's first frame has
  // rendered (engine onLoaded); until then the corner stays EMPTY rather than
  // showing the capsule — the first thing a visitor sees must not be the old
  // widget getting replaced seconds later (user report, real iPhone on 5G).
  // The capsule still exists for every "she is not coming" outcome: gate off,
  // load failed, load slower than the patience window, context lost.
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  // Set when the browser reclaims the WebGL context. A lost-context canvas is
  // not merely blank — Chrome composites it as an opaque white box — so the
  // whole wrapper unmounts (which also disposes the engine and stops its rAF
  // loop). Deliberately never reset: remounting would re-download 5.5MB on a
  // device that just proved it is short on GPU memory; a refresh starts over.
  const [avatarDead, setAvatarDead] = useState(false)
  const refocusCapsuleRef = useRef(false)
  useEffect(() => {
    if (avatarDead && refocusCapsuleRef.current) {
      refocusCapsuleRef.current = false
      launcherRef.current?.focus()
    }
  }, [avatarDead])
  // Patience window: a load that outlives it brings the capsule back so a
  // flaky network never leaves the corner without any way into the assistant.
  // Deliberately never reset — if she arrives later, the swap hides it again.
  const [avatarSlow, setAvatarSlow] = useState(false)
  useEffect(() => {
    if (!avatarOn || avatarLoaded || avatarDead || avatarFailed) return
    const id = window.setTimeout(() => setAvatarSlow(true), 12000)
    return () => clearTimeout(id)
  }, [avatarOn, avatarLoaded, avatarDead, avatarFailed])
  // Mika speaks a short line at interaction moments — only while she is
  // actually on duty. Every call sits inside the visitor's tap/keypress, which
  // is exactly what iOS requires for audio, so no unlock dance is needed here,
  // and it means sound can be unconditional: a line never plays unless the
  // visitor just acted (the old ambient-music mute gate was removed with the
  // background-music FAB).
  // Returns whether a line actually started, so callers with one-shot latches
  // (the session intro) only burn their shot on a real playback.
  const speakCue = (cue: VoiceCue): boolean => {
    if (!avatarOn || !avatarLoaded || avatarDead) return false
    const current = voiceRef.current
    // Stream-outcome cues yield to a line she is already speaking: a cached
    // answer can finish in ~0.5s, and letting 'done' preempt chopped the ack
    // ~0.1s in — an audible pop (diagnosed on production 2026-08-13). The
    // skipped line is never queued: by then the answer is on screen and the
    // in-flight ack already covers the delivery. Gesture cues still preempt.
    if ((cue === 'done' || cue === 'error') && current && !current.paused && !current.ended) {
      return false
    }
    current?.pause() // never overlap two lines
    // One shared reset for every way a line can stop: finished, media error,
    // or play() refused outright (iOS rejects the off-gesture done/error cues
    // with NO DOM event — only the onBlocked callback catches that one).
    const done = () => {
      if (voiceRef.current === el) {
        setVoiceSpeaking(false)
        avatarHandleRef.current?.setSpeech(null, null)
      }
    }
    const el = playVoiceCue(cue, locale, undefined, () => done())
    voiceRef.current = el
    setVoiceSpeaking(true)
    el.addEventListener('ended', done)
    el.addEventListener('error', done)
    // Performance beats ride the same "a line actually started" condition as
    // the latch above. Lip sync keys the viseme timeline by clip filename —
    // the same key both locale catalogues and the generator share.
    const clipKey = (el.src.split('/').pop() ?? '').replace(/\.m4a$/, '')
    const handle = avatarHandleRef.current
    handle?.setSpeech(el, VOICE_VISEMES[clipKey] ?? null)
    const perf = CUE_PERFORMANCE[cue]
    handle?.setEmotion(...perf.emotion)
    if (perf.gesture) handle?.playGesture(perf.gesture)
    return true
  }
  useEffect(() => () => voiceRef.current?.pause(), [])
  // The full self-introduction plays on the first panel open of the
  // tab-session; every later open uses the short greet pool. In-memory ref
  // twin mirrors the sessionStorage flag for storage-blocked contexts (same
  // pattern as the speech bubble below). Today only the launcher/bubble
  // (avatarIsLauncher) reach this, so she is always on duty here; the
  // burn-only-on-real-playback check is insurance for future call sites.
  const introSpokenRef = useRef(false)
  const speakOpenCue = () => {
    let spoken = introSpokenRef.current
    try {
      spoken = spoken || sessionStorage.getItem('mikaIntroSpoken') === '1'
    } catch {
      /* storage blocked: ref alone carries the latch */
    }
    if (spoken) {
      speakCue('greet')
      return
    }
    if (!speakCue('intro')) return
    introSpokenRef.current = true
    try {
      sessionStorage.setItem('mikaIntroSpoken', '1')
    } catch {
      /* storage blocked */
    }
  }
  const avatarLauncherRef = useRef<HTMLButtonElement>(null)
  // First-visit affordance (the "B" half of the chosen C+B design): a speech
  // bubble invites the first tap, once per tab-session, gone after 8s. The
  // character alone reads as decoration to a first-time visitor; the bubble
  // teaches the click, then never nags again.
  const [bubble, setBubble] = useState<'hidden' | 'shown' | 'leaving'>('hidden')
  // In-memory twin of the sessionStorage flag: with storage blocked, the effect
  // re-runs on every panel close and would re-show the bubble after every
  // conversation without this. Survives for the mount, which is all we need.
  const bubbleShownRef = useRef(false)
  useEffect(() => {
    if (open) {
      // Opening the panel is the very action the bubble invites, and it also
      // clears this effect's timers — without this reset, a visitor who taps
      // her within the 8s window would find the bubble back (and permanent)
      // after closing the panel, because the sessionStorage guard blocks any
      // rescheduling.
      setBubble('hidden')
      return
    }
    if (!avatarLoaded) return
    if (bubbleShownRef.current) return
    // sessionStorage THROWS with storage fully blocked (Chrome "block all
    // cookies", some WebViews) — and an uncaught throw here bubbles to the
    // ErrorBoundary and unmounts the entire chat widget. Blocked storage just
    // means the bubble may show again next load; that beats losing the chat.
    try {
      if (sessionStorage.getItem('avatarBubbleSeen')) return
      sessionStorage.setItem('avatarBubbleSeen', '1')
    } catch {
      // storage unavailable — show it this once; the ref above stops the re-nag
    }
    bubbleShownRef.current = true
    setBubble('shown')
    const hide = window.setTimeout(() => setBubble('leaving'), 8000)
    const gone = window.setTimeout(() => setBubble('hidden'), 8600)
    return () => {
      clearTimeout(hide)
      clearTimeout(gone)
    }
  }, [avatarLoaded, open])

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
      // whichever launcher is live right now: the character once loaded,
      // otherwise the capsule
      ;(avatarLauncherRef.current ?? launcherRef.current)?.focus()
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

  const submit = (question: string, cue: VoiceCue = 'ack') => {
    if (regionBlocked) return
    const q = question.trim()
    if (!q) return
    setInput('')
    speakCue(cue)
    void send(q, t('chat.errorMessage'))
  }

  // Stream-outcome cues. These two fire from a state transition, not a tap, so
  // iOS declines the fresh play() and they are desktop-only by design (the
  // trade-off is recorded in the plan doc). Guarded on `open` so a visitor who
  // minimised mid-stream isn't startled by a voice with no visible answer.
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev !== 'streaming' || !open) return
    const last = messages[messages.length - 1]
    if (status === 'error') speakCue('error')
    else if (status === 'idle' && last && last.text) {
      // Pipeline failures arrive as an SSE error frame over HTTP 200: the
      // stream ends with status 'idle' and the message flagged error — the
      // status alone never says 'error' for those, so route on the flag.
      speakCue(last.error ? 'error' : 'done')
    }
    // speakCue and messages are deliberately unlisted: this effect must react to
    // status edges only, never re-fire on token appends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, open])

  const suggestions = [
    t('chat.suggested1'),
    t('chat.suggested2'),
    t('chat.suggested3'),
    t('chat.suggested4'),
    t('chat.suggested5'),
    t('chat.suggested6'),
  ]

  // One persistent avatar wrapper across every placement: the wrapper element
  // type never changes, so React never remounts the canvas and the 5.5MB VRM is
  // fetched and parsed exactly once. The interactive parts (launcher button,
  // ground ring, bubble) are conditional SIBLINGS of the canvas inside it —
  // they may come and go without touching the engine.
  //
  // Placements:
  //  launcher      she IS the launcher: an inset button overlays the figure
  //                (aria-label preserved; focus-visible shows the ground ring
  //                instead of a 280px focus rectangle). Until the VRM reports
  //                loaded, the capsule stays and this wrapper ignores pointers.
  //                Known cost, unchanged from the capsule era: the button also
  //                covers the transparent pixels around the figure.
  //  beside-panel  docked panel, wide viewport. Offset 436px = panel right
  //                inset 20px + panel width 400px (the min() in the panel class
  //                always resolves to 400px on ≥880px viewports) + 16px gap.
  //                Canvas 220×342 here and in the rail: once the chat is open
  //                she is something the visitor is looking AT, and the space
  //                either side of the panel is free. She grows up and to the
  //                left from the same corner, so the panel never moves.
  //  rail          wide fullscreen: she stands at the bottom of the pipeline
  //                rail. Panel is inset-4 with a 236px rail column, so
  //                left = 16 + (236-w)/2 centres her canvas in it: 24px for
  //                the 220px box, 44px for the 180px one a short viewport
  //                falls back to; z-[55] beats the panel's z-50; rendered at full
  //                size (the old 80% shrink fought the whole point of the
  //                fullscreen view, where there is the most room to actually
  //                watch her) with the trace spacer below reserving the taller
  //                footprint; hidden under 640px viewport height where the two
  //                would collide.
  //  hidden        narrow fullscreen or docked-on-phone: display:none, engine
  //                paused, never unmounted.
  // A short viewport downgrades 'rail' to 'hidden' inside avatarPlacement
  // (React state, not a CSS media query), so `active` below genuinely stops
  // the render loop too.
  const placement = avatarPlacement(mode, wide, tall, md)
  // !avatarDead guards a context-loss race: a frame scheduled between the
  // webglcontextlost event and this commit could still report onLoaded, and
  // launcher-true here with the wrapper unmounted would leave NO launcher.
  const avatarIsLauncher = placement === 'launcher' && avatarLoaded && !avatarDead
  // Enlarged canvas for the two chat-open placements; the rail also needs the
  // vertical room (see `roomy`). Keeps the 180:280 aspect — the waist-up
  // framing is composed for it.
  const avatarBig = placement === 'beside-panel' || (placement === 'rail' && roomy)
  // Hold the capsule back while the character is plausibly on her way: before
  // the gate has even been asked, and during a healthy load. Every "she is not
  // coming" signal (gate off, failure, patience window, dead context) releases
  // it, and avatarIsLauncher hides it again once she has taken over.
  const capsuleHeldBack =
    !gateSettled || (avatarOn && !avatarLoaded && !avatarDead && !avatarFailed && !avatarSlow)
  const avatar = avatarOn && !avatarDead && (
    <div
      aria-hidden={avatarIsLauncher ? undefined : true}
      className={
        placement === 'hidden'
          ? 'hidden'
          : placement === 'beside-panel'
            ? 'pointer-events-none fixed bottom-5 right-[436px] z-50'
            : placement === 'rail'
              ? avatarBig
                ? 'pointer-events-none fixed bottom-6 left-[24px] z-[55]'
                : 'pointer-events-none fixed bottom-6 left-[44px] z-[55]'
              : // launcher: glides from above the capsule down into the corner
                // once she takes over as the button. 72% on narrow screens
                // reduces how much of a phone's hero headline she covers; it
                // does not clear it — a fixed figure over a 390px page overlaps
                // something at some scroll position no matter where it stands.
                (avatarIsLauncher
                  ? 'fixed bottom-4 right-6 z-50'
                  : 'pointer-events-none fixed bottom-[84px] right-6 z-50') +
                // max-[880px] = width < 880px, the exact complement of the
                // `wide` matchMedia — max-[879px] left a 1px seam at 879.
                ' transition-[bottom] duration-500 max-[880px]:origin-bottom-right max-[880px]:scale-[0.72]'
      }
    >
      <AvatarGuide
        mode={avatarMode}
        active={placement !== 'hidden'}
        sizeClass={avatarBig ? 'h-[342px] w-[220px]' : 'h-[280px] w-[180px]'}
        onHandle={(h) => {
          avatarHandleRef.current = h
        }}
        onLoaded={() => setAvatarLoaded(true)}
        // Releases the held-back capsule: with the corner kept empty during a
        // healthy load, a failed load MUST report itself or nothing ever shows.
        onLoadFailed={() => setAvatarFailed(true)}
        // A reclaimed WebGL context means the character is gone for good this
        // page-load: unmount the wrapper (the dead canvas composites as an
        // opaque white box) and bring the capsule back — an invisible button
        // in the corner would otherwise be the only way into the assistant.
        onContextLost={() => {
          // Unmounting a focused element drops focus to <body>; if the
          // character button held it, hand it to the returning capsule.
          refocusCapsuleRef.current =
            avatarLauncherRef.current !== null &&
            document.activeElement === avatarLauncherRef.current
          setAvatarDead(true)
          setAvatarLoaded(false)
        }}
      />
      {avatarIsLauncher && (
        <>
          <button
            ref={avatarLauncherRef}
            onClick={() => {
              speakOpenCue()
              openPanel()
            }}
            aria-label={t('chat.openAriaLabel')}
            // data-own-focus-ring: opts out of index.css's global unlayered
            // `*:focus-visible` outline, which beats any Tailwind utility via
            // cascade-layer ordering. The glow below is this button's focus
            // indicator, in place of a cyan rectangle around the whole canvas.
            data-own-focus-ring=""
            className="group absolute inset-0 cursor-pointer outline-none"
          >
            {/* hover/focus affordance, in place of a rectangle around the
                canvas. This used to be a ground ring at her feet, which the
                waist-up camera put out of frame: it read as a cyan disc
                hovering under her fading skirt. A glow centred on her body
                needs no floor, so it survives a change of framing.
                mix-blend-screen keeps it additive over her instead of a veil,
                which also spares this from depending on stacking order. */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-[24%] h-[54%] w-[150%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(0,217,255,0.30),transparent_70%)] opacity-0 mix-blend-screen transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          </button>
          {bubble !== 'hidden' && (
            <div
              aria-hidden="true"
              // The bubble invites a tap, so tapping IT must work too — the
              // character button sits to its right and a tap on the text would
              // otherwise fall through to whatever page content is underneath.
              // Redundant click target: keyboard/AT users have the button.
              onClick={() => {
                speakOpenCue()
                openPanel()
              }}
              className={
                // The before/after pair draws the speech tail pointing at her:
                // a border-coloured triangle underneath, the fill triangle one
                // pixel inset on top — same construction as a bordered bubble.
                // The narrow-screen sizes compensate for the wrapper's 72%
                // scale (18×0.72≈13px, 240×0.72≈173px): the bubble is the only
                // thing teaching a touch visitor she is tappable, so it must
                // not render at 9px.
                'absolute right-[150px] top-6 w-[190px] rounded-2xl rounded-br-[4px] border border-border bg-bg-secondary px-4 py-3 text-left text-[13px] leading-snug text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-opacity duration-500 max-[880px]:w-[240px] max-[880px]:text-[18px] max-[359px]:w-[184px] ' +
                'before:absolute before:-right-[16px] before:bottom-[10px] before:h-0 before:w-0 before:border-8 before:border-transparent before:border-l-border before:content-[""] ' +
                'after:absolute after:-right-[13px] after:bottom-[11px] after:h-0 after:w-0 after:border-7 after:border-transparent after:border-l-bg-secondary after:content-[""] ' +
                (bubble === 'shown'
                  ? // starting:opacity-0 (@starting-style) gives the mount a
                    // fade-in in browsers that support it; older ones show it
                    // instantly, which is what happened everywhere before.
                    'cursor-pointer opacity-100 starting:opacity-0'
                  : 'pointer-events-none opacity-0')
              }
            >
              {t('chat.avatarBubble')}
            </div>
          )}
        </>
      )}
    </div>
  )

  if (!open) {
    // Single floating CTA (bottom-right): one click opens chat. Once the character
    // has loaded, SHE is the launcher and the capsule leaves; the capsule
    // renders for gated-off visitors, while the VRM is still downloading, and
    // if it never loads.
    return (
      <>
        {avatar}
        {!avatarIsLauncher && !capsuleHeldBack && (
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
        )}
      </>
    )
  }

  return (
    <>
      {avatar}
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
              onClick={() => {
                if (!fullscreen) speakCue('fullscreen') // entering only; collapse is silent
                toggleFullscreen()
              }}
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
              onClick={() => {
                speakCue('bye')
                minimise()
              }}
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
              {/* The rail's job changes with state: before the first question it
                  invites one (suggestions); after that it belongs to the
                  pipeline. Keeping both stacked would also push the trace's
                  last stations down behind the character standing at the
                  rail's foot. The status guard matters on FOLLOW-UP questions:
                  send() clears the trace in the same batch it sets 'streaming',
                  so without it the suggestions would flash back for the
                  hundreds of ms before the first node event arrives. */}
              {trace.length === 0 && status !== 'streaming' && (
                <div className="flex flex-col gap-2">
                  <h3 className="font-mono text-[10px] font-medium uppercase tracking-[1.1px] text-text-tertiary">
                    {t('chat.suggestionsTitle')}
                  </h3>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s, 'suggest')}
                      // The outer guard already excludes streaming, so only the
                      // region block can disable these now.
                      disabled={regionBlocked}
                      className="cursor-pointer rounded-[10px] border border-border bg-transparent px-2.5 py-2 text-left text-[12.5px] leading-snug text-text-muted transition-colors hover:border-border-hover hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {/* The reason fullscreen exists: the retrieval pipeline, visible
                  while it runs. The docked panel has no room for it. */}
              <PipelineTrace trace={trace} />
              {/* The character stands (fixed, z-[55]) over the bottom of this
                  rail. Reserve her floor space with a real element so a long
                  trace scrolls to rest above her head — block-end PADDING on
                  an overflow container is dropped from the scroll extent by
                  some engines, a spacer never is. Both numbers are derived:
                  her canvas top is vh−366 on the 342px canvas and vh−304 on
                  the 280px one (bottom-6 + the canvas), the aside's bottom
                  padding is 16px and gap-5 adds 20px — change any of those (or
                  the panel's inset-4) and these move with them. Measured
                  against the canvas rather than her hairline, so the waist-up
                  framing's headroom reads as breathing space between the trace
                  and her. */}
              {avatarOn && avatarLoaded && placement === 'rail' && (
                <div aria-hidden className={avatarBig ? 'h-[330px] shrink-0' : 'h-[268px] shrink-0'} />
              )}
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
                  onClick={() => submit(s, 'suggest')}
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
