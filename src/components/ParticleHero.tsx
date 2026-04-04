import { useEffect, useRef } from 'react'

// --- Antigravity-style ring particle constants ---
const PARTICLE_COUNT = 1500
const PARTICLE_ROWS = 25
const PARTICLE_SIZE = 1.5
const RING_RADIUS_MIN = 150
const RING_RADIUS_MAX = 250
const RING_THICKNESS = 500
const RING_BREATHE_SPEED = 0.001 // 6s full cycle
const RIPPLE_SPEED = 0.001
const MOUSE_EASE_SPEED = 0.02 // smooth follow (lower = slower, ~3s to reach target)

const KONAMI_SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight']
const EASTER_EGG_DURATION_MS = 4000

interface RingParticle {
  // Static properties (set once)
  angle: number // angle around ring
  radiusOffset: number // distance from ring center (within thickness)
  row: number // which row
  baseAlpha: number
  phase: number // for ripple offset
}

export default function ParticleHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const textOffsetRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)
  const animIdRef = useRef(0)
  const easterEggRef = useRef(false)
  const konamiIndexRef = useRef(0)

  // Mouse tracking with ease
  const mouseTargetRef = useRef({ x: 0.5, y: 0.5 }) // normalized 0-1
  const mouseSmoothRef = useRef({ x: 0.5, y: 0.5 })
  const isMouseOverRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    const particles: RingParticle[] = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * window.devicePixelRatio
      canvas.height = height * window.devicePixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    const initParticles = () => {
      particles.length = 0
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const row = Math.floor(Math.random() * PARTICLE_ROWS)
        particles.push({
          angle: Math.random() * Math.PI * 2,
          radiusOffset: Math.random() * RING_THICKNESS,
          row,
          baseAlpha: 0.1 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    resize()
    initParticles()

    const onResize = () => { resize(); initParticles() }
    window.addEventListener('resize', onResize)

    const onMouseMove = (e: MouseEvent) => {
      mouseTargetRef.current.x = e.clientX / window.innerWidth
      mouseTargetRef.current.y = e.clientY / window.innerHeight
      isMouseOverRef.current = true

      // Text repulsion
      if (textRef.current) {
        const rect = textRef.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 300 && dist > 0) {
          const strength = ((1 - dist / 300) ** 2) * 20
          textOffsetRef.current.x = (dx / dist) * strength
          textOffsetRef.current.y = (dy / dist) * strength
        }
      }
    }
    const onMouseLeave = () => {
      isMouseOverRef.current = false
      mouseTargetRef.current.x = 0.5
      mouseTargetRef.current.y = 0.5
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { threshold: 0.05 },
    )
    observer.observe(section)

    let time = 0
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate)
      if (!visibleRef.current) return

      time += 1
      ctx.clearRect(0, 0, width, height)

      // Smooth mouse follow (ease toward target)
      const ms = mouseSmoothRef.current
      const mt = mouseTargetRef.current
      ms.x += (mt.x - ms.x) * MOUSE_EASE_SPEED
      ms.y += (mt.y - ms.y) * MOUSE_EASE_SPEED

      // Ring center in pixels
      const ringCX = ms.x * width
      const ringCY = ms.y * height

      // Breathing ring radius
      const breathe = Math.sin(time * RING_BREATHE_SPEED) * 0.5 + 0.5
      const ringRadius = RING_RADIUS_MIN + breathe * (RING_RADIUS_MAX - RING_RADIUS_MIN)

      // Ripple phase
      const rippleTick = (time * RIPPLE_SPEED) % 1

      const isRainbow = easterEggRef.current

      // Draw particles
      for (const p of particles) {
        // Ripple: offset radius based on particle phase + global ripple tick
        const rippleWave = Math.sin((rippleTick + p.phase) * Math.PI * 2) * 20

        // Final radius for this particle
        const r = ringRadius + p.radiusOffset + rippleWave

        // Position
        const x = ringCX + Math.cos(p.angle) * r
        const y = ringCY + Math.sin(p.angle) * r

        // Skip if off screen
        if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue

        // Alpha with subtle pulse
        const alphaPulse = 0.7 + 0.3 * Math.sin(time * 0.02 + p.phase * 3)
        const alpha = p.baseAlpha * alphaPulse

        ctx.globalAlpha = alpha

        if (isRainbow) {
          const hue = (time * 2 + p.phase * 57) % 360
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`
        } else {
          // Light gray/blue on black background
          ctx.fillStyle = `rgba(180, 190, 210, 1)`
        }

        ctx.fillRect(x - PARTICLE_SIZE / 2, y - PARTICLE_SIZE / 2, PARTICLE_SIZE, PARTICLE_SIZE)
      }
      ctx.globalAlpha = 1

      // Text offset decay
      const tOff = textOffsetRef.current
      tOff.x *= 0.92
      tOff.y *= 0.92
      if (textRef.current) {
        textRef.current.style.transform = `translate(${tOff.x}px, ${tOff.y}px)`
      }
    }

    animate()

    return () => {
      cancelAnimationFrame(animIdRef.current)
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // Konami code + easter egg listener
  useEffect(() => {
    const activateEasterEgg = () => {
      easterEggRef.current = true
      setTimeout(() => { easterEggRef.current = false }, EASTER_EGG_DURATION_MS)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI_SEQUENCE[konamiIndexRef.current]) {
        konamiIndexRef.current++
        if (konamiIndexRef.current === KONAMI_SEQUENCE.length) {
          konamiIndexRef.current = 0
          activateEasterEgg()
        }
      } else {
        konamiIndexRef.current = e.key === KONAMI_SEQUENCE[0] ? 1 : 0
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('easter-egg', activateEasterEgg)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('easter-egg', activateEasterEgg)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden"
      style={{ background: '#0A0A0A' }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" role="presentation" aria-hidden="true" />

      {/* Bottom gradient fade */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, #0A0A0A 100%)' }}
      />

      <div ref={textRef} className="relative z-10 max-w-[900px] px-6">
        <h1 className="text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]">
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>My name is </span>
          <span className="font-normal text-white">Charles.</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> I'm a Product Manager building products that drive </span>
          <span className="font-normal text-white">millions of users</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> and </span>
          <span className="font-normal text-white">mass revenue</span>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}> at scale.</span>
        </h1>

        <div className="mt-10 font-mono text-[11px] uppercase tracking-[3px] text-text-muted md:text-xs">
          <span className="text-accent-cyan">6M+</span> Users · <span className="text-accent-cyan">85%</span> Revenue Impact · <span className="text-accent-cyan">5x</span> Faster with AI
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>SCROLL ↓</span>
      </div>
    </section>
  )
}
