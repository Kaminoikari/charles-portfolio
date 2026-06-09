import { useEffect, useRef, useState } from 'react'
import { initFaceHero, type FaceHeroHandle } from './faceHero'
import { useAmbientAudio } from '../audio/audio-context'

type Phase = 'loading' | 'ready' | 'running' | 'revealed'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export default function FaceHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<FaceHeroHandle | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const { unmute } = useAmbientAudio()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = prefersReducedMotion()
    const handle = initFaceHero(canvas, {
      assetBase: '/hero/',
      reducedMotion: reduced,
      onProgress: (p) => setProgress(p),
      onReady: () => setPhase('ready'),
      onIntroComplete: () => setPhase('revealed'),
      onError: () => setFailed(true),
    })
    handleRef.current = handle
    return () => { handle.dispose(); handleRef.current = null }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const io = new IntersectionObserver(
      (entries) => { handleRef.current?.setActive(entries[0]?.isIntersecting ?? true) },
      { threshold: 0 },
    )
    io.observe(section)
    const onVisibility = () => { if (!document.hidden) handleRef.current?.setActive(true); else handleRef.current?.setActive(false) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  const onEnter = () => {
    handleRef.current?.startIntro()
    unmute()
    setPhase('running')
  }

  const gateVisible = phase === 'loading' || phase === 'ready'
  const heroTextVisible = phase === 'revealed' || failed

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden supports-[height:100svh]:h-[100svh]"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" role="presentation" aria-hidden="true" />

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

      <div
        className="relative z-10 mx-auto w-full max-w-[1400px] px-6 transition-opacity duration-700 md:px-12"
        style={{ opacity: heroTextVisible ? 1 : 0 }}
      >
        <h1
          className="mx-auto max-w-[900px] text-center text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]"
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

      {phase === 'revealed' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>SCROLL</span>
        </div>
      )}

      {gateVisible && (
        <div
          className="absolute inset-0 z-20 grid place-items-center transition-opacity duration-500"
          style={{ background: 'var(--color-bg-primary)' }}
        >
          <div className="absolute left-8 top-7 text-xs tracking-[0.2em] text-white/55">CHARLES CHEN</div>
          <div className="absolute right-8 top-7 text-xs tracking-[0.2em] text-white/55">AI PRODUCT MANAGER</div>
          {phase === 'loading' ? (
            <div className="font-mono text-xs lowercase tracking-[0.3em] text-white/55">
              loading {Math.round(progress * 100)}%
            </div>
          ) : (
            <button
              type="button"
              onClick={onEnter}
              className="font-mono text-sm lowercase tracking-[0.3em] text-[var(--color-accent-cyan,#00D9FF)] transition-opacity hover:opacity-80"
            >
              [ enter ]
            </button>
          )}
        </div>
      )}
    </section>
  )
}
