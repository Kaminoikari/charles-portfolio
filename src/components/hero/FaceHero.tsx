import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FaceHeroHandle } from './faceHero'
import { useAmbientAudio } from '../audio/audio-context'
import MobiusLoader from './MobiusLoader'

type Phase = 'loading' | 'ready' | 'running' | 'revealed'

// loader status copy: rotated every few seconds under the Mobius mark
// while assets stream in. The first line keeps the word "loading" so the gate
// always names its state even if the visitor catches only one message.
const LOADING_MESSAGES = [
  'Loading the experience. Good things take a few milliseconds.',
  'Waking the particles. Each one knows where to go.',
  'Aligning pixels and code. Almost ready.',
  'Tuning the ambient soundtrack behind the scenes.',
  'Finalizing the details. Just a moment more.',
]
const MESSAGE_HOLD_MS = 3000
const MESSAGE_FADE_MS = 400
const GATE_FADE_OUT_MS = 700
// the bar always plays a full 0-to-100 sweep even on instant cache hits: displayed
// progress is the SLOWER of a fixed-time ramp and the real asset progress, so a
// fast load still reads as a deliberate 2s arrival and a slow load stays honest.
const MIN_GATE_MS = 2000
const PROGRESS_TICK_MS = 50
// the loading→enter handoff rhythm: the bar completes and glows,
// a short beat, then the copy and bar fade together while ENTER blooms into the
// copy's spot; the fading elements unmount once their exit finishes.
const HANDOFF_HOLD_MS = 400
const HANDOFF_FADE_MS = 600
const HANDOFF_TOTAL_MS = HANDOFF_HOLD_MS + HANDOFF_FADE_MS
const HANDOFF_EXIT_STYLE = {
  opacity: 0,
  transition: `opacity ${HANDOFF_FADE_MS}ms ease ${HANDOFF_HOLD_MS}ms`,
} as const

function LoadingMessages({ messages, frozen = false }: { messages: string[]; frozen?: boolean }) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (frozen) return   // the handoff owns the exit fade; stop rotating mid-goodbye
    let holdTimer = 0
    let fadeTimer = 0
    const cycle = () => {
      holdTimer = window.setTimeout(() => {
        setVisible(false)
        fadeTimer = window.setTimeout(() => {
          setIndex((i) => (i + 1) % messages.length)
          setVisible(true)
          cycle()
        }, MESSAGE_FADE_MS)
      }, MESSAGE_HOLD_MS)
    }
    cycle()
    return () => { clearTimeout(holdTimer); clearTimeout(fadeTimer) }
  }, [messages, frozen])

  return (
    <span
      className="font-mono text-xs uppercase tracking-[0.08em] text-white"
      style={
        frozen
          ? HANDOFF_EXIT_STYLE
          : { opacity: visible ? 1 : 0, transition: `opacity ${MESSAGE_FADE_MS}ms` }
      }
    >
      {messages[index]}
    </span>
  )
}

// the splash gate plays once per browser-tab session; in-site navigation back to
// the home route within the same session skips the gate and the intro, landing
// straight on the settled portrait (no forced muted replay).
const SESSION_KEY = 'faceHeroSeen'

function alreadySeenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markSeenThisSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // sessionStorage can throw in privacy modes; the gate just shows again, which is harmless
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export default function FaceHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<FaceHeroHandle | null>(null)
  const [phase, setPhase] = useState<Phase>(() => (alreadySeenThisSession() ? 'revealed' : 'loading'))
  const [displayedProgress, setDisplayedProgress] = useState(0)
  const realProgressRef = useRef(0)
  const engineReadyRef = useRef(false)
  const [failed, setFailed] = useState(false)
  const { unmute, unlock } = useAmbientAudio()
  const enteredRef = useRef(false)   // true only after a real Enter click, so a same-session skip stays silent
  const unmuteRef = useRef(unmute)   // keep the init effect off unmute's identity so it still runs once
  useEffect(() => { unmuteRef.current = unmute }, [unmute])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = prefersReducedMotion()
    const seen = alreadySeenThisSession()
    let disposed = false
    // Load the three.js engine lazily so ~440 kB gzip of three + postprocessing
    // leaves the entry chunk (the MobiusLoader gate already covers the gap). If
    // the visitor navigates away before it resolves, skip init entirely.
    import('./faceHero')
      .then(({ initFaceHero }) => {
        if (disposed) return
        const handle = initFaceHero(canvas, {
          assetBase: '/hero/',
          reducedMotion: reduced,
          onProgress: (p) => { realProgressRef.current = p },
          onReady: () => { if (seen) handleRef.current?.startIntro(true); else engineReadyRef.current = true },
          onIntroComplete: () => { setPhase('revealed'); if (enteredRef.current) unmuteRef.current() },   // BGM fades in only after the intro, and only when the visitor actually entered
          onError: () => setFailed(true),
        })
        handleRef.current = handle
      })
      .catch(() => setFailed(true))
    return () => { disposed = true; handleRef.current?.dispose(); handleRef.current = null }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    // resume the engine only when the hero is BOTH on-screen and in a visible tab; either alone keeps it paused
    let isOnScreen = true
    let isTabVisible = !document.hidden
    const syncActive = () => handleRef.current?.setActive(isOnScreen && isTabVisible)
    const io = new IntersectionObserver(
      (entries) => { isOnScreen = entries[0]?.isIntersecting ?? true; syncActive() },
      { threshold: 0 },
    )
    io.observe(section)
    const onVisibility = () => { isTabVisible = !document.hidden; syncActive() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  // drive the displayed progress: a steady ramp capped by real progress; the gate
  // flips to ready only when the bar has actually reached full
  useEffect(() => {
    if (phase !== 'loading' || failed) return
    const startedAt = Date.now()
    const id = window.setInterval(() => {
      const timeProgress = Math.min((Date.now() - startedAt) / MIN_GATE_MS, 1)
      const realProgress = engineReadyRef.current ? 1 : realProgressRef.current
      const next = Math.min(timeProgress, realProgress)
      setDisplayedProgress(next)
      if (next >= 1) setPhase('ready')
    }, PROGRESS_TICK_MS)
    return () => clearInterval(id)
  }, [phase, failed])

  // once ready, hold the loading copy and bar through their exit fade, then drop
  // them; ENTER is already blooming into the copy's spot during the overlap
  const [handoffDone, setHandoffDone] = useState(false)
  useEffect(() => {
    if (phase !== 'ready') return
    const id = window.setTimeout(() => setHandoffDone(true), HANDOFF_TOTAL_MS)
    return () => clearTimeout(id)
  }, [phase])

  const [gateDismissed, setGateDismissed] = useState(false)
  const gateFadeTimer = useRef(0)
  useEffect(() => () => clearTimeout(gateFadeTimer.current), [])

  const onEnter = () => {
    markSeenThisSession()
    enteredRef.current = true
    handleRef.current?.startIntro()
    unlock()                 // unlock audio inside the click; the track stays silent until the intro ends
    setPhase('running')
    gateFadeTimer.current = window.setTimeout(() => setGateDismissed(true), GATE_FADE_OUT_MS)
  }

  const gateActive = phase === 'loading' || phase === 'ready'
  // after Enter the overlay stays mounted just long enough to fade out over the
  // starting intro; an engine error drops the gate immediately so the static
  // fallback underneath is actually reachable.
  const gateMounted = (gateActive || phase === 'running') && !gateDismissed && !failed
  const heroTextVisible = phase === 'revealed' || failed

  return (
    <section
      ref={sectionRef}
      data-face-hero
      className="relative w-full select-none"
      style={{ background: 'var(--color-bg-primary)', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      {/* visual hero: the face fills one viewport; overflow-hidden clips the dust + bloom bleed */}
      <div className="relative flex h-screen w-full items-center justify-center overflow-hidden supports-[height:100svh]:h-[100svh]">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          role="presentation"
          aria-hidden="true"
        />

        {failed && (
          <img
            src="/hero/charles-face.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto h-auto max-h-[70vh] w-auto opacity-80"
          />
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg-primary) 100%)' }}
        />
      </div>

      {/* breathing room between the hero and the about section; on desktop it also hosts the headline */}
      <div aria-hidden="true" className="h-[12svh] w-full md:h-[24vh]" />

      {/* headline: mobile keeps it low over the lower hero; desktop drops it into the centre of
          the hero/about gap */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[25svh] z-10 flex flex-col items-center px-6 transition-opacity duration-700 md:bottom-auto md:top-[100svh] md:h-[24vh] md:justify-center"
        style={{ opacity: heroTextVisible ? 1 : 0 }}
      >
        <h1
          className="max-w-[900px] text-center text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]"
          style={{ textShadow: '0 0 14px rgba(0,0,0,0.85), 0 0 28px rgba(0,0,0,0.6), 0 0 48px rgba(0,0,0,0.45)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Hi, I&apos;m </span>
          <span className="font-normal text-white">Charles.</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}> I&apos;m a </span>
          <span className="font-normal text-white">Senior Product Manager</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}> building products at the speed of </span>
          <span className="font-normal text-white">AI.</span>
        </h1>
      </div>

      {gateMounted && createPortal(
        // portaled to <body> as a full-viewport overlay so it sits above the fixed nav,
        // chat launcher, and music toggle (all z-50); loader layout: Mobius mark
        // dead-centre, rotating status copy 100px below centre, and a 1px
        // progress hairline 50px above the bottom edge.
        <div
          className="fixed inset-0 z-[100] bg-black"
          style={{
            touchAction: 'none',
            opacity: gateActive ? 1 : 0,
            transition: `opacity ${GATE_FADE_OUT_MS}ms ease`,
            pointerEvents: gateActive ? 'auto' : 'none',
          }}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <MobiusLoader size={100} />
          </div>

          {!handoffDone && (
            <div className="absolute inset-x-2.5 top-1/2 mt-[100px] text-center">
              <LoadingMessages messages={LOADING_MESSAGES} frozen={phase !== 'loading'} />
            </div>
          )}

          {phase !== 'loading' && (
            <div className="absolute inset-x-0 top-1/2 mt-[92px] flex justify-center">
              <button
                type="button"
                onClick={onEnter}
                className="gate-enter pointer-events-auto flex items-center gap-5 py-2 font-mono text-xs uppercase tracking-[0.35em] text-white"
              >
                <span aria-hidden="true" className="gate-enter-line gate-enter-line-left" />
                Enter
                <span aria-hidden="true" className="gate-enter-line gate-enter-line-right" />
              </button>
            </div>
          )}

          {!handoffDone && (
            <div
              role="progressbar"
              aria-valuenow={Math.round(displayedProgress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="absolute bottom-[50px] left-1/2 h-px w-[300px] -translate-x-1/2 bg-[#333]"
              style={phase === 'loading' ? undefined : HANDOFF_EXIT_STYLE}
            >
              <div
                className="h-full bg-white"
                style={{
                  width: `${Math.round(displayedProgress * 100)}%`,
                  transition: `width ${PROGRESS_TICK_MS * 2}ms linear, box-shadow 400ms ease`,
                  boxShadow: displayedProgress >= 1 ? '0 0 12px rgba(255,255,255,0.75)' : 'none',
                }}
              />
            </div>
          )}
        </div>,
        document.body,
      )}
    </section>
  )
}
