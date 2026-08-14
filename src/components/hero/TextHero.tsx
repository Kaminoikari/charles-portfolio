// Hero: the headline over an ambient particle field, and nothing else.
//
// This replaces FaceHero, which built a point-cloud portrait of Charles and
// staged a loader, an Enter gate and a cinematic intro around it. The owner
// asked for the face to come out and the particles to stay, and once the face
// is gone the rest of that apparatus has nothing to do: the gate existed to
// wait out a heavy load and to unlock the heat-vision audio inside a tap, the
// intro was a performance on the face, and the static portrait was its
// fallback. So the hero is now immediate — the field renders on mount and the
// headline is there from the first paint.
//
// What survives: the particle field itself (see particleHero.ts), the headline,
// and the gradient that fades the canvas into the page.

import { useEffect, useRef, useState } from 'react'
import type { ParticleHeroHandle } from './particleHero'

export default function TextHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<ParticleHeroHandle | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  // A reclaimed WebGL context composites as an opaque box rather than nothing,
  // so the canvas has to come out of the page entirely when that happens.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // The field is ambient motion with no informational content, so a visitor
    // who asked for reduced motion gets the headline on a plain background and
    // never downloads three.js.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setFailed(true)
      return
    }

    let cancelled = false
    void import('./particleHero').then(({ initParticleHero }) => {
      // The import can resolve after an unmount; a handle created then would
      // leak its render loop.
      if (cancelled || !canvasRef.current) return
      handleRef.current = initParticleHero(canvas, {
        onError: () => setFailed(true),
      })
    })
    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
    }
  }, [])

  // Pause the loop while the hero is off screen or the tab is hidden: the field
  // is decorative, so an unseen frame buys nothing and costs a full GPU pass.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    let onScreen = true
    let tabVisible = document.visibilityState === 'visible'
    const sync = () => handleRef.current?.setActive(onScreen && tabVisible)
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true
        sync()
      },
      { threshold: 0 },
    )
    io.observe(section)
    const onVisibility = () => {
      tabVisible = document.visibilityState === 'visible'
      sync()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      data-face-hero
      className="relative w-full select-none"
      style={{
        background: 'var(--color-bg-primary)',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* the field fills one viewport; overflow-hidden clips the drift + bloom bleed */}
      <div className="relative flex h-screen w-full items-center justify-center overflow-hidden supports-[height:100svh]:h-[100svh]">
        {!failed && (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            role="presentation"
            aria-hidden="true"
          />
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              'linear-gradient(to bottom, transparent 0%, var(--color-bg-primary) 100%)',
          }}
        />

        {/* headline, dead centre of the field. It used to sit below the hero
            (desktop) or low over it (mobile) because the face owned the middle
            of the frame; with the face gone the centre is the natural place for
            it, which is where the owner asked for it. The text shadow is what
            keeps it readable with motes drifting behind the glyphs. */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
          <h1
            className="max-w-[900px] text-center text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]"
            style={{
              textShadow:
                '0 0 14px rgba(0,0,0,0.85), 0 0 28px rgba(0,0,0,0.6), 0 0 48px rgba(0,0,0,0.45)',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>Hi, I&apos;m </span>
            <span className="font-normal text-white">Charles.</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}> I&apos;m a </span>
            <span className="font-normal text-white">Senior Product Manager</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}> building products at the speed of </span>
            <span className="font-normal text-white">AI.</span>
          </h1>
        </div>
      </div>

      {/* breathing room between the hero and the about section */}
      <div aria-hidden="true" className="h-[12svh] w-full md:h-[24vh]" />
    </section>
  )
}
